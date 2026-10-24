// =============================================================
// MODELOS IMPORTADOS (feitos por outras pessoas, com licença livre)
// Os dados vêm de src/creatures/imported/<espécie>.js, gerados pelo
// conversor em tools/models/. O esqueleto já vem com os mesmos nomes
// de ossos que o jogo anima (hips, chest, neck, head, jaw, tail1-3,
// pernaE/D, bracoE/D...), então as animações do jogo funcionam.
// =============================================================
import * as THREE from 'three';
import espinossauro from './imported/espinossauro.js';

export const IMPORTED = { espinossauro };

function bytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
const view = (b64, Type) => {
  const u8 = bytes(b64);
  return new Type(u8.buffer, u8.byteOffset, u8.byteLength / Type.BYTES_PER_ELEMENT);
};

function texture(dataUri, srgb) {
  const t = new THREE.TextureLoader().load(dataUri);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 2;
  return t;
}

export function buildImportedModel(d) {
  const n = d.vertices;
  const [bmin, bmax] = d.box;
  const qp = view(d.position, Uint16Array);
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    for (let q = 0; q < 3; q++) pos[i * 3 + q] = bmin[q] + (qp[i * 3 + q] / 65535) * (bmax[q] - bmin[q]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(view(d.normal, Int8Array), 3, true));
  g.setAttribute('uv', new THREE.BufferAttribute(view(d.uv, Uint16Array), 2, true));
  g.setAttribute('color', new THREE.BufferAttribute(bytes(d.color), 3, true));
  g.setAttribute('skinIndex', new THREE.BufferAttribute(bytes(d.skinIndex), 4));
  g.setAttribute('skinWeight', new THREE.BufferAttribute(bytes(d.skinWeight), 4, true));
  g.setIndex(new THREE.BufferAttribute(view(d.index, d.index32 ? Uint32Array : Uint16Array), 1));
  g.computeBoundingBox();
  g.computeBoundingSphere();
  g.boundingSphere.radius *= 1.3;

  // textura cinza (escamas e relevo) × cor pintada por região
  const material = new THREE.MeshLambertMaterial({
    vertexColors: true,
    map: texture(d.map, true),
    normalMap: texture(d.normalMap, false),
  });
  material.normalScale.set(0.9, 0.9);
  material.color.setScalar(2.2); // a textura é escura (média ~0,45): compensa

  const bones = d.bones.map((b) => ({ name: b.name, parent: b.parent, pos: new THREE.Vector3(...b.pos) }));
  return { geometry: g, bones, material, imported: true };
}
