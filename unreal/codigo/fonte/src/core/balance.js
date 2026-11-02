// =============================================================
// BALANCE – dá acesso aos números do arquivo de balanceamento
// (src/data/config/balanceamento.js) para o resto do jogo.
// =============================================================
import dados from '../data/config/balanceamento.js';

export const BALANCE = dados;

// Converte "uma barra de X pontos que dura N minutos" em
// "quantos pontos cair por segundo".
export function perSecond(maxValue, minutes) {
  return maxValue / (minutes * 60);
}
