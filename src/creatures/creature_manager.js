// =============================================================
// GERENCIADOR DE CRIATURAS
// - Faz nascer criaturas perto do jogador, de acordo com o bioma
//   (no máximo 15 ativas – balanceamento: desempenho).
// - Remove as que ficaram longe (economiza o celular).
// - Resolve ataques, mortes, XP e colisão com o jogador.
// =============================================================
import * as THREE from 'three';
import data from '../data/creatures/criaturas.json';
import { BALANCE } from '../core/balance.js';
import { events, EV } from '../core/event_bus.js';
import { game } from '../core/game_manager.js';
import { mulberry32 } from '../core/math.js';
import { MODELS } from './creature_models.js';
import { buildSpeciesModel, createSkinnedMesh } from './creature_builder.js';
import { Creature, CSTATE } from './creature.js';

export const SPECIES = Object.fromEntries(data.especies.map((s) => [s.id, s]));

export class CreatureManager {
  constructor(world, scene) {
    this.world = world;
    this.scene = scene;
    this.list = [];
    this.models = {};
    this.material = new THREE.MeshLambertMaterial({ vertexColors: true });
    this.rand = mulberry32((Date.now() & 0xffff) + 17);
    this.spawnTimer = 0;
    this.enabled = true;
    const C = BALANCE.criaturas;
    this.cfg = C;
  }

  get maxActive() {
    return BALANCE.desempenho.criaturas_max_ativas;
  }

  _model(id) {
    if (!this.models[id]) this.models[id] = buildSpeciesModel(MODELS[id]);
    return this.models[id];
  }

  // Cria uma criatura. level = nível (1 a 30), opcional.
  spawn(id, x, z, level) {
    const species = SPECIES[id];
    if (!species) return null;
    const model = this._model(id);
    const { mesh, bones } = createSkinnedMesh(model, this.material);
    mesh.name = species.nome;
    const lvl = level ?? 1 + Math.floor(Math.pow(this.rand(), 1.7) * 29);
    const c = new Creature({
      species, spec: MODELS[id], mesh, bones, level: lvl, x, z,
      world: this.world, manager: this, rand: this.rand,
    });
    this.scene.add(mesh);
    this.list.push(c);
    return c;
  }

  remove(c) {
    this.scene.remove(c.mesh);
    c.mesh.skeleton?.dispose?.();
    this.list = this.list.filter((o) => o !== c);
  }

  clear() {
    for (const c of [...this.list]) this.remove(c);
  }

  // ---------------------------------------------------------
  update(dt, player, camera) {
    const ctx = { player, world: this.world, camPos: camera.position };
    for (const c of this.list) {
      c.update(dt, ctx);
      // Sombra só para as que estão perto.
      c.mesh.castShadow = c.pos.distanceTo(camera.position) < 45;
    }
    this._separate();

    // Remove mortas antigas e as que ficaram longe.
    const despawn = this.cfg.raio_despawn_m;
    for (const c of [...this.list]) {
      const d = Math.hypot(c.pos.x - player.position.x, c.pos.z - player.position.z);
      const chasingPlayer = c.target === player;
      if ((c.state === CSTATE.DEAD && c.deadTime > this.cfg.corpo_dura_seg) || (d > despawn && !chasingPlayer)) {
        this.remove(c);
      }
    }

    game.activeCreatures = this.list.filter((c) => c.alive).length;

    if (!this.enabled || player.dead) return;
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = this.cfg.intervalo_spawn_seg;
      this.trySpawnNear(player.position);
    }
  }

  // Tenta criar um grupo num ponto aleatório em volta do jogador.
  trySpawnNear(center, minR = this.cfg.raio_spawn_min_m, maxR = this.cfg.raio_spawn_max_m) {
    const alive = this.list.filter((c) => c.alive).length;
    if (alive >= this.maxActive) return false;
    for (let attempt = 0; attempt < 6; attempt++) {
      const a = this.rand() * Math.PI * 2;
      const r = minR + this.rand() * (maxR - minR);
      const x = center.x + Math.sin(a) * r;
      const z = center.z + Math.cos(a) * r;
      if (Math.hypot(x, z) > BALANCE.mundo.limite_raio_m - 40) continue;
      const biome = this.world.biomeKeyAt(x, z);
      if (biome === 'mar') continue;
      const inWater = !!this.world.waterAt(x, z);
      const options = Object.values(SPECIES).filter((s) =>
        s.biomas.includes(biome) && (s.voa || !inWater || s.nada));
      if (!options.length) continue;
      const total = options.reduce((acc, s) => acc + s.peso_spawn, 0);
      let pick = this.rand() * total;
      let species = options[0];
      for (const s of options) {
        pick -= s.peso_spawn;
        if (pick <= 0) {
          species = s;
          break;
        }
      }
      // Não lota de gigantes: no máximo 2 iguais raros por perto.
      if (species.peso_spawn < 2 && this.list.filter((c) => c.species.id === species.id).length >= 2) continue;
      const [gmin, gmax] = species.grupo;
      const size = Math.min(this.maxActive - alive, gmin + Math.floor(this.rand() * (gmax - gmin + 1)));
      const level = 1 + Math.floor(Math.pow(this.rand(), 1.7) * 29);
      for (let i = 0; i < size; i++) {
        const ox = x + (this.rand() - 0.5) * 8 * Math.max(1, species.raio);
        const oz = z + (this.rand() - 0.5) * 8 * Math.max(1, species.raio);
        // grupo com níveis parecidos
        this.spawn(species.id, ox, oz, Math.max(1, Math.min(30, level + Math.floor((this.rand() - 0.5) * 6))));
      }
      return true;
    }
    return false;
  }

  // Bando: os iguais por perto também atacam.
  alertPack(c, target) {
    for (const o of this.list) {
      if (o !== c && o.alive && o.species.id === c.species.id && o.pos.distanceTo(c.pos) < 30 && !o.target) {
        o._chase(target);
      }
    }
  }

  // Presa para carnívoros: herbívoro menor e por perto.
  findPrey(hunter) {
    let best = null;
    let bestD = (hunter.species.alcance_agro ?? 20) * 0.8;
    for (const o of this.list) {
      if (!o.alive || o === hunter || o.flies || o.species.dieta !== 'herbivoro') continue;
      if (o.species.raio > hunter.species.raio * 1.4) continue;
      const d = o.pos.distanceTo(hunter.pos);
      if (d < bestD) {
        best = o;
        bestD = d;
      }
    }
    return best;
  }

  // Uma criatura acertou alguém.
  hit(attacker, target, amount) {
    if (target === game.player) {
      const p = game.player;
      if (p.dead) return;
      p.stats.damage(amount, `criatura:${attacker.species.nome}`);
      // empurrão para trás
      const dx = p.position.x - attacker.pos.x;
      const dz = p.position.z - attacker.pos.z;
      const len = Math.hypot(dx, dz) || 1;
      p.velocity.x += (dx / len) * Math.min(8, amount * 0.15);
      p.velocity.z += (dz / len) * Math.min(8, amount * 0.15);
      events.emit(EV.PLAYER_HURT, { amount, source: attacker.species.nome });
    } else if (target.takeDamage) {
      target.takeDamage(amount, attacker);
    }
  }

  onDeath(c, attacker) {
    events.emit(EV.CREATURE_KILLED, { creature: c, byPlayer: attacker === game.player });
    if (attacker === game.player) {
      const xp = Math.round(c.species.xp * (1 + c.level * 0.05));
      game.player.stats.addXP(xp);
      events.emit(EV.MESSAGE, { text: `${c.species.nome} abatido! +${xp} XP`, kind: 'gain' });
    } else if (attacker && attacker.state !== undefined) {
      // predador come a presa
      attacker.target = null;
      attacker._setState(CSTATE.EAT);
      attacker.idleFor = 10;
    }
  }

  // Ataque do jogador (soco): acerta a criatura na frente.
  playerAttack(player, forward, damage, reach) {
    let best = null;
    let bestD = Infinity;
    const p = player.position;
    for (const c of this.list) {
      if (!c.alive) continue;
      const center = c.center();
      const dx = center.x - p.x;
      const dz = center.z - p.z;
      const dy = center.y - (p.y + 1.2);
      const d = Math.hypot(dx, dz);
      if (d - c.radius > reach || Math.abs(dy) > c.height * 0.8 + 1.5) continue;
      // precisa estar mais ou menos na frente
      const dot = (dx * forward.x + dz * forward.z) / (d || 1) / (Math.hypot(forward.x, forward.z) || 1);
      if (d > c.radius + 0.6 && dot < 0.45) continue;
      if (d < bestD) {
        best = c;
        bestD = d;
      }
    }
    if (best) best.takeDamage(damage, player);
    return best;
  }

  // Criatura na mira (para mostrar nome, nível e vida).
  findAimed(origin, dir, maxDist) {
    let best = null;
    let bestT = maxDist;
    const tmp = new THREE.Vector3();
    for (const c of this.list) {
      const center = c.center(tmp);
      const to = center.sub(origin);
      const t = to.dot(dir);
      if (t < 0 || t > bestT) continue;
      const perp2 = to.lengthSq() - t * t;
      const r = Math.max(c.radius, c.height * 0.5) * 1.1;
      if (perp2 < r * r) {
        best = c;
        bestT = t;
      }
    }
    return best;
  }

  // Empurra o jogador para fora do corpo das criaturas.
  resolvePlayer(pos, radius) {
    for (const c of this.list) {
      if (c.flies && c.alive) continue;
      if (pos.y > c.pos.y + c.height) continue;
      const dx = pos.x - c.pos.x;
      const dz = pos.z - c.pos.z;
      const minD = radius + c.radius * 0.8;
      const d2 = dx * dx + dz * dz;
      if (d2 < minD * minD && d2 > 1e-6) {
        const d = Math.sqrt(d2);
        pos.x += (dx / d) * (minD - d);
        pos.z += (dz / d) * (minD - d);
      }
    }
  }

  // Criaturas não ficam umas dentro das outras.
  _separate() {
    const L = this.list;
    for (let i = 0; i < L.length; i++) {
      const a = L[i];
      if (!a.alive || a.flies) continue;
      for (let j = i + 1; j < L.length; j++) {
        const b = L[j];
        if (!b.alive || b.flies) continue;
        const dx = b.pos.x - a.pos.x;
        const dz = b.pos.z - a.pos.z;
        const minD = (a.radius + b.radius) * 0.8;
        const d2 = dx * dx + dz * dz;
        if (d2 < minD * minD && d2 > 1e-6) {
          const d = Math.sqrt(d2);
          const push = (minD - d) * 0.5;
          const wa = b.radius / (a.radius + b.radius);
          a.pos.x -= (dx / d) * push * 2 * wa;
          a.pos.z -= (dz / d) * push * 2 * wa;
          b.pos.x += (dx / d) * push * 2 * (1 - wa);
          b.pos.z += (dz / d) * push * 2 * (1 - wa);
        }
      }
    }
  }
}
