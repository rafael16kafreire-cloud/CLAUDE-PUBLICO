// =============================================================
// CRIATURA – comportamento (IA) e animação
// Máquina de estados: vagar, parado, comer, fugir, perseguir,
// atacar, voltar ao território e morto.
// O jeito de cada espécie vem de data/creatures/criaturas.json
// (temperamento, velocidade, dano...) e o formato de
// creature_models.js.
// =============================================================
import * as THREE from 'three';
import { angleDelta, clamp } from '../core/math.js';
import { BALANCE } from '../core/balance.js';

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

    // Atributos que crescem com o nível.
    this.maxHealth = Math.round(species.vida * (1 + 0.06 * (level - 1)));
    this.health = this.maxHealth;
    this.damage = species.dano * (1 + 0.03 * (level - 1));
    this.scale = (species.tamanho ?? 1) * (0.92 + Math.min(level, 30) * 0.006 + rand() * 0.06);

    this.flies = !!species.voa;
    this.swims = !!species.nada;
    this.pos = new THREE.Vector3(x, 0, z);
    this.home = new THREE.Vector2(x, z);
    this.yaw = rand() * TAU;
    this.speed = 0;
    this.state = CSTATE.WANDER;
    this.stateTime = 0;
    this.target = null;       // quem está perseguindo
    this.threat = null;       // de quem está fugindo
    this.goal = null;         // ponto para onde está andando
    this.attackCooldown = 0;
    this.attackAnim = 0;
    this.blockedTime = 0;
    this.thinkTimer = rand() * 0.3;
    this.phase = rand();
    this.time = rand() * 100;
    this.deadTime = 0;
    this.pitch = 0;
    this.roll = 0;
    this.lastHitByPlayer = 0;
    this.turnRate = (this.flies ? 1.2 : 2.6) / Math.max(1, Math.sqrt(species.raio));

    if (this.flies) {
      const [a, b] = species.altura_voo;
      this.cruise = a + rand() * (b - a);
      this.pos.y = world.heightAt(x, z) + this.cruise;
    } else {
      this.pos.y = this._groundY(x, z);
    }
    this.mesh.scale.setScalar(this.scale);
    this._sync();
  }

  get alive() {
    return this.state !== CSTATE.DEAD;
  }

  get radius() {
    return this.species.raio * this.scale;
  }

  get position() {
    return this.pos;
  }

  get height() {
    return this.species.altura * this.scale;
  }

  // Centro do corpo (para mirar e para a barra de vida).
  center(out = new THREE.Vector3()) {
    return out.copy(this.pos).setY(this.flies ? this.pos.y : this.pos.y + this.height * 0.5);
  }

  // ---------------------------------------------------------
  update(dt, ctx) {
    this.time += dt;
    this.stateTime += dt;
    this.attackCooldown -= dt;
    this.attackAnim = Math.max(0, this.attackAnim - dt * 2.5);

    if (this.state === CSTATE.DEAD) {
      this.deadTime += dt;
      this.speed = 0;
      this._animate(dt, ctx);
      this._sync();
      return;
    }

    this.thinkTimer -= dt;
    if (this.thinkTimer <= 0) {
      this.thinkTimer = 0.25;
      this._think(ctx);
    }

    if (this.flies) this._updateFlying(dt, ctx);
    else this._updateGround(dt, ctx);

    this._animate(dt, ctx);
    this._sync();
  }

  // ---------------------------------------------------------
  // Decisões (4x por segundo)
  // ---------------------------------------------------------
  _think(ctx) {
    const sp = this.species;
    const player = ctx.player;
    const temp = sp.temperamento;
    const dPlayer = player.dead ? Infinity : this._dist2D(player.position);
    // Agachado, o jogador é percebido mais de perto.
    const perceived = player.crouching ? dPlayer * 1.6 : dPlayer;

    if (this.state === CSTATE.FLEE) {
      if (this.stateTime > 9 || (this.threat && this._dist2D(this.threat.position) > 45)) this._setState(CSTATE.WANDER);
      return;
    }

    if (this.state === CSTATE.CHASE || this.state === CSTATE.ATTACK) {
      const t = this.target;
      const gone = !t || (t.alive === false) || (t === player && player.dead);
      const far = t && this._dist2D(t.position) > (sp.alcance_agro ?? 20) * 2.2;
      const leash = this.home.distanceTo(new THREE.Vector2(this.pos.x, this.pos.z)) > 140;
      if (gone || far || leash || this.blockedTime > 5) {
        this.target = null;
        this._setState(leash ? CSTATE.RETURN : CSTATE.WANDER);
      }
      return;
    }

    // Reações ao jogador por temperamento.
    if (temp === 'medroso' && perceived < 16) {
      this._flee(player);
      return;
    }
    if (temp === 'territorial' && perceived < (sp.alcance_agro ?? 8)) {
      this._chase(player);
      return;
    }
    if (temp === 'agressivo' && perceived < (sp.alcance_agro ?? 20) && this._canReach(player, ctx)) {
      this._chase(player);
      this.manager.alertPack(this, player);
      return;
    }

    // Carnívoros também caçam herbívoros menores (cadeia alimentar).
    if (temp === 'agressivo' && this.state === CSTATE.WANDER && this.rand() < 0.04) {
      const prey = this.manager.findPrey(this);
      if (prey) this._chase(prey);
    }

    // Longe demais de casa: volta.
    if (this.state !== CSTATE.RETURN && this.home.distanceTo(new THREE.Vector2(this.pos.x, this.pos.z)) > 110) {
      this._setState(CSTATE.RETURN);
    }
  }

  // Animais da água só caçam quem está na água ou na beira.
  _canReach(target, ctx) {
    if (this.species.perto_agua) {
      const p = target.position;
      if (ctx.world.waterAt(p.x, p.z)) return true;
      for (const [dx, dz] of [[6, 0], [-6, 0], [0, 6], [0, -6]]) {
        if (ctx.world.waterAt(p.x + dx, p.z + dz)) return true;
      }
      return false;
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
    if (this.state !== CSTATE.CHASE && this.state !== CSTATE.ATTACK) this._setState(CSTATE.CHASE);
  }

  // ---------------------------------------------------------
  // Movimento no chão (e na água para quem nada)
  // ---------------------------------------------------------
  _updateGround(dt, ctx) {
    const sp = this.species;
    switch (this.state) {
      case CSTATE.WANDER: {
        if (!this.goal || this.stateTime > 25) this.goal = this._pickWanderPoint(sp.raio > 2 ? 60 : 32);
        if (!this.goal || this._steer(dt, this.goal.x, this.goal.y, sp.vel_andar)) {
          const herb = sp.dieta === 'herbivoro';
          this._setState(herb && this.rand() < 0.6 ? CSTATE.EAT : CSTATE.IDLE);
          this.idleFor = 3 + this.rand() * 6;
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
          let ax = this.pos.x - t.x;
          let az = this.pos.z - t.z;
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
        const reach = this._reach(t);
        if (this._dist2D(t.position) < reach) {
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
        const d = this._dist2D(t.position);
        if (d > this._reach(t) * 1.35) {
          this._setState(CSTATE.CHASE);
          break;
        }
        if (this.attackCooldown <= 0) {
          this.attackCooldown = sp.intervalo_ataque ?? 1.2;
          this.attackAnim = 1;
          this.manager.hit(this, t, this.damage);
        }
        break;
      }
      default:
        break;
    }

    // Altura: chão, ou boiando na água para quem nada.
    const g = this._groundY(this.pos.x, this.pos.z);
    this.pos.y += (g - this.pos.y) * Math.min(1, dt * 10);

    // Inclina o corpo acompanhando o terreno.
    if (this.spec.body !== 'biped') {
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

  // Voadores: planam em círculos acima do chão.
  _updateFlying(dt, ctx) {
    const sp = this.species;
    const fleeing = this.state === CSTATE.FLEE;
    if (this.state !== CSTATE.FLEE) this.state = CSTATE.WANDER;
    if (!this.goal || this.stateTime > 30 || this._dist2DXY(this.goal.x, this.goal.y) < 12) {
      // sem ponto válido perto de casa: volta para o meio da ilha
      this.goal = this._pickWanderPoint(140, true) ?? new THREE.Vector2(this.rand() * 200 - 100, this.rand() * 200 - 100);
      this.stateTime = 0;
    }
    if (fleeing && this.threat) {
      const ax = this.pos.x - this.threat.position.x;
      const az = this.pos.z - this.threat.position.z;
      const len = Math.hypot(ax, az) || 1;
      this.goal = new THREE.Vector2(this.pos.x + (ax / len) * 60, this.pos.z + (az / len) * 60);
    }
    const speed = fleeing ? sp.vel_correr : sp.vel_andar;
    const prevYaw = this.yaw;
    this._steer(dt, this.goal.x, this.goal.y, speed, true);
    const ground = Math.max(0, this.world.heightAt(this.pos.x, this.pos.z));
    const wanted = ground + this.cruise + (fleeing ? 20 : 0) + Math.sin(this.time * 0.3) * 4;
    this.climb = clamp((wanted - this.pos.y) * 0.6, -4, 6);
    this.pos.y += this.climb * dt;
    if (this.pos.y < ground + 3) this.pos.y = ground + 3;
    // Inclina nas curvas.
    const turning = angleDelta(prevYaw, this.yaw) / Math.max(dt, 1e-3);
    this.roll += (clamp(-turning * 0.6, -0.6, 0.6) - this.roll) * Math.min(1, dt * 2);
    this.pitch += (clamp(this.climb * 0.06, -0.3, 0.3) - this.pitch) * Math.min(1, dt * 2);
  }

  // Anda na direção de um ponto. Devolve true ao chegar.
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
    this.speed += (target - this.speed) * Math.min(1, dt * 2.5);
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
    return true;
  }

  // Pode ficar neste ponto? (água funda, borda do mapa, paredão)
  _canStand(x, z) {
    if (Math.hypot(x, z) > BALANCE.mundo.limite_raio_m - 20) return false;
    const ground = this.world.heightAt(x, z);
    const water = this.world.waterAt(x, z);
    const depth = water ? water.level - ground : 0;
    if (!this.swims && depth > Math.max(0.6, this.height * 0.45)) return false;
    if (this.species.perto_agua && !water) {
      // crocodilo: não se afasta muito da água
      const near = [[10, 0], [-10, 0], [0, 10], [0, -10]].some(([dx, dz]) => this.world.waterAt(x + dx, z + dz));
      if (!near) return false;
    }
    const here = this.world.heightAt(this.pos.x, this.pos.z);
    const step = Math.hypot(x - this.pos.x, z - this.pos.z) || 0.01;
    if ((ground - here) / step > 1.4) return false;
    return true;
  }

  _groundY(x, z) {
    const g = this.world.heightAt(x, z);
    if (this.swims) {
      const w = this.world.waterAt(x, z);
      if (w) return Math.max(g, w.level - this.height * 0.75);
    }
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
      } else if (this._canStand(x, z) || (this.swims && this.world.waterAt(x, z))) {
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
    this.health -= amount;
    this.hurtAnim = 1;
    if (this.health <= 0) {
      this.health = 0;
      this._setState(CSTATE.DEAD);
      this.manager.onDeath(this, attacker);
      return;
    }
    const sp = this.species;
    const big = sp.dano > 0 && sp.raio >= 2;
    if (sp.temperamento === 'agressivo' || sp.temperamento === 'territorial' || (big && !this.flies)) {
      this._chase(attacker);
      if (sp.temperamento === 'agressivo') this.manager.alertPack(this, attacker);
    } else {
      this._flee(attacker);
    }
  }

  // ---------------------------------------------------------
  // Animação (ossos)
  // ---------------------------------------------------------
  _animate(dt, ctx) {
    const b = this.bones;
    const spec = this.spec;
    const t = this.time;
    const dead = this.state === CSTATE.DEAD;
    // Longe da câmera: anima menos vezes (economiza).
    const camDist = ctx.camPos.distanceTo(this.pos);
    this._animSkip = (this._animSkip ?? 0) + 1;
    if (camDist > 80 && this._animSkip % 3 !== 0) return;

    const run = clamp(this.speed / Math.max(0.1, this.species.vel_correr), 0, 1);
    const legLen = Math.max(0.3, this.height * 0.45);
    this.phase += (dt * this.speed) / (legLen * 2.2) * (spec.body === 'snake' ? 0.6 : 1);
    const amp = clamp(this.speed / (legLen * 3), 0, 0.75);
    const swing = (p) => Math.sin((this.phase + p) * TAU);

    if (spec.body === 'flyer') {
      const flapping = this.climb > 0.5 || this.state === CSTATE.FLEE || dead;
      const f = flapping ? Math.sin(t * (this.species.raio > 1 ? 4 : 9)) : Math.sin(t * 1.3) * 0.15;
      const a = dead ? 0 : f * 0.55 + 0.05;
      if (b.asaE) b.asaE.rotation.z = a;
      if (b.asaD) b.asaD.rotation.z = -a;
      if (b.asaE_punho) b.asaE_punho.rotation.z = a * 0.5;
      if (b.asaD_punho) b.asaD_punho.rotation.z = -a * 0.5;
      if (b.head) b.head.rotation.y = Math.sin(t * 0.7) * 0.2;
      return;
    }

    if (spec.body === 'snake') {
      const moving = this.speed > 0.2;
      const a = moving ? 0.32 : 0.06;
      for (let i = 0; i < 10; i++) {
        const bone = b[`b${i}`];
        if (bone) bone.rotation.y = dead ? 0 : Math.sin(this.phase * TAU * 2 - i * 0.9 + t * (moving ? 0 : 0.8)) * a;
      }
      if (b.head) {
        b.head.rotation.y = dead ? 0 : -Math.sin(this.phase * TAU * 2) * a * 0.5;
        b.head.rotation.x = this.attackAnim * 0.6;
      }
      return;
    }

    // Pernas e braços
    const inWater = this.swims && this.world.waterAt(this.pos.x, this.pos.z) && this.pos.y < this.world.waterAt(this.pos.x, this.pos.z).level - 0.2;
    for (const leg of spec.legs ?? []) {
      const thigh = b[leg.name];
      const knee = b[`${leg.name}_joelho`];
      const foot = b[`${leg.name}_pe`];
      if (!thigh) continue;
      const isArm = leg.name.startsWith('braco');
      if (dead) {
        thigh.rotation.x = 0.4;
        if (knee) knee.rotation.x = -0.3;
        continue;
      }
      if (inWater) {
        // nadando: patas recolhidas para trás
        thigh.rotation.x = 0.9;
        if (knee) knee.rotation.x = -0.4;
        continue;
      }
      if (isArm) {
        thigh.rotation.x = 0.3 + swing(leg.phase) * amp * 0.3;
        continue;
      }
      const s = swing(leg.phase);
      thigh.rotation.x = s * amp;
      if (knee) knee.rotation.x = -Math.max(0, Math.sin((this.phase + leg.phase) * TAU + 1.3)) * amp * 1.1;
      if (foot) foot.rotation.x = -thigh.rotation.x * 0.6 - (knee ? knee.rotation.x : 0) * 0.5;
    }

    // Quadril sobe e desce no passo.
    if (b.hips) {
      const rest = b.hips.userData.rest;
      b.hips.position.y = rest.y + Math.abs(Math.sin(this.phase * TAU)) * amp * legLen * 0.08 / this.scale;
    }

    // Cauda balança (mais solta parado, mais firme correndo).
    const tailAmp = inWater ? 0.35 : 0.1 * (1 - run * 0.6);
    const tailSpeed = inWater ? 3 : 1.4;
    ['tail1', 'tail2', 'tail3'].forEach((n, i) => {
      if (b[n]) b[n].rotation.y = dead ? 0.2 : Math.sin(t * tailSpeed + i * 0.8) * tailAmp;
    });

    // Pescoço e cabeça: comer (abaixa), olhar em volta, atacar (bote).
    const eating = this.state === CSTATE.EAT;
    const look = this.state === CSTATE.IDLE ? Math.sin(t * 0.6 + this.id) * 0.35 : Math.sin(t * 0.3) * 0.08;
    const neckDown = eating ? -0.55 - Math.sin(t * 2) * 0.08 : 0;
    if (b.neck) {
      b.neck.rotation.x = dead ? -0.3 : neckDown - this.attackAnim * 0.45 + (this.hurtAnim ?? 0) * 0.2;
      b.neck.rotation.y = look;
    }
    if (b.neck2) b.neck2.rotation.x = eating ? -0.35 : 0;
    if (b.head) b.head.rotation.x = eating ? -0.3 : this.attackAnim * 0.25;
    if (b.jaw) b.jaw.rotation.x = -this.attackAnim * 0.6;
    this.hurtAnim = Math.max(0, (this.hurtAnim ?? 0) - dt * 3);
  }

  // Copia posição e rotação para a malha 3D.
  _sync() {
    const m = this.mesh;
    m.position.copy(this.pos);
    if (this.state === CSTATE.DEAD) {
      // tomba de lado aos poucos
      const k = Math.min(1, this.deadTime * 1.5);
      const side = this.spec.body === 'snake' || this.spec.body === 'croc' ? Math.PI : Math.PI / 2;
      m.rotation.set(this.pitch, this.yaw, side * k, 'YXZ');
      if (this.flies) {
        const g = this.world.heightAt(this.pos.x, this.pos.z);
        this.pos.y = Math.max(g + 0.3, this.pos.y - 12 * (1 / 60));
      }
      return;
    }
    m.rotation.set(this.pitch, this.yaw, this.roll, 'YXZ');
  }
}
