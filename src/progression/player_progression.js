// =============================================================
// PROGRESSÃO DO JOGADOR: nível, XP, pontos de atributo, atributos (get_stat) e as fontes de XP.
// Todos os números vêm de progression_config.js. Sinais (via events):
//   XP_GAINED { amount, source }   LEVEL_UP { level }   ATTRIBUTE_CHANGED { nome, valor, gastos }
//   ENGRAM_POINTS_CHANGED { pontos }
// A tela atual só precisa chamar as funções públicas abaixo e ouvir esses sinais.
// =============================================================
import { events, EV } from '../core/event_bus.js';
import * as C from './progression_config.js';

// nome do atributo (do config ou o apelido que a tela usa) -> chave guardada (apelido da tela)
const KEY = {};
for (const [nome, a] of Object.entries(C.ATTRIBUTES)) {
  KEY[nome] = a.alias;
  KEY[a.alias] = a.alias;
}
const DEF = {};
for (const [nome, a] of Object.entries(C.ATTRIBUTES)) DEF[a.alias] = { nome, ...a };

export const ATTRIBUTE_KEYS = Object.keys(DEF);

// Classe de tamanho do bicho (pequeno/médio/grande/boss) para o XP de abate
export function killClass(species) {
  if (species.chefe) return 'boss';
  const c = species.comprimento_m;
  const m = Array.isArray(c) ? (c[0] + c[1]) / 2 : (species.envergadura_m ? (species.envergadura_m[0] + species.envergadura_m[1]) / 2 / 2 : 3);
  if (m < C.KILL_CLASS_MEDIO_MIN_M) return 'pequeno';
  if (m < C.KILL_CLASS_GRANDE_MIN_M) return 'medio';
  return 'grande';
}

export class PlayerProgression {
  constructor() {
    this.resetAll();
  }

  resetAll() {
    this.level = C.START_LEVEL;
    this.xp = 0;                       // XP dentro do nível atual
    this.attrPoints = 0;               // pontos de atributo livres
    this.engramPoints = C.ENGRAM_POINTS_START;
    this.spent = Object.fromEntries(ATTRIBUTE_KEYS.map((k) => [k, 0]));
    this.discoveries = new Set();      // "coleta:id", "abate:especie", "craft:id" (bônus de 1ª vez)
    this._farm = {};                   // anti-farm: id do recurso -> horários das últimas coletas
    this.respecT = 0;                  // beber a poção de reset (s restantes)
    this.lastCombatT = -1e9;           // horário (s) do último dano dado/recebido
  }

  // ---------------- nível e XP ----------------
  xpToNext(level = this.level) {
    return C.xpToNext(level);
  }

  // Dá XP. Devolve quanto foi de fato (0 no nível máximo). Sobe vários níveis de uma vez, com um sinal só.
  addXp(amount, source = '?') {
    if (!(amount > 0) || this.level >= C.MAX_LEVEL) return 0;
    amount *= C.XP_GLOBAL_MULT;
    this.xp += amount;
    events.emit(EV.XP_GAINED, { amount, source });
    const from = this.level;
    while (this.level < C.MAX_LEVEL && this.xp >= this.xpToNext()) {
      this.xp -= this.xpToNext();
      this.level += 1;
      this.attrPoints += C.ATTR_POINTS_PER_LEVEL;
      this.addEngramPoints(C.engramPointsForLevel(this.level), true);
    }
    if (this.level >= C.MAX_LEVEL) this.xp = 0; // sem acumular depois do máximo
    if (this.level > from) this._emitLevelUp(from);
    return amount;
  }

  _emitLevelUp(from) {
    const levels = this.level - from;
    let ep = 0;
    for (let l = from + 1; l <= this.level; l++) ep += C.engramPointsForLevel(l);
    events.emit(EV.ENGRAM_POINTS_CHANGED, { pontos: this.engramPoints });
    events.emit(EV.LEVEL_UP, {
      level: this.level, from, levels,
      points: levels * C.ATTR_POINTS_PER_LEVEL, engramPoints: ep,
    });
  }

  addEngramPoints(n, quiet = false) {
    this.engramPoints += n;
    if (!quiet) events.emit(EV.ENGRAM_POINTS_CHANGED, { pontos: this.engramPoints });
  }

  spendEngramPoints(n) {
    if (this.engramPoints < n) return false;
    this.engramPoints -= n;
    events.emit(EV.ENGRAM_POINTS_CHANGED, { pontos: this.engramPoints });
    return true;
  }

  // ---------------- atributos ----------------
  // Valor final = base + pontos * por_ponto. TODO outro sistema usa isto (nunca a constante base).
  getStat(nome) {
    const k = KEY[nome];
    if (!k) return 0;
    const d = DEF[k];
    return d.base + this.spent[k] * d.porPonto;
  }

  pointsSpent(nome) {
    return this.spent[KEY[nome]] ?? 0;
  }

  totalSpent() {
    return ATTRIBUTE_KEYS.reduce((a, k) => a + this.spent[k], 0);
  }

  // Motivo de não dar para gastar (ou null)
  spendBlock(nome) {
    const k = KEY[nome];
    if (!k) return 'atributo desconhecido';
    if (this.attrPoints <= 0) return 'sem pontos';
    const lim = DEF[k].limite;
    if (lim != null && this.spent[k] >= lim) return 'limite de pontos';
    return null;
  }

  // Gasta 1 ponto, na hora e sem animação.
  spendPoint(nome) {
    if (this.spendBlock(nome)) return false;
    const k = KEY[nome];
    this.attrPoints -= 1;
    this.spent[k] += 1;
    events.emit(EV.ATTRIBUTE_CHANGED, { nome: DEF[k].nome, valor: this.getStat(k), gastos: this.spent[k] });
    return true;
  }

  // Poção de reset: devolve todos os pontos gastos.
  respec() {
    const total = this.totalSpent();
    for (const k of ATTRIBUTE_KEYS) {
      if (!this.spent[k]) continue;
      this.spent[k] = 0;
      events.emit(EV.ATTRIBUTE_CHANGED, { nome: DEF[k].nome, valor: this.getStat(k), gastos: 0 });
    }
    this.attrPoints += total;
    return total;
  }

  // ---------------- combate (a poção só vale fora dele) ----------------
  markCombat() {
    this.lastCombatT = performance.now() / 1000;
  }
  inCombat(cooldown) {
    return performance.now() / 1000 - this.lastCombatT < cooldown;
  }

  // ---------------- fontes de XP ----------------
  _firstTime(chave) {
    if (this.discoveries.has(chave)) return 0;
    this.discoveries.add(chave);
    return C.XP_FIRST_TIME_BONUS;
  }

  // Coleta: ids dos recursos que vieram do golpe/colheita. Vale o que rende mais XP; o bônus de 1ª vez
  // vale para cada tipo novo.
  gainFromResource(ids) {
    if (!ids?.length) return 0;
    const now = performance.now() / 1000;
    let best = 0;
    let bestId = ids[0];
    let bonus = 0;
    for (const id of ids) {
      const x = C.XP_RESOURCE[id] ?? C.XP_RESOURCE_DEFAULT;
      if (x > best) { best = x; bestId = id; }
      bonus += this._firstTime(`coleta:${id}`);
    }
    // anti-farm no recurso principal
    const lista = (this._farm[bestId] ??= []).filter((t) => now - t < C.ANTI_FARM_WINDOW_S);
    lista.push(now);
    this._farm[bestId] = lista;
    if (lista.length > C.ANTI_FARM_MAX) best *= C.ANTI_FARM_FACTOR;
    return this.addXp(best + bonus, 'coleta');
  }

  gainFromCraft(recipe) {
    const base = Math.ceil((recipe.tempo ?? 1) * C.XP_CRAFT_PER_SECOND);
    return this.addXp(base + this._firstTime(`craft:${recipe.resultado ?? recipe.id}`), 'craft');
  }

  // porDomado = true: um bicho domado do jogador matou (o jogador recebe só uma parte)
  gainFromKill(creature, porDomado = false) {
    const mult = C.XP_KILL_CLASS_MULT[killClass(creature.species)];
    let xp = creature.level * mult * (porDomado ? C.XP_KILL_BY_TAMED_SHARE : 1);
    xp += this._firstTime(`abate:${creature.species.id}`);
    return this.addXp(xp, porDomado ? 'abate_domado' : 'abate');
  }

  gainFromTame(creature) {
    return this.addXp(creature.level * C.XP_TAME_PER_LEVEL, 'doma');
  }

  // XP que um abate renderia (sem dar), para mostrar na mensagem
  killXpPreview(creature, porDomado = false) {
    const mult = C.XP_KILL_CLASS_MULT[killClass(creature.species)];
    return creature.level * mult * (porDomado ? C.XP_KILL_BY_TAMED_SHARE : 1) * C.XP_GLOBAL_MULT;
  }

  // ---------------- save / load ----------------
  toJSON() {
    return {
      versao_progressao: C.VERSAO_PROGRESSAO,
      nivel: this.level,
      xp_atual: this.xp,
      pontos_atributo_livres: this.attrPoints,
      pontos_engram_livres: this.engramPoints,
      pontos_gastos: { ...this.spent },
      descobertas: [...this.discoveries],
    };
  }

  // Carrega o formato novo. Devolve false se o dado não for do formato novo (save antigo): quem chama migra.
  fromJSON(d) {
    if (!d || d.versao_progressao == null) return false;
    this.level = Math.min(C.MAX_LEVEL, Math.max(C.START_LEVEL, d.nivel | 0 || C.START_LEVEL));
    this.xp = this.level >= C.MAX_LEVEL ? 0 : Math.max(0, +d.xp_atual || 0);
    this.attrPoints = Math.max(0, d.pontos_atributo_livres | 0);
    this.engramPoints = Math.max(0, d.pontos_engram_livres | 0);
    for (const k of ATTRIBUTE_KEYS) {
      let n = Math.max(0, (d.pontos_gastos?.[k] ?? 0) | 0);
      const lim = DEF[k].limite;
      if (lim != null) n = Math.min(n, lim);
      this.spent[k] = n;
    }
    this.discoveries = new Set(Array.isArray(d.descobertas) ? d.descobertas : []);
    return true;
  }

  // Save antigo (antes da progressão nova): mantém nível e pontos gastos; zera o XP do nível (a tabela mudou)
  // e refaz os pontos livres a partir do nível. Os engrams são tratados pelo EngramManager.
  migrateLegacy(old) {
    this.resetAll();
    this.level = Math.min(C.MAX_LEVEL, Math.max(C.START_LEVEL, old.level | 0 || C.START_LEVEL));
    for (const k of ATTRIBUTE_KEYS) {
      let n = Math.max(0, (old.skills?.[k] ?? 0) | 0);
      const lim = DEF[k].limite;
      if (lim != null) n = Math.min(n, lim);
      this.spent[k] = n;
    }
    this.attrPoints = Math.max(0, (this.level - C.START_LEVEL) * C.ATTR_POINTS_PER_LEVEL - this.totalSpent());
    this.engramPoints = C.ENGRAM_POINTS_START + C.totalEngramPointsUpTo(this.level);
  }
}
