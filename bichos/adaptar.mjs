// Adapta um modelo que JÁ TEM esqueleto e animações (ex.: Sketchfab CC-BY):
// renomeia as animações para os nomes do prompt, descarta as outras, tira objetos extras,
// coloca no tamanho real, olhando para a frente (+Z no glTF = −Y no Blender) e com os pés no chão.
// Uso: node adaptar.mjs config/<bicho>.json
//   precisa do "playwright" e do "@gltf-transform/cli" (converte materiais antigos; caminho em GLTF_TRANSFORM)
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, existsSync, mkdtempSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path'; import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
const { chromium } = createRequire(import.meta.url)('playwright');
const cfgPath = resolve(process.argv[2]), cfg = JSON.parse(readFileSync(cfgPath, 'utf8')), base = dirname(cfgPath);
let entrada = resolve(base, cfg.entrada);
// material antigo (specular/glossiness) → padrão atual
const glb = readFileSync(entrada), jl = glb.readUInt32LE(12), json = glb.subarray(20, 20 + jl).toString();
if (json.includes('KHR_materials_pbrSpecularGlossiness')) {
  const tmp = join(mkdtempSync(join(tmpdir(), 'adapt-')), 'mr.glb');
  execFileSync(process.env.GLTF_TRANSFORM || 'gltf-transform', ['metalrough', entrada, tmp], { stdio: 'inherit' });
  entrada = tmp;
}
const T = process.env.THREE_DIR, cdn = 'https://cdn.jsdelivr.net/npm/three@0.160.0/';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage(); p.setDefaultTimeout(600000);
p.on('pageerror', e => console.log('ERRO', e.message));
await p.route('http://x/**', r => new URL(r.request().url()).pathname === '/in.glb' ? r.fulfill({ body: readFileSync(entrada), contentType: 'model/gltf-binary' }) : r.fulfill({ status: 404 }));
if (T) await p.route(cdn + '**', r => r.fulfill({ body: readFileSync(join(T, new URL(r.request().url()).pathname.replace('/npm/three@0.160.0/', ''))), contentType: 'text/javascript' }));
await p.setContent(`<script type="importmap">{"imports":{"three":"${cdn}build/three.module.js","three/addons/":"${cdn}examples/jsm/"}}</script>
<script type="module">
import * as THREE from 'three'; import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'; import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
window.adaptar = async (cfg) => {
  const gl = await new GLTFLoader().loadAsync('http://x/in.glb');
  for (const n of cfg.remover || []) { const o = gl.scene.getObjectByName(n); if (o) o.parent.remove(o); }
  const clips = [], falta = [];
  // "novo": "velho"  ou  "novo": { "de": "velho", "velocidade": 0.6 }  (versão mais lenta/rápida)
  for (const [novo, def] of Object.entries(cfg.animacoes)) {
    const velho = typeof def === 'string' ? def : def.de, vel = typeof def === 'string' ? 1 : (def.velocidade || 1);
    const c = gl.animations.find(a => a.name === velho);
    if (!c) { falta.push(velho); continue; }
    const k = c.clone(); k.name = novo;
    if (vel !== 1) { k.tracks.forEach(t => { t.times = t.times.map(x => x / vel); }); k.duration /= vel; }
    clips.push(k);
  }
  // mede na pose 'parado' (alguns modelos têm a pose de descanso torta)
  const mx = new THREE.AnimationMixer(gl.scene), pc = clips.find(c => c.name === 'parado');
  if (pc) { mx.clipAction(pc).play(); mx.setTime(0); }
  gl.scene.updateMatrixWorld(true);
  const pts = [], v = new THREE.Vector3();
  gl.scene.traverse(o => { if (o.isMesh) { const n = o.geometry.attributes.position.count, step = Math.max(1, Math.floor(n / 4000));
    for (let i = 0; i < n; i += step) { o.getVertexPosition(i, v); pts.push(v.clone().applyMatrix4(o.matrixWorld)); } } });
  const sn = THREE.PropertyBinding.sanitizeNodeName;
  const hw = gl.scene.getObjectByName(sn(cfg.osso_cabeca)).getWorldPosition(new THREE.Vector3());
  const tw = gl.scene.getObjectByName(sn(cfg.osso_cauda)).getWorldPosition(new THREE.Vector3());
  const yaw = Math.atan2(hw.x - tw.x, hw.z - tw.z);              // gira em Y para a cabeça ir para +Z
  const root = new THREE.Group(); root.name = cfg.nome; root.add(gl.scene);
  const R = new THREE.Matrix4().makeRotationY(-yaw);
  const rp = pts.map(q => q.clone().applyMatrix4(R)), bb = new THREE.Box3().setFromPoints(rp);
  const s = cfg.comprimento / (bb.max.z - bb.min.z);
  root.rotation.y = -yaw; root.scale.setScalar(s);
  root.position.set(-(bb.min.x + bb.max.x) / 2 * s, -bb.min.y * s, -(bb.min.z + bb.max.z) / 2 * s);
  mx.stopAllAction(); mx.uncacheRoot(gl.scene);
  let tris = 0; gl.scene.traverse(o => { if (o.isMesh) tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; });
  const data = await new GLTFExporter().parseAsync(root, { binary: true, animations: clips });
  const u = new Uint8Array(data); let str = ''; for (let i = 0; i < u.length; i += 0x8000) str += String.fromCharCode(...u.subarray(i, i + 0x8000));
  const sz = bb.getSize(new THREE.Vector3()).multiplyScalar(s);
  return { b64: btoa(str), falta, tris, anims: clips.map(c => c.name), tamanho: [sz.x, sz.y, sz.z].map(x => +x.toFixed(2)) };
};
window.ready = true;
</script>`, { url: 'http://x/' });
await p.waitForFunction(() => window.ready);
const r = await p.evaluate(c => window.adaptar(c), cfg);
writeFileSync(resolve(base, cfg.saida), Buffer.from(r.b64, 'base64'));
console.log(`${cfg.nome}: ${r.tris} triângulos, ${r.tamanho.join(' x ')} m (largura x altura x comprimento), animações: ${r.anims.join(', ')}`);
if (r.falta.length) console.log('  não encontradas:', r.falta.join(', '));
await b.close();
