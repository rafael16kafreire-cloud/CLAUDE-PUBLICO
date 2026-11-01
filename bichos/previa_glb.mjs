// Tira fotos das animações de um .glb pronto: node previa_glb.mjs modelos/raptor.glb [anim1,anim2,...]
import { createRequire } from 'node:module'; import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname, basename, resolve } from 'node:path'; import { fileURLToPath } from 'node:url'; import { execFileSync } from 'node:child_process';
const { chromium } = createRequire(import.meta.url)('playwright');
const here = dirname(fileURLToPath(import.meta.url)), file = resolve(process.argv[2]), nome = basename(file, '.glb');
const T = process.env.THREE_DIR;
mkdirSync(join(here, 'previas'), { recursive: true });
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 800, height: 500 } }); p.setDefaultTimeout(600000);
p.on('pageerror', e => console.log('ERRO', e.message));
await p.route('http://x/**', r => { const u = new URL(r.request().url()).pathname;
  if (u === '/modelo.glb') return r.fulfill({ body: readFileSync(file), contentType: 'model/gltf-binary' });
  r.fulfill({ status: 404 }); });
const cdn = 'https://cdn.jsdelivr.net/npm/three@0.160.0/';
if (T) await p.route(cdn + '**', r => r.fulfill({ body: readFileSync(join(T, new URL(r.request().url()).pathname.replace('/npm/three@0.160.0/', ''))), contentType: 'text/javascript' }));
await p.setContent(`<html><body style="margin:0"><script type="importmap">{"imports":{"three":"${cdn}build/three.module.js","three/addons/":"${cdn}examples/jsm/"}}</script>
<script type="module">
import * as THREE from 'three'; import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
const r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); r.setSize(800, 500); document.body.appendChild(r.domElement);
r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.shadowMap.enabled = true;
const sc = new THREE.Scene(); sc.background = new THREE.Color('#c4dbe0'); sc.fog = new THREE.Fog(0xc4dbe0, 30, 120);
sc.add(new THREE.HemisphereLight(0xcfe4ff, 0x4d5a2c, 1.3)); const d = new THREE.DirectionalLight(0xffe0b0, 2.4); d.castShadow = true; d.shadow.mapSize.set(2048, 2048); sc.add(d); sc.add(d.target);
const g = new THREE.Mesh(new THREE.CircleGeometry(200, 48), new THREE.MeshStandardMaterial({ color: 0x4f7a34, roughness: 1 })); g.rotation.x = -Math.PI / 2; g.receiveShadow = true; sc.add(g);
const cam = new THREE.PerspectiveCamera(40, 1.6, 0.05, 500);
const gl = await new GLTFLoader().loadAsync('http://x/modelo.glb'); sc.add(gl.scene);
gl.scene.traverse(o => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
const mx = new THREE.AnimationMixer(gl.scene);
window.anims = gl.animations.map(a => [a.name, a.duration]);
window.pose = (name, t) => { mx.stopAllAction(); const c = gl.animations.find(a => a.name === name); if (c) { mx.clipAction(c).play(); mx.setTime(t); }
  gl.scene.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(gl.scene), s = box.getSize(new THREE.Vector3()), ctr = box.getCenter(new THREE.Vector3()); let R = Math.max(s.x, s.y, s.z);
  if (window.ALVO) { const o = gl.scene.getObjectByName(window.ALVO[0]); o.getWorldPosition(ctr); box.setFromCenterAndSize(ctr, new THREE.Vector3(1, 1, 1).multiplyScalar(window.ALVO[1])); s.setScalar(window.ALVO[1]); R = window.ALVO[1]; }
  cam.position.copy(ctr).add(new THREE.Vector3(1, 0.45, 0.8).normalize().multiplyScalar(R * 1.55)); cam.lookAt(ctr); window.dbg = [ctr.toArray().map(x=>+x.toFixed(1)), R.toFixed(1)];
  d.position.copy(ctr).add(new THREE.Vector3(R, R * 1.6, R * 0.8)); d.target.position.copy(ctr);
  Object.assign(d.shadow.camera, { left: -R, right: R, top: R, bottom: -R, far: R * 6 }); d.shadow.camera.updateProjectionMatrix();
  r.render(sc, cam); };
window.ready = true;
</script></body></html>`, { url: 'http://x/' });
await p.waitForFunction(() => window.ready);
// ALVO=osso,tamanho: câmera de perto num osso (ex.: cabeça)
if (process.env.ALVO) await p.evaluate(a => { window.ALVO = [a[0], +a[1]]; }, process.env.ALVO.split(','));
let anims = await p.evaluate(() => window.anims);
if (!anims.length) anims = [['estatico', 0]];   // modelo sem animação: uma foto parada
const want = process.argv[3] ? process.argv[3].split(',') : anims.map(a => a[0]);
for (const [a, dur] of anims.filter(x => want.includes(x[0]))) {
  const t = { parado: 0.3, andar: 0.3, correr: 0.2, morrer: dur * 0.97, dormir: dur * 0.5, voar: 1.5, planar: 2 }[a] ?? dur * 0.45;
  const nq = +(process.env.QUADROS || 0);      // QUADROS=n: n quadros da animação numa folha só (pasta OUT)
  if (nq) { const out = process.env.OUT || join(here, 'previas'), fs = [];
    for (let i = 0; i < nq; i++) { await p.evaluate(([a, t]) => window.pose(a, t), [a, dur * i / (nq - 1) * 0.999]);
      const f = join(out, `${nome}_${a}_${i}.jpg`); fs.push(f); await p.screenshot({ path: f, type: 'jpeg', quality: 80 }); }
    execFileSync('montage', [...fs, '-tile', `${nq}x1`, '-geometry', '400x250+2+2', join(out, `${nome}_${a}_seq.jpg`)]); continue; }
  await p.evaluate(([a, t]) => window.pose(a, t), [a, Math.min(t, dur)]);
  await p.screenshot({ path: join(here, 'previas', `${nome}_${a}.jpg`), type: 'jpeg', quality: 85 });
}
console.log(nome, 'animações:', anims.map(a => `${a[0]} (${a[1].toFixed(1)}s)`).join(', '));
await b.close();
