// Monta um esqueleto (posições dadas no arquivo de config) num modelo parado e exporta com pele e um clipe 'repouso'.
// Feito para aves (asas abertas), mas serve para qualquer bicho. As animações vêm depois com completar.mjs.
// Uso: node ave.mjs config/argentavis.json [--medir]
//   config: { nome, entrada, saida, rot:[x,y,z] graus (cabeça → +Z), envergadura (m, largura em X),
//             ossos: [[nome, pai, [x,y,z] início, [x,y,z] fim], ...]  (metros, já no tamanho final, pés em y=0) }
//   --medir: só normaliza e imprime fatias (para posicionar os ossos)
import { createRequire } from 'node:module'; import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
const { chromium } = createRequire(import.meta.url)('playwright');
const cfgPath = resolve(process.argv[2]), cfg = JSON.parse(readFileSync(cfgPath, 'utf8')), base = dirname(cfgPath), medir = process.argv.includes('--medir');
const T = process.env.THREE_DIR, cdn = 'https://cdn.jsdelivr.net/npm/three@0.160.0/';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage(); p.setDefaultTimeout(600000); p.on('pageerror', e => console.log('ERRO', e.message)); p.on('console', m => console.log(m.text()));
await p.route('http://x/**', r => r.fulfill({ body: readFileSync(resolve(base, cfg.entrada)), contentType: 'model/gltf-binary' }));
if (T) await p.route(cdn + '**', r => r.fulfill({ body: readFileSync(join(T, new URL(r.request().url()).pathname.replace('/npm/three@0.160.0/', ''))), contentType: 'text/javascript' }));
await p.setContent(`<script type="importmap">{"imports":{"three":"${cdn}build/three.module.js","three/addons/":"${cdn}examples/jsm/"}}</script>
<script type="module">
import * as THREE from 'three'; import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'; import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
function distSeg(p, a, b) { const ab = b.clone().sub(a), t = Math.max(0, Math.min(1, p.clone().sub(a).dot(ab) / ab.lengthSq())); return p.distanceTo(a.clone().addScaledVector(ab, t)); }
window.montar = async (cfg, medir) => {
  const gl = await new GLTFLoader().loadAsync('http://x/m.glb'); gl.scene.updateMatrixWorld(true);
  const R = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...(cfg.rot || [0, 0, 0]).map(d => d * Math.PI / 180), 'XYZ'));
  const parts = [];
  gl.scene.traverse(o => { if (o.isMesh) { const g = o.geometry.clone(); g.applyMatrix4(o.matrixWorld); g.applyMatrix4(R); parts.push({ g, mat: o.material }); } });
  const bb = new THREE.Box3(); parts.forEach(q => { q.g.computeBoundingBox(); bb.union(q.g.boundingBox); });
  const s = cfg.envergadura / (bb.max.x - bb.min.x);
  const M = new THREE.Matrix4().makeScale(s, s, s).premultiply(new THREE.Matrix4().makeTranslation(-(bb.min.x + bb.max.x) / 2 * s, -bb.min.y * s, -(bb.min.z + bb.max.z) / 2 * s));
  parts.forEach(q => q.g.applyMatrix4(M));
  const pts = []; parts.forEach(q => { const a = q.g.attributes.position; for (let i = 0; i < a.count; i += 3) pts.push([a.getX(i), a.getY(i), a.getZ(i)]); });
  if (medir) {
    const B = new THREE.Box3(); parts.forEach(q => { q.g.computeBoundingBox(); B.union(q.g.boundingBox); });
    const out = ['caixa: ' + B.min.toArray().map(v => v.toFixed(2)) + ' / ' + B.max.toArray().map(v => v.toFixed(2))];
    // fatias em X (asas) e, no corpo (|x| pequeno), fatias em Z
    for (let i = 0; i < 16; i++) { const x0 = B.min.x + (B.max.x - B.min.x) * i / 16, x1 = x0 + (B.max.x - B.min.x) / 16; const sl = pts.filter(q => q[0] >= x0 && q[0] < x1);
      if (sl.length) out.push('x ' + x0.toFixed(2) + ': y ' + Math.min(...sl.map(q => q[1])).toFixed(2) + '..' + Math.max(...sl.map(q => q[1])).toFixed(2) + ' z ' + Math.min(...sl.map(q => q[2])).toFixed(2) + '..' + Math.max(...sl.map(q => q[2])).toFixed(2) + ' n=' + sl.length); }
    const corpo = pts.filter(q => Math.abs(q[0]) < (cfg.meioCorpo || 0.3));
    for (let i = 0; i < 14; i++) { const z0 = B.min.z + (B.max.z - B.min.z) * i / 14, z1 = z0 + (B.max.z - B.min.z) / 14; const sl = corpo.filter(q => q[2] >= z0 && q[2] < z1);
      if (sl.length) out.push('corpo z ' + z0.toFixed(2) + ': y ' + Math.min(...sl.map(q => q[1])).toFixed(2) + '..' + Math.max(...sl.map(q => q[1])).toFixed(2) + ' x ' + Math.min(...sl.map(q => q[0])).toFixed(2) + '..' + Math.max(...sl.map(q => q[0])).toFixed(2) + ' n=' + sl.length); }
    return { linhas: out };
  }
  // esqueleto
  const bones = {}, list = [], segs = [];
  for (const [n, pai, h, t] of cfg.ossos) {
    const bo = new THREE.Bone(); bo.name = n; const H = new THREE.Vector3(...h);
    const P = pai ? new THREE.Vector3(...cfg.ossos.find(o => o[0] === pai)[2]) : new THREE.Vector3();
    bo.position.copy(H.clone().sub(P)); if (pai) bones[pai].add(bo);
    bones[n] = bo; list.push(bo);
    segs.push({ n, i: list.length - 1, a: H, b: new THREE.Vector3(...t), lado: /_E$/.test(n) ? 1 : /_D$/.test(n) ? -1 : 0, grupo: (cfg.grupos || {})[n] });
  }
  const raiz = list[0], grupo = new THREE.Group(); grupo.name = cfg.nome; grupo.add(raiz); grupo.updateMatrixWorld(true);
  const sk = new THREE.Skeleton(list);
  const W = cfg.envergadura, meio = cfg.meioCorpo || 0.05 * W;
  let tris = 0;
  for (const q of parts) {
    const g = q.g, a = g.attributes.position, n = a.count, SI = new Uint16Array(n * 4), SW = new Float32Array(n * 4), v = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      v.set(a.getX(i), a.getY(i), a.getZ(i));
      const c = [];
      for (const sg of segs) {
        if (sg.lado && Math.sign(v.x) !== sg.lado && Math.abs(v.x) > meio) continue;   // lado errado
        // regiões: 'asa' só pega vértices fora do corpo; ossos do corpo não pegam a asa longe
        if (sg.grupo === 'asa' && Math.abs(v.x) < meio * 0.8) continue;
        if (!sg.grupo && Math.abs(v.x) > meio * 1.6 && !sg.lado) continue;
        c.push([sg.i, distSeg(v, sg.a, sg.b)]);
      }
      if (!c.length) c.push([0, 1]);
      c.sort((u, w) => u[1] - w[1]);
      const top = c.slice(0, 3), ws = top.map(t => 1 / Math.pow(t[1] + 0.01 * W, 4)), sum = ws.reduce((u, w) => u + w, 0);
      top.forEach((t, j) => { SI[i * 4 + j] = t[0]; SW[i * 4 + j] = ws[j] / sum; });
    }
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(SI, 4)); g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(SW, 4));
    const m = new THREE.SkinnedMesh(g, q.mat); m.bind(sk); grupo.add(m); tris += (g.index ? g.index.count : n) / 3;
  }
  // clipe 'repouso' com todos os ossos (o completar.mjs anima por cima dele)
  const tracks = list.flatMap(bo => [new THREE.QuaternionKeyframeTrack(bo.name + '.quaternion', [0, 1], [...bo.quaternion.toArray(), ...bo.quaternion.toArray()]),
    new THREE.VectorKeyframeTrack(bo.name + '.position', [0, 1], [...bo.position.toArray(), ...bo.position.toArray()])]);
  const clip = new THREE.AnimationClip('repouso', 1, tracks);
  const data = await new GLTFExporter().parseAsync(grupo, { binary: true, animations: [clip] });
  const u = new Uint8Array(data); let str = ''; for (let i = 0; i < u.length; i += 0x8000) str += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return { b64: btoa(str), tris, ossos: list.length };
};
window.ready = true;
</script>`, { url: 'http://x/' });
await p.waitForFunction(() => window.ready);
const r = await p.evaluate(([c, m]) => window.montar(c, m), [cfg, medir]);
if (medir) console.log(r.linhas.join('\n'));
else { writeFileSync(resolve(base, cfg.saida), Buffer.from(r.b64, 'base64')); console.log(`${cfg.nome}: ${r.tris} triângulos, ${r.ossos} ossos`); }
await b.close();
