// =============================================================
// JOGO SALVO – guarda o progresso no aparelho (localStorage)
// O que vai: jogador (posição, barras, nível, habilidades), mochila,
// hora/dia, construções e bichos domados. Salva sozinho a cada
// 30 s, ao pausar e ao sair/minimizar o jogo.
// =============================================================
const KEY = 'ilha-primordial:jogo';
// 2 = mapa da Finlândia (saves do mapa redondo não servem mais)
const VERSION = 2;

export function loadGame() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    return d && d.version === VERSION && d.player ? d : null;
  } catch {
    return null;
  }
}

let lastWritten = null;

export function saveGame(data) {
  try {
    // só grava se mudou algo desde a última vez (escrever igual à toa,
    // várias vezes seguidas, já fez navegador perder o salvo)
    const body = JSON.stringify({ ...data, version: VERSION });
    if (body === lastWritten) return true;
    localStorage.setItem(KEY, body);
    lastWritten = body;
    // jogando de um espaço escolhido na tela de Jogos salvos: o progresso também vai para ele
    const ativo = getActiveSlot();
    if (ativo) saveSlot(ativo, data);
    return true;
  } catch {
    return false; // sem espaço / modo privado: segue sem salvar
  }
}

export function hasSave() {
  return !!loadGame();
}

export function clearSave() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ok */
  }
}

// ---------------------------------------------------------
// Espaços de salvar (3): o jogador escolhe onde guardar e de qual
// carregar (menu de pausa e tela inicial). O salvo automático
// continua no espaço principal ("Continuar").
// ---------------------------------------------------------
export const SLOTS = [1, 2, 3, 4, 5];
const slotKey = (n) => `${KEY}:espaco${n}`;

export function saveSlot(n, data) {
  try {
    const meta = {
      savedAt: Date.now(),
      level: data.player?.stats?.level ?? data.player?.level ?? 1,
      day: data.world?.day ?? 1,
      tamed: data.tamed?.length ?? 0,
    };
    localStorage.setItem(slotKey(n), JSON.stringify({ ...data, version: VERSION, meta }));
    return true;
  } catch {
    return false;
  }
}

// Resumo de cada espaço (null = vazio)
export function listSlots() {
  return SLOTS.map((n) => {
    try {
      const raw = localStorage.getItem(slotKey(n));
      if (!raw) return { n, empty: true };
      const d = JSON.parse(raw);
      return d.version === VERSION ? { n, ...d.meta } : { n, empty: true };
    } catch {
      return { n, empty: true };
    }
  });
}

// Copia o espaço para o salvo principal (o jogo carrega dele ao abrir).
export function useSlot(n) {
  try {
    const raw = localStorage.getItem(slotKey(n));
    if (!raw) return false;
    localStorage.setItem(KEY, raw);
    lastWritten = raw;
    return true;
  } catch {
    return false;
  }
}

export function slotLabel(m) {
  if (!m || m.empty) return `Espaço ${m?.n ?? ''}: vazio`;
  const d = new Date(m.savedAt);
  const when = `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  return `Espaço ${m.n}: Nível ${m.level} · Dia ${m.day}${m.tamed ? ` · ${m.tamed} domado(s)` : ''} · ${when}`;
}

// ---------------------------------------------------------
// Tela de Jogos salvos: espaço em uso, apagar, novo jogo, resetar nível
// ---------------------------------------------------------
const ACTIVE = 'ilha-primordial:espaco-ativo';

export function getActiveSlot() {
  try {
    const n = Number(localStorage.getItem(ACTIVE));
    return SLOTS.includes(n) ? n : 0;
  } catch {
    return 0;
  }
}

export function setActiveSlot(n) {
  try {
    if (n) localStorage.setItem(ACTIVE, String(n));
    else localStorage.removeItem(ACTIVE);
  } catch { /* ok */ }
}

export function deleteSlot(n) {
  try {
    localStorage.removeItem(slotKey(n));
    if (getActiveSlot() === n) setActiveSlot(0);
  } catch { /* ok */ }
}

// Resumo do salvo automático (o que "Continuar" abre)
export function mainSummary() {
  const d = loadGame();
  if (!d) return null;
  return { level: d.player?.stats?.level ?? d.player?.level ?? 1, day: d.world?.day ?? 1, tamed: d.tamed?.length ?? 0 };
}

// Volta o nível para 1: sem XP, sem pontos de habilidade nem de engrama, sem engramas aprendidos
// (a posição, a mochila, a base e os bichos domados ficam como estão).
function resetPlayerLevel(d) {
  const st = d?.player?.stats;
  if (!st) return false;
  st.level = 1;
  st.xp = 0;
  st.points = 0;
  st.engramPoints = 0;
  st.learned = [];
  for (const k of Object.keys(st.skills ?? {})) st.skills[k] = 0;
  st.health = 100;
  return true;
}

export function resetLevelSlot(n) {
  try {
    const raw = localStorage.getItem(slotKey(n));
    if (!raw) return false;
    const d = JSON.parse(raw);
    if (!resetPlayerLevel(d)) return false;
    d.meta = { ...(d.meta ?? {}), level: 1 };
    localStorage.setItem(slotKey(n), JSON.stringify(d));
    if (getActiveSlot() === n) resetLevelMain(); // é o que está em uso: o salvo principal também
    return true;
  } catch {
    return false;
  }
}

export function resetLevelMain() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return false;
    const d = JSON.parse(raw);
    if (!resetPlayerLevel(d)) return false;
    const body = JSON.stringify(d);
    localStorage.setItem(KEY, body);
    lastWritten = body;
    const ativo = getActiveSlot();
    if (ativo) {
      const r2 = localStorage.getItem(slotKey(ativo));
      if (r2) {
        const d2 = JSON.parse(r2);
        resetPlayerLevel(d2);
        d2.meta = { ...(d2.meta ?? {}), level: 1 };
        localStorage.setItem(slotKey(ativo), JSON.stringify(d2));
      }
    }
    return true;
  } catch {
    return false;
  }
}

// Novo jogo num espaço: o salvo principal é apagado e o espaço passa a ser o ativo.
export function newGameInSlot(n) {
  clearSave();
  setActiveSlot(n);
  lastWritten = null;
}
