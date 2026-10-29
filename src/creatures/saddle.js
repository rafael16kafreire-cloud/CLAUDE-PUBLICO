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
const ROPE = new THREE.MeshLambertMaterial({ color: '#b39a68' }); // corda de fibra

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

// Corda que se estica entre dois pontos que se mexem (sela -> cabresto): uma fita de seção
// quadrada com poucos segmentos, refeita todo quadro (barata).
function makeRopeMesh(segs, r) {
  const n = (segs + 1) * 4;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  const idx = [];
  for (let k = 0; k < segs; k++) {
    for (let q = 0; q < 4; q++) {
      const a = k * 4 + q;
      const b = k * 4 + ((q + 1) % 4);
      idx.push(a, b, a + 4, b, b + 4, a + 4);
    }
  }
  geo.setIndex(idx);
  const m = new THREE.Mesh(geo, ROPE);
  m.frustumCulled = false;
  m.userData = { segs, r, curve: new THREE.CatmullRomCurve3([new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()], false, 'catmullrom', 0.5), p: new THREE.Vector3(), t: new THREE.Vector3(), sd: new THREE.Vector3(), up: new THREE.Vector3() };
  return m;
}

function updateRope(m, pts) {
  const U = m.userData;
  U.curve.points = pts;
  const pos = m.geometry.attributes.position;
  const Y = new THREE.Vector3(0, 1, 0);
  for (let k = 0; k <= U.segs; k++) {
    const u = k / U.segs;
    U.curve.getPoint(u, U.p);
    U.curve.getTangent(u, U.t);
    U.sd.crossVectors(U.t, Y);
    if (U.sd.lengthSq() < 1e-6) U.sd.set(1, 0, 0);
    U.sd.normalize();
    U.up.crossVectors(U.sd, U.t).normalize();
    const c4 = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
    for (let q = 0; q < 4; q++) {
      pos.setXYZ(k * 4 + q, U.p.x + (U.sd.x * c4[q][0] + U.up.x * c4[q][1]) * U.r, U.p.y + (U.sd.y * c4[q][0] + U.up.y * c4[q][1]) * U.r, U.p.z + (U.sd.z * c4[q][0] + U.up.z * c4[q][1]) * U.r);
    }
  }
  pos.needsUpdate = true;
  m.geometry.computeVertexNormals();
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
  // tamanho da sela pelo lugar onde ela vai: ~40% da largura do tronco, sem passar de metade
  // do comprimento dele (a sela tem 1,32× mais comprida que larga) e com mínimo/máximo em metros
  const maxW = kind === 'sela_grande' ? 2.2 * s : kind === 'sela_media' ? 1.0 * s : 0.7 * s;
  const pw = Math.max(0.26 * s, Math.min(width * 0.4, maxW, (spot.trunk * 0.5) / (SELA.l / SELA.w)));
  // a sela (modelo): escala pela largura; a frente (o "chifre") aponta para a cabeça
  const f = pw / SELA.w;
  const model = new THREE.Mesh(selaGeometry(), SELA_COURO);
  model.scale.setScalar(f);
  model.position.set(0, back - 0.02 * s, 0);
  model.castShadow = true;
  g.add(model);
  c._seatLift = SELA.seat * f; // o jogador senta em cima do assento
  const len2 = SELA.l * f;
  // manta de pano por baixo da sela (uma caixa fina: não pesa)
  g.add(box(pw * 1.22, 0.025 * s, len2 * 1.1, 0, back - 0.004 * s, 0, CLOTH));
  if (kind === 'sela_grande') {
    // plataforma de madeira com grade (como as selas de gigantes do ARK)
    g.add(box(pw * 1.15, 0.06 * s, len2 * 1.2, 0, back + SELA.seat * f * 0.7, 0, WOOD));
    for (const side of [-1, 1]) g.add(box(0.05 * s, 0.35 * s, len2 * 1.2, side * pw * 0.57, back + SELA.seat * f * 0.7 + 0.17 * s, 0, WOOD));
  }
  // Presa no corpo: a sela acompanha o quadril (giro e balanço) e, a cada quadro, a altura
  // dela é refeita pela pele do bicho ali (as animações levantam e abaixam o dorso): ela
  // fica sempre assentada em cima das costas, sem flutuar nem afundar.
  const hips = c.bones?.hips;
  const chest = c.bones?.chest;
  const sk = c.mesh.skeleton;
  const bi = hips && sk ? sk.bones.indexOf(hips) : -1;
  if (bi >= 0) {
    const bindPos = (bone) => {
      const k = sk.bones.indexOf(bone);
      return k < 0 ? null : new THREE.Vector3().setFromMatrixPosition(new THREE.Matrix4().copy(sk.boneInverses[k]).invert());
    };
    const ph = bindPos(hips);
    const pc = chest ? bindPos(chest) : null;
    // meio entre o quadril e o peito: é onde fica o tronco de verdade
    const zs = ph && pc ? ph.z * 0.6 + pc.z * 0.4 : spot.z;
    g.position.z = zs;
    // vértices do tronco ali perto (pose de ligação), para medir a altura das costas
    const pos = geo.attributes.position;
    const R = Math.max(0.35 * s, Math.min(spot.w * 0.25, 1.2 * s));
    const idx = [];
    for (let i = 0; i < pos.count; i++) {
      if (Math.hypot(pos.getX(i), pos.getZ(i) - zs) < R * 1.8 && pos.getY(i) > spot.belly) idx.push(i);
    }
    const holder = new THREE.Group();
    holder.matrixAutoUpdate = false;
    holder.add(g);
    c.mesh.add(holder);
    c._sadExtras = [];
    const ropeR = Math.max(0.02 * s, Math.min(0.045 * s, spot.w * 0.012));
    // corda da cilha: um laço em volta do tronco, por baixo da barriga, passando pelos lados da sela
    let halfW = 0;
    let bottom = Infinity;
    for (let i = 0; i < pos.count; i++) {
      if (Math.abs(pos.getZ(i) - zs) < spot.trunk * 0.08 && pos.getY(i) > spot.belly * 0.98) {
        halfW = Math.max(halfW, Math.abs(pos.getX(i)));
        bottom = Math.min(bottom, pos.getY(i));
      }
    }
    halfW = Math.min(halfW || spot.w / 2, spot.w / 2);
    bottom = Number.isFinite(bottom) ? bottom : spot.belly;
    const cy = (back + bottom) / 2;
    const rx = halfW * 0.98 + ropeR;
    const ry = (back - bottom) / 2 + ropeR;
    const ringPts = [];
    for (let k = 0; k < 20; k++) {
      const a = (k / 20) * Math.PI * 2;
      ringPts.push(new THREE.Vector3(Math.cos(a) * rx, cy + Math.sin(a) * ry, 0));
    }
    const girth = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(ringPts, true), 28, ropeR, 5, true), ROPE);
    g.add(girth);
    // cabresto: argola em volta da cabeça (presa ao osso da cabeça) e corda até a sela
    const headBone = c.bones?.head;
    const hk = headBone ? sk.bones.indexOf(headBone) : -1;
    let rope = null;
    if (hk >= 0) {
      const hb = bindPos(headBone);
      let rh = 0;
      for (let i = 0; i < pos.count; i++) {
        if (Math.abs(pos.getZ(i) - hb.z) < 0.5 * s && Math.abs(pos.getY(i) - hb.y) < 0.5 * s) rh = Math.max(rh, Math.abs(pos.getX(i)));
      }
      rh = Math.max(0.08 * s, Math.min(rh * 0.95 || 0.2 * s, 0.6 * s));
      const headHolder = new THREE.Group();
      headHolder.matrixAutoUpdate = false;
      headHolder.matrix.copy(sk.boneInverses[hk]);
      const hp = [];
      for (let k = 0; k < 14; k++) {
        const a = (k / 14) * Math.PI * 2;
        hp.push(new THREE.Vector3(hb.x + Math.cos(a) * rh, hb.y + Math.sin(a) * rh * 0.85, hb.z));
      }
      headHolder.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(hp, true), 20, ropeR * 0.9, 4, true), ROPE));
      headBone.add(headHolder);
      c._sadExtras.push(headHolder);
      const nb = c.bones?.neck2 ?? c.bones?.neck;
      const nk = nb ? sk.bones.indexOf(nb) : -1;
      rope = {
        hk, nk, hb, nb: nk >= 0 ? bindPos(nb) : null, rh, radius: ropeR * 0.8,
        mesh: makeRopeMesh(14, ropeR * 0.8), mh: new THREE.Matrix4(), mn: new THREE.Matrix4(),
        pts: [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()],
        front: new THREE.Vector3(0, back + 0.05 * s, zs - len2 * 0.42),
      };
      c.mesh.add(rope.mesh);
      c._sadExtras.push(rope.mesh);
    }
    c._sadAnchor = { rope, idx, R, bi, zs, back, holder, dy: null, tmp: new THREE.Vector3(), exp: new THREE.Vector3(), m: new THREE.Matrix4(), t: new THREE.Matrix4(), ys: [] };
    ajustarSela(c);
    return holder;
  }
  c.mesh.add(g);
  return g;
}

// Põe a sela onde o corpo está AGORA (chamado todo quadro, depois das animações).
export function ajustarSela(c) {
  const A = c._sadAnchor;
  if (!A || !c._saddleMesh) return;
  const hips = c.bones.hips;
  const sk = c.mesh.skeleton;
  c.mesh.updateMatrixWorld(true);
  sk.update();
  // movimento do quadril em relação à pose de ligação, no espaço do modelo
  A.m.copy(c.mesh.matrixWorld).invert().multiply(hips.matrixWorld).multiply(sk.boneInverses[A.bi]);
  // onde o quadril levaria o ponto da sela, e a altura real das costas ali (pele)
  A.exp.set(0, A.back, A.zs).applyMatrix4(A.m);
  A.ys.length = 0;
  for (const i of A.idx) {
    c.mesh.getVertexPosition(i, A.tmp);
    if (Math.hypot(A.tmp.x - A.exp.x, A.tmp.z - A.exp.z) < A.R) A.ys.push(A.tmp.y);
  }
  let dy = 0;
  if (A.ys.length) {
    // o ponto mais alto da pele ali (a malha tem poucos vértices: percentil pegaria a barriga)
    let top = -Infinity;
    for (const y of A.ys) if (y > top) top = y;
    dy = top - A.exp.y;
  }
  A.dy = A.dy === null ? dy : A.dy + (dy - A.dy) * 0.4;
  A.t.makeTranslation(0, A.dy, 0);
  A.m.premultiply(A.t);
  A.holder.matrix.copy(A.m);
  A.holder.matrixWorldNeedsUpdate = true;
  const R = A.rope;
  if (R) {
    // corda: da frente da sela, passando pelo pescoço, até o cabresto na cabeça
    const head = c.bones.head;
    R.mh.copy(c.mesh.matrixWorld).invert().multiply(head.matrixWorld).multiply(sk.boneInverses[R.hk]);
    R.pts[0].copy(R.front).applyMatrix4(A.m);
    R.pts[3].set(R.hb.x, R.hb.y + R.rh * 0.85, R.hb.z).applyMatrix4(R.mh);
    if (R.nb) {
      R.mn.copy(c.mesh.matrixWorld).invert().multiply(c.bones.neck2 ? c.bones.neck2.matrixWorld : c.bones.neck.matrixWorld).multiply(sk.boneInverses[R.nk]);
      R.pts[1].copy(R.nb).applyMatrix4(R.mn);
      R.pts[1].y += R.rh * 0.9;
      R.pts[2].copy(R.pts[1]).lerp(R.pts[3], 0.5);
      R.pts[2].y += R.rh * 0.3;
    } else {
      R.pts[1].copy(R.pts[0]).lerp(R.pts[3], 0.35);
      R.pts[1].y += R.rh * 0.6;
      R.pts[2].copy(R.pts[0]).lerp(R.pts[3], 0.7);
      R.pts[2].y += R.rh * 0.5;
    }
    updateRope(R.mesh, R.pts);
  }
}
