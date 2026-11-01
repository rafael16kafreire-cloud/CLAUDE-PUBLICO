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
    stamina_max: 100,    // igual ao ARK (nível 1)
    fome_max: 100,       // barra de comida (cheia = sem fome)
    sede_max: 100,       // barra de água (cheia = sem sede)
    folego_max: 100,     // ar embaixo d'água
    peso_max: 100,       // kg que carrega (igual ao ARK; até 150% anda devagar)
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
    satisfeito: 0.6,           // só bebe se faltar pelo menos 60% de um gole
    cura_por_fome: 0.5,        // comer recupera vida: metade da fome que o alimento dá (carne assada tem o seu valor próprio)
    vida_comer_cheio: 0.8,     // com a fome 100% só come se a vida estiver abaixo de 80%
  },

  // ---------------------------------------------------------
  // Stamina (energia para correr, pular e nadar)
  // ---------------------------------------------------------
  stamina: {
    gasto_correr_seg: 6.7,     // por segundo correndo (100 de stamina = ~15 s). Andar não gasta nada
    gasto_pulo: 10,            // por pulo (10 pulos)
    gasto_nado_seg: 5,         // por segundo nadando (20 s)
    gasto_nado_rapido_seg: 8,  // por segundo nadando rápido
    gasto_golpe_ferramenta: 6, // por golpe de ferramenta (coleta); o soco gasta 4 (combate.soco_stamina)
    regen_parado_seg: 10,      // recuperação por segundo parado (enche em 10 s)
    regen_andando_seg: 5,      // recuperação por segundo andando
    regen_na_agua: 0.3,        // boiando parado recupera só 30% disso
    espera_regen_seg: 1.5,     // espera antes de começar a recuperar
    exausto_volta_em: 20,      // ao zerar, fica exausto (sem correr nem pular) até voltar a este valor
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
    agachar_intervalo_seg: 0.45, // tempo mínimo entre agachar e levantar
    agachado: 2.0,
    na_agua_rasa: 0.7,         // andando com água pela cintura: 70% da velocidade
    nadar: 3.0,
    nadar_rapido: 4.8,
    pulo: 8.8,                 // força do pulo (altura ~1,75 m)
    pulo_frente_parado: 2.6,   // m/s para frente ao pular parado
    pulo_frente_andando: 1.4,  // extra ao pular andando
    pulo_frente_correndo: 2.6, // extra ao pular correndo (vai bem mais longe)
    gravidade: 22,
    inclinacao_max_graus: 55,  // rampas mais íngremes que isso não dá para subir
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
    // frio de verdade (Lapônia): abaixo disso a fome cai mais rápido…
    fome_frio_abaixo_c: 6,
    fome_frio_mult: 1.6,
    // …e abaixo disso você congela (perde vida). Fogueira e casaco ajudam.
    congelando_c: 0,
    dano_frio_seg: 0.6,
    casaco_c: 16,              // o Casaco de Pele (na mochila) esquenta isso
  },

  // ---------------------------------------------------------
  // Níveis e XP
  // ---------------------------------------------------------
  // Habilidades: a cada nível ganha pontos para gastar (Inventário →
  // Habilidades). Quanto cada ponto aumenta:
  habilidades: {
    pontos_por_nivel: 1,
    // valores iguais aos do ARK
    vida: 10,       // +10 de vida máxima
    stamina: 10,    // +10 de stamina máxima
    fome: 10,       // +10 na barra de comida (dura mais)
    sede: 10,       // +10 na barra de água (dura mais)
    folego: 20,     // +20 de fôlego (oxigênio) embaixo d'água
    peso: 10,       // +10 kg que carrega
    forca: 5,       // +5% de dano corpo a corpo
    velocidade: 1.5,// +1,5% de velocidade de andar/correr
    fortitude: 2,   // +2 °C de resistência ao frio e ao calor
    criacao: 10,    // +10% de velocidade de criação (fila de fabricação)
  },

  // Engramas (como no ARK): ao subir de nível você ganha pontos para
  // APRENDER receitas. Cada receita pede um nível mínimo e um custo
  // (data/crafting/receitas.json: nivel e engrama).
  engramas: {
    // pontos de engrama ganhos ao CHEGAR em cada nível (igual ao ARK):
    // 1º número = nível 2, 2º = nível 3 … até o nível 105.
    por_nivel: [
      8, 8, 8, 8, 8, 8, 8, 8, 12, 12, 12, 12, 12, 12,
      12, 12, 12, 12, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16,
      20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 24, 24, 24, 24,
      24, 24, 24, 24, 24, 24, 28, 28, 28, 28, 28, 28, 28, 28,
      28, 28, 40, 40, 40, 40, 40, 40, 40, 40, 40, 40, 40, 40,
      40, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50,
      50, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 70,
      70, 70, 70, 70, 70, 70,
    ],
  },

  // Comida estraga com o tempo (minutos por unidade: "estraga_min" em
  // data/items/itens.json). Carne crua estragada vira Carne Estragada.
  estragar: {
    no_bau_mult: 0.25,         // dentro do baú estraga 4× mais devagar
  },

  // Arco e flechas
  arco: {
    velocidade_m_s: 48,        // velocidade da flecha
    gravidade: 9.8,            // a flecha cai com a distância
    intervalo_seg: 0.9,        // tempo entre um tiro e outro
    alcance_m: 120,            // depois disso a flecha some
    xp_acerto: 0.1,
  },

  // Armadura (roupas de pele vestidas): cada peça tira X% do dano
  armadura: {
    max_reducao: 0.95,         // nunca tira mais que 95% do dano
    desgaste_por_golpe: 1,     // durabilidade que cada peça perde por golpe levado
  },

  // Construção (peças com vida; bichos mordem as que estão no caminho)
  construcao: {
    dano_bicho_mult: 3,        // bicho faz 3x mais dano em parede do que em gente
  },

  // Montaria
  sela: {
    precisa: true,             // só monta bicho com sela (como no ARK)
    porte_m: [5, 11],          // até 5 m: Sela; até 11 m: Sela Média; maior: Sela Grande
  },

  // Criação de bichos domados (como no ARK): macho e fêmea domados,
  // parados perto um do outro, cruzam. Répteis e aves botam ovo (precisa
  // ficar quentinho para chocar); mamíferos ficam prenhes.
  cria: {
    chocar_min: 4,             // ovo choca em X min (no calor certo)
    ovo_temp_c: [18, 38],      // temperatura boa para o ovo; fora dela choca 4x mais devagar
    gestacao_min: 5,           // mamífero: filhote nasce depois de X min
    mamiferos: ['mamute'],
    chance_maior: 0.55,        // cada atributo do filhote: chance de vir o MAIOR dos pais
    mutacao: 0.03,             // chance de um atributo vir 10% maior (mutação)
    cuidado_min: 2,            // filhote domado pede carinho a cada X min
    impressao_por_cuidado: 0.2, // cada carinho dá 20% de impressão
    bonus_impressao: 0.3,      // 100% de impressão = +30% de vida e dano
  },

  nivel: {
    max: 105,                  // nível máximo do jogador (igual ao ARK)
    // XP para passar de cada nível ao próximo (tabela do ARK):
    // 1º número = do 1 ao 2, 2º = do 2 ao 3 … até chegar no 105.
    xp_por_nivel: [
      5, 15, 20, 30, 50, 70, 80, 90, 90, 100, 110, 120,
      130, 140, 150, 160, 170, 180, 190, 200, 210, 220, 230, 240,
      250, 260, 270, 280, 290, 300, 310, 320, 330, 340, 350, 360,
      370, 380, 390, 400, 410, 420, 430, 440, 450, 460, 470, 480,
      490, 500, 510, 520, 530, 540, 550, 560, 570, 580, 590, 1150,
      2228, 1370, 1460, 1554, 2037, 2750, 4537, 5218, 6801, 7957, 8952, 9286,
      12000, 13000, 14000, 15500, 17000, 19000, 21000, 23000, 25070, 27326, 29785, 33508,
      37697, 42432, 48166, 54702, 60172, 66189, 72807, 80088, 88096, 98000, 112000, 130000,
      155000, 190000, 240000, 300000, 370000, 450000, 540000, 640000,
    ],
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
  },

  // ---------------------------------------------------------
  // Combate (soco por enquanto; armas na Fase 3)
  // ---------------------------------------------------------
  // Coleta: tempo mínimo entre uma coleta e outra (não fica rápido demais)
  coleta: {
    intervalo_bater_seg: 0.36, // bater em árvore/pedra/planta (Atacar)
    intervalo_colher_seg: 0.36, // colher com a mão (Interagir: bagas, fibra...)
  },

  combate: {
    soco_dano: 10,             // dano de um soco
    soco_alcance_m: 1.1,       // distância do soco (o tamanho do braço, a partir do centro do corpo)
    soco_intervalo_seg: 0.36,  // tempo entre socos (360 ms)
    soco_stamina: 4,           // stamina gasta por soco
    soco_arvore_dura_vida: 0.05, // socar árvore dura tira 5% da vida máxima
  },

  // ---------------------------------------------------------
  // Domar e montar
  // Soco e clava dão torpor (sono). Torpor no máximo = o bicho desmaia.
  // Desmaiado: dê a comida preferida dele (Interagir) até a barra de
  // domar encher. Se o torpor acabar antes, ele acorda.
  // ---------------------------------------------------------
  domar: {
    bonus_niveis: 0.5,         // domado ganha até +50% de nível (efetividade 100%)
    efetividade_por_dano: 1.5, // bater no bicho desmaiado: perde efetividade (dano/vida x 1,5)
    torpor_por_dano: { mao: 1.6, clava: 3.0, outro: 0.2 }, // torpor = dano × isto
    torpor_cai_seg: 0.03,      // acordado: torpor cai X do máximo por segundo
    desmaio_cai_seg: 0.0065,   // desmaiado: cai X do máximo por segundo (~2,5 min)
    comer_a_cada_seg: 7,       // come uma comida a cada X s (devagar, como no ARK)
    comidas_base: 10,          // comidas preferidas para domar no nível 1
    comidas_por_nivel: 0.5,    // + X por nível (nível 30 pede ~25 comidas = 3 min: precisa de narcótico)
    comida_qualquer: 0.25,     // comida que não é a preferida vale isso
    baga_escura_torpor: 0.15,  // cada baga-escura dada põe +15% de torpor
    narcotico_torpor: 0.3,     // cada Narcótico dado põe +40% de torpor
    seguir_m: 4,               // distância que o bicho domado fica de você
  },

  // ---------------------------------------------------------
  // Criaturas (dados de cada espécie: data/creatures/criaturas.json)
  // ---------------------------------------------------------
  criaturas: {
    carnivoro_cansado: 1.12,   // carnívoro sem fôlego ainda corre 12% mais que você andando
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
    max_carnivoros_perto: 4,   // carnívoros vivos por perto a cada 20 bichos (qualidade alta, 45 bichos: 9)
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
    criaturas_max_ativas: 45,  // máximo de bichos vivos por perto
    extra_na_neve: 20,         // na Lapônia (neve) cabem mais estes
  },

  // ---------------------------------------------------------
  // Metas de ritmo do jogo (referência para as próximas fases)
  // ---------------------------------------------------------
  ritmo: {
    primeiro_domavel_min: 10,
    chegar_ao_metal_horas: 3.5,
  },
};
