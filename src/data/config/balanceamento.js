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
    stamina_max: 200,    // (dobrada na v0.7)
    fome_max: 100,       // barra de comida (cheia = sem fome)
    sede_max: 100,       // barra de água (cheia = sem sede)
    folego_max: 100,     // ar embaixo d'água
    peso_max: 120,       // kg que carrega andando normal (até 150% anda devagar)
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
    regen_seg: 28,             // recuperação por segundo (parado ou andando)
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
  // Física da água (nado)
  // ---------------------------------------------------------
  agua: {
    empuxo: 1.26,              // >1 boia; <1 afunda (cansado afunda um pouco)
    arrasto: 1.6,              // quanto a água freia
    arrasto_rapido: 0.35,      // freio extra quando está rápido
    forca_bracada: 12,         // empurrão de cada braçada
    forca_bracada_rapida: 19,  // nadando rápido
    altura_onda_mar_m: 0.25,   // ondas do mar sobem e descem
    altura_onda_pantano_m: 0.05,
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
  // Habilidades: a cada nível ganha pontos para gastar (Inventário →
  // Habilidades). Quanto cada ponto aumenta:
  habilidades: {
    pontos_por_nivel: 1,
    vida: 10,       // +10 de vida máxima
    stamina: 20,    // +20 de stamina máxima
    fome: 10,       // +10 na barra de comida (dura mais)
    sede: 10,       // +10 na barra de água (dura mais)
    folego: 15,     // +15 de fôlego embaixo d'água
    peso: 15,       // +15 kg que carrega
    forca: 5,       // +5% de dano corpo a corpo
  },

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
    dano_soco_arvore_gigante: 4, // socar uma sumaúma machuca a mão
  },

  // ---------------------------------------------------------
  // Domar e montar
  // Soco e clava dão torpor (sono). Torpor no máximo = o bicho desmaia.
  // Desmaiado: dê a comida preferida dele (Interagir) até a barra de
  // domar encher. Se o torpor acabar antes, ele acorda.
  // ---------------------------------------------------------
  domar: {
    torpor_por_dano: { mao: 1.6, clava: 3.0, outro: 0.2 }, // torpor = dano × isto
    torpor_cai_seg: 0.03,      // acordado: torpor cai X do máximo por segundo
    desmaio_cai_seg: 0.005,    // desmaiado: cai X do máximo por segundo (~3 min)
    comer_a_cada_seg: 3,       // come uma comida a cada X s
    comidas_base: 4,           // comidas preferidas para domar no nível 1
    comidas_por_nivel: 0.2,    // + X por nível
    comida_qualquer: 0.35,     // comida que não é a preferida vale isso
    baga_escura_torpor: 0.15,  // cada baga-escura dada põe +15% de torpor
    seguir_m: 4,               // distância que o bicho domado fica de você
  },

  // ---------------------------------------------------------
  // Criaturas (dados de cada espécie: data/creatures/criaturas.json)
  // ---------------------------------------------------------
  criaturas: {
    raio_spawn_min_m: 55,      // nascem a pelo menos X m do jogador
    raio_spawn_max_m: 130,     // e no máximo a Y m
    raio_despawn_m: 190,       // somem quando ficam mais longe que isso
    intervalo_spawn_seg: 1.2,  // a cada quanto tempo tenta criar mais
    corpo_dura_seg: 120,       // quanto tempo um corpo fica no chão
    max_ambiente: 6,           // araras e outros bichos de enfeite (fora do limite)
    // sempre tem estes bichos no pântano quando você está por perto
    moradores_pantano: { deinosuchus: 2, titanoboa: 1 },
    // stamina dos bichos: aguentam correr X s com stamina cheia
    // e recuperam tudo em Y s andando/parados (cansados só andam)
    corrida_seg: 30,
    // ciclo de vida: nascem filhotes quando macho e fêmea adultos da mesma
    // espécie estão perto um do outro; o filhote cresce e um dia morre de velho
    vida_media_min: [45, 80],    // quanto tempo (min de jogo) um bicho vive
    crescer_min: 12,             // filhote vira adulto em X min
    intervalo_cria_min: [6, 10], // depois de ter filhote, espera X min
    chance_cria: 0.35,           // chance a cada tentativa (a cada 15 s)
    distancia_casal_m: 35,       // macho e fêmea a até X m
    extra_filhotes: 6,           // filhotes podem passar o limite em até X
    recupera_seg: 20,
    // tempo para inspecionar um bicho com a lupa
    inspecionar_seg: 2,
  },

  // ---------------------------------------------------------
  // Brigas entre bichos (cadeia alimentar)
  // ---------------------------------------------------------
  brigas: {
    chance_caca_seg: 0.25,     // carnívoro com fome: chance por segundo de procurar presa
    raio_busca_m: 45,          // até onde ele enxerga uma presa
    presa_tamanho_max: 1.8,    // caça herbívoro até 1,8× o tamanho dele (em bando vai mais)
    come_carnivoro_menor: 0.6, // grandões comem carnívoros com menos de 60% do tamanho
    chance_rival: 0.35,        // chance de brigar com outro carnívoro parecido (território)
    saciado_seg: 70,           // depois de comer, fica X s sem caçar
    comendo_seg: 14,           // tempo comendo a carcaça
  },

  // ---------------------------------------------------------
  // Dia e noite
  // ---------------------------------------------------------
  dia: {
    duracao_dia_min: 7,        // minutos de dia claro (do amanhecer ao anoitecer)
    duracao_noite_min: 3,      // minutos de noite
    hora_inicial: 0.3,         // 0 = meia-noite, 0.25 = amanhecer, 0.5 = meio-dia
    frio_noite_c: -6,          // quanto esfria à noite
  },

  // ---------------------------------------------------------
  // Dificuldade (para dar tempo de se preparar)
  // ---------------------------------------------------------
  dificuldade: {
    zona_segura_m: 70,         // carnívoros não nascem perto das praias de renascer e dos sacos de dormir
    inicio_tranquilo_min: 5,   // depois de nascer/renascer: poucos carnívoros e fracos
    nivel_max_inicio: 6,       // nível máximo dos bichos nesse começo
    peso_carnivoros: 0.6,      // 1 = normal; menor = menos carnívoros
    max_carnivoros_perto: 4,   // nunca mais que isso de carnívoros vivos por perto
    agro_noite: 1.25,          // à noite os predadores enxergam mais longe
  },

  // ---------------------------------------------------------
  // Fogueira
  // ---------------------------------------------------------
  fogueira: {
    madeira_por_acender: 2,    // madeira gasta para acender / pôr mais lenha
    minutos_por_lenha: 5,      // quanto tempo fica acesa com cada lenha
    segundos_por_carne: 6,     // tempo para assar cada carne
    raio_m: 4,                 // perto assim a fogueira assa e esquenta
    calor_c: 12,               // quanto esquenta perto
  },

  // ---------------------------------------------------------
  // Desempenho
  // ---------------------------------------------------------
  desempenho: {
    criaturas_max_ativas: 22,  // máximo de criaturas vivas perto do jogador
  },

  // ---------------------------------------------------------
  // Metas de ritmo do jogo (referência para as próximas fases)
  // ---------------------------------------------------------
  ritmo: {
    primeiro_domavel_min: 10,
    chegar_ao_metal_horas: 3.5,
  },
};
