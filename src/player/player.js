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
    this.aliveTime = 0;             // segundos desde que nasceu/renasceu
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

  // altura dos olhos: desce/sobe devagar ao agachar (não "pula")
  get eyeHeight() {
    if (this.swimming) return EYE_STAND;
    return this._eye ?? (this.crouching ? EYE_CROUCH : EYE_STAND);
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
    this.aliveTime = (this.aliveTime ?? 0) + dt;
    if (this.riding) {
      this._ride(dt, input, cam);
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
      // agachar/levantar tem um tempinho (não dá para ficar "piscando")
      this._crouchCD = Math.max(0, (this._crouchCD ?? 0) - dt);
      const eyeTarget = this.crouching ? EYE_CROUCH : EYE_STAND;
      this._eye = (this._eye ?? eyeTarget) + (eyeTarget - (this._eye ?? eyeTarget)) * Math.min(1, dt * 8);
      if (input.wasPressed('crouch') && this._crouchCD <= 0) {
        this.crouching = !this.crouching;
        this._crouchCD = BALANCE.movimento.agachar_intervalo_seg;
      }
      this._walk(dt, input, dirX, dirZ, mag, runRequest, body ? depth : 0);
    }

    // ---------- Soco (Atacar) ----------
    this._updateAttack(dt, input, cam);

    // ---------- Colisões e limite do mapa ----------
    this.world.resolveCollisions(this.position, RADIUS, this.position.y, this.eyeHeight + 0.15);
    this.world.creatures?.resolvePlayer(this.position, RADIUS);
    this._keepInsideWorld(dt);
    // Depois de empurrado, não pode ficar dentro do chão.
    const ground = this.world.groundAt(this.position.x, this.position.z, this.position.y);
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
      ambientTemp: this.world.temperatureAt(this.position, inWater) + this.clothingWarmth(),
    });

    this._updateBiome(dt);
    this._updateModel(dt);
  }

  // Roupa quente: Casaco de Pele na mochila e as roupas de pele vestidas.
  clothingWarmth() {
    const inv = this.actions?.inv;
    if (!inv) return 0;
    // Fortitude só ajuda no frio
    const fort = this.world.temperatureAt(this.position, false) < 20 ? this.stats.fortitudeC : 0;
    return (inv.count('casaco_pele') > 0 ? BALANCE.temperatura.casaco_c : 0) + inv.warmth + fort;
  }

  // ---------------------------------------------------------
  // Montaria: o jogador vai sentado nas costas do bicho domado e
  // o joystick/WASD comanda ele. Atacar = o bicho morde/chifra.
  // ---------------------------------------------------------
  mount(c) {
    if (!c || c.rider) return false;
    this.riding = c;
    c.rider = this;
    c.target = null;
    c._setState('parado');
    this.crouching = false;
    this.swimming = false;
    events.emit(EV.MESSAGE, { text: `Montado em ${c.name ?? c.species.nome} (Montar de novo para descer)`, kind: 'info' });
    return true;
  }

  dismount() {
    const c = this.riding;
    if (!c) return;
    this.riding = null;
    c.rider = null;
    c.rideInput = null;
    c._setState('parado');
    c.idleFor = c.follow ? 0.5 : 1e9;
    if (!c.follow) c.home.set(c.pos.x, c.pos.z);
    // desce do lado do bicho
    const side = c.radius + 1.2;
    const x = c.pos.x + Math.cos(c.yaw) * side;
    const z = c.pos.z - Math.sin(c.yaw) * side;
    this.position.set(x, Math.max(this.world.heightAt(x, z), c.pos.y), z);
    this.velocity.set(0, 0, 0);
  }

  _ride(dt, input, cam) {
    const c = this.riding;
    if (!c.alive || c.knockedOut || !c.tamed) {
      this.dismount();
      return;
    }
    const mv = input.moveVector();
    const mag = Math.min(1, Math.hypot(mv.x, mv.y));
    const sinY = Math.sin(cam.yaw);
    const cosY = Math.cos(cam.yaw);
    let dx = -sinY * mv.y + cosY * mv.x;
    let dz = -cosY * mv.y - sinY * mv.x;
    const len = Math.hypot(dx, dz) || 1;
    dx /= len;
    dz /= len;
    this.moving = mag > 0.05;
    c.rideInput = { x: dx, z: dz, mag, run: input.isHeld('run') || input.runToggle };
    // sentado nas costas
    const seat = c.seat;
    // modelo olha para -z: z do assento vai para a frente/trás pelo yaw
    this.position.set(c.pos.x + Math.sin(c.yaw) * seat.z, c.pos.y + seat.y, c.pos.z + Math.cos(c.yaw) * seat.z);
    this.velocity.set(0, 0, 0);
    this.onGround = true;
    this.facing = this.firstPerson ? cam.yaw : c.yaw;
    // atacar montado: o bicho ataca o que estiver na frente dele
    this._attackTimer -= dt;
    if (input.wasPressed('attack') && this._attackTimer <= 0 && c.damage > 0) {
      this._attackTimer = this.world.creatures?.riderAttack(c, this) ?? 1;
    }
    const body = this.world.waterAt(this.position.x, this.position.z);
    this.headUnderwater = !!body && this.position.y + this.eyeHeight < body.level - 0.05;
    this.stats.update(dt, {
      running: false,
      swimming: false,
      moving: this.moving,
      headUnderwater: this.headUnderwater,
      ambientTemp: this.world.temperatureAt(this.position, false),
    });
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
      } else if (actions?.selectedPiece) {
        actions.placeBuild(cam.yaw);
        this._attackTimer = 0.3;
      } else if (actions?.tool.tipo === 'luneta') {
        // luneta: aproxima/afasta a vista
        this.zoom = !this.zoom;
        this._attackTimer = 0.3;
      } else if (actions?.tool.projetil) {
        // arco/pistola: atira na hora para onde a câmera olha
        const tool = actions.tool;
        if (actions.shootArrow(cam)) {
          this._attackTimer = tool.tipo === 'arco' ? BALANCE.arco.intervalo_seg : tool.intervalo;
          this.onPunch?.(tool.tipo);
        } else this._attackTimer = 0.4;
      } else if (this.stats.useStamina(C.soco_stamina)) {
        const tool = actions?.tool ?? { tipo: 'mao', intervalo: C.soco_intervalo_seg };
        this._attackTimer = tool.intervalo;
        this._pendingHit = tool.tipo === 'mao' ? 0.06 : 0.11; // acerta logo no início da animação
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

    let speed = (this.crouching ? M.agachado : this.running ? M.correr : M.andar) * st.speedMul;
    if (waterDepth > 0.5) speed *= M.na_agua_rasa;
    // carregando peso demais: anda devagar ou nem anda
    const wf = this.actions ? this.actions.weightFactor() : 1;
    speed *= wf;
    if (this.actions?.overloaded?.()) this.running = false;
    speed *= mag;

    const len = Math.hypot(dirX, dirZ);
    const tx = len > 0.001 ? (dirX / len) * speed : 0;
    const tz = len > 0.001 ? (dirZ / len) * speed : 0;
    const k = Math.min(1, (this.onGround ? 24 : 3) * dt);
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
    const ground = this.world.groundAt(pos.x, pos.z, pos.y);
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
    const from = this.world.groundAt(pos.x, pos.z, pos.y);
    const to = this.world.groundAt(nx, nz, pos.y);
    const climb = to - Math.max(from, pos.y - 0.05);
    if (climb <= 0.02) return true;
    // degrau de piso/rampa construído: sobe se for baixo
    if (to > this.world.heightAt(nx, nz) + 0.01) return climb <= 0.6;
    return climb / horiz <= this._maxSlopeTan;
  }

  // ---------------------------------------------------------
  // Na água
  // ---------------------------------------------------------
  _swim(dt, input, cam, mv, mag, runRequest, body) {
    // Física de nado (simples, mas com peso):
    //  - empuxo: quanto mais do corpo está embaixo d'água, mais ele boia;
    //  - arrasto: a água freia (mais forte quanto mais rápido);
    //  - braçadas: o empurrão vem em "pulsos", não é velocidade fixa;
    //  - ondas: a superfície sobe e desce e leva o corpo junto.
    const M = BALANCE.movimento;
    const W = BALANCE.agua;
    const st = this.stats;
    const pos = this.position;
    const vel = this.velocity;
    const tired = st.stamina <= 0.5;

    this.running = false;
    this.onGround = false;
    this.swimFast = runRequest && this.moving && !tired;
    this._strokeT = (this._strokeT ?? 0) + dt * (this.swimFast ? 2.4 : 1.6);

    // direção desejada (frente 3D da câmera: olhar para baixo = mergulhar)
    const cp = Math.cos(cam.pitch);
    const sp = Math.sin(cam.pitch);
    const sinY = Math.sin(cam.yaw);
    const cosY = Math.cos(cam.yaw);
    let dx = (-sinY * cp) * mv.y + cosY * mv.x;
    let dy = sp * mv.y;
    let dz = (-cosY * cp) * mv.y - sinY * mv.x;
    const dl = Math.hypot(dx, dy, dz);
    if (dl > 0.001) {
      dx /= dl;
      dy /= dl;
      dz /= dl;
    }
    const up = input.isHeld('jump');
    const down = input.isHeld('crouch');
    if (up) dy = 1;
    if (down) dy = -1;

    // braçada: força em pulsos
    const stroke = 0.55 + 0.45 * Math.max(0, Math.sin(this._strokeT * Math.PI * 2));
    let thrust = (this.swimFast ? W.forca_bracada_rapida : W.forca_bracada) * stroke * Math.max(mag, up || down ? 1 : 0);
    if (tired) thrust *= 0.45;
    vel.x += dx * thrust * dt;
    vel.z += dz * thrust * dt;
    vel.y += dy * thrust * dt;

    // empuxo e gravidade (com ondas na superfície)
    const wave = this.world.waveHeightAt(pos.x, pos.z);
    const surface = body.level + wave;
    const bodyH = 1.75;
    const submerged = Math.max(0, Math.min(1, (surface - pos.y) / bodyH));
    const buoy = M.gravidade * W.empuxo * submerged * (tired ? 0.82 : 1);
    vel.y += (buoy - M.gravidade) * dt;

    // arrasto da água (linear + quadrático)
    const sp3 = Math.hypot(vel.x, vel.y, vel.z);
    const drag = Math.min(0.95, (W.arrasto + W.arrasto_rapido * sp3) * dt);
    vel.x -= vel.x * drag;
    vel.y -= vel.y * drag * 1.15;
    vel.z -= vel.z * drag;
    // limite de velocidade nadando
    const vmax = (this.swimFast ? M.nadar_rapido : M.nadar) * 1.25;
    const hs = Math.hypot(vel.x, vel.z);
    if (hs > vmax) {
      vel.x *= vmax / hs;
      vel.z *= vmax / hs;
    }

    pos.x += vel.x * dt;
    pos.z += vel.z * dt;
    pos.y += vel.y * dt;

    // não "pula" para fora da água: a cabeça fica no máximo na superfície
    const topFeet = surface - FLOAT_DEPTH + 0.35;
    if (pos.y > topFeet) {
      pos.y = topFeet;
      if (vel.y > 0) vel.y *= 0.3;
    }
    // não atravessa o fundo
    const ground = this.world.heightAt(pos.x, pos.z);
    if (pos.y < ground) {
      pos.y = ground;
      if (vel.y < 0) vel.y = 0;
    }
  }

  // ---------------------------------------------------------
  _keepInsideWorld(dt) {
    this._boundsMsgTimer -= dt;
    const lim = this.world.map.half - 40;
    if (Math.abs(this.position.x) > lim || Math.abs(this.position.z) > lim) {
      this.position.x = Math.max(-lim, Math.min(lim, this.position.x));
      this.position.z = Math.max(-lim, Math.min(lim, this.position.z));
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
    this.aliveTime = 0;
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
