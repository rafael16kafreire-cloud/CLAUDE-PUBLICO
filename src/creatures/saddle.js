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
import selasJson from '../data/creatures/selas.json';

// Uma sela para cada bicho (cores e formato em data/creatures/selas.json)
const SELAS = selasJson.selas;
const PORTE = { pequena: 'sela', media: 'sela_media', grande: 'sela_grande' };
const matCache = new Map();
function lambert(cor) {
  if (!matCache.has(cor)) matCache.set(cor, new THREE.MeshLambertMaterial({ color: cor }));
  return matCache.get(cor);
}


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
export function tierOf(c) {
  const d = SELAS[c.species.id];
  if (d) return PORTE[d.porte];
  const L = bodyLength(c);
  const T = BALANCE.sela.porte_m;
  return L < T[0] ? 'sela' : L < T[1] ? 'sela_media' : 'sela_grande';
}

// A sela certa é a do próprio bicho ("Sela de T-Rex"); espécie sem sela própria usa a do porte.
export function saddleFor(c) {
  return SELAS[c.species.id] ? `sela_${c.species.id}` : tierOf(c);
}

// A sela guardada serve neste bicho? (as 3 selas antigas dos saves velhos valem pelo porte)
// Quanto a sela anda para a frente (em m do modelo): o arreio de bichos com placas nas costas
// fica no ombro, na frente das placas (como no ARK).
export function seatShift(c) {
  const f = SELAS[c.species.id]?.frente ?? 0;
  return f ? f * backSpot(c).trunk : 0;
}

export function saddleFits(c, item) {
  return item === saddleFor(c) || item === tierOf(c);
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
export function buildSaddle(c, kindIn) {
  const kind = tierOf(c); // tamanho pelo porte do bicho
  const D = SELAS[c.species.id] ?? { estilo: kind === 'sela_grande' ? 'plataforma' : 'padrao' };
  const estilo = D.estilo;
  const COURO = D.couro ? lambert(D.couro) : SELA_COURO;
  const PANO = D.pano ? lambert(D.pano) : CLOTH;
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
  const shift = seatShift(c);
  g.position.z = spot.z - shift;
  // tamanho da sela pelo lugar onde ela vai: ~40% da largura do tronco, sem passar de metade
  // do comprimento dele (a sela tem 1,32× mais comprida que larga) e com mínimo/máximo em metros
  const maxW = kind === 'sela_grande' ? 2.2 * s : kind === 'sela_media' ? 1.0 * s : 0.7 * s;
  const pw = Math.max(0.26 * s, Math.min(width * 0.4, maxW, (spot.trunk * 0.5) / (SELA.l / SELA.w)));
  // a sela (modelo): escala pela largura; a frente (o "chifre") aponta para a cabeça
  const f = pw / SELA.w;
  const model = new THREE.Mesh(selaGeometry(), COURO);
  model.scale.setScalar(f);
  model.position.set(0, back - 0.02 * s, 0);
  model.castShadow = true;
  g.add(model);
  c._seatLift = SELA.seat * f; // o jogador senta em cima do assento
  const len2 = SELA.l * f;
  // manta de pano por baixo da sela (uma caixa fina: não pesa)
  g.add(box(pw * 1.22 * (estilo === 'cobra' ? 1.5 : 1), 0.025 * s, len2 * 1.1, 0, back - 0.004 * s, 0, PANO));
  const sy = back + SELA.seat * f * 0.7; // altura do assento
  const post = (x, z, h) => g.add(box(0.05 * s, h, 0.05 * s, x, sy + h / 2, z, WOOD));
  if (estilo === 'plataforma') {
    // plataforma de madeira com grade (como as selas de gigantes do ARK)
    g.add(box(pw * 1.15, 0.06 * s, len2 * 1.2, 0, sy, 0, WOOD));
    for (const side of [-1, 1]) g.add(box(0.05 * s, 0.35 * s, len2 * 1.2, side * pw * 0.57, sy + 0.17 * s, 0, WOOD));
    g.add(box(pw * 1.15, 0.3 * s, 0.05 * s, 0, sy + 0.15 * s, -len2 * 0.6, WOOD)); // grade da frente
    g.add(box(pw * 1.15, 0.3 * s, 0.05 * s, 0, sy + 0.15 * s, len2 * 0.6, WOOD)); // e de trás
  } else if (estilo === 'cesto') {
    // cesto alto de madeira (mamute, dinos de carga): postes, travessas e cordas
    const h = 0.55 * s;
    g.add(box(pw * 1.3, 0.06 * s, len2 * 1.25, 0, sy, 0, WOOD));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) post(sx * pw * 0.64, sz * len2 * 0.62, h);
    for (const side of [-1, 1]) {
      g.add(box(0.04 * s, 0.05 * s, len2 * 1.3, side * pw * 0.64, sy + h, 0, WOOD));
      g.add(box(0.03 * s, 0.2 * s, len2 * 1.2, side * pw * 0.64, sy + h * 0.5, 0, PANO));
    }
    for (const sz of [-1, 1]) g.add(box(pw * 1.3, 0.04 * s, 0.04 * s, 0, sy + h, sz * len2 * 0.62, WOOD));
  } else if (estilo === 'arreio') {
    // arreio de couro (estegossauro, anquilossauro...): só uma almofada baixa e as fivelas;
    // as tiras em volta do corpo são feitas mais abaixo (ficam coladas na pele)
    for (const side of [-1, 1]) g.add(box(0.045 * s, 0.05 * s, 0.07 * s, side * pw * 0.66, back + 0.02 * s, 0, IRON));
  } else if (estilo === 'cobra') {
    // sela baixa e larga: duas cintas largas por cima e estribo de corda de cada lado
    for (const sz of [-0.55, 0.55]) g.add(box(pw * 1.55, 0.03 * s, 0.1 * s, 0, back + 0.01 * s, sz * len2, COURO));
    for (const side of [-1, 1]) g.add(box(0.03 * s, 0.03 * s, len2 * 1.1, side * pw * 0.78, back + 0.015 * s, 0, ROPE));
  } else if (estilo === 'voo') {
    // arreio de voo: cintas cruzadas no peito, argolas de ferro e apoio para os pés
    for (const sz of [-0.5, 0.5]) g.add(box(pw * 1.35, 0.03 * s, 0.07 * s, 0, back + 0.012 * s, sz * len2, PANO));
    for (const side of [-1, 1]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.05 * s, 0.01 * s, 5, 10), IRON);
      ring.position.set(side * pw * 0.7, back + 0.04 * s, len2 * 0.3);
      ring.rotation.y = Math.PI / 2;
      g.add(ring);
      g.add(box(0.12 * s, 0.02 * s, 0.1 * s, side * pw * 0.75, back - 0.12 * s, 0.05 * s, WOOD)); // estribo
    }
  } else if (estilo === 'padrao') {
    // cilhas largas de couro (a sela costurada na manta) e estribo de ferro de cada lado
    for (const side of [-1, 1]) {
      g.add(box(0.025 * s, 0.14 * s, 0.07 * s, side * pw * 0.7, back - 0.07 * s, 0, COURO));
      g.add(box(0.1 * s, 0.015 * s, 0.07 * s, side * pw * 0.72, back - 0.15 * s, 0, IRON));
    }
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
    let zs = ph && pc ? ph.z * 0.6 + pc.z * 0.4 : spot.z;
    zs -= shift;
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
    if (estilo === 'arreio') {
      // tiras largas de couro em volta do tronco (por cima das costas, pelos lados e por baixo da barriga)
      for (const k of [-1.5, -0.75, 0.75, 1.5]) {
        const dz = k * len2 * 0.5;
        let hw = 0;
        let bt = Infinity;
        let tp = -Infinity;
        for (let i = 0; i < pos.count; i++) {
          if (Math.abs(pos.getZ(i) - (zs + dz)) < spot.trunk * 0.05 && pos.getY(i) > spot.belly * 0.98) {
            hw = Math.max(hw, Math.abs(pos.getX(i)));
            bt = Math.min(bt, pos.getY(i));
            if (Math.abs(pos.getX(i)) < spot.w * 0.2) tp = Math.max(tp, pos.getY(i));
          }
        }
        hw = Math.min(hw || spot.w / 2, spot.w / 2) * 1.0 + ropeR * 1.5;
        bt = Number.isFinite(bt) ? bt : spot.belly;
        const topY = Number.isFinite(tp) ? Math.min(tp, back + 0.05 * s) : back;
        const cyy = (topY + bt) / 2;
        const ryy = (topY - bt) / 2 + ropeR * 1.5;
        const pts = [];
        for (let q = 0; q < 20; q++) {
          const aa = (q / 20) * Math.PI * 2;
          pts.push(new THREE.Vector3(Math.cos(aa) * hw, cyy + Math.sin(aa) * ryy, dz));
        }
        g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 28, ropeR * 1.7, 5, true), lambert(D.tira ?? '#b8742e')));
      }
    }
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
