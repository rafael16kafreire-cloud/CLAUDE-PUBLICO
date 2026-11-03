# Índice do código do Ilha Primordial

Gerado automaticamente. Para cada arquivo: o que faz (comentário de abertura do próprio arquivo), o que exporta e as funções/métodos principais.
Linguagem: JavaScript (módulos ES). Motor gráfico: three.js. Empacotador: esbuild.


## ./

### `build.mjs` (155 linhas)
> =============================================================
> GERAR O JOGO:  npm run build
> Junta todo o código num único arquivo HTML que roda offline:
>   dist/ilha-primordial.html   -> abrir no navegador (PC/celular)
>   build/artifact.html         -> versão para publicar no Claude
>   android/app/src/main/assets/index.html -> usado pelo app Android
> =============================================================

**Funções/métodos:** `setup`

## src/audio/

### `src/audio/audio.js` (1194 linhas)
> =============================================================
> SONS – gerados por código (Web Audio). Leve para o celular.
> - Eco de floresta (reverberação) em tudo: o som não fica "seco".
> - Vozes (bichos e jogador) com filtros de vogal (formantes) e um
>   pouco de distorção: soam como garganta, não como apito.
> - Golpes em madeira/pedra ressoam como o material (ressonadores).
> - Sons gravados (opcional): ponha arquivos em assets/sons/ com o
>   nome do som (ex.: passo_mato.mp3, madeira.ogg, bicho_trex.mp3,
>   bicho_trex_ataque.mp3; variações: madeira_1.mp3, madeira_2.mp3).
>   Se existir, o jogo toca o arquivo no lugar do som gerado.
> 
>  - Ambiente: de dia vento, pássaros e insetos; à noite grilos,
>    sapos e corujas. Perto do pântano, mais sapos.
>  - Efeitos: passos, golpe no ar, madeira, pedra, folhas, carne,

**Exporta:** `sound`

**Funções/métodos:** `unlock`, `setMusicVolume`, `setVolume`, `setPaused`, `setUnderwater`, `_makeIR`, `_shaper`, `_loadSamples`, `_sample`, `_throat`, `_modal`, `_makeNoise`, `ready`, `_dest`, `_voice`, `_env`, `_osc`, `_noise`, `_assobio`, `play`, `creature`, `_startWind`, `setChuva`, `_startRain`, `_startFire`, `update`, `_ambOut`, `_bird`, `_startCicadas`, `_updateMusic`, `setPerseguicao`, `_updateChase`, `_chaseStep`, `_tocarFaixa`, `_insect`, `_cricket`, `_frog`, `_owl`, `_crackle`

## src/core/

### `src/core/balance.js` (14 linhas)
> =============================================================
> BALANCE – dá acesso aos números do arquivo de balanceamento
> (src/data/config/balanceamento.js) para o resto do jogo.
> =============================================================

**Exporta:** `BALANCE`, `perSecond`


### `src/core/estilo_mundo.js` (9 linhas)
> =============================================================
> ESTILO DO MUNDO
>   REALISTA = true : chão com textura e relevo suave, árvores, folhas, arbustos e pedras com
>                     textura (como no ARK).
>   REALISTA = false: o estilo low-poly (faces planas e cores chapadas da paleta).
> Vale ao abrir o jogo.
> =============================================================

**Exporta:** `REALISTA`


### `src/core/event_bus.js` (86 linhas)
> =============================================================
> CENTRAL DE EVENTOS (EventBus)
> Um sistema "avisa" que algo aconteceu (emit) e qualquer outro
> sistema interessado "escuta" (on). Assim as partes do jogo não
> precisam se conhecer diretamente.
> =============================================================

**Exporta:** `EV`, `events`

**Funções/métodos:** `on`, `off`, `emit`

### `src/core/game_manager.js` (42 linhas)
> =============================================================
> GAME MANAGER – estado global do jogo
> Guarda "em que tela estamos" (carregando, menu, jogando, pausado,
> morto) e referências para as peças principais (mundo, jogador...).
> =============================================================

**Exporta:** `STATE`, `game`

**Funções/métodos:** `setState`, `playing`

### `src/core/input.js` (208 linhas)
> =============================================================
> INPUT – junta teclado/mouse (PC) e controles de toque (celular)
> num lugar só. O resto do jogo só pergunta coisas como:
> "para onde quer andar?", "apertou pular?", "está segurando correr?"
> 
> Ações: jump, run, interact, crouch, camera, debug, pause,
>        attack, inventory, build, mount
> =============================================================

**Exporta:** `MOUSE_LOOK_FACTOR`, `TOUCH_LOOK_FACTOR`, `input`

**Funções/métodos:** `attach`, `requestPointerLock`, `exitPointerLock`, `press`, `release`, `tap`, `addLook`, `consumeLook`, `isHeld`, `wasPressed`, `moveVector`, `endFrame`, `clear`

### `src/core/math.js` (34 linhas)
> Pequenas funções matemáticas usadas em vários lugares.

**Exporta:** `clamp`, `lerp`, `smoothstep`, `mulberry32`, `angleDelta`


### `src/core/movimento_config.js` (39 linhas)
> =============================================================
> MOVIMENTO, STAMINA E VELOCIDADE – constantes (velocidades de cada bicho: data/creatures/criaturas.json)
> =============================================================

**Exporta:** `STAMINA_BASE`, `STAMINA_PER_LEVEL`, `STAMINA_REGEN_DELAY`, `STAMINA_REGEN_PCT_PER_SEC`, `SPRINT_SECONDS_DEFAULT`, `TAMED_SPEED_PER_BONUS_LEVEL`, `TAMED_SPEED_BONUS_CAP`, `ATTACK_STAMINA`, `SIZE_CLASS_MAX_M`, `OVERWEIGHT_SPEED_MULT`, `PLAYER_WALK`, `PLAYER_RUN`, `PLAYER_SPRINT_S`, `PLAYER_SWIM`, `sizeClass`


### `src/core/noise.js` (81 linhas)
> =============================================================
> RUÍDO (noise) – gera "morros" e variações naturais.
> Implementação do Simplex Noise 2D com semente.
> =============================================================

**Exporta:** `createNoise2D`, `fbm`


### `src/core/paleta.js` (55 linhas)
> =============================================================
> PALETA DO JOGO – 16 cores terrosas e dessaturadas (estilo low-poly
> inspirado em Valheim). TODA cor do mundo sai daqui: terreno, céu,
> luz, água, rochas, árvores, construções e bichos.
> 
> >>> PARA AJUSTAR O VISUAL: mude os hex abaixo e rode `npm run build`.
>     Cada cor tem um nome; o resto do código pede pelo nome
>     (ex.: PALETA.musgo), nunca pelo número.
> 
> Dicas:
> - Deixe as cores "sujas" (pouca saturação): é o que dá o clima.
> - O sol e o fogo usam o laranja quente; a sombra e a noite usam os
>   azuis frios. O contraste quente x frio é o que faz a cena "viver".
> =============================================================

**Exporta:** `PALETA_HEX`, `PALETA`, `mistura`, `misturaHex`


### `src/core/save.js` (207 linhas)
> =============================================================
> JOGO SALVO – guarda o progresso no aparelho (localStorage)
> O que vai: jogador (posição, barras, nível, habilidades), mochila,
> hora/dia, construções e bichos domados. Salva sozinho a cada
> 30 s, ao pausar e ao sair/minimizar o jogo.
> =============================================================

**Exporta:** `loadGame`, `saveGame`, `hasSave`, `clearSave`, `SLOTS`, `saveSlot`, `listSlots`, `useSlot`, `slotLabel`, `getActiveSlot`, `setActiveSlot`, `deleteSlot`, `mainSummary`, `resetLevelSlot`, `resetLevelMain`, `newGameInSlot`


### `src/core/settings.js` (113 linhas)
> =============================================================
> SETTINGS – opções escolhidas pelo jogador
> Ficam salvas no próprio navegador (localStorage). Se o navegador
> não deixar salvar (aba anônima, por exemplo), o jogo funciona
> normalmente com os valores padrão.
> =============================================================

**Exporta:** `QUALITY_PRESETS`, `settings`, `hdTextures`

**Funções/métodos:** `get`, `set`, `quality`, `_load`, `_save`

### `src/core/timings.js` (16 linhas)
> =============================================================
> TEMPOS (todos os tempos de animação e de feedback ficam aqui)
> ms = milissegundos, s = segundos
> =============================================================

**Exporta:** `LEVELUP_TOAST_IN_MS`, `LEVELUP_TOAST_HOLD_MS`, `LEVELUP_TOAST_OUT_MS`, `LEVELUP_PARTICLES_S`, `LEVELUP_VIBRATE_MS`, `RESET_POTION_DRINK_S`, `COMBAT_COOLDOWN_S`


## src/crafting/

### `src/crafting/crafting.js` (123 linhas)
> =============================================================
> CRAFTING – criar itens a partir das receitas
> (data/crafting/receitas.json). Os ingredientes saem na hora;
> o item fica pronto depois do tempo da receita (fila).
> =============================================================

**Exporta:** `RECIPES`, `STATION_NAMES`, `Crafting`

**Funções/métodos:** `missingStation`, `requirements`, `maxTimes`, `locked`, `craft`, `cancel`, `cancelAll`, `progress`, `update`

## src/creatures/

### `src/creatures/bocas.js` (23 linhas)
> =============================================================
> BOCAS: alguns modelos importados vêm de boca aberta (posados rugindo) e
> sem osso de mandíbula. Aqui ficam os números para o jogo criar o osso
> 'jaw', fechar a boca na pose parada e abrir só ao comer, rugir ou atacar.
> Gerado por: python tools/models/bocas.py <espécie> ...
>   dir    = lado do focinho no eixo z do modelo (-1 = olha para -z)
>   zr     = z da nuca;  hz, hy = dobradiça da mandíbula (z, y)
>   A, B   = reta y = A + B * (distância da nuca) que separa a mandíbula
>            de baixo (vai para o osso) da de cima
>   fecha  = quanto girar a mandíbula de baixo para fechar (radianos)
> =============================================================

**Exporta:** `BOCAS`


### `src/creatures/breeding_config.js` (48 linhas)
> Ovos e reprodução – tudo na medida do ARK (1x), sem multiplicadores.
> Etiquetas: [OK] conferido (wiki do ARK / GUIA guildorder.com), [PENDENTE] não consegui conferir
> (a wiki ark.wiki.gg não abre nesta sessão), [CUSTOM] decisão de design.

**Exporta:** `BREEDING`, `CRIA_ESPECIE`, `MAMIFEROS`, `criaDe`, `ESTERIL`, `ASEXUADA`, `EGG_LIMIT_DEFAULT`, `EGG_LIMIT`, `eggLimit`


### `src/creatures/clip_player.js` (162 linhas)
> =============================================================
> ANIMAÇÕES DO PRÓPRIO MODELO (clipes)
> Alguns bichos vieram com animação feita pelo autor (andar, voar,
> rugir, dar o bote...). O conversor (tools/models/bichos_animados.sh)
> guarda o giro de cada osso em cada quadro; aqui o jogo toca esses
> quadros nos ossos, misturando com a animação feita por código.
> 
> Papéis de clipe que o jogo usa:
>   andar  – no chão andando/correndo (velocidade pelo tamanho do passo)
>   parado – parado em pé
>   voar   – voando
>   rugido – uma vez, quando começa a caçar
>   ataque – uma vez, a cada golpe
> =============================================================

**Exporta:** `parseClips`, `ClipPlayer`

**Funções/métodos:** `has`, `play`, `update`, `reset`, `apply`

### `src/creatures/cores.js` (145 linhas)
> =============================================================
> CORES DOS BICHOS – cada bicho selvagem nasce com uma combinação de
> cores própria (costas e barriga), com as cores de bicho do ARK
> (Marrom-Escuro Dino, Verde-Escuro Dino...): a maioria tons naturais,
> alguns com cor forte (vermelho, azul) e, bem raro, albino.
> Feito no desenho do corpo: a cor nova troca o tom mas mantém o
> claro/escuro da pele (escamas, listras e relevo continuam).
> Cada bicho colorido ganha uma cópia do material com 3 números.
> O filhote herda cada região do pai ou da mãe.
> =============================================================

**Exporta:** `CORES_ARK`, `sortearCor`, `nomeCor`, `mutarCor`, `herdarCor`, `clonarMaterial`, `aplicarCor`


### `src/creatures/creature.js` (1960 linhas)
> =============================================================
> CRIATURA – comportamento (IA) e animação
> Máquina de estados: vagar, parado, comer, fugir, perseguir,
> atacar, voltar ao território e morto.
> Temperamentos (data/creatures/criaturas.json):
>   agressivo  – carnívoros: caçam o jogador e outros animais
>   passivo    – herbívoros: só reagem se apanharem
>                (revida = ataca de volta; senão foge)
>   medroso    – fogem quando alguém chega perto
> =============================================================

**Exporta:** `CSTATE`, `FOLLOW_DIST`, `TARGET_RANGE`, `Creature`

**Funções/métodos:** `rollStats`, `applyStats`, `_deriveStats`, `seat`, `saddleNeed`, `setSaddle`, `care`, `_matura`, `advanceOffline`, `setGrowth`, `stage`, `isBaby`, `walkSpeed`, `runSpeed`, `alive`, `knockedOut`, `tameTimeLeft`, `tameNeed`, `addTorpor`, `_knockOut`, `ensureInv`, `feed`, `tameFood`, `tameFoodNext`, `foodValue`, `_updateKO`, `_tame`, `radius`, `height`, `position`, `update`, `_think`, `_thinkTamed`, `_updateRidden`, `_updateRiddenFlying`, `_canReach`, `_findFood`, `_setState`, `_flee`, `_chase`, `_noticeAttacker`, `_updateGround`, `_updateFlying`, `standHeight`, `_findLandingSpot`, `_land`, `_takeOff`, `_updateLanded`, `_steer`, `_face`, `_brake`, `_advance`, `_canStand`, `_groundY`, `_pickWanderPoint`, `_reach`, `_dist2D`, `_dist2DXY`, `takeDamage`, `_animate` …

### `src/creatures/creature_builder.js` (423 linhas)
> =============================================================
> CONSTRUTOR DE CRIATURAS (modelos feitos por código)
> Cada espécie é descrita em creature_models.js por uma "coluna"
> (da ponta da cauda até o focinho), pernas, braços, asas e
> detalhes. Aqui isso vira UMA malha com esqueleto (ossos):
>   - corpo arredondado, barriga clara e costas escuras
>   - pele (escamas/pelo/penas) e desenho (listras, manchas...) de
>     cada espécie, desenhados pela placa de vídeo (creature_material.js)
>   - ossos para pernas, cauda, pescoço, cabeça e asas (animação)
>   - 1 desenho por criatura (leve para o celular)
> =============================================================

**Exporta:** `LOWPOLY`, `corDaPaleta`, `buildSpeciesModel`, `createSkinnedMesh`

**Funções/métodos:** `bone`, `b`, `vertex`, `addGeometry`, `tube`, `segment`, `ellipsoid`, `cone`, `membrane`, `build`

### `src/creatures/creature_manager.js` (1452 linhas)
> =============================================================
> GERENCIADOR DE CRIATURAS
> - Faz nascer criaturas perto do jogador, de acordo com o bioma
>   (no máximo 15 ativas – balanceamento: desempenho).
> - Remove as que ficaram longe (economiza o celular).
> - Resolve ataques, mortes, XP e colisão com o jogador.
> =============================================================

**Exporta:** `SPECIES`, `CreatureManager`

**Funções/métodos:** `maxActive`, `maxCarnivores`, `_model`, `_wildLevel`, `spawn`, `remove`, `clear`, `update`, `trySpawnNear`, `tryBreed`, `inheritStats`, `breedTamed`, `hatch`, `birth`, `covil`, `_makeLava`, `_updateLava`, `ensureBosses`, `_beachSpots`, `ensureBeachHerds`, `ensureSwampResidents`, `nivelPerseguicao`, `nearestCarcass`, `findCorpse`, `harvestCorpse`, `snapshotNear`, `applySnapshot`, `byNid`, `onNetDamage`, `forgetTarget`, `alertPack`, `findPrey`, `hit`, `onDeath`, `playerAttack`, `defendOwner`, `riderAttack`, `efeitosDoGolpe`, `escolherGolpeIA`, `addDot`, `_updateDots`, `mountSkill`, `_dashSkill`, `usarHabilidade`, `mountHarvest`, `_updateDash`, `_updateFireBreath`, `_breakInPath`, `tamedBy`, `findMountable`, `onKnockOut`, `onWake`, `onTamed`, `findAimed`, `resolvePlayer`, `_separate`

### `src/creatures/creature_material.js` (173 linhas)
> =============================================================
> PELE DOS ANIMAIS (desenhada pela placa de vídeo, original)
> Cada vértice do modelo diz:
>   aPat    = (desenho, frequência, força, pele)
>   aPatCol = cor do desenho (rgb) + tamanho das escamas (a: por metro)
> Desenhos: 0 nenhum, 1 listras, 2 manchas, 3 pintas de onça
>           (rosetas), 4 mosqueado, 5 anéis/faixas, 6 faixa nas costas
> Pele:     0 escamas, 1 pelo, 2 penas, 3 lisa (olhos, chifres, dentes)
> O desenho usa a posição no corpo do animal (não no mundo), então
> as listras andam junto com ele.
> =============================================================

**Exporta:** `makeCreatureMaterial`


### `src/creatures/creature_models.js` (797 linhas)
> =============================================================
> FORMATO DE CADA ESPÉCIE (medidas em metros, tamanho adulto)
> spine: pontos da coluna, da ponta da cauda até o focinho:
>        [x, y, z, raio, achatamento, osso]
>        (o animal olha para -z; y = altura do chão)
> legs:  quadril, joelho, tornozelo, dedos e grossura de cada parte
>        phase = em que momento do passo a perna se move (0 ou 0.5)
> Troque as cores aqui para mudar a aparência.
> skin:    pele – 'escamas', 'pelo', 'penas' ou 'lisa'
> pattern: desenho do corpo – type: 'listras', 'manchas', 'rosetas',
>          'mosqueado', 'aneis', 'dorsal'; count (quantas listras) ou
>          freq (tamanho das manchas: maior = menores); strength; color
> teeth:   dentes ao longo da boca (n por lado, tamanho em metros)
> =============================================================

**Exporta:** `MODELS`


### `src/creatures/gait_profiles.js` (11 linhas)
> =============================================================
> JEITO DE ANDAR tirado de animações de verdade (gerado por
> tools/models/passos_base.py). Para cada grupo de pernas: a curva
> do giro (radianos, em volta da média) da coxa, joelho e pé durante
> um passo; atraso = em que parte do passo a perna começa;
> atraso_D = atraso da perna direita em relação à esquerda.
> cauda = balanço de lado (tail1..3) durante o passo.
> NÃO edite à mão: rode o script.
> =============================================================

**Exporta:** `PASSOS`


### `src/creatures/habilidades.js` (101 linhas)
> Regras puras das habilidades (sem three.js) – testadas em tests/progression.test.mjs.

**Exporta:** `habilidadesDe`, `habilidade`, `podeUsar`, `usar`, `REX_ROAR`, `rexRoarCooldown`, `rexRoarAffects`, `raptorLider`, `rugidoDeBando`, `proximaPlaca`, `danoRecebidoPlaca`, `boaTorpor`, `gigaFuria`, `kentroPackBoost`, `compyPackBoost`, `aplicarHabilidades`, `habilidadesDeCavaleiro`


### `src/creatures/habilidades_dados.js` (115 linhas)
> Habilidades por espécie (ARK Evolved/ASE), como no prompt. Dano = absoluto de nível 1.
> Etiquetas: [OK] wiki | [CUSTOM] espécie fora do ARK base (referência anotada em `ref`) | [PENDENTE] não conferido.
> Tudo congelado. Stamina e cooldown (s) são os da wiki; a recarga já é o tempo mínimo entre ataques.

**Exporta:** `EFEITOS`, `HABILIDADES`, `PASSIVAS`, `CUSTOM_REF`, `ESPECIAL`


### `src/creatures/imported_model.js` (249 linhas)
> =============================================================
> MODELOS IMPORTADOS (feitos por outras pessoas, com licença livre)
> Os dados vêm de src/creatures/imported/<espécie>.js, gerados pelo
> conversor em tools/models/ (bichos_glb.sh a partir de bichos/modelos/*.glb). O esqueleto já vem com os mesmos nomes
> de ossos que o jogo anima (hips, chest, neck, head, jaw, tail1-3,
> pernaE/D, bracoE/D...), então as animações do jogo funcionam.
> =============================================================

**Exporta:** `IMPORTED`, `buildImportedModel`


### `src/creatures/passo_cal.js` (9 linhas)
> =============================================================
> CALIBRAGEM DO PASSO (medida em tools/ → "pé sem escorregar").
> Para cada espécie: quanto o pé varre o chão em relação ao corpo, andando e correndo,
> medido na animação por código. 1,0 = o pé fica parado no chão. Acima de 1 o pé escorrega
> para trás; abaixo de 1 o corpo desliza sem as pernas acompanharem.
> O jogo divide o passo (tamanho e ritmo) por esse número.
> =============================================================

**Exporta:** `PASSO_CAL`


### `src/creatures/reproducao.js` (91 linhas)
> Funções puras da reprodução (sem three.js) – testadas em tests/progression.test.mjs.

**Exporta:** `podeReproduzir`, `stageFromMaturation`, `babyFoodPerSec`, `cooldownSeconds`, `semSexo`, `podeBotar`, `canMate`, `inheritStats`, `rollMutations`, `litterSize`, `imprintRequests`, `imprintGain`, `eggStep`


### `src/creatures/saddle.js` (430 linhas)
> =============================================================
> SELA – modelo de sela nas costas do bicho montável (feito por código)
> O tamanho segue o corpo: manta de couro, assento com encosto,
> cilhas em volta da barriga e estribos dos lados. Vai presa no osso
> do quadril (hips), então balança junto com o bicho andando.
> 
> Tipos (como no ARK, uma sela por porte):
>   sela        – bichos pequenos (até 5 m)
>   sela_media  – médios (5 a 11 m)
>   sela_grande – gigantes (11 m ou mais), com plataforma de madeira
> =============================================================

**Exporta:** `bodyLength`, `tierOf`, `saddleFor`, `seatShift`, `saddleFits`, `backSpot`, `buildSaddle`, `ajustarSela`


### `src/creatures/temperamentos.js` (126 linhas)
> IA de comportamento dos dinos (ARK): temperamentos do selvagem e modos de agressão do domado.
> Funções puras (sem three.js) – testadas em tests/progression.test.mjs.
> Etiquetas: [OK] conferido na wiki do ARK, [CUSTOM] decisão de design (pode ajustar).

**Exporta:** `HERBIVOROS_NUNCA_FOGEM`, `IA`, `TEMPER`, `ehPerigoso`, `TEMPER_ESPECIE`, `temperDe`, `decideReaction`, `tempoAlerta`, `multNoturno`, `MODOS`, `modoDe`, `decideTamed`, `aplicarTemperamentos`


### `src/creatures/tracos.js` (95 linhas)
> =============================================================
> JEITO DE SE MEXER DE CADA BICHO (os que são feitos por código)
> Depois da animação geral (andar, respirar, atacar), cada espécie soma o seu
> jeito próprio: dodô bica e balança a cabeça, onça se agacha para caçar,
> triceratops baixa a cabeça para investir etc. Só mexe nos ossos que o
> corpo da espécie tem (hips, chest, neck, head, tail1..3).
> Tudo soma em cima da rotação que a animação geral já pôs (nunca troca).
> =============================================================

**Exporta:** `aplicarTraco`

**Funções/métodos:** `dodo`, `galimimo`, `paquicefalossauro`, `triceratops`, `compsognato`, `piranha`

### `src/creatures/wounds.js` (72 linhas)
> =============================================================
> FERIDAS NOS BICHOS (como no ARK depois das brigas): conforme perdem vida, o corpo
> ganha manchas de sangue escuro e feridas abertas. É feito no desenho do próprio corpo:
> um ruído 3D na posição do modelo (por isso as manchas ficam no lugar mesmo com ele
> andando) escurece e avermelha o couro. Cada bicho ferido ganha uma cópia do material
> (só quando apanha pela primeira vez), com UM número (uWound, 0 a 1) que cresce com o dano.
> Sem objeto novo na cena: o custo é só umas contas no desenho.
> =============================================================

**Exporta:** `aplicarFeridas`


## src/data/config/

### `src/data/config/balanceamento.js` (411 linhas)
> =============================================================
>  BALANCEAMENTO – TODOS OS NÚMEROS DO JOGO FICAM AQUI
> 
>  Como mudar: troque só o número depois dos dois-pontos.
>  Tudo depois de "//" é explicação e o jogo ignora.
>  Depois de mudar, gere o jogo de novo (npm run build).
> =============================================================


## src/inventory/

### `src/inventory/inventory.js` (299 linhas)
> =============================================================
> INVENTÁRIO – espaços (slots) com pilhas de itens e peso.
> Os 8 primeiros espaços são a BARRA RÁPIDA (embaixo na tela).
> Cada espaço: { id, qty, dur, spoil, agua }
>   dur = durabilidade de ferramentas e roupas
>   spoil = segundos até a próxima unidade de comida estragar
>   agua = água dentro do cantil
> =============================================================

**Exporta:** `HOTBAR`, `EQUIP_SLOTS`, `Inventory`

**Funções/métodos:** `dress`, `undress`, `armorPoints`, `armor`, `warmth`, `wearArmor`, `_changed`, `size`, `count`, `weight`, `add`, `remove`, `update`, `takeFrom`, `move`, `split`, `takeSlot`, `sort`, `takeAll`, `equipped`, `wear`, `toJSON`, `fromJSON`

## src/items/

### `src/items/items.js` (264 linhas)
> =============================================================
> ITENS – lista de itens (data/items/itens.json) e os desenhos
> (ícones) de cada um, feitos com formas simples em SVG.
> =============================================================

**Exporta:** `ITEMS`, `item`, `itemName`, `itemIcon`


## src/

### `src/main.js` (1419 linhas)
> =============================================================
> ILHA PRIMORDIAL – ponto de partida do jogo
> Cria o desenho 3D (renderer), o mundo, o jogador e as telas, e
> roda o "loop": a cada quadro atualiza tudo e desenha.
> =============================================================


## src/net/

### `src/net/multiplayer.js` (480 linhas)
> =============================================================
> CO-OP ONLINE (até 4 jogadores)
> 
> Como funciona (simples):
>  - Quem CRIA a partida é o "anfitrião". Ele recebe um código de
>    6 letras. Os amigos digitam o código e entram.
>  - Um servidor público e gratuito (PeerJS) só ajuda os celulares a
>    se acharem; depois a conversa é direta entre eles (WebRTC).
>  - O anfitrião manda nos animais e na hora do dia. Cada jogador
>    manda a própria posição; árvores coletadas, fogueiras e sacos
>    de dormir aparecem para todos.
>  - Se o anfitrião sair, quem ficou continua jogando sozinho.
> 
> Mensagens (campo "t"):

**Exporta:** `Multiplayer`

**Funções/métodos:** `playerCount`, `playerNames`, `host`, `_onIncoming`, `join`, `_applyWelcome`, `_onData`, `_addRemote`, `_removeRemote`, `_syncRemoteList`, `_dropPeer`, `_hostGone`, `leave`, `_broadcast`, `_toHost`, `noteSwing`, `sendHit`, `requestLoot`, `sendDamage`, `sendKill`, `update`

### `src/net/remote_player.js` (102 linhas)
> =============================================================
> OUTRO JOGADOR (co-op): boneco com o nome em cima, que segue as
> posições que chegam pela rede (suavizadas para não "pular").
> Também serve de alvo para os predadores no anfitrião.
> =============================================================

**Exporta:** `RemotePlayer`

**Funções/métodos:** `alive`, `applyState`, `update`, `remove`

## src/player/

### `src/player/blocky_model.js` (232 linhas)
> =============================================================
> PERSONAGEM LOW-POLY (estilo Valheim): sobrevivente com túnica de couro, capa de pele nos
> ombros, barba e botas, feito de formas simples facetadas nas cores da paleta (core/paleta.js).
> (Antes era o "quadradinho" com textura de pixel; a opção do menu continua com o mesmo nome.)
> Cada parte é um bloco com articulação de verdade: cintura, ombros, cotovelos, quadris e joelhos,
> então as animações (andar, correr, pular, machadada, mineração, lança, soco) dobram nos lugares certos.
> As poses vêm das mesmas contas do PlayerModel (_computePose); aqui só se aplicam nas juntas.
> =============================================================

**Exporta:** `BlockyModel`

**Funções/métodos:** `setVariant`, `setTool`, `update`

### `src/player/clava_arco_modelo.js` (214 linhas)
> =============================================================
> CLAVA E ARCO (modelos detalhados), no mesmo estilo dos machados, picaretas e lanças.
>  - clava: tronco duro e nodoso, cabeça grossa e irregular com cascas e queimados,
>           lascas de sílex cravadas, pegada de couro e alça de corda no pé do cabo.
>  - arco : arco longo de madeira (tábua achatada, afinando para as pontas com curva invertida),
>           pegada de couro com prateleira da flecha, entalhes nas pontas, corda de fibra com
>           trançado no meio e uma flecha de sílex encaixada.
> Mesma orientação dos modelos antigos: clava com o cabo ao longo de +Y (mão em y≈-0.08);
> arco com o meio na mão, em pé (plano Y-Z), pontas e corda para +Z (para perto de quem atira).
> =============================================================

**Exporta:** `makeClub`, `makeBow`


### `src/player/machado_modelo.js` (596 linhas)
> =============================================================
> OS TRÊS MACHADOS (modelos detalhados, na mão em 1ª pessoa e no personagem)
>  - machado_pedra : machado de pedra bruta: pedra tosca presa ao lado do cabo chato de madeira
>                    clara, com tiras largas de couro cru enroladas.
>  - machado_silex : machado de batalha negro (obsidiana): lâmina em meia-lua com fio serrilhado
>                    prateado, espigão no topo, asas atrás, encaixe esculpido e cabo enrolado
>                    com argolas de metal e ponteira.
>  - machado_metal : machado viking de barba: lâmina de aço com runas gravadas, cabo de madeira
>                    curvo e avermelhado, com alça de couro pendurada.
> Orientação: cabo ao longo de +Y (mão em y≈-0.08), fio da lâmina apontando para -Z.
> As texturas são desenhadas na hora e também usadas como relevo (bumpMap).
> =============================================================

**Exporta:** `makeAxe`, `MACHADOS`, `makeAxes`


### `src/player/make_model.js` (9 linhas)
> Escolhe o modelo do personagem pela opção "Personagem" (quadradinho ou realista).

**Exporta:** `makePlayerModel`


### `src/player/picareta_lanca_modelo.js` (378 linhas)
> =============================================================
> PICARETAS E LANÇAS (modelos detalhados), no mesmo estilo dos três machados
>  - picareta_pedra : cabo chato de madeira clara + pedra comprida e pontuda amarrada por cima,
>                     com tiras de couro cru.
>  - picareta_silex : picareta de batalha negra (obsidiana): cabeça em arco com pontas prateadas,
>                     encaixe esculpido, cabo de cordão negro com argolas e ponteira.
>  - picareta_metal : picareta de aço forjado com cabeça em arco, olho com rebites, cabo curvo
>                     avermelhado e alça de couro.
>  - lanca          : haste de madeira clara com ponta de sílex lascado amarrada com fibra.
>  - lanca_osso     : haste escura com ponta longa de osso (com farpas), tiras de couro e um dente
>                     pendurado por uma cordinha.
> Orientação: cabo ao longo de +Y (mão em y≈-0.08); a cabeça da picareta fica ao longo de Z.
> =============================================================

**Exporta:** `makePicks`, `makeSpears`


### `src/player/pixel_tex.js` (24 linhas)
> textura de "pixels" (8x8) que dá cara de bloco: cada pixel clareia ou escurece um pouco

**Exporta:** `pixelTexture`


### `src/player/player.js` (585 linhas)
> =============================================================
> JOGADOR – movimento e física simples
> Andar, correr, pular, agachar e nadar. A "física" é feita à mão
> (leve para celular): gravidade, chão pela altura do terreno,
> círculos de colisão para árvores/pedras e flutuação na água.
> =============================================================

**Exporta:** `Player`

**Funções/métodos:** `radius`, `eyeHeight`, `spawnAt`, `update`, `clothingWarmth`, `mount`, `dismount`, `_ride`, `_updateAttack`, `_updateBiome`, `_walk`, `_moveHorizontal`, `_canStep`, `_swim`, `_keepInsideWorld`, `_die`, `respawn`, `_updateModel`, `toJSON`, `fromJSON`

### `src/player/player_actions.js` (465 linhas)
> =============================================================
> AÇÕES DO JOGADOR – bater, coletar, colher e comer
> - Bater (Atacar): acerta criatura > carcaça > planta/pedra na
>   frente. O que sai depende da ferramenta (recursos.json).
> - Colher (Interagir): bagas, bananas, fibra.
> - Comer/usar: itens de comida da barra rápida.
> =============================================================

**Exporta:** `PlayerActions`

**Funções/métodos:** `startAutoHarvest`, `cancelAutoHarvest`, `updateAutoHarvest`, `tool`, `ammoList`, `arrowType`, `cycleArrow`, `shootArrow`, `selectedIsConsumable`, `weightFactor`, `overloaded`, `onSwingHit`, `_punchHurt`, `_dmgNumber`, `harvest`, `findHarvestable`, `colher`, `_give`, `_wear`, `useSlot`, `place`, `selectedPiece`, `buildPlacement`, `placeBuild`, `useSelected`, `pressHotbar`

### `src/player/player_camera.js` (138 linhas)
> =============================================================
> CÂMERA – terceira pessoa (atrás do ombro) ou primeira pessoa.
> Em terceira pessoa a câmera se aproxima sozinha quando o chão
> fica no caminho (não atravessa morros).
> =============================================================

**Exporta:** `PlayerCamera`

**Funções/métodos:** `setMode`, `toggle`, `forward`, `applyLook`, `shake`, `acordar`, `update`, `_update`

### `src/player/player_hands.js` (360 linhas)
> =============================================================
> BRAÇO EM PRIMEIRA PESSOA (só o direito, o mesmo do boneco/skin)
> Preso à câmera: respiram parados, balançam ao andar,
> dão soco, machadada/picaretada (de cima para baixo) e estocada
> de lança. A ferramenta em uso aparece na mão direita.
> =============================================================

**Exporta:** `makeTool`, `PlayerHands`

**Funções/métodos:** `setVariant`, `setTool`, `swing`, `drink`, `gather`, `update`

### `src/player/player_interaction.js` (337 linhas)
> =============================================================
> INTERAÇÃO – o que o jogador está mirando e o botão "Interagir"
> Interagir: recuperar saco, colher (bagas, bananas, fibra), beber,
> dar comida para bicho desmaiado (domar), mandar domado seguir/ficar.
> Também mostra dicas do que dá para fazer com "Atacar"
> (árvore = madeira e palha, pedra = pedra e sílex...).
> =============================================================

**Exporta:** `PlayerInteraction`

**Funções/métodos:** `update`, `_findTarget`, `_creatureTarget`, `_tameFoodFor`, `_waterTarget`, `_interact`, `_setPrompt`

### `src/player/player_model.js` (481 linhas)
> =============================================================
> MODELO DO JOGADOR (placeholder com formas arredondadas)
> Tem animações simples feitas por código: andar, correr,
> nadar, agachar, golpe e cair morto.
> =============================================================

**Exporta:** `skinGeometry`, `skinMaterial`, `PlayerModel`

**Funções/métodos:** `_applySkin`, `_limb`, `setVariant`, `setTool`, `swing`, `gather`, `update`, `_computePose`, `_resetLimbs`

### `src/player/player_stats.js` (355 linhas)
> =============================================================
> ATRIBUTOS DO JOGADOR
> Vida, Stamina, Fome, Sede, Fôlego, Temperatura, Nível e XP.
> Todos os números vêm do arquivo de balanceamento.
> =============================================================

**Exporta:** `PlayerStats`

**Funções/métodos:** `level`, `xp`, `points`, `engramPoints`, `skills`, `learned`, `update`, `useStamina`, `damage`, `drink`, `xpToNext`, `addXP`, `engramsForLevel`, `knows`, `learnBlock`, `learn`, `getStat`, `maxWeight`, `speedMul`, `fortitudeC`, `craftSpeed`, `damageMul`, `skillValue`, `spendBlock`, `spendPoint`, `_applySkills`, `respecBlock`, `startRespec`, `finishRespec`, `resetForRespawn`, `toJSON`, `fromJSON`, `resetProgression`

### `src/player/roupa.js` (17 linhas)
> =============================================================
> CORES DA ROUPA do personagem low-poly (e do braço em 1ª pessoa).
> Arquivo separado para os dois modelos usarem sem um importar o outro.
> =============================================================

**Exporta:** `ROUPA`


### `src/player/skin_data.js` (6 linhas)
> Personagem (modelo PS1 do jogador) e braço em primeira pessoa. Gerado por tools/models/ps1_exportar.py.

**Exporta:** `SKIN_PARTES`, `FP_BRACO`, `SKIN_TEXTURA`, `FP_TEXTURA`


## src/progression/

### `src/progression/debug_commands.js` (40 linhas)
> =============================================================
> COMANDOS DE TESTE (ligados por DEBUG_MODE em progression_config.js)
>   /xp N        dá N de XP (passa pelo XP_GLOBAL_MULT)
>   /level N     vai direto para o nível N (refaz os pontos livres)
>   /resetprog   volta toda a progressão ao começo
>   /unlockall   desbloqueia todos os engrams
>   /points N    dá N pontos de atributo e N pontos de engram
> No navegador: ilhaCmd('/xp 500')   (também: ilhaCmd('/level 30'))
> =============================================================

**Exporta:** `setLevel`, `runDebugCommand`


### `src/progression/engram_database.js` (1349 linhas)
> =============================================================
> BANCO DE ENGRAMS (só dados). Gerado por tools/dados/gerar_engrams.py
> id = id da receita em data/crafting/receitas.json. tier/nível/custo/pré-requisitos: balanceie lá e rode o script.
> =============================================================

**Exporta:** `ENGRAMS`


### `src/progression/engram_manager.js` (108 linhas)
> =============================================================
> ENGRAMS: desbloqueio e checagem.
> Um engram por receita (id = id da receita). Regras de desbloqueio: nível >= nivel_requerido,
> pontos suficientes e todos os pré-requisitos já desbloqueados. Desbloquear é instantâneo,
> permanente e sem devolução. A tela de crafting só pergunta can_craft(id) (canCraft).
> Sinais (via events): ENGRAM_UNLOCKED { id }, ENGRAM_POINTS_CHANGED { pontos } (do PlayerProgression)
> =============================================================

**Exporta:** `ENGRAM_BY_ID`, `EngramManager`

**Funções/métodos:** `get`, `list`, `isUnlocked`, `canCraft`, `unlockBlock`, `canUnlock`, `unlock`, `spentPoints`, `unlockAll`, `resetAll`, `toJSON`, `fromJSON`, `migrateLegacy`

### `src/progression/player_progression.js` (248 linhas)
> =============================================================
> PROGRESSÃO DO JOGADOR: nível, XP, pontos de atributo, atributos (get_stat) e as fontes de XP.
> Todos os números vêm de progression_config.js. Sinais (via events):
>   XP_GAINED { amount, source }   LEVEL_UP { level }   ATTRIBUTE_CHANGED { nome, valor, gastos }
>   ENGRAM_POINTS_CHANGED { pontos }
> A tela atual só precisa chamar as funções públicas abaixo e ouvir esses sinais.
> =============================================================

**Exporta:** `ATTRIBUTE_KEYS`, `killClass`, `PlayerProgression`

**Funções/métodos:** `resetAll`, `xpToNext`, `addXp`, `_emitLevelUp`, `addEngramPoints`, `spendEngramPoints`, `getStat`, `pointsSpent`, `totalSpent`, `spendBlock`, `spendPoint`, `respec`, `markCombat`, `inCombat`, `_firstTime`, `gainFromResource`, `gainFromCraft`, `gainFromKill`, `gainFromTame`, `killXpPreview`, `toJSON`, `fromJSON`, `migrateLegacy`

### `src/progression/progression_config.js` (101 linhas)
> =============================================================
> PROGRESSÃO – TODOS OS NÚMEROS (nível, XP, atributos, engramas, fontes de XP)
> Nada de número escondido no código: para balancear, mude só este arquivo.
> =============================================================

**Exporta:** `DEBUG_MODE`, `VERSAO_PROGRESSAO`, `START_LEVEL`, `MAX_LEVEL`, `XP_BASE`, `XP_EXPONENT`, `XP_GLOBAL_MULT`, `XP_RESOURCE_DEFAULT`, `XP_RESOURCE`, `XP_CRAFT_PER_SECOND`, `XP_KILL_CLASS_MULT`, `KILL_CLASS_MEDIO_MIN_M`, `KILL_CLASS_GRANDE_MIN_M`, `XP_KILL_BY_TAMED_SHARE`, `XP_TAME_PER_LEVEL`, `XP_FIRST_TIME_BONUS`, `ANTI_FARM_MAX`, `ANTI_FARM_WINDOW_S`, `ANTI_FARM_FACTOR`, `ATTR_POINTS_PER_LEVEL`, `ATTRIBUTES`, `OXYGEN_DRAIN_PER_SECOND`, `ENGRAM_POINTS_START`, `ENGRAM_POINTS_BASE`, `ENGRAM_POINTS_LEVEL_DIV`, `ENGRAM_TIERS`, `ENGRAM_POOL_TARGET`, `ENGRAM_STATIONS`, `xpToNext`, `engramPointsForLevel`, `totalXpToReach`, `totalEngramPointsUpTo`


## src/ui/

### `src/ui/action_wheel.js` (81 linhas)
> =============================================================
> RODA DE AÇÕES (como no ARK Mobile): abre com um arrasto a partir da borda
> ESQUERDA da tela. Atalhos para o que não tem botão na tela:
> agachar, interagir, montar/desmontar, inventário, construir, mapa,
> recarregar e pausar. Cada item aperta a ação do jogo correspondente.
> (A roda de assovios, dos bichos, abre pela borda ESQUERDA.)
> =============================================================

**Exporta:** `ActionWheel`

**Funções/métodos:** `visible`, `open`, `close`

### `src/ui/button_icons.js` (25 linhas)
> =============================================================
> ÍCONES DOS BOTÕES DE TOQUE (desenhados aqui, sem cor: brancos)
> pular ⬆, agachar (pessoa ajoelhada), interagir (um dedo tocando),
> atacar (espada), correr (pessoa correndo); nadando: subir/descer.
> =============================================================

**Exporta:** `BUTTON_ICONS`


### `src/ui/creature_menu.js` (274 linhas)
> =============================================================
> MENU DO BICHO DOMADO (igual ao "menu de interação" do ARK Mobile)
> Abre com Interagir num bicho seu. Dá para:
>   - mudar o nome (lápis)
>   - seguir você ou ficar parado, distância ao seguir
>   - alcance de alvo e agressividade (passivo, neutro, agressivo)
>   - vagar por perto quando parado
>   - tirar a sela, montar
>   - soltar (deixa de ser seu), castrar (não cruza mais) e matar
> Soltar e matar pedem um segundo toque para confirmar.
> =============================================================

**Exporta:** `CreatureMenu`

**Funções/métodos:** `visible`, `open`, `close`, `_label`, `_render`, `_cycle`, `_stay`, `_saveName`, `_act`

### `src/ui/damage_numbers.js` (65 linhas)
> =============================================================
> NÚMEROS DE DANO – quando você acerta um bicho, o dano sobe
> flutuando de onde acertou e some (como no ARK).
> Poucos <div> reaproveitados; posição projetada pela câmera.
> =============================================================

**Exporta:** `DamageNumbers`

**Funções/métodos:** `add`, `update`

### `src/ui/death_screen.js` (195 linhas)
> =============================================================
> TELA DE MORTE (como no ARK)
> 1) A visão fica vermelha e vai escurecendo até ficar preta.
> 2) Aparece o mapa de relevo com o X vermelho de onde você morreu.
> 3) Na lateral, a lista "Região de respawn": escolha uma zona e
>    toque em "Respawnar" (sem zona escolhida = local aleatório).
> =============================================================

**Exporta:** `DeathScreen`

**Funções/métodos:** `startFade`, `_clockText`, `show`, `_select`, `_refreshButton`, `_applyFilter`, `hide`

### `src/ui/debug_overlay.js` (64 linhas)
> =============================================================
> OVERLAY DE DEBUG (liga/desliga com F3 ou o botão "FPS")
> Mostra FPS, criaturas ativas, memória e quanto o celular está
> desenhando por quadro — útil para achar o que está pesado.
> =============================================================

**Exporta:** `DebugOverlay`

**Funções/métodos:** `setVisible`, `visible`, `frame`

### `src/ui/help_screen.js` (161 linhas)
> =============================================================
> TELA DE AJUDA (guia do jogo), no mesmo formato da ajuda do ARK Mobile:
> barra de ícones no topo (Sobrevivência, Interface, Fabricação,
> Criaturas, Mapa), lista de assuntos à esquerda e, à direita, o título,
> uma imagem e o texto. As imagens ficam em assets/ajuda/<id>.jpg
> (entram no jogo na hora de gerar; sem imagem, aparece só a moldura).
> Abre pelo menu de pausa (botão AJUDA) e fecha com o X, Esc ou voltar.
> =============================================================

**Exporta:** `HelpScreen`

**Funções/métodos:** `visible`, `open`, `close`, `select`

### `src/ui/hotbar.js` (64 linhas)
> =============================================================
> BARRA RÁPIDA – os 8 primeiros espaços do inventário, embaixo
> da tela. Toque: comida = come; ferramenta = pega/guarda.
> No PC: teclas 1 a 8.
> =============================================================

**Exporta:** `Hotbar`

**Funções/métodos:** `setVisible`, `refresh`

### `src/ui/hud.js` (324 linhas)
> =============================================================
> HUD – painel na tela durante o jogo
> Compacto: ícone + barra + número para Vida, Stamina, Fome, Sede
> e Fôlego (só embaixo d'água); nível/XP e temperatura numa linha.
> Também mostra: nome do bioma ao entrar, criatura na mira
> (nome, nível, vida) e a tela avermelhada ao levar dano.
> Atualiza 10x por segundo (mexer no HTML todo quadro gasta bateria).
> =============================================================

**Exporta:** `Hud`

**Funções/métodos:** `setCoop`, `setVisible`, `showBiome`, `_hurt`, `setTarget`, `_showPrompt`, `_updateBoss`, `update`

### `src/ui/icons.js` (20 linhas)
> Ícones originais desenhados com formas simples (SVG).
> Usam "currentColor": a cor vem do CSS de cada barra.

**Exporta:** `ICONS`


### `src/ui/inspect_panel.js` (181 linhas)
> =============================================================
> INSPECIONAR BICHO (lupa)
> Aperta a lupa (ou R) mirando num bicho: leva 2 s olhando e
> aparece a ficha no canto da tela com os atributos dele:
> vida, força, peso que carrega, stamina, velocidade e torpor.
> Cada bicho sorteia esses números entre o mínimo e o máximo da
> espécie (criaturas.json → atributos), então dois raptores podem
> ser bem diferentes.
> Ícones brancos, fundo azul-marinho. Desenhos nossos (SVG).
> =============================================================

**Exporta:** `STAT_ICONS`, `InspectPanel`

**Funções/métodos:** `open`, `toggle`, `close`, `update`, `_fill`

### `src/ui/intro.js` (22 linhas)
> =============================================================
> ACORDAR NO MAPA: ao entrar no jogo a tela está preta e o personagem
> "abre os olhos" (pálpebras abrindo, piscando, imagem embaçada ficando
> nítida). A tela de carregamento é outra coisa (a normal, com o círculo girando).
> =============================================================

**Exporta:** `OLHOS_SEG`, `abrirOlhos`


### `src/ui/inventory_screen.js` (979 linhas)
> =============================================================
> TELA DE INVENTÁRIO E CRAFTING (botão Inventário / Tab)
> Esquerda: barra rápida + mochila (arraste para mover; toque para
> ver o item) e a barra de peso.
> Direita: "Criar" – categorias, cartões com o que cada receita
> pede (verde = tem, vermelho = falta), aviso de bancada, botões
> ×1 / ×5 / Máx e a fila (dá para cancelar).
> =============================================================

**Exporta:** `InventoryScreen`

**Funções/métodos:** `visible`, `show`, `hide`, `openBox`, `_renderBoxCreature`, `_toBox`, `_fromBox`, `_renderBox`, `showTab`, `_renderPreview`, `_refreshSkills`, `_renderSide`, `_renderGrupos`, `_renderDoma`, `_renderThem`, `_renderEngrams`, `refresh`, `_renderRecipe`, `_renderQueue`, `tick`, `_renderItem`, `_setupDrag`

### `src/ui/loading_screen.js` (51 linhas)
> =============================================================
> TELA DE CARREGAMENTO (aparece ao clicar em Entrar, enquanto a ilha é gerada)
> Tudo é animado só com CSS (anel girando, ondas e barra), porque o JavaScript
> fica ocupado gerando a ilha e não consegue mexer na tela nesse tempo.
> =============================================================

**Exporta:** `LoadingScreen`

**Funções/métodos:** `show`, `hide`

### `src/ui/map_image.js` (178 linhas)
> =============================================================
> IMAGEM DO MAPA – desenha a ilha vista de cima a partir do relevo
> (cores dos biomas + sombra dos morros + água). Feita uma vez só.
> Usada na tela de morte e, na Fase 11, no mapa do jogo.
> =============================================================

**Exporta:** `renderMapImage`, `worldToMapPercent`, `renderContourImage`


### `src/ui/map_screen.js` (90 linhas)
> =============================================================
> MAPA DA ILHA – abre com M (PC) ou tocando no minimapa (celular).
> Mostra a ilha inteira, onde você está (seta), os pontos de
> renascer (prismas) e os nomes das regiões. Fecha com M, Esc,
> o X ou tocando fora do mapa.
> =============================================================

**Exporta:** `MapScreen`

**Funções/métodos:** `visible`, `toggle`, `show`, `update`, `hide`

### `src/ui/messages.js` (67 linhas)
> =============================================================
> AVISOS LATERAIS ("+12 Sede", "Você não está com sede.")
> Qualquer sistema pode avisar com:
>   events.emit(EV.MESSAGE, { text: '...', kind: 'gain' | 'warn' | 'info' })
> =============================================================

**Exporta:** `Messages`

**Funções/métodos:** `pushItem`, `push`, `_schedule`

### `src/ui/minimap.js` (74 linhas)
> =============================================================
> MINIMAPA – quadradinho no canto de cima, à direita: mostra a volta
> do jogador (norte para cima) e uma seta para onde ele olha.
> Usa a mesma imagem do mapa da tela de morte (feita uma vez só).
> =============================================================

**Exporta:** `Minimap`

**Funções/métodos:** `setVisible`, `update`

### `src/ui/pause_menu.js` (366 linhas)
> =============================================================
> MENU DE PAUSA (visual do ARK Mobile): RESUMIR, OPÇÕES, SALVAR JOGO
> e VOLTAR AO MENU PRINCIPAL. Opções em categorias (Áudio, Gráficos,
> Interface, Jogabilidade, Controles).
> =============================================================

**Exporta:** `PauseMenu`

**Funções/métodos:** `refresh`, `setCoop`, `show`, `go`, `cat`, `_renderSaves`, `hide`, `visible`

### `src/ui/save_screen.js` (120 linhas)
> =============================================================
> JOGOS SALVOS – escolher o save que quer jogar, começar um jogo novo num espaço,
> apagar um save e voltar o nível a 1. Cada ação perigosa pede "Tem certeza?".
> =============================================================

**Exporta:** `SaveScreen`

**Funções/métodos:** `open`, `close`, `_ask`, `_click`, `render`

### `src/ui/start_screen.js` (231 linhas)
> =============================================================
> TELA INICIAL – título, botão Jogar e resumo dos controles.
> Atrás dela, a câmera sobrevoa a ilha de verdade.
> (Menu completo com Novo Jogo/Continuar/Opções/Créditos: Fase 12.)
> =============================================================

**Exporta:** `StartScreen`

**Funções/métodos:** `_renderSlots`, `playerName`, `setStatus`, `setCoopBusy`, `setLoading`, `setReady`, `show`, `hide`

### `src/ui/sun_glare.js` (176 linhas)
> =============================================================
> BRILHO DO SOL NA TELA: clarão em volta do sol, uma faixa de luz e uns
> reflexos de lente que andam do lado oposto quando o sol está à vista.
> É uma camada por cima do 3D (mistura "screen"), então funciona igual em
> qualquer qualidade gráfica, sem custo de pós-processamento.
> =============================================================

**Exporta:** `SunGlare`

**Funções/métodos:** `update`, `_wash`

### `src/ui/touch_controls.js` (482 linhas)
> =============================================================
> CONTROLES DE TOQUE (celular)
> - Joystick à esquerda: toque em qualquer lugar da metade esquerda
>   e arraste. A base aparece onde o dedo encostou.
> - Arrastar no resto da tela: gira a câmera.
> - Botões grandes à direita. Tamanho e opacidade vêm das Opções.
> Vários dedos ao mesmo tempo funcionam (cada dedo tem um id).
> 
> ESQUEMA "GESTOS" (padrão, como no ARK Mobile):
>   Metade esquerda: tocar e arrastar = andar (joystick que nasce onde o dedo
>     encosta); tocar duas vezes e segurar = correr; arrastar rápido para cima = pular
>     (para baixo = recarregar).
>   Metade direita: arrastar = olhar em volta; tocar = usar/colher ou atacar; segurar sem
>     mexer = abrir o inventário (ou montar/desmontar se estiver mirando um bicho domado);

**Exporta:** `TouchControls`

**Funções/métodos:** `setScheme`, `setVisible`, `applySettings`, `applyLayout`, `startEdit`, `stopEdit`, `_dragTo`, `updateStates`, `_tap`, `_tapAction`, `_tapInteract`, `_holdAction`, `_setupGestures`, `_setupLook`, `_setupStick`, `_moveKnob`, `_resetStick`, `_setupButtons`

### `src/ui/whistle_wheel.js` (184 linhas)
> =============================================================
> RODA DE ASSOVIOS (como no ARK Mobile): comandos rápidos para os
> bichos domados. Abre com T (PC) ou com o botão de apito (celular).
>   Siga-me / Parar  – Todos (até 60 m) ou Um (o que está na mira)
>   Agressivo / Neutro / Passivo – muda a agressividade de todos
>   Ataque meu alvo – todos atacam o bicho que você está mirando
> =============================================================

**Exporta:** `WhistleWheel`

**Funções/métodos:** `visible`, `open`, `close`, `_near`, `_aimed`, `run`

## src/world/

### `src/world/atmosfera.js` (345 linhas)
> =============================================================
> ATMOSFERA (estilo Valheim) – partículas leves e clima:
>   - fumaça e fagulhas nas fogueiras acesas perto do jogador
>   - vaga-lumes à noite (mata e campo), poeira brilhando no sol de dia
>   - folhas caindo na mata
>   - CLIMA: de vez em quando chove (gotas, céu mais escuro, som de chuva)
>     ou cai uma neblina densa. Na neve não chove (lá já neva: snowfall.js).
> Cada efeito é UM objeto de pontos (1 desenho por efeito). A maioria vive numa
> caixa em volta da câmera e "dá a volta" (sem criar/apagar nada); a fumaça e as
> fagulhas são poucas partículas recicladas.
> >>> AJUSTES: QTD (quantidade por qualidade), CLIMA (chance e duração), cores da paleta.
> =============================================================

**Exporta:** `Atmosfera`

**Funções/métodos:** `emitir`, `update`, `_montar`, `setQualidade`, `forcar`

### `src/world/building.js` (504 linhas)
> =============================================================
> CONSTRUÇÃO – peças que se encaixam numa grade de 3 m
> Materiais (como no ARK): palha < madeira < pedra < metal. Cada peça
> tem vida; bichos que caçam você e esbarram numa peça mordem até
> quebrar. Pedra só quebra com bicho grande (8 m ou mais); metal só
> com gigante (14 m ou mais).
>  - pilar:  coluna; vai no canto de um piso ou no chão.
>  - janela: parede com janela (encaixa como parede).
>  - telhado: teto inclinado (encaixa como teto, cai para o lado que olha).
>  - cerca:  muro baixo (1,3 m) na beira do piso ou solto no chão.
>  - piso:   base da casa (3×3 m). O primeiro vai onde você mira;
>            os outros encaixam do lado de um piso que já existe.
>  - parede: encaixa na beira de um piso ou teto (3 m de altura).
>  - porta:  parede com porta que abre e fecha (Interagir).

**Exporta:** `CELL`, `WALL_H`, `BASES`, `TIERS`, `pieceId`, `parsePiece`, `PIECES`, `BuildPiece`, `pieceName`, `snapPiece`, `BuildGhost`

**Funções/métodos:** `local`, `surfaceAt`, `collide`, `damage`, `promptText`, `use`, `toJSON`, `applyState`, `_group`, `show`, `hide`

### `src/world/death_bag.js` (213 linhas)
> =============================================================
> SACO DE MORTE
> Fica onde o jogador morreu, com um feixe de luz visível de longe.
> Some depois de X minutos (balanceamento: morte.saco_duracao_min).
> Fase 1: o saco ainda vai vazio (o inventário chega na Fase 2).
> =============================================================

**Exporta:** `DeathBag`

**Funções/métodos:** `_physics`, `promptText`, `interact`, `update`, `remove`

### `src/world/effects.js` (332 linhas)
> =============================================================
> EFEITOS – lascas de madeira, folhas, pó de pedra e respingos
> quando você bate em algo. Poucos pedacinhos reaproveitados
> (um desenho só), leve para o celular.
> - madeira: lascas compridas que giram, caem e quicam no chão
> - marcas de corte: "buracos" na casca da árvore onde você bateu
>   (madeira clara no meio, borda escura); somem com o tempo
> =============================================================

**Exporta:** `FX_COLORS`, `Effects`

**Funções/métodos:** `_hideAll`, `burst`, `_woodChips`, `gouge`, `_setGouge`, `update`

### `src/world/estilo.js` (35 linhas)
> =============================================================
> ESTILO LOW-POLY (inspirado em Valheim)
> Liga a luz "facetada" (flatShading) em todo material do jogo:
> cada triângulo recebe uma luz só, sem degradê suave. Vale para
> terreno, árvores, pedras, bichos, construções e o personagem.
> Fica de fora: céu, água e efeitos (têm shader próprio), folhas
> recortadas (cartões com transparência) e quem marcar
> material.userData.suave = true.
> Roda de tempos em tempos (coisas novas entram na cena o tempo todo:
> bichos que nascem, peças construídas...). Cada material só é
> alterado uma vez.
> =============================================================

**Exporta:** `aplicarLowPoly`


### `src/world/falling_trees.js` (151 linhas)
> =============================================================
> ÁRVORE CAINDO – física de uma árvore derrubada.
> A árvore vira uma haste presa na base: o peso a faz tombar para o lado
> contrário de quem cortou, cada vez mais rápido (como um pêndulo invertido).
> Ao tocar o chão (o terreno é testado ao longo do tronco, então em morro ela
> bate no ponto certo) ela quica, solta folhas, lascas e poeira, balança a mata
> em volta e fica deitada um tempo antes de afundar e sumir.
> Em qualidade alta tem mais folhas e poeira.
> =============================================================

**Exporta:** `FallingTrees`

**Funções/métodos:** `setDetail`, `spawn`, `_groundHit`, `_impact`, `update`

### `src/world/folhas_ark.js` (421 linhas)
> =============================================================
> FOLHAGEM NO ESTILO DO ARK (arbustos, plantinhas do chão, samambaia/palminha e bananeira)
> Folhas grandes e curvas, desenhadas em cartões com recorte (alpha):
>  - hosta : folha larga e ovalada, verde-escura, com nervuras marcadas e ondulada (os arbustos
>            de baga e o chão da mata cheio de plantinhas)
>  - fronde: folha de palminha/samambaia com folíolos finos dos dois lados da nervura
>  - banana: folha comprida, verde-limão com manchas laranja, bordas rasgadas e nervuras paralelas
> As texturas são desenhadas na hora (canvas): nada de arquivo de imagem novo.
> =============================================================

**Exporta:** `matHosta`, `matFronde`, `matBanana`, `makeHostaClump`, `makeFrondeBush`, `makeBananaArk`

**Funções/métodos:** `folha`, `geometria`

### `src/world/foliage_texture.js` (335 linhas)
> =============================================================
> TEXTURA DE FOLHAGEM (desenhada por código, original)
> Uma imagem só para toda a vegetação (512 x 512):
>   - em cima à esquerda: um "tufo" de folhinhas com fundo
>     transparente, usado nos cartões de folhas de perto;
>   - em cima à direita: um quadrado branco liso, usado por troncos,
>     galhos e folhas grandes (a cor vem do próprio modelo);
>   - embaixo: um tapete de folhas sem buracos, que cobre as copas
>     "sólidas" (miolo das copas e copas de média distância).
> Os tons são claros e quase cinza: a cor verde de cada árvore
> vem da cor do modelo, multiplicada por esta imagem.
> =============================================================

**Exporta:** `WHITE_UV`, `LEAF_UV`, `TILE_UV`, `foliageTexture`, `barkTexture`, `addPlantDetail`, `addLeafLight`


### `src/world/grass.js` (366 linhas)
> =============================================================
> MATO DO CHÃO – capim, plantinhas de folha larga e brotos de
> samambaia balançando com o vento.
> Só existe num raio em volta do jogador: quando ele anda, o mato
> é "replantado" à frente. Assim o chão inteiro parece coberto sem
> pesar no celular.
> =============================================================

**Exporta:** `Grass`

**Funções/métodos:** `_mesh`, `setEnabled`, `setLowPoly`, `setQuality`, `update`, `_layer_main`, `_layer_relva`, `_layer_mini`, `_layer_far`

### `src/world/impostor.js` (61 linhas)
> =============================================================
> IMPOSTORES – "fotos" das árvores para desenhar de longe
> No começo do jogo cada tipo de árvore é fotografado de lado
> (com fundo transparente). Longe do jogador, a árvore vira um
> retângulo com essa foto que sempre olha para a câmera:
> 2 triângulos no lugar de centenas.
> =============================================================

**Exporta:** `renderImpostor`


### `src/world/island_generator.js` (827 linhas)
> =============================================================
> GERADOR DO MAPA
> Formato do The Island do ARK (contorno em ilha.json). Floresta (morros,
> grotas e mata fechada) com pântano no sudoeste, igapó em volta,
> praia na costa, o Vulcão perto do centro e, no noroeste, as montanhas
> nevadas: gigantes com neve e rocha (relevo tirado do modelo "Snow alps").
> Tudo vem de uma "semente": a mesma semente gera sempre a mesma
> ilha (importante para o save nas próximas fases).
> =============================================================

**Exporta:** `BIOME`, `BIOME_KEYS`, `IslandMap`

**Funções/métodos:** `project`, `coastDistance`, `snowRegion`, `volcanoWeight`, `volcanoHeight`, `bigMountainWeight`, `mountainHeight`, `_regionField`, `highlandField`, `plainsField`, `highlandHeight`, `swampField`, `swampMask`, `_rectInside`, `forestDensity`, `rawHeight`, `onPlateau`, `_plateaus`, `_applySwamp`, `_generate`, `_carveStreams`, `_nearestStreamPoint`, `_classify`, `_snowAmount`, `_colorForR`, `_colorFor`, `heightAt`, `inside`, `biomeAt`, `biomeKeyAt`, `heightTexture`

### `src/world/light_shafts.js` (139 linhas)
> =============================================================
> RAIOS DE SOL entre as árvores (como no Valheim): faixas de luz soltas no ar da mata,
> na direção do sol. São poucos retângulos (máx. 14) desenhados com mistura aditiva e
> recorte pela profundidade, então os troncos e o morro cortam o raio de verdade.
> Só aparecem de dia, com o sol baixo ou médio, e só na floresta. Custo: ~14 retângulos.
> =============================================================

**Exporta:** `LightShafts`

**Funções/métodos:** `_pick`, `update`, `_fadeNear`

### `src/world/lowpoly_veg.js` (705 linhas)
> =============================================================
> VEGETAÇÃO E PEDRAS LOW-POLY (estilo Valheim) – tudo feito aqui
> com formas simples (cone, cilindro, icosaedro, dodecaedro e
> tiras de triângulos), cores da paleta (core/paleta.js) e faces
> planas. Nenhum arquivo de modelo ou textura.
> 
> Cada gerador devolve uma geometria com:
>   position, normal (de face), color (uma cor por face),
>   uv (zeros) e aWind (0 = parado, 1 = balança com o vento).
> A escala e a rotação de cada planta vêm da vegetação (InstancedMesh).
> 
> >>> PARA AJUSTAR: tamanhos estão nos parâmetros de cada função;
>     cores vêm da paleta (PALETA.musgo, PALETA.marrom...).
> =============================================================

**Exporta:** `pinheiro`, `carvalho`, `palmeira`, `bananeira`, `arbusto`, `samambaia`, `samambaiaGigante`, `plantinha`, `capim`, `troncoCaido`, `arvoreMorta`, `pedregulho`, `cristais`, `pedrinhas`, `gravetos`, `cogumelos`, `concha`, `vitoriaRegia`, `mangue`, `sumauma`, `materialLowPoly`, `MODELOS_LOWPOLY`

**Funções/métodos:** `add`, `tri`, `build`

### `src/world/materials.js` (690 linhas)
> =============================================================
> MATERIAIS – a "pintura" das superfícies
> - Terreno: low-poly, uma cor da paleta por face, luz facetada.
> - Vegetação: vento (a planta enverga e as folhas tremulam) e
>   tremida quando você bate numa árvore.
> - Água: sabe a profundidade (clara e com espuma na beira,
>   escura no fundo), ondulação e reflexo do céu e do sol.
> - Céu: degradê, brilho do sol e nuvens que andam.
> - Impostor: árvore distante desenhada como "foto" (bem leve).
> =============================================================

**Exporta:** `sharedTime`, `sharedDay`, `sharedShake`, `shakeAt`, `MAX_PUSH`, `sharedPush`, `setPushers`, `detailTexture`, `makeTerrainMaterialRealista`, `makeTerrainMaterial`, `addRelief`, `addWind`, `makeWaterMaterial`, `makeSkyMaterial`, `makeImpostorMaterial`


### `src/world/projectiles.js` (134 linhas)
> =============================================================
> FLECHAS – voam com gravidade, acertam bichos (dano e sono/torpor)
> e ficam espetadas no chão um tempinho.
> =============================================================

**Exporta:** `Projectiles`

**Funções/métodos:** `_mesh`, `fire`, `update`, `_hitCreature`, `_remove`

### `src/world/props.js` (1340 linhas)
> =============================================================
> MODELOS DA FLORESTA (feitos por código, originais)
> Cada vértice tem "aWind" (0 = tronco duro, 1 = folha solta) para
> o vento. Cada modelo pode ter versão de perto (detalhada) e de
> longe (simples); bem longe a árvore vira uma "foto" (impostor).
> =============================================================

**Exporta:** `ensureUv`, `makeSumauma`, `sumaumaRootColliders`, `makeSumaumaLow`, `makeCanopyTree`, `makeCanopyTreeLow`, `makeUnderstoryTree`, `makeUnderstoryTreeLow`, `makeAcai`, `makeAcaiLow`, `makeCoconutPalm`, `makeCoconutPalmLow`, `makeBananaTree`, `makeBananaTreeLow`, `makeBananaTreeEmpty`, `makeBananaTreeEmptyLow`, `makeTreeFern`, `makeTreeFernLow`, `makeFern`, `makeBushEmpty`, `makeMejoBush`, `makeDarkBush`, `makeFruitBush`, `makeFallenLog`, `makeFallenLogLow`, `makeMossRock`, `makeMossRockLow`, `makeSpruce`, `makeSpruceLow`, `makeSnowSpruce`, `makeSnowSpruceLow`, `makeSnowDeadTree`, `makeSnowDeadTreeLow`, `makeSnowShrub`, `makeBoulder`, `makeBoulderLow`, `makeIronOre`, `makeMetalRock`, `makeObsidianRock`, `makeOilRock`, `makeCrystal`, `makeShell`, `makePebbles`, `makeMushrooms`, `makeSticks`, `makeMangrove`, `makeMangroveLow`, `makeDeadTree`, `makeReeds`, `makeCattail`, `makeWaterLily`, `makeGrassTuft`, `makeGramaTufo`, `makeGramaCartao`, `makeShortTurf`, `makeFlowerTuft`, `makeMiniPlant`, `makeLowTuft`, `makeBroadPlant`, `makeSprout`


### `src/world/respawn_points.js` (62 linhas)
> =============================================================
> PONTOS DE RENASCER (zonas na tela de morte)
> Para cada ponto de data/world/ilha.json, o jogo "caminha" do mar em
> direção ao centro até achar areia seca. Cada ponto vira 3 zonas
> ("Zona Sul 1, 2, 3") com a posição variando um pouco, como no ARK.
> (Saco de dormir/cama entram como pontos extras.)
> =============================================================

**Exporta:** `findRespawnPoints`


### `src/world/rocha_ark.js` (169 linhas)
> =============================================================
> PEDRAS NO ESTILO DO ARK
> Rochas anguladas e cinzentas, de faces planas, com manchas de ferrugem, veios claros,
> líquen e rachaduras. A forma sai de uma esfera cortada por vários planos (cada pedra é
> diferente) e a textura é desenhada na hora e projetada "por três lados" no mundo
> (não estica nas paredes e não se repete igual em cada pedra).
> =============================================================

**Exporta:** `makeRockArk`, `matRochaArk`


### `src/world/rochas.js` (145 linhas)
> =============================================================
> ROCHEDOS EM CAMADAS – blocos grandes de pedra escura em lajes
> empilhadas (rocha sedimentar), com faces retas, paredes com
> estratos e o topo com musgo/capim. São os paredões e pedregulhos
> que aparecem por toda a ilha (praia, campo e mata), no estilo
> das ilhas tropicais do ARK. Modelo e desenho feitos aqui (original).
> Tamanho do modelo: base com raio ~0,65 e altura 1 (a escala da
> vegetação estica para 3 a 12 metros).
> =============================================================

**Exporta:** `makeLayeredRock`, `layeredRockMaterial`


### `src/world/sky.js` (226 linhas)
> =============================================================
> CÉU, SOL, LUZ E NEBLINA
> - Céu: cúpula com degradê, nuvens e brilho do sol (materials.js).
> - Sol: luz direcional; a sombra cobre só a área perto do jogador.
> - Neblina úmida da floresta: vai escondendo o que está longe
>   (fica realista e o celular desenha menos).
> - Dia e noite: setTime(t) com t de 0 a 1 (0,25 = nascer do sol,
>   0,5 = meio-dia, 0,75 = pôr do sol). À noite a lua ilumina azulado.
> =============================================================

**Exporta:** `SUN_DIR`, `NIGHT_START`, `NIGHT_END`, `Sky`

**Funções/métodos:** `setTime`, `isNight`, `_setShadowRange`, `setViewDistance`, `setShadows`, `setUnderwater`, `update`

### `src/world/snow_models.js` (100 linhas)
> =============================================================
> MODELOS DA NEVE (enviados pelo jogador)
> Árvores do "Snow Trees Pack" (cartões com textura transparente) e a
> pedra "W041 Snowy Rock". Os dados vêm de textures/neve_modelos.js
> (gerado por tools/models/neve_modelos.py). Cada modelo tem altura 1
> e é escalado pela vegetação.
> =============================================================

**Exporta:** `snowTreeGeometry`, `snowTreeMaterial`, `snowRockGeometry`, `snowRockMaterial`, `snowyRockTexture`


### `src/world/snowfall.js` (83 linhas)
> =============================================================
> NEVE CAINDO na Lapônia (como no Valheim): ~1500 flocos num único objeto de pontos.
> Os flocos vivem numa caixa em volta da câmera e dão a volta (mod) em vez de nascer e
> morrer, então não há criação de objetos. A conta de posição é toda no shader.
> Só desenha quando o ar está frio (sky.cold); fora da neve o objeto fica escondido.
> =============================================================

**Exporta:** `Snowfall`

**Funções/métodos:** `update`

### `src/world/structures.js` (532 linhas)
> =============================================================
> ESTRUTURAS COLOCADAS PELO JOGADOR
> - Fogueira: acende com madeira; acesa assa a carne crua do
>   inventário de quem está perto, esquenta e ilumina a noite.
> - Saco de dormir: vira ponto de renascer no mapa e deixa dormir
>   até de manhã (se não houver perigo por perto).
> Cada uma tem: promptText() (dica na tela), use() (botão Interagir),
> update(dt) e toJSON() (para o co-op e para salvar).
> =============================================================

**Exporta:** `Structure`, `Campfire`, `SleepingBag`, `Workbench`, `Mortar`, `Forge`, `StorageBox`, `Egg`, `createStructure`

**Funções/métodos:** `remove`, `toJSON`, `lit`, `promptText`, `use`, `warmthAt`, `update`, `_cookNearby`, `flicker`, `applyState`, `respawnPoint`, `faixa`, `tempOk`, `advance`

### `src/world/terrain.js` (134 linhas)
> =============================================================
> TERRENO – transforma a grade de alturas em malhas 3D.
> A ilha é dividida em "pedaços" (chunks): o celular só desenha
> os pedaços que estão na frente da câmera e dentro da distância
> de visão. Low-poly: faces planas e uma cor da paleta por face (materials.js).
> =============================================================

**Exporta:** `buildTerrain`, `updateTerrain`


### `src/world/underwater.js` (200 linhas)
> =============================================================
> EMBAIXO D'ÁGUA – o que muda quando a câmera mergulha
>  - partículas boiando (sujeirinhas/plâncton) em volta da câmera
>  - raios de sol entrando pela superfície (só no mar, água limpa)
>  - bolhas saindo da boca de tempos em tempos
> (A cor/neblina da água fica no céu: sky.setUnderwater.)
> Tudo leve: 1 desenho para as partículas, 1 para as bolhas,
> 1 para os raios.
> =============================================================

**Exporta:** `Underwater`

**Funções/métodos:** `set`, `update`

### `src/world/veg_models.js` (117 linhas)
> =============================================================
> PLANTAS DA PRAIA E DA FLORESTA (enviadas pelo jogador)
> Palmeira, tamareiras e plantinhas da praia; árvores folhosas e capim
> da floresta. Os dados vêm de textures/veg_modelos.js (gerado por
> tools/models/vegetacao_modelos.py). Cada modelo tem altura 1 e é
> escalado pela vegetação. Modelo com tronco + folhas usa 2 materiais.
> =============================================================

**Exporta:** `vegGeometry`, `vegMaterial`


### `src/world/vegetation.js` (799 linhas)
> =============================================================
> VEGETAÇÃO – a floresta inteira (árvores, palmeiras, bananeiras,
> samambaias, arbustos de bagas, troncos caídos, pedras e plantas
> do pântano)
> 
> Desempenho (o mais importante no celular):
>   - Cada planta é só um registro (posição, tipo, tamanho).
>   - A cada instante o jogo separa as plantas visíveis em 3 grupos:
>       perto  -> modelo detalhado (com sombra)
>       médio  -> modelo simples
>       longe  -> "foto" (impostor, 2 triângulos)
>   - Cada grupo de cada tipo é UM desenho (instancing).
>   - Plantas fora da tela e além da neblina nem entram.
> 

**Exporta:** `Vegetation`

**Funções/métodos:** `_key`, `add`, `forEachNear`, `_place`, `_buildTypeMeshes`, `_mesh`, `setLod`, `setShadows`, `update`, `_step`, `resolveCollisions`, `_push`, `findTarget`, `resourceOf`, `consume`, `updateSinking`, `consumeAll`, `updateRespawn`, `countByType`

### `src/world/water.js` (209 linhas)
> =============================================================
> ÁGUA – mar, pântano e córregos (toda a água do jogo dá para beber)
> Cada "corpo d'água" sabe seu nível (altura da superfície) e se
> é doce. A física (nadar) e o "beber" perguntam aqui.
> =============================================================

**Exporta:** `WaterBody`, `WaterSystem`

**Funções/métodos:** `contains`, `_buildStreams`, `_streamAt`, `waveAt`, `bodyAt`, `update`

### `src/world/world.js` (336 linhas)
> =============================================================
> MUNDO – junta tudo: ilha, terreno, água, floresta, mato do chão,
> céu, efeitos, pontos de renascer e sacos (de morte ou de itens).
> Os outros sistemas perguntam ao mundo coisas como "qual a altura
> do chão aqui?".
> =============================================================

**Exporta:** `World`

**Funções/métodos:** `heightAt`, `waterAt`, `waveHeightAt`, `biomeKeyAt`, `biomeInfo`, `biomeNameAt`, `respawnPoint`, `temperatureAt`, `interactables`, `allRespawnPoints`, `addStructure`, `removeStructure`, `recipeFor`, `groundAt`, `structureById`, `skipToMorning`, `resolveCollisions`, `spawnDeathBag`, `setViewDistance`, `_applyViewDistance`, `_updateAltitude`, `setQuality`, `setLowPoly`, `advanceTime`, `update`

## tests/

### `tests/progression.test.mjs` (235 linhas)
> Testes rápidos da progressão (rodam no Node, sem navegador): npm run test:prog


### `tests/smoke.test.mjs` (1685 linhas)
> =============================================================
> TESTE AUTOMÁTICO: abre o jogo num navegador (modo PC e modo
> celular), verifica se não há erros e testa os sistemas (mundo, coleta, crafting, animais).
> Uso:  npm run build && npm test
> Fotos de tela vão para a pasta indicada em SHOTS (padrão: build/shots)
> =============================================================

