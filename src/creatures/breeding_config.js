// Ovos e reprodução – tudo na medida do ARK (1x), sem multiplicadores.
// Etiquetas: [OK] conferido (wiki do ARK / GUIA guildorder.com), [PENDENTE] não consegui conferir
// (a wiki ark.wiki.gg não abre nesta sessão), [CUSTOM] decisão de design.
const H = 3600;

export const BREEDING = Object.freeze({
  // Acasalamento
  MATING_BAR_S: 30,                       // [PENDENTE→CUSTOM] a wiki não dá a duração; menor valor plausível
  MATING_RANGE_FOUNDATIONS: 10,           // [OK-GUIA] ~10 fundações (≈ 30 m)
  FEMALE_COOLDOWN_S: Object.freeze([18 * H, 48 * H]), // [OK] só da fêmea; começa ao pôr o ovo / fim da gestação
  TWINS: 0.10, TRIPLETS: 0.02,            // [OK]
  // Herança / mutação [OK-GUIA]
  INHERIT_BEST: 0.55,
  MUTATION_ROLLS: 3, MUTATION_CHANCE: 0.025, MUTATION_SIDE_CAP: 20, MUTATION_POINTS: 2,
  // Ovo
  EGG_HEALTH_LOSS_S: 3600,                // [PENDENTE→CUSTOM] a wiki não dá a taxa: 1 h fora da faixa = ovo destruído
  // Estágios (% de maturação) [OK]
  STAGES: Object.freeze({ baby: 0.10, juvenile: 0.50, adolescent: 1.0 }),
  // Impressão [OK]
  IMPRINT_INTERVAL_S: 8 * H, IMPRINT_WINDOW_S: 4 * H,
  IMPRINT_STAT_BONUS: 0.20, IMPRINT_RIDER_BONUS: 0.30,
  // Comida do bebê [OK]: comida/s = R × (1 − maturação); R do Rex ≈ 1,16
  BABY_R_DEFAULT: 1.16,
  BABY_FOOD_VALUE: Object.freeze({
    racao_preferida: 80, racao_carne_seca: 90, racao: 60, carne_crua: 50, carne_prime: 50, carne_prime_cozida: 50,
    jerky_prime: 50, plantacao: 40, baga_mejo: 30, carne_cozida: 25, jerky: 25, peixe_cru: 25, baga: 20, peixe_cozido: 12,
  }),
});

// Dados por espécie. Só o Rex está conferido; as outras usam os valores do Rex como substituto [PENDENTE].
const REX = Object.freeze({ tipo: 'ovo', hatchS: 4 * H + 59 * 60, matureS: 92 * H + 35 * 60, temp: Object.freeze([32, 34]), R: 1.16, conferido: true });
export const CRIA_ESPECIE = Object.freeze({ trex: REX });
export const MAMIFEROS = Object.freeze(['mamute']);
export const criaDe = (id) => CRIA_ESPECIE[id] ?? Object.freeze({ ...REX, tipo: MAMIFEROS.includes(id) ? 'gestacao' : 'ovo', conferido: false });

// Estéreis: rei-dodô [OK]; chefes [OK]; (titanoboa NÃO: decisão do dono, ver ASEXUADA); piranha e mosassauro [PENDENTE→CUSTOM: aquáticos]
export const ESTERIL = Object.freeze(new Set(['reidodo', 'piranha', 'mosassauro', 'chefe_gelo', 'chefe_mar', 'chefe_pantano', 'chefe_vulcao']));

// Titanoboa [OK, página da espécie; reproduzir é decisão do dono]: não tem sexo, bota ovo sozinha,
// sem barra de acasalamento e sem herança de parceiro (o ovo sai com os atributos da própria mãe; mutações valem).
export const ASEXUADA = Object.freeze(new Set(['titanoboa']));
// Ovos no chão ao mesmo tempo: 6 na maioria das espécies, 8 na titanoboa [OK]
export const EGG_LIMIT_DEFAULT = 6;
export const EGG_LIMIT = Object.freeze({ titanoboa: 8 });
export const eggLimit = (id) => EGG_LIMIT[id] ?? EGG_LIMIT_DEFAULT;
// Cooldown entre ovos, incubação, maturação, temperatura e comida do bebê da titanoboa: [PENDENTE]
// (a página não traz) → [CUSTOM] usa os mesmos valores do Rex e o cooldown de 18–48 h.
