// =============================================================
// VEGETAÇÃO – a floresta inteira (árvores, palmeiras, bananeiras,
// samambaias, arbustos de bagas, troncos caídos, pedras e plantas
// do pântano)
//
// Desempenho (o mais importante no celular):
//   - Cada planta é só um registro (posição, tipo, tamanho).
//   - A cada instante o jogo separa as plantas visíveis em 3 grupos:
//       perto  -> modelo detalhado (com sombra)
//       médio  -> modelo simples
//       longe  -> "foto" (impostor, 2 triângulos)
//   - Cada grupo de cada tipo é UM desenho (instancing).
//   - Plantas fora da tela e além da neblina nem entram.
//
// Coleta (Fase 2): cada planta tem "capacidade" (golpes até acabar);
// ao acabar some (ou vira arbusto sem bagas) e volta depois.
// =============================================================
import * as THREE from 'three';
import { events, EV } from '../core/event_bus.js';
import { BIOME_KEYS } from './island_generator.js';
import { mulberry32 } from '../core/math.js';
import { addWind, makeImpostorMaterial } from './materials.js';
import { renderImpostor } from './impostor.js';
import { foliageTexture, addPlantDetail } from './foliage_texture.js';
import recursos from '../data/world/recursos.json';
import * as P from './props.js';
import { snowRockGeometry, snowRockMaterial } from './snow_models.js';
import { vegGeometry, vegMaterial } from './veg_models.js';

const ROOTS = P.sumaumaRootColliders();

// Tipos de planta:
//   hi/lo: modelos de perto e médio; imp: vira "foto" de longe
//   collider: raio de colisão (0 = atravessa; 'log' = tronco deitado)
//   res: tipo de recurso (data/world/recursos.json)
//   water: pode nascer em água rasa; surface: boia na água
//   foot: raio da base (m) – em morro a planta afunda até o ponto mais baixo
const TYPES = {
  sumauma: { roots: true, foot: 2.6, hi: P.makeSumauma, lo: P.makeSumaumaLow, imp: true, collider: 1.5, shadow: true, scale: [1.2, 1.6], res: 'arvore_gigante' },
  arvore_dossel: { foot: 0.75, hi: P.makeCanopyTree, lo: P.makeCanopyTreeLow, imp: true, collider: 0.55, shadow: true, scale: [1.0, 1.45], res: 'arvore' },
  arvore_media: { foot: 0.3, hi: P.makeUnderstoryTree, lo: P.makeUnderstoryTreeLow, imp: true, collider: 0.3, shadow: true, scale: [0.75, 1.3], res: 'arvore' },
  acai: { foot: 0.4, hi: P.makeAcai, lo: P.makeAcaiLow, imp: true, collider: 0.22, shadow: true, scale: [0.8, 1.2], res: 'palmeira' },
  // praia (modelos enviados: Palm Tree Realistic, Date palm and vegetation)
  coqueiro: { foot: 0.3, hi: () => vegGeometry('palmeira', 11), lo: P.makeCoconutPalmLow, mat: () => vegMaterial('palmeira'), collider: 0.3, shadow: true, scale: [0.85, 1.25], res: 'palmeira', textured: true },
  tamareira: { foot: 0.45, hi: () => vegGeometry('tamareira', 8.5), lo: P.makeCoconutPalmLow, mat: () => vegMaterial('tamareira'), collider: 0.4, shadow: true, scale: [0.8, 1.2], res: 'palmeira', textured: true, maxDist: 280 },
  tamareira2: { foot: 0.45, hi: () => vegGeometry('tamareira2', 7), lo: P.makeCoconutPalmLow, mat: () => vegMaterial('tamareira2'), collider: 0.4, shadow: true, scale: [0.8, 1.2], res: 'palmeira', textured: true, maxDist: 280 },
  planta_praia: { hi: () => vegGeometry('planta_praia', 1.1), mat: () => vegMaterial('planta_praia'), collider: 0, shadow: false, scale: [0.7, 1.4], res: 'arbusto', maxDist: 80, textured: true },
  capim_praia: { hi: () => vegGeometry('capim_praia', 0.9), mat: () => vegMaterial('capim_praia'), collider: 0, shadow: false, scale: [0.7, 1.4], res: null, maxDist: 60, textured: true },
  // floresta (Low Poly Tree Scene Free): árvores folhosas e tufos de capim
  arvore_folhosa: { foot: 0.5, hi: () => vegGeometry('arvore_folhosa', 15), lo: P.makeCanopyTreeLow, mat: () => vegMaterial('arvore_folhosa'), collider: 0.45, shadow: true, scale: [0.8, 1.3], res: 'arvore', textured: true, maxDist: 320 },
  arvore_folhosa2: { foot: 0.35, hi: () => vegGeometry('arvore_folhosa2', 11), lo: P.makeUnderstoryTreeLow, mat: () => vegMaterial('arvore_folhosa2'), collider: 0.35, shadow: true, scale: [0.8, 1.3], res: 'arvore', textured: true, maxDist: 320 },
  // árvore alta da mata (Agarwood): tronco liso, copa no alto e cipós
  arvore_agar: { foot: 0.45, hi: () => vegGeometry('arvore_agar', 24), lo: P.makeCanopyTreeLow, mat: () => vegMaterial('arvore_agar'), collider: 0.45, shadow: true, scale: [0.8, 1.25], res: 'arvore', textured: true, maxDist: 320 },
  capim: { hi: () => vegGeometry('capim', 0.8), mat: () => vegMaterial('capim'), collider: 0, shadow: false, scale: [0.7, 1.5], res: null, maxDist: 55, textured: true },
  samambaia_gigante: { foot: 0.3, hi: P.makeTreeFern, lo: P.makeTreeFernLow, imp: true, collider: 0.2, shadow: true, scale: [0.8, 1.3], res: 'samambaia_gigante' },
  bananeira: { foot: 0.45, hi: P.makeBananaTree, lo: P.makeBananaTreeLow, collider: 0.22, shadow: false, scale: [0.85, 1.25], res: 'bananeira', maxDist: 110 },
  bananeira_vazia: { foot: 0.45, hi: P.makeBananaTreeEmpty, lo: P.makeBananaTreeEmptyLow, collider: 0.22, shadow: false, scale: [0.85, 1.25], res: 'planta', maxDist: 110 },
  samambaia: { hi: P.makeFern, collider: 0, shadow: false, scale: [0.8, 1.5], res: 'samambaia', maxDist: 40 },
  arbusto_mejo: { hi: () => vegGeometry('arbusto_bagas', 1.3), lo: P.makeMejoBush, mat: () => vegMaterial('arbusto_bagas', '#4b3a9a'), textured: true, collider: 0, shadow: false, scale: [0.8, 1.2], res: 'baga_mejo', maxDist: 75 },
  arbusto_escura: { hi: () => vegGeometry('arbusto_bagas', 1.3), lo: P.makeDarkBush, mat: () => vegMaterial('arbusto_bagas', '#1e1430'), textured: true, collider: 0, shadow: false, scale: [0.8, 1.2], res: 'baga_escura', maxDist: 75 },
  arbusto_frutas: { hi: () => vegGeometry('arbusto_bagas', 1.3), lo: P.makeFruitBush, mat: () => vegMaterial('arbusto_bagas', '#c0282a'), textured: true, collider: 0, shadow: false, scale: [0.8, 1.2], res: 'frutas', maxDist: 75 },
  arbusto: { hi: () => vegGeometry('arbusto_bagas', 1.3), lo: P.makeBushEmpty, mat: () => vegMaterial('arbusto_bagas', null), textured: true, collider: 0, shadow: false, scale: [0.8, 1.2], res: 'arbusto', maxDist: 75 },
  // troncos caídos enviados pelo jogador (log = metade do comprimento,
  // raio e altura de cima para a colisão, em metros)
  tronco_caido: { hi: () => vegGeometry('musgo', 5, 0), lo: P.makeFallenLogLow, mat: () => vegMaterial('musgo'), textured: true, collider: 'log', log: [2.3, 0.7, 1.5], shadow: true, scale: [0.8, 1.3], res: 'tronco', maxDist: 140 },
  tronco_pinho: { hi: () => vegGeometry('pinho', 9, 0), lo: P.makeFallenLogLow, mat: () => vegMaterial('pinho'), textured: true, collider: 'log', log: [4.3, 0.45, 0.9], shadow: true, scale: [0.8, 1.2], res: 'tronco', maxDist: 140 },
  pedrinhas: { foot: 0.05, hi: P.makePebbles, collider: 0, shadow: false, scale: [0.8, 1.3], res: 'pedrinhas', maxDist: 45 },
  gravetos: { foot: 0.05, hi: P.makeSticks, collider: 0, shadow: false, scale: [0.8, 1.3], res: 'gravetos', maxDist: 45 },
  pinheiro: { foot: 0.4, hi: P.makeSpruce, lo: P.makeSpruceLow, imp: true, collider: 0.3, shadow: true, scale: [0.7, 1.3], res: 'arvore', cold: true },
  // modelos da neve enviados pelo jogador (mat = material próprio, com textura)
  // neve: árvores em 3D de verdade (galhos e neve em cima), não placas com foto
  pinheiro_neve: { foot: 0.4, hi: P.makeSnowSpruce, lo: P.makeSnowSpruceLow, imp: true, collider: 0.3, shadow: true, scale: [0.75, 1.35], res: 'arvore', cold: true },
  arvore_morta_neve: { foot: 0.4, hi: P.makeSnowDeadTree, lo: P.makeSnowDeadTreeLow, collider: 0.3, shadow: true, scale: [0.8, 1.3], res: 'arvore', cold: true, maxDist: 320 },
  arvore_seca: { foot: 0.4, hi: () => P.makeSnowDeadTree(false, 5), lo: () => P.makeSnowDeadTree(true, 5), collider: 0.25, shadow: true, scale: [0.9, 1.4], res: 'arvore', cold: true, maxDist: 320 },
  arbusto_neve: { hi: P.makeSnowShrub, collider: 0, shadow: false, scale: [0.7, 1.4], res: 'arbusto', maxDist: 90 },
  rochedo: { foot: 1.6, hi: snowRockGeometry, mat: snowRockMaterial, lo: P.makeBoulderLow, collider: 1.0, shadow: true, scale: [1.8, 9], res: 'rochedo', maxDist: 320, rock: true, textured: true },
  minerio_ferro: { foot: 0.8, hi: P.makeIronOre, collider: 0.9, shadow: false, scale: [0.9, 1.6], res: 'ferro', maxDist: 140, rock: true },
  pedra_musgo: { foot: 0.85, hi: P.makeMossRock, lo: P.makeMossRockLow, collider: 1.0, shadow: false, scale: [0.6, 2.2], res: 'pedra', maxDist: 160 },
  mangue: { foot: 1.2, hi: P.makeMangrove, lo: P.makeMangroveLow, imp: true, collider: 0.6, shadow: true, scale: [0.8, 1.2], res: 'arvore', water: true },
  arvore_morta: { foot: 0.3, hi: P.makeDeadTree, collider: 0.3, shadow: true, scale: [0.8, 1.3], res: 'arvore', water: true, maxDist: 200 },
  junco: { hi: P.makeReeds, collider: 0, shadow: false, scale: [0.8, 1.3], res: 'junco', water: true, maxDist: 70 },
  taboa: { hi: P.makeCattail, collider: 0, shadow: false, scale: [0.8, 1.3], res: 'junco', water: true, maxDist: 70 },
  vitoria_regia: { hi: P.makeWaterLily, collider: 0, shadow: false, scale: [0.6, 1.7], res: null, surface: true, maxDist: 120 },
};

const CHUNK = 48;

class SpatialHash {
  constructor(cellSize) {
    this.cellSize = cellSize;
    this.cells = new Map();
  }

  _key(ix, iz) {
    return (ix + 4096) * 8192 + (iz + 4096);
  }

  add(item, x, z) {
    const key = this._key(Math.floor(x / this.cellSize), Math.floor(z / this.cellSize));
    let list = this.cells.get(key);
    if (!list) this.cells.set(key, (list = []));
    if (!list.includes(item)) list.push(item);
  }

  forEachNear(x, z, radius, fn) {
    const cs = this.cellSize;
    const x0 = Math.floor((x - radius) / cs);
    const x1 = Math.floor((x + radius) / cs);
    const z0 = Math.floor((z - radius) / cs);
    const z1 = Math.floor((z + radius) / cs);
    const seen = this._seen ?? (this._seen = new Set());
    seen.clear();
    for (let ix = x0; ix <= x1; ix++) {
      for (let iz = z0; iz <= z1; iz++) {
        const list = this.cells.get(this._key(ix, iz));
        if (!list) continue;
        for (const item of list) {
          if (seen.has(item)) continue;
          seen.add(item);
          fn(item);
        }
      }
    }
  }
}

export class Vegetation {
  constructor(map, water, avoidPoints, layout, seed, renderer) {
    this.map = map;
    this.water = water;
    this.cfg = layout.vegetacao;
    this.group = new THREE.Group();
    this.group.name = 'Vegetacao';
    this.recs = [];
    this.byHash = new SpatialHash(8);
    this.chunks = new Map();
    this.depleted = [];
    this.lod = { hi: 40, lo: 90 };
    this._last = { x: 1e9, z: 1e9, yaw: 1e9, t: 0 };
    this._frustum = new THREE.Frustum();
    this._m4 = new THREE.Matrix4();
    this._cullCam = new THREE.PerspectiveCamera();

    // Um material com vento para todas as plantas. A textura de
    // folhagem dá as folhinhas recortadas das copas e arbustos.
    this.material = addPlantDetail(addWind(new THREE.MeshLambertMaterial({
      vertexColors: true,
      map: foliageTexture(),
      alphaTest: 0.42,
    }), 0.012, 0.045));
    // Modelos de média distância não têm recortes: material sem
    // "alphaTest" (a placa de vídeo descarta pixels escondidos antes).
    this.materialSolid = addPlantDetail(addWind(new THREE.MeshLambertMaterial({ vertexColors: true, map: this.material.map }), 0.012, 0.045));

    this._place(avoidPoints, seed);
    this._buildTypeMeshes(renderer);
  }

  // ---------------------------------------------------------
  // Onde nasce cada planta (chances por bioma em ilha.json)
  // ---------------------------------------------------------
  _place(avoidPoints, seed) {
    const map = this.map;
    const rand = mulberry32(seed + 99);
    const normal = new THREE.Vector3();
    // Duas camadas: a mata (árvores, a cada passo_m) e o sub-bosque
    // (samambaias e arbustos baixos, numa grade mais fina).
    const layers = [{ step: this.cfg.passo_m, biomas: this.cfg.biomas, under: false }];
    const sb = this.cfg.sub_bosque;
    if (sb) layers.push({ step: sb.passo_m, biomas: sb.biomas, under: true });
    const tmpM = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    const mats = [];
    const cols = [];

    for (const layer of layers) {
    const step = layer.step;
    const half = map.half - step;
    const tables = {};
    for (const [biome, table] of Object.entries(layer.biomas)) {
      tables[biome] = Object.entries(table).filter(([t]) => TYPES[t]);
    }
    for (let gz = -half; gz < half; gz += step) {
      for (let gx = -half; gx < half; gx += step) {
        const x = gx + rand() * step;
        const z = gz + rand() * step;
        const r = rand();
        const r2 = rand();
        const r3 = rand();
        const r4 = rand();
        const h = map.heightAt(x, z);
        if (h < 0.4) continue;
        const key = BIOME_KEYS[map.biomeAt(x, z)];
        const table = tables[key];
        if (!table) continue;
        if (avoidPoints.some((pt) => Math.hypot(pt.x - x, pt.z - z) < 9)) continue;

        // clareiras: menos árvores onde a mata é menos densa
        const dens = key === 'selva' ? map.forestDensity(x, z) : 1;
        let acc = 0;
        let type = null;
        for (const [t, chance] of table) {
          acc += chance * (TYPES[t].imp ? dens : 1);
          if (r < acc) {
            type = t;
            break;
          }
        }
        if (!type) continue;
        const def = TYPES[type];
        const wb = this.water.bodyAt(x, z);
        const depth = wb ? wb.level - h : 0;
        if (def.surface) {
          if (!wb || depth < 0.4) continue;
        } else if (wb && (!def.water || depth > 0.9)) {
          continue;
        }
        const ny = map.normalAt(x, z, normal).y;
        if (ny < 0.78 && type !== 'pedra_musgo' && def.collider !== 'log' && !def.rock) continue;
        // pinheiro não sobe nos picos (linha das árvores); minério só no alto
        if (def.cold && h > 75) continue;
        if (type === 'minerio_ferro' && h < 30) continue;
        if (def.rock && ny < 0.3) continue;
        if (map.onPlateau(x, z)) continue; // topo dos platôs: livre para construir
        // sub-bosque: não nasce dentro de troncos e pedras
        if (layer.under) {
          let blocked = false;
          this.byHash.forEachNear(x, z, 3, (o) => {
            if (o.r && Math.hypot(o.x - x, o.z - z) < o.r + 0.5) blocked = true;
            else if (o.log && Math.hypot(o.x - x, o.z - z) < 4.5 * o.scale) blocked = true;
          });
          if (blocked) continue;
        }

        const scale = def.scale[0] + r2 * (def.scale[1] - def.scale[0]);
        const rot = r3 * Math.PI * 2;
        const sink = type === 'pedra_musgo' || def.rock ? 0.2 * scale : def.collider === 'log' ? 0.12 : (type === 'gravetos' || type === 'pedrinhas') ? 0.02 : 0.15;
        // Em morro: apoia no ponto MAIS BAIXO do chão embaixo da planta
        // (senão um lado fica "flutuando").
        let ground = h;
        const foot = (def.foot ?? 0.4) * scale;
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * Math.PI * 2;
          ground = Math.min(ground, map.heightAt(x + Math.cos(a) * foot, z + Math.sin(a) * foot));
        }
        let y = def.surface ? wb.level + 0.03 : ground - sink;
        q.setFromAxisAngle(up, rot);
        if (def.collider === 'log') {
          // tronco caído deita acompanhando a descida do morro
          const hl = (def.log?.[0] ?? 4.3) * scale;
          const hA = map.heightAt(x + Math.cos(rot) * hl, z - Math.sin(rot) * hl);
          const hB = map.heightAt(x - Math.cos(rot) * hl, z + Math.sin(rot) * hl);
          const tilt = Math.atan2(hA - hB, 2 * hl);
          q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), tilt));
          y = Math.min((hA + hB) / 2, h) - sink;
        }
        if (type === 'pedra_musgo' || def.rock) s.set(scale * (0.8 + r4 * 0.5), scale * (0.75 + r4 * 0.4), scale * (1.3 - r4 * 0.5));
        else s.setScalar(scale);
        p.set(x, y, z);
        tmpM.compose(p, q, s);
        for (let k = 0; k < 16; k++) mats.push(tmpM.elements[k]);
        const v = 0.82 + rand() * 0.3;
        if (def.textured) cols.push(v, v, v); // textura já tem a cor certa
        else cols.push(v, v * (0.94 + rand() * 0.12), v * (0.9 + rand() * 0.1));

        const res = def.res ? recursos.tipos[def.res] : null;
        const rec = { id: this.recs.length, type, origType: type, x, y, z, scale, rot, alive: true, cap: res ? res.capacidade : 0 };
        if (def.collider === 'log') {
          const [half, lr, top] = def.log ?? [4.3, 0.45, 0.75];
          const hl = half * scale;
          rec.log = {
            ax: x + Math.cos(rot) * hl, az: z - Math.sin(rot) * hl,
            bx: x - Math.cos(rot) * hl, bz: z + Math.sin(rot) * hl,
            r: lr * scale, top: y + top * scale,
          };
        } else if (def.roots) {
          // árvore gigante: tronco + cada raiz com sua própria colisão
          rec.r = 1.1 * scale;
          const c = Math.cos(rot);
          const sn = Math.sin(rot);
          rec.parts = ROOTS.map((p) => ({ x: x + (p.x * c + p.z * sn) * scale, z: z + (-p.x * sn + p.z * c) * scale, r: p.r * scale, top: y + p.top * scale }));
          this.maxCollider = Math.max(this.maxCollider ?? 0, 8 * scale);
        } else if (def.collider > 0) {
          rec.r = def.collider * (type === 'pedra_musgo' || def.rock ? scale : Math.sqrt(scale));
          if (type === 'pedra_musgo' || def.rock) {
            // pedra esticada: o raio segue o lado mais largo; o topo, a altura de verdade
            rec.r = def.collider * Math.max(s.x, s.z) * (def.rock ? 1.0 : 1);
            rec.top = y + s.y * (def.rock ? 0.95 : 1.0);
          }
          this.maxCollider = Math.max(this.maxCollider ?? 0, rec.r);
        }
        this.recs.push(rec);
        if (rec.log) {
          for (let k = -2; k <= 2; k++) this.byHash.add(rec, x + Math.cos(rot) * k * 2 * scale, z - Math.sin(rot) * k * 2 * scale);
        } else {
          this.byHash.add(rec, x, z);
        }
        const cx = Math.floor(x / CHUNK);
        const cz = Math.floor(z / CHUNK);
        const ck = `${cx},${cz}`;
        if (!this.chunks.has(ck)) {
          const center = new THREE.Vector3((cx + 0.5) * CHUNK, map.heightAt((cx + 0.5) * CHUNK, (cz + 0.5) * CHUNK) + 12, (cz + 0.5) * CHUNK);
          this.chunks.set(ck, { recs: [], sphere: new THREE.Sphere(center, CHUNK * 0.75 + 24) });
        }
        this.chunks.get(ck).recs.push(rec);
      }
    }
    }
    this.matrices = new Float32Array(mats);
    this.colors = new Float32Array(cols);
  }

  // ---------------------------------------------------------
  // Malhas: até 3 por tipo (perto, médio, foto)
  // ---------------------------------------------------------
  _buildTypeMeshes(renderer) {
    const counts = {};
    for (const r of this.recs) counts[r.type] = (counts[r.type] ?? 0) + 1;
    // tipos que viram outros (bananeira -> sem cacho) precisam de espaço extra
    const extra = {};
    for (const [t, def] of Object.entries(TYPES)) {
      const e = def.res && recursos.tipos[def.res]?.esvazia;
      if (e && counts[t]) extra[e] = (extra[e] ?? 0) + counts[t];
    }
    this.types = {};
    for (const [t, def] of Object.entries(TYPES)) {
      const cap = (counts[t] ?? 0) + (extra[t] ?? 0);
      if (!cap) continue;
      const ts = { def, meshes: {}, n: { hi: 0, lo: 0, imp: 0 } };
      const hiGeo = P.ensureUv(def.hi());
      ts.meshes.hi = this._mesh(hiGeo, def.mat ? def.mat() : this.material, cap, `${t}_perto`, def.shadow);
      if (def.lo) ts.meshes.lo = this._mesh(P.ensureUv(def.lo()), this.materialSolid, cap, `${t}_medio`, false);
      if (def.imp && renderer) {
        const imp = renderImpostor(renderer, hiGeo, this.material.map);
        ts.meshes.imp = this._mesh(imp.geometry, makeImpostorMaterial(imp.texture), cap, `${t}_longe`, false);
      }
      this.types[t] = ts;
    }
  }

  _mesh(geometry, material, cap, name, shadow) {
    const m = new THREE.InstancedMesh(geometry, material, cap);
    m.name = name;
    m.frustumCulled = false; // o corte é feito aqui mesmo
    m.castShadow = shadow;
    m.userData.castsShadow = shadow;
    m.setColorAt(0, new THREE.Color(1, 1, 1));
    m.count = 0;
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.group.add(m);
    return m;
  }

  setLod(hi, lo) {
    this.lod.hi = hi;
    this.lod.lo = lo;
    this._last.t = -1;
  }

  setShadows(enabled) {
    for (const ts of Object.values(this.types)) {
      ts.meshes.hi.castShadow = enabled && ts.meshes.hi.userData.castsShadow;
    }
  }

  // ---------------------------------------------------------
  // Separa as plantas visíveis em perto/médio/longe
  // ---------------------------------------------------------
  update(dt, camera, viewDistance, force = false) {
    this._last.t -= dt;
    const cp = camera.position;
    const e = camera.matrixWorld.elements;
    const yaw = Math.atan2(e[8], e[10]);
    const moved = Math.hypot(cp.x - this._last.x, cp.z - this._last.z) > 4;
    const dy = yaw - this._last.yaw;
    const turned = Math.abs(Math.atan2(Math.sin(dy), Math.cos(dy))) > 0.3;
    if (!force && this._last.t > 0 && !moved && !turned) return;
    this._last = { x: cp.x, z: cp.z, yaw, t: 0.3 };

    // Frustum mais largo que a câmera (não "pisca" nas bordas ao virar).
    const cc = this._cullCam;
    cc.copy(camera);
    cc.fov = Math.min(170, camera.fov + 55);
    cc.near = 0.5;
    cc.far = viewDistance + 40;
    cc.updateProjectionMatrix();
    cc.updateMatrixWorld();
    this._m4.multiplyMatrices(cc.projectionMatrix, cc.matrixWorldInverse);
    this._frustum.setFromProjectionMatrix(this._m4);

    for (const ts of Object.values(this.types)) {
      ts.n.hi = 0;
      ts.n.lo = 0;
      ts.n.imp = 0;
    }
    const { hi, lo } = this.lod;
    const M = this.matrices;
    const C = this.colors;
    for (const chunk of this.chunks.values()) {
      const s = chunk.sphere;
      const dc = Math.hypot(s.center.x - cp.x, s.center.z - cp.z);
      if (dc - s.radius > viewDistance) continue;
      if (dc > s.radius && !this._frustum.intersectsSphere(s)) continue;
      for (const rec of chunk.recs) {
        if (!rec.alive) continue;
        const ts = this.types[rec.type];
        if (!ts) continue;
        const d = Math.hypot(rec.x - cp.x, rec.z - cp.z);
        if (d > viewDistance || d > (ts.def.maxDist ?? Infinity)) continue;
        let band = 'hi';
        if (d > hi && ts.meshes.lo) band = 'lo';
        if (d > lo && ts.meshes.imp) band = 'imp';
        const mesh = ts.meshes[band];
        const n = ts.n[band]++;
        mesh.instanceMatrix.array.set(M.subarray(rec.id * 16, rec.id * 16 + 16), n * 16);
        mesh.instanceColor.array.set(C.subarray(rec.id * 3, rec.id * 3 + 3), n * 3);
      }
    }
    for (const ts of Object.values(this.types)) {
      for (const band of ['hi', 'lo', 'imp']) {
        const mesh = ts.meshes[band];
        if (!mesh) continue;
        const n = ts.n[band];
        if (n === 0 && mesh.count === 0) continue;
        mesh.count = n;
        mesh.instanceMatrix.needsUpdate = true;
        mesh.instanceColor.needsUpdate = true;
      }
    }
  }

  // ---------------------------------------------------------
  // Colisão: empurra um círculo para fora de troncos e pedras.
  // feetY = altura dos pés (dá para pular por cima de troncos caídos).
  // ---------------------------------------------------------
  resolveCollisions(pos, radius, feetY = -Infinity) {
    // pedras gigantes: o centro pode estar bem longe da borda
    this.byHash.forEachNear(pos.x, pos.z, radius + Math.max(3, this.maxCollider ?? 0), (rec) => {
      if (!rec.alive) return;
      if (rec.log) {
        const L = rec.log;
        if (feetY > L.top - 0.2) return;
        const abx = L.bx - L.ax;
        const abz = L.bz - L.az;
        const t = Math.max(0, Math.min(1, ((pos.x - L.ax) * abx + (pos.z - L.az) * abz) / (abx * abx + abz * abz)));
        this._push(pos, L.ax + abx * t, L.az + abz * t, radius + L.r);
      } else if (rec.r) {
        if (rec.parts) {
          for (const p of rec.parts) if (feetY < p.top - 0.2) this._push(pos, p.x, p.z, radius + p.r);
        }
        if (rec.top !== undefined && feetY > rec.top - 0.2) return;
        this._push(pos, rec.x, rec.z, radius + rec.r);
      }
    });
  }

  _push(pos, cx, cz, minD) {
    const dx = pos.x - cx;
    const dz = pos.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < minD * minD && d2 > 1e-8) {
      const d = Math.sqrt(d2);
      pos.x += (dx / d) * (minD - d);
      pos.z += (dz / d) * (minD - d);
    }
  }

  // ---------------------------------------------------------
  // Coleta
  // ---------------------------------------------------------
  // Planta na frente do jogador (dirX, dirZ = para onde olha).
  findTarget(px, pz, dirX, dirZ, reach, needColher = false) {
    let best = null;
    let bestScore = Infinity;
    const len = Math.hypot(dirX, dirZ) || 1;
    const fx = dirX / len;
    const fz = dirZ / len;
    this.byHash.forEachNear(px, pz, reach + 3, (rec) => {
      if (!rec.alive) return;
      const def = TYPES[rec.type];
      if (!def.res) return;
      const res = recursos.tipos[def.res];
      if (needColher && !res.colher) return;
      let cx = rec.x;
      let cz = rec.z;
      let rad = rec.r ?? 0.55 * rec.scale;
      if (rec.log) {
        const L = rec.log;
        const abx = L.bx - L.ax;
        const abz = L.bz - L.az;
        const t = Math.max(0, Math.min(1, ((px - L.ax) * abx + (pz - L.az) * abz) / (abx * abx + abz * abz)));
        cx = L.ax + abx * t;
        cz = L.az + abz * t;
        rad = L.r;
      }
      const dx = cx - px;
      const dz = cz - pz;
      const dist = Math.hypot(dx, dz);
      const surf = dist - rad;
      if (surf > reach) return;
      const facing = (dx * fx + dz * fz) / (dist || 1);
      if (facing < 0.35 && surf > 0.4) return;
      const score = surf - facing * 0.6;
      if (score < bestScore) {
        bestScore = score;
        best = rec;
      }
    });
    return best;
  }

  resourceOf(rec) {
    const def = TYPES[rec.type];
    return def?.res ? { key: def.res, ...recursos.tipos[def.res] } : null;
  }

  // Um golpe/colheita: diminui a capacidade; quando acaba, some ou esvazia.
  // remote = true: veio de outro jogador no co-op (não avisa de volta)
  consume(rec, remote = false) {
    const res = this.resourceOf(rec);
    if (!res) return;
    if (res.infinita) return; // nunca acaba (ex.: sumaúma)
    events.emit(EV.VEG_CONSUMED, { rec, remote });
    rec.cap -= 1;
    if (rec.cap > 0) return;
    if (res.esvazia && TYPES[res.esvazia]) {
      rec.type = res.esvazia;
      rec.cap = recursos.tipos[TYPES[res.esvazia].res]?.capacidade ?? 5;
    } else {
      rec.alive = false;
    }
    rec.respawnAt = performance.now() / 1000 + recursos.reaparece_min * 60;
    if (!this.depleted.includes(rec)) this.depleted.push(rec);
    this._last.t = -1;
  }

  // Esgota de vez (co-op: ao entrar numa partida em andamento).
  consumeAll(rec) {
    rec.cap = 1;
    this.consume(rec, true);
  }

  // Recursos voltam depois de um tempo (se o jogador estiver longe).
  updateRespawn(playerPos) {
    if (!this.depleted.length) return;
    const now = performance.now() / 1000;
    this.depleted = this.depleted.filter((rec) => {
      if (now < rec.respawnAt) return true;
      if (Math.hypot(rec.x - playerPos.x, rec.z - playerPos.z) < 40) return true;
      rec.alive = true;
      rec.type = rec.origType;
      const res = this.resourceOf(rec);
      rec.cap = res ? res.capacidade : 0;
      this._last.t = -1;
      return false;
    });
  }

  countByType() {
    const out = {};
    for (const rec of this.recs) out[rec.type] = (out[rec.type] ?? 0) + 1;
    return out;
  }
}

export { TYPES as VEGETATION_TYPES };
