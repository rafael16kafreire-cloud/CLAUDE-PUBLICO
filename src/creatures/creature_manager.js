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
import { itemName } from '../items/items.js';
import { events, EV } from '../core/event_bus.js';
import { game } from '../core/game_manager.js';
import { mulberry32 } from '../core/math.js';
import { MODELS } from './creature_models.js';
import { buildSpeciesModel, createSkinnedMesh } from './creature_builder.js';
import { makeCreatureMaterial } from './creature_material.js';
import { IMPORTED, buildImportedModel } from './imported_model.js';
import { ESPINO_COR_HD, ESPINO_RELEVO_HD } from '../world/textures/hd.js';
import { hdTextures } from '../core/settings.js';
import { Creature, CSTATE } from './creature.js';
import { sound } from '../audio/audio.js';
import { settings } from '../core/settings.js';

export const SPECIES = Object.fromEntries(data.especies.map((s) => [s.id, s]));

export class CreatureManager {
  constructor(world, scene) {
    this.world = world;
    this.scene = scene;
    this.list = [];
    this.models = {};
    this.material = makeCreatureMaterial();
    this.rand = mulberry32((Date.now() & 0xffff) + 17);
    this.spawnTimer = 0;
    this.enabled = true;
    this.remotePlayers = [];   // co-op: outros jogadores (no anfitrião)
    this.net = null;           // co-op: conexão (definida pelo multiplayer)
    this.netClient = false;    // true = convidado: criaturas vêm do anfitrião
    const C = BALANCE.criaturas;
    this.cfg = C;
  }

  // Limite de bichos por perto (45 em qualquer qualidade); na neve
  // (Lapônia) tem mais – balanceamento.js → desempenho.
  get maxActive() {
    const base = settings.quality?.creatures ?? BALANCE.desempenho.criaturas_max_ativas;
    const p = game.player?.position;
    const snow = p && this.world.biomeKeyAt(p.x, p.z) === 'neve';
    return base + (snow ? BALANCE.desempenho.extra_na_neve : 0);
  }

  // Limite de carnívoros cresce junto com o de bichos (4 a cada 20).
  get maxCarnivores() {
    return Math.max(2, Math.round(BALANCE.dificuldade.max_carnivoros_perto * Math.max(1, this.maxActive / 20)));
  }

  _model(id) {
    // espécies com modelo importado (ex.: espinossauro) usam ele;
    // as outras são feitas por código
    if (!this.models[id]) {
      let d = IMPORTED[id];
      // qualidade alta: textura e relevo em 2048 px
      if (d && id === 'espinossauro' && hdTextures()) d = { ...d, map: ESPINO_COR_HD, normalMap: ESPINO_RELEVO_HD };
      this.models[id] = d ? buildImportedModel(d) : buildSpeciesModel(MODELS[id]);
    }
    return this.models[id];
  }

  // Cria uma criatura. level = nível (1 a 30), opcional.
  spawn(id, x, z, level) {
    const species = SPECIES[id];
    if (!species) return null;
    const model = this._model(id);
    const { mesh, bones } = createSkinnedMesh(model, model.material ?? this.material);
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
    const players = [player, ...this.remotePlayers];
    const ctx = { player, players, world: this.world, camPos: camera.position };
    for (const c of this.list) {
      c.update(dt, ctx);
      // Sombra só para as que estão perto.
      c.mesh.castShadow = c.pos.distanceTo(camera.position) < 32;
    }
    this._separate();

    // Remove mortas antigas e as que ficaram longe.
    const despawn = this.cfg.raio_despawn_m;
    if (this.netClient) {
      // convidado: some quando o anfitrião para de mandar
      for (const c of [...this.list]) if (c.netControlled && c.netSeen > 2.5) this.remove(c);
      game.activeCreatures = this.list.filter((c) => c.alive).length;
      return;
    }
    for (const c of [...this.list]) {
      let d = Infinity;
      for (const p of players) d = Math.min(d, Math.hypot(c.pos.x - p.position.x, c.pos.z - p.position.z));
      const chasingPlayer = players.includes(c.target);
      const keep = c.tamed && c.alive; // domado nunca some
      if ((c.state === CSTATE.DEAD && c.deadTime > this.cfg.corpo_dura_seg) || (d > despawn && !chasingPlayer && !keep)) {
        this.remove(c);
      }
    }

    game.activeCreatures = this.list.filter((c) => c.alive && !c.species.ambiente).length;

    if (!this.enabled || player.dead) return;
    this.clock = (this.clock ?? 0) + dt;
    this._breedT = (this._breedT ?? 15) - dt;
    if (this._breedT <= 0) {
      this._breedT = 15;
      this.tryBreed(players);
    }
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = this.cfg.intervalo_spawn_seg;
      // co-op: nasce em volta de um jogador sorteado
      const alivePlayers = players.filter((p) => !p.dead);
      const who = alivePlayers[Math.floor(this.rand() * alivePlayers.length)] ?? player;
      this.trySpawnNear(who.position);
      this.trySpawnNear(who.position, undefined, undefined, true);
      this._swampT = (this._swampT ?? 0) - this.cfg.intervalo_spawn_seg;
      if (this._swampT <= 0) {
        this._swampT = 4;
        for (const p of alivePlayers) this.ensureSwampResidents(p.position);
      }
    }
  }

  // Tenta criar um grupo num ponto aleatório em volta do jogador.
  // ambient = true: só animais de enfeite (araras), com limite próprio.
  trySpawnNear(center, minR = this.cfg.raio_spawn_min_m, maxR = this.cfg.raio_spawn_max_m, ambient = false) {
    const alive = this.list.filter((c) => c.alive && !!c.species.ambiente === ambient).length;
    const cap = ambient ? this.cfg.max_ambiente : this.maxActive;
    if (alive >= cap) return false;
    for (let attempt = 0; attempt < 6; attempt++) {
      const a = this.rand() * Math.PI * 2;
      const r = minR + this.rand() * (maxR - minR);
      const x = center.x + Math.sin(a) * r;
      const z = center.z + Math.cos(a) * r;
      if (!this.world.map.inside(x, z, 40)) continue;
      const biome = this.world.biomeKeyAt(x, z);
      // no mar só nasce bicho do mar (mosassauro)
      if (biome === 'mar' && ambient) continue;
      const w = this.world.waterAt(x, z);
      const depth = w ? w.level - this.world.heightAt(x, z) : 0;
      // Dificuldade: zonas seguras, começo tranquilo, limite de carnívoros
      const D = BALANCE.dificuldade;
      const isCarn = (s) => s.temperamento === 'agressivo' && !s.ambiente;
      const safe = this.world.allRespawnPoints.some((p) => Math.hypot(p.position.x - x, p.position.z - z) < D.zona_segura_m);
      const early = (game.player?.aliveTime ?? 999) < D.inicio_tranquilo_min * 60;
      const carnAlive = this.list.filter((c) => c.alive && isCarn(c.species)).length;
      // no começo tranquilo vale o limite pequeno de carnívoros
      const carnCap = early ? D.max_carnivoros_perto : this.maxCarnivores;
      const carnOk = !safe && carnAlive < carnCap;
      const weight = (s) => (isCarn(s) ? s.peso_spawn * D.peso_carnivoros * (early ? 0.3 : 1) : s.peso_spawn);
      const options = Object.values(SPECIES).filter((s) => {
        if (!!s.ambiente !== ambient || !s.biomas.includes(biome)) return false;
        if (isCarn(s) && !carnOk) return false;
        if (s.voa) return true;
        if (s.aquatico) return depth > 1.1;
        return depth < 0.3 || s.nada;
      });
      if (!options.length) continue;
      const total = options.reduce((acc, s) => acc + weight(s), 0);
      let pick = this.rand() * total;
      let species = options[0];
      for (const s of options) {
        pick -= weight(s);
        if (pick <= 0) {
          species = s;
          break;
        }
      }
      // não lota de gigantes raros
      if (species.peso_spawn < 2 && this.list.filter((c) => c.species.id === species.id).length >= 2) continue;
      const [gmin, gmax] = species.grupo;
      let size = Math.min(cap - alive, gmin + Math.floor(this.rand() * (gmax - gmin + 1)));
      if (isCarn(species)) size = Math.min(size, carnCap - carnAlive);
      if (size <= 0) continue;
      const maxLvl = early ? D.nivel_max_inicio : 30;
      const level = 1 + Math.floor(Math.pow(this.rand(), 1.7) * (maxLvl - 1));
      for (let i = 0; i < size; i++) {
        const ox = x + (this.rand() - 0.5) * 8 * Math.max(1, species.raio);
        const oz = z + (this.rand() - 0.5) * 8 * Math.max(1, species.raio);
        this.spawn(species.id, ox, oz, Math.max(1, Math.min(maxLvl, level + Math.floor((this.rand() - 0.5) * 6))));
      }
      return true;
    }
    return false;
  }

  // Nascimentos: macho e fêmea adultos da mesma espécie, perto um do
  // outro e tranquilos, às vezes têm um filhote. O filhote segue a mãe
  // e cresce até virar adulto (creature.setGrowth).
  tryBreed(players) {
    const C = this.cfg;
    const calm = (c) => c.alive && !c.isBaby && !c.species.ambiente && !c.netControlled
      && (c.state === CSTATE.WANDER || c.state === CSTATE.IDLE || c.state === CSTATE.EAT)
      && c.age > (c.nextBreed ?? 0);
    const alive = this.list.filter((c) => c.alive && !c.species.ambiente).length;
    if (alive >= this.maxActive + C.extra_filhotes) return null;
    for (const mom of this.list) {
      if (mom.sex !== 'Fêmea' || !calm(mom)) continue;
      const dad = this.list.find((o) => o !== mom && o.species.id === mom.species.id && o.sex === 'Macho'
        && calm(o) && o.pos.distanceTo(mom.pos) < C.distancia_casal_m);
      if (!dad || this.rand() > C.chance_cria) continue;
      const a = this.rand() * Math.PI * 2;
      const d = mom.radius + 1;
      const baby = this.spawn(mom.species.id, mom.pos.x + Math.sin(a) * d, mom.pos.z + Math.cos(a) * d, Math.max(1, Math.round((mom.level + dad.level) / 2)));
      if (!baby) return null;
      baby.age = 0;
      baby.mother = mom;
      baby.home.copy(mom.home);
      baby.setGrowth(0.3);
      if (mom.tamed) {
        // filhote de domado já nasce domado
        baby.tamed = true;
        baby.owner = mom.owner;
        baby.follow = true;
        baby.name = mom.species.nome;
      }
      const wait = () => 60 * (C.intervalo_cria_min[0] + this.rand() * (C.intervalo_cria_min[1] - C.intervalo_cria_min[0]));
      mom.nextBreed = mom.age + wait();
      dad.nextBreed = dad.age + wait();
      const near = players.some((p) => !p.dead && Math.hypot(p.position.x - mom.pos.x, p.position.z - mom.pos.z) < 60);
      if (near) events.emit(EV.MESSAGE, { text: `Nasceu um filhote de ${mom.species.nome}!`, kind: 'info' });
      return baby;
    }
    return null;
  }

  // Moradores do pântano: perto do pântano sempre tem jacaré gigante
  // (deinosuchus) e cobra gigante (titanoboa) na água.
  ensureSwampResidents(center) {
    const R = BALANCE.criaturas.moradores_pantano;
    if (!R) return;
    const parts = this.world.layout.pantano.partes;
    const near = parts.some((p) => Math.hypot(p.x - center.x, p.z - center.z) < p.raio_m + 160);
    if (!near) return;
    const D = BALANCE.dificuldade;
    const early = (game.player?.aliveTime ?? 999) < D.inicio_tranquilo_min * 60;
    for (const [id, want] of Object.entries(R)) {
      const have = this.list.filter((c) => c.alive && c.species.id === id
        && Math.hypot(c.pos.x - center.x, c.pos.z - center.z) < 190).length;
      if (have >= want) continue;
      // ponto com água funda, a 50–150 m do jogador
      for (let k = 0; k < 60; k++) {
        const p = parts[Math.floor(this.rand() * parts.length)];
        const a = this.rand() * Math.PI * 2;
        const r = Math.sqrt(this.rand()) * p.raio_m * 0.9;
        const x = p.x + Math.sin(a) * r;
        const z = p.z + Math.cos(a) * r;
        const d = Math.hypot(x - center.x, z - center.z);
        if (d < 50 || d > 150) continue;
        const w = this.world.waterAt(x, z);
        if (!w || w.level - this.world.heightAt(x, z) < (k < 30 ? 0.7 : 0.3)) continue;
        if (this.world.allRespawnPoints.some((q) => Math.hypot(q.position.x - x, q.position.z - z) < D.zona_segura_m)) continue;
        const lvl = early ? 1 + Math.floor(this.rand() * D.nivel_max_inicio) : 1 + Math.floor(Math.pow(this.rand(), 1.6) * 29);
        this.spawn(id, x, z, lvl);
        break;
      }
    }
  }

  // ---------------------------------------------------------
  // Carcaças: carne, couro e ossos
  // ---------------------------------------------------------
  // Carcaça com carne perto (carnívoro com fome vai comer).
  nearestCarcass(pos, radius) {
    let best = null;
    let bestD = radius;
    for (const c of this.list) {
      if (c.alive || !c.lootLeft || !Object.keys(c.lootLeft).some((k) => /carne/.test(k) && c.lootLeft[k] > 0)) continue;
      const d = Math.hypot(c.pos.x - pos.x, c.pos.z - pos.z);
      if (d < bestD) {
        best = c;
        bestD = d;
      }
    }
    return best;
  }

  findCorpse(pos, forward, reach) {
    let best = null;
    let bestD = Infinity;
    for (const c of this.list) {
      if (c.alive || !c.lootLeft) continue;
      const dx = c.pos.x - pos.x;
      const dz = c.pos.z - pos.z;
      const d = Math.hypot(dx, dz) - c.radius;
      if (d > reach) continue;
      const facing = (dx * forward.x + dz * forward.z) / (Math.hypot(dx, dz) || 1);
      if (facing < 0.2 && d > 0.5) continue;
      if (d < bestD) {
        best = c;
        bestD = d;
      }
    }
    return best;
  }

  // Um golpe na carcaça: tira um pouco de cada coisa. Machado e lança tiram mais.
  harvestCorpse(c, mode) {
    if (c.netControlled) {
      // convidado: pede ao anfitrião (os itens chegam pela rede)
      this.net?.requestLoot(c.nid, mode);
      return {};
    }
    const per = mode === 'machado' || mode === 'lanca' ? 3 : 1 + Math.floor(this.rand() * 2);
    const got = {};
    for (const [id, left] of Object.entries(c.lootLeft)) {
      const n = Math.min(left, per);
      if (n > 0) {
        got[id] = n;
        c.lootLeft[id] -= n;
      }
    }
    if (Object.values(c.lootLeft).every((v) => v <= 0)) {
      c.lootLeft = null;
      c.deadTime = Math.max(c.deadTime, this.cfg.corpo_dura_seg - 1.5); // some logo
    }
    return got;
  }

  // ---------------------------------------------------------
  // Co-op
  // ---------------------------------------------------------
  // Anfitrião: estado das criaturas perto de um ponto, para mandar.
  snapshotNear(pos, radius = 220) {
    const out = [];
    for (const c of this.list) {
      if (Math.hypot(c.pos.x - pos.x, c.pos.z - pos.z) > radius) continue;
      out.push([
        c.id, c.species.id, c.level, +c.scale.toFixed(3),
        +c.pos.x.toFixed(2), +c.pos.y.toFixed(2), +c.pos.z.toFixed(2), +c.yaw.toFixed(3),
        c.state, Math.ceil(c.health), c.attackAnim > 0.8 ? 1 : 0, c.lootLeft ? 1 : 0, c.statSeed, c.landed ? 1 : 0,
      ]);
    }
    return out;
  }

  // Convidado: cria/atualiza as criaturas que o anfitrião mandou.
  applySnapshot(list) {
    const byNid = new Map(this.list.filter((c) => c.netControlled).map((c) => [c.nid, c]));
    for (const [nid, sid, level, scale, x, y, z, yaw, st, hp, atk, loot, seed, ld] of list) {
      let c = byNid.get(nid);
      if (!c) {
        c = this.spawn(sid, x, z, level);
        if (!c) continue;
        c.nid = nid;
        c.netControlled = true;
        c.scale = scale;
        c.mesh.scale.setScalar(scale);
        if (seed !== undefined) c.rollStats(seed); // mesmos atributos do anfitrião
      }
      // filhote crescendo
      if (Math.abs(c.scale - scale) > 0.005) {
        c.scale = scale;
        c.mesh.scale.setScalar(scale);
      }
      c.applyNet({ x, y, z, yaw, st, hp, atk, loot, ld });
    }
  }

  byNid(nid) {
    return this.list.find((c) => (c.netControlled ? c.nid : c.id) === nid);
  }

  // Convidado bateu numa criatura: avisa o anfitrião.
  onNetDamage(c, amount) {
    this.net?.sendHit(c.nid, amount);
  }

  // Jogador saiu: ninguém mais persegue ele.
  forgetTarget(p) {
    for (const c of this.list) {
      if (c.target === p) c.target = null;
      if (c.threat === p) c.threat = null;
    }
  }

  // Bando: os iguais por perto também atacam.
  alertPack(c, target) {
    for (const o of this.list) {
      if (o !== c && o.alive && !o.tamed && !o.knockedOut && o.species.id === c.species.id && o.pos.distanceTo(c.pos) < 30 && !o.target) {
        o._chase(target);
      }
    }
  }

  // Presa para carnívoros (cadeia alimentar):
  //  - herbívoros até um certo tamanho (bando de raptor encara maiores)
  //  - carnívoros bem menores (o T-rex come raptor)
  //  - às vezes um rival carnívoro do mesmo porte (briga por território)
  findPrey(hunter, ctx = null) {
    const B = BALANCE.brigas;
    const hr = hunter.radius;
    let pack = 0;
    for (const o of this.list) {
      if (o !== hunter && o.alive && o.species.id === hunter.species.id && o.pos.distanceTo(hunter.pos) < 25) pack++;
    }
    const maxHerb = hr * B.presa_tamanho_max * (1 + Math.min(pack, 3) * 0.5);
    const rival = this.rand() < B.chance_rival;
    let best = null;
    let bestD = B.raio_busca_m;
    for (const o of this.list) {
      if (!o.alive || o === hunter || o.flies || o.species.ambiente || o.netControlled) continue;
      if (o.species.id === hunter.species.id) continue; // não ataca o próprio bando
      if (o.aquatic !== hunter.aquatic && !hunter.swims) continue;
      const or = o.radius;
      let ok = false;
      if (o.species.dieta === 'herbivoro') ok = or <= maxHerb;
      else if (or <= hr * B.come_carnivoro_menor) ok = true;
      else if (rival && or <= hr * 1.25 && or >= hr * 0.6) ok = true;
      if (!ok) continue;
      const d = o.pos.distanceTo(hunter.pos);
      if (d >= bestD) continue;
      if (ctx && !hunter._canReach(o, ctx)) continue;
      best = o;
      bestD = d;
    }
    return best;
  }

  // Uma criatura acertou alguém.
  hit(attacker, target, amount) {
    // montado: quem leva a mordida é a montaria
    if (target === game.player && game.player.riding && game.player.riding !== attacker) target = game.player.riding;
    if (target.isRemote) {
      this.net?.sendDamage(target, amount, attacker.species.nome);
      return;
    }
    if (target === game.player) {
      const p = game.player;
      if (p.dead) return;
      this.defendOwner(p, attacker);
      p.stats.damage(amount, `criatura:${attacker.species.nome}`);
      // empurrão para trás
      const dx = p.position.x - attacker.pos.x;
      const dz = p.position.z - attacker.pos.z;
      const len = Math.hypot(dx, dz) || 1;
      p.velocity.x += (dx / len) * Math.min(8, amount * 0.15);
      p.velocity.z += (dz / len) * Math.min(8, amount * 0.15);
      events.emit(EV.PLAYER_HURT, { amount, source: attacker.species.nome });
    } else if (target.takeDamage) {
      // briga entre bichos: sangue e barulho de carne
      const at = target.center ? target.center() : target.position;
      this.world.effects?.burst(at, 'sangue', 7, 2.8);
      sound.play('carne', at);
      target.takeDamage(amount, attacker);
    }
  }

  onDeath(c, attacker) {
    // o que dá para tirar da carcaça
    c.lootLeft = {};
    for (const [id, [a, b]] of Object.entries(c.species.loot ?? {})) {
      const n = a + Math.floor(this.rand() * (b - a + 1));
      if (n > 0) c.lootLeft[id] = Math.round(n * (1 + c.level * 0.02));
    }
    events.emit(EV.CREATURE_KILLED, { creature: c, byPlayer: attacker === game.player });
    if (c.tamed && c.owner === game.player) {
      events.emit(EV.MESSAGE, { text: `${c.name ?? c.species.nome} (domado) morreu${c.oldAge ? ' de velhice' : ''}.`, kind: 'warn' });
    }
    if (attacker?.isRemote) {
      this.net?.sendKill(attacker, c, Math.round(c.species.xp * (1 + c.level * 0.05)));
    } else if (attacker === game.player) {
      const xp = Math.round(c.species.xp * (1 + c.level * 0.05));
      game.player.stats.addXP(xp);
      events.emit(EV.MESSAGE, { text: `${c.species.nome} abatido! +${xp} XP`, kind: 'gain' });
    } else if (attacker && attacker.state !== undefined) {
      // predador come a presa
      attacker.target = null;
      attacker._setState(CSTATE.EAT);
      attacker.idleFor = BALANCE.brigas.comendo_seg;
      attacker.fedUntil = attacker.time + BALANCE.brigas.saciado_seg;
      attacker.health = Math.min(attacker.maxHealth, attacker.health + attacker.maxHealth * 0.15);
      // come um pedaço da carcaça
      for (const id of Object.keys(c.lootLeft)) {
        if (/carne/.test(id)) c.lootLeft[id] = Math.max(1, Math.floor(c.lootLeft[id] * 0.6));
      }
      game.creatureKills = (game.creatureKills ?? 0) + 1;
    }
  }

  // Ataque do jogador (soco): acerta a criatura na frente.
  playerAttack(player, forward, damage, reach) {
    let best = null;
    let bestD = Infinity;
    const p = player.position;
    const fl = Math.hypot(forward.x, forward.z) || 1;
    const pt = new THREE.Vector3();
    for (const c of this.list) {
      if (!c.alive || (c.tamed && c.owner === player) || c.rider) continue;
      // mede até a parte do corpo mais perto (cabeça, barriga ou cauda)
      c.closestBodyPoint(p.x, p.z, pt);
      const dx = pt.x - p.x;
      const dz = pt.z - p.z;
      const dy = pt.y - (p.y + 1.2);
      const d = Math.hypot(dx, dz);
      const r = Math.min(c.radius, 1.2); // grossura do corpo
      if (d - r > reach + 0.4 || Math.abs(dy) > c.height * 0.8 + 1.5) continue;
      // precisa estar mais ou menos na frente
      const dot = (dx * forward.x + dz * forward.z) / (d || 1) / fl;
      if (d > r + 0.8 && dot < 0.3) continue;
      if (d < bestD) {
        best = c;
        bestD = d;
      }
    }
    if (best) {
      best.takeDamage(damage, player);
      this.defendOwner(player, best);
    }
    return best;
  }

  // Bichos domados de quem apanhou/atacou vão para cima do inimigo.
  defendOwner(owner, enemy) {
    if (!enemy || enemy === owner || !enemy.alive || enemy.tamed || enemy.knockedOut) return;
    for (const c of this.list) {
      if (!c.tamed || c.owner !== owner || !c.alive || c.rider || c.damage <= 0) continue;
      if (c.target || c.pos.distanceTo(enemy.pos ?? enemy.position) > 40) continue;
      c._chase(enemy);
    }
  }

  // Montado: o bicho ataca o que estiver na frente dele.
  // Devolve o tempo até poder atacar de novo.
  riderAttack(mount, rider) {
    const sp = mount.species;
    mount.attackAnim = 1;
    sound.creature(mount, 'ataque');
    const fx = -Math.sin(mount.yaw);
    const fz = -Math.cos(mount.yaw);
    const head = new THREE.Vector3(mount.pos.x + fx * mount.bodyFront * mount.scale, mount.pos.y, mount.pos.z + fz * mount.bodyFront * mount.scale);
    const reach = (sp.alcance_ataque ?? 1.5) * mount.scale + 1.5;
    let best = null;
    let bestD = reach;
    const pt = new THREE.Vector3();
    for (const c of this.list) {
      if (c === mount || !c.alive || (c.tamed && c.owner === rider)) continue;
      c.closestBodyPoint(head.x, head.z, pt);
      const d = Math.hypot(pt.x - head.x, pt.z - head.z) - Math.min(c.radius, 1.2);
      if (d < bestD) {
        best = c;
        bestD = d;
      }
    }
    if (best) {
      this.hit(mount, best, mount.damage);
      this.defendOwner(rider, best);
    }
    return sp.intervalo_ataque ?? 1.2;
  }

  // Bichos domados por este jogador.
  tamedBy(owner) {
    return this.list.filter((c) => c.tamed && c.owner === owner && c.alive);
  }

  // Domado montável mais perto (para o botão Montar).
  findMountable(owner, pos, maxD = 5) {
    let best = null;
    let bestD = maxD;
    for (const c of this.tamedBy(owner)) {
      if (!c.species.pode_montar || c.flies || c.isBaby) continue;
      const d = Math.hypot(c.pos.x - pos.x, c.pos.z - pos.z) - c.radius;
      if (d < bestD) {
        best = c;
        bestD = d;
      }
    }
    return best;
  }

  onKnockOut(c, by) {
    if (by !== game.player) return;
    const can = c.species.pode_domar;
    events.emit(EV.MESSAGE, {
      text: can ? `${c.species.nome} desmaiou! Interagir para dar ${itemName(c.species.comida_preferida)} e domar.` : `${c.species.nome} desmaiou (não dá para domar).`,
      kind: can ? 'gain' : 'info',
    });
  }

  onWake(c) {
    if (c.tamer === game.player) events.emit(EV.MESSAGE, { text: `${c.species.nome} acordou!`, kind: 'warn' });
  }

  onTamed(c, owner) {
    if (owner === game.player) {
      const xp = Math.round(c.species.xp * (1 + c.level * 0.05) * 1.5);
      owner.stats.addXP(xp);
      events.emit(EV.MESSAGE, { text: `${c.species.nome} domado! +${xp} XP`, kind: 'gain' });
      events.emit(EV.CREATURE_TAMED, { creature: c });
    }
  }

  // Criatura na mira (para mostrar nome, nível e vida).
  findAimed(origin, dir, maxDist) {
    let best = null;
    let bestT = maxDist;
    const tmp = new THREE.Vector3();
    const onRay = new THREE.Vector3();
    for (const c of this.list) {
      // ponto do corpo (cabeça…cauda) mais perto da linha da mira
      let t = c.center(tmp).sub(origin).dot(dir);
      for (let i = 0; i < 2; i++) {
        onRay.copy(origin).addScaledVector(dir, Math.max(0, t));
        c.closestBodyPoint(onRay.x, onRay.z, tmp);
        t = tmp.sub(origin).dot(dir);
      }
      if (t < 0 || t > bestT) continue;
      const perp2 = tmp.lengthSq() - t * t;
      const r = Math.max(Math.min(c.radius, 1.6), c.height * 0.5) * 1.1;
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
