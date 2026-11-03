// =============================================================
// CONVERSOR DE MODELO (passo 2 de 2): JSON cru -> módulo do jogo
//  - reduz os triângulos (meshoptimizer: não cria vértices novos,
//    então a textura e os pesos continuam certos)
//  - liga os ossos do modelo aos ossos que o jogo anima
//    (quadril, peito, pescoço, cabeça, mandíbula, cauda, pernas,
//    braços) somando os pesos
//  - pinta cores realistas por região (costas, barriga, vela)
//  - grava src/creatures/imported/<id>.js (dados em base64)
//
// Uso: node usd_para_jogo.mjs cru.json textura_base.jpg normal.jpg saida.js
// =============================================================
import { readFileSync, writeFileSync } from 'node:fs';
import { MeshoptSimplifier } from 'meshoptimizer';

const [rawPath, basePath, normalPath, outPath, targetTris = '11000'] = process.argv.slice(2);
const raw = JSON.parse(readFileSync(rawPath, 'utf8'));

// ---------- 1. ossos do jogo a partir dos ossos do modelo ----------
// grupos pelo nome do osso do modelo (espinossauro do Sketchfab)
const R = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => `n${a + i}`);
const GROUPS = {
  hips: ['n7', 'n8'],
  chest: ['n9', 'n10', 'n11'],
  neck: ['n12', 'n13'],
  head: ['n14', 'n15', ...R(20, 31)],
  jaw: ['n16', 'n17', 'n18', 'n19'],
  tail1: ['n77'],
  tail2: ['n78', 'n79'],
  tail3: ['n80', 'n81'],
  // lado A e lado B (o script descobre qual é esquerdo)
  'bracoA': ['n33', 'n34'], 'bracoA_joelho': ['n35', 'n53'], 'bracoA_pe': R(36, 52),
  'bracoB': ['n55', 'n56'], 'bracoB_joelho': ['n57', 'n75'], 'bracoB_pe': R(58, 74),
  'pernaA': ['n83', 'n102'], 'pernaA_joelho': ['n84'], 'pernaA_pe': R(85, 101),
  'pernaB': ['n104', 'n123'], 'pernaB_joelho': ['n105'], 'pernaB_pe': R(106, 122),
};
// ponto de giro de cada osso do jogo = posição deste osso do modelo
const PIVOT = {
  hips: 'n7', chest: 'n9', neck: 'n12', head: 'n14', jaw: 'n16',
  tail1: 'n77', tail2: 'n78', tail3: 'n80',
  bracoA: 'n34', bracoA_joelho: 'n35', bracoA_pe: 'n36',
  bracoB: 'n56', bracoB_joelho: 'n57', bracoB_pe: 'n58',
  pernaA: 'n83', pernaA_joelho: 'n84', pernaA_pe: 'n85',
  pernaB: 'n104', pernaB_joelho: 'n105', pernaB_pe: 'n106',
};
const jIndex = new Map(raw.joints.map((n, i) => [n, i]));
const jp = (name) => raw.jointPos[jIndex.get(name)];
// lado esquerdo ("E") = x positivo, como nos modelos do jogo
const sideOf = (g) => (jp(PIVOT[`${g}A`])[0] > 0 ? { A: 'E', B: 'D' } : { A: 'D', B: 'E' });
const armSide = sideOf('braco');
const legSide = sideOf('perna');
const rename = (k) => k.replace(/^braco([AB])/, (_, s) => `braco${armSide[s]}`).replace(/^perna([AB])/, (_, s) => `perna${legSide[s]}`);
const PARENT = {
  hips: null, chest: 'hips', neck: 'chest', head: 'neck', jaw: 'head',
  tail1: 'hips', tail2: 'tail1', tail3: 'tail2',
};
const bones = [];
for (const k of Object.keys(GROUPS)) {
  const name = rename(k);
  let parent = PARENT[k];
  if (parent === undefined) {
    const base = name.replace(/_(joelho|pe)$/, '');
    parent = name.endsWith('_joelho') ? base : name.endsWith('_pe') ? `${base}_joelho` : base.startsWith('braco') ? 'chest' : 'hips';
  }
  bones.push({ name, parent, pos: jp(PIVOT[k]).map((v) => +v.toFixed(4)) });
}
// pais antes dos filhos
bones.sort((a, b) => depth(a) - depth(b));
function depth(b) { let d = 0; let p = b.parent; while (p) { d++; p = bones.find((x) => x.name === p)?.parent; } return d; }
const boneIdx = new Map(bones.map((b, i) => [b.name, i]));
const jointToBone = new Array(raw.joints.length).fill(0);
for (const [k, list] of Object.entries(GROUPS)) for (const j of list) if (jIndex.has(j)) jointToBone[jIndex.get(j)] = boneIdx.get(rename(k));
const unmapped = raw.joints.filter((j) => !Object.values(GROUPS).flat().includes(j));
if (unmapped.length) console.log('ossos sem grupo (vão para o quadril):', unmapped.join(','));

// ---------- 2. reduzir triângulos ----------
await MeshoptSimplifier.ready;
const P = new Float32Array(raw.positions.flat());
const I = new Uint32Array(raw.indices);
const target = Math.floor(Number(targetTris) * 3 / 3) * 3;
const [simp, err] = MeshoptSimplifier.simplify(I, P, 3, target, 0.05, ['LockBorder']);
let idx = simp;
if (idx.length > target * 1.15) idx = MeshoptSimplifier.simplify(I, P, 3, target, 0.08, [])[0];
console.log('triângulos', I.length / 3, '->', idx.length / 3, 'erro', err.toFixed(4));
// só os vértices usados
const remap = new Map();
const used = [];
for (const v of idx) if (!remap.has(v)) { remap.set(v, used.length); used.push(v); }
const n = used.length;
const index = (n < 65536 ? Uint16Array : Uint32Array).from(idx, (v) => remap.get(v));

// ---------- 3. pesos dos ossos (4 por vértice) ----------
const skinI = new Uint8Array(n * 4);
const skinW = new Uint8Array(n * 4);
for (let k = 0; k < n; k++) {
  const v = used[k];
  const acc = new Map();
  raw.jointIndices[v].forEach((j, q) => {
    const w = raw.jointWeights[v][q];
    if (w <= 0) return;
    const b = jointToBone[j];
    acc.set(b, (acc.get(b) ?? 0) + w);
  });
  const top = [...acc.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  const sum = top.reduce((a, [, w]) => a + w, 0) || 1;
  let left = 255;
  top.forEach(([b, w], q) => {
    const wb = q === top.length - 1 ? left : Math.round((w / sum) * 255);
    skinI[k * 4 + q] = b;
    skinW[k * 4 + q] = wb;
    left -= wb;
  });
  if (!top.length) { skinI[k * 4] = 0; skinW[k * 4] = 255; }
}

// ---------- 4. posição, uv, normais ----------
const pos = new Float32Array(n * 3);
const uv = new Float32Array(n * 2);
for (let k = 0; k < n; k++) {
  const v = used[k];
  pos.set(raw.positions[v], k * 3);
  // a textura se repete (wrap "repeat"): leva u e v para 0..1
  const fr = (x) => x - Math.floor(x);
  uv[k * 2] = fr(raw.uv[v][0]);
  uv[k * 2 + 1] = fr(raw.uv[v][1]);
}
const nor = new Float32Array(n * 3);
for (let t = 0; t < index.length; t += 3) {
  const [a, b, c] = [index[t], index[t + 1], index[t + 2]];
  const ax = pos[a * 3], ay = pos[a * 3 + 1], az = pos[a * 3 + 2];
  const e1 = [pos[b * 3] - ax, pos[b * 3 + 1] - ay, pos[b * 3 + 2] - az];
  const e2 = [pos[c * 3] - ax, pos[c * 3 + 1] - ay, pos[c * 3 + 2] - az];
  const fn = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
  for (const v of [a, b, c]) for (let q = 0; q < 3; q++) nor[v * 3 + q] += fn[q];
}
for (let k = 0; k < n; k++) {
  const l = Math.hypot(nor[k * 3], nor[k * 3 + 1], nor[k * 3 + 2]) || 1;
  for (let q = 0; q < 3; q++) nor[k * 3 + q] /= l;
}

// ---------- 5. cores realistas por região ----------
// costas cinza-esverdeado escuro, flancos mais claros, barriga
// creme, vela avermelhada com faixas escuras, focinho mais escuro
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const mix = (a, b, t) => a.map((x, i) => x + (b[i] - x) * t);
const BACK = hex('#3e4a46'), FLANK = hex('#66705f'), BELLY = hex('#cdbf98');
const SAIL = hex('#b0553a'), SAIL_DARK = hex('#5a2416'), SNOUT = hex('#4a4a40');
const hipsY = jp('n7')[1];
const sailBase = hipsY + 0.95;
const headZ = jp('n14')[2];
const noise = (x, y, z) => {
  const s = Math.sin(x * 3.1 + y * 1.7) * Math.sin(z * 2.3 - y * 1.1) + Math.sin(x * 7.3 - z * 5.1 + y * 4.2) * 0.4;
  return 0.5 + 0.35 * s;
};
const col = new Uint8Array(n * 3);
for (let k = 0; k < n; k++) {
  const x = pos[k * 3], y = pos[k * 3 + 1], z = pos[k * 3 + 2];
  const ny = nor[k * 3 + 1];
  let c;
  const inSail = y > sailBase && Math.abs(x) < 0.35 && z > headZ + 2.0;
  if (inSail) {
    const h = Math.min(1, (y - sailBase) / 2.2);
    c = mix(BACK, SAIL, Math.min(1, h * 1.6));
    const band = Math.sin(z * 2.8 + y * 0.6) > 0.55 ? 0.55 : 0;
    c = mix(c, SAIL_DARK, band * h);
  } else {
    const up = Math.max(-1, Math.min(1, ny));
    c = up > 0 ? mix(FLANK, BACK, Math.min(1, up * 1.4)) : mix(FLANK, BELLY, Math.min(1, -up * 1.6));
    // manchas escuras nas costas e flancos
    const m = noise(x, y, z);
    if (up > -0.2 && m > 0.72) c = mix(c, BACK.map((v) => v * 0.6), 0.5);
    if (z < headZ - 0.5) c = mix(c, SNOUT, 0.35);
  }
  for (let q = 0; q < 3; q++) col[k * 3 + q] = Math.round(Math.min(1, c[q]) * 255);
}

// ---------- 6. compactar (menos bytes no celular) ----------
// posição: inteiros de 16 bits dentro da caixa do modelo;
// normal: 8 bits; uv: 16 bits
const bmin = [Infinity, Infinity, Infinity];
const bmax = [-Infinity, -Infinity, -Infinity];
for (let k = 0; k < n; k++) for (let q = 0; q < 3; q++) {
  bmin[q] = Math.min(bmin[q], pos[k * 3 + q]);
  bmax[q] = Math.max(bmax[q], pos[k * 3 + q]);
}
const qpos = new Uint16Array(n * 3);
for (let k = 0; k < n; k++) for (let q = 0; q < 3; q++) {
  qpos[k * 3 + q] = Math.round(((pos[k * 3 + q] - bmin[q]) / (bmax[q] - bmin[q])) * 65535);
}
const qnor = new Int8Array(n * 3);
for (let k = 0; k < n * 3; k++) qnor[k] = Math.round(nor[k] * 127);
const quv = new Uint16Array(n * 2);
for (let k = 0; k < n * 2; k++) quv[k] = Math.round(Math.min(1, Math.max(0, uv[k])) * 65535);

// ---------- 7. gravar ----------
const b64 = (arr) => Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength).toString('base64');
const jpg = (p) => `data:image/jpeg;base64,${readFileSync(p).toString('base64')}`;
const info = raw.info ?? {};
const out = `// =============================================================
// MODELO IMPORTADO: ${info.title ?? 'modelo'} (gerado por tools/models/usd_para_jogo.mjs)
// Autor: ${info.author ?? '?'}
// Licença: ${info.copyright ?? '?'}
// Original: ${info.url ?? '?'}
// Mudanças: menos triângulos, esqueleto ligado aos ossos do jogo,
// cores pintadas por região. NÃO edite à mão: rode o conversor.
// =============================================================
export default {
  credito: ${JSON.stringify({ titulo: info.title, autor: info.author, licenca: info.copyright, url: info.url })},
  vertices: ${n},
  bones: ${JSON.stringify(bones)},
  box: ${JSON.stringify([bmin.map((v) => +v.toFixed(5)), bmax.map((v) => +v.toFixed(5))])},
  position: '${b64(qpos)}',
  normal: '${b64(qnor)}',
  uv: '${b64(quv)}',
  color: '${b64(col)}',
  skinIndex: '${b64(skinI)}',
  skinWeight: '${b64(skinW)}',
  index: '${b64(index)}',
  index32: ${index instanceof Uint32Array},
  map: '${jpg(basePath)}',
  normalMap: '${jpg(normalPath)}',
};
`;
writeFileSync(outPath, out);
console.log('vértices', n, 'ossos', bones.length, 'arquivo', (out.length / 1024).toFixed(0), 'KB');
console.log('lados: braço A =', armSide.A, ', perna A =', legSide.A);
