// =============================================================
// MODELOS DA NEVE (enviados pelo jogador)
// Árvores do "Snow Trees Pack" (cartões com textura transparente) e a
// pedra "W041 Snowy Rock". Os dados vêm de textures/neve_modelos.js
// (gerado por tools/models/neve_modelos.py). Cada modelo tem altura 1
// e é escalado pela vegetação.
// =============================================================
import * as THREE from 'three';
import { ARVORES_NEVE, PEDRA_NEVE, ROCHA_NEVADA } from './textures/neve_modelos.js';
import { addWind } from './materials.js';
import { PEDRA_COR_HD, PEDRA_RELEVO_HD, ARVORE_MORTA_HD, ARVORE_SECA_HD } from './textures/hd.js';
import { hdTextures } from '../core/settings.js';

// texturas maiores na qualidade "alta"
const TREE_HD = { arvore_morta: ARVORE_MORTA_HD, arvore_seca: ARVORE_SECA_HD };

function bytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

// part = { n, box, pos, uv, idx } -> geometria com cor branca e vento
function geometry(part, height, wind) {
  const q = new Uint16Array(bytes(part.pos));
  const uvq = new Uint16Array(bytes(part.uv));
  const idx = new Uint16Array(bytes(part.idx));
  const [x0, y0, z0, x1, y1, z1] = part.box;
  const n = part.n;
  const pos = new Float32Array(n * 3);
  const uv = new Float32Array(n * 2);
  const col = new Float32Array(n * 3).fill(1);
  const wnd = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    pos[i * 3] = (x0 + (q[i * 3] / 65535) * (x1 - x0)) * height;
    pos[i * 3 + 1] = (y0 + (q[i * 3 + 1] / 65535) * (y1 - y0)) * height;
    pos[i * 3 + 2] = (z0 + (q[i * 3 + 2] / 65535) * (z1 - z0)) * height;
    uv[i * 2] = uvq[i * 2] / 65535;
    uv[i * 2 + 1] = uvq[i * 2 + 1] / 65535;
    wnd[i] = wind ? Math.min(1, pos[i * 3 + 1] / height) * wind : 0;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aWind', new THREE.BufferAttribute(wnd, 1));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeVertexNormals();
  return g;
}

const cache = {};
function texture(url, srgb = true) {
  if (!cache[url]) {
    const t = new THREE.TextureLoader().load(url);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    cache[url] = t;
  }
  return cache[url];
}

// Árvore/arbusto em cartões: altura (m) do modelo base.
export function snowTreeGeometry(key, height) {
  return geometry(ARVORES_NEVE[key], height, 0.5);
}

export function snowTreeMaterial(key) {
  const mat = new THREE.MeshLambertMaterial({
    map: texture((hdTextures() && TREE_HD[key]) || ARVORES_NEVE[key].tex),
    vertexColors: true,
    alphaTest: 0.45,
    side: THREE.DoubleSide,
  });
  // cartões: luz igual dos dois lados
  return addWind(mat, 0.01, 0.02);
}

// Pedra nevada (altura 1 m; a vegetação escala).
export function snowRockGeometry() {
  return geometry(PEDRA_NEVE, 1, 0);
}

export function snowRockMaterial() {
  const hd = hdTextures();
  const mat = new THREE.MeshLambertMaterial({ map: texture(hd ? PEDRA_COR_HD : PEDRA_NEVE.tex), vertexColors: true });
  // relevo da pedra (normal map do arquivo) na qualidade alta
  if (hd) mat.normalMap = texture(PEDRA_RELEVO_HD, false);
  return addWind(mat, 0, 0);
}

// Textura de rocha nevada para os paredões das montanhas.
export function snowyRockTexture() {
  const t = texture(ROCHA_NEVADA);
  t.wrapS = THREE.MirroredRepeatWrapping;
  t.wrapT = THREE.MirroredRepeatWrapping;
  return t;
}
