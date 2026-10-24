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
import { BIOME } from './island_generator.js';
import { mulberry32 } from '../core/math.js';
import { makeBroadleafTree, makePineTree, makePalmTree, makeRock, makeBush } from './props.js';

// Tipos de vegetação: geometria, raio de colisão e se faz sombra.
// maxDist: coisas pequenas somem antes (economiza no celular).
const TYPES = {
  arvore: { make: makeBroadleafTree, collider: 0.45, shadow: true, maxDist: Infinity },
  pinheiro: { make: makePineTree, collider: 0.4, shadow: true, maxDist: Infinity },
  palmeira: { make: makePalmTree, collider: 0.35, shadow: true, maxDist: Infinity },
  pedra: { make: makeRock, collider: 0.95, shadow: false, maxDist: 170 },
  arbusto: { make: makeBush, collider: 0, shadow: false, maxDist: 110 }, // dá para atravessar
};

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
    this.material = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    this.geometries = {};
    for (const [name, t] of Object.entries(TYPES)) this.geometries[name] = t.make();

    this._place(avoidPoints, seed);
    this._buildMeshes(seed);
  }

  // Decide o que nasce em cada ponto de uma grade com "tremida"
  // aleatória (fica natural, mas sem amontoar).
  _place(avoidPoints, seed) {
    const map = this.map;
    const cfg = this.cfg;
    const rand = mulberry32(seed + 99);
    const step = cfg.passo_m;
    const half = map.half - step;
    const normal = new THREE.Vector3();

    for (let gz = -half; gz < half; gz += step) {
      for (let gx = -half; gx < half; gx += step) {
        const x = gx + rand() * step;
        const z = gz + rand() * step;
        const r = rand();
        const r2 = rand();
        const h = map.heightAt(x, z);
        if (h < 0.6) continue;
        if (this.water.bodyAt(x, z)) continue;
        if (avoidPoints.some((p) => Math.hypot(p.x - x, p.z - z) < 10)) continue;

        const biome = map.biomeAt(x, z);
        const ny = map.normalAt(x, z, normal).y;
        let type = null;

        switch (biome) {
          case BIOME.BEACH: {
            const c = cfg.praia;
            if (h > 0.9 && r < c.palmeira) type = 'palmeira';
            else if (r < c.palmeira + c.arbusto) type = 'arbusto';
            else if (r < c.palmeira + c.arbusto + c.pedra) type = 'pedra';
            break;
          }
          case BIOME.FOREST: {
            const c = cfg.floresta;
            const treeChance = c.arvore * map.forestDensity(x, z, h);
            if (ny < 0.8) {
              if (r < c.pedra * 3) type = 'pedra';
            } else if (r < treeChance) {
              type = h > 40 || r2 < 0.18 ? 'pinheiro' : 'arvore';
            } else if (r < treeChance + c.arbusto) {
              type = 'arbusto';
            } else if (r < treeChance + c.arbusto + c.pedra) {
              type = 'pedra';
            }
            break;
          }
          case BIOME.GRASS: {
            const c = cfg.campina;
            if (r < c.arvore) type = r2 < 0.3 ? 'pinheiro' : 'arvore';
            else if (r < c.arvore + c.arbusto) type = 'arbusto';
            else if (r < c.arvore + c.arbusto + c.pedra) type = 'pedra';
            break;
          }
          case BIOME.FIELD: {
            const c = cfg.campo;
            if (r < c.arvore) type = 'arvore';
            else if (r < c.arvore + c.arbusto) type = 'arbusto';
            else if (r < c.arvore + c.arbusto + c.pedra) type = 'pedra';
            break;
          }
          case BIOME.ROCK: {
            const c = cfg.montanha;
            if (r < c.pedra) type = 'pedra';
            else if (h < 85 && ny > 0.75 && r < c.pedra + c.pinheiro) type = 'pinheiro';
            break;
          }
          case BIOME.SNOW: {
            if (r < cfg.neve.pedra) type = 'pedra';
            break;
          }
          default:
            break;
        }
        if (!type) continue;

        const scale = type === 'pedra' ? 0.6 + rand() * 1.6 : 0.8 + rand() * 0.5;
        const rec = {
          id: this.instances.length,
          type,
          x,
          y: h - (type === 'pedra' ? 0.15 * scale : 0.1),
          z,
          scale,
          rot: rand() * Math.PI * 2,
          alive: true,   // Fase 2: vira false quando coletado
          mesh: null,
          index: -1,
        };
        this.instances.push(rec);
        const colliderR = TYPES[type].collider * (type === 'pedra' ? scale : 1);
        if (colliderR > 0) this.colliders.add({ x, z, r: colliderR, rec });
      }
    }
  }

  // Cria um InstancedMesh por (pedaço da ilha × tipo).
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
      const chunk = { key, center, meshes: [] };
      for (const [type, list] of Object.entries(entry.byType)) {
        const mesh = new THREE.InstancedMesh(this.geometries[type], this.material, list.length);
        mesh.name = `${type}_${key}`;
        mesh.castShadow = TYPES[type].shadow;
        mesh.userData.castsShadow = TYPES[type].shadow;
        mesh.userData.type = type;
        list.forEach((rec, i) => {
          q.setFromAxisAngle(up, rec.rot);
          if (type === 'pedra') s.set(rec.scale * (0.8 + rand() * 0.5), rec.scale, rec.scale * (0.8 + rand() * 0.5));
          else s.setScalar(rec.scale);
          p.set(rec.x, rec.y, rec.z);
          m.compose(p, q, s);
          mesh.setMatrixAt(i, m);
          // Pequena variação de tom em cada instância.
          const v = 0.86 + rand() * 0.26;
          color.setRGB(v, v * (0.96 + rand() * 0.08), v);
          mesh.setColorAt(i, color);
          rec.mesh = mesh;
          rec.index = i;
        });
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        mesh.computeBoundingSphere();
        this.group.add(mesh);
        chunk.meshes.push(mesh);
      }
      this.chunks.set(key, chunk);
    }
  }

  // Esconde pedaços longe da câmera (economiza muito no celular).
  updateVisibility(cameraPos, viewDistance) {
    const margin = this.cfg.tamanho_pedaco_m * 0.75;
    for (const chunk of this.chunks.values()) {
      const dx = chunk.center.x - cameraPos.x;
      const dz = chunk.center.z - cameraPos.z;
      const dist = Math.sqrt(dx * dx + dz * dz) - margin;
      for (const mesh of chunk.meshes) {
        mesh.visible = dist < Math.min(viewDistance, TYPES[mesh.userData.type].maxDist);
      }
    }
  }

  setShadows(enabled) {
    for (const chunk of this.chunks.values()) {
      for (const mesh of chunk.meshes) mesh.castShadow = enabled && mesh.userData.castsShadow;
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
