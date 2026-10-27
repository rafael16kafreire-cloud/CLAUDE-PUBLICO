// =============================================================
// PLANTAS DA PRAIA E DA FLORESTA (enviadas pelo jogador)
// Palmeira, tamareiras e plantinhas da praia; árvores folhosas e capim
// da floresta. Os dados vêm de textures/veg_modelos.js (gerado por
// tools/models/vegetacao_modelos.py). Cada modelo tem altura 1 e é
// escalado pela vegetação. Modelo com tronco + folhas usa 2 materiais.
// =============================================================
import * as THREE from 'three';
import { VEG_MODELOS as M1, VEG_TEXTURAS as T1, FOLHAGEM_COR } from './textures/veg_modelos.js';
import { VEG_MODELOS2, VEG_TEXTURAS2 } from './textures/veg_modelos2.js';
import { VEG_TRONCOS, VEG_TRONCOS_TEX } from './textures/veg_troncos.js';

const VEG_MODELOS = { ...M1, ...VEG_MODELOS2, ...VEG_TRONCOS };
const VEG_TEXTURAS = { ...T1, ...VEG_TEXTURAS2, ...VEG_TRONCOS_TEX, folhagem_arbusto: FOLHAGEM_COR };
import { addWind } from './materials.js';
import { addLeafLight } from './foliage_texture.js';

function bytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

// Junta as partes do modelo numa geometria (um grupo por parte).
export function vegGeometry(key, height, wind = 0.5) {
  const parts = VEG_MODELOS[key];
  const N = parts.reduce((a, p) => a + p.n, 0);
  const pos = new Float32Array(N * 3);
  const uv = new Float32Array(N * 2);
  const col = new Float32Array(N * 3).fill(1);
  const wnd = new Float32Array(N);
  const index = [];
  const g = new THREE.BufferGeometry();
  let base = 0;
  parts.forEach((part, pi) => {
    const q = new Uint16Array(bytes(part.pos));
    const uq = new Uint16Array(bytes(part.uv));
    const idx = new Uint16Array(bytes(part.idx));
    const [x0, y0, z0, x1, y1, z1] = part.box;
    const [u0, v0, u1, v1] = part.uvbox;
    // tronco não balança; folhas balançam mais em cima
    const leafy = parts.length === 1 || pi > 0;
    for (let i = 0; i < part.n; i++) {
      const k = base + i;
      pos[k * 3] = (x0 + (q[i * 3] / 65535) * (x1 - x0)) * height;
      pos[k * 3 + 1] = (y0 + (q[i * 3 + 1] / 65535) * (y1 - y0)) * height;
      pos[k * 3 + 2] = (z0 + (q[i * 3 + 2] / 65535) * (z1 - z0)) * height;
      uv[k * 2] = u0 + (uq[i * 2] / 65535) * (u1 - u0);
      uv[k * 2 + 1] = v0 + (uq[i * 2 + 1] / 65535) * (v1 - v0);
      wnd[k] = leafy ? Math.min(1, pos[k * 3 + 1] / height) * wind : 0;
    }
    g.addGroup(index.length, idx.length, pi);
    for (let i = 0; i < idx.length; i++) index.push(idx[i] + base);
    base += part.n;
  });
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aWind', new THREE.BufferAttribute(wnd, 1));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

const texCache = {};
function texture(name, srgb = true) {
  if (!texCache[name]) {
    const t = new THREE.TextureLoader().load(VEG_TEXTURAS[name]);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    t.wrapS = t.wrapT = THREE.RepeatWrapping; // casca do tronco se repete
    texCache[name] = t;
  }
  return texCache[name];
}

// Um material por parte (tronco opaco; folhas com recorte transparente).
// berry = cor das bagas (arbusto com bagas); null = arbusto sem bagas.
const OPAQUE = new Set(['bark', 'agar_casca', 'agar_cipo', 'folhagem_arbusto']);
export function vegMaterial(key, berry) {
  const mats = VEG_MODELOS[key].map((part) => {
    if (part.tex === 'baga') {
      // bagas redondas e brilhantes da cor do tipo
      const m = new THREE.MeshLambertMaterial({ color: berry ?? '#2a4a22', vertexColors: true, visible: berry !== null });
      m.emissive.set(berry ?? '#000').multiplyScalar(0.12);
      return addWind(m, 0.004, 0.01);
    }
    const opaque = OPAQUE.has(part.tex) || part.tex.startsWith('tronco_');
    const m = new THREE.MeshLambertMaterial({
      map: texture(part.tex),
      vertexColors: true,
      alphaTest: opaque ? 0 : 0.42,
      // cipós são cartões sem recorte: dos dois lados
      side: opaque && part.tex !== 'agar_cipo' ? THREE.FrontSide : THREE.DoubleSide,
    });
    // relevo (normal map), se o modelo tiver
    if (VEG_TEXTURAS[`${part.tex}_relevo`]) m.normalMap = texture(`${part.tex}_relevo`, false);
    addWind(m, opaque ? 0.004 : 0.01, opaque ? 0 : 0.03);
    return opaque ? m : addLeafLight(m, 0.55);
  });
  return mats.length === 1 ? mats[0] : mats;
}
