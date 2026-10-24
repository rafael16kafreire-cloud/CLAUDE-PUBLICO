// =============================================================
// MODELOS LOW-POLY (placeholders originais feitos com formas
// simples). Cada modelo é uma única geometria com cores por
// vértice, para poder desenhar centenas de uma vez (instancing).
// Troque por modelos próprios no futuro mantendo os mesmos nomes.
// =============================================================
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Pinta uma geometria inteira com uma cor e deixa no formato
// "não indexado" (necessário para juntar peças diferentes).
function paint(geometry, hex) {
  const g = geometry.index ? geometry.toNonIndexed() : geometry;
  g.deleteAttribute('uv');
  const color = new THREE.Color(hex);
  const count = g.attributes.position.count;
  const arr = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    arr[i * 3] = color.r;
    arr[i * 3 + 1] = color.g;
    arr[i * 3 + 2] = color.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}

function merge(parts) {
  const g = mergeGeometries(parts, false);
  g.computeBoundingSphere();
  return g;
}

// Deforma levemente os vértices (pedras irregulares). Vértices na
// mesma posição recebem o mesmo deslocamento, então não abre buraco.
function jitter(geometry, amount, seed) {
  const pos = geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const h = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719 + seed) * 43758.5453;
    const f = 1 + ((h - Math.floor(h)) - 0.5) * amount;
    pos.setXYZ(i, x * f, y * f, z * f);
  }
  return geometry;
}

// Árvore de copa redonda (floresta)
export function makeBroadleafTree() {
  return merge([
    paint(new THREE.CylinderGeometry(0.22, 0.34, 3.2, 5).translate(0, 1.6, 0), '#6b4a2f'),
    paint(new THREE.IcosahedronGeometry(1.9, 0).scale(1, 0.85, 1).translate(0, 4.1, 0), '#3f7a35'),
    paint(new THREE.IcosahedronGeometry(1.25, 0).translate(0.75, 5.0, 0.35), '#4f8d3d'),
  ]);
}

// Pinheiro (montanha e bordas da floresta)
export function makePineTree() {
  return merge([
    paint(new THREE.CylinderGeometry(0.18, 0.28, 2.2, 5).translate(0, 1.1, 0), '#5e412a'),
    paint(new THREE.ConeGeometry(1.7, 2.8, 6).translate(0, 2.9, 0), '#2f5f37'),
    paint(new THREE.ConeGeometry(1.25, 2.4, 6).translate(0, 4.4, 0), '#356a3c'),
    paint(new THREE.ConeGeometry(0.8, 1.9, 6).translate(0, 5.8, 0), '#3b7442'),
  ]);
}

// Palmeira (praia)
export function makePalmTree() {
  const lean = 0.16;
  const top = new THREE.Vector3(Math.sin(lean) * 5.4, Math.cos(lean) * 5.4, 0);
  return merge([
    paint(new THREE.CylinderGeometry(0.13, 0.24, 5.6, 5).translate(0, 2.8, 0).rotateZ(-lean), '#8a6a43'),
    paint(new THREE.ConeGeometry(2.6, 0.9, 7).translate(top.x, top.y + 0.1, 0), '#4c9a45'),
    paint(new THREE.ConeGeometry(1.6, 0.7, 7).rotateY(0.4).translate(top.x, top.y + 0.55, 0), '#5aab4d'),
    paint(new THREE.IcosahedronGeometry(0.2, 0).translate(top.x + 0.25, top.y - 0.35, 0.15), '#6b4a26'),
    paint(new THREE.IcosahedronGeometry(0.2, 0).translate(top.x - 0.2, top.y - 0.35, -0.2), '#6b4a26'),
  ]);
}

// Pedra
export function makeRock() {
  const g = paint(new THREE.DodecahedronGeometry(1, 0), '#8c877d');
  jitter(g, 0.35, 3.1);
  g.scale(1, 0.7, 1).translate(0, 0.3, 0);
  g.computeBoundingSphere();
  return g;
}

// Arbusto com frutinhas
export function makeBush() {
  const berries = [
    [0.55, 0.75, 0.3], [-0.45, 0.85, 0.4], [0.1, 0.95, -0.55], [-0.3, 0.6, -0.6],
  ].map(([x, y, z]) => paint(new THREE.OctahedronGeometry(0.13, 0).translate(x, y, z), '#c23b3b'));
  return merge([
    paint(new THREE.IcosahedronGeometry(0.95, 0).scale(1.25, 0.75, 1.25).translate(0, 0.55, 0), '#4f8f3f'),
    ...berries,
  ]);
}
