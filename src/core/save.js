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
export const SLOTS = [1, 2, 3];
const slotKey = (n) => `${KEY}:espaco${n}`;

export function saveSlot(n, data) {
  try {
    const meta = {
      savedAt: Date.now(),
      level: data.player?.level ?? 1,
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
