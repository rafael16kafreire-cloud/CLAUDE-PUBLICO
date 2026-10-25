// =============================================================
// CONVERSOR DE BICHO (passo 3 de 3): JSON com ossos -> módulo do jogo
//  - reduz os triângulos de cada material (meshoptimizer: não cria
//    vértices novos, então textura e pesos continuam certos)
//  - guarda posição/normal/uv compactos, 4 ossos por vértice e as
//    texturas (já reduzidas pelo bichos.sh) em base64
//
// Uso: node bicho_para_jogo.mjs rig.json texturas.json saida.js [triângulos]
//   texturas.json = [{ map: 'cor.jpg', normalMap: 'relevo.jpg'|null, alpha: bool }, ...]
//   (um item por material do rig.json)
// =============================================================
import { readFileSync, writeFileSync } from 'node:fs';
import { MeshoptSimplifier } from 'meshoptimizer';

const [rigPath, texPath, outPath, targetTris = '20000', brilho = '1'] = process.argv.slice(2);
const raw = JSON.parse(readFileSync(rigPath, 'utf8'));
const texs = JSON.parse(readFileSync(texPath, 'utf8'));

await MeshoptSimplifier.ready;
const P = new Float32Array(raw.positions.flat());
const total = raw.indices.length;
const want = Number(targetTris);

// triângulos por material (o material do triângulo = o do 1º vértice);
// materiais que viram a mesma textura são juntados
const texKey = texs.map((t) => `${t.map}|${t.normalMap}|${t.alpha}`);
const uniq = [...new Set(texKey)];
const matOf = raw.materiais.map((_, i) => uniq.indexOf(texKey[i]));
const byMat = uniq.map(() => []);
for (const f of raw.indices) byMat[matOf[raw.mat[f[0]]]].push(...f);

const parts = [];
for (let m = 0; m < byMat.length; m++) {
  const I = new Uint32Array(byMat[m]);
  if (!I.length) continue;
  const target = Math.max(3, Math.floor((want * (I.length / 3)) / total) * 3);
  let idx = I;
  if (target < I.length) {
    idx = MeshoptSimplifier.simplify(I, P, 3, target, 0.02, [])[0];
    if (idx.length > target * 1.2) idx = MeshoptSimplifier.simplify(I, P, 3, target, 0.08, [])[0];
  }
  parts.push({ m, idx });
  console.log('material', m, 'triângulos', I.length / 3, '->', idx.length / 3);
}

// só os vértices usados
const remap = new Map();
const used = [];
for (const { idx } of parts) for (const v of idx) if (!remap.has(v)) { remap.set(v, used.length); used.push(v); }
const n = used.length;
const allIdx = [];
const groups = [];
for (const { m, idx } of parts) {
  groups.push([allIdx.length, idx.length, groups.length]);
  for (const v of idx) allIdx.push(remap.get(v));
}
const index = (n < 65536 ? Uint16Array : Uint32Array).from(allIdx);
const groupTex = parts.map(({ m }) => uniq[m].split('|'));

const pos = new Float32Array(n * 3);
const uv = new Uint16Array(n * 2);
const skinI = new Uint8Array(n * 4);
const skinW = new Uint8Array(n * 4);
for (let k = 0; k < n; k++) {
  const v = used[k];
  pos.set(raw.positions[v], k * 3);
  // textura repetida: leva u e v para 0..1
  const fr = (x) => x - Math.floor(x);
  for (let q = 0; q < 2; q++) {
    let t = raw.uv[v][q];
    if (t < 0 || t > 1) t = fr(t);
    uv[k * 2 + q] = Math.round(Math.min(1, Math.max(0, t)) * 65535);
  }
  let left = 255;
  for (let q = 0; q < 4; q++) {
    const w = q === 3 ? left : Math.min(left, Math.round(raw.skinWeight[v][q] * 255));
    skinI[k * 4 + q] = raw.skinIndex[v][q];
    skinW[k * 4 + q] = w;
    left -= w;
  }
}
// normais suaves (pela posição, sem costura visível)
const nor = new Float32Array(n * 3);
const keyOf = (k) => `${pos[k * 3].toFixed(4)},${pos[k * 3 + 1].toFixed(4)},${pos[k * 3 + 2].toFixed(4)}`;
const same = new Map();
const pid = new Uint32Array(n);
for (let k = 0; k < n; k++) {
  const key = keyOf(k);
  if (!same.has(key)) same.set(key, same.size);
  pid[k] = same.get(key);
}
const acc = new Float32Array(same.size * 3);
for (let t = 0; t < index.length; t += 3) {
  const [a, b, c] = [index[t], index[t + 1], index[t + 2]];
  const e1 = [0, 1, 2].map((q) => pos[b * 3 + q] - pos[a * 3 + q]);
  const e2 = [0, 1, 2].map((q) => pos[c * 3 + q] - pos[a * 3 + q]);
  const fn = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
  for (const v of [a, b, c]) for (let q = 0; q < 3; q++) acc[pid[v] * 3 + q] += fn[q];
}
for (let k = 0; k < n; k++) {
  const p = pid[k] * 3;
  const l = Math.hypot(acc[p], acc[p + 1], acc[p + 2]) || 1;
  for (let q = 0; q < 3; q++) nor[k * 3 + q] = acc[p + q] / l;
}

const bmin = [Infinity, Infinity, Infinity];
const bmax = [-Infinity, -Infinity, -Infinity];
for (let k = 0; k < n; k++) for (let q = 0; q < 3; q++) {
  bmin[q] = Math.min(bmin[q], pos[k * 3 + q]);
  bmax[q] = Math.max(bmax[q], pos[k * 3 + q]);
}
const qpos = new Uint16Array(n * 3);
for (let k = 0; k < n; k++) for (let q = 0; q < 3; q++) {
  qpos[k * 3 + q] = Math.round(((pos[k * 3 + q] - bmin[q]) / (bmax[q] - bmin[q] || 1)) * 65535);
}
const qnor = new Int8Array(n * 3);
for (let k = 0; k < n * 3; k++) qnor[k] = Math.round(nor[k] * 127);

const b64 = (arr) => Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength).toString('base64');
const dataUri = (p) => (p && p !== 'null' ? `data:image/${p.endsWith('.png') ? 'png' : 'jpeg'};base64,${readFileSync(p).toString('base64')}` : null);
const info = raw.info ?? {};
const mats = groupTex.map(([map, normalMap, alpha]) => ({ map: dataUri(map), normalMap: dataUri(normalMap), alpha: alpha === 'true' }));
const out = `// =============================================================
// MODELO IMPORTADO: ${info.title ?? 'modelo'} (gerado por tools/models/bichos.sh)
// Autor: ${info.author ?? '?'}
// Licença: ${info.copyright ?? '?'}
// Original: ${info.url ?? '?'}
// Mudanças: menos triângulos, esqueleto do jogo encaixado na forma do
// modelo. NÃO edite à mão: rode o conversor.
// =============================================================
export default {
  credito: ${JSON.stringify({ titulo: info.title, autor: info.author, licenca: info.copyright, url: info.url })},
  vertices: ${n},
  bones: ${JSON.stringify(raw.bones)},
  box: ${JSON.stringify([bmin.map((v) => +v.toFixed(5)), bmax.map((v) => +v.toFixed(5))])},
  position: '${b64(qpos)}',
  normal: '${b64(qnor)}',
  uv: '${b64(uv)}',
  skinIndex: '${b64(skinI)}',
  skinWeight: '${b64(skinW)}',
  index: '${b64(index)}',
  index32: ${index instanceof Uint32Array},
  doisLados: ${!!raw.doisLados},
  brilho: ${Number(brilho)},
  groups: ${JSON.stringify(groups)},
  materiais: ${JSON.stringify(mats)},
};
`;
writeFileSync(outPath, out);
console.log('vértices', n, 'triângulos', index.length / 3, 'ossos', raw.bones.length, 'arquivo', (out.length / 1024).toFixed(0), 'KB');
