// =============================================================
// JOGO SALVO – guarda o progresso no aparelho (localStorage)
// O que vai: jogador (posição, barras, nível, habilidades), mochila,
// hora/dia, construções e bichos domados. Salva sozinho a cada
// 30 s, ao pausar e ao sair/minimizar o jogo.
// =============================================================
const KEY = 'ilha-primordial:jogo';
const VERSION = 1;

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

export function saveGame(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...data, version: VERSION, savedAt: Date.now() }));
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
