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
import SELA from './imported/sela_modelo.js';

const LEATHER = new THREE.MeshLambertMaterial({ color: '#6e4426' });
const LEATHER_DARK = new THREE.MeshLambertMaterial({ color: '#4a2c18' });
const CLOTH = new THREE.MeshLambertMaterial({ color: '#8a2e22' });
const IRON = new THREE.MeshLambertMaterial({ color: '#6a6e74' });
const WOOD = new THREE.MeshLambertMaterial({ color: '#7a5a3a' });

// Sela de verdade (modelo enviado pelo jogador, sem textura: pintada de couro)
const SELA_COURO = new THREE.MeshLambertMaterial({ color: '#7b4a28' });
let selaGeo = null;
function selaGeometry() {
  if (selaGeo) return selaGeo;
  const f32 = (b64) => { const b = Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0)); return new Float32Array(b.buffer); };
  const u16 = (b64) => { const b = Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0)); return new Uint16Array(b.buffer); };
  selaGeo = new THREE.BufferGeometry();
  selaGeo.setAttribute('position', new THREE.BufferAttribute(f32(SELA.pos), 3));
  selaGeo.setIndex(new THREE.BufferAttribute(u16(SELA.index), 1));
  selaGeo.computeVertexNormals();
  return selaGeo;
}

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

// Onde a sela fica no modelo (unidades do modelo): no meio do TRONCO, em cima das
// costas. Mede o corpo de verdade: acha o trecho mais largo (o tronco, sem pescoço,
// cabeça nem cauda), pega o meio dele e a altura das costas ali (ignorando espinhos
// e placas). Guardado na geometria (igual para todos os bichos da espécie).
export function backSpot(c) {
  const geo = c.mesh.geometry;
  if (geo.userData.backSpot) return geo.userData.backSpot;
  if (!geo.boundingBox) geo.computeBoundingBox();
  const bb = geo.boundingBox;
  const pos = geo.attributes.position;
  const H = bb.max.y - bb.min.y;
  const len = bb.max.z - bb.min.z;
  const N = 48;
  const bins = Array.from({ length: N }, () => ({ lo: Infinity, hi: -Infinity, ys: [] }));
  const floor = bb.min.y + H * 0.3; // acima das pernas
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (y < floor) continue;
    const k = Math.min(N - 1, Math.floor(((pos.getZ(i) - bb.min.z) / len) * N));
    const bn = bins[k];
    const x = pos.getX(i);
    bn.lo = Math.min(bn.lo, x);
    bn.hi = Math.max(bn.hi, x);
    bn.ys.push([x, y]);
  }
  const wid = bins.map((bn) => (bn.hi > bn.lo ? bn.hi - bn.lo : 0));
  const maxW = Math.max(...wid, 1e-6);
  // maior trecho seguido de "tronco" (largo)
  let best = { n: 0, a: 0 };
  for (let a0 = 0; a0 < N; a0++) {
    let e = a0;
    while (e < N && wid[e] >= maxW * 0.55) e++;
    if (e - a0 > best.n) best = { n: e - a0, a: a0 };
    a0 = Math.max(a0, e);
  }
  const first = best.n ? best.a : Math.floor(N * 0.3);
  const last = best.n ? best.a + best.n - 1 : Math.floor(N * 0.7);
  const zOf = (k) => bb.min.z + ((k + 0.5) / N) * len;
  const zc = (zOf(first) + zOf(last)) / 2;
  // altura das costas no meio do tronco (percentil alto: ignora espinhos soltos)
  const mid0 = Math.max(first, Math.floor((first + last) / 2 - 2));
  const mid1 = Math.min(last, Math.ceil((first + last) / 2 + 2));
  const ys = [];
  for (let k = mid0; k <= mid1; k++) for (const [x, y] of bins[k].ys) if (Math.abs(x) < maxW * 0.2) ys.push(y);
  ys.sort((a, b2) => a - b2);
  const top = ys.length ? ys[Math.floor(ys.length * 0.82)] : bb.max.y * 0.7;
  const belly = Math.max(bb.min.y, floor);
  geo.userData.backSpot = { z: zc, y: top, w: maxW, belly, trunk: (zOf(last) - zOf(first)) + len / N };
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
  // em cima das costas, no meio do tronco
  const spot = backSpot(c);
  const width = Math.min(spot.w, 3.2 * s * (kind === 'sela_grande' ? 2 : 1));
  const back = spot.y;
  const len = Math.max(0.9 * s, Math.min(spot.trunk * 0.6, 2.4 * s));
  const g = new THREE.Group();
  g.name = 'Sela';
  g.position.z = spot.z;
  const pw = Math.min(width * 0.75, 1.7 * s * (kind === 'sela_grande' ? 1.6 : 1));
  // a sela (modelo): escala pela largura; a frente (o "chifre") aponta para a cabeça
  const f = pw / SELA.w;
  const model = new THREE.Mesh(selaGeometry(), SELA_COURO);
  model.scale.setScalar(f);
  model.position.set(0, back - 0.02 * s, 0);
  model.castShadow = true;
  g.add(model);
  c._seatLift = SELA.seat * f; // o jogador senta em cima do assento
  const len2 = SELA.l * f;
  // cilha: tiras descendo pelos lados, em volta da barriga
  const drop = Math.max(0.3 * s, (back - spot.belly) * 0.9);
  for (const side of [-1, 1]) g.add(box(0.06 * s, drop, 0.12 * s, side * pw * 0.5, back - drop / 2, 0, LEATHER_DARK));
  if (kind === 'sela_grande') {
    // plataforma de madeira com grade (como as selas de gigantes do ARK)
    g.add(box(pw * 1.15, 0.06 * s, len2 * 1.2, 0, back + SELA.seat * f * 0.7, 0, WOOD));
    for (const side of [-1, 1]) g.add(box(0.05 * s, 0.35 * s, len2 * 1.2, side * pw * 0.57, back + SELA.seat * f * 0.7 + 0.17 * s, 0, WOOD));
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
