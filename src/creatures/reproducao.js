// Funções puras da reprodução (sem three.js) – testadas em tests/progression.test.mjs.
import { BREEDING as B, ESTERIL, criaDe } from './breeding_config.js';

export const podeReproduzir = (id) => !ESTERIL.has(id);

// Estágio por maturação (0..1)
export function stageFromMaturation(p) {
  if (p >= 1) return 'adult';
  if (p < B.STAGES.baby) return 'baby';
  if (p < B.STAGES.juvenile) return 'juvenile';
  return 'adolescent';
}

export const babyFoodPerSec = (R, mat) => R * (1 - mat);

// Cooldown da fêmea em segundos (macho nunca tem)
export function cooldownSeconds(sex, rng) {
  if (sex !== 'Fêmea') return 0;
  const [a, b] = B.FEMALE_COOLDOWN_S;
  return a + rng() * (b - a);
}

// a e b: { id, sex, variante?, montado, sobrecarregado, castrado, cooldownAte (ms), seguir, acasalar }
export function canMate(a, b, agora = Date.now()) {
  if (!a || !b || a.id !== b.id || a.sex === b.sex) return false;
  if (!podeReproduzir(a.id)) return false;
  if ((a.variante ?? '') !== (b.variante ?? '')) return false;
  for (const c of [a, b]) {
    if (c.montado || c.sobrecarregado || c.castrado || c.seguir) return false;
    if (c.acasalar === false) return false;
    if (c.sex === 'Fêmea' && (c.cooldownAte ?? 0) > agora) return false;
  }
  return true;
}

// Cada atributo sorteado independentemente: 55% do maior, 45% do menor
export function inheritStats(a, b, rng) {
  const out = {};
  for (const k of Object.keys(a)) {
    const hi = Math.max(a[k], b[k]);
    const lo = Math.min(a[k], b[k]);
    out[k] = rng() < B.INHERIT_BEST ? hi : lo;
  }
  return out;
}

// 3 sorteios de 2,5%. Só se mãe (lado materno) e pai (lado paterno) tiverem < 20.
// Devolve { materna, paterna, total, pontos: [chaves] } (cada mutação cai num lado ao acaso e num atributo ao acaso)
export function rollMutations(momMaterna, dadPaterna, keys, rng) {
  const r = { materna: 0, paterna: 0, total: 0, atributos: [] };
  if (momMaterna >= B.MUTATION_SIDE_CAP || dadPaterna >= B.MUTATION_SIDE_CAP) return r;
  for (let i = 0; i < B.MUTATION_ROLLS; i++) {
    if (rng() >= B.MUTATION_CHANCE) continue;
    if (rng() < 0.5) { if (momMaterna + r.materna >= B.MUTATION_SIDE_CAP) continue; r.materna++; }
    else { if (dadPaterna + r.paterna >= B.MUTATION_SIDE_CAP) continue; r.paterna++; }
    r.total++;
    r.atributos.push(keys[Math.floor(rng() * keys.length)]);
  }
  return r;
}

// 1, 2 (gêmeos 10%) ou 3 (trigêmeos 2%)
export function litterSize(rng) {
  const r = rng();
  return r < B.TRIPLETS ? 3 : r < B.TRIPLETS + B.TWINS ? 2 : 1;
}

// Imprint: pedidos totais = maturação / 8 h; cada interação soma 100 / pedidos (em % → aqui 0..1)
export const imprintRequests = (matureS) => Math.max(1, matureS / B.IMPRINT_INTERVAL_S);
export const imprintGain = (matureS) => 1 / imprintRequests(matureS);

// Ovo: avança conforme a temperatura. Devolve o novo estado { progress 0..1, health 0..1, destroyed }
export function eggStep(egg, dt, tempC, especieId, inInventory = false) {
  if (inInventory) return { ...egg }; // inventário/baú: incubação pausa, saúde estável
  const c = criaDe(especieId);
  const dentro = tempC >= c.temp[0] && tempC <= c.temp[1];
  if (dentro) return { progress: Math.min(1, egg.progress + dt / c.hatchS), health: egg.health, destroyed: false };
  const health = Math.max(0, egg.health - dt / B.EGG_HEALTH_LOSS_S);
  return { progress: egg.progress, health, destroyed: health <= 0 };
}
