// =============================================================
// MODELOS IMPORTADOS (feitos por outras pessoas, com licença livre)
// Os dados vêm de src/creatures/imported/<espécie>.js, gerados pelo
// conversor em tools/models/. O esqueleto já vem com os mesmos nomes
// de ossos que o jogo anima (hips, chest, neck, head, jaw, tail1-3,
// pernaE/D, bracoE/D...), então as animações do jogo funcionam.
// =============================================================
import * as THREE from 'three';
import { hdTextures } from '../core/settings.js';
import { parseClips } from './clip_player.js';
import { BOCAS } from './bocas.js';
import espinossauro from './imported/espinossauro.js';
import trex from './imported/trex.js';
import braquiossauro from './imported/braquiossauro.js';
import titanoboa from './imported/titanoboa.js';
import deinosuchus from './imported/deinosuchus.js';
import estegossauro from './imported/estegossauro.js';
import anquilossauro from './imported/anquilossauro.js';
import parassauro from './imported/parassauro.js';
import raptor from './imported/raptor.js';
import quetzalcoatlus from './imported/quetzalcoatlus.js';
import mamute from './imported/mamute.js';
import argentavis from './imported/argentavis.js';
import reidodo from './imported/reidodo.js';
import sauropelta from './imported/sauropelta.js';
import argentinossauro from './imported/argentinossauro.js';
import mosassauro from './imported/mosassauro.js';
import pterodactilo from './imported/pterodactilo.js';
import carnotauro from './imported/carnotauro.js';

export const IMPORTED = {
  espinossauro, trex, braquiossauro, titanoboa, deinosuchus, estegossauro,
  anquilossauro, parassauro, raptor, quetzalcoatlus, mamute, argentavis, reidodo,
  // com animação do próprio modelo
  sauropelta, argentinossauro, mosassauro, pterodactilo, carnotauro,
};

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

// Modelos cuja textura original é só cinza (sem cor): pintamos os vértices
// (costas x barriga, com listras) e a textura cinza dá as escamas e o relevo.
// costas/barriga/listra = cores; freq = listras por metro; forca = quanto escurece;
// materiais = quais materiais do modelo recebem a tinta; brilho = clareia.
const TINTAS = {
  estegossauro: { costas: '#8f7f3d', barriga: '#d8cc9a', listra: '#3a301c', freq: 1.7, forca: 0.5, brilho: 1.9 },
  anquilossauro: { costas: '#75603c', barriga: '#bba67a', listra: '#2e2414', freq: 1.4, forca: 0.35, brilho: 1.9 },
  titanoboa: { costas: '#55612f', barriga: '#d3c48c', listra: '#1b2210', freq: 1.0, forca: 0.55, brilho: 1.8 },
  argentavis: { costas: '#5d4630', barriga: '#c4b391', listra: '#2a1d10', freq: 1.2, forca: 0.3, brilho: 1.9 },
};

const _c = new THREE.Color();
function paintVertices(g, d, tinta) {
  const n = d.vertices;
  const pos = g.getAttribute('position');
  const nor = g.getAttribute('normal');
  const costas = new THREE.Color(tinta.costas);
  const barriga = new THREE.Color(tinta.barriga);
  const listra = new THREE.Color(tinta.listra);
  // eixo mais comprido do corpo (as listras correm ao longo dele)
  const [bmin, bmax] = d.box;
  let ax = 0;
  for (let q = 1; q < 3; q++) if (bmax[q] - bmin[q] > bmax[ax] - bmin[ax]) ax = q;
  const col = new Float32Array(n * 3).fill(1);
  const mats = new Set(tinta.materiais ?? d.groups.map((gr) => gr[2]));
  const idx = g.getIndex();
  for (const [start, count, m] of d.groups) {
    if (!mats.has(m)) continue;
    for (let k = start; k < start + count; k++) {
      const v = idx.getX(k);
      const ny = nor.getY(v);
      const dorsal = THREE.MathUtils.smoothstep(ny, -0.35, 0.55);
      _c.copy(barriga).lerp(costas, dorsal);
      // listras suaves nas costas, com um pouco de irregularidade
      const along = pos.getX(v) * (ax === 0) + pos.getY(v) * (ax === 1) + pos.getZ(v) * (ax === 2);
      const wob = Math.sin(pos.getX(v) * 7.1 + pos.getY(v) * 5.3 + pos.getZ(v) * 6.7) * 0.6;
      const st = Math.max(0, Math.sin(along * tinta.freq * 6.28 + wob)) ** 3;
      _c.lerp(listra, st * tinta.forca * dorsal);
      col[v * 3] = _c.r;
      col[v * 3 + 1] = _c.g;
      col[v * 3 + 2] = _c.b;
    }
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
}

// Cria o osso 'jaw' e fecha a boca na pose parada (ver bocas.js): os vértices
// da mandíbula de baixo giram em volta da dobradiça e passam a seguir o osso.
function fecharBoca(cfg, pos, nor, sIdx, sWt, bones, n) {
  const hi = bones.findIndex((b) => b.name === 'head');
  let ji = bones.findIndex((b) => b.name === 'jaw');
  if (hi < 0) return;
  if (ji < 0) {
    bones.push({ name: 'jaw', parent: 'head', pos: [0, cfg.hy, cfg.hz] });
    ji = bones.length - 1;
  } else {
    bones[ji] = { ...bones[ji], pos: [0, cfg.hy, cfg.hz] };
  }
  const th = -cfg.dir * cfg.fecha;
  const zh = Math.abs(cfg.zr - cfg.hz);
  for (let v = 0; v < n; v++) {
    let best = 0;
    for (let k = 1; k < 4; k++) if (sWt[v * 4 + k] > sWt[v * 4 + best]) best = k;
    const dom = sIdx[v * 4 + best];
    if (dom !== hi && dom !== ji) continue;
    const y = pos[v * 3 + 1];
    const z = pos[v * 3 + 2];
    const zf = (z - cfg.zr) * cfg.dir; // distância da nuca (cresce até o focinho)
    if (y >= cfg.A + cfg.B * zf) continue; // de cima: fica com a cabeça
    const w = THREE.MathUtils.smoothstep(zf, zh * 0.6, zh * 1.8);
    if (w <= 0) continue;
    const a = th * w;
    const c = Math.cos(a);
    const sn = Math.sin(a);
    const dy = y - cfg.hy;
    const dz = z - cfg.hz;
    pos[v * 3 + 1] = cfg.hy + dy * c - dz * sn;
    pos[v * 3 + 2] = cfg.hz + dy * sn + dz * c;
    const ny = nor[v * 3 + 1];
    const nz = nor[v * 3 + 2];
    nor[v * 3 + 1] = Math.round(ny * c - nz * sn);
    nor[v * 3 + 2] = Math.round(ny * sn + nz * c);
    const wj = Math.round(255 * w);
    sIdx[v * 4] = ji; sIdx[v * 4 + 1] = hi; sIdx[v * 4 + 2] = 0; sIdx[v * 4 + 3] = 0;
    sWt[v * 4] = wj; sWt[v * 4 + 1] = 255 - wj; sWt[v * 4 + 2] = 0; sWt[v * 4 + 3] = 0;
  }
}

export function buildImportedModel(d, id) {
  const n = d.vertices;
  const [bmin, bmax] = d.box;
  const qp = view(d.position, Uint16Array);
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    for (let q = 0; q < 3; q++) pos[i * 3 + q] = bmin[q] + (qp[i * 3 + q] / 65535) * (bmax[q] - bmin[q]);
  }
  const nor = view(d.normal, Int8Array).slice();
  const sIdx = bytes(d.skinIndex);
  const sWt = bytes(d.skinWeight);
  const boneDefs = d.bones.map((b) => ({ ...b }));
  if (BOCAS[id]) fecharBoca(BOCAS[id], pos, nor, sIdx, sWt, boneDefs, n);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3, true));
  g.setAttribute('uv', new THREE.BufferAttribute(view(d.uv, Uint16Array), 2, true));
  if (d.color) g.setAttribute('color', new THREE.BufferAttribute(bytes(d.color), 3, true));
  g.setAttribute('skinIndex', new THREE.BufferAttribute(sIdx, 4));
  g.setAttribute('skinWeight', new THREE.BufferAttribute(sWt, 4, true));
  g.setIndex(new THREE.BufferAttribute(view(d.index, d.index32 ? Uint32Array : Uint16Array), 1));
  g.computeBoundingBox();
  g.computeBoundingSphere();
  g.boundingSphere.radius *= 1.3;

  // modelos com textura colorida (um material por textura)
  if (d.materiais) {
    for (const [start, count, m] of d.groups) g.addGroup(start, count, m);
    const tinta = TINTAS[id];
    if (tinta) paintVertices(g, d, tinta);
    const material = d.materiais.map((m, mi) => {
      // qualidade alta: luz "de verdade" (brilho e relevo mais bonitos)
      const mat = hdTextures()
        ? new THREE.MeshStandardMaterial({ map: texture(m.map, true), roughness: 0.82, metalness: 0 })
        : new THREE.MeshLambertMaterial({ map: texture(m.map, true) });
      mat.color.setScalar((d.brilho ?? 1) * (tinta?.brilho ?? 1)); // textura muito escura: clareia
      if (tinta && (tinta.materiais ?? [mi]).includes(mi)) mat.vertexColors = true;
      if (m.normalMap) mat.normalMap = texture(m.normalMap, false);
      // modelo com faces de um lado só pintado dos dois lados
      if (d.doisLados) mat.side = THREE.DoubleSide;
      if (m.alpha) {
        mat.alphaTest = 0.45;
        mat.side = THREE.DoubleSide;
      }
      return mat;
    });
    const bones = boneDefs.map((b) => ({ name: b.name, parent: b.parent, pos: new THREE.Vector3(...b.pos) }));
    return { geometry: g, bones, material, imported: true, clipes: parseClips(d.clipes) };
  }

  // textura cinza (escamas e relevo) × cor pintada por região
  const material = new THREE.MeshLambertMaterial({
    vertexColors: true,
    map: texture(d.map, true),
    normalMap: texture(d.normalMap, false),
  });
  material.normalScale.set(0.9, 0.9);
  material.color.setScalar(2.2); // a textura é escura (média ~0,45): compensa

  const bones = boneDefs.map((b) => ({ name: b.name, parent: b.parent, pos: new THREE.Vector3(...b.pos) }));
  return { geometry: g, bones, material, imported: true };
}
