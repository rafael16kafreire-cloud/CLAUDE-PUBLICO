// =============================================================
// REDUZ os triângulos do braço em 1ª pessoa (src/player/fp_arms_data.js)
// sem mexer nos vértices (ossos, pesos e textura continuam certos):
// o meshoptimizer escolhe menos triângulos e o índice é regravado no
// mesmo lugar do arquivo GLB.
// Uso: node tools/models/reduzir_glb_braco.mjs <fração 0..1>
// =============================================================
import { readFileSync, writeFileSync } from 'node:fs';
import { MeshoptSimplifier } from 'meshoptimizer';

await MeshoptSimplifier.ready;
const frac = Number(process.argv[2] ?? 0.4);
const file = new URL('../../src/player/fp_arms_data.js', import.meta.url);
const src = readFileSync(file, 'utf8');
const b64 = src.match(/FP_ARMS_GLB = '([^']+)'/)[1];
const glb = Buffer.from(b64, 'base64');
const jsonLen = glb.readUInt32LE(12);
const json = JSON.parse(glb.subarray(20, 20 + jsonLen).toString('utf8'));
const binStart = 20 + jsonLen + 8;
const bin = glb.subarray(binStart);
const T = { 5121: Uint8Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };
const view = (acc) => {
  const bv = json.bufferViews[acc.bufferView];
  const C = T[acc.componentType];
  const n = acc.count * ({ SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[acc.type]);
  return new C(bin.buffer, bin.byteOffset + (bv.byteOffset ?? 0) + (acc.byteOffset ?? 0), n);
};
let before = 0;
let after = 0;
for (const mesh of json.meshes) {
  for (const prim of mesh.primitives) {
    if (prim.indices === undefined) continue;
    const ia = json.accessors[prim.indices];
    const idx = view(ia);
    const pos = view(json.accessors[prim.attributes.POSITION]);
    const target = Math.max(3, Math.floor((idx.length * frac) / 3) * 3);
    const out = MeshoptSimplifier.simplify(Uint32Array.from(idx), Float32Array.from(pos), 3, target, 0.02, ['LockBorder'])[0];
    before += idx.length / 3;
    after += out.length / 3;
    idx.fill(0);
    idx.set(out);
    ia.count = out.length;
  }
}
// JSON novo (mesmo tamanho ou menor, completa com espaços)
let js = JSON.stringify(json);
while (js.length % 4) js += ' ';
const jsonBuf = Buffer.from(js);
const pad = jsonLen - jsonBuf.length;
const jsonFinal = pad >= 0 ? Buffer.concat([jsonBuf, Buffer.alloc(pad, 0x20)]) : jsonBuf;
const head = Buffer.alloc(20);
head.writeUInt32LE(0x46546c67, 0);
head.writeUInt32LE(2, 4);
head.writeUInt32LE(20 + jsonFinal.length + glb.length - (20 + jsonLen), 8);
head.writeUInt32LE(jsonFinal.length, 12);
head.writeUInt32LE(0x4e4f534a, 16);
const outGlb = Buffer.concat([head, jsonFinal, glb.subarray(20 + jsonLen)]);
writeFileSync(file, src.replace(b64, outGlb.toString('base64')));
console.log('triângulos', before, '->', after);
