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
import { ClipPlayer } from './clip_player.js';
import { PASSOS } from './gait_profiles.js';
import { PASSO_CAL } from './passo_cal.js';
import { aplicarTraco } from './tracos.js';
import { angleDelta, clamp } from '../core/math.js';
import { BALANCE } from '../core/balance.js';
import { sound } from '../audio/audio.js';
import { mulberry32 } from '../core/math.js';
import { shakeAt } from '../world/materials.js';
import { aplicarFeridas } from './wounds.js';
import { ajustarSela, backSpot, buildSaddle, saddleFor } from './saddle.js';
import { events, EV } from '../core/event_bus.js';

// O que cada herbívoro come (tipos de vegetação). Bicho alto (pescoço
// comprido) come folha de árvore; os outros, arbustos e plantas baixas.
const FOOD_LOW = new Set(['arbusto', 'arbusto_mejo', 'arbusto_escura', 'arbusto_frutas', 'samambaia', 'samambaia_gigante',
  'bananeira', 'bananeira_vazia', 'junco', 'taboa', 'arbusto_neve', 'planta_praia', 'capim']);
// Jeito de andar tirado de animações de verdade (gait_profiles.js):
// baixo = Sauropelta (quadrúpede de perna curta), alto = Argentinossauro
// (perna reta de coluna). Quem não está aqui anda com a curva simples.
const GAIT_OF = {
  anquilossauro: 'baixo', estegossauro: 'baixo', triceratops: 'baixo', parassauro: 'baixo',
  sauropelta: 'baixo', braquiossauro: 'alto', mamute: 'alto', argentinossauro: 'alto',
  // modelos novos (quadrúpedes)
  moschops: 'baixo', paquirrinossauro: 'baixo', kentrossauro: 'baixo', diplodoco: 'alto',
};
// valor da curva (n pontos por passo) na fase p (0..1), com interpolação
function gaitAt(c, p) {
  const n = c.length;
  const f = (((p % 1) + 1) % 1) * n;
  const i = Math.floor(f);
  return c[i] + (c[(i + 1) % n] - c[i]) * (f - i);
}

// ---------------------------------------------------------
// PERNAS COM CINEMÁTICA INVERSA (pé preso no chão)
// Cada perna é coxa -> joelho -> pé. Em vez de balançar a coxa por uma curva, o jogo diz ONDE o pé
// tem que estar (no chão, parado, enquanto o corpo passa; depois no ar até o próximo apoio) e
// calcula o giro da coxa e do joelho para chegar lá. As rotações são em torno de X, então a conta
// é no plano (y, z) da perna: ângulo medido de +y para +z (girar em X soma o ângulo).
// ---------------------------------------------------------
const wrapPi = (a) => Math.atan2(Math.sin(a), Math.cos(a));
function solvePerna(u1, u2, T, prev) {
  const a = Math.hypot(u1[0], u1[1]);
  const b = Math.hypot(u2[0], u2[1]);
  const d = clamp(Math.hypot(T[0], T[1]), Math.abs(a - b) + 0.002, a + b - 0.002);
  const b0 = Math.acos(clamp((d * d - a * a - b * b) / (2 * a * b), -1, 1));
  const phi1 = Math.atan2(u1[1], u1[0]);
  const phi2 = Math.atan2(u2[1], u2[0]);
  const aimT = Math.atan2(T[1], T[0]);
  let best = null;
  for (const sg of [1, -1]) {
    const beta = sg * b0;
    const A1 = aimT - Math.atan2(b * Math.sin(beta), a + b * Math.cos(beta));
    const t1 = wrapPi(A1 - phi1);
    const t2 = wrapPi(beta - (phi2 - phi1));
    const cost = Math.abs(t2 - prev[1]) + Math.abs(t1 - prev[0]) * 0.5; // fica no mesmo dobrado (não vira o joelho)
    if (!best || cost < best.cost) best = { t1, t2, cost };
  }
  return best;
}
const easeSwing = (w) => w * w * (3 - 2 * w);

const FOOD_HIGH = new Set(['arvore_agar', 'arvore_dossel', 'arvore_media', 'acai', 'sumauma', 'pinheiro_neve', 'pinheiro', 'arvore_folhosa', 'arvore_folhosa2']);

export const CSTATE = {
  WANDER: 'vagar',
  IDLE: 'parado',
  EAT: 'comer',
  FLEE: 'fugir',
  CHASE: 'perseguir',
  ATTACK: 'atacar',
  RETURN: 'voltar',
  DEAD: 'morto',
  KO: 'desmaiado',   // torpor no máximo: dá para domar
  FOLLOW: 'seguir',  // domado indo atrás do dono
};

const TAU = Math.PI * 2;
let nextId = 1;

// Opções do menu do bicho domado
export const FOLLOW_DIST = { curto: 0.5, medio: 1, longo: 2.2 };   // x distância de seguir
export const TARGET_RANGE = { curto: 12, medio: 25, longo: 45 }; // m (agressivo)

// Curvas do bote (at = 0..1 do começo ao fim do ataque). Recuo para pegar impulso (0..0.2),
// golpe rápido acelerando (0.2..0.38, é aqui que o dano acontece) e volta macia (0.38..1).
const easeOut3 = (u) => 1 - (1 - u) ** 3;
const easeIn3 = (u) => u * u * u;
const easeInOut = (u) => (u < 0.5 ? 2 * u * u : 1 - 2 * (1 - u) * (1 - u));
const smooth = (u) => u * u * (3 - 2 * u);
function atkLunge(at) { // positivo = recuo, negativo = para a frente
  if (at < 0.2) return 0.25 * easeOut3(at / 0.2);
  if (at < 0.45) return 0.25 - 0.95 * smooth((at - 0.2) / 0.25);
  return -0.7 * (1 - easeInOut((at - 0.45) / 0.55));
}
function atkJaw(at) { // 0 fechada .. 1 aberta: abre no recuo e fecha de estalo no golpe
  if (at < 0.2) return easeOut3(at / 0.2);
  if (at < 0.33) return 1;
  if (at < 0.46) return 1 - smooth((at - 0.33) / 0.13);
  return 0;
}

export class Creature {
  constructor({ species, spec, mesh, bones, level, x, z, world, manager, rand }) {
    this.id = nextId++;
    this.species = species;
    this.spec = spec;
    this.mesh = mesh;
    this.clipPlayer = mesh.userData.clipes ? new ClipPlayer(mesh.userData.clipes, bones) : null;
    this.bones = bones;
    this.world = world;
    this.manager = manager;
    this.rand = rand;
    this.level = level;

    this.rollStats(Math.floor(rand() * 1e9));
    // Tamanho: com comprimento_m (tamanho real, em metros) cada bicho
    // sorteia o seu comprimento; senão usa o "tamanho" antigo.
    const bb0 = mesh.geometry.boundingBox ?? (mesh.geometry.computeBoundingBox(), mesh.geometry.boundingBox);
    const len0 = bb0.max.z - bb0.min.z;
    const wid0 = bb0.max.x - bb0.min.x;
    if (species.envergadura_m && wid0 > 0) {
      const [a, b] = species.envergadura_m;
      this.adultScale = (a + (b - a) * rand()) / wid0;
    } else if (species.comprimento_m && len0 > 0) {
      const [a, b] = species.comprimento_m;
      this.adultScale = (a + (b - a) * rand()) / len0;
    } else {
      this.adultScale = (species.tamanho ?? 1) * (0.92 + Math.min(level, 30) * 0.006 + rand() * 0.06);
    }
    // Ciclo de vida: filhote cresce (growth 0.3 → 1), adulto envelhece e
    // um dia morre de velhice. Bicho selvagem já nasce com alguma idade.
    const C = BALANCE.criaturas;
    this.growth = 1;
    this.lifespan = 60 * (C.vida_media_min[0] + rand() * (C.vida_media_min[1] - C.vida_media_min[0]));
    this.age = rand() * 0.6 * this.lifespan;
    this.nextBreed = C.intervalo_cria_min[0] * 60 * rand();
    this.scale = this.adultScale;

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
    this._lunge = 0;
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
    this.legsDown = Math.max(0.3, -geo.boundingBox.min.y);
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

  // Sorteia os atributos entre o mínimo e o máximo da espécie
  // (criaturas.json → atributos) e soma o bônus do nível.
  // A semente vai pela rede no co-op, então todos veem os mesmos números.
  rollStats(seed) {
    const sp = this.species;
    const L = this.level - 1;
    const r = mulberry32(seed >>> 0);
    const at = sp.atributos ?? {};
    const pick = (k, def) => {
      const [a, b] = at[k] ?? def;
      return a + (b - a) * r();
    };
    this.statSeed = seed >>> 0;
    this.sex = r() < 0.5 ? 'Macho' : 'Fêmea';
    const vida = pick('vida', [sp.vida, sp.vida]);
    const forca = pick('forca', [100, 100]);
    const inc = sp.ark_por_nivel;
    if (inc) {
      // Como no ARK: cada nível acima do 1 é um ponto sorteado entre vida,
      // stamina, oxigênio, comida, peso, dano e velocidade. Cada ponto soma
      // uma fração do valor do nível 1 (oxigênio, comida e velocidade não
      // mudam nada aqui). O torpor sobe com todos os níveis.
      const pts = { vida: 0, stamina: 0, oxigenio: 0, comida: 0, peso: 0, forca: 0, velocidade: 0 };
      const keys = Object.keys(pts);
      for (let i = 0; i < L; i++) pts[keys[Math.floor(r() * keys.length)]]++;
      this.levelPoints = pts;
      this.stats = {
        vida: Math.round(vida * (1 + inc.vida * pts.vida)),
        forca: Math.round(forca * (1 + inc.forca * pts.forca)),
        peso: Math.round(pick('peso', [sp.carga ?? 20, sp.carga ?? 20]) * (1 + inc.peso * pts.peso)),
        stamina: Math.round(pick('stamina', [100, 100]) * (1 + inc.stamina * pts.stamina)),
        velocidade: Math.round(pick('velocidade', [100, 100])),
        torpor: Math.round(pick('torpor', [100, 100]) * (1 + inc.torpor * L)),
      };
      this._deriveStats();
      return;
    }
    this.stats = {
      vida: Math.round(vida * (1 + 0.06 * L)),
      forca: Math.round(forca * (1 + 0.03 * L)),
      peso: Math.round(pick('peso', [sp.carga ?? 20, sp.carga ?? 20]) * (1 + 0.02 * L)),
      stamina: Math.round(pick('stamina', [100, 100]) * (1 + 0.04 * L)),
      velocidade: Math.round(pick('velocidade', [100, 100])),
      torpor: Math.round(pick('torpor', [100, 100]) * (1 + 0.06 * L)),
    };
    this._deriveStats();
  }

  // Atributos herdados dos pais (criação): troca os sorteados.
  applyStats(st) {
    this.stats = { ...this.stats, ...st };
    this.inherited = true;
    this._deriveStats();
  }

  // Vida, dano e velocidade a partir dos atributos (+ bônus da impressão).
  _deriveStats() {
    const ratio = this.maxHealth ? this.health / this.maxHealth : 1;
    const imp = 1 + (this.imprint ?? 0) * BALANCE.cria.bonus_impressao;
    this.maxHealth = Math.round(this.stats.vida * imp * (0.25 + 0.75 * (this.growth ?? 1)));
    this.health = Math.max(1, Math.round(this.maxHealth * ratio));
    this.baseDamage = this.species.dano * this.stats.forca / 100 * imp;
    this.damage = this.baseDamage * (this.growth ?? 1);
    this.speedMul = this.stats.velocidade / 100;
    this.stamina = this.stats.stamina;
    this.torpor = 0;
    this.tired = false;
  }

  // Onde o jogador senta (altura e quanto para a frente/trás, em metros).
  get seat() {
    const sp = backSpot(this);
    return { y: (sp.y + (this.saddled ? (this._seatLift ?? 0.15 / this.adultScale) : 0)) * this.scale, z: sp.z * this.scale };
  }

  // Sela que serve neste bicho (pelo porte).
  get saddleNeed() {
    return saddleFor(this);
  }

  // Sela nas costas (kind = 'sela', 'sela_media', 'sela_grande' ou null).
  setSaddle(kind) {
    if (this._saddleMesh) this._saddleMesh.parent?.remove(this._saddleMesh);
    this._saddleMesh = null;
    for (const o of this._sadExtras ?? []) o.parent?.remove(o); // cordas e cabresto
    this._sadExtras = [];
    this._sadAnchor = null;
    this.saddled = !!kind;
    this.saddleKind = kind || null;
    const embutida = this.mesh.userData.selaIdx;
    if (embutida !== undefined) {
      // a sela já faz parte do modelo: só liga ou desliga (não põe a sela genérica por cima)
      this.mesh.material[embutida].visible = !!kind;
    } else if (kind) {
      this.mesh.updateMatrixWorld(true);
      this._saddleMesh = buildSaddle(this, kind);
    }
  }

  // Filhote domado: carinho/comida aumenta a impressão (fica mais forte).
  care() {
    if (!this.wantsCare) return false;
    this.wantsCare = false;
    this.careT = BALANCE.cria.cuidado_min * 60;
    this.imprint = Math.min(1, (this.imprint ?? 0) + BALANCE.cria.impressao_por_cuidado);
    this._deriveStats();
    return true;
  }

  // Filhote: tamanho, força e vida crescem junto (0.3 = recém-nascido, 1 = adulto)
  setGrowth(g) {
    const ratio = this.health / this.maxHealth;
    this.growth = clamp(g, 0.2, 1);
    this.scale = this.adultScale * this.growth;
    this.mesh.scale.setScalar(this.scale);
    const imp = 1 + (this.imprint ?? 0) * BALANCE.cria.bonus_impressao;
    this.maxHealth = Math.max(1, Math.round(this.stats.vida * imp * (0.25 + 0.75 * this.growth)));
    this.health = Math.max(1, this.maxHealth * ratio);
    this.damage = this.baseDamage * this.growth;
  }

  get isBaby() {
    return this.growth < 1;
  }

  get walkSpeed() {
    if (this.landed && this.species.vel_chao) return this.species.vel_chao[0] * this.speedMul;
    return this.species.vel_andar * this.speedMul;
  }

  // correndo gasta stamina; sem stamina só anda até recuperar
  get runSpeed() {
    if (this.tired) {
      // carnívoro cansado ainda é mais rápido que você andando (corra!)
      const hunter = this.species.dieta === 'carnivoro' && !this.flies && !this.aquatic && this.radius > 0.4;
      return Math.max(this.walkSpeed * 1.2, hunter ? BALANCE.movimento.andar * BALANCE.criaturas.carnivoro_cansado : 0);
    }
    if (this.landed && this.species.vel_chao) return this.species.vel_chao[1] * this.speedMul;
    return this.species.vel_correr * this.speedMul;
  }

  get alive() {
    return this.state !== CSTATE.DEAD;
  }

  get knockedOut() {
    return this.state === CSTATE.KO;
  }

  // ---------------------------------------------------------
  // Domar
  // ---------------------------------------------------------
  // Quantas comidas preferidas precisa para domar.
  get tameNeed() {
    const D = BALANCE.domar;
    return Math.max(1, Math.round(D.comidas_base + D.comidas_por_nivel * (this.level - 1)));
  }

  addTorpor(amount, by) {
    if (!this.alive || this.tamed || amount <= 0) return;
    this.torpor = Math.min(this.stats.torpor, this.torpor + amount);
    if (this.torpor >= this.stats.torpor && this.state !== CSTATE.KO) this._knockOut(by);
  }

  _knockOut(by) {
    this._setState(CSTATE.KO);
    this.target = null;
    this.threat = null;
    this.speed = 0;
    this.tamer = by;
    this.tameProgress = this.tameProgress ?? 0;
    this.tameEff = this.tameEff ?? 1; // efetividade: cai se apanhar desmaiado
    this.tameFood = this.tameFood ?? {};
    this._eatT = 1;
    sound.creature(this, 'dor');
    this.manager.onKnockOut?.(this, by);
  }

  // Coloca comida no "prato" do bicho desmaiado (ele come aos poucos).
  feed(id, qty) {
    this.tameFood[id] = (this.tameFood[id] ?? 0) + qty;
  }

  foodValue(id) {
    if (id === this.species.comida_preferida) return 1;
    return BALANCE.domar.comida_qualquer;
  }

  _updateKO(dt) {
    const D = BALANCE.domar;
    this.speed = 0;
    this.torpor -= this.stats.torpor * D.desmaio_cai_seg * dt;
    // come uma comida do prato de tempos em tempos
    this._eatT -= dt;
    if (this._eatT <= 0) {
      this._eatT = D.comer_a_cada_seg;
      const id = Object.keys(this.tameFood).find((k) => this.tameFood[k] > 0);
      if (id) {
        this.tameFood[id] -= 1;
        this.tameProgress = Math.min(1, this.tameProgress + this.foodValue(id) / this.tameNeed);
        sound.play('comer', this.pos);
        if (this.tameProgress >= 1) {
          this._tame(this.tamer);
          return;
        }
      }
    }
    if (this.torpor <= 0) {
      // acordou antes de domar: perde metade do progresso e fica bravo
      this.torpor = 0;
      this.tameProgress *= 0.5;
      this._setState(CSTATE.WANDER);
      const t = this.tamer;
      if (t && !t.dead && (this.species.temperamento === 'agressivo' || this.species.revida)) this._chase(t);
      else if (t) this._flee(t);
      this.manager.onWake?.(this);
    }
  }

  _tame(owner) {
    // bônus de níveis pela efetividade (como no ARK: até +50%)
    const bonus = Math.floor(this.level * BALANCE.domar.bonus_niveis * (this.tameEff ?? 1));
    if (bonus > 0) {
      this.level += bonus;
      this.rollStats(this.statSeed);
    }
    this.tameBonus = bonus;
    this.tamed = true;
    this.owner = owner;
    this.follow = true;
    this.torpor = 0;
    this.tameFood = {};
    this.home.set(this.pos.x, this.pos.z);
    this._setState(CSTATE.IDLE);
    this.idleFor = 2;
    this.name = this.species.nome;
    sound.creature(this, 'chamado');
    this.manager.onTamed?.(this, owner);
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
    this.attackAnim = Math.max(0, this.attackAnim - dt * 1.7);
    this.hurtAnim = Math.max(0, this.hurtAnim - dt * 3);
    const prevYaw = this.yaw;

    if (this.state === CSTATE.DEAD) {
      this.deadTime += dt;
      this.speed = 0;
      this._animate(dt, ctx, 0);
      this._sync(dt);
      return;
    }
    // desmaiado: deita e come o que tiver no prato
    this.koAnim = clamp((this.koAnim ?? 0) + (this.state === CSTATE.KO ? dt * 1.5 : -dt * 1.2), 0, 1);
    if (this.state === CSTATE.KO) {
      this._updateKO(dt);
      this._animate(dt, ctx, 0);
      this._sync(dt);
      return;
    }
    if (this.torpor > 0) this.torpor = Math.max(0, this.torpor - this.stats.torpor * BALANCE.domar.torpor_cai_seg * dt);

    // de vez em quando, um chamado à toa
    if (this.rand() < dt * 0.025) sound.creature(this, this.state === CSTATE.CHASE ? 'rugido' : 'chamado');

    // idade: filhote cresce; velho morre (não vale para o convidado no co-op)
    if (!this.netControlled && !this.species.ambiente) {
      this.age += this.tamed && this.growth >= 1 ? dt * 0.25 : dt; // domado adulto vive bem mais
      if (this.growth < 1) {
        const g = Math.min(1, 0.3 + 0.7 * this.age / (BALANCE.criaturas.crescer_min * 60));
        if (g - this.growth > 0.01 || g === 1) this.setGrowth(g);
        // filhote domado pede carinho de tempos em tempos (impressão)
        if (this.tamed && !this.wantsCare) {
          this.careT = (this.careT ?? BALANCE.cria.cuidado_min * 60) - dt;
          if (this.careT <= 0) {
            this.wantsCare = true;
            events.emit(EV.MESSAGE, { text: `Filhote de ${this.species.nome} quer carinho! (Interagir nele)`, kind: 'info' });
          }
        }
      }
      if (this.age > this.lifespan) {
        this.health = 0;
        this._setState(CSTATE.DEAD);
        sound.creature(this, 'morte');
        this.oldAge = true;
        this.manager.onDeath(this, null);
        return;
      }
    }

    // gestação (mamífero domado): o filhote nasce quando acaba
    if (this.gestation > 0 && !this.netControlled) {
      this.gestation -= dt;
      if (this.gestation <= 0) this.manager.birth?.(this);
    }

    // stamina: correr cansa; cansado só anda até recuperar 40%
    if (this.stats && !this.netControlled) {
      const max = this.stats.stamina;
      if (this.speed > this.walkSpeed * 1.5) this.stamina = Math.max(0, this.stamina - max / BALANCE.criaturas.corrida_seg * dt);
      else this.stamina = Math.min(max, this.stamina + max / BALANCE.criaturas.recupera_seg * dt);
      if (this.stamina <= 0) this.tired = true;
      else if (this.tired && this.stamina > max * 0.4) this.tired = false;
    }

    this.thinkTimer -= dt;
    if (this.thinkTimer <= 0) {
      this.thinkTimer = 0.25;
      this._think(ctx);
    }

    if (this.landed && !this.rider) this._updateLanded(dt);
    if (this.rider) this._updateRidden(dt);
    else if (this.flies && !this.landed) this._updateFlying(dt, ctx);
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
    if (this.tamed) {
      this._thinkTamed();
      return;
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
    // carnívoro com fome: carcaça perto? vai comer
    if (sp.dieta === 'carnivoro' && hungry && !sp.ambiente && !this.flies && this.state === CSTATE.WANDER && !this.carcass
      && this.rand() < 0.02) {
      const c = this.manager.nearestCarcass(this.pos, 40);
      if (c) {
        this.carcass = c;
        this.goal = new THREE.Vector2(c.pos.x, c.pos.z);
      }
    }
    if (this.carcass) {
      const c = this.carcass;
      if (this.state !== CSTATE.WANDER || !c.lootLeft) {
        this.carcass = null;
      } else if (this._dist2D(c.pos) < c.radius + this.bodyFront * this.scale + 0.8) {
        // come um pedaço: carcaça perde carne, bicho fica saciado
        this.carcass = null;
        this._setState(CSTATE.EAT);
        this.eatRec = { x: c.pos.x, z: c.pos.z, type: 'carcaca', alive: true };
        this.idleFor = BALANCE.brigas.comendo_seg;
        this.fedUntil = this.time + BALANCE.brigas.saciado_seg;
        for (const id of Object.keys(c.lootLeft)) if (/carne/.test(id)) c.lootLeft[id] = Math.max(0, Math.floor(c.lootLeft[id] * 0.6));
        return;
      } else {
        this.goal = new THREE.Vector2(c.pos.x, c.pos.z);
      }
    }
    if (temp === 'agressivo' && sp.dieta === 'carnivoro' && hungry && !sp.ambiente && (this.state === CSTATE.WANDER || this.state === CSTATE.IDLE)
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

  // Domado: defende o dono e vai atrás dele (se mandado seguir).
  _thinkTamed() {
    if (this.rider) return;
    const o = this.owner;
    if (this.state === CSTATE.CHASE || this.state === CSTATE.ATTACK) {
      const t = this.target;
      const far = t && this._dist2D(t.position) > 45;
      const leftOwner = this.follow && o && this._dist2D(o.position) > 60;
      if (!t || t.alive === false || t.dead || far || leftOwner || this.blockedTime > 5 || t === o) {
        this.target = null;
        this._setState(CSTATE.IDLE);
        this.idleFor = 1;
      }
      return;
    }
    if (this.state === CSTATE.FLEE) this._setState(CSTATE.IDLE);
    // Agressivo: ataca bicho selvagem que chegar no alcance de alvo
    if (this.aggression === 'agressivo' && this.damage > 0) {
      this._scanT = (this._scanT ?? 0) - 1;
      if (this._scanT <= 0) {
        this._scanT = 30;
        const range = TARGET_RANGE[this.targetRange ?? 'medio'];
        const prey = this.manager.list.find((c) => c !== this && c.alive && !c.tamed && !c.knockedOut && !c.species.ambiente
          && this._dist2D(c.pos) < range);
        if (prey) {
          this._chase(prey);
          return;
        }
      }
    }
    if (!this.follow || !o || o.dead) {
      if (this.state === CSTATE.FOLLOW) this._setState(CSTATE.IDLE);
      // Vagar: passeia perto de onde foi deixado
      if (this.wander) {
        if (this.state === CSTATE.IDLE && this.idleFor > 1e8) this.idleFor = 4 + this.rand() * 8;
        if (this.state === CSTATE.WANDER && this.home.distanceTo(new THREE.Vector2(this.pos.x, this.pos.z)) > 20) {
          this.goal = new THREE.Vector2(this.home.x + (this.rand() - 0.5) * 16, this.home.y + (this.rand() - 0.5) * 16);
        }
      } else if (this.state === CSTATE.WANDER) {
        this._setState(CSTATE.IDLE);
        this.idleFor = 1e9;
      }
      return;
    }
    const d = this._dist2D(o.position);
    const near = BALANCE.domar.seguir_m * (FOLLOW_DIST[this.followDist ?? 'medio'] ?? 1) + this.radius;
    if (d > near + 2 && this.state !== CSTATE.FOLLOW) this._setState(CSTATE.FOLLOW);
    else if (d <= near && this.state === CSTATE.FOLLOW) {
      this._setState(CSTATE.IDLE);
      this.idleFor = 1e9;
    }
  }

  // Montado: quem anda é o jogador (rideInput vem do Player).
  _updateRidden(dt) {
    const inp = this.rideInput ?? { x: 0, z: 0, mag: 0, run: false };
    // voadores: no ar o jogador pilota (pular sobe, agachar desce); no chão anda como bicho de terra
    if (this.flies) {
      if (this.landed && inp.up) this._takeOff();
      if (!this.landed) {
        this._updateRiddenFlying(dt, inp);
        return;
      }
    }
    if (inp.mag > 0.05) {
      const speed = (inp.run ? this.runSpeed : this.walkSpeed * 1.4) * inp.mag;
      this._steer(dt, this.pos.x + inp.x * 20, this.pos.z + inp.z * 20, speed);
    } else {
      this._brake(dt);
    }
    const g = this._groundY(this.pos.x, this.pos.z);
    this.pos.y += (g - this.pos.y) * Math.min(1, dt * 10);
  }

  // Voando com o jogador nas costas.
  _updateRiddenFlying(dt, inp) {
    const prevYaw = this.yaw;
    const ground = Math.max(0, this.world.heightAt(this.pos.x, this.pos.z));
    const speed = inp.run ? this.runSpeed : this.walkSpeed;
    if (inp.mag > 0.05) this._steer(dt, this.pos.x + inp.x * 30, this.pos.z + inp.z * 30, speed * Math.max(0.45, inp.mag), true);
    else this._brake(dt);
    const vy = inp.up ? 9 : inp.down ? -9 : 0;
    this.climb += (vy - this.climb) * Math.min(1, dt * 3);
    this.pos.y = Math.min(ground + 160, this.pos.y + this.climb * dt);
    const stand = ground + this.standHeight;
    if (this.pos.y < ground + 1.2) this.pos.y = ground + 1.2;
    // desceu até o chão: pousa (e anda no chão)
    if (inp.down && this.pos.y - stand < 0.8 && this.species.pousa) {
      this._land();
      return;
    }
    const turning = angleDelta(prevYaw, this.yaw) / Math.max(dt, 1e-3);
    this.roll += (clamp(-turning * 0.6, -0.7, 0.7) - this.roll) * Math.min(1, dt * 2);
    this.pitch += (clamp(this.climb * 0.07, -0.45, 0.35) - this.pitch) * Math.min(1, dt * 2);
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

  // Planta para comer perto (sorteia entre as mais perto, para não irem
  // todos na mesma).
  _findFood(radius, kinds = this.height > 6 ? FOOD_HIGH : FOOD_LOW) {
    const veg = this.world.vegetation;
    if (!veg) return null;
    let best = null;
    let bestScore = Infinity;
    veg.byHash.forEachNear(this.pos.x, this.pos.z, radius, (rec) => {
      if (!rec.alive || !kinds.has(rec.type)) return;
      const d = Math.hypot(rec.x - this.pos.x, rec.z - this.pos.z);
      if (d > radius || d < 1.5) return;
      if (this.world.waterAt(rec.x, rec.z) && !this.swims) return;
      const score = d * (0.6 + this.rand());
      if (score < bestScore) {
        bestScore = score;
        best = rec;
      }
    });
    // bicho alto que não achou árvore come plantas baixas
    if (!best && kinds === FOOD_HIGH) best = this._findFood(radius, FOOD_LOW);
    return best;
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
        // filhote anda atrás da mãe
        const mom = this.mother;
        if (this.isBaby && mom?.alive && this._dist2D(mom.pos) > 5 + mom.radius) {
          this.goal = new THREE.Vector2(mom.pos.x + (this.rand() - 0.5) * 3, mom.pos.z + (this.rand() - 0.5) * 3);
        }
        const herb = sp.dieta === 'herbivoro' && !this.aquatic && !this.flies;
        if (!this.goal || this.stateTime > 25) {
          // herbívoro: muitas vezes vai até uma planta para comer
          this.food = herb && !this.isBaby && this.rand() < 0.6 ? this._findFood(sp.raio > 2 ? 45 : 28) : null;
          if (this.food) {
            const f = this.food;
            const dx = this.pos.x - f.x;
            const dz = this.pos.z - f.z;
            const l = Math.hypot(dx, dz) || 1;
            // para com a boca na planta
            const reach = this.bodyFront * this.scale * 0.85 + 0.6;
            this.goal = new THREE.Vector2(f.x + (dx / l) * reach, f.z + (dz / l) * reach);
          } else {
            this.goal = this._pickWanderPoint(sp.raio > 2 ? 60 : 32);
          }
        }
        if (!this.goal || this._steer(dt, this.goal.x, this.goal.y, this.walkSpeed) || (this.food && this._dist2DXY(this.goal.x, this.goal.y) < 1.2)) {
          const food = this.food?.alive ? this.food : null;
          this._setState(herb && (food || this.rand() < 0.4) ? CSTATE.EAT : CSTATE.IDLE);
          this.eatRec = food;
          this.idleFor = food ? 8 + this.rand() * 8 : 5 + this.rand() * 10;
          this.food = null;
        }
        break;
      }
      case CSTATE.IDLE:
      case CSTATE.EAT:
        this._brake(dt);
        if (this.state === CSTATE.EAT && this.eatRec) {
          // vira para a planta e arranca pedaços (a planta balança)
          const r = this.eatRec;
          this.yaw += clamp(angleDelta(this.yaw, Math.atan2(-(r.x - this.pos.x), -(r.z - this.pos.z))), -dt * 1.5, dt * 1.5);
          this._chewT = (this._chewT ?? 0) - dt;
          if (this._chewT <= 0) {
            this._chewT = 1.3 + this.rand() * 0.6;
            shakeAt(r.x, r.z, 0.7);
            sound.play('comer', this.pos, { volume: 0.5 });
          }
        }
        if (this.stateTime > (this.idleFor ?? 4)) {
          this.eatRec = null;
          this._setState(CSTATE.WANDER);
        }
        break;
      case CSTATE.FOLLOW: {
        const o = this.owner;
        if (!o) break;
        const d = this._dist2D(o.position);
        this._steer(dt, o.position.x, o.position.z, d > 14 ? this.runSpeed : this.walkSpeed * 1.5);
        break;
      }
      case CSTATE.RETURN:
        if (this._steer(dt, this.home.x, this.home.y, this.walkSpeed * 1.3) || this._dist2DXY(this.home.x, this.home.y) < 10) {
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
        this._steer(dt, this.goal.x, this.goal.y, this.runSpeed);
        break;
      }
      case CSTATE.CHASE: {
        const t = this.target;
        if (!t) break;
        if (this._dist2D(t.position) < this._reach(t)) {
          this._setState(CSTATE.ATTACK);
          break;
        }
        this._steer(dt, t.position.x, t.position.z, this.runSpeed);
        // peça construída no caminho: morde até quebrar (se tiver força)
        const bp = this._blockPiece;
        if (bp && !bp.removed && this.blockedTime > 0.4 && this.attackCooldown <= 0) {
          this.attackCooldown = sp.intervalo_ataque ?? 1.2;
          this.attackAnim = 1;
          sound.creature(this, 'ataque');
          if (!bp.damage(this.damage * BALANCE.construcao.dano_bicho_mult, this)) this._noBreak = (this._noBreak ?? 0) + 1;
        }
        break;
      }
      case CSTATE.ATTACK: {
        const t = this.target;
        if (!t) break;
        this._brake(dt);
        this._face(dt, t.position.x, t.position.z);
        // no golpe o corpo dá um passo à frente (e volta a ficar parado): o bote ganha peso
        const atp = 1 - this.attackAnim;
        if (this.attackAnim > 0 && atp > 0.2 && atp < 0.45) {
          const gap = this._dist2D(t.position) - this.radius * 0.9;
          if (gap > 0) {
            const step = Math.min(gap, this.radius * 2.2 * dt);
            this.pos.x -= Math.sin(this.yaw) * step;
            this.pos.z -= Math.cos(this.yaw) * step;
          }
        }
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

    let g = this._groundY(this.pos.x, this.pos.z);

    // Inclina o corpo acompanhando o terreno. Mede o chão na frente e atrás
    // (pelo comprimento do corpo) e deixa as pontas tocarem o chão: em cima
    // de morro o bicho desce em vez de ficar flutuando com o corpo empinado.
    if (this.spec.body !== 'biped' && !this.aquatic) {
      const len = Math.max(1.6, this.radius * 2.8);
      const fx = -Math.sin(this.yaw);
      const fz = -Math.cos(this.yaw);
      const hf = this.world.heightAt(this.pos.x + fx * len * 0.5, this.pos.z + fz * len * 0.5);
      const hb = this.world.heightAt(this.pos.x - fx * len * 0.5, this.pos.z - fz * len * 0.5);
      const inWater = this.swims && this.world.waterAt(this.pos.x, this.pos.z);
      const target = inWater ? 0 : clamp(Math.atan2(hf - hb, len), -0.3, 0.3);
      this.pitch += (target - this.pitch) * Math.min(1, dt * 4);
      if (!inWater && !this.landed) g = Math.min(g, (hf + hb) * 0.5);
    }
    this.pos.y += (g - this.pos.y) * Math.min(1, dt * 10);
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
    let speed = this.walkSpeed;
    // de vez em quando desce para pousar e andar no chão
    if (sp.pousa && !fleeing && !hunting) {
      this._landT = (this._landT ?? 30 + this.rand() * 60) - dt;
      if (this._landT <= 0) {
        if (!this.landingSpot) this.landingSpot = this._findLandingSpot();
        const s = this.landingSpot;
        if (s) {
          this.goal = s;
          const d = this._dist2DXY(s.x, s.y);
          const gH = this.world.heightAt(this.pos.x, this.pos.z) + this.standHeight;
          wanted = gH + Math.max(0, d - 4) * 0.35; // plana descendo
          speed = Math.max(this.walkSpeed * 0.55, Math.min(this.walkSpeed, d * 0.4));
          if (d < 5 && this.pos.y - gH < 1.2) {
            this._land();
            return;
          }
        } else this._landT = 20;
      }
    }
    if (fleeing && this.threat) {
      const ax = this.pos.x - this.threat.position.x;
      const az = this.pos.z - this.threat.position.z;
      const len = Math.hypot(ax, az) || 1;
      this.goal = new THREE.Vector2(this.pos.x + (ax / len) * 60, this.pos.z + (az / len) * 60);
      wanted += 20;
      speed = this.runSpeed;
    }
    if (hunting) {
      const t = this.target.position;
      this.goal = new THREE.Vector2(t.x, t.z);
      const d = this._dist2D(t);
      speed = this.runSpeed;
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
    // (se acabou de matar a presa, o estado muda e o destino zera)
    if (!this.goal) this.goal = new THREE.Vector2(this.pos.x - Math.sin(this.yaw) * 40, this.pos.z - Math.cos(this.yaw) * 40);
    const prevYaw = this.yaw;
    this._steer(dt, this.goal.x, this.goal.y, speed, true);
    this.climb = clamp((wanted - this.pos.y) * 0.8, -9, 7);
    this.pos.y += this.climb * dt;
    if (this.pos.y < ground + 1.2) this.pos.y = ground + 1.2;
    const turning = angleDelta(prevYaw, this.yaw) / Math.max(dt, 1e-3);
    this.roll += (clamp(-turning * 0.6, -0.7, 0.7) - this.roll) * Math.min(1, dt * 2);
    this.pitch += (clamp(this.climb * 0.07, -0.45, 0.35) - this.pitch) * Math.min(1, dt * 2);
  }

  // ---------------------------------------------------------
  // Pousar (voadores grandes que também andam no chão)
  // ---------------------------------------------------------
  // altura do corpo em pé no chão (pernas)
  get standHeight() {
    // do corpo (altura 0 do modelo) até o pé
    return this.legsDown * this.scale;
  }

  _findLandingSpot() {
    for (let i = 0; i < 12; i++) {
      const p = this._pickWanderPoint(70);
      if (!p) continue;
      if (this.world.waterAt(p.x, p.y)) continue;
      const n = this.world.map.normalAt(p.x, p.y, new THREE.Vector3());
      if (n.y < 0.9) continue;
      return p;
    }
    return null;
  }

  _land() {
    this.landed = true;
    this.landingSpot = null;
    this.climb = 0;
    this.roll = 0;
    this.speed = 0;
    this.goal = null;
    this._groundT = 30 + this.rand() * 70;
    this._setState(CSTATE.IDLE);
    this.idleFor = 3 + this.rand() * 4;
  }

  _takeOff() {
    this.landed = false;
    this._landT = 50 + this.rand() * 90;
    this.goal = null;
    this.climb = 4;
    if (this.state !== CSTATE.FLEE && this.state !== CSTATE.CHASE && this.state !== CSTATE.ATTACK) this._setState(CSTATE.WANDER);
  }

  // No chão: anda como bicho de terra; levanta voo quando cansa de
  // ficar, quando foge ou quando a presa está longe.
  _updateLanded(dt) {
    this._groundT -= dt;
    const t = this.target;
    const farPrey = (this.state === CSTATE.CHASE || this.state === CSTATE.ATTACK) && t && this._dist2D(t.position) > 25;
    if (this._groundT <= 0 || this.state === CSTATE.FLEE || farPrey || this.tamed) this._takeOff();
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
    const turn = this.turnRate * dt * (speed > this.walkSpeed * 1.5 ? 1.3 : 1);
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
    if (flying && !this.world.map.inside(nx, nz)) {
      this.goal = new THREE.Vector2(0, 0);
      return false;
    }
    this.blockedTime = Math.max(0, this.blockedTime - dt);
    this.pos.x = nx;
    this.pos.z = nz;
    // paredes construídas seguram os bichos (menos os voadores)
    if (!flying && this.world.structures.length) {
      const bx = this.pos.x;
      const bz = this.pos.z;
      this._blockPiece = null;
      for (const s of this.world.structures) if (s.isBuild && !s.removed && s.collide(this.pos, Math.min(this.radius, 1.5) * 0.8, this.pos.y, this.height)) this._blockPiece = s;
      if (Math.hypot(this.pos.x - bx, this.pos.z - bz) > 0.01) this.blockedTime += dt * 0.5;
    }
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
    if (!this.world.map.inside(x, z, 20)) return false;
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
    if (this.landed) return this.world.heightAt(x, z) + this.standHeight;
    const g = this.aquatic ? this.world.heightAt(x, z) : this.world.groundAt(x, z, this.pos.y + 0.3);
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
        if (this.world.map.inside(x, z, 60)) return new THREE.Vector2(x, z);
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
    if (this.maxHealth > 0) aplicarFeridas(this, 1 - Math.max(0, this.health) / this.maxHealth);
    // apanhar desmaiado estraga a doma (efetividade cai)
    if (this.state === CSTATE.KO && !this.tamed) this.tameEff = Math.max(0, (this.tameEff ?? 1) - (amount / this.maxHealth) * BALANCE.domar.efetividade_por_dano);
    // número do dano flutuando (só o que o jogador daqui fez)
    if (attacker && attacker === this.manager.localPlayer) events.emit(EV.DAMAGE_NUMBER, { pos: this.center(), amount });
    if (this.health <= 0) {
      this.health = 0;
      this._setState(CSTATE.DEAD);
      sound.creature(this, 'morte');
      this.manager.onDeath(this, attacker);
      return;
    }
    const sp = this.species;
    sound.creature(this, 'dor');
    if (this.state === CSTATE.KO) return; // desmaiado não reage
    if (this.tamed) {
      // domado: revida quem bateu (menos o dono)
      if (attacker && attacker !== this.owner && !this.rider && this.damage > 0 && this.aggression !== 'passivo') this._chase(attacker);
      return;
    }
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
    const cp = this.clipPlayer;
    if (!cp) {
      this._animateCode(dt, ctx, yawVel);
      // jeito próprio de cada espécie (dodô bica, onça se agacha, triceratops investe...)
      aplicarTraco(this, this.bones, this.time, this.anim, CSTATE);
      return;
    }
    // bicho com animação do próprio modelo: escolhe o clipe pelo que ele
    // está fazendo; o que não tem clipe fica com a animação por código
    const down = this.state === CSTATE.DEAD || this.state === CSTATE.KO;
    if (!down) {
      if (this.state === CSTATE.CHASE && this._clipState !== CSTATE.CHASE) cp.play('rugido');
      if (this.attackAnim > 0.95 && !this._clipAtk) {
        cp.play('ataque');
        this._clipAtk = true;
      } else if (this.attackAnim < 0.5) this._clipAtk = false;
    } else cp.once = null;
    this._clipState = this.state;
    let want = null;
    let rate = 1;
    const inWater = this.swims && !this.aquatic && !!this.world.waterAt(this.pos.x, this.pos.z);
    if (!down && !inWater) {
      if (this.flies && !this.landed) {
        want = 'voar';
        rate = this.climb > 0.5 || this.state === CSTATE.FLEE ? 1.4 : 1;
      } else if (this.speed > 0.15 && cp.has('andar')) {
        // o clipe anda no ritmo do passo (pé não escorrega)
        const c = cp.clips.andar;
        want = 'andar';
        rate = c.stride ? Math.min(3, (this.speed / (c.stride * this.scale)) * (c.duration / c.cycles)) : 1;
        // calibragem medida do pé no chão (1 = parado): corrige o ritmo do clipe
        const pc = PASSO_CAL[this.species.id];
        if (pc) rate = Math.min(8, rate * Math.pow(clamp(1 / Math.max(0.1, pc.walk + (pc.run - pc.walk) * this.anim.run), 0.4, 6), 0.75));
      } else if (this.speed <= 0.15) want = 'parado';
    }
    const active = cp.update(dt, want, rate);
    if (active) cp.reset();
    this._animateCode(dt, ctx, yawVel);
    aplicarTraco(this, this.bones, this.time, this.anim, CSTATE);
    if (active) cp.apply();
  }

  _footfall(camDist, step) {
    const size = (this.bodyFront + this.bodyBack) * this.scale;
    if (size < 7) return;
    const side = step % 2 ? 1 : -1;
    const w = this.radius * 0.5 * side;
    const x = this.pos.x + Math.cos(this.yaw) * w;
    const z = this.pos.z - Math.sin(this.yaw) * w;
    const fx = new THREE.Vector3(x, this.world.heightAt(x, z) + 0.15, z);
    this.world.effects?.burst(fx, 'poeira', Math.min(10, Math.round(size / 2)), 1.6 + size * 0.05);
    const near = Math.max(0, 1 - camDist / (12 + size * 2.5));
    if (near > 0) {
      sound.play('pisada', fx, { volume: Math.min(1, size / 16) });
      if (size >= 10) this.manager.localPlayer?.onImpact?.(Math.min(0.7, size / 35) * near);
    }
  }

  // Monta os dados das pernas com IK: comprimento e posição de descanso de cada osso (medidos nos ossos de verdade).
  _buildIK() {
    const spec = this.spec;
    if (!['quad', 'biped', 'croc'].includes(spec.body) || this.flies || this.aquatic) return null;
    const legs = [];
    const byName = {};
    for (const leg of spec.legs ?? []) {
      if (leg.name.startsWith('braco')) continue;
      const thigh = this.bones[leg.name];
      const knee = this.bones[`${leg.name}_joelho`];
      const foot = this.bones[`${leg.name}_pe`];
      if (!thigh || !knee || !foot) continue;
      const u1 = [knee.position.y, knee.position.z];
      const u2 = [foot.position.y, foot.position.z];
      if (Math.hypot(...u1) < 1e-3 || Math.hypot(...u2) < 1e-3) continue;
      const lk = { name: leg.name, u1, u2, R0y: u1[0] + u2[0], R0z: u1[1] + u2[1], offS: 0, liftS: 0, prev: [0, 0] };
      legs.push(lk);
      byName[leg.name] = lk;
    }
    if (!legs.length) return null;
    const reach = legs.reduce((m, l) => m + Math.hypot(...l.u1) + Math.hypot(...l.u2), 0) / legs.length;
    return { legs, byName, reach, bob: 0 };
  }

  _animateCode(dt, ctx, yawVel) {
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
    A.run += (clamp(this.speed / Math.max(0.1, this.runSpeed), 0, 1) - A.run) * k(4);
    const legLen = Math.max(0.25, this.height * 0.45);
    // passo de verdade: andando a perna abre ~0,35 rad, correndo até ~0,7;
    // o ritmo segue o tamanho do passo (o pé não escorrega no chão)
    // virando parado: o bicho dá passinhos no lugar em vez de girar com as patas congeladas
    const turnStep = this.speed < 0.3 && !dead ? Math.abs(A.turn) * Math.max(0.5, this.radius) * 0.9 : 0;
    const spd = Math.max(this.speed, turnStep);
    const moving = clamp(spd / Math.max(0.15, this.walkSpeed * 0.4), 0, 1);
    // calibragem medida: o pé varre o chão X vezes mais rápido que o corpo (X = r). Corrige o tamanho do passo
    // (ampK) e o ritmo (freqK) em partes iguais para o pé ficar parado no chão (r = 1).
    const cal = PASSO_CAL[this.species.id];
    let ampK = 1;
    let freqK = 1;
    if (cal && !this.flies && !this.aquatic) {
      const r = Math.max(0.1, cal.walk + (cal.run - cal.walk) * A.run);
      const want = 1 / r;
      ampK = clamp(Math.sqrt(want), 0.6, 2);
      freqK = clamp(want / ampK, 0.45, 2.5);
    }
    if (this._ik === undefined) this._ik = this._buildIK();
    const ik = this._ik && !dead ? this._ik : null;
    const amp = moving * (0.34 + 0.36 * A.run) * (ik ? 1 : ampK);
    let stride = (spec.body === 'spider' ? legLen * 1.4 : Math.max(0.3, 4 * legLen * Math.sin(Math.max(0.2, amp / ampK)) * 0.85)) / freqK;
    // pernas com IK: o passo varre uma fração do alcance da perna; o pé fica parado no chão pelo tempo do apoio
    let ikS = 0;
    let ikDuty = 0.64;
    if (ik) {
      ikDuty = 0.66 - 0.26 * A.run;
      ikS = ik.reach * (0.5 + 0.38 * A.run);
      stride = (ikS * this.scale) / ikDuty; // distância que o corpo anda em um ciclo completo da perna
    }
    this.phase += (adt * spd) / stride;
    // pisada dos gigantes: poeira, barulho surdo e o chão treme
    const step = Math.floor(this.phase * 2);
    if (step !== this._lastStep) {
      this._lastStep = step;
      if (!dead && !this.flies && !this.aquatic && this.speed > 0.3 && camDist < 90) this._footfall(camDist, step);
    }

    // ---------- voadores ----------
    if (spec.body === 'flyer' && this.landed && !dead) {
      // no chão: asas dobradas viram as patas da frente; pescoço em pé
      const ph = this.phase * TAU;
      const walk = clamp(this.speed / Math.max(0.1, this.walkSpeed), 0, 1.4);
      const s = Math.sin(ph) * 0.22 * walk;
      if (b.asaE) b.asaE.rotation.set(0, 0.3 + s, -1.42);
      if (b.asaD) b.asaD.rotation.set(0, -0.3 + s, 1.42);
      // a ponta da asa (dedo comprido) fica dobrada junto do braço
      if (b.asaE_punho) {
        b.asaE_punho.rotation.set(0, -0.4, 2.5);
        b.asaE_punho.scale.setScalar(0.14);
      }
      if (b.asaD_punho) {
        b.asaD_punho.rotation.set(0, 0.4, -2.5);
        b.asaD_punho.scale.setScalar(0.14);
      }
      for (const [n, o] of [['pernaE', 0], ['pernaD', Math.PI]]) {
        if (!b[n]) continue;
        b[n].rotation.x = Math.sin(ph + o) * 0.35 * walk;
        if (b[`${n}_joelho`]) b[`${n}_joelho`].rotation.x = -Math.max(0, Math.cos(ph + o)) * 0.4 * walk;
      }
      const look = Math.sin(t * 0.6 + this.id) * 0.3;
      if (b.neck) b.neck.rotation.x = 1.2 - this.attackAnim * 0.9 + Math.sin(t * 1.1) * 0.03;
      if (b.neck2) b.neck2.rotation.x = 0.25;
      if (b.head) {
        b.head.rotation.x = -1.25 + this.attackAnim * 0.5;
        b.head.rotation.y = look;
      }
      return;
    }
    if (spec.body === 'flyer') {
      // em voo: pernas esticadas para trás, pescoço reto
      for (const n of ['pernaE', 'pernaD']) if (b[n]) b[n].rotation.x = -1.25;
      if (b.asaE) b.asaE.rotation.y = 0;
      if (b.asaD) b.asaD.rotation.y = 0;
      for (const n of ['asaE_punho', 'asaD_punho']) {
        if (!b[n]) continue;
        b[n].rotation.y = 0;
        b[n].scale.setScalar(1);
      }
      if (b.neck2) b.neck2.rotation.x = 0;
      if (b.head) b.head.rotation.x = 0;
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
    if (ik) {
      // o mesmo balanço vertical do corpo que o bloco "corpo" aplica abaixo (para o pé compensar e não sair do chão)
      const bobY = Math.abs(Math.sin(this.phase * TAU)) * amp * legLen * 0.09;
      const breatheY = Math.sin(t * 1.6) * 0.012 * legLen * (1 - A.run);
      ik.bob = (bobY + breatheY) / this.scale;
    }
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
      // pé preso no chão (cinemática inversa)
      const lk = ik?.byName[leg.name];
      if (ik && lk) {
        const u = (((this.phase + leg.phase) % 1) + 1) % 1;
        let off;
        let lift = 0;
        if (u < ikDuty) off = -ikS / 2 + ikS * (u / ikDuty); // apoio: o pé fica parado e o corpo passa
        else {
          const w = (u - ikDuty) / (1 - ikDuty); // balanço: o pé volta ao ponto de apoio
          off = ikS / 2 - ikS * easeSwing(w);
          lift = Math.sin(w * Math.PI) * ik.reach * (0.14 + 0.1 * A.run);
        }
        // parado (ou quase): os pés voltam à posição de descanso
        const wv = clamp(spd / 0.3, 0, 1);
        lk.offS += (off * wv - lk.offS) * (wv < 1 ? Math.min(1, adt * 10) : 1);
        lk.liftS += (lift * wv - lk.liftS) * (wv < 1 ? Math.min(1, adt * 10) : 1);
        // o corpo sobe e desce (bob): o pé continua no chão, então o alvo desce junto, no referencial do osso pai
        const T = [lk.R0y - ik.bob + lk.liftS, lk.R0z + lk.offS];
        const sol = solvePerna(lk.u1, lk.u2, T, lk.prev);
        lk.prev[0] = sol.t1;
        lk.prev[1] = sol.t2;
        thigh.rotation.x = sol.t1;
        knee.rotation.x = sol.t2;
        foot.rotation.x = -(sol.t1 + sol.t2); // pé sempre paralelo ao chão
        continue;
      }
      // curva de verdade (se o bicho tiver um jeito de andar)
      const gait = PASSOS[GAIT_OF[this.species.id]]?.pernas[leg.name.slice(0, -1)];
      if (gait && spec.body === 'quad') {
        const p = this.phase + gait.atraso + (leg.name.endsWith('D') ? gait.atraso_D : 0);
        const g = moving * (1 + A.run * 0.8) * ampK;
        thigh.rotation.x = gaitAt(gait.coxa, p) * g;
        if (knee && gait.joelho) knee.rotation.x = gaitAt(gait.joelho, p) * g;
        if (foot && gait.pe) foot.rotation.x = gaitAt(gait.pe, p) * g;
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
      const sway = Math.sin(this.phase * TAU) * amp * (spec.body === 'biped' ? 0.06 : spec.body === 'quad' ? 0.035 : 0.02);
      b.hips.rotation.z = sway - A.turn * 0.08 + this.hurtAnim * 0.15;
      // correndo, o corpo inclina para frente
      b.hips.rotation.x = -A.run * 0.06 * (spec.body === 'biped' ? 1 : 0.4) + (dead ? 0 : Math.sin(this.phase * TAU * 2) * amp * 0.02); // cabeceio do passo
    }
    if (b.chest) b.chest.rotation.y = A.turn * 0.12;

    // ---------- cauda (segue as curvas com atraso) ----------
    const tailIdle = inWater ? 0.35 : 0.09 * (1 - A.run * 0.6);
    const tailSpeed = inWater ? 3 : 1.3;
    ['tail1', 'tail2', 'tail3'].forEach((n, i) => {
      if (!b[n]) return;
      // andando, a cauda balança junto com os passos (contrapeso)
      const stepSway = Math.sin(this.phase * TAU - i * 0.7) * amp * 0.22;
      const target = dead ? 0.15 : -A.turn * 0.12 * (i + 1) + Math.sin(t * tailSpeed - i * 0.9) * tailIdle + stepSway;
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
    // crocodilo deitado: cabeça sempre baixa, perto do chão (nunca levantada)
    const croc = spec.body === 'croc' && !dead;
    if (croc && !tgt) wantPitch = Math.min(wantPitch, 0) - 0.05;
    A.headYaw += (wantYaw - A.headYaw) * k(3);
    A.headPitch += (wantPitch - A.headPitch) * k(3);
    const eating = this.state === CSTATE.EAT;
    // comendo: abaixa a cabeça (bicho alto comendo árvore: estica para cima)
    const high = eating && this.eatRec && FOOD_HIGH.has(this.eatRec.type);
    const neckDown = eating ? (high ? 0.15 : -0.6) - Math.max(0, Math.sin(t * 2.2)) * 0.15 : 0;
    A.neck += (neckDown - A.neck) * k(3);
    // bote: recua (0..0.3) e avança (0.3..0.7)
    const at = 1 - this.attackAnim;
    // (o corpo acompanha o bote sem tranco, mesmo com poucos quadros por segundo)
    this._lunge += ((this.attackAnim > 0 ? atkLunge(at) : 0) - this._lunge) * Math.min(1, adt * 26);
    const lunge = this._lunge;
    if (b.neck) {
      // cabeça sobe e desce um pouco a cada passo
      const nod = Math.sin(this.phase * TAU * 2) * amp * 0.08;
      b.neck.rotation.x = dead ? -0.35 : A.neck + lunge + A.headPitch * 0.5 + this.hurtAnim * 0.25 + nod - (croc ? 0.16 : 0);
      b.neck.rotation.y = A.headYaw * 0.5;
    }
    if (b.neck2) b.neck2.rotation.x = eating ? -0.35 : A.headPitch * 0.3;
    if (b.head) {
      // mastigando: a cabeça puxa e solta
      b.head.rotation.x = eating ? -0.3 + Math.sin(t * 5.5) * 0.12 : A.headPitch * 0.5 + lunge * 0.4 - (croc ? 0.1 : 0);
      b.head.rotation.y = A.headYaw * 0.5;
    }
    if (b.jaw && eating) b.jaw.rotation.x = -Math.max(0, Math.sin(t * 5.5)) * 0.3;
    else if (b.jaw) b.jaw.rotation.x = this.attackAnim > 0 ? -atkJaw(at) * 0.65 : 0.02; // parado: boca fechada (só abre ao comer, rugir ou atacar)
    if (b.hips) b.hips.position.z = (b.hips.userData.rest.z) - lunge * 0.15 * legLen / this.scale;
  }

  // ---------------------------------------------------------
  // Co-op (convidado): a criatura só segue o que o anfitrião manda.
  // ---------------------------------------------------------
  applyNet(e) {
    // e = { x, y, z, yaw, st, hp, atk, loot, ld (pousado) }
    this.landed = !!e.ld;
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
    this.attackAnim = Math.max(0, this.attackAnim - dt * 1.7);
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
    this.koAnim = clamp((this.koAnim ?? 0) + (this.state === CSTATE.KO ? dt * 1.5 : -dt * 1.2), 0, 1);
    const yawVel = angleDelta(prevYaw, this.yaw) / Math.max(dt, 1e-3);
    this._animate(dt, ctx, yawVel);
    this._sync(dt);
  }

  // Copia posição e rotação para a malha 3D.
  _sync(dt) {
    const m = this.mesh;
    if (this._saddleMesh) ajustarSela(this); // a sela acompanha o corpo (animações levantam e abaixam o dorso)
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
    // voador pousado: peito alto, apoiado nas asas dobradas
    this._standUp = (this._standUp ?? 0) + ((this.landed ? 0.12 : 0) - (this._standUp ?? 0)) * Math.min(1, dt * 3);
    const ko = this.koAnim ?? 0;
    if (ko > 0) {
      // desmaiado: deita de lado
      const side = ['snake', 'croc', 'fish', 'spider'].includes(this.spec.body) ? Math.PI * 0.5 : Math.PI * 0.45;
      m.rotation.set(this.pitch, this.yaw, this.roll + side * ko * ko * (3 - 2 * ko), 'YXZ');
      return;
    }
    m.rotation.set(this.pitch + this._standUp + this._lunge * 0.1, this.yaw, this.roll, 'YXZ');
  }
}
