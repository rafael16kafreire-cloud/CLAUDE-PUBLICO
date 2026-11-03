// IA de comportamento dos dinos (ARK): temperamentos do selvagem e modos de agressão do domado.
// Funções puras (sem three.js) – testadas em tests/progression.test.mjs.
// Etiquetas: [OK] conferido na wiki do ARK, [CUSTOM] decisão de design (pode ajustar).

// ---- Chave de design: [CUSTOM] ----
// true  = todo herbívoro adulto revida e nunca foge (pedido anterior do jogador).
// false = cada espécie segue o temperamento do ARK (dodô e moschops fogem, etc.).
export const HERBIVOROS_NUNCA_FOGEM = false;

// ---- Números [CUSTOM], em metros / segundos ----
export const IA = Object.freeze({
  VISAO_M: 30, VISAO_AGRESSIVO_M: 40, VISAO_SKITTISH_M: 25, VISAO_OBLIVIOUS_M: 10,
  AUDICAO_M: 50, LEASH_TERRITORIAL_M: 60, TEMPO_SEM_VER_S: 8, PACK_RADIUS_M: 25,
  PERTO_ALIADO_M: 25, MAX_DINOS_ATIVOS: 30,
  IA_HZ_PERTO: 8, IA_HZ_LONGE: 1.5, LONGE_M: 90,
});

// ---- Temperamentos [OK] (https://ark.wiki.gg/wiki/Temperament) ----
export const TEMPER = Object.freeze({
  oblivious: 'oblivious', cowardly: 'cowardly', naive: 'naive', passive: 'passive', skittish: 'skittish',
  evasive: 'evasive', docile: 'docile', loyal: 'loyal', curious: 'curious', neutral: 'neutral',
  defensive: 'defensive', reactive: 'reactive', aggressive: 'aggressive',
  nocturnally_aggressive: 'nocturnally_aggressive', opportunistic: 'opportunistic', patient: 'patient',
  short_tempered: 'short_tempered', territorial: 'territorial', extremely_aggressive: 'extremely_aggressive',
  boss: 'boss', // [CUSTOM] chefes
});

// Perigosos: atacam o jogador por conta própria quando o veem.
const PERIGOSOS = new Set(['aggressive', 'nocturnally_aggressive', 'opportunistic', 'patient', 'short_tempered', 'territorial', 'extremely_aggressive', 'boss']);
export const ehPerigoso = (t) => PERIGOSOS.has(t);

// Temperamento por espécie. [OK] = wiki; [CUSTOM] = a wiki não listou.
export const TEMPER_ESPECIE = Object.freeze({
  dodo: 'oblivious', moschops: 'cowardly', diplodoco: 'naive', lystrosaurus: 'loyal', paquirrinossauro: 'evasive',
  parassauro: 'skittish', galimimo: 'skittish', pterodactilo: 'skittish', quetzalcoatlus: 'skittish',
  triceratops: 'docile', estegossauro: 'docile', anquilossauro: 'docile', mamute: 'docile', braquiossauro: 'docile',
  iguanodonte: 'reactive', dimetrodonte: 'reactive', kentrossauro: 'short_tempered', compsognato: 'curious',
  raptor: 'aggressive', carnotauro: 'aggressive', trex: 'aggressive', mosassauro: 'aggressive',
  giganotossauro: 'extremely_aggressive', barionix: 'territorial', argentavis: 'territorial', sarcosuchus: 'patient',
  // [CUSTOM] a wiki não deu / não conferido:
  paquicefalossauro: 'reactive', sauropelta: 'docile', argentinossauro: 'docile', terizinossauro: 'neutral',
  edmontossauro: 'skittish', paraceraterio: 'docile', titanoboa: 'patient', deinosuchus: 'patient',
  espinossauro: 'aggressive', reidodo: 'aggressive', dilofossauro: 'aggressive', suchomimo: 'aggressive', piranha: 'aggressive',
  chefe_gelo: 'boss', chefe_mar: 'boss', chefe_pantano: 'boss', chefe_vulcao: 'boss',
});
export const temperDe = (id) => TEMPER_ESPECIE[id] ?? 'neutral';

// Decide o estado do SELVAGEM.
// evento: 'sight' (viu o jogador), 'attacked' (levou dano), 'provoked', 'leash' (alvo longe do ponto de origem)
// ctx: { baby, hpFrac, pertoCount (quantos jogadores perto), night, passivoMode, neverFlee, herbivoro, forced }
// Devolve { state: 'idle'|'alert'|'curious'|'chase'|'flee'|'return', aggroLost? }
export function decideReaction(temper, evento, ctx = {}) {
  const R = (state, extra) => ({ state, ...extra });
  if (ctx.forced) return R(evento === 'sight' || evento === 'attacked' ? 'chase' : 'idle'); // forceAggressive
  if (evento === 'leash') return R('return', { aggroLost: true });
  if (evento === 'attacked' || evento === 'provoked') {
    // filhote/juvenil foge de qualquer ameaça (exceto modo de agressão passivo) [OK]
    if (ctx.baby && !ctx.passivoMode) return R('flee');
    if (temper === 'boss') return R('chase');
    const foge = { oblivious: 1, cowardly: 1, passive: 1, skittish: 1 };
    let r;
    if (foge[temper]) r = 'flee';
    else if (temper === 'naive') r = 'curious'; // tenta se aproximar/brincar com o agressor
    else if (temper === 'evasive') r = (ctx.hpFrac ?? 1) < 0.5 ? 'flee' : 'chase'; // foge ou luta
    else if (temper === 'loyal') r = 'flee'; // selvagem age como skittish
    else r = 'chase'; // docile, defensive, neutral, reactive, curious, perigosos
    if (r === 'flee' && ctx.neverFlee && ctx.herbivoro && !ctx.baby && temper !== 'cowardly') r = 'chase';
    return R(r);
  }
  if (evento === 'sight') {
    if (ctx.baby) return R('idle');
    if (temper === 'curious') return R((ctx.pertoCount ?? 1) >= 2 ? 'chase' : 'curious'); // compy: hostil com 2+
    if (temper === 'nocturnally_aggressive') return R(ctx.night ? 'chase' : 'idle');
    if (temper === 'patient') return R('alert'); // espera o momento certo (ver tempoAlerta)
    if (temper === 'short_tempered') return R('alert');
    if (ehPerigoso(temper)) return R('chase');
  }
  return R('idle');
}

// Segundos de "alerta" antes de atacar (patient / short_tempered) [CUSTOM].
export const tempoAlerta = (t) => (t === 'short_tempered' ? 3 : t === 'patient' ? 6 : 0);

// Multiplicador de dano/agressão do nocturnally_aggressive: fraco de dia, forte à noite [CUSTOM].
export const multNoturno = (t, noite) => (t === 'nocturnally_aggressive' ? (noite ? 1.5 : 0.6) : 1);

// ---- Modos de agressão do DOMADO [OK] (https://ark.wiki.gg/wiki/Aggressive) ----
export const MODOS = Object.freeze({
  passive_flee: 'passive_flee', passive: 'passive', neutral: 'neutral', attack_target: 'attack_target', aggressive: 'aggressive',
});
// valor guardado no bicho (português, já usado no menu/save) → modo do ARK
const PT = { passivo_foge: 'passive_flee', passivo: 'passive', neutro: 'neutral', alvo: 'attack_target', agressivo: 'aggressive' };
export const modoDe = (pt) => PT[pt] ?? 'neutral';

// Decide o estado do DOMADO.
// evento: 'self_attacked' (ele apanhou), 'ally_attacked' (aliado/estrutura perto apanhou),
//         'ally_attacking' (aliado perto ataca ctx.alvo), 'enemy_near' (não-aliado perto)
// ctx: { baby, cowardly, alvo }  → { state: 'idle'|'chase'|'flee', alvo? }
export function decideTamed(modo, evento, ctx = {}) {
  const idle = { state: 'idle' };
  if (ctx.baby && modo !== 'passive' && modo !== 'passive_flee') return evento === 'enemy_near' ? idle : { state: 'flee' };
  if (modo === 'passive') return idle; // ignora ataques a ele e a qualquer outra coisa
  if (modo === 'passive_flee') return evento === 'self_attacked' ? { state: 'flee' } : idle;
  if (ctx.cowardly) return evento === 'self_attacked' ? { state: 'flee' } : idle; // moschops nunca revida
  if (evento === 'self_attacked') return { state: 'chase', alvo: ctx.alvo }; // neutral / attack_target / aggressive se defendem
  if (modo === 'neutral') return evento === 'ally_attacked' ? { state: 'chase', alvo: ctx.alvo } : idle;
  if (modo === 'attack_target') {
    if (evento === 'ally_attacked' || evento === 'ally_attacking') return { state: 'chase', alvo: ctx.alvo };
    return idle;
  }
  if (modo === 'aggressive') return evento === 'enemy_near' || evento === 'ally_attacked' || evento === 'ally_attacking' || evento === 'self_attacked' ? { state: 'chase', alvo: ctx.alvo } : idle;
  return idle;
}

// Põe nas espécies: temperamento_ark e revida (= reage atacando quando apanha).
export function aplicarTemperamentos(especies) {
  for (const sp of especies) {
    const t = temperDe(sp.id);
    sp.temperamento_ark = t;
    if (sp.dieta === 'herbivoro' && sp.temperamento !== 'agressivo') {
      sp.revida = decideReaction(t, 'attacked', { neverFlee: HERBIVOROS_NUNCA_FOGEM, herbivoro: true }).state === 'chase';
      if (!sp.revida) sp.temperamento = 'passivo';
    }
  }
}
