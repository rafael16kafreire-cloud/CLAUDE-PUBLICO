// Congela um modelo animado numa pose (como o three.js mostra) e exporta como malha parada, sem esqueleto.
// Útil quando o rig original usa restrições que o Blender não reproduz (ex.: Auto-Rig Pro).
// Uso: node congelar.mjs entrada.glb saida.glb [animação] [tempo]
import { createRequire } from 'node:module'; import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
const { chromium } = createRequire(import.meta.url)('playwright');
const [ent, sai, anim = '', tempo = '0'] = process.argv.slice(2);
const T = process.env.THREE_DIR, cdn = 'https://cdn.jsdelivr.net/npm/three@0.160.0/';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage(); p.setDefaultTimeout(600000); p.on('pageerror', e => console.log('ERRO', e.message));
await p.route('http://x/**', r => r.fulfill({ body: readFileSync(resolve(ent)), contentType: 'model/gltf-binary' }));
if (T) await p.route(cdn + '**', r => r.fulfill({ body: readFileSync(join(T, new URL(r.request().url()).pathname.replace('/npm/three@0.160.0/', ''))), contentType: 'text/javascript' }));
await p.setContent(`<script type="importmap">{"imports":{"three":"${cdn}build/three.module.js","three/addons/":"${cdn}examples/jsm/"}}</script>
<script type="module">
import * as THREE from 'three'; import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'; import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
window.congelar = async (anim, tempo) => {
  const gl = await new GLTFLoader().loadAsync('http://x/m.glb'), sc = gl.scene;
  const c = gl.animations.find(a => a.name === anim) || gl.animations[0];
  if (c) { const mx = new THREE.AnimationMixer(sc); mx.clipAction(c).play(); mx.setTime(tempo); }
  sc.updateMatrixWorld(true);
  const out = new THREE.Group(), v = new THREE.Vector3(); let tris = 0;
  sc.traverse(o => { if (!o.isMesh) return;
    const g = o.geometry.clone(), pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) { o.getVertexPosition(i, v); v.applyMatrix4(o.matrixWorld); pos.setXYZ(i, v.x, v.y, v.z); }
    g.deleteAttribute('skinIndex'); g.deleteAttribute('skinWeight'); g.computeVertexNormals();
    const m = new THREE.Mesh(g, o.material); m.name = o.name; out.add(m); tris += (g.index ? g.index.count : pos.count) / 3; });
  const data = await new GLTFExporter().parseAsync(out, { binary: true });
  const a = new Uint8Array(data); let s = ''; for (let i = 0; i < a.length; i += 0x8000) s += String.fromCharCode(...a.subarray(i, i + 0x8000));
  return { b64: btoa(s), tris, anim: c ? c.name : '-' };
};
window.ready = true;
</script>`, { url: 'http://x/' });
await p.waitForFunction(() => window.ready);
const r = await p.evaluate(([a, t]) => window.congelar(a, t), [anim, +tempo]);
writeFileSync(resolve(sai), Buffer.from(r.b64, 'base64'));
console.log(`congelado: ${r.tris} triângulos, pose de '${r.anim}' em ${tempo}s → ${sai}`);
await b.close();
