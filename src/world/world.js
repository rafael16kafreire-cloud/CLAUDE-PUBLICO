// =============================================================
// MUNDO – junta tudo: ilha, terreno, água, vegetação, grama, céu,
// pontos de renascer e sacos de morte. Os outros sistemas
// perguntam ao mundo coisas como "qual a altura do chão aqui?".
// =============================================================
import layout from '../data/world/ilha.json';
import { BALANCE } from '../core/balance.js';
import { IslandMap, BIOME_KEYS } from './island_generator.js';
import { buildTerrain } from './terrain.js';
import { WaterSystem } from './water.js';
import { Vegetation } from './vegetation.js';
import { Grass } from './grass.js';
import { Sky } from './sky.js';
import { findRespawnPoints } from './respawn_points.js';
import { DeathBag } from './death_bag.js';
import { sharedTime } from './materials.js';

export class World {
  constructor(scene) {
    this.scene = scene;
    this.layout = layout;
    this.seed = BALANCE.mundo.semente;
    this.viewDistance = 250;

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
    );
    scene.add(this.vegetation.group);
    this.grass = new Grass(this.map, this.water, scene);

    this.sky = new Sky(scene);
    this.deathBags = [];
    this.extraInteractables = []; // criaturas mortas etc. (preenchido por outros sistemas)
    this.generationMs = Math.round(performance.now() - t0);
    this._visTimer = 0;
  }

  // ---------- consultas ----------
  heightAt(x, z) {
    return this.map.heightAt(x, z);
  }

  waterAt(x, z) {
    return this.water.bodyAt(x, z);
  }

  // Chave do bioma ("selva", "deserto"...). Água conta como bioma.
  biomeKeyAt(x, z) {
    const water = this.water.bodyAt(x, z);
    if (water) return water.id === 'mar' ? 'mar' : water.id === 'lago' ? 'lago' : 'pantano';
    return BIOME_KEYS[this.map.biomeAt(x, z)];
  }

  biomeInfo(key) {
    return layout.biomas[key] ?? { nome: key, descricao: '', temperatura_c: 0 };
  }

  biomeNameAt(x, z) {
    return this.biomeInfo(this.biomeKeyAt(x, z)).nome;
  }

  respawnPoint(id) {
    return this.respawnPoints.find((p) => p.id === id) ?? this.respawnPoints[0];
  }

  // Temperatura do ambiente (°C): altitude + bioma + água.
  // Fase 4 adiciona hora do dia, clima e roupas.
  temperatureAt(pos, inWater) {
    const T = BALANCE.temperatura;
    let t = T.base_c - Math.max(0, pos.y) * T.queda_por_metro;
    t += this.biomeInfo(BIOME_KEYS[this.map.biomeAt(pos.x, pos.z)]).temperatura_c ?? 0;
    if (inWater) t += T.na_agua_c;
    return t;
  }

  get interactables() {
    return this.deathBags;
  }

  resolveCollisions(pos, radius) {
    this.vegetation.resolveCollisions(pos, radius);
  }

  // ---------- sacos de morte ----------
  spawnDeathBag(position, items = []) {
    const bag = new DeathBag(this.scene, position, items);
    this.deathBags.push(bag);
    return bag;
  }

  // ---------- opções ----------
  setViewDistance(d) {
    this.viewDistance = d;
    this.sky.setViewDistance(d);
  }

  setShadows(enabled, mapSize) {
    this.sky.setShadows(enabled, mapSize);
    this.vegetation.setShadows(enabled);
  }

  setGrass(enabled) {
    this.grass.setEnabled(enabled);
  }

  // ---------- atualização por quadro ----------
  update(dt, camera, focus) {
    sharedTime.value += dt;
    this.sky.update(camera, focus);
    this.grass.update(focus);

    const body = this.water.bodyAt(camera.position.x, camera.position.z);
    this.sky.setUnderwater(!!body && camera.position.y < body.level - 0.05);

    for (const bag of this.deathBags) bag.update(dt);
    this.deathBags = this.deathBags.filter((b) => !b.removed);

    this._visTimer -= dt;
    if (this._visTimer <= 0) {
      this._visTimer = 0.25;
      this.vegetation.updateVisibility(camera.position, this.viewDistance);
    }
  }
}
