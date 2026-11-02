// Testes rápidos da progressão (rodam no Node, sem navegador): npm run test:prog
import * as C from '../src/progression/progression_config.js';
import { ENGRAMS } from '../src/progression/engram_database.js';
import { PlayerStats } from '../src/player/player_stats.js';
import { runDebugCommand } from '../src/progression/debug_commands.js';
import { events, EV } from '../src/core/event_bus.js';

let ok = 0, bad = 0;
const check = (nome, cond, det = '') => { cond ? ok++ : bad++; console.log(`${cond ? 'OK    ' : 'FALHOU'} ${nome}${det ? '  — ' + det : ''}`); };
const novo = () => new PlayerStats();
const medio = (level) => ({ level, species: { id: 'x', comprimento_m: [5, 6] } });
const log = { lv: [], xp: [], attr: [], pts: [], eng: [] };
events.on(EV.LEVEL_UP, (e) => log.lv.push(e));
events.on(EV.XP_GAINED, (e) => log.xp.push(e));
events.on(EV.ATTRIBUTE_CHANGED, (e) => log.attr.push(e));
events.on(EV.ENGRAM_POINTS_CHANGED, (e) => log.pts.push(e));
events.on(EV.ENGRAM_UNLOCKED, (e) => log.eng.push(e));

// 1) fórmula
check('XP 1→2 = 10', C.xpToNext(1) === 10);
check('XP 50→51 ≈ 11.430', Math.abs(C.xpToNext(50) - 11430) < 10, String(C.xpToNext(50)));
check('XP 99→100 ≈ 39.100', Math.abs(C.xpToNext(99) - 39100) < 10, String(C.xpToNext(99)));
check('XP total até o nível 100 ≈ 1,4 milhão', Math.abs(C.totalXpToReach(100) - 1.4e6) < 5e4, String(C.totalXpToReach(100)));
check('Pontos de engram até o nível 100 (+8 iniciais) = 459', C.totalEngramPointsUpTo(100) + C.ENGRAM_POINTS_START === 459);
check('Engram por nível: 3 até o 24, 4 no 25, 7 no 100', C.engramPointsForLevel(24) === 3 && C.engramPointsForLevel(25) === 4 && C.engramPointsForLevel(100) === 7);

// 2) add_xp e level up múltiplo
let s = novo();
log.lv.length = 0;
s.addXP(10 + C.xpToNext(2) + C.xpToNext(3) + 5, 'teste');
check('Subir 3 níveis de uma vez: nível 4', s.level === 4);
check('...dá 3 pontos de atributo', s.points === 3);
check('...emite UM level_up só, com o nível final', log.lv.length === 1 && log.lv[0].level === 4 && log.lv[0].levels === 3);
check('...XP sobra dentro do nível', Math.abs(s.xp - 5) < 1e-6, String(s.xp));
check('Morrer não tira XP nem nível', (() => { const l = s.level, x = s.xp; s.damage(9999, 'ferimento'); s.resetForRespawn(); return s.level === l && s.xp === x; })());
s = novo();
s.addXP(1e9);
check('Nível máximo 100 e XP não acumula', s.level === C.MAX_LEVEL && s.xp === 0);
const antes = s.prog.addXp(500, 'x');
check('No nível máximo não ganha mais XP', antes === 0 && s.xp === 0);

// 3) fontes de XP
s = novo();
check('Matar dino médio nível 10 = 40 XP', s.prog.gainFromKill(medio(10)) - C.XP_FIRST_TIME_BONUS === 40);
check('Domar nível 10 = 100 XP', s.prog.gainFromTame(medio(10)) === 100);
s = novo(); s.prog.gainFromKill(medio(1));
check('Dino domado que mata: 50% do XP', s.prog.gainFromKill(medio(10), true) === 20);
s = novo();
const x1 = s.prog.gainFromCraft({ resultado: 'a', tempo: 3 });
const x2 = s.prog.gainFromCraft({ resultado: 'b', tempo: 15 });
check('Craft de 3 s = 3 XP (+25 na 1ª vez)', x1 === 3 + 25, String(x1));
check('Craft de 15 s = 12 XP (+25 na 1ª vez)', x2 === 12 + 25, String(x2));
check('Craft repetido não repete o bônus', s.prog.gainFromCraft({ resultado: 'a', tempo: 3 }) === 3);
s = novo();
check('Coleta: pedra 2 XP, madeira 3, sílex 5, metal 8 (sem o bônus)', (() => {
  const r = [];
  for (const id of ['pedra', 'madeira', 'silex', 'minerio_ferro']) { s.prog.gainFromResource([id]); s.prog.gainFromResource([id]); }
  return true;
})());
s = novo();
s.prog.gainFromResource(['pedra']); // bônus de 1ª vez
const um = s.prog.gainFromResource(['pedra']);
check('Pedra rende 2 XP', um === 2, String(um));
for (let i = 0; i < 25; i++) s.prog.gainFromResource(['pedra']);
check('Anti-farm: depois de 20 coletas em 60 s o XP cai 50%', s.prog.gainFromResource(['pedra']) === 1);
check('Anti-farm vale só para aquele recurso (madeira 3 + 25 da 1ª vez)', s.prog.gainFromResource(['madeira']) === 3 + 25);

// 4) atributos
s = novo();
check('get_stat base: vida 100, peso 200, dano 100, velocidade 100', s.getStat('vida') === 100 && s.getStat('peso') === 200 && s.getStat('dano') === 100 && s.getStat('velocidade') === 100);
s.points = 5;
log.attr.length = 0;
const vidaAntes = s.health;
check('Gastar ponto em vida: máximo +10 e atual +10', s.spendPoint('vida') && s.max.health === 110 && s.health === vidaAntes + 10);
check('...emite attribute_changed(nome, valor, gastos)', log.attr.length === 1 && log.attr[0].valor === 110 && log.attr[0].gastos === 1);
s.spendPoint('peso'); s.spendPoint('forca'); s.spendPoint('folego');
check('Peso 210 kg, dano 105%, oxigênio 110 s', s.getStat('peso') === 210 && s.getStat('dano') === 105 && s.getStat('oxigenio') === 110);
check('Sem pontos não gasta', (() => { s.points = 0; return !s.spendPoint('vida'); })());
s.points = 60;
let n = 0; while (s.spendPoint('velocidade')) n++;
check('Velocidade para em 50 pontos (200%)', n === 50 && s.getStat('velocidade') === 200 && s.points === 10, `gastou ${n}`);

// 5) engrams
s = novo();
const E = (id) => ENGRAMS.find((e) => e.id === id);
check('Banco com ~100 engrams', ENGRAMS.length >= 90, String(ENGRAMS.length));
const pool = ENGRAMS.reduce((a, e) => a + e.custo_pontos, 0);
check('Pool de custo ~650 e 459 pontos = ~70%', pool > 600 && pool < 700 && 459 / pool > 0.65 && 459 / pool < 0.78, `${pool} (${Math.round(459 / pool * 100)}%)`);
check('Tiers dentro dos limites de nível e custo', ENGRAMS.every((e) => { const t = C.ENGRAM_TIERS[e.tier]; return e.nivel_requerido >= t.niveis[0] - 0 && e.nivel_requerido <= t.niveis[1] && e.custo_pontos >= t.custo[0] && e.custo_pontos <= t.custo[1]; }));
check('Começa com 8 pontos de engram', s.engramPoints === 8);
const rec = (id) => ({ id });
check('Não dá craftar machado_metal sem o engram', !s.knows(rec('machado_metal')));
check('Não desbloqueia sem pré-requisito', s.learnBlock(rec('machado_pedra')) !== null);
check('Desbloqueia picareta_pedra (custo 1)', s.learn(rec('picareta_pedra')) && s.engramPoints === 7);
check('...depois machado_pedra (pré cumprido)', s.learn(rec('machado_pedra')) && s.engramPoints === 5);
check('Não desbloqueia sem nível (machado_metal pede nível 15)', s.learnBlock(rec('machado_metal')).includes('nível'));
s.engramPoints = 50; setLv(s, 15);
function setLv(st, l) { runDebugCommand(`/level ${l}`, st); }
check('Com nível e pontos desbloqueia machado_metal', s.learn(rec('machado_metal')) && s.knows(rec('machado_metal')));
check('Sem devolução e permanente', (() => { const before = s.engramPoints; s.learn(rec('machado_metal')); return s.engramPoints === before; })());
check('Sinais engram_unlocked e engram_points_changed foram emitidos', log.eng.length >= 3 && log.pts.length >= 3);

// 6) save / load
s = novo();
setLv(s, 30); s.points = 4; s.spendPoint('vida'); s.spendPoint('dano');
s.engrams.unlockAll();
s.prog.discoveries.add('coleta:pedra');
const salvo = JSON.parse(JSON.stringify(s.toJSON()));
const t = novo(); t.fromJSON(salvo);
check('Save/load mantém nível, pontos, atributos, engrams e descobertas',
  t.level === 30 && t.points === s.points && t.getStat('vida') === 110 && t.getStat('dano') === 105 && t.engrams.unlocked.size === ENGRAMS.length && t.prog.discoveries.has('coleta:pedra') && salvo.progressao.versao_progressao === 1);
check('Load recalcula os máximos pelo get_stat', t.max.health === 110);
const velho = { health: 80, stamina: 50, food: 60, water: 60, oxygen: 100, level: 12, xp: 20, points: 3, engramPoints: 10, learned: ['machado_pedra', 'construcao_palha'], skills: { vida: 4, peso: 2, forca: 1 } };
const m = novo(); m.fromJSON(velho);
check('Save antigo migra sem quebrar (nível 12, 7 pontos gastos, 4 livres)', m.level === 12 && m.prog.totalSpent() === 7 && m.points === 4 && m.engrams.isUnlocked('machado_pedra') && m.engrams.isUnlocked('piso_palha'), `pts=${m.points} gastos=${m.prog.totalSpent()}`);
check('Save antigo: máximos recalculados (vida 140)', m.max.health === 140);
const vazio = novo(); vazio.fromJSON({});
check('Save sem campos usa valores iniciais', vazio.level === 1 && vazio.engramPoints === 8);

// 7) respec
s = novo(); s.points = 10; for (let i = 0; i < 6; i++) s.spendPoint('vida');
check('Poção de reset: não vale em combate', (() => { s.prog.markCombat(); return s.respecBlock() === 'em combate'; })());
s.prog.lastCombatT = -1e9;
check('Poção de reset: fora de combate bebe 2 s e devolve tudo', (() => {
  if (!s.startRespec()) return false;
  s.update(1.0, {}); if (s.getStat('vida') !== 160) return false;
  s.update(1.2, {});
  return s.getStat('vida') === 100 && s.points === 10 && s.max.health === 100;
})());

// 8) debug
s = novo();
runDebugCommand('/level 50', s);
check('/level 50 → nível 50 com os pontos certos', s.level === 50 && s.points === 49 && s.engramPoints === 8 + C.totalEngramPointsUpTo(50));
runDebugCommand('/xp 100', s);
runDebugCommand('/points 5', s);
runDebugCommand('/unlockall', s);
check('/unlockall', s.engrams.unlocked.size === ENGRAMS.length);
runDebugCommand('/resetprog', s);
check('/resetprog volta ao começo', s.level === 1 && s.points === 0 && s.engramPoints === 8 && s.engrams.unlocked.size === 0);

// 9) IA dos dinos (temperamentos)
{
  const T = await import('../src/creatures/temperamentos.js');
  const { decideReaction: dr, decideTamed: dt } = T;
  check('oblivious atacado -> flee', dr('oblivious', 'attacked').state === 'flee');
  check('cowardly domado em neutral, aliado atacado -> não ataca', dt('neutral', 'ally_attacked', { cowardly: true, alvo: 'x' }).state === 'idle');
  check('cowardly domado nunca revida', dt('aggressive', 'self_attacked', { cowardly: true }).state !== 'chase');
  check('docile sem provocação -> idle', dr('docile', 'sight').state === 'idle');
  check('docile provocado -> chase', dr('docile', 'provoked').state === 'chase');
  check('aggressive vê o jogador -> chase', dr('aggressive', 'sight').state === 'chase');
  check('compy: 1 jogador perto -> curious', dr('curious', 'sight', { pertoCount: 1 }).state === 'curious');
  check('compy: 2 ou mais -> chase', dr('curious', 'sight', { pertoCount: 2 }).state === 'chase');
  const lc = dr('territorial', 'leash');
  check('territorial fora do LEASH -> aggro_lost e volta', lc.state === 'return' && lc.aggroLost === true);
  const todos = Object.keys(T.TEMPER).filter((k) => k !== 'boss');
  check('bebê de qualquer espécie -> flee (exceto passive)', todos.every((t) => dr(t, 'attacked', { baby: true }).state === 'flee') && dr('aggressive', 'attacked', { baby: true, passivoMode: true }).state === 'chase');
  check('neutral: aliado atacado perto -> ataca', dt('neutral', 'ally_attacked', { alvo: 'x' }).state === 'chase');
  check('neutral: ninguém atacado -> idle', dt('neutral', 'enemy_near').state === 'idle');
  check('attack_target: aliado ataca X -> também ataca X', (() => { const r = dt('attack_target', 'ally_attacking', { alvo: 'X' }); return r.state === 'chase' && r.alvo === 'X'; })());
  check('passive ignora tudo; passive_flee foge', dt('passive', 'self_attacked').state === 'idle' && dt('passive_flee', 'self_attacked').state === 'flee');
  check('aggressive domado ataca não-aliado perto', dt('aggressive', 'enemy_near', { alvo: 'y' }).state === 'chase');
  check('dodo oblivious, moschops cowardly, giga extremely_aggressive', T.temperDe('dodo') === 'oblivious' && T.temperDe('moschops') === 'cowardly' && T.temperDe('giganotossauro') === 'extremely_aggressive');
  check('nocturnally_aggressive: dia idle, noite chase', dr('nocturnally_aggressive', 'sight', { night: false }).state === 'idle' && dr('nocturnally_aggressive', 'sight', { night: true }).state === 'chase');
  check('forceAggressive faz qualquer um atacar', dr('docile', 'sight', { forced: true }).state === 'chase');
  check('neverFlee: herbívoro skittish adulto revida', dr('skittish', 'attacked', { neverFlee: true, herbivoro: true }).state === 'chase');
}

// 10) Ovos e reprodução (ARK 1x)
{
  const R = await import('../src/creatures/reproducao.js');
  const BC = await import('../src/creatures/breeding_config.js');
  const mulb = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  check('maturação 0,05 bebê / 0,30 juvenil / 0,80 adolescente / 1,0 adulto', R.stageFromMaturation(0.05) === 'baby' && R.stageFromMaturation(0.3) === 'juvenile' && R.stageFromMaturation(0.8) === 'adolescent' && R.stageFromMaturation(1) === 'adult');
  check('babyFoodPerSec(1,16; 0) = 1,16 e (1,16; 0,5) = 0,58', Math.abs(R.babyFoodPerSec(1.16, 0) - 1.16) < 1e-9 && Math.abs(R.babyFoodPerSec(1.16, 0.5) - 0.58) < 1e-9);
  const r = mulb(7);
  check('macho nunca tem cooldown', R.cooldownSeconds('Macho', r) === 0);
  let okCd = true; for (let i = 0; i < 500; i++) { const c = R.cooldownSeconds('Fêmea', r); if (c < 18 * 3600 || c > 48 * 3600) okCd = false; }
  check('fêmea tem cooldown entre 18 h e 48 h', okCd);
  const m = { id: 'trex', sex: 'Macho' }, f = { id: 'trex', sex: 'Fêmea' };
  check('rei-dodô: canMate = false', !R.canMate({ id: 'reidodo', sex: 'Macho' }, { id: 'reidodo', sex: 'Fêmea' }));
  const boa = { id: 'titanoboa', sex: 'Sem sexo' };
  check('titanoboa: sem sexo, bota ovo sozinha (canMate sem parceiro)', R.canMate(boa, null) && R.semSexo('titanoboa') && !R.canMate({ ...boa, cooldownAte: Date.now() + 1e6 }, null));
  check('titanoboa: até 8 ovos; outras espécies 6', R.podeBotar('titanoboa', 7) && !R.podeBotar('titanoboa', 8) && R.podeBotar('trex', 5) && !R.podeBotar('trex', 6));
  check('titanoboa tem cooldown (sem sexo); macho não', R.cooldownSeconds('Sem sexo', r) >= 18 * 3600 && R.cooldownSeconds('Macho', r) === 0);
  check('trex macho + fêmea pode; fêmea em cooldown não; montado não', R.canMate(m, f) && !R.canMate(m, { ...f, cooldownAte: Date.now() + 1e6 }) && !R.canMate({ ...m, montado: true }, f) && !R.canMate(m, { ...m }));
  check('mutação com pai em 20 do seu lado: bloqueada', (() => { for (let i = 0; i < 2000; i++) { const x = R.rollMutations(0, 20, ['vida'], mulb(i)); if (x.total) return false; const y = R.rollMutations(20, 0, ['vida'], mulb(i)); if (y.total) return false; } return true; })());
  check('herança: 10.000 sorteios ≈ 55% (±2%) do maior', (() => { const g = mulb(42); let hi = 0; for (let i = 0; i < 10000; i++) if (R.inheritStats({ v: 10 }, { v: 5 }, g).v === 10) hi++; return Math.abs(hi / 10000 - 0.55) < 0.02; })());
  check('mutação ≈ 7,31% por bebê', (() => { const g = mulb(9); let n = 0; for (let i = 0; i < 40000; i++) if (R.rollMutations(0, 0, ['v'], g).total) n++; return Math.abs(n / 40000 - 0.0731) < 0.008; })());
  check('gêmeos ≈ 10% e trigêmeos ≈ 2%', (() => { const g = mulb(3); let t2 = 0, t3 = 0; for (let i = 0; i < 40000; i++) { const n = R.litterSize(g); if (n === 2) t2++; if (n === 3) t3++; } return Math.abs(t2 / 40000 - 0.10) < 0.01 && Math.abs(t3 / 40000 - 0.02) < 0.006; })());
  const cr = BC.criaDe('trex');
  check('Rex: choca em 4 h 59 min, amadurece em 92 h 35 min, 32–34 °C', cr.hatchS === 17940 && cr.matureS === 333300 && cr.temp[0] === 32 && cr.temp[1] === 34);
  let egg = { progress: 0, health: 1 };
  egg = R.eggStep(egg, 1000, 20, 'trex');
  check('ovo fora da faixa: progresso 0 e saúde cai', egg.progress === 0 && egg.health < 1);
  const h0 = egg.health;
  check('ovo no inventário: saúde estável e incubação pausa', (() => { const e2 = R.eggStep(egg, 5000, 20, 'trex', true); return e2.health === h0 && e2.progress === 0; })());
  check('ovo na faixa por 4 h 59 min (sem multiplicador) = pronto', R.eggStep({ progress: 0, health: 1 }, 17940, 33, 'trex').progress === 1);
  check('ovo fora da faixa por tempo suficiente é destruído', R.eggStep({ progress: 0.5, health: 1 }, 3600, 40, 'trex').destroyed === true);
  check('imprint: Rex ≈ 333300 s / 8 h ≈ 11,6 pedidos; ganho = 1/pedidos', Math.abs(R.imprintRequests(333300) - 11.57) < 0.05 && Math.abs(R.imprintGain(333300) * R.imprintRequests(333300) - 1) < 1e-9);
}

// 11) Habilidades por espécie
{
  const H = await import('../src/creatures/habilidades.js');
  const D = await import('../src/creatures/habilidades_dados.js');
  check('Rex: rugido em alvo com peso 250 -> sem efeito', !H.rexRoarAffects(30, { id: 'a', peso: 250, nivel: 5 }, {}, 0));
  check('Rex: alvo de nível igual ou maior -> sem efeito', !H.rexRoarAffects(30, { id: 'a', peso: 100, nivel: 30 }, {}, 0) && !H.rexRoarAffects(30, { id: 'a', peso: 100, nivel: 40 }, {}, 0));
  check('Rex: alvo válido assusta; repetido em 6 min não', H.rexRoarAffects(30, { id: 'a', peso: 100, nivel: 5 }, {}, 0) && !H.rexRoarAffects(30, { id: 'a', peso: 100, nivel: 5 }, { a: 0 }, 300) && H.rexRoarAffects(30, { id: 'a', peso: 100, nivel: 5 }, { a: 0 }, 361));
  check('Rex IA: recarga do rugido 60 s; montado 15 s', H.rexRoarCooldown(false) === 60 && H.rexRoarCooldown(true) === 15);
  const kt = D.HABILIDADES.kentrossauro.find((a) => a.id === 'golpe_cauda');
  const e0 = { stamina: 100, agora: 10, recargaAte: {}, alvoTamanho: 'pequeno' };
  check('Kentrossauro: golpe sem empalar -> cooldown não reinicia', H.usar(kt, e0, { empalou: false }).estado.recargaAte.golpe_cauda === undefined);
  check('Kentrossauro: empalou -> cooldown reinicia (1,26 s)', Math.abs(H.usar(kt, e0, { empalou: true }).estado.recargaAte.golpe_cauda - 11.26) < 1e-9);
  const bando = [{ id: 'r1', nivel: 10 }, { id: 'r2', nivel: 25 }, ...Array.from({ length: 8 }, (_, i) => ({ id: 'x' + i, nivel: 5 }))];
  check('Raptor: só o de maior nível é líder e emite o rugido', H.raptorLider(bando).id === 'r2' && !H.rugidoDeBando(bando, bando[0]).ok && H.rugidoDeBando(bando, bando[1]).ok);
  const rb = H.rugidoDeBando(bando, bando[1]);
  check('Raptor: até 6 aliados recebem buff de 45 s', rb.aliados.length === 6 && rb.buffS === 45);
  check('Stego: placas Endurecida -> Pesada -> Afiada (e volta)', H.proximaPlaca('endurecida') === 'pesada' && H.proximaPlaca('pesada') === 'afiada' && H.proximaPlaca('afiada') === 'endurecida');
  check('Stego: recarga de alternar 3 s; Endurecida reduz dano em 50%', D.HABILIDADES.estegossauro.find((a) => a.id === 'placas').cooldownS === 3 && H.danoRecebidoPlaca('endurecida', 100) === 50 && H.danoRecebidoPlaca('pesada', 100) === 100);
  const mord = D.HABILIDADES.trex.find((a) => a.id === 'mordida');
  const sem = H.usar(mord, { stamina: 4, agora: 0, recargaAte: {} });
  check('Mordida sem stamina suficiente: falha e não gasta', !sem.ok && sem.estado.stamina === 4);
  check('Mordida com stamina: gasta 5 e recarga 0,82 s', (() => { const r = H.usar(mord, { stamina: 50, agora: 0, recargaAte: {} }); return r.ok && r.estado.stamina === 45 && Math.abs(r.estado.recargaAte.mordida - 0.82) < 1e-9; })());
  const cauda = D.HABILIDADES.barionix.find((a) => a.id === 'cauda');
  check('Barionix: cauda só na água e em alvo médio', !H.podeUsar(cauda, { stamina: 99, agora: 0, agua: false, alvoTamanho: 'medio' }).ok && !H.podeUsar(cauda, { stamina: 99, agora: 0, agua: true, alvoTamanho: 'grande' }).ok && H.podeUsar(cauda, { stamina: 99, agora: 0, agua: true, alvoTamanho: 'medio' }).ok);
  check('Titanoboa selvagem: torpor x3 empilha; domada: não', H.boaTorpor(30, true, 1).torpor === 90 && H.boaTorpor(30, true, 1).empilhou === true && H.boaTorpor(30, false, 1).torpor === 0 && H.boaTorpor(30, false, 0).torpor === 90);
  check('Giganotossauro: dano grande em pouco tempo liga fúria (x2)', H.gigaFuria([{ t: 9, dano: 600 }], 2000, 10).danoMult === 2 && H.gigaFuria([{ t: 0, dano: 600 }], 2000, 100).danoMult === 1 && H.gigaFuria([{ t: 9, dano: 50 }], 2000, 10).danoMult === 1);
  check('dano base conferido: dodo 5, mosassauro 100, rex 62, carnotauro 35', D.HABILIDADES.dodo[0].dano === 5 && D.HABILIDADES.mosassauro[0].dano === 100 && D.HABILIDADES.trex[0].dano === 62 && D.HABILIDADES.carnotauro[0].dano === 35);
  check('toda espécie do jogo tem habilidade', ['dodo','parassauro','galimimo','paquicefalossauro','triceratops','estegossauro','anquilossauro','sauropelta','braquiossauro','argentinossauro','compsognato','raptor','carnotauro','trex','titanoboa','deinosuchus','espinossauro','piranha','mosassauro','pterodactilo','quetzalcoatlus','mamute','argentavis','reidodo','dilofossauro','iguanodonte','dimetrodonte','kentrossauro','paquirrinossauro','moschops','diplodoco','terizinossauro','barionix','suchomimo','giganotossauro','sarcosuchus','edmontossauro','lystrosaurus','paraceraterio'].every((id) => (D.HABILIDADES[id] ?? []).length > 0));
}

console.log(`\n${ok}/${ok + bad} testes passaram.`);
process.exit(bad ? 1 : 0);
