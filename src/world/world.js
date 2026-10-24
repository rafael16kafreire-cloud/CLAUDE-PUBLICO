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
import { Sky } from './sky.js';
import { Effects } from './effects.js';
import { findRespawnPoints } from './respawn_points.js';
import { DeathBag } from './death_bag.js';
import { sharedTime } from './materials.js';

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
    this.deathBags = [];
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
    return this.respawnPoints.find((p) => p.id === id) ?? this.respawnPoints[0];
  }

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

  resolveCollisions(pos, radius, feetY) {
    this.vegetation.resolveCollisions(pos, radius, feetY);
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
  _updateAltitude(camera) {
    const base = this.baseViewDistance ?? this.viewDistance;
    const alt = camera.position.y - Math.max(this.heightAt(camera.position.x, camera.position.z), 0);
    const k = 1 + Math.min(2.2, Math.max(0, (alt - 14) / 45));
    const want = Math.round(base * k);
    if (Math.abs(want - this.viewDistance) > base * 0.04) {
      this._applyViewDistance(want);
      camera.far = want + 40;
      camera.updateProjectionMatrix();
    }
  }

  setQuality(q) {
    this.sky.setShadows(q.shadows, q.shadowMap, q.shadowRange);
    this.vegetation.setShadows(q.shadows);
    this.vegetation.setLod(q.lodHi, q.lodLo);
    this.grass.setQuality(q.grassRadius, q.grassDensity);
    this.grass.setEnabled(q.grassRadius > 0);
  }

  // ---------- atualização por quadro ----------
  update(dt, camera, focus) {
    sharedTime.value += dt;
    this._updateAltitude(camera);
    this.sky.update(camera, focus);
    this.grass.update(focus);
    this.vegetation.update(dt, camera, this.viewDistance);
    this.effects.update(dt);

    const body = this.water.bodyAt(camera.position.x, camera.position.z);
    this.sky.setUnderwater(!!body && camera.position.y < body.level - 0.05);

    for (const bag of this.deathBags) bag.update(dt);
    this.deathBags = this.deathBags.filter((b) => !b.removed);

    this._respawnTimer -= dt;
    if (this._respawnTimer <= 0) {
      this._respawnTimer = 2;
      this.vegetation.updateRespawn(focus);
    }
  }
}
