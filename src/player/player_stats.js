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
    this.points = 0; // pontos para gastar ao subir de nível (Inventário → Habilidades)
    // engramas: pontos para aprender receitas e as já aprendidas
    this.engramPoints = 0;
    this.learned = new Set();
    this.skills = { vida: 0, stamina: 0, fome: 0, sede: 0, folego: 0, peso: 0, forca: 0, velocidade: 0, fortitude: 0 };

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
    // (gasta como se a barra fosse a do nível 1: barra maior = dura mais)
    const J = BALANCE.jogador;
    this.food = Math.max(0, this.food - perSecond(J.fome_max, S.fome_duracao_min) * mult * dt);
    this.water = Math.max(0, this.water - perSecond(J.sede_max, S.sede_duracao_min) * mult * dt);

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
      this.oxygen = Math.max(0, this.oxygen - (J.folego_max / F.duracao_seg) * dt);
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
    // ---- Frio: fome mais rápida; congelando perde vida
    const TT = BALANCE.temperatura;
    if (this.temperature < TT.fome_frio_abaixo_c) {
      this.food = Math.max(0, this.food - perSecond(BALANCE.jogador.fome_max, S.fome_duracao_min) * (TT.fome_frio_mult - 1) * dt);
    }
    if (this.temperature < TT.congelando_c) {
      this.damage(TT.dano_frio_seg * dt * (1 + (TT.congelando_c - this.temperature) / 10), 'frio');
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
    const T = N.xp_por_nivel;
    return T[Math.min(this.level - 1, T.length - 1)];
  }

  addXP(amount) {
    const N = BALANCE.nivel;
    if (this.level >= N.max) return;
    this.xp += amount;
    events.emit(EV.XP_GAINED, { amount });
    while (this.level < N.max && this.xp >= this.xpToNext()) {
      this.xp -= this.xpToNext();
      this.level += 1;
      this.points += BALANCE.habilidades.pontos_por_nivel;
      this.engramPoints += this.engramsForLevel(this.level);
      events.emit(EV.LEVEL_UP, { level: this.level, points: this.points });
    }
    if (this.level >= N.max) this.xp = 0;
  }

  // ---- Engramas (receitas aprendidas com pontos)
  engramsForLevel(level) {
    const T = BALANCE.engramas.por_nivel;
    return T[Math.min(Math.max(level - 2, 0), T.length - 1)];
  }

  // Receita já sabida? (custo 0 = sabe desde o começo)
  knows(recipe) {
    // engrama_id: receitas diferentes do mesmo item (ex.: a mesma
    // receita feita com materiais diferentes) se aprendem juntas
    return !recipe.engrama || this.learned.has(recipe.engrama_id ?? recipe.id);
  }

  // Dá para aprender agora? Devolve o motivo se não der.
  learnBlock(recipe) {
    if (this.knows(recipe)) return 'já sabe';
    if (this.level < (recipe.nivel ?? 1)) return `precisa do nível ${recipe.nivel}`;
    if (this.engramPoints < recipe.engrama) return `faltam ${recipe.engrama - this.engramPoints} pontos`;
    return null;
  }

  learn(recipe) {
    if (this.learnBlock(recipe)) return false;
    this.engramPoints -= recipe.engrama;
    this.learned.add(recipe.engrama_id ?? recipe.id);
    events.emit(EV.SKILLS_CHANGED, { key: 'engrama' });
    return true;
  }

  // ---- Habilidades (pontos ganhos ao subir de nível)
  // Peso que carrega sem ficar lento.
  get maxWeight() {
    return BALANCE.jogador.peso_max + this.skills.peso * BALANCE.habilidades.peso;
  }

  // Multiplicador da velocidade de andar/correr (habilidade Velocidade).
  get speedMul() {
    return 1 + (this.skills.velocidade * BALANCE.habilidades.velocidade) / 100;
  }

  // Graus a mais de resistência ao frio (habilidade Fortitude).
  get fortitudeC() {
    return this.skills.fortitude * BALANCE.habilidades.fortitude;
  }

  // Multiplicador do dano corpo a corpo.
  get damageMul() {
    return 1 + (this.skills.forca * BALANCE.habilidades.forca) / 100;
  }

  // Valor de cada habilidade agora (para a tela).
  skillValue(key) {
    const H = BALANCE.habilidades;
    switch (key) {
      case 'vida': return this.max.health;
      case 'stamina': return this.max.stamina;
      case 'fome': return this.max.food;
      case 'sede': return this.max.water;
      case 'folego': return this.max.oxygen;
      case 'peso': return this.maxWeight;
      case 'forca': return 100 + this.skills.forca * H.forca;
      case 'velocidade': return 100 + this.skills.velocidade * H.velocidade;
      case 'fortitude': return this.skills.fortitude * H.fortitude;
      default: return 0;
    }
  }

  spendPoint(key) {
    if (this.points <= 0 || !(key in this.skills)) return false;
    this.points -= 1;
    this.skills[key] += 1;
    const before = { ...this.max };
    this._applySkills();
    // o que aumentou já vem cheio
    this.health += this.max.health - before.health;
    this.stamina += this.max.stamina - before.stamina;
    this.food += this.max.food - before.food;
    this.water += this.max.water - before.water;
    this.oxygen += this.max.oxygen - before.oxygen;
    events.emit(EV.SKILLS_CHANGED, { key });
    return true;
  }

  _applySkills() {
    const J = BALANCE.jogador;
    const H = BALANCE.habilidades;
    const s = this.skills;
    this.max.health = J.vida_max + s.vida * H.vida;
    this.max.stamina = J.stamina_max + s.stamina * H.stamina;
    this.max.food = J.fome_max + s.fome * H.fome;
    this.max.water = J.sede_max + s.sede * H.sede;
    this.max.oxygen = J.folego_max + s.folego * H.folego;
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
    const { health, stamina, food, water, oxygen, temperature, level, xp, points, engramPoints } = this;
    return { health, stamina, food, water, oxygen, temperature, level, xp, points, engramPoints, learned: [...this.learned], skills: { ...this.skills } };
  }

  fromJSON(data) {
    if (!data) return;
    for (const key of ['health', 'stamina', 'food', 'water', 'oxygen', 'temperature', 'level', 'xp', 'points']) {
      if (typeof data[key] === 'number') this[key] = data[key];
    }
    if (Array.isArray(data.learned)) {
      this.learned = new Set(data.learned);
      if (typeof data.engramPoints === 'number') this.engramPoints = data.engramPoints;
    } else {
      // jogo salvo de antes dos engramas: ganha os pontos de todos os
      // níveis que já tinha (aprende o que quiser na tela de Criar)
      this.engramPoints = 0;
      for (let l = 2; l <= this.level; l++) this.engramPoints += this.engramsForLevel(l);
    }
    if (data.skills) {
      for (const k of Object.keys(this.skills)) if (typeof data.skills[k] === 'number') this.skills[k] = data.skills[k];
      this._applySkills();
    }
  }
}
