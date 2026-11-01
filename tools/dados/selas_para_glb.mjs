// Monta um .glb de cada sela a partir do que o jogo desenha (ver extrai_selas) e um com todas em fila.
// Uso: node tools/dados/selas_para_glb.mjs dados.json pasta_saida
import fs from 'node:fs';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

globalThis.FileReader = class {
  readAsArrayBuffer(b) { b.arrayBuffer().then((r) => { this.result = r; this.onloadend?.(); this.onload?.(); }); }
  readAsDataURL(b) { b.arrayBuffer().then((r) => { this.result = 'data:' + (b.type || 'application/octet-stream') + ';base64,' + Buffer.from(r).toString('base64'); this.onloadend?.(); this.onload?.(); }); }
};
const [, , dados, saida] = process.argv;
const D = JSON.parse(fs.readFileSync(dados));
fs.mkdirSync(saida, { recursive: true });

function grupo(id, s) {
  const g = new THREE.Group();
  g.name = 'Sela_' + id;
  const mats = new Map();
  for (const [n, p] of s.parts.entries()) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(p.pos, 3));
    geo.setIndex(p.idx);
    geo.computeVertexNormals();
    if (!mats.has(p.color)) mats.set(p.color, new THREE.MeshStandardMaterial({ color: p.color, roughness: 0.85, metalness: 0, name: 'cor_' + p.color.slice(1) }));
    const m = new THREE.Mesh(geo, mats.get(p.color));
    m.name = `peca_${n}`;
    g.add(m);
  }
  // centraliza em x/z e põe a base em y = 0 (frente da sela = -Z)
  const bb = new THREE.Box3().setFromObject(g);
  g.children.forEach((m) => m.position.set(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2));
  return { g, size: bb.getSize(new THREE.Vector3()) };
}
const exportar = (obj, arq) => new Promise((res, rej) => new GLTFExporter().parse(obj, (b) => { fs.writeFileSync(arq, Buffer.from(b)); res(); }, rej, { binary: true }));

const todas = new THREE.Group();
todas.name = 'Todas_as_selas';
let x = 0;
for (const [id, s] of Object.entries(D)) {
  const { g, size } = grupo(id, s);
  await exportar(g, `${saida}/sela_${id}.glb`);
  const c = grupo(id, s).g;
  c.position.x = x + size.x / 2;
  x += size.x + 1.0;
  todas.add(c);
}
await exportar(todas, `${saida}/todas_as_selas.glb`);
console.log(Object.keys(D).length, 'selas');
