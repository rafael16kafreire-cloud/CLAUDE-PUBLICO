// Cria um bicho "variante" a partir de outro já pronto: muda tamanho e cor e mantém esqueleto e animações.
// Uso: node variante.mjs config/<variante>.json
//   { "nome": "kentrossauro", "base": "../modelos/estegossauro.glb", "saida": "../modelos/kentrossauro.glb",
//     "escala": 0.45, "cor": [0.8, 0.9, 0.75] }
import { createRequire } from 'node:module'; import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
const { chromium } = createRequire(import.meta.url)('playwright');
const cfgPath = resolve(process.argv[2]), cfg = JSON.parse(readFileSync(cfgPath, 'utf8')), base = dirname(cfgPath);
const T = process.env.THREE_DIR, cdn = 'https://cdn.jsdelivr.net/npm/three@0.160.0/';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage(); p.setDefaultTimeout(600000);
p.on('pageerror', e => console.log('ERRO', e.message));
await p.route('http://x/**', r => r.fulfill({ body: readFileSync(resolve(base, cfg.base)), contentType: 'model/gltf-binary' }));
if (T) await p.route(cdn + '**', r => r.fulfill({ body: readFileSync(join(T, new URL(r.request().url()).pathname.replace('/npm/three@0.160.0/', ''))), contentType: 'text/javascript' }));
await p.setContent(`<script type="importmap">{"imports":{"three":"${cdn}build/three.module.js","three/addons/":"${cdn}examples/jsm/"}}</script>
<script type="module">
import * as THREE from 'three'; import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'; import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
window.variar = async (cfg) => {
  const gl = await new GLTFLoader().loadAsync('http://x/in.glb');
  const root = new THREE.Group(); root.name = cfg.nome; root.add(gl.scene); root.scale.setScalar(cfg.escala || 1);
  const done = new Set();
  gl.scene.traverse(o => { if (o.isMesh) for (const m of [].concat(o.material)) { if (done.has(m)) continue; done.add(m);
    if (cfg.cor) m.color.multiply(new THREE.Color(...cfg.cor)); } });
  let clips = gl.animations;
  if (cfg.renomear) clips = clips.map(c => { const k = c.clone(); k.name = cfg.renomear[c.name] || c.name; return k; });
  const data = await new GLTFExporter().parseAsync(root, { binary: true, animations: clips });
  const u = new Uint8Array(data); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  root.updateMatrixWorld(true); const bb = new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3());
  return { b64: btoa(s), anims: clips.map(c => c.name), tam: [bb.x, bb.y, bb.z].map(v => +v.toFixed(1)) };
};
window.ready = true;
</script>`, { url: 'http://x/' });
await p.waitForFunction(() => window.ready);
const r = await p.evaluate(c => window.variar(c), cfg);
writeFileSync(resolve(base, cfg.saida), Buffer.from(r.b64, 'base64'));
console.log(`${cfg.nome}: base ${cfg.base}, ~${r.tam.join(' x ')} m, animações: ${r.anims.join(', ')}`);
await b.close();
