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
import { IMPORTED, buildImportedModel } from './imported_model.js';
import { buildSpeciesModel, createSkinnedMesh } from './creature_builder.js';
import { makeCreatureMaterial } from './creature_material.js';
import { Creature, CSTATE } from './creature.js';
import { aplicarCor, herdarCor, mutarCor, sortearCor } from './cores.js';
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
    // bichos com modelo .glb (bichos/modelos, com animações próprias) usam ele;
    // os outros saem do gerador paramétrico low-poly (creature_builder.js)
    if (!this.models[id]) this.models[id] = IMPORTED[id] ? buildImportedModel(IMPORTED[id], id) : buildSpeciesModel(MODELS[id]);
    return this.models[id];
  }

  // Cria uma criatura. level = nível (1 a 30), opcional.
  spawn(id, x, z, level) {
    const species = SPECIES[id];
    if (!species) return null;
    const model = this._model(id);
    const { mesh, bones } = createSkinnedMesh(model, model.material ?? this.material);
    mesh.name = species.nome;
    // modelo com sela embutida: um material próprio para este bicho, que só aparece quando ele está selado
    if (model.sela >= 0 && Array.isArray(mesh.material)) {
      mesh.material = mesh.material.map((m, i) => (i === model.sela ? m.clone() : m));
      mesh.material[model.sela].visible = false;
      mesh.userData.selaIdx = model.sela;
    }
    const lvl = level ?? 1 + Math.floor(Math.pow(this.rand(), 1.7) * 29);
    const c = new Creature({
      species, spec: MODELS[id], mesh, bones, level: lvl, x, z,
      world: this.world, manager: this, rand: this.rand,
    });
    // cores próprias (como no ARK): cada bicho nasce com uma combinação de costas e barriga
    aplicarCor(c, sortearCor(this.rand));
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
    this.localPlayer = player;
    const players = [player, ...this.remotePlayers];
    const ctx = { player, players, world: this.world, camPos: camera.position };
    for (const c of this.list) {
      c.update(dt, ctx);
      if (c.dash) this._updateDash(c, dt);
      if (c.species.sopro_fogo && c.alive && !c.netControlled) this._updateFireBreath(c, dt, players);
      // Sombra só para as que estão perto.
      const dCam = c.pos.distanceTo(camera.position);
      c.mesh.castShadow = dCam < 32;
      // longe da câmera o bicho nem é desenhado (a névoa já esconde): poupa os modelos pesados
      c.mesh.visible = dCam < (settings.quality?.drawCreatures ?? 110) || c === player.riding || c.rider === player;
    }
    this._separate();
    if (this.lava) {
      this._updateLava(dt, players);
      // dragão dormindo fica deitado DENTRO da lava
      for (const c of this.list) if (c.species.covil_lava && c.state === CSTATE.SLEEP) c.pos.y = this.lava.y - 0.4;
    }

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
        for (const p of alivePlayers) this.ensureBeachHerds(p.position);
        this.ensureBosses(alivePlayers);
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
    // par por perto (Mate Boost do ARK): domado adulto com outro do sexo oposto da mesma espécie a até 20 m
    for (const c of this.list) {
      c.mateBoosted = c.tamed && c.alive && !c.isBaby && this.list.some((o) => o !== c && o.tamed && o.alive && !o.isBaby
        && o.species.id === c.species.id && o.sex !== c.sex && o.pos.distanceTo(c.pos) < BALANCE.cria.par_distancia_m);
    }
    const calm = (c) => c.alive && !c.isBaby && !c.species.ambiente && !c.netControlled && !c.neutered
      && (c.state === CSTATE.WANDER || c.state === CSTATE.IDLE || c.state === CSTATE.EAT)
      && c.age > (c.nextBreed ?? 0);
    const alive = this.list.filter((c) => c.alive && !c.species.ambiente).length;
    if (alive >= this.maxActive + C.extra_filhotes) return null;
    for (const mom of this.list) {
      if (mom.sex !== 'Fêmea' || !calm(mom)) continue;
      const dad = this.list.find((o) => o !== mom && o.species.id === mom.species.id && o.sex === 'Macho'
        && calm(o) && o.pos.distanceTo(mom.pos) < C.distancia_casal_m);
      if (!dad) continue;
      // domados (como no ARK): macho e fêmea domados perto cruzam sozinhos (castrado não cruza);
      // a barra de acasalamento enche em cria.acasalar_seg e sai o ovo (ou a gestação)
      if (mom.tamed || dad.tamed) {
        if (!mom.tamed || !dad.tamed || mom.gestation > 0 || mom.owner !== dad.owner) continue;
        mom.mateProgress = Math.min(1, (mom.mateProgress ?? 0) + 15 / BALANCE.cria.acasalar_seg);
        mom.mateWith = dad;
        if (mom.mateProgress < 1) continue;
        mom.mateProgress = 0;
        this.breedTamed(mom, dad, players);
        const wait = () => 60 * (C.intervalo_cria_min[0] + this.rand() * (C.intervalo_cria_min[1] - C.intervalo_cria_min[0]));
        mom.nextBreed = mom.age + wait();
        dad.nextBreed = dad.age + wait();
        return null;
      }
      if (this.rand() > C.chance_cria) continue;
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

  // Atributos do filhote: cada um vem do pai ou da mãe (mais chance do
  // maior) e às vezes muta (+10%).
  inheritStats(mom, dad) {
    const B = BALANCE.cria;
    const st = {};
    let mut = 0;
    for (const k of Object.keys(mom.stats)) {
      const hi = Math.max(mom.stats[k], dad.stats[k]);
      const lo = Math.min(mom.stats[k], dad.stats[k]);
      st[k] = this.rand() < B.chance_maior ? hi : lo;
    }
    let cor = herdarCor(mom.cor, dad.cor, this.rand);
    const inc = mom.species.ark_por_nivel ?? {};
    const keys = ['vida', 'forca', 'stamina', 'peso'];
    const base = (mom.mutations ?? 0) + (dad.mutations ?? 0);
    for (let i = 0; i < 3; i++) {
      if (base + mut >= B.mutacao_limite || this.rand() >= B.mutacao) continue;
      const k = keys[Math.floor(this.rand() * keys.length)];
      st[k] = Math.round(st[k] * (1 + 2 * (inc[k] || 0.1))); // +2 pontos nesse atributo
      if (this.rand() < 0.5) cor = mutarCor(cor, this.rand);
      mut++;
    }
    return { st, mut: base + mut, novas: mut, cor };
  }

  // Casal domado: ovo (choca no chão) ou gestação (mamífero).
  breedTamed(mom, dad, players) {
    const B = BALANCE.cria;
    const gene = this.inheritStats(mom, dad);
    const level = Math.max(1, Math.round((mom.level + dad.level) / 2)) + 2 * gene.novas; // cada mutação = +2 níveis
    gene.mae = mom.name ?? mom.species.nome;
    gene.pai = dad.name ?? dad.species.nome;
    const name = mom.name ?? mom.species.nome;
    if (B.mamiferos.includes(mom.species.id)) {
      mom.gestation = B.gestacao_min * 60;
      mom.unborn = { gene, level };
      events.emit(EV.MESSAGE, { text: `${name} está prenhe! O filhote nasce em ${B.gestacao_min} min.`, kind: 'gain' });
      return;
    }
    const a = this.rand() * Math.PI * 2;
    const d = mom.radius + 0.8;
    const x = mom.pos.x + Math.sin(a) * d;
    const z = mom.pos.z + Math.cos(a) * d;
    this.world.addStructure({ type: 'ovo', x, y: this.world.groundAt(x, z, mom.pos.y + 1), z, rot: 0, especie: mom.species.id, nivel: level, gene });
    events.emit(EV.MESSAGE, { text: `${name} botou um ovo fertilizado! Deixe no quentinho (${B.ovo_temp_c[0]}–${B.ovo_temp_c[1]} °C) para chocar.`, kind: 'gain' });
  }

  // Nasce um filhote domado (do ovo ou da gestação).
  hatch(id, x, z, level, gene, owner) {
    const baby = this.spawn(id, x, z, level);
    if (!baby) return null;
    if (gene?.st) baby.applyStats(gene.st);
    if (gene && 'cor' in gene) aplicarCor(baby, gene.cor);
    baby.mutations = gene?.mut ?? 0;
    baby.parents = gene?.mae ? { mae: gene.mae, pai: gene.pai } : null;
    baby.age = 0;
    baby.setGrowth(0.3);
    baby.tamed = true;
    baby.owner = owner;
    baby.follow = true;
    baby.name = baby.species.nome;
    baby.imprint = 0;
    baby.careT = 20; // logo pede o primeiro carinho
    baby._setState(CSTATE.IDLE);
    events.emit(EV.MESSAGE, { text: `Nasceu um filhote de ${baby.species.nome}!${gene?.novas ? ` Mutação nova (+${2 * gene.novas} níveis)!` : ''}`, kind: 'gain' });
    return baby;
  }

  // Fim da gestação do mamífero.
  birth(mom) {
    const u = mom.unborn;
    mom.unborn = null;
    mom.gestation = 0;
    const a = this.rand() * Math.PI * 2;
    const d = mom.radius + 1;
    return this.hatch(mom.species.id, mom.pos.x + Math.sin(a) * d, mom.pos.z + Math.cos(a) * d, u?.level ?? mom.level, u?.gene, mom.owner);
  }

  // ---------------------------------------------------------
  // Chefes: cada um mora num covil fixo do seu bioma (gelo na neve, mar no
  // mar fundo perto da costa, pântano no meio do maior pântano). Aparece
  // quando alguém chega perto; morto, só volta depois de chefes.renascer_min.
  // ---------------------------------------------------------
  covil(id) {
    this._covis ??= {};
    if (id in this._covis) return this._covis[id];
    const w = this.world;
    const half = w.map?.half ?? 2000;
    const r = mulberry32(((w.seed ?? 1) * 7919 + id.length * 104729) >>> 0);
    let best = null;
    if (id === 'chefe_pantano') {
      const parts = w.layout.pantano?.partes ?? [];
      const p = parts.reduce((a, b) => (!a || b.raio_m > a.raio_m ? b : a), null);
      if (p) best = { x: p.x, z: p.z };
    } else {
      let melhor = -Infinity;
      for (let k = 0; k < 12000; k++) {
        const x = (r() * 2 - 1) * half;
        const z = (r() * 2 - 1) * half;
        let nota;
        if (id === 'chefe_mar') {
          const agua = w.waterAt(x, z);
          if (!agua || agua.id !== 'mar' || agua.level - w.heightAt(x, z) < 10) continue;
          nota = -Math.hypot(x, z); // o mar fundo mais perto da ilha
        } else {
          // os outros: um ponto seco do bioma do chefe (gelo na neve, dragão no topo da serra)
          if (w.biomeKeyAt(x, z) !== (SPECIES[id]?.biomas?.[0] ?? 'neve') || w.waterAt(x, z)) continue;
          if (SPECIES[id]?.covil_lava) {
            // dragão: um topo alto e mais plano (a cratera de lava cabe sem pico no meio)
            let lo = Infinity;
            let hi = -Infinity;
            for (let a = 0; a < 8; a++) {
              const h = w.heightAt(x + Math.cos(a * 0.785) * 14, z + Math.sin(a * 0.785) * 14);
              lo = Math.min(lo, h);
              hi = Math.max(hi, h);
            }
            const h0 = w.heightAt(x, z);
            if (hi - lo > 9 || Math.abs(h0 - (hi + lo) / 2) > 5) continue; // precisa ser um topo quase plano
            nota = h0;
          } else {
            nota = r();
          }
        }
        if (w.allRespawnPoints?.some((q) => Math.hypot(q.position.x - x, q.position.z - z) < 150)) continue;
        if (nota > melhor) { melhor = nota; best = { x, z }; }
      }
    }
    this._covis[id] = best;
    if (best && SPECIES[id]?.covil_lava) this._makeLava(best);
    return best;
  }

  // Poça de lava no topo da serra (covil do dragão): disco de lava que brilha,
  // pedras escuras em volta e fumaça; quem pisa na lava se queima.
  _makeLava(lugar) {
    const w = this.world;
    // cratera de ~14 m no topo: a lava fica no meio da altura do terreno (pontas de pedra
    // saem da lava como ilhas) e pedras grandes na borda escondem os degraus
    const R = 14;
    let lo = Infinity;
    let hi = -Infinity;
    for (let a = 0; a < 24; a++) for (const f of [0.35, 0.7, 1]) {
      const h = w.heightAt(lugar.x + Math.cos(a * 0.262) * R * f, lugar.z + Math.sin(a * 0.262) * R * f);
      lo = Math.min(lo, h);
      hi = Math.max(hi, h);
    }
    const y = lo + (hi - lo) * 0.55;
    const g = new THREE.Group();
    g.name = 'Lava';
    const mat = new THREE.MeshBasicMaterial({ color: '#ff5a14' });
    const disco = new THREE.Mesh(new THREE.CircleGeometry(R, 28), mat);
    disco.rotation.x = -Math.PI / 2;
    disco.position.set(lugar.x, y, lugar.z);
    g.add(disco);
    // manchas mais claras e borda de pedra escura
    const claro = new THREE.Mesh(new THREE.CircleGeometry(R * 0.55, 20), new THREE.MeshBasicMaterial({ color: '#ffc04a' }));
    claro.rotation.x = -Math.PI / 2;
    claro.position.set(lugar.x + R * 0.15, y + 0.03, lugar.z - R * 0.1);
    g.add(claro);
    const pedra = new THREE.MeshLambertMaterial({ color: '#2a2422', flatShading: true });
    for (let k = 0; k < 26; k++) {
      const a = (k / 26) * Math.PI * 2;
      const bx = lugar.x + Math.cos(a) * (R + 1);
      const bz = lugar.z + Math.sin(a) * (R + 1);
      const chao = w.heightAt(bx, bz);
      // pedra alta o bastante para ir do chão até acima da lava
      const s = Math.min(5, Math.max(2.2, (y - chao) * 0.7 + 1.5)) * (0.85 + ((k * 37) % 7) * 0.05);
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 0), pedra);
      m.position.set(bx, (chao + y) / 2, bz);
      m.rotation.set(k, k * 2, k * 3);
      m.castShadow = true;
      g.add(m);
    }
    const luz = new THREE.PointLight('#ff6a20', 3, R * 4, 1.5);
    luz.position.set(lugar.x, y + 3, lugar.z);
    g.add(luz);
    this.scene.add(g);
    this.lava = { x: lugar.x, z: lugar.z, r: R, y, mat, luz, t: 0 };
  }

  // Lava: brilho pulsando, fumaça e fogo de vez em quando, e queima quem pisa
  _updateLava(dt, players) {
    const L = this.lava;
    L.t += dt;
    const p = 0.5 + 0.5 * Math.sin(L.t * 1.7);
    L.mat.color.setRGB(1, 0.3 + p * 0.12, 0.06);
    L.luz.intensity = 2.5 + p * 1.5;
    L._fx = (L._fx ?? 0) - dt;
    const perto = players.some((q) => Math.hypot(q.position.x - L.x, q.position.z - L.z) < 120);
    if (perto && L._fx <= 0) {
      L._fx = 0.35;
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * L.r;
      const at = new THREE.Vector3(L.x + Math.cos(a) * r, L.y + 0.3, L.z + Math.sin(a) * r);
      this.world.effects?.burst(at, Math.random() < 0.5 ? 'fogo' : 'fumaca', 3, 1.4);
    }
    for (const q of players) {
      if (q.dead || q.riding) continue;
      if (Math.hypot(q.position.x - L.x, q.position.z - L.z) < L.r && q.position.y < L.y + 1.2) {
        q.stats?.damage?.(BALANCE.chefes.lava_dano_seg * dt, 'lava');
        if (q === game.player && !(L._aviso > 0)) events.emit(EV.MESSAGE, { text: 'Lava! Saia daí!', kind: 'warn' });
        L._aviso = 2;
      }
    }
    L._aviso = (L._aviso ?? 0) - dt;
  }

  ensureBosses(players) {
    const C = BALANCE.chefes;
    if (!C) return;
    this._chefes ??= {};
    for (const sp of Object.values(SPECIES)) if (sp.covil_lava) this.covil(sp.id); // a lava já existe antes do dragão
    for (const sp of Object.values(SPECIES)) {
      if (!sp.chefe) continue;
      const atual = this._chefes[sp.id];
      if (atual) {
        if (atual.alive) continue;
        if (!atual.morto) atual.morto = this.clock; // acabou de morrer: conta o tempo para voltar
        if (this.clock - atual.morto < C.renascer_min * 60) continue;
        if (this.list.includes(atual)) continue;
      }
      const lugar = this.covil(sp.id);
      if (!lugar || !players.some((p) => Math.hypot(p.position.x - lugar.x, p.position.z - lugar.z) < C.aparece_m)) continue;
      if (this.list.some((c) => c.species.id === sp.id && c.alive)) continue;
      const c = this.spawn(sp.id, lugar.x, lugar.z, C.nivel);
      if (!c) continue;
      c.home.set(lugar.x, lugar.z);
      if (sp.covil_lava) {
        // dorme dentro da lava até alguém chegar perto (ou bater nele)
        c.landed = true;
        c._setState(CSTATE.SLEEP);
      }
      this._chefes[sp.id] = c;
      events.emit(EV.MESSAGE, { text: `${sp.nome} está por perto!`, kind: 'warn' });
    }
  }

  // Pontos da costa onde vive cada bando (sorteados uma vez, sempre os mesmos no mesmo mapa)
  _beachSpots() {
    if (this._bandos) return this._bandos;
    const list = BALANCE.criaturas.bandos_praia ?? [];
    const w = this.world;
    const r = mulberry32(90210);
    const half = w.map.half * 0.97;
    const sep = BALANCE.criaturas.separacao_bandos_m ?? 700;
    const spots = [];
    for (const b of list) {
      let best = null;
      for (let k = 0; k < 6000 && !best; k++) {
        const x = (r() * 2 - 1) * half;
        const z = (r() * 2 - 1) * half;
        if (w.biomeKeyAt(x, z) !== 'praia' || w.waterAt(x, z)) continue;
        if (w.heightAt(x, z) < 0.6) continue;
        // a área toda tem que ser praia seca (sem água, sem mata dentro)
        let ok = true;
        for (let a = 0; a < 8 && ok; a++) {
          const qx = x + Math.cos(a * 0.785) * b.raio_m * 0.6;
          const qz = z + Math.sin(a * 0.785) * b.raio_m * 0.6;
          if (w.biomeKeyAt(qx, qz) === 'mar') ok = false;
        }
        if (!ok) continue;
        if (spots.some((s) => Math.hypot(s.x - x, s.z - z) < sep)) continue;
        best = { x, z };
      }
      if (best) spots.push({ ...best, ...b });
    }
    this._bandos = spots;
    return spots;
  }

  // Bandos da praia: perto de um deles (até 220 m), repõe os bichos que faltam
  ensureBeachHerds(center) {
    const D = BALANCE.dificuldade;
    for (const z of this._beachSpots()) {
      if (Math.hypot(z.x - center.x, z.z - center.z) > z.raio_m + 220) continue;
      for (const [id, want] of Object.entries(z.especies)) {
        if (!SPECIES[id]) continue;
        const have = this.list.filter((c) => c.alive && c.species.id === id && Math.hypot(c.pos.x - z.x, c.pos.z - z.z) < z.raio_m + 60).length;
        for (let n = have, tries = 0; n < want && tries < 40; tries++) {
          const a = this.rand() * Math.PI * 2;
          const rr = Math.sqrt(this.rand()) * z.raio_m;
          const x = z.x + Math.sin(a) * rr;
          const zz = z.z + Math.cos(a) * rr;
          if (this.world.biomeKeyAt(x, zz) === 'mar' || this.world.waterAt(x, zz)) continue;
          // não aparece na sua cara
          if (Math.hypot(x - center.x, zz - center.z) < 40) continue;
          this.spawn(id, x, zz, 1 + Math.floor(this.rand() * (D.nivel_max_inicio ?? 8)));
          n++;
        }
      }
    }
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
  /** 0..1: quão perto está o bicho selvagem que te caça (0 = ninguém caçando). Alimenta a trilha de perseguição. */
  nivelPerseguicao(player) {
    let melhor = Infinity;
    for (const c of this.list) {
      if (!c.alive || c.tamed || c.netControlled || c.target !== player) continue;
      if (c.state !== CSTATE.CHASE && c.state !== CSTATE.ATTACK) continue;
      const d = Math.hypot(c.position.x - player.position.x, c.position.z - player.position.z);
      if (d < melhor) melhor = d;
    }
    if (melhor > 75) return 0;
    return Math.min(1, Math.max(0.25, 1 - (melhor - 8) / 67));
  }

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
      // armadura vestida tira parte do dano (e se gasta)
      const inv = game.player.actions?.inv;
      const A = BALANCE.armadura;
      if (inv) {
        amount *= 1 - Math.min(A.max_reducao, inv.armor);
        const torn = inv.wearArmor(A.desgaste_por_golpe);
        if (torn) events.emit(EV.MESSAGE, { text: `${torn} rasgou!`, kind: 'warn' });
      }
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
    // domado com "Coletar itens das vítimas": o que sai da carcaça vai para o inventário dele
    if (attacker?.tamed && attacker.victimCollect && attacker.ensureInv) {
      for (const [id, n] of Object.entries(c.lootLeft)) attacker.ensureInv().add(id, n);
      c.lootLeft = null;
    }
    events.emit(EV.CREATURE_KILLED, { creature: c, byPlayer: attacker === game.player });
    if (c.tamed && c.owner === game.player) {
      events.emit(EV.MESSAGE, { text: `${c.name ?? c.species.nome} (domado) morreu${c.oldAge ? ' de velhice' : ''}.`, kind: 'warn' });
    }
    if (attacker?.isRemote) {
      this.net?.sendKill(attacker, c, +(c.species.xp * (1 + 0.1 * (c.level - 1))).toFixed(1));
    } else if (attacker === game.player) {
      const xp = +(c.species.xp * (1 + 0.1 * (c.level - 1))).toFixed(1);
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
      if (d - r > reach + 0.15 || Math.abs(dy) > c.height * 0.8 + 1.5) continue;
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
      if (!c.tamed || c.owner !== owner || !c.alive || c.rider || c.damage <= 0 || c.aggression === 'passivo') continue;
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
    } else {
      this.mountHarvest(mount, rider, head, reach);
    }
    return sp.intervalo_ataque ?? 1.2;
  }

  // Montado, sem bicho na frente: o bicho coleta o que sabe (BALANCE.montaria).
  // O que sai vai para o inventário do bicho (como no ARK).
  mountHarvest(mount, rider, head, reach, maxArea = null) {
    const M = BALANCE.montaria;
    const cfg = M.coleta[mount.species.id];
    if (!cfg) return 0;
    const fx = -Math.sin(mount.yaw);
    const fz = -Math.cos(mount.yaw);
    const got = {};
    let n = 0;
    // carnívoro: carcaça na frente rende muito mais carne e couro
    if (cfg.carcaca) {
      const corpse = this.findCorpse(mount.pos, new THREE.Vector3(fx, 0, fz), reach + mount.radius);
      if (corpse) {
        for (let k = 0; k < cfg.carcaca && corpse.lootLeft; k++) {
          for (const [id, q] of Object.entries(this.harvestCorpse(corpse, 'machado'))) got[id] = (got[id] ?? 0) + q;
        }
        this.world.effects?.burst(corpse.center(), 'sangue', 6, 2);
        sound.play('carne', corpse.center());
        n = 1;
      }
    }
    if (cfg.modo) {
      const veg = this.world.vegetation;
      const ok = new Set(cfg.alvos.flatMap((g) => M.grupos[g] ?? []));
      const area = maxArea ?? cfg.area ?? 1;
      const vistos = new Set();
      for (let k = 0; k < area; k++) {
        // procura em leque na frente do bicho (cada vez um pouco para o lado)
        const ang = (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.35;
        const dx = fx * Math.cos(ang) - fz * Math.sin(ang);
        const dz = fz * Math.cos(ang) + fx * Math.sin(ang);
        // do meio do corpo até um pouco depois da cabeça (bicho comprido alcança o que está do lado do pescoço)
        const rec = veg.findTarget(mount.pos.x, mount.pos.z, dx, dz, mount.bodyFront * mount.scale + reach, false, mount.pos.y, (key) => ok.has(key));
        if (!rec || vistos.has(rec)) continue;
        vistos.add(rec);
        const res = veg.resourceOf(rec);
        if (!res || !ok.has(res.key)) continue;
        const table = res[cfg.modo] ?? res.mao;
        if (!table) continue;
        for (const [id, range] of Object.entries(table)) {
          const [a, b] = Array.isArray(range) ? range : [range, range];
          const q = Math.round((a + Math.floor(Math.random() * (b - a + 1))) * cfg.rende);
          if (q > 0) got[id] = (got[id] ?? 0) + q;
        }
        veg.consume(rec);
        const kind = M.grupos.pedras.includes(res.key) ? 'pedra' : M.grupos.arvores.includes(res.key) ? 'madeira' : 'folha';
        const at = new THREE.Vector3(rec.x, mount.pos.y + 1.2, rec.z);
        this.world.effects?.burst(at, kind, 8, 2.6);
        sound.play(kind === 'folha' ? 'folhas' : kind, at);
        n++;
      }
    }
    if (n) {
      const inv = mount.ensureInv();
      const texto = [];
      for (const [id, q] of Object.entries(got)) {
        const add = inv.add(id, q);
        if (add > 0) texto.push(`+${add} ${itemName(id)}`);
        if (add < q) events.emit(EV.MESSAGE, { text: `Inventário de ${mount.name ?? mount.species.nome} cheio!`, kind: 'warn' });
      }
      if (texto.length && rider === game.player) events.emit(EV.MESSAGE, { text: `${texto.join(', ')} (no ${mount.name ?? mount.species.nome})`, kind: 'gain' });
      rider?.stats?.addXP?.(0.2 * n);
    }
    return n;
  }

  // Especial do bicho montado (tecla Q): investida ou bote. Devolve a espera até o próximo.
  mountSkill(mount, rider) {
    const E = BALANCE.montaria.especiais[mount.species.id];
    if (!E) {
      if (rider === game.player) events.emit(EV.MESSAGE, { text: `${mount.species.nome} não tem habilidade especial.`, kind: 'info' });
      return 1;
    }
    if ((mount.stamina ?? 0) < E.stamina) {
      if (rider === game.player) events.emit(EV.MESSAGE, { text: `${mount.name ?? mount.species.nome} está sem fôlego.`, kind: 'warn' });
      return 0.5;
    }
    mount.stamina -= E.stamina;
    mount.dash = { t: E.seg, vel: E.vel, dano: E.dano, tipo: E.tipo, rider, acertou: new Set(), passo: 0 };
    mount.attackAnim = 1;
    sound.creature(mount, E.tipo === 'bote' ? 'ataque' : 'rugido');
    return E.espera;
  }

  // Investida/bote em andamento: anda rápido para a frente, acerta bichos e quebra o que estiver no caminho.
  _updateDash(c, dt) {
    const D = c.dash;
    D.t -= dt;
    if (D.t <= 0 || !c.alive) {
      c.dash = null;
      return;
    }
    const fx = -Math.sin(c.yaw);
    const fz = -Math.cos(c.yaw);
    const nx = c.pos.x + fx * D.vel * dt;
    const nz = c.pos.z + fz * D.vel * dt;
    if (!this.world.waterAt(nx, nz)) {
      c.pos.x = nx;
      c.pos.z = nz;
    }
    const head = new THREE.Vector3(c.pos.x + fx * c.bodyFront * c.scale, c.pos.y, c.pos.z + fz * c.bodyFront * c.scale);
    const pt = new THREE.Vector3();
    for (const o of this.list) {
      if (o === c || !o.alive || D.acertou.has(o) || (o.tamed && o.owner === D.rider)) continue;
      o.closestBodyPoint(head.x, head.z, pt);
      if (Math.hypot(pt.x - head.x, pt.z - head.z) > c.radius + 1) continue;
      D.acertou.add(o);
      this.hit(c, o, c.damage * D.dano);
      if (D.tipo === 'bote') D.t = Math.min(D.t, 0.05); // bote para no primeiro que morde
    }
    // investida quebra plantas e árvores no caminho (vão para o inventário do bicho)
    D.passo -= dt;
    if (D.tipo === 'investida' && D.passo <= 0) {
      D.passo = 0.12;
      const cfg = BALANCE.montaria.coleta[c.species.id];
      if (cfg?.modo) this.mountHarvest(c, D.rider, head, c.radius + 1.5, 2);
      else this._breakInPath(c, head);
    }
  }

  // Sopro de fogo (Dragão do Vulcão): de tempos em tempos, quando alguém está
  // perto e na frente, cospe fogo num cone; quem fica no fogo perde vida.
  _updateFireBreath(c, dt, players) {
    const F = c.species.sopro_fogo;
    c._soproEspera = (c._soproEspera ?? F.espera_seg * 0.5) - dt;
    const boca = new THREE.Vector3(c.pos.x - Math.sin(c.yaw) * c.bodyFront * c.scale, c.pos.y + c.height * 0.6, c.pos.z - Math.cos(c.yaw) * c.bodyFront * c.scale);
    if (!c._sopro) {
      if (c._soproEspera > 0) return;
      const alvo = players.find((p) => !p.dead && p.position.distanceTo(boca) < F.alcance_m);
      if (!alvo) return;
      c._sopro = { t: F.dura_seg };
      c._soproEspera = F.espera_seg;
      c.attackAnim = 1;
      sound.creature(c, 'rugido');
      if (alvo === game.player) events.emit(EV.MESSAGE, { text: `${c.species.nome} vai cuspir fogo!`, kind: 'warn' });
    }
    c._sopro.t -= dt;
    if (c._sopro.t <= 0) {
      c._sopro = null;
      return;
    }
    const fx = -Math.sin(c.yaw);
    const fz = -Math.cos(c.yaw);
    // labaredas ao longo do cone
    for (let k = 0; k < 2; k++) {
      const d = Math.random() * F.alcance_m;
      const at = boca.clone().add(new THREE.Vector3(fx * d + (Math.random() - 0.5) * d * 0.4, -d * 0.12, fz * d + (Math.random() - 0.5) * d * 0.4));
      this.world.effects?.burst(at, 'fogo', 3, 2.2);
    }
    for (const p of players) {
      if (p.dead) continue;
      const dx = p.position.x - boca.x;
      const dz = p.position.z - boca.z;
      const dist = Math.hypot(dx, dz);
      if (dist > F.alcance_m || (dx * fx + dz * fz) / (dist || 1) < 0.8) continue;
      p.stats?.damage?.(F.dano_seg * dt, `fogo:${c.species.nome}`);
    }
    // o fogo também queima bichos domados no caminho
    for (const o of this.list) {
      if (o === c || !o.alive || !o.tamed) continue;
      const dx = o.pos.x - boca.x;
      const dz = o.pos.z - boca.z;
      const dist = Math.hypot(dx, dz);
      if (dist < F.alcance_m && (dx * fx + dz * fz) / (dist || 1) > 0.8) o.takeDamage(F.dano_seg * dt, c);
    }
  }

  // Investida de bicho que não coleta: só derruba plantas pequenas do caminho.
  _breakInPath(c, head) {
    const veg = this.world.vegetation;
    const rec = veg.findTarget(head.x, head.z, -Math.sin(c.yaw), -Math.cos(c.yaw), c.radius + 1, true, c.pos.y);
    if (!rec) return;
    veg.consume(rec);
    this.world.effects?.burst(new THREE.Vector3(rec.x, c.pos.y + 1, rec.z), 'folha', 8, 2.4);
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
      if (!c.species.pode_montar || c.isBaby) continue;
      if (BALANCE.sela.precisa && !c.saddled) continue; // sem sela não monta
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
      const xp = +(c.species.xp * (1 + 0.1 * (c.level - 1)) * 1.5).toFixed(1);
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
