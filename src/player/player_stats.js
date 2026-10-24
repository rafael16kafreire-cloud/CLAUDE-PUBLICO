// =============================================================
// ATRIBUTOS DO JOGADOR
// Vida, Stamina, Fome, Sede, Fôlego, Temperatura, Nível e XP.
// Todos os números vêm do arquivo de balanceamento.
// =============================================================
import { BALANCE, perSecond } from '../core/balance.js';
import { events, EV } from '../core/event_bus.js';

export class PlayerStats {
  constructor() {
    const J = BALANCE.jogador;
    this.max = {
      health: J.vida_max,
      stamina: J.stamina_max,
      food: J.fome_max,
      water: J.sede_max,
      oxygen: J.folego_max,
    };
    this.health = this.max.health;
    this.stamina = this.max.stamina;
    this.food = this.max.food;
    this.water = this.max.water;
    this.oxygen = this.max.oxygen;
    this.temperature = BALANCE.temperatura.base_c;

    this.level = 1;
    this.xp = 0;
    this.points = 0; // pontos para gastar ao subir de nível (Fase 3)

    this.dead = false;
    this.deathCause = null;
    this.onDeath = null; // função chamada ao morrer (o Player define)
    this._staminaDelay = 0;
  }

  // ctx: { running, swimming, swimFast, moving, headUnderwater, ambientTemp }
  update(dt, ctx) {
    if (this.dead) return;
    const S = BALANCE.sobrevivencia;
    const St = BALANCE.stamina;
    const F = BALANCE.folego;

    // ---- Fome e sede caem com o tempo (mais rápido correndo/nadando)
    let mult = 1;
    if (ctx.running) mult = S.mult_correndo;
    else if (ctx.swimming) mult = S.mult_nadando;
    this.food = Math.max(0, this.food - perSecond(this.max.food, S.fome_duracao_min) * mult * dt);
    this.water = Math.max(0, this.water - perSecond(this.max.water, S.sede_duracao_min) * mult * dt);

    // ---- Stamina
    let drain = 0;
    if (ctx.running) drain += St.gasto_correr_seg;
    if (ctx.swimming && ctx.moving) drain += ctx.swimFast ? St.gasto_nado_rapido_seg : St.gasto_nado_seg;
    if (drain > 0) {
      this.stamina = Math.max(0, this.stamina - drain * dt);
      this._staminaDelay = St.espera_regen_seg;
    } else if (this._staminaDelay > 0) {
      this._staminaDelay -= dt;
    } else {
      const regen = ctx.swimming ? St.regen_seg * St.regen_na_agua : St.regen_seg;
      this.stamina = Math.min(this.max.stamina, this.stamina + regen * dt);
    }

    // ---- Fôlego (só cai com a cabeça embaixo d'água)
    if (ctx.headUnderwater) {
      this.oxygen = Math.max(0, this.oxygen - (this.max.oxygen / F.duracao_seg) * dt);
    } else {
      this.oxygen = Math.min(this.max.oxygen, this.oxygen + F.regen_seg * dt);
    }

    // ---- Vida: dano por fome/sede/afogamento ou regeneração
    let damage = 0;
    let cause = null;
    if (this.oxygen <= 0 && ctx.headUnderwater) {
      damage += F.dano_afogando_seg;
      cause = 'afogamento';
    }
    if (this.water <= 0) {
      damage += S.dano_sede_seg;
      cause ??= 'sede';
    }
    if (this.food <= 0) {
      damage += S.dano_fome_seg;
      cause ??= 'fome';
    }
    if (damage > 0) {
      this.damage(damage * dt, cause);
    } else if (
      this.food / this.max.food > S.regen_limite &&
      this.water / this.max.water > S.regen_limite
    ) {
      this.health = Math.min(this.max.health, this.health + S.regen_vida_seg * dt);
    }

    // ---- Temperatura do corpo segue a do ambiente aos poucos
    // (Fase 1: só aparece no ícone. Efeitos de frio/calor na Fase 4.)
    if (typeof ctx.ambientTemp === 'number') {
      this.temperature += (ctx.ambientTemp - this.temperature) * Math.min(1, dt * 0.25);
    }
  }

  // Gasta stamina se tiver o suficiente. Devolve true se gastou.
  useStamina(amount) {
    if (this.stamina < amount) return false;
    this.stamina -= amount;
    this._staminaDelay = BALANCE.stamina.espera_regen_seg;
    return true;
  }

  damage(amount, cause = 'ferimento') {
    if (this.dead) return;
    this.health -= amount;
    if (this.health <= 0) {
      this.health = 0;
      this.dead = true;
      this.deathCause = cause;
      this.onDeath?.(cause);
    }
  }

  // Beber água doce. Devolve quanto recuperou de fato.
  drink(amount) {
    const before = this.water;
    this.water = Math.min(this.max.water, this.water + amount);
    return this.water - before;
  }

  // ---- XP e níveis
  xpToNext() {
    const N = BALANCE.nivel;
    return Math.round(N.xp_base * Math.pow(N.xp_crescimento, this.level - 1));
  }

  addXP(amount) {
    const N = BALANCE.nivel;
    if (this.level >= N.max) return;
    this.xp += amount;
    events.emit(EV.XP_GAINED, { amount });
    while (this.level < N.max && this.xp >= this.xpToNext()) {
      this.xp -= this.xpToNext();
      this.level += 1;
      this.points += 1;
      events.emit(EV.LEVEL_UP, { level: this.level, points: this.points });
    }
    if (this.level >= N.max) this.xp = 0;
  }

  // Ao renascer: tudo cheio, fome/sede conforme o balanceamento.
  resetForRespawn() {
    const M = BALANCE.morte;
    this.health = this.max.health;
    this.stamina = this.max.stamina;
    this.oxygen = this.max.oxygen;
    this.food = (this.max.food * M.renascer_fome) / 100;
    this.water = (this.max.water * M.renascer_sede) / 100;
    this.temperature = BALANCE.temperatura.base_c;
    this.dead = false;
    this.deathCause = null;
  }

  // Para salvar/carregar (usado de verdade na Fase 12).
  toJSON() {
    const { health, stamina, food, water, oxygen, temperature, level, xp, points } = this;
    return { health, stamina, food, water, oxygen, temperature, level, xp, points };
  }

  fromJSON(data) {
    if (!data) return;
    for (const key of ['health', 'stamina', 'food', 'water', 'oxygen', 'temperature', 'level', 'xp', 'points']) {
      if (typeof data[key] === 'number') this[key] = data[key];
    }
  }
}
