// =============================================================
// TRONCOS CAÍDOS (passo 2 de 2): reduz os triângulos (meshoptimizer,
// sem criar vértices novos: a textura continua certa) e grava
// src/world/textures/veg_troncos.js no formato das plantas
// (veg_models.js: altura/comprimento 1, uma parte com textura).
// Uso: node troncos_para_jogo.mjs troncos.json saida.js chave=triângulos ...
// =============================================================
import { readFileSync, writeFileSync } from 'node:fs';
import { MeshoptSimplifier } from 'meshoptimizer';

const [inPath, outPath, ...targets] = process.argv.slice(2);
const raw = JSON.parse(readFileSync(inPath, 'utf8'));
const want = Object.fromEntries(targets.map((t) => t.split('=')).map(([k, v]) => [k, Number(v)]));
await MeshoptSimplifier.ready;
const b64 = (a) => Buffer.from(a.buffer, a.byteOffset, a.byteLength).toString('base64');
const M = {};
const T = {};
for (const [key, d] of Object.entries(raw)) {
  const P = new Float32Array(d.pos.flat());
  const I = new Uint32Array(d.idx.flat());
  const target = Math.min(I.length, (want[key] ?? 3000) * 3);
  let idx = MeshoptSimplifier.simplify(I, P, 3, target, 0.01, [])[0];
  if (idx.length > target * 1.2) idx = MeshoptSimplifier.simplify(I, P, 3, target, 0.05, [])[0];
  // só os vértices usados
  const remap = new Map();
  const used = [];
  for (const v of idx) if (!remap.has(v)) { remap.set(v, used.length); used.push(v); }
  const n = used.length;
  const pos = used.map((v) => d.pos[v]);
  const uv = used.map((v) => d.uv[v].map((t) => t - Math.floor(t))); // textura repetida -> 0..1
  const lo = [0, 1, 2].map((q) => Math.min(...pos.map((p) => p[q])));
  const hi = [0, 1, 2].map((q) => Math.max(...pos.map((p) => p[q])));
  const qp = new Uint16Array(n * 3);
  const qu = new Uint16Array(n * 2);
  pos.forEach((p, k) => p.forEach((v, q) => { qp[k * 3 + q] = Math.round(((v - lo[q]) / (hi[q] - lo[q] || 1)) * 65535); }));
  uv.forEach((u, k) => u.forEach((v, q) => { qu[k * 2 + q] = Math.round(Math.min(1, Math.max(0, v)) * 65535); }));
  M[key] = [{
    n, box: [...lo, ...hi].map((v) => +v.toFixed(5)), uvbox: [0, 0, 1, 1],
    pos: b64(qp), uv: b64(qu), idx: b64(Uint16Array.from(idx, (v) => remap.get(v))), tex: `tronco_${key}`,
  }];
  T[`tronco_${key}`] = d.map;
  if (d.normalMap) T[`tronco_${key}_relevo`] = d.normalMap;
  console.log(key, 'triângulos', I.length / 3, '->', idx.length / 3, 'vértices', n);
}
writeFileSync(outPath, `// Troncos caídos enviados pelo jogador ("Fallen Spruce Tree" e
// "Mossy old tree log"). Gerado por tools/models/troncos_para_jogo.mjs.
export const VEG_TRONCOS = ${JSON.stringify(M)};
export const VEG_TRONCOS_TEX = ${JSON.stringify(T)};
`);
