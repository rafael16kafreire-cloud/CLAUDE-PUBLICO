// =============================================================
// JOGADOR – movimento e física simples
// Andar, correr, pular, agachar e nadar. A "física" é feita à mão
// (leve para celular): gravidade, chão pela altura do terreno,
// círculos de colisão para árvores/pedras e flutuação na água.
// =============================================================
import * as THREE from 'three';
import { BALANCE } from '../core/balance.js';
import { events, EV } from '../core/event_bus.js';
import { angleDelta } from '../core/math.js';
import { PlayerStats } from './player_stats.js';
import { PlayerModel } from './player_model.js';

const RADIUS = 0.38;            // "largura" do jogador para colisão
const EYE_STAND = 1.62;         // altura dos olhos em pé
const EYE_CROUCH = 1.0;         // altura dos olhos agachado
const SWIM_ENTER_DEPTH = 1.25;  // água acima disso (nos pés) = começa a nadar
const SWIM_EXIT_DEPTH = 1.05;   // água abaixo disso = volta a andar
const FLOAT_DEPTH = 1.45;       // boiando, os pés ficam X m abaixo da superfície

export class Player {
  constructor(world, scene) {
    this.world = world;
    this.position = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    this.facing = 0;               // para onde o corpo está virado
    this.onGround = false;
    this.crouching = false;
    this.running = false;
    this.swimming = false;
    this.swimFast = false;
    this.moving = false;
    this.headUnderwater = false;
    this.dead = false;
    this.waterBody = null;          // corpo d'água onde está agora
    this.firstPerson = false;

    this.stats = new PlayerStats();
    this.stats.onDeath = (cause) => this._die(cause);
    this.model = new PlayerModel();
    scene.add(this.model.root);

    const M = BALANCE.movimento;
    this._maxSlopeTan = Math.tan((M.inclinacao_max_graus * Math.PI) / 180);
    this._minNormalY = Math.cos((M.inclinacao_max_graus * Math.PI) / 180);
    this._normal = new THREE.Vector3();
    this._boundsMsgTimer = 0;
    this._attackTimer = 0;
    this._pendingHit = -1;
    this._biome = null;
    this._biomeCandidate = null;
    this._biomeTimer = 0;
    this.onPunch = null; // animação das mãos em 1ª pessoa (main.js define)
  }

  get radius() {
    return RADIUS;
  }

  get eyeHeight() {
    return this.crouching && !this.swimming ? EYE_CROUCH : EYE_STAND;
  }

  spawnAt(point) {
    this.position.copy(point.position);
    this.velocity.set(0, 0, 0);
    this.facing = point.yaw;
    this.swimming = false;
    this.crouching = false;
    this.onGround = true;
  }

  // cam = { yaw, pitch } da câmera
  update(dt, input, cam) {
    if (this.dead) {
      this._updateModel(dt);
      return;
    }

    // ---------- Entrada: direção relativa à câmera ----------
    const mv = input.moveVector();
    const mag = Math.min(1, Math.hypot(mv.x, mv.y));
    this.moving = mag > 0.05;
    const sinY = Math.sin(cam.yaw);
    const cosY = Math.cos(cam.yaw);
    // frente (f) e direita (r) da câmera no chão
    const fx = -sinY;
    const fz = -cosY;
    const rx = cosY;
    const rz = -sinY;
    const dirX = fx * mv.y + rx * mv.x;
    const dirZ = fz * mv.y + rz * mv.x;

    const runRequest = input.isHeld('run') || input.runToggle;

    // ---------- Água ----------
    const body = this.world.waterAt(this.position.x, this.position.z);
    const depth = body ? body.level - this.position.y : 0;
    if (!this.swimming && body && depth > SWIM_ENTER_DEPTH) {
      this.swimming = true;
      this.crouching = false;
    } else if (this.swimming && (!body || depth < SWIM_EXIT_DEPTH)) {
      this.swimming = false;
    }
    this.waterBody = body;

    if (this.swimming) {
      this._swim(dt, input, cam, mv, mag, runRequest, body);
    } else {
      if (input.wasPressed('crouch')) this.crouching = !this.crouching;
      this._walk(dt, input, dirX, dirZ, mag, runRequest, body ? depth : 0);
    }

    // ---------- Soco (Atacar) ----------
    this._updateAttack(dt, input, cam);

    // ---------- Colisões e limite do mapa ----------
    this.world.resolveCollisions(this.position, RADIUS, this.position.y);
    this.world.creatures?.resolvePlayer(this.position, RADIUS);
    this._keepInsideWorld(dt);
    // Depois de empurrado, não pode ficar dentro do chão.
    const ground = this.world.heightAt(this.position.x, this.position.z);
    if (this.position.y < ground) this.position.y = ground;

    // ---------- Cabeça embaixo d'água? ----------
    const bodyNow = this.world.waterAt(this.position.x, this.position.z);
    this.headUnderwater = !!bodyNow && this.position.y + this.eyeHeight < bodyNow.level - 0.05;

    // ---------- Para onde o corpo olha ----------
    if (this.moving) {
      const target = Math.atan2(-dirX, -dirZ);
      this.facing += angleDelta(this.facing, target) * Math.min(1, dt * 12);
    }
    if (this.firstPerson) this.facing = cam.yaw;

    // ---------- Atributos ----------
    const inWater = !!bodyNow && bodyNow.level > this.position.y + 0.3;
    this.stats.update(dt, {
      running: this.running && this.moving,
      swimming: this.swimming,
      swimFast: this.swimFast,
      moving: this.moving,
      headUnderwater: this.headUnderwater,
      ambientTemp: this.world.temperatureAt(this.position, inWater),
    });

    this._updateBiome(dt);
    this._updateModel(dt);
  }

  // Soco: gasta um pouco de stamina e acerta o que estiver na frente.
  // Atacar: com comida selecionada, come; senão bate (soco ou ferramenta).
  _updateAttack(dt, input, cam) {
    const C = BALANCE.combate;
    this._attackTimer -= dt;
    const actions = this.actions;
    if (input.wasPressed('attack') && this._attackTimer <= 0 && !this.swimming) {
      if (actions?.selectedIsConsumable) {
        actions.useSelected();
        this._attackTimer = 0.4;
      } else if (this.stats.useStamina(C.soco_stamina)) {
        const tool = actions?.tool ?? { tipo: 'mao', intervalo: C.soco_intervalo_seg };
        this._attackTimer = tool.intervalo;
        this._pendingHit = tool.tipo === 'mao' ? 0.14 : 0.22; // acerta no meio da animação
        this.model.swing();
        this.onPunch?.(tool.tipo);
      }
    }
    if (this._pendingHit >= 0) {
      this._pendingHit -= dt;
      if (this._pendingHit < 0) {
        if (actions) actions.onSwingHit(cam.forward);
        else this.world.creatures?.playerAttack(this, cam.forward, C.soco_dano, C.soco_alcance_m);
      }
    }
  }

  // Avisa quando o jogador entra num bioma novo (precisa ficar 1 s nele).
  _updateBiome(dt) {
    this._biomeTimer -= dt;
    if (this._biomeTimer > 0) return;
    this._biomeTimer = 0.5;
    const key = this.world.biomeKeyAt(this.position.x, this.position.z);
    if (key === 'mar' || key === 'lago') return; // água não conta
    if (key === this._biome) {
      this._biomeCandidate = null;
      return;
    }
    if (key !== this._biomeCandidate) {
      this._biomeCandidate = key;
      this._biomeSince = 0;
      return;
    }
    this._biomeSince += 0.5;
    if (this._biomeSince >= 1) {
      this._biome = key;
      const info = this.world.biomeInfo(key);
      events.emit(EV.BIOME_ENTERED, { key, name: info.nome, description: info.descricao });
    }
  }

  // ---------------------------------------------------------
  // Em terra
  // ---------------------------------------------------------
  _walk(dt, input, dirX, dirZ, mag, runRequest, waterDepth) {
    const M = BALANCE.movimento;
    const st = this.stats;
    const pos = this.position;
    const vel = this.velocity;

    // Correr cancela o agachar.
    if (runRequest && this.moving && this.crouching) this.crouching = false;
    this.running = runRequest && this.moving && !this.crouching && st.stamina > 0.5;
    this.swimFast = false;

    let speed = this.crouching ? M.agachado : this.running ? M.correr : M.andar;
    if (waterDepth > 0.5) speed *= M.na_agua_rasa;
    // carregando peso demais: anda devagar ou nem anda
    const wf = this.actions ? this.actions.weightFactor() : 1;
    speed *= wf;
    if (wf < 1) this.running = false;
    speed *= mag;

    const len = Math.hypot(dirX, dirZ);
    const tx = len > 0.001 ? (dirX / len) * speed : 0;
    const tz = len > 0.001 ? (dirZ / len) * speed : 0;
    const k = Math.min(1, (this.onGround ? 14 : 3) * dt);
    vel.x += (tx - vel.x) * k;
    vel.z += (tz - vel.z) * k;

    // Pulo (agachado: o botão de pular levanta primeiro)
    if (input.wasPressed('jump')) {
      if (this.crouching) {
        this.crouching = false;
      } else if (this.onGround && st.useStamina(BALANCE.stamina.gasto_pulo)) {
        vel.y = M.pulo;
        this.onGround = false;
      }
    }

    // Rampa íngreme: escorrega e não consegue subir.
    if (this.onGround) {
      const n = this.world.map.normalAt(pos.x, pos.z, this._normal);
      if (n.y < this._minNormalY) {
        vel.x += n.x * 18 * dt;
        vel.z += n.z * 18 * dt;
      }
    }

    vel.y -= M.gravidade * dt;

    // Movimento horizontal, tentando "deslizar" quando a subida é
    // íngreme demais (tenta x e z separados).
    this._moveHorizontal(vel.x * dt, vel.z * dt);

    // Movimento vertical e chão
    pos.y += vel.y * dt;
    const ground = this.world.heightAt(pos.x, pos.z);
    if (pos.y <= ground) {
      pos.y = ground;
      if (vel.y < 0) vel.y = 0;
      this.onGround = true;
    } else if (this.onGround && vel.y <= 0 && pos.y - ground < 0.5) {
      // Descendo uma rampa: continua grudado no chão.
      pos.y = ground;
      vel.y = 0;
    } else {
      this.onGround = false;
    }
  }

  _moveHorizontal(dx, dz) {
    const pos = this.position;
    if (this._canStep(pos.x + dx, pos.z + dz, dx, dz)) {
      pos.x += dx;
      pos.z += dz;
    } else if (this._canStep(pos.x + dx, pos.z, dx, 0)) {
      pos.x += dx;
    } else if (this._canStep(pos.x, pos.z + dz, 0, dz)) {
      pos.z += dz;
    } else {
      this.velocity.x *= 0.5;
      this.velocity.z *= 0.5;
    }
  }

  // Pode dar esse passo? (não sobe rampas mais íngremes que o limite)
  _canStep(nx, nz, dx, dz) {
    const horiz = Math.hypot(dx, dz);
    if (horiz < 1e-6) return true;
    const pos = this.position;
    const from = this.world.heightAt(pos.x, pos.z);
    const to = this.world.heightAt(nx, nz);
    const climb = to - Math.max(from, pos.y - 0.05);
    if (climb <= 0.02) return true;
    return climb / horiz <= this._maxSlopeTan;
  }

  // ---------------------------------------------------------
  // Na água
  // ---------------------------------------------------------
  _swim(dt, input, cam, mv, mag, runRequest, body) {
    const M = BALANCE.movimento;
    const st = this.stats;
    const pos = this.position;
    const vel = this.velocity;
    const tired = st.stamina <= 0.5;

    this.running = false;
    this.onGround = false;
    this.swimFast = runRequest && this.moving && !tired;

    let speed = (this.swimFast ? M.nadar_rapido : M.nadar) * mag;
    if (tired) speed *= 0.5;

    // Frente 3D da câmera: olhar para baixo e ir para frente = mergulhar.
    const cp = Math.cos(cam.pitch);
    const sp = Math.sin(cam.pitch);
    const sinY = Math.sin(cam.yaw);
    const cosY = Math.cos(cam.yaw);
    let tx = (-sinY * cp) * mv.y + cosY * mv.x;
    let ty = sp * mv.y;
    let tz = (-cosY * cp) * mv.y - sinY * mv.x;
    const len = Math.hypot(tx, ty, tz);
    if (len > 0.001) {
      tx = (tx / len) * speed;
      ty = (ty / len) * speed;
      tz = (tz / len) * speed;
    }

    // Botões: Pular = subir, Agachar = descer.
    const up = input.isHeld('jump');
    const down = input.isHeld('crouch');
    if (up) ty = M.nadar;
    if (down) ty = -M.nadar;

    const surfaceFeet = body.level - FLOAT_DEPTH;
    if (tired && !up) {
      // Sem stamina: afunda devagar (cuidado com o fôlego!).
      ty = Math.min(ty, -0.7);
    } else if (!up && !down && Math.abs(ty) < 0.3) {
      // Sem comando vertical: boia de volta para a superfície.
      ty = Math.max(-2, Math.min(1.5, (surfaceFeet - pos.y) * 2));
    }

    const k = Math.min(1, 4 * dt);
    vel.x += (tx - vel.x) * k;
    vel.y += (ty - vel.y) * k;
    vel.z += (tz - vel.z) * k;

    pos.x += vel.x * dt;
    pos.z += vel.z * dt;
    pos.y += vel.y * dt;

    // Não "voa" para fora da água nadando.
    if (pos.y > surfaceFeet + 0.05) {
      pos.y = surfaceFeet + 0.05;
      if (vel.y > 0) vel.y = 0;
    }
    // Não atravessa o fundo.
    const ground = this.world.heightAt(pos.x, pos.z);
    if (pos.y < ground) {
      pos.y = ground;
      if (vel.y < 0) vel.y = 0;
    }
  }

  // ---------------------------------------------------------
  _keepInsideWorld(dt) {
    this._boundsMsgTimer -= dt;
    const limit = BALANCE.mundo.limite_raio_m;
    const d = Math.hypot(this.position.x, this.position.z);
    if (d > limit) {
      this.position.x *= limit / d;
      this.position.z *= limit / d;
      if (this._boundsMsgTimer <= 0) {
        events.emit(EV.MESSAGE, { text: 'Mar aberto: não dá para nadar mais longe.', kind: 'warn' });
        this._boundsMsgTimer = 4;
      }
    }
  }

  _die(cause) {
    this.dead = true;
    this.running = false;
    this.velocity.set(0, 0, 0);
    // Na água, o saco de morte fica boiando na superfície.
    const bag = this.position.clone();
    if (this.waterBody) bag.y = Math.max(bag.y, this.waterBody.level - 0.3);
    events.emit(EV.PLAYER_DIED, { cause, position: bag });
  }

  respawn(point) {
    this.stats.resetForRespawn();
    this.dead = false;
    this.spawnAt(point);
    this._biome = null; // mostra o nome do bioma de novo
  }

  _updateModel(dt) {
    this.model.update(dt, {
      position: this.position,
      facing: this.facing,
      speed: Math.hypot(this.velocity.x, this.velocity.z),
      onGround: this.onGround,
      crouching: this.crouching,
      swimming: this.swimming,
      dead: this.dead,
      visible: !this.firstPerson || this.dead,
    });
  }

  // Para salvar/carregar (Fase 12) e para não perder o jogo
  // quando a página é atualizada.
  toJSON() {
    const p = this.position;
    return { x: p.x, y: p.y, z: p.z, facing: this.facing, stats: this.stats.toJSON() };
  }

  fromJSON(data) {
    if (!data) return;
    this.position.set(data.x, data.y, data.z);
    this.facing = data.facing ?? 0;
    this.stats.fromJSON(data.stats);
  }
}
