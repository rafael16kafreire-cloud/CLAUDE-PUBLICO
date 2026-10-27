// =============================================================
// SELA – modelo de sela nas costas do bicho montável (feito por código)
// O tamanho segue o corpo: manta de couro, assento com encosto,
// cilhas em volta da barriga e estribos dos lados. Vai presa no osso
// do quadril (hips), então balança junto com o bicho andando.
//
// Tipos (como no ARK, uma sela por porte):
//   sela        – bichos pequenos (até 5 m)
//   sela_media  – médios (5 a 11 m)
//   sela_grande – gigantes (11 m ou mais), com plataforma de madeira
// =============================================================
import * as THREE from 'three';
import { BALANCE } from '../core/balance.js';

const LEATHER = new THREE.MeshLambertMaterial({ color: '#6e4426' });
const LEATHER_DARK = new THREE.MeshLambertMaterial({ color: '#4a2c18' });
const CLOTH = new THREE.MeshLambertMaterial({ color: '#8a2e22' });
const IRON = new THREE.MeshLambertMaterial({ color: '#6a6e74' });
const WOOD = new THREE.MeshLambertMaterial({ color: '#7a5a3a' });

// Comprimento do corpo do bicho adulto (m).
export function bodyLength(c) {
  return (c.bodyFront + c.bodyBack) * c.adultScale;
}

// Qual sela serve para este bicho.
export function saddleFor(c) {
  const L = bodyLength(c);
  const T = BALANCE.sela.porte_m;
  return L < T[0] ? 'sela' : L < T[1] ? 'sela_media' : 'sela_grande';
}

// Onde a sela fica no modelo (unidades do modelo): no meio entre o
// quadril e o peito, em cima das costas (o vértice mais alto ali).
// Guardado na geometria (igual para todos os bichos da espécie).
export function backSpot(c) {
  const geo = c.mesh.geometry;
  if (geo.userData.backSpot) return geo.userData.backSpot;
  if (!geo.boundingBox) geo.computeBoundingBox();
  const bb = geo.boundingBox;
  const b = c.bones ?? {};
  // posição dos ossos no espaço do modelo (pose de descanso)
  const restZ = (bone) => {
    if (!bone) return null;
    let z = 0;
    for (let o = bone; o && o.isBone; o = o.parent) z += o.userData?.rest?.z ?? o.position.z;
    return z;
  };
  const zh = restZ(b.hips);
  const zc = restZ(b.chest);
  const zMid = zh !== null && zc !== null ? (zh * 0.6 + zc * 0.4) : (bb.min.z + bb.max.z) / 2;
  const len = bb.max.z - bb.min.z;
  const wid = bb.max.x - bb.min.x;
  const pos = geo.attributes.position;
  let top = -Infinity;
  for (let i = 0; i < pos.count; i++) {
    if (Math.abs(pos.getZ(i) - zMid) < len * 0.06 && Math.abs(pos.getX(i)) < wid * 0.2) top = Math.max(top, pos.getY(i));
  }
  if (!Number.isFinite(top)) top = bb.max.y * 0.7;
  geo.userData.backSpot = { z: zMid, y: top };
  return geo.userData.backSpot;
}

function box(w, h, d, x, y, z, mat) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

// Monta a sela no espaço do modelo (unidades do modelo, antes da escala).
// geo = geometria do bicho (para medir largura/altura das costas).
export function buildSaddle(c, kind) {
  const geo = c.mesh.geometry;
  if (!geo.boundingBox) geo.computeBoundingBox();
  const bb = geo.boundingBox;
  const s = 1 / c.adultScale; // 1 m do mundo em unidades do modelo
  const width = Math.min(bb.max.x - bb.min.x, 3.2 * s * (kind === 'sela_grande' ? 2 : 1));
  // em cima das costas, entre quadril e peito
  const spot = backSpot(c);
  const back = spot.y;
  const len = Math.max(0.9 * s, Math.min((bb.max.z - bb.min.z) * 0.22, 2.4 * s));
  const g = new THREE.Group();
  g.name = 'Sela';
  g.position.z = spot.z;
  const pw = width * 0.75;
  // manta
  g.add(box(pw, 0.05 * s, len, 0, back, 0, CLOTH));
  // assento, pito na frente e encosto atrás
  g.add(box(pw * 0.6, 0.1 * s, len * 0.7, 0, back + 0.07 * s, 0, LEATHER));
  g.add(box(pw * 0.45, 0.22 * s, 0.1 * s, 0, back + 0.17 * s, -len * 0.36, LEATHER_DARK));
  g.add(box(pw * 0.55, 0.3 * s, 0.1 * s, 0, back + 0.2 * s, len * 0.36, LEATHER_DARK));
  // cilhas descendo pelos lados e estribos
  const drop = Math.max(0.4 * s, (back - bb.min.y) * 0.45);
  for (const side of [-1, 1]) {
    const strap = box(0.06 * s, drop, 0.12 * s, side * pw * 0.5, back - drop / 2, 0, LEATHER_DARK);
    g.add(strap);
    const stir = new THREE.Mesh(new THREE.TorusGeometry(0.09 * s, 0.018 * s, 4, 8), IRON);
    stir.position.set(side * (pw * 0.5 + 0.02 * s), back - drop * 0.75, len * 0.1);
    stir.rotation.y = Math.PI / 2;
    g.add(stir);
  }
  if (kind === 'sela_grande') {
    // plataforma de madeira com grade (como as selas de gigantes do ARK)
    g.add(box(pw * 1.15, 0.06 * s, len * 1.4, 0, back + 0.02 * s, 0, WOOD));
    for (const side of [-1, 1]) g.add(box(0.05 * s, 0.35 * s, len * 1.4, side * pw * 0.57, back + 0.2 * s, 0, WOOD));
  }
  // presa no quadril: a sela acompanha o balanço do corpo
  const hips = c.bones?.hips;
  if (hips) {
    hips.updateWorldMatrix(true, false);
    const inv = new THREE.Matrix4().copy(c.mesh.matrixWorld).invert().multiply(hips.matrixWorld).invert();
    // ponto da sela no espaço do modelo -> espaço do osso
    const holder = new THREE.Group();
    holder.add(g);
    holder.applyMatrix4(inv);
    hips.add(holder);
    return holder;
  }
  c.mesh.add(g);
  return g;
}
