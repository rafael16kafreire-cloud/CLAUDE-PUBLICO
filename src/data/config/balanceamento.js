// =============================================================
//  BALANCEAMENTO – TODOS OS NÚMEROS DO JOGO FICAM AQUI
//
//  Como mudar: troque só o número depois dos dois-pontos.
//  Tudo depois de "//" é explicação e o jogo ignora.
//  Depois de mudar, gere o jogo de novo (npm run build).
// =============================================================
import { MAX_LEVEL, ATTRIBUTES } from '../../progression/progression_config.js';

export default {
  // ---------------------------------------------------------
  // Atributos máximos do jogador (nível 1)
  // ---------------------------------------------------------
  // (nível, XP, atributos e engramas ficam em src/progression/progression_config.js)
  jogador: {
    vida_max: ATTRIBUTES.vida.base,
    stamina_max: ATTRIBUTES.stamina.base,
    fome_max: ATTRIBUTES.comida.base,
    sede_max: ATTRIBUTES.agua.base,
    folego_max: ATTRIBUTES.oxigenio.base,
    peso_max: ATTRIBUTES.peso.base,
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
    // mutação (como no ARK): 3 sorteios por filhote; cada um que sai dá +2 pontos
    // num atributo (+2 níveis) e às vezes muda uma cor. Para quando o casal soma 20.
    mutacao: 0.025,
    mutacao_limite: 20,
    acasalar_seg: 60,
    par_distancia_m: 20,       // "par por perto" (Mate Boost): macho e fêmea domados a até X m
    par_resistencia: 0.33,     // com o par por perto leva 33% menos dano (como no ARK)          // casal com "Permitir cruzar" perto: tempo para acasalar
    cuidado_min: 2,            // filhote domado pede carinho a cada X min
    impressao_por_cuidado: 0.2, // cada carinho dá 20% de impressão
    bonus_impressao: 0.3,      // 100% de impressão = +30% de vida e dano
  },
  // Nível máximo (a conta de XP está em progression_config.js)
  nivel: { max: MAX_LEVEL },

  // ---------------------------------------------------------
  // Bichos montados (como no ARK): atacando sem bicho na frente, cada
  // espécie coleta o que sabe (coleta) e rende mais (rende = vezes);
  // area = quantas plantas/pedras pega de uma vez. O que coleta vai para
  // o inventário do bicho. especial = tecla Q (celular: arrastar para baixo).
  // ---------------------------------------------------------
  montaria: {
    coleta: {
      triceratops:      { modo: 'colher', alvos: ['plantas'], rende: 3, area: 3 },
      paquirrinossauro: { modo: 'colher', alvos: ['plantas'], rende: 3, area: 2 },
      estegossauro:     { modo: 'colher', alvos: ['plantas'], rende: 2, area: 3 },
      kentrossauro:     { modo: 'colher', alvos: ['plantas'], rende: 2, area: 2 },
      parassauro:       { modo: 'colher', alvos: ['plantas'], rende: 2, area: 2 },
      iguanodonte:      { modo: 'colher', alvos: ['plantas'], rende: 2, area: 2 },
      edmontossauro:    { modo: 'colher', alvos: ['plantas'], rende: 2, area: 2 },
      moschops:         { modo: 'colher', alvos: ['plantas'], rende: 2, area: 1 },
      anquilossauro:    { modo: 'picareta', alvos: ['pedras'], rende: 3, area: 1 },
      sauropelta:       { modo: 'picareta', alvos: ['pedras'], rende: 2, area: 1 },
      mamute:           { modo: 'machado', alvos: ['arvores'], rende: 4, area: 1 },
      paraceraterio:    { modo: 'machado', alvos: ['arvores', 'plantas'], rende: 3, area: 2 },
      terizinossauro:   { modo: 'machado', alvos: ['arvores', 'plantas'], rende: 3, area: 2 },
      braquiossauro:    { modo: 'machado', alvos: ['arvores', 'plantas'], rende: 2, area: 4 },
      diplodoco:        { modo: 'machado', alvos: ['arvores', 'plantas'], rende: 2, area: 4 },
      argentinossauro:  { modo: 'machado', alvos: ['arvores', 'plantas'], rende: 2, area: 5 },
      // carnívoros: tiram muito mais carne e couro das carcaças
      trex:             { carcaca: 4 },
      giganotossauro:   { carcaca: 4 },
      espinossauro:     { carcaca: 3 },
      carnotauro:       { carcaca: 3 },
      barionix:         { carcaca: 3 },
      suchomimo:        { carcaca: 3 },
      raptor:           { carcaca: 2 },
      dilofossauro:     { carcaca: 2 },
      argentavis:       { carcaca: 3 },
      deinosuchus:      { carcaca: 3 },
      sarcosuchus:      { carcaca: 3 },
    },
    // tipo de recurso (recursos.json) de cada grupo de alvos
    grupos: {
      plantas: ['arbusto', 'baga_mejo', 'baga_escura', 'frutas', 'bananeira', 'planta', 'samambaia', 'samambaia_gigante', 'junco'],
      pedras: ['rochedo', 'pedra', 'ferro', 'metal', 'obsidiana', 'cristal', 'petroleo'],
      arvores: ['arvore', 'arvore_mole', 'arvore_gigante', 'palmeira', 'tronco'],
    },
    // especiais: investida (corre para a frente quebrando plantas e árvores e
    // acertando bichos), bote (pulo curto que morde forte)
    especiais: {
      triceratops:      { tipo: 'investida', vel: 16, seg: 0.8, dano: 2, stamina: 35, espera: 4 },
      paquirrinossauro: { tipo: 'investida', vel: 14, seg: 0.7, dano: 2, stamina: 30, espera: 4 },
      paquicefalossauro:{ tipo: 'investida', vel: 13, seg: 0.6, dano: 2.5, stamina: 25, espera: 3 },
      mamute:           { tipo: 'investida', vel: 12, seg: 0.9, dano: 1.5, stamina: 40, espera: 5 },
      estegossauro:     { tipo: 'investida', vel: 10, seg: 0.6, dano: 1.5, stamina: 30, espera: 4 },
      raptor:           { tipo: 'bote', vel: 18, seg: 0.35, dano: 2.5, stamina: 20, espera: 2.5 },
      compsognato:      { tipo: 'bote', vel: 12, seg: 0.3, dano: 2, stamina: 10, espera: 2 },
      dilofossauro:     { tipo: 'bote', vel: 14, seg: 0.35, dano: 2, stamina: 15, espera: 2.5 },
      carnotauro:       { tipo: 'investida', vel: 17, seg: 0.6, dano: 2, stamina: 30, espera: 4 },
      trex:             { tipo: 'investida', vel: 12, seg: 0.6, dano: 1.8, stamina: 40, espera: 5 },
    },
  },

  // ---------------------------------------------------------
  // Chefes (Mamute de Gelo, Rei do Abismo, Senhor do Pântano): moram num
  // covil fixo; vida, dano e o que deixam estão em criaturas.json
  // ---------------------------------------------------------
  chefes: {
    aparece_m: 200,            // aparece quando alguém chega a essa distância do covil
    renascer_min: 30,          // depois de morto, volta em X minutos
    nivel: 100,                // nível mostrado
    acorda_m: 35,              // o dragão dorme na lava até alguém chegar a X m
    lava_dano_seg: 20,         // pisar na lava tira X de vida por segundo
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
    intervalo_auto_seg: 0.5,    // coleta contínua (toque duplo no Interagir): uma colheita a cada X s até 100%
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
    limite_domados: 600,       // quantos bichos domados você pode ter (aparece no inventário)
    espacos_inventario: 30,    // espaços no inventário de cada bicho
    racao_vale: 2,             // a Ração vale X comidas preferidas e não baixa a efetividade
    efetividade_por_comida: 0.015, // cada mordida de comida preferida baixa a efetividade (ARK)
    efetividade_outra_comida: 0.04, // comida que não é a preferida baixa mais
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
    // Praias com bando: pontos fixos da costa onde sempre vive um grupo (quando você chega perto).
    // especies = quantos de cada; raio_m = tamanho da área; os pontos são sorteados na costa
    // (separados uns dos outros) com sempre o mesmo resultado em cada mapa.
    bandos_praia: [
      { nome: 'Praia dos Dodôs', especies: { dodo: 14 }, raio_m: 45 },
      { nome: 'Enseada dos Dodôs', especies: { dodo: 10, lystrosaurus: 4 }, raio_m: 40 },
      { nome: 'Praia dos Pastores', especies: { galimimo: 6, moschops: 5, dodo: 4 }, raio_m: 55 },
      { nome: 'Praia dos Lystrosaurus', especies: { lystrosaurus: 8, dodo: 5 }, raio_m: 40 },
      { nome: 'Praia dos Compsognatos', especies: { compsognato: 8, dodo: 6 }, raio_m: 40 },
    ],
    separacao_bandos_m: 700,
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
