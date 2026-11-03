// Empacota o resultado de arco_usd.py (malhas.json + texturas) em src/player/imported/arco.js
// Uso: node arco_para_jogo.mjs pasta_saida_do_python destino.js
import fs from 'node:fs';
import path from 'node:path';
const [, , dir, dest] = process.argv;
const M = JSON.parse(fs.readFileSync(path.join(dir, 'malhas.json')));
const T = JSON.parse(fs.readFileSync(path.join(dir, 'texturas.json')));
const b64 = (arr, Ctor) => Buffer.from(new Uint8Array(new Ctor(arr).buffer)).toString('base64');
const out = { malhas: {}, tex: {} };
for (const [k, m] of Object.entries(M)) {
  out.malhas[k] = { p: b64(m.p, Float32Array), n: b64(m.n, Float32Array), uv: b64(m.uv, Float32Array), i: b64(m.i, Uint16Array) };
}
for (const [k, f] of Object.entries(T)) {
  out.tex[k] = `data:image/${f.endsWith('.png') ? 'png' : 'jpeg'};base64,` + fs.readFileSync(f).toString('base64');
}
fs.writeFileSync(dest, '// Gerado por tools/models/arco_para_jogo.mjs (arco e flecha: Amatsukast, CC BY-NC-SA 4.0)\nexport default ' + JSON.stringify(out) + ';\n');
console.log(dest, (fs.statSync(dest).size / 1e6).toFixed(2), 'MB');
