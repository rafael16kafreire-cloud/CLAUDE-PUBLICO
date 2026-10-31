// =============================================================
// MUNDO – junta tudo: ilha, terreno, água, floresta, mato do chão,
// céu, efeitos, pontos de renascer e sacos (de morte ou de itens).
// Os outros sistemas perguntam ao mundo coisas como "qual a altura
// do chão aqui?".
// =============================================================
import layout from '../data/world/ilha.json';
import { BALANCE } from '../core/balance.js';
import { IslandMap, BIOME_KEYS } from './island_generator.js';
import { buildTerrain } from './terrain.js';
import { WaterSystem } from './water.js';
import { Vegetation } from './vegetation.js';
import { Grass } from './grass.js';
import { Sky, NIGHT_START, NIGHT_END } from './sky.js';
import { Effects } from './effects.js';
import { Underwater } from './underwater.js';
import { findRespawnPoints } from './respawn_points.js';
import { DeathBag } from './death_bag.js';
import { sharedTime } from './materials.js';
import { createStructure } from './structures.js';
import { Projectiles } from './projectiles.js';
import { BuildPiece, PIECES } from './building.js';
import recipes from '../data/crafting/receitas.json';
import { events, EV } from '../core/event_bus.js';
import * as THREE from 'three';

export class World {
  constructor(scene, renderer) {
    this.scene = scene;
    this.layout = layout;
    this.seed = BALANCE.mundo.semente;
    this.viewDistance = 180;

    const t0 = performance.now();
    this.map = new IslandMap(layout, this.seed);
    this.terrain = buildTerrain(this.map, layout.tamanho_pedaco_celulas);
    scene.add(this.terrain.group);

    this.water = new WaterSystem(this.map, scene);
    this.respawnPoints = findRespawnPoints(this.map, layout);
    this.vegetation = new Vegetation(
      this.map,
      this.water,
      this.respawnPoints.map((p) => p.position),
      layout,
      this.seed,
      renderer,
    );
    scene.add(this.vegetation.group);
    this.grass = new Grass(this.map, this.water, scene);
    this.sky = new Sky(scene);
    this.effects = new Effects(scene);
    this.projectiles = new Projectiles(this);
    this.effects.groundAt = (x, z) => this.heightAt(x, z);
    this.underwater = new Underwater(scene);
    this.deathBags = [];
    this.structures = [];   // fogueiras, sacos de dormir...
    this.time = BALANCE.dia.hora_inicial;
    this.day = 1;
    this.timeFrozen = false;
    this.sky.setTime(this.time);
    // Luzes de fogo: SEMPRE na cena (ligar/desligar luz faz o celular
    // recompilar tudo); a da fogueira vai para a fogueira acesa mais perto.
    this.fireLight = new THREE.PointLight('#ff9a48', 0, 16, 1.6);
    this.torchLight = new THREE.PointLight('#ffb060', 0, 14, 1.5);
    scene.add(this.fireLight, this.torchLight);
    this.localPlayer = null;     // definidos pelo main.js
    this.localInventory = null;
    this.multiplayer = null;
    this.generationMs = Math.round(performance.now() - t0);
    this._respawnTimer = 0;
  }

  // ---------- consultas ----------
  heightAt(x, z) {
    return this.map.heightAt(x, z);
  }

  waterAt(x, z) {
    return this.water.bodyAt(x, z);
  }

  // Chave do bioma ("selva", "pantano"...). Água conta como bioma.
  // Altura da onda na superfície da água neste ponto.
  waveHeightAt(x, z) {
    return this.water.waveAt(this.water.bodyAt(x, z), x, z, sharedTime.value);
  }

  biomeKeyAt(x, z) {
    const water = this.water.bodyAt(x, z);
    if (water) return water.id === 'mar' ? 'mar' : 'pantano';
    return BIOME_KEYS[this.map.biomeAt(x, z)];
  }

  biomeInfo(key) {
    return layout.biomas[key] ?? { nome: key, descricao: '', temperatura_c: 0 };
  }

  biomeNameAt(x, z) {
    return this.biomeInfo(this.biomeKeyAt(x, z)).nome;
  }

  respawnPoint(id) {
    const extra = this.allRespawnPoints.find((p) => p.id === id);
    if (extra) return extra;
    return this.respawnPoints.find((p) => p.id === id) ?? this.respawnPoints[0];
  }

  temperatureAt(pos, inWater) {
    const T = BALANCE.temperatura;
    let t = T.base_c - Math.max(0, pos.y) * T.queda_por_metro;
    t += this.biomeInfo(BIOME_KEYS[this.map.biomeAt(pos.x, pos.z)]).temperatura_c ?? 0;
    if (inWater) t += T.na_agua_c;
    t += (1 - this.sky.daylight) / 0.82 * BALANCE.dia.frio_noite_c;
    for (const s of this.structures) if (s.warmthAt) t += s.warmthAt(pos);
    return t;
  }

  get interactables() {
    return [...this.deathBags, ...this.structures];
  }

  // Pontos de renascer: praias + sacos de dormir colocados.
  get allRespawnPoints() {
    return [...this.respawnPoints, ...this.structures.filter((s) => s.respawnPoint && !s.removed).map((s) => s.respawnPoint)];
  }

  // Coloca uma estrutura (fogueira, saco de dormir). d = { type, x, y, z, rot, id? }
  addStructure(d) {
    if (d.id && this.structures.some((s) => s.id === d.id)) return null;
    let s;
    if (PIECES.includes(d.type)) {
      s = new BuildPiece(this, d.type, new THREE.Vector3(d.x, d.y, d.z), d.rot, d.id);
      if (d.open) s.applyState({ open: true }); // porta aberta
      if (typeof d.hp === 'number') s.hp = Math.min(s.maxHp, d.hp);
    } else s = createStructure(this, d);
    if (s) this.structures.push(s);
    return s;
  }

  removeStructure(s) {
    s.remove();
    events.emit(EV.STRUCTURE_REMOVED, { structure: s });
  }

  recipeFor(type) {
    return recipes.receitas.find((r) => r.resultado === type);
  }

  // Chão onde se pisa: terreno ou piso/teto/rampa construído
  // (só conta superfície que não esteja muito acima de y).
  groundAt(x, z, y = Infinity) {
    let g = this.heightAt(x, z);
    for (const s of this.structures) {
      if (!s.isBuild || s.removed) continue;
      const top = s.surfaceAt(x, z);
      if (top !== null && top <= y + 0.6 && top > g) g = top;
    }
    return g;
  }

  structureById(id) {
    return this.structures.find((s) => s.id === id);
  }

  // Dormir: pula para o amanhecer.
  skipToMorning() {
    if (this.time > 0.5) this.day += 1;
    this.time = 0.26;
    events.emit(EV.MESSAGE, { text: `Você dormiu. Dia ${this.day} amanheceu.`, kind: 'gain' });
    events.emit(EV.DAWN, { day: this.day, slept: true });
  }

  resolveCollisions(pos, radius, feetY, height) {
    this.vegetation.resolveCollisions(pos, radius, feetY);
    for (const s of this.structures) if (s.isBuild && !s.removed) s.collide(pos, radius, feetY, height);
  }

  // ---------- sacos de morte / itens largados ----------
  spawnDeathBag(position, items = [], label) {
    const bag = new DeathBag(this.scene, position, items, label);
    this.deathBags.push(bag);
    return bag;
  }

  // ---------- opções ----------
  setViewDistance(d) {
    this.baseViewDistance = d;
    this._applyViewDistance(d);
  }

  _applyViewDistance(d) {
    this.viewDistance = d;
    this.sky.setViewDistance(d);
  }

  // No alto (morro, menu, voando) a neblina abre e dá para ver longe:
  // a floresta distante vira "fotos" leves (impostores).
  _updateAltitude(camera, dt = 0.016) {
    const base = this.baseViewDistance ?? this.viewDistance;
    const alt = camera.position.y - Math.max(this.heightAt(camera.position.x, camera.position.z), 0);
    // Lapônia: o ar é limpo, dá para ver as montanhas de longe
    const cold = this.map.snowRegion(camera.position.x, camera.position.z);
    this.sky.cold = (this.sky.cold ?? 0) + (cold - (this.sky.cold ?? 0)) * Math.min(1, dt * 0.8);
    const k = (1 + Math.min(2.2, Math.max(0, (alt - 14) / 45))) * (1 + this.sky.cold * 1.3);
    const want = Math.round(base * k);
    if (Math.abs(want - this.viewDistance) > base * 0.04) {
      this._applyViewDistance(want);
      camera.far = want + 40;
      camera.updateProjectionMatrix();
    }
    // neblina leve nos morros da mata (chão alto, fora da neve)
    const ground = Math.max(this.heightAt(camera.position.x, camera.position.z), 0);
    const hill = Math.min(1, Math.max(0, (ground - 14) / 26));
    const mist = hill * hill * (3 - 2 * hill) * (1 - cold);
    this.sky.mist = (this.sky.mist ?? 0) + (mist - (this.sky.mist ?? 0)) * Math.min(1, dt * 0.5);
    if (!this.sky.underwater) this.sky.scene.fog.density = (2.0 / this.viewDistance) * (1 + this.sky.mist * 1.6);
  }

  setQuality(q) {
    this.sky.setShadows(q.shadows, q.shadowMap, q.shadowRange);
    this.vegetation.setShadows(q.shadows);
    this.vegetation.setLod(q.lodHi, q.lodLo);
    this.grass.setQuality(q.grassRadius, q.grassDensity);
    this.grass.setEnabled(q.grassRadius > 0);
  }

  // ---------- atualização por quadro ----------
  // Avança o relógio. De dia e de noite ele anda em velocidades
  // diferentes: o dia claro dura duracao_dia_min e a noite duracao_noite_min.
  advanceTime(dt) {
    const prev = this.time;
    const night = this.time < NIGHT_END || this.time > NIGHT_START;
    const span = night ? 1 - (NIGHT_START - NIGHT_END) : NIGHT_START - NIGHT_END;
    const mins = night ? BALANCE.dia.duracao_noite_min : BALANCE.dia.duracao_dia_min;
    this.time += (dt / (mins * 60)) * span;
    if (this.time >= 1) {
      this.time -= 1;
      this.day += 1;
    }
    if (prev < 0.25 && this.time >= 0.25) events.emit(EV.DAWN, { day: this.day });
    if (prev < NIGHT_START && this.time >= NIGHT_START) events.emit(EV.DUSK, { day: this.day });
    this.sky.setTime(this.time);
  }

  update(dt, camera, focus) {
    sharedTime.value += dt;
    if (!this.timeFrozen) this.advanceTime(dt);
    this.sky.setTime(this.time);
    for (const s of this.structures) s.update?.(dt);
    this.structures = this.structures.filter((s) => !s.removed);
    this.projectiles.update(dt);
    // luz da fogueira acesa mais perto
    let best = null;
    let bd = 60;
    for (const s of this.structures) {
      if (!s.lit) continue;
      const d = Math.hypot(s.position.x - focus.x, s.position.z - focus.z);
      if (d < bd) {
        bd = d;
        best = s;
      }
    }
    if (best) {
      this.fireLight.position.copy(best.position).setY(best.position.y + 1.1);
      this.fireLight.intensity = (2 + (1 - this.sky.daylight) * 10) * best.flicker;
    } else {
      this.fireLight.intensity = 0;
    }
    this._updateAltitude(camera, dt);
    this.sky.update(camera, focus);
    this.grass.update(focus);
    this.vegetation.update(dt, camera, this.viewDistance);
    this.effects.update(dt);

    this.water.update(camera);
    const body = this.water.bodyAt(camera.position.x, camera.position.z);
    const surf = body ? body.level + this.water.waveAt(body, camera.position.x, camera.position.z, sharedTime.value) : 0;
    const under = !!body && camera.position.y < surf - 0.05;
    this.cameraUnderwater = under;
    this.sky.setUnderwater(under, body?.under);
    this.underwater.set(under, body?.under, surf);
    this.underwater.update(dt, camera, this.sky.daylight);

    for (const bag of this.deathBags) bag.update(dt);
    this.deathBags = this.deathBags.filter((b) => !b.removed);

    this._respawnTimer -= dt;
    if (this._respawnTimer <= 0) {
      this._respawnTimer = 2;
      this.vegetation.updateRespawn(focus);
    }
  }
}
