// =============================================================
// ATRIBUTOS DO JOGADOR
// Vida, Stamina, Fome, Sede, Fôlego, Temperatura, Nível e XP.
// Todos os números vêm do arquivo de balanceamento.
// =============================================================
import { BALANCE, perSecond } from '../core/balance.js';
import { events, EV } from '../core/event_bus.js';
import * as C from '../progression/progression_config.js';
import { PlayerProgression } from '../progression/player_progression.js';
import { EngramManager } from '../progression/engram_manager.js';
import { COMBAT_COOLDOWN_S, RESET_POTION_DRINK_S } from '../core/timings.js';

export class PlayerStats {
  constructor() {
    // progressão (nível, XP, pontos, atributos) e engramas: ver src/progression/
    this.prog = new PlayerProgression();
    this.engrams = new EngramManager(this.prog);
    this.max = {
      health: this.prog.getStat('vida'),
      stamina: this.prog.getStat('stamina'),
      food: this.prog.getStat('comida'),
      water: this.prog.getStat('agua'),
      oxygen: this.prog.getStat('oxigenio'),
    };
    this.health = this.max.health;
    this.stamina = this.max.stamina;
    this.food = this.max.food;
    this.water = this.max.water;
    this.oxygen = this.max.oxygen;
    this.temperature = BALANCE.temperatura.base_c;

    this.dead = false;
    this.sick = null; // enjoo: { dps, left }
    this.exhausted = false; // stamina zerada: sem correr nem pular até voltar a 20
    this.deathCause = null;
    this.onDeath = null; // função chamada ao morrer (o Player define)
    this._staminaDelay = 0;
  }

  // ---- nomes que a tela e o resto do jogo já usam (apontam para a progressão nova)
  get level() { return this.prog.level; }
  set level(v) { this.prog.level = v; }
  get xp() { return this.prog.xp; }
  set xp(v) { this.prog.xp = v; }
  get points() { return this.prog.attrPoints; }
  set points(v) { this.prog.attrPoints = v; }
  get engramPoints() { return this.prog.engramPoints; }
  set engramPoints(v) { this.prog.engramPoints = v; }
  get skills() { return this.prog.spent; }
  get learned() { return this.engrams.unlocked; }

  // ctx: { running, swimming, swimFast, moving, headUnderwater, ambientTemp }
  update(dt, ctx) {
    if (this.dead) return;
    const S = BALANCE.sobrevivencia;
    const St = BALANCE.stamina;
    const F = BALANCE.folego;

    // ---- Poção de reset: beber leva RESET_POTION_DRINK_S segundos, depois devolve os pontos
    if (this.prog.respecT > 0) {
      this.prog.respecT -= dt;
      if (this.prog.respecT <= 0) this.finishRespec();
    }

    // ---- Fome e sede caem com o tempo (mais rápido correndo/nadando)
    let mult = 1;
    if (ctx.running) mult = S.mult_correndo;
    else if (ctx.swimming) mult = S.mult_nadando;
    // (gasta como se a barra fosse a do nível 1: barra maior = dura mais)
    const A = C.ATTRIBUTES;
    this.food = Math.max(0, this.food - perSecond(A.comida.base, S.fome_duracao_min) * mult * dt);
    this.water = Math.max(0, this.water - perSecond(A.agua.base, S.sede_duracao_min) * mult * dt);

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
      // parado enche rápido; andando, mais devagar (como no ARK)
      const base = ctx.moving ? St.regen_andando_seg : St.regen_parado_seg;
      const regen = ctx.swimming ? base * St.regen_na_agua : base;
      this.stamina = Math.min(this.max.stamina, this.stamina + regen * dt);
    }
    // zerou: fica exausto (sem correr, pular nem bater) até voltar a 20
    if (this.stamina <= 0.01) this.exhausted = true;
    else if (this.exhausted && this.stamina >= St.exausto_volta_em) this.exhausted = false;

    // ---- Fôlego (só cai com a cabeça embaixo d'água)
    if (ctx.headUnderwater) {
      this.oxygen = Math.max(0, this.oxygen - C.OXYGEN_DRAIN_PER_SECOND * dt); // oxigênio = segundos de ar
    } else {
      this.oxygen = Math.min(this.max.oxygen, this.oxygen + F.regen_seg * dt);
    }

    // ---- Vida: dano por fome/sede/afogamento ou regeneração
    let damage = 0;
    let cause = null;
    // enjoo (carne crua): perde vida aos poucos por alguns segundos
    if (this.sick) {
      damage += this.sick.dps;
      cause = 'comida';
      this.sick.left -= dt;
      if (this.sick.left <= 0) this.sick = null;
    }
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
      this.food = Math.max(0, this.food - perSecond(C.ATTRIBUTES.comida.base, S.fome_duracao_min) * (TT.fome_frio_mult - 1) * dt);
    }
    if (this.temperature < TT.congelando_c) {
      this.damage(TT.dano_frio_seg * dt * (1 + (TT.congelando_c - this.temperature) / 10), 'frio');
    }
  }

  // Gasta stamina se tiver o suficiente. Devolve true se gastou.
  useStamina(amount) {
    if (this.exhausted || this.stamina < amount) return false;
    this.stamina -= amount;
    if (this.stamina <= 0.01) this.exhausted = true;
    this._staminaDelay = BALANCE.stamina.espera_regen_seg;
    return true;
  }

  damage(amount, cause = 'ferimento') {
    if (this.dead) return;
    if (cause !== 'comida' && cause !== 'sede' && cause !== 'fome' && cause !== 'afogamento' && cause !== 'frio') this.prog.markCombat(); // levou dano de bicho/arma: está em combate
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

  // ---- XP e níveis (a conta está em progression/player_progression.js)
  xpToNext() {
    return this.prog.xpToNext();
  }

  addXP(amount, source = '?') {
    return this.prog.addXp(amount, source);
  }

  // ---- Engramas (receitas aprendidas com pontos): engram_manager.js
  engramsForLevel(level) {
    return C.engramPointsForLevel(level);
  }

  // Receita já sabida? (receita fora do banco de engramas = livre)
  knows(recipe) {
    return this.engrams.canCraft(recipe.id);
  }

  // Dá para aprender agora? Devolve o motivo se não der.
  learnBlock(recipe) {
    return this.engrams.unlockBlock(recipe.id);
  }

  learn(recipe) {
    if (!this.engrams.unlock(recipe.id)) return false;
    events.emit(EV.SKILLS_CHANGED, { key: 'engrama' });
    return true;
  }

  // ---- Atributos: SEMPRE pelo get_stat (progression.getStat)
  getStat(nome) {
    return this.prog.getStat(nome);
  }

  // Peso que carrega sem ficar lento (kg).
  get maxWeight() {
    return this.getStat('peso');
  }

  // Multiplicador da velocidade de andar/correr.
  get speedMul() {
    return this.getStat('velocidade') / 100;
  }

  // Graus a mais de resistência ao frio (atributo Fortitude).
  get fortitudeC() {
    return this.getStat('fortitude');
  }

  // Velocidade da fila de fabricação.
  get craftSpeed() {
    return this.getStat('criacao') / 100;
  }

  // Multiplicador do dano corpo a corpo.
  get damageMul() {
    return this.getStat('dano') / 100;
  }

  // Valor de cada atributo agora (para a tela).
  skillValue(key) {
    return this.getStat(key);
  }

  // Motivo de não dar para gastar o ponto (ou null)
  spendBlock(key) {
    return this.prog.spendBlock(key);
  }

  spendPoint(key) {
    if (this.prog.spendBlock(key)) return false;
    const before = { ...this.max };
    this.prog.spendPoint(key);
    this._applySkills();
    // Vida/Stamina/Comida/Água: o máximo sobe e o atual ganha só a diferença
    this.health += this.max.health - before.health;
    this.stamina += this.max.stamina - before.stamina;
    this.food += this.max.food - before.food;
    this.water += this.max.water - before.water;
    events.emit(EV.SKILLS_CHANGED, { key });
    return true;
  }

  _applySkills() {
    this.max.health = this.getStat('vida');
    this.max.stamina = this.getStat('stamina');
    this.max.food = this.getStat('comida');
    this.max.water = this.getStat('agua');
    this.max.oxygen = this.getStat('oxigenio');
  }

  // ---- Poção de reset de atributos (só fora de combate; beber leva 2 s)
  respecBlock() {
    if (this.prog.respecT > 0) return 'já está bebendo';
    if (this.prog.totalSpent() <= 0) return 'nenhum ponto gasto';
    if (this.prog.inCombat(COMBAT_COOLDOWN_S)) return 'em combate';
    return null;
  }

  startRespec() {
    if (this.respecBlock()) return false;
    this.prog.respecT = RESET_POTION_DRINK_S;
    return true;
  }

  finishRespec() {
    const devolvidos = this.prog.respec();
    events.emit(EV.MESSAGE, { text: `Atributos resetados: +${devolvidos} pontos para gastar.`, kind: 'gain' });
    this._applySkills();
    this.health = Math.min(this.health, this.max.health);
    this.stamina = Math.min(this.stamina, this.max.stamina);
    this.food = Math.min(this.food, this.max.food);
    this.water = Math.min(this.water, this.max.water);
    this.oxygen = Math.min(this.oxygen, this.max.oxygen);
    events.emit(EV.SKILLS_CHANGED, { key: 'reset' });
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
    this.sick = null;
    this.exhausted = false;
    this.deathCause = null;
  }

  // Para salvar/carregar. Os campos antigos (level, xp, points, engramPoints, learned, skills) continuam
  // para o resto do jogo; "progressao" é o formato novo (versao_progressao: 1).
  toJSON() {
    const { health, stamina, food, water, oxygen, temperature } = this;
    return {
      health, stamina, food, water, oxygen, temperature,
      level: this.level, xp: this.xp, points: this.points, engramPoints: this.engramPoints,
      learned: [...this.engrams.unlocked], skills: { ...this.skills },
      progressao: { ...this.prog.toJSON(), engrams: this.engrams.toJSON() },
    };
  }

  fromJSON(data) {
    if (!data) return;
    for (const key of ['health', 'stamina', 'food', 'water', 'oxygen', 'temperature']) {
      if (typeof data[key] === 'number') this[key] = data[key];
    }
    if (data.progressao && this.prog.fromJSON(data.progressao)) {
      this.engrams.fromJSON(data.progressao.engrams);
    } else {
      // save antigo (sem versao_progressao): migra sem quebrar
      this.prog.migrateLegacy({ level: data.level, skills: data.skills });
      this.engrams.migrateLegacy(data.learned);
    }
    // recalcula os máximos pelo get_stat e mantém o atual dentro do máximo
    this._applySkills();
    this.health = Math.min(this.health, this.max.health);
    this.stamina = Math.min(this.stamina, this.max.stamina);
    this.food = Math.min(this.food, this.max.food);
    this.water = Math.min(this.water, this.max.water);
    this.oxygen = Math.min(this.oxygen, this.max.oxygen);
  }

  // Zera toda a progressão (comando /resetprog)
  resetProgression() {
    this.prog.resetAll();
    this.engrams.resetAll();
    this._applySkills();
    this.health = Math.min(this.health, this.max.health);
    this.stamina = Math.min(this.stamina, this.max.stamina);
    this.food = Math.min(this.food, this.max.food);
    this.water = Math.min(this.water, this.max.water);
    this.oxygen = Math.min(this.oxygen, this.max.oxygen);
    events.emit(EV.SKILLS_CHANGED, { key: 'reset' });
    events.emit(EV.ENGRAM_POINTS_CHANGED, { pontos: this.prog.engramPoints });
  }
}
