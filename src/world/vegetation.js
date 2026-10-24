// =============================================================
// VEGETAÇÃO – árvores, palmeiras, pinheiros, pedras e arbustos
//
// Desempenho: usamos "InstancedMesh" (o equivalente do MultiMesh do
// Godot): o celular desenha centenas de árvores iguais numa única
// chamada. A ilha é dividida em pedaços de 128 m; pedaços longe da
// câmera ficam invisíveis.
//
// Colisão: cada árvore/pedra vira um círculo numa "grade espacial"
// (só checamos os círculos perto do jogador).
//
// Fase 2: cada instância já tem um registro (tipo, posição, vivo?)
// que será usado para coletar recursos.
// =============================================================
import * as THREE from 'three';
import { BIOME_KEYS } from './island_generator.js';
import { mulberry32 } from '../core/math.js';
import { addWind } from './materials.js';
import * as P from './props.js';

// Tipos de vegetação:
//   make/low: modelo de perto e de longe
//   collider: raio de colisão (0 = dá para atravessar)
//   maxDist: some além dessa distância (coisas pequenas somem antes)
//   water: pode nascer dentro de água rasa (pântano)
//   scale: [mínimo, máximo] de tamanho
const TYPES = {
  arvore: { make: P.makeBroadleafTree, low: P.makeBroadleafTreeLow, collider: 0.45, shadow: true, maxDist: Infinity, scale: [0.8, 1.3] },
  pinheiro: { make: P.makePineTree, low: P.makePineTreeLow, collider: 0.4, shadow: true, maxDist: Infinity, scale: [0.8, 1.35] },
  palmeira: { make: P.makePalmTree, low: P.makePalmTreeLow, collider: 0.35, shadow: true, maxDist: Infinity, scale: [0.85, 1.25] },
  arvore_gigante: { make: P.makeGiantTree, low: P.makeGiantTreeLow, collider: 1.1, shadow: true, maxDist: Infinity, scale: [0.8, 1.25] },
  arvore_selva: { make: P.makeJungleTree, low: P.makeJungleTreeLow, collider: 0.5, shadow: false, maxDist: Infinity, scale: [0.8, 1.3] },
  palmeira_selva: { make: P.makeJunglePalm, low: P.makeJunglePalmLow, collider: 0.3, shadow: false, maxDist: 160, scale: [0.8, 1.2] },
  samambaia: { make: P.makeFern, collider: 0, shadow: false, maxDist: 45, scale: [0.8, 1.5] },
  arvore_mangue: { make: P.makeMangrove, low: P.makeMangroveLow, collider: 0.6, shadow: true, maxDist: Infinity, scale: [0.8, 1.2], water: true },
  arvore_morta: { make: P.makeDeadTree, collider: 0.35, shadow: true, maxDist: 220, scale: [0.8, 1.3], water: true },
  junco: { make: P.makeReeds, collider: 0, shadow: false, maxDist: 80, scale: [0.8, 1.3], water: true },
  cacto: { make: P.makeCactus, collider: 0.4, shadow: true, maxDist: 220, scale: [0.7, 1.3] },
  arbusto_seco: { make: P.makeDryBush, collider: 0, shadow: false, maxDist: 110, scale: [0.7, 1.3] },
  pedra: { make: P.makeRock, low: P.makeRockLow, collider: 0.95, shadow: false, maxDist: 180, scale: [0.6, 2.2] },
  pedra_deserto: { make: P.makeDesertRock, low: P.makeDesertRockLow, collider: 0.95, shadow: false, maxDist: 200, scale: [0.7, 2.6] },
  arbusto: { make: P.makeBush, collider: 0, shadow: false, maxDist: 110, scale: [0.8, 1.3] },
};
const LOD_DIST = 60; // até aqui usa o modelo detalhado

// Grade espacial simples para achar obstáculos perto de um ponto.
class SpatialHash {
  constructor(cellSize) {
    this.cellSize = cellSize;
    this.cells = new Map();
  }

  _key(ix, iz) {
    return ix * 73856093 ^ iz * 19349663;
  }

  add(item) {
    const ix = Math.floor(item.x / this.cellSize);
    const iz = Math.floor(item.z / this.cellSize);
    const key = this._key(ix, iz);
    let list = this.cells.get(key);
    if (!list) {
      list = [];
      this.cells.set(key, list);
    }
    list.push(item);
  }

  // Chama fn(item) para tudo num raio aproximado de (x, z).
  forEachNear(x, z, radius, fn) {
    const cs = this.cellSize;
    const x0 = Math.floor((x - radius) / cs);
    const x1 = Math.floor((x + radius) / cs);
    const z0 = Math.floor((z - radius) / cs);
    const z1 = Math.floor((z + radius) / cs);
    for (let ix = x0; ix <= x1; ix++) {
      for (let iz = z0; iz <= z1; iz++) {
        const list = this.cells.get(this._key(ix, iz));
        if (list) for (const item of list) fn(item);
      }
    }
  }
}

export class Vegetation {
  constructor(map, water, avoidPoints, layout, seed) {
    this.map = map;
    this.water = water;
    this.cfg = layout.vegetacao;
    this.group = new THREE.Group();
    this.group.name = 'Vegetacao';
    this.instances = [];            // todos os registros (para a Fase 2)
    this.colliders = new SpatialHash(8);
    this.chunks = new Map();        // chave -> { center, meshes[] }
    // Um material só para toda a vegetação, com vento leve nas copas.
    this.material = addWind(new THREE.MeshLambertMaterial({ vertexColors: true }), 0.018);
    this.geometries = {};
    for (const [name, t] of Object.entries(TYPES)) {
      const hi = t.make();
      this.geometries[name] = { hi, lo: t.low ? t.low() : null };
    }

    this._place(avoidPoints, seed);
    this._buildMeshes(seed);
  }

  // Decide o que nasce em cada ponto de uma grade com "tremida"
  // aleatória (fica natural, mas sem amontoar). As chances por bioma
  // estão em data/world/ilha.json -> vegetacao.biomas.
  _place(avoidPoints, seed) {
    const map = this.map;
    const cfg = this.cfg;
    const rand = mulberry32(seed + 99);
    const step = cfg.passo_m;
    const half = map.half - step;
    const normal = new THREE.Vector3();
    const tables = {};
    for (const [biome, table] of Object.entries(cfg.biomas)) {
      tables[biome] = Object.entries(table).filter(([t]) => TYPES[t]);
    }

    for (let gz = -half; gz < half; gz += step) {
      for (let gx = -half; gx < half; gx += step) {
        const x = gx + rand() * step;
        const z = gz + rand() * step;
        const r = rand();
        const r2 = rand();
        const h = map.heightAt(x, z);
        if (h < 0.6) continue;
        if (avoidPoints.some((p) => Math.hypot(p.x - x, p.z - z) < 10)) continue;
        const table = tables[BIOME_KEYS[map.biomeAt(x, z)]];
        if (!table) continue;

        // Sorteia o tipo pelas chances do bioma.
        let acc = 0;
        let type = null;
        for (const [t, chance] of table) {
          acc += chance;
          if (r < acc) {
            type = t;
            break;
          }
        }
        if (!type) continue;
        const def = TYPES[type];
        const water = this.water.bodyAt(x, z);
        if (water && (!def.water || water.level - h > 0.9)) continue;
        const ny = map.normalAt(x, z, normal).y;
        if (ny < 0.78 && !type.startsWith('pedra')) continue;

        const scale = def.scale[0] + r2 * (def.scale[1] - def.scale[0]);
        const sinks = type.startsWith('pedra') ? 0.15 * scale : 0.1;
        const rec = {
          id: this.instances.length,
          type,
          x,
          y: h - sinks,
          z,
          scale,
          rot: rand() * Math.PI * 2,
          alive: true, // Fase 2: vira false quando coletado
          mesh: null,
          index: -1,
        };
        this.instances.push(rec);
        const colliderR = def.collider * (type.startsWith('pedra') ? scale : Math.sqrt(scale));
        if (colliderR > 0) this.colliders.add({ x, z, r: colliderR, rec });
      }
    }
  }

  // Cria InstancedMesh por (pedaço da ilha × tipo × perto/longe).
  _buildMeshes(seed) {
    const size = this.cfg.tamanho_pedaco_m;
    const byChunk = new Map();
    for (const rec of this.instances) {
      const cx = Math.floor(rec.x / size);
      const cz = Math.floor(rec.z / size);
      const key = `${cx},${cz}`;
      if (!byChunk.has(key)) byChunk.set(key, { cx, cz, byType: {} });
      const entry = byChunk.get(key);
      (entry.byType[rec.type] ??= []).push(rec);
    }

    const rand = mulberry32(seed + 7);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    const color = new THREE.Color();

    for (const [key, entry] of byChunk) {
      const center = new THREE.Vector3((entry.cx + 0.5) * size, 0, (entry.cz + 0.5) * size);
      const chunk = { key, center, groups: [] };
      for (const [type, list] of Object.entries(entry.byType)) {
        const geoms = this.geometries[type];
        // Matrizes e cores calculadas uma vez e usadas nas duas versões.
        const mats = [];
        const cols = [];
        for (const rec of list) {
          q.setFromAxisAngle(up, rec.rot);
          if (type.startsWith('pedra')) s.set(rec.scale * (0.8 + rand() * 0.5), rec.scale, rec.scale * (0.8 + rand() * 0.5));
          else s.setScalar(rec.scale);
          p.set(rec.x, rec.y, rec.z);
          mats.push(m.compose(p, q, s).clone());
          const v = 0.84 + rand() * 0.28;
          cols.push(new THREE.Color(v, v * (0.95 + rand() * 0.1), v * (0.94 + rand() * 0.08)));
        }
        const make = (geometry, lod) => {
          const mesh = new THREE.InstancedMesh(geometry, this.material, list.length);
          mesh.name = `${type}_${lod}_${key}`;
          mesh.castShadow = TYPES[type].shadow && lod === 'hi';
          mesh.userData.castsShadow = mesh.castShadow;
          list.forEach((rec, i) => {
            mesh.setMatrixAt(i, mats[i]);
            mesh.setColorAt(i, cols[i]);
            (rec.meshes ??= []).push({ mesh, index: i });
          });
          mesh.instanceMatrix.needsUpdate = true;
          if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
          mesh.computeBoundingSphere();
          this.group.add(mesh);
          return mesh;
        };
        const hi = make(geoms.hi, 'hi');
        const lo = geoms.lo ? make(geoms.lo, 'lo') : null;
        chunk.groups.push({ type, hi, lo });
      }
      this.chunks.set(key, chunk);
    }
  }

  // Esconde pedaços longe da câmera e usa o modelo simples de longe.
  updateVisibility(cameraPos, viewDistance) {
    const margin = this.cfg.tamanho_pedaco_m * 0.72;
    for (const chunk of this.chunks.values()) {
      const dx = chunk.center.x - cameraPos.x;
      const dz = chunk.center.z - cameraPos.z;
      const dist = Math.max(0, Math.sqrt(dx * dx + dz * dz) - margin);
      for (const g of chunk.groups) {
        const visible = dist < Math.min(viewDistance, TYPES[g.type].maxDist);
        const near = dist < LOD_DIST || !g.lo;
        g.hi.visible = visible && near;
        if (g.lo) g.lo.visible = visible && !near;
      }
    }
  }

  setShadows(enabled) {
    for (const chunk of this.chunks.values()) {
      for (const g of chunk.groups) g.hi.castShadow = enabled && g.hi.userData.castsShadow;
    }
  }

  // Empurra um círculo (jogador) para fora das árvores e pedras.
  resolveCollisions(pos, radius) {
    this.colliders.forEachNear(pos.x, pos.z, radius + 2.5, (c) => {
      if (!c.rec.alive) return;
      const dx = pos.x - c.x;
      const dz = pos.z - c.z;
      const minD = radius + c.r;
      const d2 = dx * dx + dz * dz;
      if (d2 < minD * minD && d2 > 1e-8) {
        const d = Math.sqrt(d2);
        const push = (minD - d) / d;
        pos.x += dx * push;
        pos.z += dz * push;
      }
    });
  }

  countByType() {
    const out = {};
    for (const rec of this.instances) out[rec.type] = (out[rec.type] ?? 0) + 1;
    return out;
  }
}
