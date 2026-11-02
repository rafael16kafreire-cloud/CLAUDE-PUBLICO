// =============================================================
// PROGRESSÃO – TODOS OS NÚMEROS (nível, XP, atributos, engramas, fontes de XP)
// Nada de número escondido no código: para balancear, mude só este arquivo.
// =============================================================

export const DEBUG_MODE = true;          // liga os comandos de teste (/xp N, /level N...); mude para false no jogo final
export const VERSAO_PROGRESSAO = 1;      // versão do formato salvo

// ---------------------------------------------------------------
// 1) NÍVEL E XP
// ---------------------------------------------------------------
export const START_LEVEL = 1;
export const MAX_LEVEL = 100;
export const XP_BASE = 10;               // xp_to_next(N) = round(XP_BASE * N ^ XP_EXPONENT)
export const XP_EXPONENT = 1.8;
// Multiplicador de TODO o XP ganho. Para o ritmo-alvo (nível 10 em ~30 min, 60 em ~35 h, 100 em ~120 h)
// ajuste só este número.
export const XP_GLOBAL_MULT = 1.0;

// Fontes de XP
export const XP_RESOURCE_DEFAULT = 1;
export const XP_RESOURCE = {             // por golpe/colheita, pelo recurso que mais vale na coleta
  graveto: 1, fibra: 1, palha: 1,
  baga_stim: 1, baga_amar: 1, baga_mejo: 1, baga_escura: 1, fruta_rubra: 1, fruta_azul: 1, banana: 1,
  pedra: 2, pedrinha: 2,
  madeira: 3,
  silex: 5,
  minerio_ferro: 8, lingote_metal: 8, obsidiana: 8, cristal: 8, petroleo: 8, perola_silica: 8,
};
export const XP_CRAFT_PER_SECOND = 0.8;  // XP = ceil(tempo de crafting em s * isto)
export const XP_KILL_CLASS_MULT = { pequeno: 2, medio: 4, grande: 8, boss: 100 }; // XP = nível do dino * isto
export const KILL_CLASS_MEDIO_MIN_M = 3; // espécie com comprimento médio abaixo disso = pequena
export const KILL_CLASS_GRANDE_MIN_M = 10; // e a partir disso = grande (entre os dois = média)
export const XP_KILL_BY_TAMED_SHARE = 0.5; // o dino domado matou: o jogador recebe esta parte
export const XP_TAME_PER_LEVEL = 10;     // XP = nível do dino * isto, pago ao concluir a doma
export const XP_FIRST_TIME_BONUS = 25;   // 1ª vez que coleta cada recurso, mata cada espécie, crafta cada item
// Anti-farm: o MESMO recurso coletado mais de ANTI_FARM_MAX vezes em ANTI_FARM_WINDOW_S segundos
// rende só ANTI_FARM_FACTOR do XP até o contador esfriar.
export const ANTI_FARM_MAX = 20;
export const ANTI_FARM_WINDOW_S = 60;
export const ANTI_FARM_FACTOR = 0.5;

// ---------------------------------------------------------------
// 2) PONTOS DE ATRIBUTO
// ---------------------------------------------------------------
export const ATTR_POINTS_PER_LEVEL = 1;
// base + pontos * porPonto. limite = máximo de pontos (null = sem limite).
// chave = nome do atributo; "alias" = nome que a tela atual já usa.
export const ATTRIBUTES = {
  vida:       { alias: 'vida',       base: 100, porPonto: 10, limite: null, unidade: '' },
  stamina:    { alias: 'stamina',    base: 100, porPonto: 10, limite: null, unidade: '' },
  oxigenio:   { alias: 'folego',     base: 100, porPonto: 10, limite: null, unidade: 's' }, // segundos submerso
  comida:     { alias: 'fome',       base: 100, porPonto: 10, limite: null, unidade: '' },
  agua:       { alias: 'sede',       base: 100, porPonto: 10, limite: null, unidade: '' },
  peso:       { alias: 'peso',       base: 200, porPonto: 10, limite: null, unidade: 'kg' },
  dano:       { alias: 'forca',      base: 100, porPonto: 5,  limite: null, unidade: '%' },
  velocidade: { alias: 'velocidade', base: 100, porPonto: 2,  limite: 50,   unidade: '%' }, // 50 pontos = 200%
  // extras que a tela atual já tem
  fortitude:  { alias: 'fortitude',  base: 0,   porPonto: 2,  limite: null, unidade: '°C' },
  criacao:    { alias: 'criacao',    base: 100, porPonto: 10, limite: null, unidade: '%' },
};
export const OXYGEN_DRAIN_PER_SECOND = 1; // oxigênio cai 1 por segundo (valor = segundos de ar)

// ---------------------------------------------------------------
// 3) ENGRAMS
// ---------------------------------------------------------------
export const ENGRAM_POINTS_START = 8;
export const ENGRAM_POINTS_BASE = 3;     // pontos por nível = BASE + floor(nível / DIV)
export const ENGRAM_POINTS_LEVEL_DIV = 25;
export const ENGRAM_TIERS = {
  1: { nome: 'Pedra / Início', custo: [1, 3],   niveis: [1, 14] },
  2: { nome: 'Madeira',         custo: [3, 6],   niveis: [10, 34] },
  3: { nome: 'Metal',           custo: [6, 12],  niveis: [30, 64] },
  4: { nome: 'Eletricidade',    custo: [12, 20], niveis: [60, 100] },
};
export const ENGRAM_POOL_TARGET = 650;   // soma dos custos de todos os engrams (~70% dá para desbloquear)
export const ENGRAM_STATIONS = { mao: 'Mãos', bancada: 'Bancada', forja: 'Forja', pilao: 'Pilão' };

// ---------------------------------------------------------------
// FÓRMULAS (só usam as constantes acima)
// ---------------------------------------------------------------
export function xpToNext(level) {
  if (level >= MAX_LEVEL) return 0;
  return Math.round(XP_BASE * Math.pow(level, XP_EXPONENT));
}
export function engramPointsForLevel(level) {
  return ENGRAM_POINTS_BASE + Math.floor(level / ENGRAM_POINTS_LEVEL_DIV);
}
// XP acumulado para chegar ao nível N (a partir do 1)
export function totalXpToReach(level) {
  let t = 0;
  for (let l = START_LEVEL; l < level; l++) t += xpToNext(l);
  return t;
}
// Pontos de engram ganhos do nível 2 até o N (sem os iniciais)
export function totalEngramPointsUpTo(level) {
  let t = 0;
  for (let l = START_LEVEL + 1; l <= level; l++) t += engramPointsForLevel(l);
  return t;
}
