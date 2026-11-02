// =============================================================
// ENGRAMS: desbloqueio e checagem.
// Um engram por receita (id = id da receita). Regras de desbloqueio: nível >= nivel_requerido,
// pontos suficientes e todos os pré-requisitos já desbloqueados. Desbloquear é instantâneo,
// permanente e sem devolução. A tela de crafting só pergunta can_craft(id) (canCraft).
// Sinais (via events): ENGRAM_UNLOCKED { id }, ENGRAM_POINTS_CHANGED { pontos } (do PlayerProgression)
// =============================================================
import { events, EV } from '../core/event_bus.js';
import { ENGRAMS } from './engram_database.js';
import { ENGRAM_POINTS_START, totalEngramPointsUpTo } from './progression_config.js';

export const ENGRAM_BY_ID = Object.fromEntries(ENGRAMS.map((e) => [e.id, e]));

export class EngramManager {
  constructor(progression) {
    this.prog = progression;
    this.unlocked = new Set();
  }

  get(id) {
    return ENGRAM_BY_ID[id] ?? null;
  }

  list() {
    return ENGRAMS;
  }

  isUnlocked(id) {
    return this.unlocked.has(id);
  }

  // Pode craftar esta receita? (receita sem engram no banco = livre)
  canCraft(id) {
    return !ENGRAM_BY_ID[id] || this.unlocked.has(id);
  }

  // Motivo de não dar para desbloquear (ou null se dá)
  unlockBlock(id) {
    const e = ENGRAM_BY_ID[id];
    if (!e) return 'engram desconhecido';
    if (this.unlocked.has(id)) return 'já sabe';
    if (this.prog.level < e.nivel_requerido) return `precisa do nível ${e.nivel_requerido}`;
    for (const p of e.pre_requisitos) {
      if (!this.unlocked.has(p)) return `precisa antes de: ${ENGRAM_BY_ID[p]?.nome ?? p}`;
    }
    if (this.prog.engramPoints < e.custo_pontos) return `faltam ${e.custo_pontos - this.prog.engramPoints} pontos`;
    return null;
  }

  canUnlock(id) {
    return this.unlockBlock(id) === null;
  }

  unlock(id) {
    if (this.unlockBlock(id)) return false;
    this.prog.spendEngramPoints(ENGRAM_BY_ID[id].custo_pontos);
    this.unlocked.add(id);
    events.emit(EV.ENGRAM_UNLOCKED, { id });
    return true;
  }

  // Quantos pontos já foram gastos em engrams
  spentPoints() {
    let t = 0;
    for (const id of this.unlocked) t += ENGRAM_BY_ID[id]?.custo_pontos ?? 0;
    return t;
  }

  // Debug: desbloqueia tudo (de graça)
  unlockAll() {
    for (const e of ENGRAMS) {
      if (!this.unlocked.has(e.id)) {
        this.unlocked.add(e.id);
        events.emit(EV.ENGRAM_UNLOCKED, { id: e.id });
      }
    }
  }

  resetAll() {
    this.unlocked = new Set();
  }

  toJSON() {
    return [...this.unlocked];
  }

  fromJSON(ids) {
    this.unlocked = new Set((ids ?? []).filter((id) => ENGRAM_BY_ID[id]));
  }

  // Save antigo: os engramas aprendidos eram ids de receita (ou de grupo, como construcao_palha).
  // Mantém o que existir e devolve o que não bate (os pontos são refeitos pelo PlayerProgression).
  migrateLegacy(oldLearned) {
    const grupos = {
      construcao_palha: ['piso_palha', 'parede_palha', 'porta_palha', 'teto_palha'],
      construcao_madeira: ['pilar', 'janela', 'telhado', 'cerca'],
      construcao_pedra: ['piso_pedra', 'parede_pedra', 'porta_pedra', 'teto_pedra', 'rampa_pedra', 'pilar_pedra', 'janela_pedra', 'telhado_pedra', 'cerca_pedra'],
      construcao_metal: ['piso_metal', 'parede_metal', 'porta_metal', 'teto_metal', 'rampa_metal', 'pilar_metal', 'janela_metal', 'telhado_metal', 'cerca_metal'],
    };
    this.unlocked = new Set();
    for (const id of oldLearned ?? []) {
      for (const x of grupos[id] ?? [id]) if (ENGRAM_BY_ID[x]) this.unlocked.add(x);
    }
    // não cobra de novo: os pontos livres = total ganho - o que as receitas mantidas custam (mínimo 0)
    this.prog.engramPoints = Math.max(0, ENGRAM_POINTS_START + totalEngramPointsUpTo(this.prog.level) - this.spentPoints());
  }
}
