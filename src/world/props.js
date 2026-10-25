// =============================================================
// MODELOS DA FLORESTA (feitos por código, originais)
// Cada vértice tem "aWind" (0 = tronco duro, 1 = folha solta) para
// o vento. Cada modelo pode ter versão de perto (detalhada) e de
// longe (simples); bem longe a árvore vira uma "foto" (impostor).
// =============================================================
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { WHITE_UV, LEAF_UV, TILE_UV } from './foliage_texture.js';

function hash3(x, y, z, seed) {
  const h = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719 + seed * 4.1) * 43758.5453;
  return h - Math.floor(h);
}

// Pinta e marca o vento. wind: número (0..1) ou 'altura' (sobe de 0 a 1).
function paint(g, hex, shade = 0, wind = 0) {
  if (g.attributes.uv) g.deleteAttribute('uv');
  const color = new THREE.Color(hex);
  const pos = g.attributes.position;
  g.computeBoundingBox();
  const { min, max } = g.boundingBox;
  const span = Math.max(0.001, max.y - min.y);
  const col = new Float32Array(pos.count * 3);
  const wnd = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    const t = (pos.getY(i) - min.y) / span;
    const f = 1 - shade + shade * 1.25 * t;
    col[i * 3] = color.r * f;
    col[i * 3 + 1] = color.g * f;
    col[i * 3 + 2] = color.b * f;
    wnd[i] = wind === 'altura' ? t : wind;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  if (!g.attributes.aWind) g.setAttribute('aWind', new THREE.BufferAttribute(wnd, 1));
  return g;
}

// Cor por vértice calculada por uma função (x, y, z, nx, ny, nz) -> Color
function paintFn(g, fn, wind = 0) {
  if (g.attributes.uv) g.deleteAttribute('uv');
  if (!g.attributes.normal) g.computeVertexNormals();
  const pos = g.attributes.position;
  const nor = g.attributes.normal;
  const col = new Float32Array(pos.count * 3);
  const wnd = new Float32Array(pos.count).fill(wind);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    fn(c, pos.getX(i), pos.getY(i), pos.getZ(i), nor.getX(i), nor.getY(i), nor.getZ(i));
    col[i * 3] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aWind', new THREE.BufferAttribute(wnd, 1));
  return g;
}

function blob(r, [x, y, z], [sx, sy, sz] = [1, 1, 1], seg = [7, 5], rough = 0.3, seed = 1) {
  const g = new THREE.SphereGeometry(r, seg[0], seg[1]);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i);
    const py = pos.getY(i);
    const pz = pos.getZ(i);
    const f = 1 + (hash3(px, py, pz, seed) - 0.5) * rough;
    pos.setXYZ(i, px * f * sx, py * f * sy, pz * f * sz);
  }
  return g.translate(x, y, z);
}

function cyl(rTop, rBottom, h, [x, y, z], radial = 7, hSeg = 1) {
  return new THREE.CylinderGeometry(rTop, rBottom, h, radial, hSeg, true).translate(x, y + h / 2, z);
}

// Galho/tronco entre dois pontos.
function limb(a, b, r0, r1, radial = 5) {
  const A = new THREE.Vector3(...a);
  const B = new THREE.Vector3(...b);
  const len = A.distanceTo(B);
  const g = new THREE.CylinderGeometry(r1, r0, len, radial, 1, true);
  g.translate(0, len / 2, 0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize()));
  return g.translate(A.x, A.y, A.z);
}

// Constrói uma geometria a partir de listas (normais "para cima":
// folhas iluminadas como o chão, dos dois lados).
function sheet(verts, idx, winds, upNormals = true) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  g.setIndex(idx);
  if (upNormals) {
    const n = new Float32Array(verts.length);
    for (let i = 1; i < n.length; i += 3) n[i] = 1;
    g.setAttribute('normal', new THREE.BufferAttribute(n, 3));
  } else {
    g.computeVertexNormals();
  }
  g.setAttribute('aWind', new THREE.Float32BufferAttribute(winds, 1));
  return g;
}

// Folha composta (samambaia, palmeira): talo curvado com folíolos.
function pinnate({ length, leaf, width = 0.06, segs = 6, droop = 0.6, tilt = 0.5, angle = 0, base = [0, 0, 0], hang = 0.25 }) {
  const verts = [];
  const idx = [];
  const winds = [];
  const P = (t) => [t * length, Math.sin(tilt) * t * length - droop * t * t * length, 0];
  for (let i = 1; i <= segs; i++) {
    const t0 = (i - 1) / segs;
    const t1 = i / segs;
    const a = P(t0);
    const b = P(t1);
    const L = leaf * (1 - t1 * 0.55);
    for (const s of [-1, 1]) {
      const tip = [b[0] + L * 0.35, b[1] - L * hang, s * L];
      const base0 = verts.length / 3;
      verts.push(...a, b[0], b[1], s * width, ...tip);
      winds.push(t0, t1, Math.min(1, t1 + 0.2));
      idx.push(base0, base0 + 1, base0 + 2, base0, base0 + 2, base0 + 1);
    }
  }
  const g = sheet(verts, idx, winds);
  g.rotateY(angle);
  return g.translate(...base);
}

// Folha larga (bananeira, folhagem): faixa com nervura central.
function broadLeaf({ length, width, segs = 5, droop = 0.5, tilt = 0.6, angle = 0, base = [0, 0, 0], tear = 0 }) {
  const verts = [];
  const idx = [];
  const winds = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const x = t * length;
    const y = Math.sin(tilt) * t * length - droop * t * t * length;
    const w = width * Math.pow(Math.sin(Math.PI * Math.min(0.97, t * 0.92 + 0.04)), 0.6);
    const torn = tear && i % 2 === 1 ? 0.75 : 1;
    verts.push(x, y - w * 0.15, -w * torn, x, y + w * 0.08, 0, x, y - w * 0.15, w);
    winds.push(t, t, t);
  }
  for (let i = 0; i < segs; i++) {
    const a = i * 3;
    const b = a + 3;
    // frente
    idx.push(a, b, a + 1, a + 1, b, b + 1, a + 1, b + 1, a + 2, a + 2, b + 1, b + 2);
    // verso
    idx.push(a, a + 1, b, a + 1, b + 1, b, a + 1, a + 2, b + 1, a + 2, b + 2, b + 1);
  }
  const g = sheet(verts, idx, winds);
  g.rotateY(angle);
  return g.translate(...base);
}

// Garante que toda parte tenha "uv": troncos e folhas grandes usam o
// pedaço branco da textura de folhagem (a cor vem do próprio modelo).
export function ensureUv(g) {
  if (g.attributes.uv) return g;
  const n = g.attributes.position.count;
  const uv = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    uv[i * 2] = WHITE_UV[0];
    uv[i * 2 + 1] = WHITE_UV[1];
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

// "uv" do tapete de folhas para uma bola de copa (projeção simples
// a partir do centro; o desenho é aleatório, então não aparece emenda).
function tileUv(g, [cx, cy, cz], r) {
  const pos = g.attributes.position;
  const uv = new Float32Array(pos.count * 2);
  const du = TILE_UV.u1 - TILE_UV.u0;
  const dv = TILE_UV.v1 - TILE_UV.v0;
  for (let i = 0; i < pos.count; i++) {
    const x = (pos.getX(i) - cx) / r;
    const y = (pos.getY(i) - cy) / r;
    const z = (pos.getZ(i) - cz) / r;
    const a = Math.atan2(z, x) / Math.PI; // -1..1
    uv[i * 2] = TILE_UV.u0 + du * (0.5 + 0.5 * Math.abs(a)) * 0.98;
    uv[i * 2 + 1] = TILE_UV.v0 + dv * Math.min(1, Math.max(0, 0.5 + y * 0.45));
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

// Bola de copa sólida com o tapete de folhas (leve: sem recortes).
function leafyBlob(r, center, squash, segs, seed, hex, shade = 0.5) {
  const g = paint(blob(r, center, squash, segs, 0.34, seed), hex, shade, 1);
  return tileUv(g, center, r * Math.max(...squash));
}

function merge(parts) {
  for (const p of parts) {
    ensureUv(p);
    if (!p.attributes.aWind) p.setAttribute('aWind', new THREE.BufferAttribute(new Float32Array(p.attributes.position.count), 1));
    if (!p.index) p.setIndex([...Array(p.attributes.position.count).keys()]);
  }
  const g = mergeGeometries(parts, false);
  g.computeBoundingSphere();
  g.computeBoundingBox();
  return g;
}

// Raízes de apoio (sapopemas): placas curvas saindo do tronco.
// Raiz grossa que sai do tronco e entra no chão (meio enterrada).
function surfaceRoot(angle, height, reach, trunkR, hex, seed = 1, radial = 6) {
  const bend = (hash3(seed, 4, 1, 7) - 0.5) * 0.5;
  const P = (t, a) => [Math.cos(angle + a) * (trunkR * 0.7 + reach * t), height * Math.pow(1 - t, 1.8) - 0.2 * t, Math.sin(angle + a) * (trunkR * 0.7 + reach * t)];
  const pts = [P(0, 0), P(0.35, bend * 0.5), P(0.7, bend), P(1, bend * 1.4)].map((p) => new THREE.Vector3(...p));
  const curve = new THREE.CatmullRomCurve3(pts);
  const g = new THREE.TubeGeometry(curve, 8, 1, radial, false);
  // raio diminui do tronco para a ponta
  const pos = g.attributes.position;
  const nor = g.attributes.normal;
  const per = radial + 1;
  for (let i = 0; i < pos.count; i++) {
    const ring = Math.floor(i / per);
    const t = ring / 8;
    const c = curve.getPoint(t);
    const r = (0.42 - 0.34 * t) * (height / 2.4);
    pos.setXYZ(i, c.x + nor.getX(i) * r, c.y + nor.getY(i) * r * 0.85, c.z + nor.getZ(i) * r);
  }
  g.computeVertexNormals();
  const base = new THREE.Color(hex);
  const moss = new THREE.Color('#4f5a2e');
  return paintFn(g, (col, x, y) => {
    col.copy(base).multiplyScalar(0.78).lerp(moss, Math.max(0, 0.5 - y * 0.4));
  });
}

// Tronco com base alargada, casca com veios e um pouco de musgo embaixo.
function trunk(rTop, rBase, h, flare, hex, radial = 9, hSeg = 6, seed = 1) {
  const g = new THREE.CylinderGeometry(1, 1, h, radial, hSeg, true);
  g.translate(0, h / 2, 0);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const t = y / h;
    let r = rBase + (rTop - rBase) * t + flare * Math.exp(-y / 1.6);
    // veios da casca
    const a = Math.atan2(pos.getZ(i), pos.getX(i));
    r *= 1 + Math.sin(a * 7 + seed) * 0.035 + (hash3(Math.round(a * 4), Math.round(y), seed, 5) - 0.5) * 0.05;
    pos.setX(i, pos.getX(i) * r);
    pos.setZ(i, pos.getZ(i) * r);
    pos.setY(i, y - 0.4); // começa um pouco enterrado
  }
  g.computeVertexNormals();
  const base = new THREE.Color(hex);
  const dark = base.clone().multiplyScalar(0.62);
  const moss = new THREE.Color('#4a5a2c');
  return paintFn(g, (c, x, y, z) => {
    const a = Math.atan2(z, x);
    const streak = 0.5 + 0.5 * Math.sin(a * 11 + y * 0.35 + seed);
    c.copy(base).lerp(dark, streak * 0.35 + (y < 1 ? 0.25 : 0));
    if (y < 2.2) c.lerp(moss, (2.2 - y) / 2.2 * 0.45);
  });
}

const BARK_LIGHT = '#8a8070';
const BARK = '#5e4a35';
const BARK_DARK = '#3f3326';
const GREENS = ['#2c4f22', '#335a27', '#284a1f', '#3a632b', '#2f5524', '#3f6a2e'];

// ------------------------------------------------------------
// Cartões de folhas: vários retângulos com a foto de um tufo de
// folhas (textura com fundo transparente), espalhados dentro de
// cada "bola" da copa. A luz é calculada como se a copa fosse
// redonda (normal apontando para fora), então fica cheia e macia.
//   spots: [x, y, z, raio]; perSpot: cartões por metro de raio
// ------------------------------------------------------------
const _v = new THREE.Vector3();
const _n = new THREE.Vector3();
const _t1 = new THREE.Vector3();
const _t2 = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);

function leafCards(spots, { squash = [1.2, 0.6, 1.2], perSpot = 2.2, minCards = 4, size = 1.0, colors = GREENS, seed = 1, wind = 0.75, core = 0.68 }) {
  const pos = [];
  const nor = [];
  const uvs = [];
  const col = [];
  const wnd = [];
  const idx = [];
  const c = new THREE.Color();
  let k = 0;
  const rnd = () => hash3(k++, seed, 3.7, 11.3);
  const parts = [];
  spots.forEach(([x, y, z, r], si) => {
    // copas grandes: mais cartões (não maiores), para as folhas
    // continuarem do tamanho certo
    const n = Math.max(minCards, Math.round(r * perSpot * Math.max(1, r / 2.6)));
    for (let i = 0; i < n; i++) {
      // ponto dentro da bola (mais para a casca, e mais em cima)
      const th = rnd() * Math.PI * 2;
      const cy = rnd() * 1.85 - 0.85;
      const sy = Math.sqrt(Math.max(0, 1 - cy * cy));
      _v.set(Math.cos(th) * sy, cy, Math.sin(th) * sy);
      const d = r * (0.55 + rnd() * 0.45);
      const px = x + _v.x * d * squash[0];
      const py = y + _v.y * d * squash[1] * 1.6;
      const pz = z + _v.z * d * squash[2];
      // o cartão "olha" mais ou menos para fora
      _n.set(_v.x + (rnd() - 0.5) * 1.2, _v.y + (rnd() - 0.5) * 1.2 + 0.25, _v.z + (rnd() - 0.5) * 1.2).normalize();
      _t1.set(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).cross(_n);
      if (_t1.lengthSq() < 1e-4) _t1.set(1, 0, 0);
      _t1.normalize();
      _t2.copy(_n).cross(_t1).normalize();
      const sz = Math.min(r, 2.8) * size * (0.85 + rnd() * 0.45);
      const h = sz / 2;
      // luz: normal para fora da copa, puxada para cima
      _n.copy(_v).lerp(_up, 0.35).normalize();
      const base = colors[(si + i + seed) % colors.length];
      const bright = 0.72 + (_v.y * 0.5 + 0.5) * 0.38 + (rnd() - 0.5) * 0.14;
      c.set(base).multiplyScalar(bright);
      const flip = rnd() < 0.5;
      const v0 = pos.length / 3;
      const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
      for (const [a, b] of corners) {
        pos.push(px + _t1.x * a * h + _t2.x * b * h, py + _t1.y * a * h + _t2.y * b * h, pz + _t1.z * a * h + _t2.z * b * h);
        nor.push(_n.x, _n.y, _n.z);
        const u = (a > 0) !== flip ? LEAF_UV.u1 : LEAF_UV.u0;
        uvs.push(u, b > 0 ? LEAF_UV.v1 : LEAF_UV.v0);
        col.push(c.r, c.g, c.b);
        wnd.push(wind);
      }
      // frente e verso
      idx.push(v0, v0 + 1, v0 + 2, v0, v0 + 2, v0 + 3, v0, v0 + 2, v0 + 1, v0, v0 + 3, v0 + 2);
    }
    // miolo com tapete de folhas: a copa fica cheia sem precisar
    // de muitos cartões (cartões demais pesam no celular)
    if (core) {
      const hex = new THREE.Color(colors[(si + seed) % colors.length]).multiplyScalar(0.9).getHex();
      parts.push(leafyBlob(r * core, [x, y, z], squash, [6, 5], seed + si, hex, 0.55));
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('aWind', new THREE.Float32BufferAttribute(wnd, 1));
  g.setIndex(idx);
  parts.push(g);
  return parts;
}

function crown(spots, segs = [7, 5], squash = [1.25, 0.5, 1.25], seed = 10) {
  return leafCards(spots, { squash, seed, perSpot: segs[0] >= 7 ? 2.2 : 1.8 });
}

// Copa simples (de média distância): bolas sólidas com o tapete de
// folhas, sem recortes (bem mais leve para a placa de vídeo).
function crownLow(spots, squash, seed) {
  const sq = [squash[0], squash[1] * 1.5, squash[2]]; // mais redonda (não vira "prato")
  return spots.map(([x, y, z, r], i) => leafyBlob(r * 0.92, [x, y + r * 0.15, z], sq, [7, 5], seed + i, GREENS[(i + seed) % GREENS.length], 0.4));
}

function lianas(points, length) {
  return points.map(([x, y, z]) => paint(limb([x, y, z], [x * 1.04, y - length, z * 1.04], 0.05, 0.03, 3), '#3b4527', 0, 0.6));
}

// ------------------------------------------------------------
// Sumaúma: a gigante da floresta (≈ 28 m) com sapopemas e cipós
// ------------------------------------------------------------
export function makeSumauma() {
  const parts = [trunk(0.62, 1.05, 24.4, 0.55, BARK_LIGHT, 11, 8, 2)];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.3 + hash3(i, 3, 1, 1) * 0.4;
    parts.push(surfaceRoot(a, 1.6 + hash3(i, 1, 2, 9) * 1.2, 2.2 + hash3(i, 7, 1, 2) * 1.8, 1.25, BARK_LIGHT, i + 1));
  }
  const branches = [[6.5, 25.5, 2], [-6, 25, -3], [2.5, 26, -6.5], [-3, 25.5, 6]];
  for (const b of branches) parts.push(paint(limb([0, 20, 0], b, 0.38, 0.15), BARK_LIGHT));
  parts.push(...crown([[0, 28, 0, 4.4], [6.5, 26.8, 2, 3.6], [-6, 26.5, -3, 3.6], [2.5, 27.2, -6.5, 3.4], [-3, 26.8, 6, 3.4], [4.5, 28.4, -3, 3], [-4.5, 28.2, 2.5, 3]], [7, 5], [1.35, 0.42, 1.35], 3));
  parts.push(...lianas([[6.2, 25, 2], [-5.6, 24.6, -2.8], [-2.8, 25, 5.6]], 15));
  return merge(parts);
}
export function makeSumaumaLow() {
  return merge([
    trunk(0.65, 1.1, 24.4, 0.5, BARK_LIGHT, 7, 3, 2),
    ...[0, 2, 4, 6].map((i) => surfaceRoot((i / 8) * Math.PI * 2 + 0.3, 2.0, 2.8, 1.25, BARK_LIGHT, i + 1, 4)),
    ...[[6.5, 25.5, 2], [-6, 25, -3], [2.5, 26, -6.5], [-3, 25.5, 6]].map((b) => paint(limb([0, 20, 0], b, 0.36, 0.15, 4), BARK_LIGHT)),
    ...crownLow([[0, 28, 0, 4.4], [6.5, 26.8, 2, 3.6], [-6, 26.5, -3, 3.6], [2.5, 27.2, -6.5, 3.4], [-3, 26.8, 6, 3.4]], [1.35, 0.42, 1.35], 3),
  ]);
}

// ------------------------------------------------------------
// Árvore do dossel (≈ 16 m) com bromélias
// ------------------------------------------------------------
export function makeCanopyTree() {
  const parts = [trunk(0.3, 0.46, 13.4, 0.28, BARK, 8, 5, 4)];
  parts.push(paint(limb([0, 10, 0], [3.6, 14.4, 1], 0.22, 0.1), BARK));
  parts.push(paint(limb([0, 11, 0], [-3.2, 14.6, -1.8], 0.2, 0.09), BARK));
  parts.push(paint(limb([0, 11.5, 0], [0.6, 14.6, -3.6], 0.18, 0.08), BARK));
  parts.push(paint(limb([0, 12, 0], [-1, 14.4, 3.3], 0.17, 0.08), BARK));
  parts.push(...crown([[0, 15.8, 0, 4.0], [3.6, 14.8, 1, 3.3], [-3.2, 15, -1.8, 3.3], [0.6, 15.1, -3.6, 3.0], [-1, 14.7, 3.3, 3.0]], [7, 5], [1.25, 0.62, 1.25], 7));
  // bromélias no tronco
  for (const [y, a] of [[6, 0.5], [9, 2.6]]) {
    const ox = Math.sin(a) * 0.5;
    const oz = Math.cos(a) * 0.5;
    for (let k = 0; k < 5; k++) {
      parts.push(paint(broadLeaf({ length: 0.5, width: 0.07, segs: 2, droop: 0.4, tilt: 1.1, angle: (k / 5) * Math.PI * 2, base: [ox, y, oz] }), k % 2 ? '#7a8a2e' : '#5d7a2c', 0, 0.3));
    }
  }
  parts.push(...lianas([[3, 13.5, 0.7]], 9));
  return merge(parts);
}
export function makeCanopyTreeLow() {
  return merge([
    trunk(0.32, 0.48, 13.4, 0.25, BARK, 5, 2, 4),
    ...[[3.6, 14.4, 1], [-3.2, 14.6, -1.8], [0.6, 14.6, -3.6], [-1, 14.4, 3.3]].map((b, i) => paint(limb([0, 10 + i * 0.6, 0], b, 0.2, 0.09, 4), BARK)),
    ...crownLow([[0, 15.8, 0, 4.0], [3.6, 14.8, 1, 3.3], [-3.2, 15, -1.8, 3.3], [0.6, 15.1, -3.6, 3.0], [-1, 14.7, 3.3, 3.0]], [1.25, 0.62, 1.25], 7),
  ]);
}

// Árvore do sub-bosque (≈ 8 m), fina
export function makeUnderstoryTree() {
  return merge([
    trunk(0.15, 0.22, 6.9, 0.1, BARK, 6, 3, 6),
    paint(limb([0, 5.6, 0], [0.9, 6.9, 0.5], 0.09, 0.05, 4), BARK),
    paint(limb([0, 5.9, 0], [-0.8, 7.1, -0.6], 0.09, 0.05, 4), BARK),
    ...crown([[0, 7.6, 0, 1.7], [0.9, 6.9, 0.5, 1.3], [-0.8, 7.1, -0.6, 1.25]], [6, 5], [1.1, 0.75, 1.1], 12),
  ]);
}
export function makeUnderstoryTreeLow() {
  return merge([
    trunk(0.16, 0.23, 6.9, 0.1, BARK, 5, 2, 6),
    ...crownLow([[0, 7.5, 0, 1.9]], [1.1, 0.75, 1.1], 12),
  ]);
}

// ------------------------------------------------------------
// Palmeiras: açaí (em touceira) e coqueiro (praia)
// ------------------------------------------------------------
function palmCrown(top, n, len, color, segs, leaf) {
  const parts = [];
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * Math.PI * 2 + (i % 2) * 0.35;
    parts.push(paint(pinnate({ length: len, leaf, width: 0.05, segs, droop: 0.8, tilt: 0.45 + (i % 3) * 0.15, angle: ang, base: top, hang: 0.45 }), color, 0.25));
  }
  return parts;
}

function stem(base, top, r0, r1, hex, radial = 5) {
  const g = limb(base, top, r0, r1, radial);
  return paint(g, hex, 0.2, 0.15);
}

export function makeAcai() {
  const parts = [];
  for (const [ox, oz, h, lean] of [[0, 0, 11, 0.06], [0.7, 0.4, 9, 0.16]]) {
    const top = [ox + Math.sin(lean) * h, Math.cos(lean) * h, oz];
    parts.push(stem([ox, 0, oz], top, 0.12, 0.08, '#77705a'));
    parts.push(paint(cyl(0.11, 0.1, 1.2, [top[0], top[1] - 1.1, top[2]], 5), '#6d5a3a'));
    parts.push(...palmCrown(top, 7, 2.8, '#3f6f2c', 6, 0.55));
    // cacho de açaí
    parts.push(paint(blob(0.25, [top[0] + 0.25, top[1] - 1.3, top[2]], [1, 1.4, 1], [5, 4], 0.4, 3), '#3b2440'));
  }
  return merge(parts);
}
export function makeAcaiLow() {
  const parts = [];
  for (const [ox, oz, h, lean] of [[0, 0, 11, 0.06], [0.7, 0.4, 9, 0.16]]) {
    const top = [ox + Math.sin(lean) * h, Math.cos(lean) * h, oz];
    parts.push(stem([ox, 0, oz], top, 0.12, 0.08, '#77705a', 3));
    for (let i = 0; i < 5; i++) parts.push(paint(broadLeaf({ length: 2.6, width: 0.35, segs: 2, droop: 0.8, tilt: 0.5, angle: (i / 5) * Math.PI * 2, base: top }), '#3f6f2c', 0, 1));
  }
  return merge(parts);
}

export function makeCoconutPalm() {
  const lean = 0.2;
  const top = [Math.sin(lean) * 7, Math.cos(lean) * 7, 0];
  const parts = [stem([0, 0, 0], top, 0.26, 0.15, '#8a7354', 7)];
  parts.push(...palmCrown(top, 9, 3.4, '#4f8a3c', 7, 0.7));
  for (const [dx, dz] of [[0.25, 0.1], [-0.15, 0.25], [0.05, -0.25]]) {
    parts.push(paint(new THREE.SphereGeometry(0.2, 6, 4).translate(top[0] + dx, top[1] - 0.35, dz), '#6b4a26'));
  }
  return merge(parts);
}
export function makeCoconutPalmLow() {
  const lean = 0.2;
  const top = [Math.sin(lean) * 7, Math.cos(lean) * 7, 0];
  const parts = [stem([0, 0, 0], top, 0.26, 0.15, '#8a7354', 4)];
  for (let i = 0; i < 6; i++) parts.push(paint(broadLeaf({ length: 3.2, width: 0.45, segs: 2, droop: 0.8, tilt: 0.45, angle: (i / 6) * Math.PI * 2, base: top }), '#4f8a3c', 0, 1));
  return merge(parts);
}

// ------------------------------------------------------------
// Bananeira (com e sem cacho de bananas)
// ------------------------------------------------------------
function bananaPlant(withBunch, low = false) {
  const top = [0, 2.6, 0];
  const parts = [];
  const trunk = cyl(0.13, 0.22, 2.7, [0, 0, 0], low ? 5 : 8);
  parts.push(paintFn(trunk, (c, x, y, z) => c.set(Math.sin(Math.atan2(z, x) * 5 + y * 3) > 0.3 ? '#5f6f35' : '#7a7a45'), 0.1));
  const n = low ? 6 : 9;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + (i % 2) * 0.4;
    parts.push(paint(broadLeaf({
      length: 2.3 + (i % 3) * 0.3, width: 0.42, segs: low ? 3 : 6, droop: 0.55, tilt: 0.85 + (i % 2) * 0.2,
      angle: a, base: top, tear: low ? 0 : 1,
    }), i % 3 === 0 ? '#5f8a35' : '#4c7a2e', 0.15));
  }
  if (withBunch) {
    // cacho: talo curvado, pencas de bananas e o "coração" roxo
    parts.push(paint(limb([0.15, 2.5, 0], [0.55, 2.3, 0], 0.04, 0.035, 4), '#6a6a3a'));
    parts.push(paint(limb([0.55, 2.3, 0], [0.62, 1.4, 0], 0.035, 0.03, 4), '#6a6a3a'));
    for (let k = 0; k < (low ? 3 : 5); k++) {
      const y = 2.15 - k * 0.17;
      for (let j = 0; j < (low ? 4 : 7); j++) {
        const a = (j / 7) * Math.PI * 2;
        const base = new THREE.Vector3(0.58 + Math.cos(a) * 0.06, y, Math.sin(a) * 0.06);
        const tip = base.clone().add(new THREE.Vector3(Math.cos(a) * 0.12, 0.13, Math.sin(a) * 0.12));
        const g = new THREE.ConeGeometry(0.035, 0.2, 5).rotateX(Math.PI);
        g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), tip.clone().sub(base).normalize()));
        g.translate(base.x, base.y, base.z);
        parts.push(paint(g, k < 2 ? '#d9c24a' : '#a9b546'));
      }
    }
    parts.push(paint(new THREE.ConeGeometry(0.1, 0.32, 7).rotateX(Math.PI).translate(0.62, 1.3, 0), '#6a2a3c'));
  }
  return merge(parts);
}
export const makeBananaTree = () => bananaPlant(true);
export const makeBananaTreeLow = () => bananaPlant(true, true);
export const makeBananaTreeEmpty = () => bananaPlant(false);
export const makeBananaTreeEmptyLow = () => bananaPlant(false, true);

// ------------------------------------------------------------
// Samambaias: gigante (4 m) e de chão
// ------------------------------------------------------------
export function makeTreeFern() {
  const trunk = cyl(0.13, 0.22, 3.3, [0, 0, 0], 7, 3);
  const parts = [paintFn(trunk, (c, x, y) => c.set(Math.sin(y * 9) > 0.2 ? '#3d2f22' : '#55412c'), 0.05)];
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2 + (i % 2) * 0.25;
    parts.push(paint(pinnate({ length: 2.4 + (i % 3) * 0.25, leaf: 0.42, width: 0.04, segs: 7, droop: 0.95, tilt: 0.85, angle: a, base: [0, 3.3, 0], hang: 0.2 }), i % 2 ? '#3f7a32' : '#4a8838', 0.2));
  }
  // brotos enrolados no meio
  parts.push(paint(new THREE.TorusGeometry(0.08, 0.03, 4, 8).rotateX(Math.PI / 2).translate(0, 3.45, 0), '#6b8a3a', 0, 0.4));
  return merge(parts);
}
export function makeTreeFernLow() {
  const parts = [paint(cyl(0.14, 0.22, 3.3, [0, 0, 0], 4), '#46372a')];
  for (let i = 0; i < 7; i++) parts.push(paint(broadLeaf({ length: 2.4, width: 0.35, segs: 3, droop: 0.9, tilt: 0.8, angle: (i / 7) * Math.PI * 2, base: [0, 3.3, 0] }), '#437f35', 0, 1));
  return merge(parts);
}

export function makeFern() {
  const parts = [];
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + (i % 2) * 0.2;
    parts.push(paint(pinnate({ length: 1.2 + (i % 3) * 0.18, leaf: 0.26, width: 0.03, segs: 5, droop: 1.0, tilt: 1.0, angle: a, base: [0, 0.02, 0], hang: 0.15 }), i % 2 ? '#3f7a32' : '#4a8a3a', 0.4));
  }
  return merge(parts);
}

// ------------------------------------------------------------
// Arbustos de bagas e frutas
// ------------------------------------------------------------
function bushBase(leaf, seed) {
  const c = new THREE.Color(leaf);
  const colors = [leaf, `#${c.clone().multiplyScalar(1.12).getHexString()}`, `#${c.clone().multiplyScalar(0.88).getHexString()}`];
  return leafCards([[0, 0.62, 0, 0.85], [0.6, 0.5, 0.25, 0.62], [-0.5, 0.47, -0.35, 0.58]], {
    squash: [1.25, 0.8, 1.25], perSpot: 6, minCards: 4, size: 1.1, colors, seed, wind: 0.6, core: 0.72,
  });
}
function berries(colors, count, seed, size = 0.06) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const a = hash3(i, seed, 1, 2) * Math.PI * 2;
    const y = 0.4 + hash3(i, seed, 2, 3) * 0.75;
    const r = 0.85 + hash3(i, seed, 3, 4) * 0.35;
    const x = Math.cos(a) * r * (1.1 - (y - 0.4) * 0.5);
    const z = Math.sin(a) * r * (1.1 - (y - 0.4) * 0.5);
    // cachinho de 3 bagas
    for (let k = 0; k < 3; k++) {
      out.push(paint(new THREE.OctahedronGeometry(size, 0).translate(x + (k - 1) * size * 1.4, y - k * size * 0.8, z), colors[(i + k) % colors.length], 0, 0.8));
    }
  }
  return out;
}
export const makeBushEmpty = () => merge(bushBase('#3c6630', 51));
export const makeMejoBush = () => merge([...bushBase('#3c6630', 51), ...berries(['#4549a8', '#5a4fb8', '#3b3f94'], 12, 1)]);
export const makeDarkBush = () => merge([...bushBase('#30522a', 61), ...berries(['#1f1b28', '#2c2238', '#191720'], 12, 2)]);
export const makeFruitBush = () => merge([...bushBase('#467233', 71), ...berries(['#b8342b', '#c43f2e'], 6, 3, 0.09), ...berries(['#3d6fb5', '#4a7cc4'], 5, 4, 0.08)]);

// ------------------------------------------------------------
// Tronco caído (com musgo e cogumelos) e pedra com musgo
// ------------------------------------------------------------
export function makeFallenLog(low = false) {
  const len = 9;
  const g = new THREE.CylinderGeometry(0.36, 0.48, len, low ? 6 : 10, low ? 1 : 4, false);
  g.rotateZ(Math.PI / 2);
  g.translate(0, 0.32, 0);
  // casca + musgo em cima
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const f = 1 + (hash3(pos.getX(i), pos.getY(i), pos.getZ(i), 9) - 0.5) * 0.12;
    pos.setY(i, 0.32 + (pos.getY(i) - 0.32) * f);
  }
  g.computeVertexNormals();
  const parts = [paintFn(g, (c, x, y, z, nx, ny) => {
    c.set(ny > 0.45 ? '#4d6a2c' : '#5a4632');
    if (Math.abs(x) > len / 2 - 0.05) c.set('#8a6c48'); // madeira nas pontas
  })];
  if (!low) {
    parts.push(paint(limb([1.5, 0.6, 0.2], [2.2, 1.4, 0.7], 0.08, 0.04, 4), BARK));
    parts.push(paint(limb([-2, 0.6, -0.2], [-2.6, 1.2, -0.9], 0.07, 0.03, 4), BARK));
    // raízes na ponta grossa
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      parts.push(paint(limb([-len / 2, 0.32, 0], [-len / 2 - 0.5, 0.32 + Math.sin(a) * 0.9, Math.cos(a) * 0.9], 0.1, 0.03, 4), '#4a3a28'));
    }
    // cogumelos
    for (const [x, z] of [[0.8, 0.42], [1.2, 0.38], [-1.4, -0.4], [2.9, 0.3]]) {
      parts.push(paint(cyl(0.025, 0.03, 0.12, [x, 0.32 + Math.abs(z) * 0.3, z], 4), '#e8dcc0'));
      parts.push(paint(new THREE.SphereGeometry(0.08, 6, 3, 0, Math.PI * 2, 0, Math.PI / 2).translate(x, 0.44 + Math.abs(z) * 0.3, z), '#c46a2c'));
    }
  }
  return merge(parts);
}
export const makeFallenLogLow = () => makeFallenLog(true);

export function makeMossRock(low = false) {
  const g = blob(1, [0, 0, 0], [1, 0.72, 1], low ? [5, 4] : [10, 7], 0.42, 61);
  g.computeVertexNormals();
  g.translate(0, 0.28, 0);
  const m = merge([paintFn(g, (c, x, y, z, nx, ny) => {
    c.set(ny > 0.55 ? '#4a6430' : '#7a766c');
    c.multiplyScalar(0.85 + hash3(x, y, z, 2) * 0.25);
  })]);
  // pedra usa o pedaço "liso" de baixo (sem casca de árvore)
  const uv = m.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, WHITE_UV[0], 0.55);
  return m;
}
export const makeMossRockLow = () => makeMossRock(true);

// ------------------------------------------------------------
// Lapônia: pinheiro nevado, rochedo e minério de ferro
// ------------------------------------------------------------
const SNOW_HEX = '#e4eaee';

// Pinheiro (abeto) com neve em cima dos galhos – ≈ 14 m
export function makeSpruce(low = false) {
  const parts = [paint(cyl(0.12, 0.32, 13, [0, 0, 0], low ? 5 : 7), '#4a3a2c', 0.2)];
  const tiers = low ? 4 : 7;
  for (let i = 0; i < tiers; i++) {
    const k = i / (tiers - 1);
    const r = 3.0 * (1 - k * 0.82);
    const h = 3.4 - k * 1.4;
    const y = 2.2 + k * 10.6;
    const g = new THREE.ConeGeometry(r, h, low ? 7 : 11, 1, true);
    g.translate(0, y + h / 2, 0);
    // pontas dos galhos caídas e irregulares
    const pos = g.attributes.position;
    for (let v = 0; v < pos.count; v++) {
      if (pos.getY(v) < y + 0.05) {
        const a = Math.atan2(pos.getZ(v), pos.getX(v));
        pos.setY(v, pos.getY(v) - 0.35 - Math.sin(a * 5 + i) * 0.25);
      }
    }
    g.computeVertexNormals();
    // neve só em cima de cada "andar" de galhos, em manchas
    parts.push(paintFn(g, (c, px, py, pz) => {
      const top = (py - y) / h;
      const snowy = top > 0.62 || (top > 0.25 && hash3(Math.round(px * 3), Math.round(py * 3), Math.round(pz * 3), 7) > 0.62);
      if (snowy) c.set(SNOW_HEX);
      else c.set('#24382a').multiplyScalar(0.8 + hash3(px, py, pz, 5) * 0.35);
    }, 0.25));
  }
  return merge(parts);
}
export const makeSpruceLow = () => makeSpruce(true);

// Rochedo grande e quebrado (não liso), com neve em cima
export function makeBoulder(seed = 3) {
  const g = new THREE.IcosahedronGeometry(1, 2).toNonIndexed();
  const pos = g.attributes.position;
  // cada vértice vai para fora/dentro de um jeito diferente: facetas e lascas
  const key = (x, y, z) => `${x.toFixed(3)},${y.toFixed(3)},${z.toFixed(3)}`;
  const moved = new Map();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const k = key(x, y, z);
    if (!moved.has(k)) {
      const f = 0.72 + hash3(x, y, z, seed) * 0.5;
      moved.set(k, [x * f * 1.25, Math.max(-0.35, y * f * 0.8), z * f]);
    }
    const [nx, ny, nz] = moved.get(k);
    pos.setXYZ(i, nx, ny, nz);
  }
  g.translate(0, 0.3, 0);
  g.computeVertexNormals();
  const m = merge([paintFn(g, (c, x, y, z, nx, ny) => {
    c.set(ny > 0.62 ? SNOW_HEX : '#6c6862');
    if (ny <= 0.62) c.multiplyScalar(0.72 + hash3(x, y, z, 9) * 0.4);
  })]);
  const uv = m.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, WHITE_UV[0], 0.55);
  return m;
}
export const makeBoulderLow = () => makeBoulder(3);

// Veio de minério de ferro: rocha escura com manchas cor de ferrugem
export function makeIronOre() {
  const g = new THREE.IcosahedronGeometry(1, 1).toNonIndexed();
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const f = 0.8 + hash3(Math.round(x * 50), Math.round(y * 50), Math.round(z * 50), 4) * 0.35;
    pos.setXYZ(i, x * f * 1.1, Math.max(-0.3, y * f * 0.75), z * f);
  }
  g.translate(0, 0.25, 0);
  g.computeVertexNormals();
  const m = merge([paintFn(g, (c, x, y, z, nx, ny) => {
    const h = hash3(Math.round(x * 6), Math.round(y * 6), Math.round(z * 6), 2);
    if (ny > 0.75) c.set(SNOW_HEX);
    else if (h > 0.55) c.set(h > 0.8 ? '#b0662e' : '#8c4a26'); // ferrugem
    else c.set('#3e3a36').multiplyScalar(0.85 + h * 0.4);
  })]);
  const uv = m.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, WHITE_UV[0], 0.55);
  return m;
}

// Pedrinhas soltas no chão (pega com Interagir)
export function makePebbles() {
  const parts = [];
  const spots = [[0, 0, 0.16], [0.24, 0.1, 0.11], [-0.18, 0.16, 0.09], [0.06, -0.22, 0.12]];
  spots.forEach(([x, z, r], i) => {
    const g = blob(r, [x, r * 0.45, z], [1.2, 0.7, 1], [6, 4], 0.35, 70 + i);
    g.computeVertexNormals();
    parts.push(paintFn(g, (c, px, py, pz) => {
      c.set(i % 2 ? '#8c877c' : '#6f6a60');
      c.multiplyScalar(0.85 + hash3(px, py, pz, 3) * 0.3);
    }));
  });
  const m = merge(parts);
  const uv = m.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, WHITE_UV[0], 0.55);
  return m;
}

// Gravetos secos caídos (pega com Interagir)
export function makeSticks() {
  return merge([
    paint(limb([-0.45, 0.04, -0.1], [0.5, 0.05, 0.12], 0.03, 0.018, 4), '#6e5236', 0.2),
    paint(limb([-0.25, 0.06, 0.3], [0.32, 0.04, -0.28], 0.025, 0.015, 4), '#7d5f3e', 0.2),
    paint(limb([0.1, 0.05, 0.05], [0.28, 0.08, 0.3], 0.014, 0.008, 3), '#6e5236', 0.2),
    paint(limb([-0.05, 0.03, -0.32], [0.18, 0.05, -0.05], 0.018, 0.01, 3), '#5f4630', 0.2),
  ]);
}

// ------------------------------------------------------------
// Pântano: mangue, árvore morta, junco, taboa, vitória-régia
// ------------------------------------------------------------
export function makeMangrove() {
  const parts = [paint(cyl(0.18, 0.26, 4.5, [0, 1.4, 0], 6), '#4f4434', 0.3)];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const ox = Math.sin(a) * 1.4;
    const oz = Math.cos(a) * 1.4;
    parts.push(paint(limb([ox, -0.3, oz], [ox * 0.45, 1.3, oz * 0.45], 0.07, 0.09, 4), '#4a3f30'));
    parts.push(paint(limb([ox * 0.45, 1.3, oz * 0.45], [0, 2.2, 0], 0.09, 0.12, 4), '#4a3f30'));
  }
  parts.push(...crown([[0, 6.3, 0, 1.7], [0.9, 5.7, 0.4, 1.2], [-0.8, 5.9, -0.6, 1.2]], [7, 5], [1.2, 0.7, 1.2], 31));
  return merge(parts);
}
export function makeMangroveLow() {
  return merge([
    paint(cyl(0.2, 0.35, 5.5, [0, 0, 0], 5), '#4f4434'),
    ...crownLow([[0, 6.2, 0, 1.9]], [1.2, 0.7, 1.2], 31),
  ]);
}

export function makeDeadTree() {
  const parts = [
    paint(cyl(0.16, 0.3, 6, [0, 0, 0], 6), '#6b6256', 0.3),
    paint(limb([0, 3.2, 0], [1.6, 5.2, 0.4], 0.12, 0.04), '#6b6256'),
    paint(limb([0, 4.2, 0], [-1.3, 6.1, -0.5], 0.1, 0.03), '#6b6256'),
    paint(limb([0, 5.2, 0], [0.3, 7.0, 1.1], 0.08, 0.03), '#6b6256'),
  ];
  // barba-de-velho pendurada
  for (const [x, y, z] of [[1.2, 4.8, 0.3], [-1, 5.6, -0.4]]) {
    parts.push(paint(broadLeaf({ length: 1.0, width: 0.08, segs: 2, droop: 3, tilt: -1.4, angle: 0.5, base: [x, y, z] }), '#7c8460', 0, 0.8));
  }
  return merge(parts);
}

export function makeReeds() {
  const parts = [];
  for (let i = 0; i < 11; i++) {
    const a = i * 2.4;
    const r = 0.15 + (i % 3) * 0.12;
    const h = 1.4 + (i % 4) * 0.35;
    const x = Math.sin(a) * r;
    const z = Math.cos(a) * r;
    parts.push(paint(limb([x, -0.2, z], [x * 2.2, h, z * 2.2], 0.03, 0.01, 3), i % 2 ? '#7d7f45' : '#6a7a3a', 0.4, 'altura'));
  }
  return merge(parts);
}

export function makeCattail() {
  const parts = [];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    parts.push(paint(broadLeaf({ length: 1.7, width: 0.05, segs: 3, droop: 0.25, tilt: 1.3, angle: a, base: [0, 0, 0] }), '#5d7a34', 0.3));
  }
  for (const [x, z, h] of [[0.05, 0, 1.9], [-0.08, 0.06, 1.7], [0.02, -0.08, 2.0]]) {
    parts.push(paint(limb([x, 0, z], [x, h, z], 0.015, 0.012, 3), '#6a7a3a', 0, 'altura'));
    parts.push(paint(cyl(0.045, 0.045, 0.3, [x, h - 0.45, z], 6), '#5a3a22', 0, 1));
  }
  return merge(parts);
}

export function makeWaterLily() {
  const pad = new THREE.CircleGeometry(1, 16).rotateX(-Math.PI / 2);
  const rim = new THREE.CylinderGeometry(1.0, 0.96, 0.1, 16, 1, true).translate(0, 0.05, 0);
  const parts = [
    paintFn(pad, (c, x, y, z) => c.set(Math.sin(Math.atan2(z, x) * 16) > 0.85 ? '#3c6a2c' : '#4f8a36'), 0.1),
    paint(rim, '#8a3a34', 0, 0.1),
    paint(new THREE.CircleGeometry(0.45, 10).rotateX(-Math.PI / 2).translate(1.2, 0.01, 0.6), '#4f8a36', 0, 0.2),
  ];
  // flor
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    parts.push(paint(broadLeaf({ length: 0.22, width: 0.07, segs: 2, droop: -0.2, tilt: 0.8, angle: a, base: [-0.4, 0.05, -0.3] }), '#f0d8e0', 0, 0.2));
  }
  return merge(parts);
}

// ------------------------------------------------------------
// Mato do chão (perto do jogador)
// ------------------------------------------------------------
export function makeGrassTuft() {
  const verts = [];
  const winds = [];
  const cols = [];
  const base = new THREE.Color('#3f5a2a');
  const tip = new THREE.Color('#8aa652');
  const idx = [];
  for (let i = 0; i < 7; i++) {
    const a = i * 2.39;
    const r = 0.08 + (i % 3) * 0.05;
    const x = Math.sin(a) * r;
    const z = Math.cos(a) * r;
    const h = 0.32 + (i % 4) * 0.09;
    const lean = 0.1 + (i % 2) * 0.08;
    const w = 0.035;
    const px = Math.cos(a) * w;
    const pz = -Math.sin(a) * w;
    const b = verts.length / 3;
    verts.push(x - px, 0, z - pz, x + px, 0, z + pz, x + Math.sin(a) * lean, h, z + Math.cos(a) * lean);
    winds.push(0, 0, 1);
    cols.push(base.r, base.g, base.b, base.r, base.g, base.b, tip.r, tip.g, tip.b);
    idx.push(b, b + 1, b + 2, b + 1, b, b + 2);
  }
  const g = sheet(verts, idx, winds);
  g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  g.computeBoundingSphere();
  return g;
}

// Plantinha de folhas largas (tipo "orelha-de-elefante")
export function makeBroadPlant() {
  const parts = [];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.3;
    parts.push(paint(broadLeaf({ length: 0.55 + (i % 2) * 0.15, width: 0.2, segs: 3, droop: 0.9, tilt: 1.0, angle: a, base: [0, 0.03, 0] }), i % 2 ? '#2f6a2c' : '#3d7a34', 0.35));
  }
  return merge(parts);
}

// Brotinho de samambaia
export function makeSprout() {
  const parts = [];
  for (let i = 0; i < 5; i++) {
    parts.push(paint(pinnate({ length: 0.5, leaf: 0.12, width: 0.015, segs: 3, droop: 1.1, tilt: 1.1, angle: (i / 5) * Math.PI * 2, base: [0, 0.02, 0], hang: 0.1 }), '#4c8a3a', 0.3));
  }
  return merge(parts);
}
