// Habilidades por espécie (ARK Evolved/ASE), como no prompt. Dano = absoluto de nível 1.
// Etiquetas: [OK] wiki | [CUSTOM] espécie fora do ARK base (referência anotada em `ref`) | [PENDENTE] não conferido.
// Tudo congelado. Stamina e cooldown (s) são os da wiki; a recarga já é o tempo mínimo entre ataques.
const U = Object.freeze({ montado: true, ia: true });
const A = (id, nome, dano, stamina, cooldownS, extra = {}) =>
  Object.freeze({ id, nome, tipo: extra.tipo ?? 'ataque', dano, stamina, cooldownS, efeitos: Object.freeze(extra.efeitos ?? []), requisitos: Object.freeze(extra.req ?? {}), usavel: extra.usavel ?? U, ...(extra.nota ? { nota: extra.nota } : {}), ...(extra.contSta ? { staminaPorSeg: extra.contSta } : {}) });
const bite = (dano, cd = 0.67, stam = 5, nome = 'Mordida') => A('mordida', nome, dano, stam, cd);

// Efeitos de status com números conferidos [OK]
export const EFEITOS = Object.freeze({
  sangramento_carno: { vidaTotalPct: 0.05, duracaoS: 10, empurrao: true },
  sangramento_kentro: { vidaMaxPct: 0.10, duracaoS: 15, bloqueiaCuraConsumivel: true },
  veneno_dilo: { duracaoS: 10, visaoReduzida: true, velMult: 0.5 },
  medo_rex: { atordoadoS: 3, derrubaVoadores: true },
  gnashed_giga: { vidaMaxPct: 0.05, duracaoS: 10, velMult: 0.1 },
  aleijado_trike: { duracaoS: 5, alvo: 'medio' },
  atordoamento_bary: { duracaoS: 10, alvo: 'medio', exclui: ['cnidaria', 'mosassauro'] },
  torpor_boa: { multDano: 3, duracaoS: 10, empilhaSelvagem: true, empilhaDomado: false },
  fracturado_deino: { danoPct: true, alvoEmMovimento: true },
  lentidao_stego: { duracaoS: 10 },
  impalado: { duracaoS: 15 },
});

export const HABILIDADES = Object.freeze({
  // ---- Herbívoros ----
  dodo: [bite(5, 0.5, 5, 'Bicada')],
  lystrosaurus: [bite(6, 0.89)],
  galimimo: [bite(8), A('pulo', 'Pulo', 0, 15, 0, { tipo: 'ativa' })],
  moschops: [bite(32), A('mordida_perfurante', 'Mordida Perfurante', 32, 5, 1.16), A('mordida_baixa', 'Mordida Baixa', 32, 5, 1.16)],
  kentrossauro: [bite(10),
    A('golpe_cauda', 'Golpe de Cauda', 42, 25, 1.26, { efeitos: ['sangramento_kentro', 'impalado'], req: { alvo: ['pequeno', 'medio'] }, nota: 'cooldown só reinicia se empalar' })],
  paquicefalossauro: [A('cabecada', 'Cabeçada', 10, 5, 0.67, { efeitos: [{ torpor: 1.7 }] }),
    A('ram', 'Ram', 0, 25, 0, { tipo: 'ativa', efeitos: [{ torpor: 3.5 }], contSta: 5 }), A('pulo', 'Pulo', 0, 7, 0, { tipo: 'ativa' })],
  parassauro: [bite(12), A('scan', 'Scan', 0, 50, 6, { tipo: 'ativa' }), A('rugido', 'Rugido', 0, 80, 120, { tipo: 'ativa', efeitos: ['assusta_pequenos_medios'] })],
  triceratops: [A('cabecada', 'Cabeçada', 32, 5, 0.67), A('carga', 'Carga/Ram', 0, 0, 0, { tipo: 'ativa', efeitos: ['aleijado_trike'], contSta: 15 })],
  iguanodonte: [A('golpe', 'Golpe', 25, 5, 0.67), A('postura', 'Trocar postura', 0, 0, 0, { tipo: 'ativa' }), A('pulo', 'Pulo (bípede)', 0, 10, 0, { tipo: 'ativa' })],
  estegossauro: [A('golpe_cauda', 'Golpe de Cauda', 42, 5, 0.87),
    A('empalar', 'Empalar', 0, 5, 1.16, { efeitos: ['impalado'], contSta: 35 }),
    A('placas', 'Alternar Placas', 0, 5, 3, { tipo: 'ativa', nota: 'Endurecida → Pesada → Afiada' })],
  paquirrinossauro: [A('cabecada', 'Cabeçada', 28, 5, 0.58),
    A('feromonio_calmante', 'Feromônio Calmante', 0, 75, 30, { tipo: 'ativa', nota: 'dura 20 s' }),
    A('feromonio_furia', 'Feromônio de Fúria', 0, 75, 7.5, { tipo: 'ativa', nota: 'dura 20 s' })],
  anquilossauro: [A('golpe_cauda', 'Golpe de Cauda', 50, 5, 1.16), A('mordida', 'Mordida (arbustos)', 30, 5, 0.67)],
  terizinossauro: [A('garra', 'Garra', 52, 5, 0.67), A('delicado', 'Ataque Delicado (2 golpes de 5)', 5, 5, 1.16), A('mordida', 'Mordida', 42, 5, 0.67, { efeitos: [{ torpor: 0.5 }] })],
  paraceraterio: [A('pisada', 'Pisada', 45, 5, 0.67)],
  mamute: [A('balanco', 'Balanço', 48, 20, 0.42), A('agarrar', 'Agarrar', 0, 5, 1.45, { tipo: 'ativa' }),
    A('intimidar', 'Intimidar', 0, 200, 3.28, { tipo: 'ativa', nota: '15 s, alvo -25% dano corpo a corpo' }), A('pisao', 'Pisão', 69, 40, 1.26)],
  diplodoco: [A('empurrao', 'Empurrão', 0, 10, 0.67)],
  braquiossauro: [A('golpe_cauda', 'Golpe de Cauda', 60, 5, 1.27, { nota: '[CUSTOM] ref. Brontosaurus' })],
  edmontossauro: [bite(12), A('scan', 'Scan', 0, 50, 6, { tipo: 'ativa' }), A('rugido', 'Rugido', 0, 80, 120, { tipo: 'ativa' })], // [CUSTOM] ref. parassauro
  sauropelta: [A('golpe_cauda', 'Golpe de Cauda', 50, 5, 1.16), A('mordida', 'Mordida', 30, 5, 0.67)], // [CUSTOM] ref. anquilossauro
  argentinossauro: [A('golpe_cauda', 'Golpe de Cauda', 60, 5, 1.27)], // [CUSTOM] ref. brontosaurus
  // ---- Carnívoros terrestres ----
  compsognato: [bite(4)],
  dilofossauro: [bite(10, 0.7), A('cuspe', 'Cuspe', 3, 5, 12, { efeitos: ['veneno_dilo'] })],
  raptor: [bite(15, 0.6), A('bote', 'Bote', 0, 5, 1.16, { tipo: 'ativa', nota: 'imobiliza' }),
    A('rugido_bando', 'Rugido de Bando', 0, 5, 0, { tipo: 'ativa', req: { lider: true }, nota: 'até 6 aliados, 45 s' }), A('pulo', 'Pulo', 0, 7, 0, { tipo: 'ativa' })],
  dimetrodonte: [bite(20, 0.45)],
  barionix: [bite(35), A('cauda', 'Golpe de Cauda', 25, 20, 1.16, { efeitos: ['atordoamento_bary'], req: { agua: true, alvo: ['medio'] } }), A('pulo', 'Pulo', 0, 7, 0, { tipo: 'ativa' })],
  carnotauro: [bite(35), A('cabecada', 'Cabeçada', 35, 5, 0.67, { efeitos: ['sangramento_carno'] })],
  titanoboa: [bite(30, 0.67, 5, 'Mordida')].map((a) => Object.freeze({ ...a, efeitos: ['torpor_boa'] })),
  sarcosuchus: [bite(35, 1.85, 10), A('mordida_surpresa', 'Mordida Surpresa', 35, 35, 1.27),
    A('rolamento', 'Rolamento da Morte', 45, 95, 2.25), A('pulo', 'Pulo', 40, 125, 0.44)],
  deinosuchus: [bite(55, 0.45, 10), A('giga_mordida', 'Giga Mordida', 425, 200, 15, { efeitos: ['fracturado_deino'], nota: 'carga 20 stam; até 425 de dano' }),
    A('cauda', 'Golpe de Cauda', 70, 30, 5, { req: { terra: true } })],
  espinossauro: [bite(40, 0.7, 10), A('garras', 'Garras (bípede)', 60, 12, 1), A('postura', 'Trocar postura', 0, 0, 0, { tipo: 'ativa' })],
  suchomimo: [bite(35), A('cauda', 'Golpe de Cauda', 25, 20, 1.16, { efeitos: ['atordoamento_bary'], req: { agua: true, alvo: ['medio'] } })], // [CUSTOM] ref. barionix
  reidodo: [A('ataque', 'Ataque', 0, 0, 0, { nota: '[CUSTOM] versão doméstica e menos extrema do DodoRex' }), A('sopro_fogo', 'Sopro de Fogo', 0, 0, 0, { tipo: 'ativa', req: { terra: true }, nota: '[CUSTOM] AOE 90°; valores a definir' })],
  giganotossauro: [bite(480, 0.71), A('pisao', 'Pisão/Cauda', 480, 30, 1.67)], // [PENDENTE] conferir 480
  trex: [bite(62, 0.82), A('rugido', 'Rugido', 0, 5, 15, { tipo: 'ativa', efeitos: ['medo_rex'], nota: 'recarga 15 s montado / 60 s IA' })],
  // ---- Voadores ----
  pterodactilo: [bite(18, 0.67, 5, 'Bicada'), A('agarrar', 'Agarrar', 0, 40, 0, { tipo: 'ativa', req: { ar: true } }), A('rolamento', 'Rolamento', 50, 90, 7, { req: { ar: true } })],
  argentavis: [A('garra', 'Garra', 25, 5, 0.67), A('agarrar_garras', 'Agarrar (garras)', 0, 20, 5, { tipo: 'ativa', req: { ar: true } }), A('agarrar_bico', 'Agarrar (bico)', 0, 20, 5, { tipo: 'ativa', req: { ar: true } })],
  quetzalcoatlus: [A('bicada', 'Bicada', 22, 16, 0.967), A('agarrar', 'Agarrar', 0, 80, 0, { tipo: 'ativa', req: { ar: true } })],
  // ---- Aquáticos ----
  piranha: [bite(22)],
  mosassauro: [bite(100, 0.3)],
});

// Passivas e regras por espécie (consultadas pelo jogo).
export const PASSIVAS = Object.freeze({
  rex: { danoEmHerbivoros: 0.15 },
  kentrossauro: { packBoostMax: 4, packBoostPorExtra: 0.05, refleteDano: true, montavel: false },
  compsognato: { packBoostMax: 8, danoPorExtra: 0.30, resistPorExtra: 0.10 },
  raptor: { liderDano: 0.25, liderResist: 0.125, bandoMax: 6, buffS: 45 },
  triceratops: { rivalidade: { vida: 0.10, dano: 0.10, resist: 0.10 } },
  estegossauro: { placas: ['endurecida', 'pesada', 'afiada'], endurecidaReducao: 0.5, placasRecargaS: 3 },
  barionix: { danoPeixesPantano: 0.20 },
  espinossauro: { hidratacao: { duracaoS: 30, dano: 0.15, vel: 0.20, regenVida: 0.25 } },
  giganotossauro: { furia: { danoMult: 2, janelaS: 5, vidaPct: 0.25, duracaoS: 6 } }, // ASE: [CUSTOM] limiares (a wiki não dá os números)
  deinosuchus: { cabecaMult: 0.5, flechasMult: 0.35, corpoACorpoMult: 0.125 },
});

// Espécies fora do ARK base e a referência usada [CUSTOM]
export const CUSTOM_REF = Object.freeze({ edmontossauro: 'parassauro', sauropelta: 'anquilossauro', argentinossauro: 'braquiossauro', suchomimo: 'barionix', braquiossauro: 'brontosaurus', reidodo: 'dodorex' });
