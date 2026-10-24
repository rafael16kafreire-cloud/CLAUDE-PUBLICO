// =============================================================
// CRIATURA – comportamento (IA) e animação
// Máquina de estados: vagar, parado, comer, fugir, perseguir,
// atacar, voltar ao território e morto.
// Temperamentos (data/creatures/criaturas.json):
//   agressivo  – carnívoros: caçam o jogador e outros animais
//   passivo    – herbívoros: só reagem se apanharem
//                (revida = ataca de volta; senão foge)
//   medroso    – fogem quando alguém chega perto
// =============================================================
import * as THREE from 'three';
import { angleDelta, clamp } from '../core/math.js';
import { BALANCE } from '../core/balance.js';
import { sound } from '../audio/audio.js';

export const CSTATE = {
  WANDER: 'vagar',
  IDLE: 'parado',
  EAT: 'comer',
  FLEE: 'fugir',
  CHASE: 'perseguir',
  ATTACK: 'atacar',
  RETURN: 'voltar',
  DEAD: 'morto',
};

const TAU = Math.PI * 2;
let nextId = 1;

export class Creature {
  constructor({ species, spec, mesh, bones, level, x, z, world, manager, rand }) {
    this.id = nextId++;
    this.species = species;
    this.spec = spec;
    this.mesh = mesh;
    this.bones = bones;
    this.world = world;
    this.manager = manager;
    this.rand = rand;
    this.level = level;

    this.maxHealth = Math.round(species.vida * (1 + 0.06 * (level - 1)));
    this.health = this.maxHealth;
    this.damage = species.dano * (1 + 0.03 * (level - 1));
    this.scale = (species.tamanho ?? 1) * (0.92 + Math.min(level, 30) * 0.006 + rand() * 0.06);

    this.flies = !!species.voa;
    this.swims = !!species.nada;
    this.aquatic = !!species.aquatico;
    this.pos = new THREE.Vector3(x, 0, z);
    this.home = new THREE.Vector2(x, z);
    this.yaw = rand() * TAU;
    this.speed = 0;
    this.state = CSTATE.WANDER;
    this.stateTime = 0;
    this.target = null;
    this.threat = null;
    this.goal = null;
    this.attackCooldown = 0;
    this.attackAnim = 0;
    this.hurtAnim = 0;
    this.blockedTime = 0;
    this.thinkTimer = rand() * 0.3;
    this.phase = rand();
    this.time = rand() * 100;
    this.deadTime = 0;
    this.pitch = 0;
    this.roll = 0;
    this.climb = 0;
    this.turnRate = (this.flies ? 1.2 : 2.6) / Math.max(1, Math.sqrt(species.raio));
    // animação suave
    this.anim = { turn: 0, tail: [0, 0, 0], headYaw: 0, headPitch: 0, neck: 0, run: 0 };

    if (this.flies) {
      const [a, b] = species.altura_voo;
      this.cruise = a + rand() * (b - a);
      this.pos.y = world.heightAt(x, z) + this.cruise;
    } else {
      this.pos.y = this._groundY(x, z);
    }
    this.mesh.scale.setScalar(this.scale);
    // comprimento do corpo (da cauda ao focinho), para acertar golpes
    // em qualquer parte do bicho e não só no meio dele
    const geo = mesh.geometry;
    if (!geo.boundingBox) geo.computeBoundingBox();
    this.bodyFront = Math.max(0, -geo.boundingBox.min.z);
    this.bodyBack = Math.max(0, geo.boundingBox.max.z);
    this._sync(0);
  }

  // Ponto do corpo (eixo cauda–focinho) mais perto de (x, z).
  closestBodyPoint(x, z, out = new THREE.Vector3()) {
    const fx = -Math.sin(this.yaw);
    const fz = -Math.cos(this.yaw);
    let s = (x - this.pos.x) * fx + (z - this.pos.z) * fz;
    s = clamp(s, -this.bodyBack * this.scale, this.bodyFront * this.scale);
    return this.center(out).set(this.pos.x + fx * s, out.y, this.pos.z + fz * s);
  }

  get alive() {
    return this.state !== CSTATE.DEAD;
  }

  get radius() {
    return this.species.raio * this.scale;
  }

  get height() {
    return this.species.altura * this.scale;
  }

  get position() {
    return this.pos;
  }

  center(out = new THREE.Vector3()) {
    return out.copy(this.pos).setY((this.flies || this.aquatic) ? this.pos.y : this.pos.y + this.height * 0.5);
  }

  // ---------------------------------------------------------
  update(dt, ctx) {
    if (this.netControlled) {
      this._netUpdate(dt, ctx);
      return;
    }
    this.time += dt;
    this.stateTime += dt;
    this.attackCooldown -= dt;
    this.attackAnim = Math.max(0, this.attackAnim - dt * 2.2);
    this.hurtAnim = Math.max(0, this.hurtAnim - dt * 3);
    const prevYaw = this.yaw;

    if (this.state === CSTATE.DEAD) {
      this.deadTime += dt;
      this.speed = 0;
      this._animate(dt, ctx, 0);
      this._sync(dt);
      return;
    }

    // de vez em quando, um chamado à toa
    if (this.rand() < dt * 0.025) sound.creature(this, this.state === CSTATE.CHASE ? 'rugido' : 'chamado');

    this.thinkTimer -= dt;
    if (this.thinkTimer <= 0) {
      this.thinkTimer = 0.25;
      this._think(ctx);
    }

    if (this.flies) this._updateFlying(dt, ctx);
    else this._updateGround(dt, ctx);

    const yawVel = angleDelta(prevYaw, this.yaw) / Math.max(dt, 1e-3);
    this._animate(dt, ctx, yawVel);
    this._sync(dt);
  }

  // ---------------------------------------------------------
  // Decisões (4x por segundo)
  // ---------------------------------------------------------
  _think(ctx) {
    const sp = this.species;
    // co-op: reage ao jogador vivo mais perto (deste aparelho ou de outro)
    let player = ctx.player;
    if (ctx.players && ctx.players.length > 1) {
      let bd = Infinity;
      for (const p of ctx.players) {
        if (p.dead) continue;
        const d = this._dist2D(p.position);
        if (d < bd) {
          bd = d;
          player = p;
        }
      }
    }
    const temp = sp.temperamento;
    const dPlayer = player.dead ? Infinity : this._dist2D(player.position);
    const perceived = player.crouching ? dPlayer * 1.6 : dPlayer;

    if (this.state === CSTATE.FLEE) {
      if (this.stateTime > 9 || (this.threat && this._dist2D(this.threat.position) > 45)) this._setState(CSTATE.WANDER);
      return;
    }

    if (this.state === CSTATE.CHASE || this.state === CSTATE.ATTACK) {
      const t = this.target;
      const gone = !t || t.alive === false || (t === player && player.dead);
      const far = t && this._dist2D(t.position) > (sp.alcance_agro ?? 20) * 2.2;
      const leash = this.home.distanceTo(new THREE.Vector2(this.pos.x, this.pos.z)) > 150;
      const unreachable = t && !this._canReach(t, ctx);
      const tired = t instanceof Creature && this.stateTime > 40; // desiste de caçada longa
      if (gone || far || leash || this.blockedTime > 5 || unreachable || tired) {
        this.target = null;
        this._setState(leash ? CSTATE.RETURN : CSTATE.WANDER);
      }
      return;
    }

    if (temp === 'medroso' && perceived < 16) {
      this._flee(player);
      return;
    }
    const agro = (sp.alcance_agro ?? 20) * (ctx.world.sky?.isNight ? BALANCE.dificuldade.agro_noite : 1);
    if (temp === 'agressivo' && perceived < agro && this._canReach(player, ctx)) {
      this._chase(player);
      this.manager.alertPack(this, player);
      return;
    }

    // Carnívoros com fome caçam outros bichos (cadeia alimentar) e
    // às vezes brigam com rivais. Depois de comer ficam um tempo saciados.
    const hungry = this.time > (this.fedUntil ?? 0);
    if (temp === 'agressivo' && hungry && !sp.ambiente && (this.state === CSTATE.WANDER || this.state === CSTATE.IDLE)
      && this.rand() < BALANCE.brigas.chance_caca_seg * 0.25) {
      const prey = this.manager.findPrey(this, ctx);
      if (prey) {
        this._chase(prey);
        this.manager.alertPack(this, prey);
        return;
      }
    }

    if (this.state !== CSTATE.RETURN && this.home.distanceTo(new THREE.Vector2(this.pos.x, this.pos.z)) > 110) {
      this._setState(CSTATE.RETURN);
    }
  }

  // Dá para alcançar? (bichos da água só pegam quem está na água/beira)
  _canReach(target, ctx) {
    const p = target.position;
    if (this.aquatic) {
      const w = ctx.world.waterAt(p.x, p.z);
      return !!w && p.y < w.level - 0.2;
    }
    if (this.species.perto_agua) {
      if (ctx.world.waterAt(p.x, p.z)) return true;
      return [[6, 0], [-6, 0], [0, 6], [0, -6]].some(([dx, dz]) => ctx.world.waterAt(p.x + dx, p.z + dz));
    }
    if (!this.swims && !this.flies) {
      // bicho de terra não entra em água funda atrás de ninguém
      const w = ctx.world.waterAt(p.x, p.z);
      if (w && w.level - ctx.world.heightAt(p.x, p.z) > Math.max(1.2, this.height * 0.5)) return false;
    }
    return true;
  }

  _setState(s) {
    this.state = s;
    this.stateTime = 0;
    this.goal = null;
    this.blockedTime = 0;
  }

  _flee(threat) {
    this.threat = threat;
    if (this.state !== CSTATE.FLEE) this._setState(CSTATE.FLEE);
  }

  _chase(target) {
    this.target = target;
    if (this.state !== CSTATE.CHASE && this.state !== CSTATE.ATTACK) {
      this._setState(CSTATE.CHASE);
      if (this.species.temperamento === 'agressivo' || this.species.revida) sound.creature(this, 'rugido');
      // a presa percebe quem vem atrás dela: briga ou foge
      if (target instanceof Creature && target.alive && !target.netControlled) target._noticeAttacker(this);
    }
  }

  // Outro bicho veio pra cima: os fortes/bravos encaram, o resto foge.
  _noticeAttacker(attacker) {
    if (this.state === CSTATE.CHASE || this.state === CSTATE.ATTACK || this.state === CSTATE.FLEE) return;
    const sp = this.species;
    if (sp.temperamento === 'agressivo' || sp.revida) this._chase(attacker);
    else this._flee(attacker);
  }

  // ---------------------------------------------------------
  // Movimento no chão / na água
  // ---------------------------------------------------------
  _updateGround(dt, ctx) {
    const sp = this.species;
    switch (this.state) {
      case CSTATE.WANDER: {
        if (!this.goal || this.stateTime > 25) this.goal = this._pickWanderPoint(sp.raio > 2 ? 60 : 32);
        if (!this.goal || this._steer(dt, this.goal.x, this.goal.y, sp.vel_andar)) {
          const herb = sp.dieta === 'herbivoro' && !this.aquatic;
          this._setState(herb && this.rand() < 0.6 ? CSTATE.EAT : CSTATE.IDLE);
          this.idleFor = 5 + this.rand() * 10;
        }
        break;
      }
      case CSTATE.IDLE:
      case CSTATE.EAT:
        this._brake(dt);
        if (this.stateTime > (this.idleFor ?? 4)) this._setState(CSTATE.WANDER);
        break;
      case CSTATE.RETURN:
        if (this._steer(dt, this.home.x, this.home.y, sp.vel_andar * 1.3) || this._dist2DXY(this.home.x, this.home.y) < 10) {
          this._setState(CSTATE.WANDER);
        }
        break;
      case CSTATE.FLEE: {
        const t = this.threat?.position ?? this.pos;
        if (!this.goal || this.stateTime % 1.5 < dt || this.blockedTime > 0.6) {
          const ax = this.pos.x - t.x;
          const az = this.pos.z - t.z;
          const len = Math.hypot(ax, az) || 1;
          const turn = this.blockedTime > 0.6 ? (this.rand() - 0.5) * 2.5 : (this.rand() - 0.5) * 0.6;
          const a = Math.atan2(ax / len, az / len) + turn;
          this.goal = new THREE.Vector2(this.pos.x + Math.sin(a) * 35, this.pos.z + Math.cos(a) * 35);
          this.blockedTime = 0;
        }
        this._steer(dt, this.goal.x, this.goal.y, sp.vel_correr);
        break;
      }
      case CSTATE.CHASE: {
        const t = this.target;
        if (!t) break;
        if (this._dist2D(t.position) < this._reach(t)) {
          this._setState(CSTATE.ATTACK);
          break;
        }
        this._steer(dt, t.position.x, t.position.z, sp.vel_correr);
        break;
      }
      case CSTATE.ATTACK: {
        const t = this.target;
        if (!t) break;
        this._brake(dt);
        this._face(dt, t.position.x, t.position.z);
        if (this._dist2D(t.position) > this._reach(t) * 1.35) {
          this._setState(CSTATE.CHASE);
          break;
        }
        if (this.attackCooldown <= 0) {
          this.attackCooldown = sp.intervalo_ataque ?? 1.2;
          this.attackAnim = 1;
          this._pendingBite = 0.22; // o dano acontece no meio do bote
          sound.creature(this, 'ataque');
        }
        break;
      }
      default:
        break;
    }
    if (this._pendingBite !== undefined && this._pendingBite >= 0) {
      this._pendingBite -= dt;
      if (this._pendingBite < 0 && this.target && this._dist2D(this.target.position) < this._reach(this.target) * 1.4) {
        this.manager.hit(this, this.target, this.damage);
      }
    }

    const g = this._groundY(this.pos.x, this.pos.z);
    this.pos.y += (g - this.pos.y) * Math.min(1, dt * 10);

    // Inclina o corpo acompanhando o terreno.
    if (this.spec.body !== 'biped' && !this.aquatic) {
      const len = Math.max(1, this.radius * 2.2);
      const fx = -Math.sin(this.yaw);
      const fz = -Math.cos(this.yaw);
      const hf = this.world.heightAt(this.pos.x + fx * len * 0.5, this.pos.z + fz * len * 0.5);
      const hb = this.world.heightAt(this.pos.x - fx * len * 0.5, this.pos.z - fz * len * 0.5);
      const inWater = this.swims && this.world.waterAt(this.pos.x, this.pos.z);
      const target = inWater ? 0 : clamp(Math.atan2(hf - hb, len), -0.5, 0.5);
      this.pitch += (target - this.pitch) * Math.min(1, dt * 4);
    }
  }

  // Voadores: planam em círculos; os caçadores mergulham para atacar.
  _updateFlying(dt) {
    const sp = this.species;
    const fleeing = this.state === CSTATE.FLEE;
    const hunting = (this.state === CSTATE.CHASE || this.state === CSTATE.ATTACK) && this.target;
    if (!fleeing && !hunting) this.state = CSTATE.WANDER;
    if (!this.goal || this.stateTime > 30 || this._dist2DXY(this.goal.x, this.goal.y) < 12) {
      this.goal = this._pickWanderPoint(140, true) ?? new THREE.Vector2(this.rand() * 200 - 100, this.rand() * 200 - 100);
      this.stateTime = 0;
    }
    const ground = Math.max(0, this.world.heightAt(this.pos.x, this.pos.z));
    let wanted = ground + this.cruise + Math.sin(this.time * 0.3) * 4;
    let speed = sp.vel_andar;
    if (fleeing && this.threat) {
      const ax = this.pos.x - this.threat.position.x;
      const az = this.pos.z - this.threat.position.z;
      const len = Math.hypot(ax, az) || 1;
      this.goal = new THREE.Vector2(this.pos.x + (ax / len) * 60, this.pos.z + (az / len) * 60);
      wanted += 20;
      speed = sp.vel_correr;
    }
    if (hunting) {
      const t = this.target.position;
      this.goal = new THREE.Vector2(t.x, t.z);
      const d = this._dist2D(t);
      speed = sp.vel_correr;
      // mergulha quando pode atacar; sobe enquanto recarrega
      if (d < 28 && this.attackCooldown <= 0) wanted = t.y + 1.4;
      else if (this.attackCooldown > 0) wanted = ground + this.cruise * 0.6;
      const reach = (sp.alcance_ataque ?? 2) * this.scale + 0.6;
      if (d < reach && Math.abs(this.pos.y - (t.y + 1.2)) < 2.2 && this.attackCooldown <= 0) {
        this.manager.hit(this, this.target, this.damage);
        this.attackCooldown = (sp.intervalo_ataque ?? 1.5) * 2;
        this.attackAnim = 1;
      }
    }
    const prevYaw = this.yaw;
    this._steer(dt, this.goal.x, this.goal.y, speed, true);
    this.climb = clamp((wanted - this.pos.y) * 0.8, -9, 7);
    this.pos.y += this.climb * dt;
    if (this.pos.y < ground + 1.2) this.pos.y = ground + 1.2;
    const turning = angleDelta(prevYaw, this.yaw) / Math.max(dt, 1e-3);
    this.roll += (clamp(-turning * 0.6, -0.7, 0.7) - this.roll) * Math.min(1, dt * 2);
    this.pitch += (clamp(this.climb * 0.07, -0.45, 0.35) - this.pitch) * Math.min(1, dt * 2);
  }

  _steer(dt, tx, tz, speed, flying = false) {
    const dx = tx - this.pos.x;
    const dz = tz - this.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist < Math.max(1, this.radius)) {
      this._brake(dt);
      return true;
    }
    const want = Math.atan2(-dx, -dz);
    const delta = angleDelta(this.yaw, want);
    const turn = this.turnRate * dt * (speed > this.species.vel_andar * 1.5 ? 1.3 : 1);
    this.yaw += clamp(delta, -turn, turn);
    const target = speed * (Math.abs(delta) > 1.3 ? 0.35 : 1);
    this.speed += (target - this.speed) * Math.min(1, dt * 1.6);
    this._advance(dt, flying);
    return false;
  }

  _face(dt, tx, tz) {
    const want = Math.atan2(-(tx - this.pos.x), -(tz - this.pos.z));
    const turn = this.turnRate * 1.5 * dt;
    this.yaw += clamp(angleDelta(this.yaw, want), -turn, turn);
  }

  _brake(dt) {
    this.speed += (0 - this.speed) * Math.min(1, dt * 4);
    if (this.speed > 0.05) this._advance(dt, this.flies);
  }

  _advance(dt, flying) {
    const nx = this.pos.x - Math.sin(this.yaw) * this.speed * dt;
    const nz = this.pos.z - Math.cos(this.yaw) * this.speed * dt;
    if (!flying && !this._canStand(nx, nz)) {
      this.blockedTime += dt;
      this.speed *= 0.3;
      return false;
    }
    if (flying && Math.hypot(nx, nz) > BALANCE.mundo.limite_raio_m) {
      this.goal = new THREE.Vector2(0, 0);
      return false;
    }
    this.blockedTime = Math.max(0, this.blockedTime - dt);
    this.pos.x = nx;
    this.pos.z = nz;
    // desvia de troncos e pedras (os gigantes passam por cima de tudo)
    if (!flying && this.radius < 1.6) {
      const bx = this.pos.x;
      const bz = this.pos.z;
      this.world.vegetation.resolveCollisions(this.pos, this.radius * 0.6, this.pos.y + this.height * 0.5);
      if (Math.hypot(this.pos.x - bx, this.pos.z - bz) > this.speed * dt * 0.7) this.blockedTime += dt * 0.5;
    }
    return true;
  }

  _canStand(x, z) {
    if (Math.hypot(x, z) > BALANCE.mundo.limite_raio_m - 20) return false;
    const ground = this.world.heightAt(x, z);
    const water = this.world.waterAt(x, z);
    const depth = water ? water.level - ground : 0;
    if (this.aquatic) return depth > Math.max(0.8, this.height + 0.3);
    if (!this.swims && depth > Math.max(0.6, this.height * 0.45)) return false;
    if (this.species.perto_agua && !water) {
      const near = [[10, 0], [-10, 0], [0, 10], [0, -10]].some(([dx, dz]) => this.world.waterAt(x + dx, z + dz));
      if (!near) return false;
    }
    const here = this.world.heightAt(this.pos.x, this.pos.z);
    const step = Math.hypot(x - this.pos.x, z - this.pos.z) || 0.01;
    return (ground - here) / step <= 1.4;
  }

  _groundY(x, z) {
    const g = this.world.heightAt(x, z);
    const w = this.world.waterAt(x, z);
    if (this.aquatic && w) return Math.max(g + this.height, (w.level + g) * 0.5);
    if (this.swims && w) return Math.max(g, w.level - this.height * 0.75);
    return g;
  }

  _pickWanderPoint(range, flying = false) {
    for (let i = 0; i < 8; i++) {
      const a = this.rand() * TAU;
      const r = range * (0.3 + this.rand() * 0.7);
      const x = this.home.x + Math.sin(a) * r;
      const z = this.home.y + Math.cos(a) * r;
      if (flying) {
        if (Math.hypot(x, z) < BALANCE.mundo.limite_raio_m - 60) return new THREE.Vector2(x, z);
      } else if (this._canStand(x, z)) {
        return new THREE.Vector2(x, z);
      }
    }
    return null;
  }

  _reach(target) {
    const tr = target.radius ?? 0.4;
    return (this.species.alcance_ataque ?? 1.5) * this.scale + this.radius * 0.6 + tr;
  }

  _dist2D(p) {
    return Math.hypot(p.x - this.pos.x, p.z - this.pos.z);
  }

  _dist2DXY(x, z) {
    return Math.hypot(x - this.pos.x, z - this.pos.z);
  }

  // ---------------------------------------------------------
  // Dano e morte
  // ---------------------------------------------------------
  takeDamage(amount, attacker) {
    if (!this.alive) return;
    if (this.netControlled) {
      // co-op (convidado): quem decide o dano é o anfitrião
      this.hurtAnim = 1;
      this.manager.onNetDamage?.(this, amount);
      return;
    }
    this.health -= amount;
    this.hurtAnim = 1;
    if (this.health <= 0) {
      this.health = 0;
      this._setState(CSTATE.DEAD);
      sound.creature(this, 'morte');
      this.manager.onDeath(this, attacker);
      return;
    }
    const sp = this.species;
    sound.creature(this, 'dor');
    if (sp.temperamento === 'agressivo' || sp.revida) {
      this._chase(attacker);
      if (sp.temperamento === 'agressivo') this.manager.alertPack(this, attacker);
    } else {
      this._flee(attacker);
    }
  }

  // ---------------------------------------------------------
  // Animação (ossos)
  // ---------------------------------------------------------
  _animate(dt, ctx, yawVel) {
    const b = this.bones;
    const spec = this.spec;
    const t = this.time;
    const dead = this.state === CSTATE.DEAD;
    const A = this.anim;
    // longe da câmera: anima menos vezes
    const camDist = ctx.camPos.distanceTo(this.pos);
    this._animSkip = (this._animSkip ?? 0) + 1;
    if (camDist > 80 && this._animSkip % 3 !== 0) return;
    const adt = camDist > 80 ? dt * 3 : dt;
    const k = (rate) => Math.min(1, adt * rate);

    A.turn += (clamp(yawVel, -2, 2) - A.turn) * k(5);
    A.run += (clamp(this.speed / Math.max(0.1, this.species.vel_correr), 0, 1) - A.run) * k(4);
    const legLen = Math.max(0.25, this.height * 0.45);
    const stride = legLen * (spec.body === 'spider' ? 1.4 : 2.6);
    this.phase += (adt * this.speed) / stride;
    const amp = clamp(this.speed / (legLen * 3), 0, 0.75);

    // ---------- voadores ----------
    if (spec.body === 'flyer') {
      const flapping = this.climb > 0.5 || this.state === CSTATE.FLEE || this.attackCooldown > 0;
      const diving = this.climb < -2;
      const f = flapping ? Math.sin(t * (this.species.raio > 1 ? 4 : this.species.raio < 0.4 ? 14 : 9)) : Math.sin(t * 1.3) * 0.12;
      let a = dead ? 0.9 : f * 0.6 + 0.05;
      if (diving && !dead) a = -0.35; // asas recolhidas no mergulho
      if (b.asaE) b.asaE.rotation.z = a;
      if (b.asaD) b.asaD.rotation.z = -a;
      if (b.asaE_punho) b.asaE_punho.rotation.z = flapping ? a * 0.5 : -0.1;
      if (b.asaD_punho) b.asaD_punho.rotation.z = flapping ? -a * 0.5 : 0.1;
      if (b.head) b.head.rotation.y = Math.sin(t * 0.7 + this.id) * 0.25;
      if (b.neck) b.neck.rotation.x = -this.attackAnim * 0.5;
      return;
    }

    // ---------- cobra ----------
    if (spec.body === 'snake') {
      const moving = this.speed > 0.2;
      const a = moving ? 0.34 : 0.07;
      for (let i = 0; i < 10; i++) {
        const bone = b[`b${i}`];
        if (bone) bone.rotation.y = dead ? Math.sin(i) * 0.15 : Math.sin(this.phase * TAU * 2 - i * 0.9 + (moving ? 0 : t * 0.8)) * a;
      }
      if (b.head) {
        // levanta a cabeça para dar o bote
        b.head.rotation.y = dead ? 0 : -Math.sin(this.phase * TAU * 2) * a * 0.5;
        b.head.rotation.x = this.attackAnim > 0 ? Math.sin(this.attackAnim * Math.PI) * 0.7 : (this.state === CSTATE.CHASE ? 0.15 : 0);
      }
      return;
    }

    // ---------- peixe ----------
    if (spec.body === 'fish') {
      const s = dead ? 0 : Math.sin(t * (4 + A.run * 8));
      if (b.tail1) b.tail1.rotation.y = s * 0.35;
      if (b.tail2) b.tail2.rotation.y = s * 0.5;
      if (b.head) b.head.rotation.y = -s * 0.1;
      if (b.head) b.head.rotation.x = -this.attackAnim * 0.3;
      return;
    }

    // ---------- pernas ----------
    const inWater = this.swims && !!this.world.waterAt(this.pos.x, this.pos.z) && this.pos.y < this.world.waterAt(this.pos.x, this.pos.z).level - 0.2;
    for (const leg of spec.legs ?? []) {
      const thigh = b[leg.name];
      const knee = b[`${leg.name}_joelho`];
      const foot = b[`${leg.name}_pe`];
      if (!thigh) continue;
      const isArm = leg.name.startsWith('braco');
      if (dead) {
        // patas encolhidas/esticadas
        thigh.rotation.x += (0.5 - thigh.rotation.x) * k(3);
        if (knee) knee.rotation.x += (-0.7 - knee.rotation.x) * k(3);
        continue;
      }
      if (inWater) {
        const paddle = Math.sin(t * 5 + leg.phase * TAU) * 0.4;
        thigh.rotation.x = 0.6 + paddle;
        if (knee) knee.rotation.x = -0.4;
        continue;
      }
      if (isArm) {
        const reach = this.attackAnim > 0 ? -Math.sin(this.attackAnim * Math.PI) * 0.8 : 0;
        thigh.rotation.x = 0.3 + Math.sin((this.phase + leg.phase) * TAU) * amp * 0.3 + reach;
        continue;
      }
      const ph = (this.phase + leg.phase) * TAU;
      const swing = Math.sin(ph);
      const lift = Math.max(0, Math.cos(ph)); // perna indo para frente = levanta
      if (spec.body === 'spider') {
        // pernas de aranha: sobem e descem para os lados
        thigh.rotation.z = (leg.name.endsWith('E') ? 1 : -1) * lift * amp * 0.6;
        thigh.rotation.y = swing * amp * 0.5;
        continue;
      }
      thigh.rotation.x = swing * amp * (1 + A.run * 0.3);
      if (knee) knee.rotation.x = -lift * amp * 1.4;
      if (foot) foot.rotation.x = -thigh.rotation.x * 0.6 + lift * amp * 0.5;
    }

    // ---------- corpo ----------
    if (b.hips) {
      const rest = b.hips.userData.rest;
      const bob = Math.abs(Math.sin(this.phase * TAU)) * amp * legLen * 0.09;
      const breathe = Math.sin(t * 1.6) * 0.012 * legLen * (1 - A.run);
      b.hips.position.y = rest.y + (bob + breathe) / this.scale;
      // balanço lateral de quem anda em 2 pernas + inclinação nas curvas
      const sway = spec.body === 'biped' ? Math.sin(this.phase * TAU) * amp * 0.06 : 0;
      b.hips.rotation.z = sway - A.turn * 0.08 + this.hurtAnim * 0.15;
      // correndo, o corpo inclina para frente
      b.hips.rotation.x = -A.run * 0.06 * (spec.body === 'biped' ? 1 : 0.4) + (dead ? 0 : 0);
    }
    if (b.chest) b.chest.rotation.y = A.turn * 0.12;

    // ---------- cauda (segue as curvas com atraso) ----------
    const tailIdle = inWater ? 0.35 : 0.09 * (1 - A.run * 0.6);
    const tailSpeed = inWater ? 3 : 1.3;
    ['tail1', 'tail2', 'tail3'].forEach((n, i) => {
      if (!b[n]) return;
      const target = dead ? 0.15 : -A.turn * 0.12 * (i + 1) + Math.sin(t * tailSpeed - i * 0.9) * tailIdle;
      A.tail[i] += (target - A.tail[i]) * k(4 - i);
      b[n].rotation.y = A.tail[i];
      // correndo, a cauda fica reta para trás
      b[n].rotation.x = A.run * 0.05;
    });

    // ---------- pescoço e cabeça ----------
    // olha para o alvo; parado, olha em volta; comendo, abaixa a cabeça
    let wantYaw = 0;
    let wantPitch = 0;
    const tgt = this.target ?? (this.state === CSTATE.FLEE ? this.threat : null);
    if (tgt && !dead) {
      const dx = tgt.position.x - this.pos.x;
      const dz = tgt.position.z - this.pos.z;
      wantYaw = clamp(angleDelta(this.yaw, Math.atan2(-dx, -dz)), -0.8, 0.8);
      wantPitch = clamp(((tgt.position.y + 1) - (this.pos.y + this.height)) / (Math.hypot(dx, dz) + 1), -0.4, 0.4);
    } else if (this.state === CSTATE.IDLE) {
      wantYaw = Math.sin(t * 0.5 + this.id) * 0.5;
      wantPitch = Math.sin(t * 0.3 + this.id * 2) * 0.12;
    }
    A.headYaw += (wantYaw - A.headYaw) * k(3);
    A.headPitch += (wantPitch - A.headPitch) * k(3);
    const eating = this.state === CSTATE.EAT;
    const neckDown = eating ? -0.55 - Math.max(0, Math.sin(t * 2.2)) * 0.15 : 0;
    A.neck += (neckDown - A.neck) * k(3);
    // bote: recua (0..0.3) e avança (0.3..0.7)
    const at = 1 - this.attackAnim;
    const lunge = this.attackAnim > 0 ? (at < 0.3 ? at / 0.3 * 0.25 : -Math.sin(((at - 0.3) / 0.7) * Math.PI) * 0.6) : 0;
    if (b.neck) {
      b.neck.rotation.x = dead ? -0.35 : A.neck + lunge + A.headPitch * 0.5 + this.hurtAnim * 0.25;
      b.neck.rotation.y = A.headYaw * 0.5;
    }
    if (b.neck2) b.neck2.rotation.x = eating ? -0.35 : A.headPitch * 0.3;
    if (b.head) {
      b.head.rotation.x = eating ? -0.3 : A.headPitch * 0.5 + lunge * 0.4;
      b.head.rotation.y = A.headYaw * 0.5;
    }
    if (b.jaw) b.jaw.rotation.x = this.attackAnim > 0 ? -Math.sin(at * Math.PI) * 0.65 : -0.03 - Math.max(0, Math.sin(t * 0.7)) * 0.05;
    if (b.hips) b.hips.position.z = (b.hips.userData.rest.z) - lunge * 0.15 * legLen / this.scale;
  }

  // ---------------------------------------------------------
  // Co-op (convidado): a criatura só segue o que o anfitrião manda.
  // ---------------------------------------------------------
  applyNet(e) {
    // e = { x, y, z, yaw, st, hp, atk, loot }
    if (!this.netGoal) {
      this.pos.set(e.x, e.y, e.z);
      this.yaw = e.yaw;
      this.netGoal = new THREE.Vector3();
    }
    this.netGoal.set(e.x, e.y, e.z);
    this.netYaw = e.yaw;
    if (this._lastHp === undefined) this._lastHp = e.hp;
    this.health = e.hp;
    if (e.hp < this._lastHp && e.hp > 0) sound.creature(this, 'dor');
    this._lastHp = e.hp;
    if (e.atk && this.attackAnim <= 0.05) {
      this.attackAnim = 1;
      sound.creature(this, 'ataque');
    }
    if (e.st === CSTATE.DEAD && this.state !== CSTATE.DEAD) {
      this.health = 0;
      this._setState(CSTATE.DEAD);
      sound.creature(this, 'morte');
    } else if (e.st !== CSTATE.DEAD) {
      if (e.st === CSTATE.CHASE && this.state !== CSTATE.CHASE && this.state !== CSTATE.ATTACK) sound.creature(this, 'rugido');
      this.state = e.st;
    }
    this.lootLeft = e.loot ? { remoto: 1 } : null;
    this.netSeen = 0;
  }

  _netUpdate(dt, ctx) {
    this.time += dt;
    this.attackAnim = Math.max(0, this.attackAnim - dt * 2.2);
    this.hurtAnim = Math.max(0, this.hurtAnim - dt * 3);
    this.netSeen = (this.netSeen ?? 0) + dt;
    const prevYaw = this.yaw;
    if (this.state === CSTATE.DEAD) this.deadTime += dt;
    if (this.netGoal) {
      const before = this.pos.clone();
      const k = Math.min(1, dt * 7);
      this.pos.lerp(this.netGoal, k);
      this.yaw += angleDelta(this.yaw, this.netYaw) * k;
      const moved = Math.hypot(this.pos.x - before.x, this.pos.z - before.z) / Math.max(dt, 1e-3);
      this.speed += (moved - this.speed) * Math.min(1, dt * 6);
    }
    if (this.state === CSTATE.DEAD) this.speed = 0;
    const yawVel = angleDelta(prevYaw, this.yaw) / Math.max(dt, 1e-3);
    this._animate(dt, ctx, yawVel);
    this._sync(dt);
  }

  // Copia posição e rotação para a malha 3D.
  _sync(dt) {
    const m = this.mesh;
    if (this.state === CSTATE.DEAD) {
      // tomba de lado aos poucos (cobras e jacarés ficam de barriga para cima)
      const k = Math.min(1, this.deadTime * 1.6);
      const side = ['snake', 'croc', 'fish', 'spider'].includes(this.spec.body) ? Math.PI : Math.PI / 2;
      if (this.flies || this.aquatic) {
        const g = this.world.heightAt(this.pos.x, this.pos.z);
        const w = this.world.waterAt(this.pos.x, this.pos.z);
        const floor = this.aquatic && w ? w.level - 0.1 : g + 0.3;
        this.pos.y += (floor - this.pos.y) * Math.min(1, dt * 3);
      }
      m.position.copy(this.pos);
      m.rotation.set(this.pitch, this.yaw, side * (k * k * (3 - 2 * k)), 'YXZ');
      return;
    }
    m.position.copy(this.pos);
    m.rotation.set(this.pitch, this.yaw, this.roll, 'YXZ');
  }
}
