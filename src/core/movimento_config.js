// =============================================================
// MOVIMENTO, STAMINA E VELOCIDADE – constantes (velocidades de cada bicho: data/creatures/criaturas.json)
// =============================================================

// Stamina
export const STAMINA_BASE = 100;              // stamina de um bicho de nível 1
export const STAMINA_PER_LEVEL = 0.05;        // +5% da base por nível acima do 1 (bichos)
export const STAMINA_REGEN_DELAY = 1.5;       // segundos parado/sem esforço antes de começar a recuperar
export const STAMINA_REGEN_PCT_PER_SEC = 0.08;// recupera 8% do máximo por segundo
export const SPRINT_SECONDS_DEFAULT = 12;     // sprint_s de quem não tem o campo na espécie

// Domado: bônus de velocidade por nível de bônus (níveis ganhos ao domar), com teto
export const TAMED_SPEED_PER_BONUS_LEVEL = 0.005;
export const TAMED_SPEED_BONUS_CAP = 0.5;

// Gasto de stamina por ataque, pela classe de tamanho do bicho
export const ATTACK_STAMINA = { pequeno: 6, medio: 12, grande: 20, gigante: 30 };
// classe pelo comprimento médio (m): abaixo de cada limite é aquela classe; acima do último = gigante
export const SIZE_CLASS_MAX_M = { pequeno: 3, medio: 8, grande: 15 };

// Carga acima do máximo: a velocidade vira esta fração
export const OVERWEIGHT_SPEED_MULT = 0.5;

// Jogador
export const PLAYER_WALK = 4.0;               // m/s
export const PLAYER_RUN = 7.0;
export const PLAYER_SPRINT_S = 12;            // segundos de sprint com a stamina do nível 1
export const PLAYER_SWIM = 3.0;

export function sizeClass(species) {
  if (species.chefe) return 'gigante';
  const c = species.comprimento_m;
  const m = Array.isArray(c) ? (c[0] + c[1]) / 2 : (species.envergadura_m ? (species.envergadura_m[0] + species.envergadura_m[1]) / 4 : 3);
  if (m < SIZE_CLASS_MAX_M.pequeno) return 'pequeno';
  if (m < SIZE_CLASS_MAX_M.medio) return 'medio';
  if (m < SIZE_CLASS_MAX_M.grande) return 'grande';
  return 'gigante';
}
