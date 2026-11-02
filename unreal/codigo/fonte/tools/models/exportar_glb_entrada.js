import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { IMPORTED, buildImportedModel } from '../../src/creatures/imported_model.js';
import { createSkinnedMesh } from '../../src/creatures/creature_builder.js';
import { vegGeometry, vegMaterial } from '../../src/world/veg_models.js';
import { snowTreeGeometry, snowTreeMaterial, snowRockGeometry, snowRockMaterial } from '../../src/world/snow_models.js';
import { VEG_MODELOS as A } from '../../src/world/textures/veg_modelos.js';
import { VEG_MODELOS2 as B } from '../../src/world/textures/veg_modelos2.js';
import { VEG_TRONCOS } from '../../src/world/textures/veg_troncos.js';
import { VEG_BL_MODELOS } from '../../src/world/textures/veg_blender.js';
import { VEG_CX_MODELOS } from '../../src/world/textures/veg_caixa.js';
import { VEG_PL_MODELOS } from '../../src/world/textures/veg_palmas.js';
import { VEG_CP_MODELOS } from '../../src/world/textures/veg_copas.js';
import { VEG_CAP_MODELOS } from '../../src/world/textures/veg_capim.js';
import { ARVORES_NEVE } from '../../src/world/textures/neve_modelos.js';
import SELA from '../../src/creatures/imported/sela_modelo.js';

const espera = (obj) => new Promise((ok) => {
  const imgs = [];
  obj.traverse((o) => { const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []; for (const m of ms) for (const k of ['map', 'normalMap']) if (m[k]) imgs.push(m[k]); });
  const t0 = performance.now();
  const loop = () => { if (imgs.every((t) => t.image && (t.image.complete ?? true) && (t.image.width ?? 1) > 0) || performance.now() - t0 > 15000) ok(); else setTimeout(loop, 100); };
  loop();
});
// troca materiais com shader do jogo por MeshStandardMaterial simples (exporta limpo)
function limpa(obj) {
  obj.traverse((o) => {
    if (!o.isMesh) return;
    const conv = (m) => { const n = new THREE.MeshStandardMaterial({ map: m.map ?? null, normalMap: m.normalMap ?? null, color: m.color ? m.color.clone() : 0xffffff, vertexColors: !!m.vertexColors, alphaTest: m.alphaTest ?? 0, side: m.side, roughness: 0.85, metalness: 0 }); n.name = m.name; return n; };
    o.material = Array.isArray(o.material) ? o.material.map(conv) : conv(o.material);
  });
}
async function exporta(obj, clips = []) {
  limpa(obj);
  await espera(obj);
  const ex = new GLTFExporter();
  const buf = await ex.parseAsync(obj, { binary: true, animations: clips, onlyVisible: false });
  const u8 = new Uint8Array(buf);
  let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return btoa(s);
}
function clipesDe(model) {
  const out = [];
  for (const [nome, c] of Object.entries(model.clipes ?? {})) {
    const tracks = [];
    const times = Float32Array.from({ length: c.frames }, (_, i) => i / c.fps);
    for (const [b, q] of Object.entries(c.giro)) tracks.push(new THREE.QuaternionKeyframeTrack(`${b}.quaternion`, times, q.slice(0, c.frames * 4)));
    for (const [b, p] of Object.entries(c.pos)) tracks.push(new THREE.VectorKeyframeTrack(`${b}.position`, times, p.slice(0, c.frames * 3)));
    out.push(new THREE.AnimationClip(nome, c.duration, tracks));
  }
  return out;
}
window.LISTA = {
  bichos: Object.keys(IMPORTED),
  plantas: [...new Set([A, B, VEG_TRONCOS, VEG_BL_MODELOS, VEG_CX_MODELOS, VEG_PL_MODELOS, VEG_CP_MODELOS, VEG_CAP_MODELOS].flatMap((x) => Object.keys(x ?? {})))],
  neve: Object.keys(ARVORES_NEVE ?? {}),
};
window.EXPORTA = async (tipo, id) => {
  if (tipo === 'bicho') {
    const model = buildImportedModel(IMPORTED[id], id);
    const { mesh } = createSkinnedMesh(model, model.material);
    mesh.name = id;
    const g = new THREE.Group(); g.name = id; g.add(mesh);
    return exporta(g, clipesDe(model));
  }
  if (tipo === 'planta') {
    const m = new THREE.Mesh(vegGeometry(id, 10, 0.5), vegMaterial(id, '#c0282a'));
    m.name = id; return exporta(m);
  }
  if (tipo === 'neve') { const m = new THREE.Mesh(snowTreeGeometry(id, 10), snowTreeMaterial(id)); m.name = id; return exporta(m); }
  if (tipo === 'pedra') { const m = new THREE.Mesh(snowRockGeometry(), snowRockMaterial()); m.name = 'pedra_neve'; return exporta(m); }
  if (tipo === 'sela') {
    const f32 = (b64) => { const b = Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0)); return new Float32Array(b.buffer); };
    const u16 = (b64) => { const b = Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0)); return new Uint16Array(b.buffer); };
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(f32(SELA.pos), 3)); g.setIndex(new THREE.BufferAttribute(u16(SELA.index), 1)); g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: '#7b4a28' })); m.name = 'sela'; return exporta(m);
  }
};
window.PRONTO = true;
