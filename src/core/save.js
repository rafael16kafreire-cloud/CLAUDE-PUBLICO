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
