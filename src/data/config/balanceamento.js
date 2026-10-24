// =============================================================
//  BALANCEAMENTO – TODOS OS NÚMEROS DO JOGO FICAM AQUI
//
//  Como mudar: troque só o número depois dos dois-pontos.
//  Tudo depois de "//" é explicação e o jogo ignora.
//  Depois de mudar, gere o jogo de novo (npm run build).
// =============================================================
export default {
  // ---------------------------------------------------------
  // Atributos máximos do jogador (nível 1)
  // ---------------------------------------------------------
  jogador: {
    vida_max: 100,
    stamina_max: 100,
    fome_max: 100,       // barra de comida (cheia = sem fome)
    sede_max: 100,       // barra de água (cheia = sem sede)
    folego_max: 100,     // ar embaixo d'água
  },

  // ---------------------------------------------------------
  // Fome, sede e vida
  // ---------------------------------------------------------
  sobrevivencia: {
    fome_duracao_min: 25,      // minutos para a fome cheia chegar a zero
    sede_duracao_min: 18,      // minutos para a sede cheia chegar a zero
    mult_correndo: 2.0,        // correndo, fome e sede caem X vezes mais rápido
    mult_nadando: 1.5,         // nadando, fome e sede caem X vezes mais rápido
    dano_fome_seg: 1.0,        // vida perdida por segundo com fome zerada
    dano_sede_seg: 1.5,        // vida perdida por segundo com sede zerada
    regen_vida_seg: 0.6,       // vida recuperada por segundo
    regen_limite: 0.5,         // só regenera com fome E sede acima de 50%
    gole_agua: 12,             // quanto de sede cada "beber" recupera
  },

  // ---------------------------------------------------------
  // Stamina (energia para correr, pular e nadar)
  // ---------------------------------------------------------
  stamina: {
    gasto_correr_seg: 9,       // por segundo correndo
    gasto_pulo: 8,             // por pulo
    gasto_nado_seg: 2.5,       // por segundo nadando
    gasto_nado_rapido_seg: 8,  // por segundo nadando rápido
    regen_seg: 14,             // recuperação por segundo (parado ou andando)
    regen_na_agua: 0.3,        // boiando parado recupera só 30% disso
    espera_regen_seg: 1.0,     // espera antes de começar a recuperar
  },

  // ---------------------------------------------------------
  // Fôlego (embaixo d'água)
  // ---------------------------------------------------------
  folego: {
    duracao_seg: 40,           // segundos de ar com o fôlego cheio
    regen_seg: 30,             // recuperação por segundo fora d'água
    dano_afogando_seg: 6,      // vida perdida por segundo sem ar
  },

  // ---------------------------------------------------------
  // Movimento (metros por segundo)
  // ---------------------------------------------------------
  movimento: {
    andar: 4.2,
    correr: 7.5,
    agachado: 2.0,
    na_agua_rasa: 0.7,         // andando com água pela cintura: 70% da velocidade
    nadar: 3.0,
    nadar_rapido: 4.8,
    pulo: 7.2,                 // força do pulo
    gravidade: 22,
    inclinacao_max_graus: 48,  // rampas mais íngremes que isso não dá para subir
  },

  // ---------------------------------------------------------
  // Temperatura (Fase 1: só aparece no ícone; efeitos na Fase 4)
  // ---------------------------------------------------------
  temperatura: {
    base_c: 26,                // temperatura ao nível do mar
    queda_por_metro: 0.13,     // quanto esfria a cada metro de altitude
    na_agua_c: -4,             // dentro da água fica mais frio
    frio_abaixo_c: 12,
    calor_acima_c: 34,
  },

  // ---------------------------------------------------------
  // Níveis e XP
  // ---------------------------------------------------------
  nivel: {
    max: 60,
    xp_base: 60,               // XP para ir do nível 1 ao 2
    xp_crescimento: 1.18,      // cada nível pede 18% a mais que o anterior
  },

  // ---------------------------------------------------------
  // Morte e renascimento
  // ---------------------------------------------------------
  morte: {
    saco_duracao_min: 15,      // minutos que o saco de morte fica no chão
    renascer_fome: 100,        // fome ao renascer (0 a 100)
    renascer_sede: 100,        // sede ao renascer (0 a 100)
  },

  // ---------------------------------------------------------
  // Mundo
  // ---------------------------------------------------------
  mundo: {
    semente: 1337,             // muda o formato da ilha (mesma semente = mesma ilha)
    limite_raio_m: 640,        // até onde dá para nadar no mar a partir do centro
  },

  // ---------------------------------------------------------
  // Combate (soco por enquanto; armas na Fase 3)
  // ---------------------------------------------------------
  combate: {
    soco_dano: 10,             // dano de um soco
    soco_alcance_m: 2.4,       // distância do soco
    soco_intervalo_seg: 0.45,  // tempo entre socos
    soco_stamina: 4,           // stamina gasta por soco
  },

  // ---------------------------------------------------------
  // Criaturas (dados de cada espécie: data/creatures/criaturas.json)
  // ---------------------------------------------------------
  criaturas: {
    raio_spawn_min_m: 55,      // nascem a pelo menos X m do jogador
    raio_spawn_max_m: 130,     // e no máximo a Y m
    raio_despawn_m: 190,       // somem quando ficam mais longe que isso
    intervalo_spawn_seg: 1.2,  // a cada quanto tempo tenta criar mais
    corpo_dura_seg: 90,        // quanto tempo um corpo fica no chão
  },

  // ---------------------------------------------------------
  // Desempenho
  // ---------------------------------------------------------
  desempenho: {
    criaturas_max_ativas: 15,  // máximo de criaturas vivas perto do jogador
  },

  // ---------------------------------------------------------
  // Metas de ritmo do jogo (referência para as próximas fases)
  // ---------------------------------------------------------
  ritmo: {
    primeiro_domavel_min: 10,
    chegar_ao_metal_horas: 3.5,
  },
};
