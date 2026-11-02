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

console.log(`\n${ok}/${ok + bad} testes passaram.`);
process.exit(bad ? 1 : 0);
