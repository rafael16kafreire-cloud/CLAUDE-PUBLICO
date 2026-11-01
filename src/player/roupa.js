// =============================================================
// CORES DA ROUPA do personagem low-poly (e do braço em 1ª pessoa).
// Arquivo separado para os dois modelos usarem sem um importar o outro.
// =============================================================
import { PALETA, mistura } from '../core/paleta.js';

// >>> CORES DO PERSONAGEM (paleta): mude aqui para trocar a roupa
export const ROUPA = {
  pele: () => mistura('areia', 'solLaranja', 0.22),
  tunica: () => PALETA.madeira.clone(),
  calca: () => mistura('terraEscura', 'marrom', 0.35),
  bota: () => PALETA.terraEscura.clone(),
  cabelo: () => mistura('marrom', 'terraEscura', 0.35),
  pelo: () => mistura('capimSeco', 'marrom', 0.35), // capa de pele nos ombros
  cinto: () => PALETA.terraEscura.clone(),
};
