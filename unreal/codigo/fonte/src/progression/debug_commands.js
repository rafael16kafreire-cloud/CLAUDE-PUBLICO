// =============================================================
// COMANDOS DE TESTE (ligados por DEBUG_MODE em progression_config.js)
//   /xp N        dá N de XP (passa pelo XP_GLOBAL_MULT)
//   /level N     vai direto para o nível N (refaz os pontos livres)
//   /resetprog   volta toda a progressão ao começo
//   /unlockall   desbloqueia todos os engrams
//   /points N    dá N pontos de atributo e N pontos de engram
// No navegador: ilhaCmd('/xp 500')   (também: ilhaCmd('/level 30'))
// =============================================================
import { DEBUG_MODE, MAX_LEVEL, START_LEVEL, ATTR_POINTS_PER_LEVEL, ENGRAM_POINTS_START, totalEngramPointsUpTo } from './progression_config.js';
import { events, EV } from '../core/event_bus.js';

export function setLevel(stats, n) {
  const p = stats.prog;
  p.level = Math.min(MAX_LEVEL, Math.max(START_LEVEL, n | 0));
  p.xp = 0;
  p.attrPoints = Math.max(0, (p.level - START_LEVEL) * ATTR_POINTS_PER_LEVEL - p.totalSpent());
  p.engramPoints = Math.max(0, ENGRAM_POINTS_START + totalEngramPointsUpTo(p.level) - stats.engrams.spentPoints());
  events.emit(EV.ENGRAM_POINTS_CHANGED, { pontos: p.engramPoints });
  events.emit(EV.SKILLS_CHANGED, { key: 'nivel' });
}

export function runDebugCommand(texto, stats) {
  if (!DEBUG_MODE) return 'debug desligado';
  const [cmd, arg] = String(texto).trim().split(/\s+/);
  const n = Number(arg);
  switch (cmd) {
    case '/xp': stats.prog.addXp(n, 'debug'); return `XP +${n}`;
    case '/level': setLevel(stats, n); return `nível ${stats.level}`;
    case '/resetprog': stats.resetProgression(); return 'progressão zerada';
    case '/unlockall': stats.engrams.unlockAll(); events.emit(EV.SKILLS_CHANGED, { key: 'engrama' }); return 'todos os engrams desbloqueados';
    case '/points':
      stats.prog.attrPoints += n;
      stats.prog.addEngramPoints(n);
      events.emit(EV.SKILLS_CHANGED, { key: 'pontos' });
      return `+${n} pontos de atributo e de engram`;
    default: return 'comandos: /xp N, /level N, /resetprog, /unlockall, /points N';
  }
}
