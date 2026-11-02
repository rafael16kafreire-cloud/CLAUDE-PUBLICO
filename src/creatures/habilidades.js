// Regras puras das habilidades (sem three.js) – testadas em tests/progression.test.mjs.
import { HABILIDADES, EFEITOS, PASSIVAS } from './habilidades_dados.js';

export const habilidadesDe = (id) => HABILIDADES[id] ?? [];
export const habilidade = (id, abId) => habilidadesDe(id).find((a) => a.id === abId) ?? null;

// Pode usar agora? estado: { stamina, recargaAte: {abId: tempo}, agora, agua, ar, terra, alvoTamanho }
export function podeUsar(ab, estado) {
  if (!ab) return { ok: false, motivo: 'nao_existe' };
  if ((estado.stamina ?? 0) < ab.stamina) return { ok: false, motivo: 'stamina' }; // falha sem gastar stamina
  if ((estado.recargaAte?.[ab.id] ?? 0) > estado.agora) return { ok: false, motivo: 'recarga' };
  const r = ab.requisitos;
  if (r.agua && !estado.agua) return { ok: false, motivo: 'so_na_agua' };
  if (r.terra && !estado.terra) return { ok: false, motivo: 'so_em_terra' };
  if (r.ar && !estado.ar) return { ok: false, motivo: 'so_no_ar' };
  if (r.alvo && !r.alvo.includes(estado.alvoTamanho)) return { ok: false, motivo: 'alvo' };
  return { ok: true };
}

// Usa: gasta stamina e inicia a recarga. Devolve o novo estado (não muda o original).
// Kentrossauro: a recarga do golpe de cauda só reinicia se empalar.
export function usar(ab, estado, resultado = {}) {
  const chk = podeUsar(ab, estado);
  if (!chk.ok) return { ...chk, estado };
  const novo = { ...estado, stamina: estado.stamina - ab.stamina, recargaAte: { ...(estado.recargaAte ?? {}) } };
  const semRecarga = ab.nota === 'cooldown só reinicia se empalar' && !resultado.empalou;
  if (!semRecarga) novo.recargaAte[ab.id] = estado.agora + ab.cooldownS;
  return { ok: true, estado: novo };
}

// ---- Rex: Rugido (medo_rex) ----
export const REX_ROAR = Object.freeze({ pesoArrasteMax: 200, mesmoAlvoS: 6 * 60, recargaMontadoS: 15, recargaIaS: 60 });
export const rexRoarCooldown = (montado) => (montado ? REX_ROAR.recargaMontadoS : REX_ROAR.recargaIaS);
// alvo: { peso, nivel, id }; historico: { [alvoId]: tempo do último susto }
export function rexRoarAffects(rexNivel, alvo, historico, agora) {
  if (alvo.peso > REX_ROAR.pesoArrasteMax) return false; // peso de arraste <= 200
  if (alvo.nivel >= rexNivel) return false;              // nível menor que o do Rex
  const ultimo = historico?.[alvo.id];
  if (ultimo !== undefined && agora - ultimo < REX_ROAR.mesmoAlvoS) return false; // mesmo alvo: 6 min
  return true;
}

// ---- Raptor: líder do bando e Rugido de Bando ----
export function raptorLider(bando) {
  return bando.reduce((a, b) => (!a || b.nivel > a.nivel ? b : a), null);
}
export function rugidoDeBando(bando, quem) {
  const lider = raptorLider(bando);
  if (!lider || lider.id !== quem.id) return { ok: false, aliados: [] }; // só o líder emite
  const aliados = bando.filter((r) => r.id !== quem.id).slice(0, PASSIVAS.raptor.bandoMax);
  return { ok: true, aliados: aliados.map((r) => r.id), buffS: PASSIVAS.raptor.buffS };
}

// ---- Estegossauro: placas ----
export function proximaPlaca(atual) {
  const l = PASSIVAS.estegossauro.placas;
  return l[(l.indexOf(atual) + 1) % l.length];
}
export const danoRecebidoPlaca = (placa, dano) => (placa === 'endurecida' ? dano * (1 - PASSIVAS.estegossauro.endurecidaReducao) : dano);

// ---- Titanoboa: torpor x3 em 10 s; empilha no selvagem, não no domado ----
export function boaTorpor(danoCausado, alvoSelvagem, efeitosAtivos) {
  const E = EFEITOS.torpor_boa;
  const total = danoCausado * E.multDano;
  if (efeitosAtivos > 0 && !(alvoSelvagem && E.empilhaSelvagem)) return { torpor: 0, duracaoS: 0, empilhou: false };
  return { torpor: total, duracaoS: E.duracaoS, empilhou: efeitosAtivos > 0 };
}

// ---- Giganotossauro (ASE): fúria ao perder muita vida em pouco tempo (limiares [CUSTOM]) ----
export function gigaFuria(historicoDano, vidaMax, agora) {
  const F = PASSIVAS.giganotossauro.furia;
  const recente = historicoDano.filter((h) => agora - h.t <= F.janelaS).reduce((s, h) => s + h.dano, 0);
  return recente >= vidaMax * F.vidaPct ? { ativa: true, danoMult: F.danoMult, duracaoS: F.duracaoS } : { ativa: false, danoMult: 1, duracaoS: 0 };
}

// ---- Packs ----
export const kentroPackBoost = (vizinhos) => Math.min(PASSIVAS.kentrossauro.packBoostMax, Math.max(0, vizinhos)) * PASSIVAS.kentrossauro.packBoostPorExtra;
export const compyPackBoost = (n) => { const extra = Math.min(PASSIVAS.compsognato.packBoostMax, Math.max(0, n - 1)); return { dano: extra * PASSIVAS.compsognato.danoPorExtra, resist: extra * PASSIVAS.compsognato.resistPorExtra }; };
