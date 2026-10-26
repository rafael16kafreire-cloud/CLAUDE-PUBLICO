// =============================================================
// REDUZ um bicho já convertido (src/creatures/imported/<id>.js) para
// menos triângulos, sem precisar do arquivo original. Usa o
// meshoptimizer (não cria vértices novos: textura, pesos e ossos
// continuam certos) e, se não chegar no alvo, junta vértices numa grade.
// Uso: node reduzir_bicho.mjs <id> <triângulos> [<id> <triângulos> ...]
// =============================================================
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { MeshoptSimplifier } from 'meshoptimizer';

await MeshoptSimplifier.ready;
const args = process.argv.slice(2);
const dir = new URL('../../src/creatures/imported/', import.meta.url);

const fromB64 = (s, T) => {
  const b = Buffer.from(s, 'base64');
  return new T(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
};
const toB64 = (a) => Buffer.from(a.buffer, a.byteOffset, a.byteLength).toString('base64');

function grid(I, P, target) {
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (const v of I) for (let q = 0; q < 3; q++) { lo[q] = Math.min(lo[q], P[v * 3 + q]); hi[q] = Math.max(hi[q], P[v * 3 + q]); }
  const ext = Math.max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]);
  let idx = I;
  for (let cells = 220; cells >= 30; cells = Math.floor(cells * 0.88)) {
    const size = ext / cells;
    const rep = new Map();
    const cellOf = (v) => {
      const k = `${Math.floor((P[v * 3] - lo[0]) / size)},${Math.floor((P[v * 3 + 1] - lo[1]) / size)},${Math.floor((P[v * 3 + 2] - lo[2]) / size)}`;
      if (!rep.has(k)) rep.set(k, v);
      return rep.get(k);
    };
    const out = [];
    const seen = new Set();
    for (let t = 0; t < I.length; t += 3) {
      const a = cellOf(I[t]);
      const b = cellOf(I[t + 1]);
      const c = cellOf(I[t + 2]);
      if (a === b || b === c || a === c) continue;
      const key = [a, b, c].sort((x, y) => x - y).join(',');
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(a, b, c);
    }
    idx = Uint32Array.from(out);
    if (idx.length <= target * 3 * 1.2) break;
  }
  return idx;
}

for (let k = 0; k < args.length; k += 2) {
  const id = args[k];
  const want = Number(args[k + 1]);
  const file = new URL(`${id}.js`, dir);
  const src = readFileSync(file, 'utf8');
  const d = (await import(`${pathToFileURL(file.pathname).href}?t=${Date.now()}`)).default;
  const n = d.vertices;
  const qp = fromB64(d.position, Uint16Array);
  const [bmin, bmax] = d.box;
  const P = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) for (let q = 0; q < 3; q++) P[i * 3 + q] = bmin[q] + (qp[i * 3 + q] / 65535) * (bmax[q] - bmin[q]);
  const I = d.index32 ? fromB64(d.index, Uint32Array) : Uint32Array.from(fromB64(d.index, Uint16Array));
  const total = I.length / 3;
  if (total <= want) {
    console.log(id, 'já tem', total, 'triângulos');
    continue;
  }
  // cada grupo (material) reduz na mesma proporção
  const groups = d.groups ?? [[0, I.length, 0]];
  const newIdx = [];
  const newGroups = [];
  for (const [start, count, m] of groups) {
    const gI = I.slice(start, start + count);
    const target = Math.max(3, Math.floor((want * (count / 3)) / total) * 3);
    let idx = MeshoptSimplifier.simplify(gI, P, 3, target, 0.02, [])[0];
    for (const err of [0.08, 0.2, 0.5]) if (idx.length > target * 1.2) idx = MeshoptSimplifier.simplify(gI, P, 3, target, err, [])[0];
    if (idx.length > target * 1.5) idx = grid(gI, P, target / 3);
    newGroups.push([newIdx.length, idx.length, m]);
    for (const v of idx) newIdx.push(v);
  }
  // só os vértices usados
  const remap = new Map();
  const used = [];
  for (const v of newIdx) if (!remap.has(v)) { remap.set(v, used.length); used.push(v); }
  const pick = (b64, T, per) => {
    const a = fromB64(b64, T);
    const out = new T(used.length * per);
    used.forEach((v, i) => { for (let q = 0; q < per; q++) out[i * per + q] = a[v * per + q]; });
    return toB64(out);
  };
  const m = used.length;
  const index = (m < 65536 ? Uint16Array : Uint32Array).from(newIdx.map((v) => remap.get(v)));
  let out = src;
  const set = (key, value) => {
    const re = new RegExp(`(\\n  ${key}: )[^\\n]*`);
    if (!re.test(out)) throw new Error(`${id}: campo ${key} não achado`);
    out = out.replace(re, (_, a) => `${a}${value},`);
  };
  set('vertices', m);
  set('position', `'${pick(d.position, Uint16Array, 3)}'`);
  set('normal', `'${pick(d.normal, Int8Array, 3)}'`);
  set('uv', `'${pick(d.uv, Uint16Array, 2)}'`);
  set('skinIndex', `'${pick(d.skinIndex, Uint8Array, 4)}'`);
  set('skinWeight', `'${pick(d.skinWeight, Uint8Array, 4)}'`);
  if (d.color) set('color', `'${pick(d.color, Uint8Array, 3)}'`);
  set('index', `'${toB64(index)}'`);
  set('index32', index instanceof Uint32Array);
  if (d.groups) set('groups', JSON.stringify(newGroups));
  writeFileSync(file, out);
  console.log(id, 'triângulos', total, '->', index.length / 3, 'vértices', n, '->', m, 'arquivo', (out.length / 1024).toFixed(0), 'KB');
}
