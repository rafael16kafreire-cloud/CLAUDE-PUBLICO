// Completa as animações que faltam num .glb já pronto (que já tem esqueleto e algumas animações).
// As novas animações são feitas por cima de uma pose/animação existente, girando ossos em volta de eixos
// do MUNDO (X = esquerda do bicho, Y = cima, Z = frente) e movendo o osso raiz em metros.
// Uso:
//   node completar.mjs modelos/trex.glb --ossos          lista os ossos (nome, pai, posição em metros)
//   node completar.mjs completar/trex.mjs                  gera as animações descritas no arquivo
// O arquivo de descrição exporta: { modelo, vars? (constantes usadas dentro de f), saida, clipes: [{ nome, base, baseVel?, dur, loop?, f(t, d, u) }], material?(THREE, mat) }
//   f devolve { 'osso': [graus X, graus Y, graus Z] ou quatérnio [x, y, z, w], ..., $pos: { 'osso': [dx, dy, dz] metros } }
//   u = utilidades: u.s(x) suaviza 0..1, u.e(t, a, b) rampa suave entre os tempos a e b, u.sin(t, período)
import { createRequire } from 'node:module'; import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path'; import { pathToFileURL } from 'node:url';
const { chromium } = createRequire(import.meta.url)('playwright');
const arg = resolve(process.argv[2]), dump = process.argv.includes('--ossos');
const desc = dump ? { modelo: arg, clipes: [] } : (await import(pathToFileURL(arg).href)).default;
const modelo = dump ? arg : resolve(dirname(arg), desc.modelo);
const T = process.env.THREE_DIR, cdn = 'https://cdn.jsdelivr.net/npm/three@0.160.0/';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage(); p.setDefaultTimeout(600000);
p.on('pageerror', e => console.log('ERRO', e.message)); p.on('console', m => console.log(m.text()));
await p.route('http://x/**', r => r.fulfill({ body: readFileSync(modelo), contentType: 'model/gltf-binary' }));
if (T) await p.route(cdn + '**', r => r.fulfill({ body: readFileSync(join(T, new URL(r.request().url()).pathname.replace('/npm/three@0.160.0/', ''))), contentType: 'text/javascript' }));
await p.setContent(`<script type="importmap">{"imports":{"three":"${cdn}build/three.module.js","three/addons/":"${cdn}examples/jsm/"}}</script>
<script type="module">
import * as THREE from 'three'; import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'; import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
window.THREE = THREE;
const u = { s: x => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); } };
u.e = (t, a, b) => u.s((t - a) / (b - a));
u.sin = (t, per, fase = 0) => Math.sin((t / per + fase) * Math.PI * 2);
u.ida = (t, a, b, c, d) => u.e(t, a, b) * (1 - u.e(t, c, d));     // sobe entre a-b, desce entre c-d
window.carregar = async () => { window.gl = await new GLTFLoader().loadAsync('http://x/m.glb'); gl.scene.updateMatrixWorld(true); };
window.ossos = () => { const out = [], v = new THREE.Vector3(), mx = new THREE.AnimationMixer(gl.scene);
  const pc = gl.animations.find(a => a.name === 'parado') || gl.animations[0]; mx.clipAction(pc).play(); mx.setTime(0); gl.scene.updateMatrixWorld(true);
  gl.scene.traverse(o => { if (o.isBone) { o.getWorldPosition(v); out.push([o.name, o.parent?.isBone ? o.parent.name : '-', v.toArray().map(x => +x.toFixed(2))]); } });
  return { ossos: out, anims: gl.animations.map(a => a.name + ' ' + a.duration.toFixed(2)) }; };
window.gerar = async (clipes, matSrc, V = {}) => {
  const sc = gl.scene, fps = 30;
  // nós animados (todos os que aparecem em alguma trilha) + ossos usados nas descrições
  const nodes = new Map();
  const pega = n => { const o = sc.getObjectByName(n); if (!o) throw new Error('osso não encontrado: ' + n); nodes.set(o.name, o); return o; };
  for (const c of gl.animations) for (const t of c.tracks) { const n = t.name.slice(0, t.name.lastIndexOf('.')); const o = sc.getObjectByName(n); if (o) nodes.set(o.name, o); }
  const depth = o => { let d = 0; while (o.parent) { d++; o = o.parent; } return d; };
  const novos = [], rest0 = new Map(); sc.traverse(o => rest0.set(o, [o.position.clone(), o.quaternion.clone(), o.scale.clone()]));
  for (const c of clipes) {
    // pose base lida direto das trilhas (sem AnimationMixer)
    const baseClip = gl.animations.find(a => a.name === c.base); if (!baseClip) throw new Error('base não encontrada: ' + c.base);
    const amostras = baseClip.tracks.map(tr => { const i = tr.name.lastIndexOf('.'), o = sc.getObjectByName(tr.name.slice(0, i));
      const pr = tr.name.slice(i + 1); return o && ['quaternion', 'position', 'scale'].includes(pr) && [o, pr, tr.createInterpolant()]; }).filter(Boolean);
    const f = new Function('V', 'const {' + Object.keys(V).join(',') + '} = V; return (' + c.f + ')')(V);
    const base = gl.animations.find(a => a.name === c.base); if (!base) throw new Error('base não encontrada: ' + c.base);
    const n = Math.round(c.dur * fps) + 1, times = [], Q = new Map(), P = new Map(), Sx = new Map();
    const probe = f(0, c.dur, u); Object.keys(probe).filter(k => k !== '$pos').forEach(pega); Object.keys(probe.$pos || {}).forEach(pega);
    const lista = [...nodes.values()].sort((a, b) => depth(a) - depth(b));
    for (const o of lista) { Q.set(o, []); P.set(o, []); Sx.set(o, []); }
    const rest = new Map(lista.map(o => [o, rest0.get(o)]));
    const q = new THREE.Quaternion(), pq = new THREE.Quaternion(), R = new THREE.Quaternion(), e = new THREE.Euler(), m3 = new THREE.Matrix3(), v = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      const t = i / fps; times.push(t);
      let tb = c.baseT != null ? c.baseT : t * (c.baseVel || 1); tb = c.baseFixo ? Math.min(tb, base.duration - 1e-3) : tb % base.duration;
      for (const [o, [rp, rq, rs]] of rest) { o.position.copy(rp); o.quaternion.copy(rq); o.scale.copy(rs); }
      for (const [o, prop, it] of amostras) { const val = it.evaluate(tb); if (prop === 'quaternion') o.quaternion.fromArray(val).normalize(); else o[prop].fromArray(val); }
      sc.updateMatrixWorld(true);
      const pw = new Map(); for (const o of lista) pw.set(o, o.parent.getWorldQuaternion(new THREE.Quaternion()));
      const pm = new Map(); for (const o of lista) pm.set(o, o.parent.matrixWorld.clone());
      const off = f(t, c.dur, u);
      for (const o of lista) {
        const r = off[o.name];
        if (r) { if (r.length === 4) R.set(r[0], r[1], r[2], r[3]).normalize(); else { e.set(r[0] * Math.PI / 180, r[1] * Math.PI / 180, r[2] * Math.PI / 180, 'YXZ'); R.setFromEuler(e); }
          pq.copy(pw.get(o)); q.copy(pq).invert().multiply(R).multiply(pq).multiply(o.quaternion); o.quaternion.copy(q); }
        const d = off.$pos && off.$pos[o.name];
        if (d) { m3.setFromMatrix4(new THREE.Matrix4().copy(pm.get(o)).invert()); v.fromArray(d).applyMatrix3(m3); o.position.add(v); }
        Q.get(o).push(...o.quaternion.toArray()); P.get(o).push(...o.position.toArray()); Sx.get(o).push(...o.scale.toArray());
      }
    }
    const tracks = [];
    for (const o of lista) {
      tracks.push(new THREE.QuaternionKeyframeTrack(o.name + '.quaternion', times, Q.get(o)));
      tracks.push(new THREE.VectorKeyframeTrack(o.name + '.position', times, P.get(o)));
      tracks.push(new THREE.VectorKeyframeTrack(o.name + '.scale', times, Sx.get(o)));
    }
    novos.push(new THREE.AnimationClip(c.nome, c.dur, tracks).optimize());
  }
  if (matSrc) { const fm = eval('(' + matSrc + ')'); const vis = new Set(); sc.traverse(o => { if (o.isMesh) for (const m of [].concat(o.material)) if (!vis.has(m)) { vis.add(m); fm(THREE, m, o); } }); }
  for (const [o, [rp, rq, rs]] of rest0) { o.position.copy(rp); o.quaternion.copy(rq); o.scale.copy(rs); }
  const nomesNovos = new Set(novos.map(c => c.name));
  const clips = [...gl.animations.filter(c => !nomesNovos.has(c.name)), ...novos];
  const data = await new GLTFExporter().parseAsync(sc.children.length === 1 ? sc.children[0] : sc, { binary: true, animations: clips });
  const a = new Uint8Array(data); let s = ''; for (let i = 0; i < a.length; i += 0x8000) s += String.fromCharCode(...a.subarray(i, i + 0x8000));
  return { b64: btoa(s), anims: clips.map(c => c.name + ' ' + c.duration.toFixed(1)) };
};
window.ready = true;
</script>`, { url: 'http://x/' });
await p.waitForFunction(() => window.ready);
await p.evaluate(() => window.carregar());
if (dump) {
  const r = await p.evaluate(() => window.ossos());
  console.log('animações:', r.anims.join(' | '));
  for (const [n, pai, pos] of r.ossos) console.log(n.padEnd(34), pai.padEnd(34), pos.join(' '));
} else {
  const clipes = desc.clipes.map(c => ({ ...c, f: c.f.toString() }));
  const r = await p.evaluate(([c, m, v]) => window.gerar(c, m, v), [clipes, desc.material ? desc.material.toString() : null, desc.vars || {}]);
  writeFileSync(resolve(dirname(arg), desc.saida || desc.modelo), Buffer.from(r.b64, 'base64'));
  console.log('animações:', r.anims.join(', '));
}
await b.close();
