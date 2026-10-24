// =============================================================
// MODELOS DA VEGETAÇÃO E PEDRAS (feitos por código, originais)
// Formas arredondadas com luz suave e sombreado nas partes de baixo
// (dá volume). Cada modelo tem duas versões:
//   - perto: mais detalhes
//   - longe: bem simples (o celular desenha muito menos)
// =============================================================
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Número "aleatório" fixo a partir de uma posição (mesmo ponto = mesmo valor).
function hash3(x, y, z, seed) {
  const h = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719 + seed * 4.1) * 43758.5453;
  return h - Math.floor(h);
}

// Pinta a geometria. "shade" escurece a parte de baixo (volume).
function paint(geometry, hex, shade = 0) {
  const g = geometry.index ? geometry : geometry; // mantém indexado
  if (g.attributes.uv) g.deleteAttribute('uv');
  const color = new THREE.Color(hex);
  const pos = g.attributes.position;
  g.computeBoundingBox();
  const { min, max } = g.boundingBox;
  const span = Math.max(0.001, max.y - min.y);
  const arr = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const t = (pos.getY(i) - min.y) / span;
    const f = 1 - shade + shade * 1.25 * t;
    arr[i * 3] = color.r * f;
    arr[i * 3 + 1] = color.g * f;
    arr[i * 3 + 2] = color.b * f;
  }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}

// Bolha irregular (copa de árvore, arbusto, pedra).
function blob(r, [x, y, z], [sx, sy, sz] = [1, 1, 1], seg = [8, 6], rough = 0.28, seed = 1) {
  const g = new THREE.SphereGeometry(r, seg[0], seg[1]);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i);
    const py = pos.getY(i);
    const pz = pos.getZ(i);
    const f = 1 + (hash3(px, py, pz, seed) - 0.5) * rough;
    pos.setXYZ(i, px * f * sx, py * f * sy, pz * f * sz);
  }
  g.translate(x, y, z);
  return g;
}

function cyl(rTop, rBottom, h, [x, y, z], radial = 7) {
  return new THREE.CylinderGeometry(rTop, rBottom, h, radial, 1, true).translate(x, y + h / 2, z);
}

// Galho/tronco entre dois pontos.
function limb(a, b, r0, r1, radial = 5) {
  const A = new THREE.Vector3(...a);
  const B = new THREE.Vector3(...b);
  const len = A.distanceTo(B);
  const g = new THREE.CylinderGeometry(r1, r0, len, radial, 1, true);
  g.translate(0, len / 2, 0);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
  g.applyQuaternion(q);
  g.translate(A.x, A.y, A.z);
  return g;
}

// Folha comprida e curvada (palmeira, samambaia). Visível dos dois lados.
function frond(length, width, droop, angle, tilt, base = [0, 0, 0], segs = 6) {
  const verts = [];
  const idx = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const px = t * length;
    const py = Math.sin(tilt) * t * length - droop * t * t * length;
    const w = width * Math.pow(Math.sin(Math.PI * Math.min(0.98, t * 0.9 + 0.05)), 0.7);
    verts.push(px, py, -w, px, py + w * 0.15, w);
  }
  for (let i = 0; i < segs; i++) {
    const a = i * 2;
    idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); // frente
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); // verso
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  g.setIndex(idx);
  const normals = new Float32Array(verts.length);
  for (let i = 1; i < normals.length; i += 3) normals[i] = 1; // luz como se fosse "para cima"
  g.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  g.rotateY(angle);
  g.translate(...base);
  return g;
}

function merge(parts) {
  for (const p of parts) {
    if (p.attributes.uv) p.deleteAttribute('uv');
    if (!p.index) {
      const n = p.attributes.position.count;
      p.setIndex([...Array(n).keys()]);
    }
  }
  const g = mergeGeometries(parts, false);
  g.computeBoundingSphere();
  return g;
}

const BARK = '#5e4630';
const BARK_LIGHT = '#7a6248';

// ------------------------------------------------------------
// Árvore comum (floresta/campina)
// ------------------------------------------------------------
export function makeBroadleafTree() {
  return merge([
    paint(cyl(0.2, 0.36, 3.6, [0, 0, 0]), BARK, 0.3),
    paint(limb([0, 2.6, 0], [0.9, 3.8, 0.3], 0.13, 0.07), BARK),
    paint(blob(1.7, [0, 4.6, 0], [1.1, 0.85, 1.1], [8, 6], 0.3, 1), '#3f6b2e', 0.45),
    paint(blob(1.2, [1.0, 4.1, 0.5], [1, 0.8, 1], [6, 5], 0.3, 2), '#4a7834', 0.45),
    paint(blob(1.15, [-0.8, 4.3, -0.6], [1, 0.8, 1], [6, 5], 0.3, 3), '#3a6229', 0.45),
    paint(blob(1.0, [0.1, 5.5, -0.2], [1, 0.8, 1], [6, 5], 0.3, 4), '#4f7f37', 0.4),
  ]);
}
export function makeBroadleafTreeLow() {
  return merge([
    paint(cyl(0.22, 0.34, 3.6, [0, 0, 0], 5), BARK),
    paint(blob(2.1, [0, 4.6, 0], [1.1, 0.9, 1.1], [6, 4], 0.25, 1), '#40682e', 0.4),
  ]);
}

// ------------------------------------------------------------
// Pinheiro (montanha)
// ------------------------------------------------------------
function pineCone(r, h, y, hex, seed) {
  const g = new THREE.ConeGeometry(r, h, 9, 2, true);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    if (pos.getY(i) < h / 2 - 0.01) {
      const f = 1 + (hash3(pos.getX(i), pos.getY(i), pos.getZ(i), seed) - 0.5) * 0.35;
      pos.setX(i, pos.getX(i) * f);
      pos.setZ(i, pos.getZ(i) * f);
    }
  }
  g.computeVertexNormals();
  return paint(g.translate(0, y, 0), hex, 0.5);
}
export function makePineTree() {
  return merge([
    paint(cyl(0.14, 0.3, 3, [0, 0, 0]), BARK, 0.3),
    pineCone(1.9, 3.0, 3.0, '#2c4f30', 1),
    pineCone(1.5, 2.6, 4.5, '#315733', 2),
    pineCone(1.05, 2.2, 5.9, '#365f38', 3),
    pineCone(0.6, 1.6, 7.1, '#3b663c', 4),
  ]);
}
export function makePineTreeLow() {
  return merge([
    paint(cyl(0.16, 0.3, 2.4, [0, 0, 0], 5), BARK),
    paint(new THREE.ConeGeometry(1.8, 6.2, 6).translate(0, 4.6, 0), '#2f5532', 0.4),
  ]);
}

// ------------------------------------------------------------
// Palmeira (praia) e palmeira menor (selva)
// ------------------------------------------------------------
function palm(height, lean, frondLen, nFronds, frondColor, low = false) {
  const top = [Math.sin(lean) * height, Math.cos(lean) * height, 0];
  const parts = [];
  const trunk = limb([0, 0, 0], top, 0.26, 0.15, low ? 5 : 7);
  // anéis no tronco (faixas claras e escuras)
  const pos = trunk.attributes.position;
  const col = new Float32Array(pos.count * 3);
  const a = new THREE.Color(BARK_LIGHT);
  const b = new THREE.Color('#5a4631');
  for (let i = 0; i < pos.count; i++) {
    const c = Math.sin(pos.getY(i) * 7) > 0 ? a : b;
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  trunk.deleteAttribute('uv');
  trunk.setAttribute('color', new THREE.BufferAttribute(col, 3));
  parts.push(trunk);
  const n = low ? Math.min(5, nFronds) : nFronds;
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * Math.PI * 2 + (i % 2) * 0.3;
    parts.push(paint(frond(frondLen, 0.42, 0.75, ang, 0.35 + (i % 3) * 0.12, top, low ? 3 : 5), frondColor, 0.35));
  }
  if (!low) {
    parts.push(paint(blob(0.35, [top[0], top[1] - 0.25, 0], [1, 1, 1], [6, 4], 0.2, 7), '#6b5530'));
  }
  return merge(parts);
}
export const makePalmTree = () => palm(6, 0.18, 3.2, 9, '#4f8a3c');
export const makePalmTreeLow = () => palm(6, 0.18, 3.2, 9, '#4f8a3c', true);
export const makeJunglePalm = () => palm(4.2, 0.08, 2.6, 8, '#3f7631');
export const makeJunglePalmLow = () => palm(4.2, 0.08, 2.6, 8, '#3f7631', true);

// ------------------------------------------------------------
// Floresta Amazônica: árvore gigante (com raízes de apoio) e média
// ------------------------------------------------------------
export function makeGiantTree() {
  const parts = [paint(cyl(0.55, 0.95, 17, [0, 0, 0], 9), '#6a5640', 0.35)];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    // raízes de apoio (sapopemas)
    const root = new THREE.BoxGeometry(0.22, 2.8, 2.2).translate(0, 1.3, 1.1);
    root.rotateY(a);
    parts.push(paint(root, '#5f4b37', 0.3));
  }
  parts.push(paint(limb([0, 13, 0], [2.6, 16.5, 0.5], 0.3, 0.16), '#6a5640'));
  parts.push(paint(limb([0, 14, 0], [-2.2, 17, -1.2], 0.3, 0.16), '#6a5640'));
  const greens = ['#2f5524', '#36602a', '#2b4d21', '#3c672d', '#325a26'];
  const spots = [[0, 18.5, 0, 3.2], [2.8, 17.4, 0.8, 2.4], [-2.6, 17.6, -1.2, 2.5], [0.6, 17.2, -2.8, 2.2], [-0.8, 17.0, 2.6, 2.2]];
  spots.forEach(([x, y, z, r], i) => {
    parts.push(paint(blob(r, [x, y, z], [1.2, 0.55, 1.2], [7, 5], 0.32, 10 + i), greens[i], 0.5));
  });
  return merge(parts);
}
export function makeGiantTreeLow() {
  return merge([
    paint(cyl(0.6, 0.95, 17, [0, 0, 0], 5), '#6a5640'),
    paint(blob(4.6, [0, 18, 0], [1.2, 0.5, 1.2], [7, 4], 0.25, 3), '#30562a', 0.4),
  ]);
}

export function makeJungleTree() {
  return merge([
    paint(cyl(0.25, 0.42, 7.5, [0, 0, 0], 7), '#5c4a36', 0.3),
    paint(blob(2.0, [0, 8.4, 0], [1.2, 0.6, 1.2], [7, 5], 0.32, 21), '#355f28', 0.5),
    paint(blob(1.5, [1.2, 7.6, 0.6], [1, 0.6, 1], [6, 4], 0.3, 22), '#3e6a2d', 0.5),
    paint(blob(1.4, [-1.1, 7.9, -0.7], [1, 0.6, 1], [6, 4], 0.3, 23), '#2e5524', 0.5),
    // cipós pendurados
    paint(limb([1.4, 7.2, 0.4], [1.5, 3.2, 0.5], 0.04, 0.03, 3), '#3b4a24'),
    paint(limb([-1.0, 7.4, -0.6], [-1.05, 4.2, -0.7], 0.04, 0.03, 3), '#3b4a24'),
  ]);
}
export function makeJungleTreeLow() {
  return merge([
    paint(cyl(0.26, 0.4, 7.5, [0, 0, 0], 5), '#5c4a36'),
    paint(blob(2.5, [0, 8.2, 0], [1.2, 0.6, 1.2], [6, 4], 0.25, 21), '#335c27', 0.4),
  ]);
}

// Samambaia (chão da selva)
export function makeFern() {
  const parts = [];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + (i % 2) * 0.2;
    parts.push(paint(frond(1.3 + (i % 3) * 0.2, 0.24, 0.9, a, 0.9, [0, 0.05, 0], 3), i % 2 ? '#3f7a32' : '#4a8a3a', 0.5));
  }
  return merge(parts);
}

// ------------------------------------------------------------
// Pântano: mangue (raízes em arco), árvore morta e junco
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
  parts.push(paint(blob(1.6, [0, 6.3, 0], [1.2, 0.7, 1.2], [8, 6], 0.3, 31), '#4b5e2e', 0.5));
  parts.push(paint(blob(1.1, [0.9, 5.7, 0.4], [1, 0.7, 1], [7, 5], 0.3, 32), '#566a33', 0.5));
  return merge(parts);
}
export function makeMangroveLow() {
  return merge([
    paint(cyl(0.2, 0.35, 5.5, [0, 0, 0], 5), '#4f4434'),
    paint(blob(1.9, [0, 6.2, 0], [1.2, 0.7, 1.2], [6, 4], 0.25, 31), '#4b5e2e', 0.4),
  ]);
}

export function makeDeadTree() {
  return merge([
    paint(cyl(0.16, 0.3, 6, [0, 0, 0], 6), '#6b6256', 0.3),
    paint(limb([0, 3.2, 0], [1.6, 5.2, 0.4], 0.12, 0.04), '#6b6256'),
    paint(limb([0, 4.2, 0], [-1.3, 6.1, -0.5], 0.1, 0.03), '#6b6256'),
    paint(limb([0, 5.2, 0], [0.3, 7.0, 1.1], 0.08, 0.03), '#6b6256'),
    paint(limb([1.0, 4.5, 0.25], [1.7, 4.4, 1.2], 0.05, 0.02, 3), '#6b6256'),
  ]);
}

export function makeReeds() {
  const parts = [];
  for (let i = 0; i < 9; i++) {
    const a = i * 2.4;
    const r = 0.15 + (i % 3) * 0.12;
    const h = 1.4 + (i % 4) * 0.35;
    const x = Math.sin(a) * r;
    const z = Math.cos(a) * r;
    parts.push(paint(limb([x, -0.2, z], [x * 2.2, h, z * 2.2], 0.035, 0.012, 3), i % 2 ? '#7d7f45' : '#6a7a3a', 0.4));
    if (i % 3 === 0) parts.push(paint(cyl(0.05, 0.05, 0.35, [x * 2.1, h - 0.45, z * 2.1], 5), '#5a3f28'));
  }
  return merge(parts);
}

// ------------------------------------------------------------
// Deserto: cacto e arbusto seco
// ------------------------------------------------------------
export function makeCactus() {
  const ribbed = (g) => {
    // listras verticais claras/escuras (gomos do cacto)
    const pos = g.attributes.position;
    const col = new Float32Array(pos.count * 3);
    const a = new THREE.Color('#5f7d48');
    const b = new THREE.Color('#4a653a');
    for (let i = 0; i < pos.count; i++) {
      const ang = Math.atan2(pos.getZ(i), pos.getX(i));
      const c = Math.cos(ang * 8) > 0 ? a : b;
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    if (g.attributes.uv) g.deleteAttribute('uv');
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return g;
  };
  return merge([
    ribbed(new THREE.CapsuleGeometry(0.32, 3.6, 3, 10).translate(0, 2.1, 0)),
    ribbed(new THREE.CapsuleGeometry(0.2, 0.9, 3, 8).rotateZ(Math.PI / 2).translate(0.6, 1.7, 0)),
    ribbed(new THREE.CapsuleGeometry(0.2, 1.3, 3, 8).translate(1.05, 2.4, 0)),
    ribbed(new THREE.CapsuleGeometry(0.18, 0.7, 3, 8).rotateZ(Math.PI / 2).translate(-0.5, 2.5, 0)),
    ribbed(new THREE.CapsuleGeometry(0.18, 0.9, 3, 8).translate(-0.85, 3.0, 0)),
  ]);
}

export function makeDryBush() {
  return merge([
    paint(blob(0.7, [0, 0.45, 0], [1.3, 0.7, 1.3], [7, 5], 0.45, 41), '#8a7a4e', 0.5),
    paint(blob(0.45, [0.5, 0.35, 0.3], [1, 0.8, 1], [6, 4], 0.45, 42), '#7a6c42', 0.5),
  ]);
}

// ------------------------------------------------------------
// Arbusto com frutinhas e pedras
// ------------------------------------------------------------
export function makeBush() {
  const berries = [[0.6, 0.8, 0.3], [-0.5, 0.9, 0.4], [0.1, 1.0, -0.6], [-0.3, 0.6, -0.65], [0.55, 0.55, -0.4]]
    .map(([x, y, z]) => paint(new THREE.SphereGeometry(0.09, 5, 4).translate(x, y, z), '#b8322e'));
  return merge([
    paint(blob(0.9, [0, 0.55, 0], [1.3, 0.8, 1.3], [8, 6], 0.32, 51), '#46783a', 0.5),
    paint(blob(0.6, [0.6, 0.45, 0.2], [1, 0.8, 1], [7, 5], 0.3, 52), '#3f6e33', 0.5),
    ...berries,
  ]);
}

function rock(hex, seed) {
  const g = blob(1, [0, 0, 0], [1, 0.7, 1], [9, 7], 0.45, seed);
  g.computeVertexNormals();
  g.translate(0, 0.28, 0);
  return paint(g, hex, 0.35);
}
export const makeRock = () => rock('#8a857b', 61);
export const makeRockLow = () => paint(blob(1, [0, 0.28, 0], [1, 0.7, 1], [5, 4], 0.4, 61), '#8a857b', 0.3);
export const makeDesertRock = () => rock('#b48a5c', 62);
export const makeDesertRockLow = () => paint(blob(1, [0, 0.28, 0], [1, 0.7, 1], [5, 4], 0.4, 62), '#b48a5c', 0.3);

// ------------------------------------------------------------
// Tufo de grama (usado pela grama perto do jogador)
// ------------------------------------------------------------
export function makeGrassTuft() {
  const verts = [];
  const cols = [];
  const base = new THREE.Color('#5d7d3a');
  const tip = new THREE.Color('#a9bd66');
  for (let i = 0; i < 7; i++) {
    const a = i * 2.39;
    const r = 0.08 + (i % 3) * 0.05;
    const x = Math.sin(a) * r;
    const z = Math.cos(a) * r;
    const h = 0.28 + (i % 4) * 0.07;
    const lean = 0.08 + (i % 2) * 0.07;
    const w = 0.035;
    const px = Math.cos(a) * w;
    const pz = -Math.sin(a) * w;
    const A = [x - px, 0, z - pz];
    const B = [x + px, 0, z + pz];
    const C = [x + Math.sin(a) * lean, h, z + Math.cos(a) * lean];
    // frente e verso (as duas faces iluminadas igual)
    verts.push(...A, ...B, ...C, ...B, ...A, ...C);
    for (let k = 0; k < 2; k++) cols.push(base.r, base.g, base.b, base.r, base.g, base.b, tip.r, tip.g, tip.b);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  const normals = new Float32Array(verts.length);
  for (let i = 1; i < normals.length; i += 3) normals[i] = 1; // iluminada como o chão
  g.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  g.computeBoundingSphere();
  return g;
}
