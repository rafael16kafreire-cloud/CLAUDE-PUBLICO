// Cria um bicho "variante" a partir de outro já pronto: muda tamanho e cor e mantém esqueleto e animações.
// Uso: node variante.mjs config/<variante>.json
//   { "nome": "kentrossauro", "base": "../modelos/estegossauro.glb", "saida": "../modelos/kentrossauro.glb",
//     "escala": 0.45, "cor": [0.8, 0.9, 0.75], "efeito": "gelo" | "musgo" | "abismo" (opcional, para chefes) }
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
// efeitos de pele para chefes: 'gelo', 'musgo', 'abismo' (fendas da textura viram brilho / musgo)
function efeito(m, tipo) {
  if (!m.map || !m.map.image) return;
  const img = m.map.image, w = img.width, h = img.height, mk = () => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const cv = mk(), cx = cv.getContext('2d'); cx.drawImage(img, 0, 0); const d = cx.getImageData(0, 0, w, h), p = d.data;
  const bv = mk(), bx = bv.getContext('2d'); bx.filter = 'blur(' + Math.max(2, Math.round(w / 300)) + 'px)'; bx.drawImage(img, 0, 0); const bp = bx.getImageData(0, 0, w, h).data;
  const ev = mk(), ex = ev.getContext('2d'), e = ex.createImageData(w, h), q = e.data;
  // ruído de manchas (para o musgo)
  const nz = (i) => { const x = (i / 4) % w, y = Math.floor(i / 4 / w); return 0.5 + 0.25 * Math.sin(x * 0.031 + Math.sin(y * 0.017) * 3) + 0.25 * Math.sin(y * 0.027 + Math.sin(x * 0.013) * 4); };
  for (let i = 0; i < p.length; i += 4) {
    const r = p[i], g = p[i + 1], b = p[i + 2], lum = (r + g + b) / 3, bl = (bp[i] + bp[i + 1] + bp[i + 2]) / 3;
    const fenda = Math.min(1, Math.max(0, (bl - lum - 5) / 16));
    if (tipo === 'gelo') {          // pele clara azulada, fendas com brilho ciano
      const L = 90 + lum * 0.7; p[i] = L * 0.82; p[i + 1] = L * 0.92; p[i + 2] = Math.min(255, L * 1.08);
      q[i] = 40 * fenda; q[i + 1] = 200 * fenda; q[i + 2] = 255 * fenda;
    } else if (tipo === 'musgo') {  // escuro com manchas e fendas de musgo verde
      const k = Math.min(1, fenda * 0.8 + Math.max(0, nz(i) - 0.62) * 2.5);
      p[i] = r * 0.55 * (1 - k) + 60 * k; p[i + 1] = g * 0.6 * (1 - k) + 95 * k; p[i + 2] = b * 0.45 * (1 - k) + 30 * k;
      q[i] = 0; q[i + 1] = 0; q[i + 2] = 0;
    } else if (tipo === 'abismo') { // azul-escuro com pontos bioluminescentes
      p[i] = lum * 0.25; p[i + 1] = lum * 0.32; p[i + 2] = lum * 0.5 + 10;
      const k = Math.max(0, Math.min(1, (bl - lum - 22) / 20)) * (nz(i) > 0.6 ? 1 : 0.15); q[i] = 10 * k; q[i + 1] = 220 * k; q[i + 2] = 190 * k;
    }
    q[i + 3] = 255;
  }
  cx.putImageData(d, 0, 0); ex.putImageData(e, 0, 0);
  const tx = c => { const t = new THREE.CanvasTexture(c); t.flipY = m.map.flipY; t.colorSpace = THREE.SRGBColorSpace; t.wrapS = m.map.wrapS; t.wrapT = m.map.wrapT; t.channel = m.map.channel; return t; };
  m.map = tx(cv);
  if (tipo !== 'musgo') { m.emissiveMap = tx(ev); m.emissive = new THREE.Color(1, 1, 1); m.emissiveIntensity = tipo === 'gelo' ? 1.6 : 1.4; }
  if (tipo === 'gelo') { m.roughness = 0.35; m.metalness = 0.05; }
  m.needsUpdate = true;
}
window.variar = async (cfg) => {
  const gl = await new GLTFLoader().loadAsync('http://x/in.glb');
  const root = new THREE.Group(); root.name = cfg.nome; root.add(gl.scene); root.scale.setScalar(cfg.escala || 1);
  const done = new Set();
  gl.scene.traverse(o => { if (o.isMesh) for (const m of [].concat(o.material)) { if (done.has(m)) continue; done.add(m);
    if (cfg.cor) m.color.multiply(new THREE.Color(...cfg.cor));
    if (cfg.efeito) efeito(m, cfg.efeito); } });
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
