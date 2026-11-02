# MEGA PROMPT — ISLA (jogo de sobrevivência com dinossauros)

> Cole este texto inteiro numa IA de programação (ex.: Claude Code aberto na pasta do projeto).
> Ele junta tudo o que já foi pedido e feito: visão do jogo, números, peças de construção com custos,
> todos os bichos com tamanhos e animações, telas (interfaces), sistemas, mundo e os arquivos que já existem.
> Valores marcados com **(inicial)** são pontos de partida para balancear; o resto já está decidido.

---

## 0. Missão

Você vai construir **ISLA**, um jogo 3D de sobrevivência em uma ilha cheia de dinossauros e animais pré-históricos,
para **celular (Android) e PC**. O jogador chega numa praia sem nada, coleta recursos, fabrica ferramentas,
constrói uma base, doma e monta dinossauros e enfrenta chefões.

- O clima e a escala são de jogos de sobrevivência com dinossauros realistas ("pegada ARK"): bichos grandes, realistas,
  bases de pedra e metal, muralhas gigantes, domar e montar.
- **Tudo deve ser original.** Não copie modelos, texturas, sons, interface, nomes de itens ou textos de nenhum jogo existente.
  Use só assets próprios ou com licença livre (CC0 / CC BY com crédito). Nunca use modelos extraídos de jogos.
- **Antes de começar:** procure no repositório se já existe um projeto do jogo (cena, scripts, engine). Se existir, use-o como base e
  siga a estrutura dele. Só crie do zero o que não existir.
- Engine **(inicial)**: **Godot 4** (importa `.glb` direto, exporta para Android e PC). Se o projeto já usa outra engine, siga a do projeto.
  Existe um protótipo web em `ilha/index.html` (three.js) que serve de referência de mundo, IA dos bichos e controles.

## 1. Pilares

1. **Bichos realistas** que parecem vivos: passeiam, comem, dormem, fogem, caçam e reagem ao jogador.
2. **Construção modular em grade** (fundação, parede, teto, telhado, rampas, pontes, muralhas e portões gigantes),
   com visual de madeira e pedra rústicas (inspiração nórdica, estilo Valheim) e níveis de material (palha/madeira → pedra → metal → obsidiana).
3. **Progressão por nível**: XP libera receitas novas e pontos para atributos.
4. **Domar, comandar e montar** dinossauros, cada espécie com uma especialidade (coleta, carga, combate, voo, nado).
5. **Chefões** em regiões especiais: Vulcão, Gelo, Pântano e Mar.

## 2. Estilo visual

- **Bichos:** realistas, anatomia correta, escala real em metros. Formato `.glb`, frente para **+Z** (glTF) / **−Y** (Blender),
  pés em Y = 0, um material com textura de cor (Base Color), esqueleto e animações com os nomes da seção 6.
- **Construção:** low-poly com textura pixelada 64×64 (filtro *nearest*), cor por vértice para variar tom das tábuas,
  materiais `madeira`, `madeira_escura`, `tronco`, `palha`, `pedra`, `ferro`.
- **Cenário:** realista. Chão com texturas de foto misturadas por altura e inclinação (areia, grama, folhas de floresta, rocha;
  cinza vulcânica perto do vulcão). Árvores e arbustos como *billboards* em cruz feitos a partir de modelos CC0 (Poly Haven),
  pedras escaneadas simplificadas, mar com reflexo, neblina e céu com ciclo de dia e noite.
- **Interface:** organização igual às imagens de referência, com desenho próprio do Isla (ver seção 9).

## 3. Recursos (21)

Madeira, Palha, Pedra, Sílex, Minério de Metal, Graveto, Fibra, Couro, Ossos, Carne Estragada, Lingote de Metal,
Obsidiana, Cristal, Petróleo, Pérola de Sílica, Queratina, Pelo, Carvão, Pó de Faísca, Pólvora, Pasta de Cimento.

| Recurso | De onde vem **(inicial)** | Peso por unidade **(inicial)** | Pilha máx. **(inicial)** |
|---|---|--:|--:|
| Madeira | árvores (machado rende mais) | 0,5 | 100 |
| Palha | árvores e arbustos (mão/picareta) | 0,1 | 200 |
| Pedra | pedras e rochas (picareta) | 0,5 | 100 |
| Sílex | rochas (picareta rende mais) | 0,05 | 100 |
| Minério de Metal | rochas escuras de montanha | 1 | 300 |
| Graveto | arbustos e árvores | 0,1 | 200 |
| Fibra | plantas e arbustos (mão) | 0,01 | 300 |
| Couro | carcaças | 0,1 | 200 |
| Ossos | carcaças, esqueletos espalhados | 0,1 | 200 |
| Carne Estragada | carne crua que passou do tempo | 0,1 | 40 |
| Lingote de Metal | Forja: 2 Minério de Metal → 1 lingote | 1 | 300 |
| Obsidiana | rochas negras perto do vulcão | 1 | 100 |
| Cristal | cavernas e topo de montanhas | 1 | 100 |
| Petróleo | rochas pretas na praia e no fundo do mar | 0,1 | 50 |
| Pérola de Sílica | conchas no fundo do mar | 0,1 | 100 |
| Queratina | carcaças de bichos blindados (Anquilossauro, Sauropelta…) | 0,1 | 100 |
| Pelo | Mamute e animais de clima frio | 0,02 | 200 |
| Carvão | queimar Madeira na Fogueira ou na Forja | 0,1 | 100 |
| Pó de Faísca | Pilão: 1 Sílex + 2 Pedra → 2 Pó de Faísca | 0,01 | 100 |
| Pólvora | Pilão: 1 Pó de Faísca + 1 Carvão → 1 Pólvora | 0,1 | 100 |
| Pasta de Cimento | Pilão: 1 Queratina + 1 Pedra → 1 Pasta | 0,01 | 100 |

## 4. Construção

### 4.1 Grade e encaixe

- Tudo em **metros**. Módulo de **3 × 3 m**, paredes de **3 m** de altura, telhado a **45°**.
- Encaixe: fundação em y = 0 → paredes em y = 0 nas bordas (±1,5 m) → teto/telhado/empena em y = 3 → cumeeira em y = 6.
- Muralha: portal no meio, muros a cada 3 m a partir de ±4,5 m, ameias em y = 3, torres nas pontas.
  Folhas de portão giram em Y na dobradiça (abrir = girar até ~90°).
- O custo de cada peça sai do volume real de cada material na peça. Conversão (1 unidade vale):
  tábuas, vigas e troncos → Madeira 0,04 m³; palha do telhado → Palha 0,25 / Graveto 0,5 / Fibra 0,5 m³; pedras aparentes → Pedra 0,15 m³;
  argamassa → Pasta de Cimento 1 m³; ferragens → Lingote 0,0025 m³; chapas de metal → Lingote 0,03 m³; blocos de obsidiana → Obsidiana 0,12 m³;
  cristais → Cristal 0,008 m³.

### 4.2 Peças (arquivos em `construcao-lowpoly/modelos/`, custo também em `custos.json` e em `extras.custo` de cada `.glb`)

Formato: **Peça** — tamanho — custo.

**Fundações**
- Fundação de pedra — 3 × 3 m, 1 m de altura — 17 Pedra, 9 Pasta de Cimento
- Fundação de madeira — 3 × 3 m — 60 Madeira
- Fundação triangular — triângulo de 3 m de lado — 35 Madeira

**Paredes de madeira**
- Parede de tábuas — 3 × 3 m — 25 Madeira
- Parede de troncos — 3 × 3 m — 50 Madeira
- Parede com janela — 3 × 3 m (janela 1 × 1,06 m) — 30 Madeira
- Batente de porta — 3 × 3 m (vão 1,5 × 2,29 m) — 25 Madeira
- Porta — 1,48 × 2,27 m — 6 Madeira, 2 Lingote
- Meia parede — 3 × 1,5 m — 15 Madeira
- Parede triangular (empena) — 3 m de base × 3 m de altura — 25 Madeira

**Teto, telhados e estrutura**
- Teto/piso de madeira — 3 × 3 m (0,2 m) — 25 Madeira
- Telhado de palha 45° — cobre 3 × 3 m, sobe 3 m — 20 Madeira, 30 Palha, 14 Graveto, 14 Fibra
- Telhado de tabuinhas 45° — cobre 3 × 3 m — 40 Madeira
- Cumeeira — 3 m — 14 Madeira · Ornamento de empena — ~1,9 m — 2 Madeira
- Pilar — 3 m — 8 Madeira · Viga — 3 m — 4 Madeira
- Escada de madeira — 1,5 m de largura, sobe 3 m em 3 m — 16 Madeira · Cerca — 3 × 1,2 m — 2 Madeira

**Muro, torre e portão (fortaleza básica)**
- Muro de pedra — 3 × 3 m, 0,9 m de espessura — 30 Pedra, 5 Pasta
- Ameias — 3 × 1 m — 7 Pedra, 1 Pasta
- Torre de canto — 1,4 × 1,4 × 5,3 m — 35 Pedra, 6 Pasta
- Portal grande de pedra — 6 × 6,6 m (vão 4,2 × 4,8 m) — 130 Pedra, 10 Pasta, 9 Lingote
- Portão grande (cada folha) — 2,08 × 4,76 m — 35 Madeira, 15 Lingote

**Peças de pedra em 3 tamanhos (P / M / G)**

| Família | P | M | G |
|---|---|---|---|
| Parede de pedra (0,5 m) | 1,5 × 3 m — 11 Pedra, 1 Pasta | 3 × 3 m — 20 Pedra, 2 Pasta | 6 × 3 m — 45 Pedra, 5 Pasta |
| Piso de pedra (0,3 m) | 1,5 × 1,5 m — 3 Pedra, 1 Pasta | 3 × 3 m — 9 Pedra, 1 Pasta | 6 × 6 m — 35 Pedra, 6 Pasta |
| Escada de pedra | 1,5 de largura, sobe 1,5 — 10 Pedra, 1 Pasta | 3 de largura, sobe 3 — 40 Pedra, 12 Pasta | 6 de largura, sobe 3 — 70 Pedra, 25 Pasta |
| Rampa de pedra | 1,5 × 3, sobe 1,5 — 11 Pedra, 2 Pasta | 3 × 6, sobe 3 — 45 Pedra, 25 Pasta | 6 × 6, sobe 3 (montarias) — 70 Pedra, 50 Pasta |
| Ponte (3 m de largura) | 6 m de vão — 110 Madeira | 9 m, 1 pilar de 4 m — 150 Madeira, 95 Pedra, 13 Pasta | 15 m, 2 pilares — 240 Madeira, 185 Pedra, 25 Pasta |

Os pilares das pontes descem 4,4 m abaixo do piso (rio ou vale).

**Muralhas por nível** — muro normal (3 × 3 m, 0,9 m), grande (6 × 6 m, 1,2 m), gigante (9 × 9 m, 1,8 m),
portal gigante (9 × 9 m, vão de **6,6 × 7,5 m** para dinossauros grandes) e duas folhas de portão gigante (3,28 × 7,46 m cada, dobradiça em x = ∓3,3 m).

| Nível | Muro normal | Muro grande | Muro gigante | Portal gigante | Folha de portão (cada) |
|---|---|---|---|---|---|
| Pedra | 30 Pedra, 5 Pasta | 275 Pedra, 50 Pasta | 665 Pedra, 170 Pasta | 400 Pedra, 45 Pasta, 30 Lingote | 195 Madeira, 2 Lingote (troncos com treliça) |
| Metal | 95 Lingote | 545 Lingote | 1280 Lingote | 710 Lingote | 130 Lingote |
| Obsidiana | 50 Obsidiana, 30 Lingote, 5 Pasta, 1 Cristal | 315 Obsidiana, 150 Lingote, 45 Pasta, 25 Cristal | 800 Obsidiana, 330 Lingote, 160 Pasta, 115 Cristal | 365 Obsidiana, 30 Lingote, 55 Pasta, 25 Cristal | 25 Obsidiana, 40 Lingote, 4 Cristal |

### 4.3 Regras de construção (inicial)

- Peça "fantasma" verde (pode) / vermelha (não pode). Encaixe automático em bordas, topo e pontos de dobradiça; girar de 90° em 90°.
- Precisa estar sobre fundação, pilar ou peça apoiada; até 3 módulos de balanço sem pilar.
- Vida das peças: palha 500 · madeira 2.000 · pedra 10.000 · metal 25.000 · obsidiana 50.000 (muro grande ×4, gigante ×9).
- Só armas e bichos de nível igual ou acima do material causam dano cheio; abaixo disso, 10%.
- Demolir devolve 50% do custo. Portões abrem só para o dono e a tribo.

## 5. Bichos

### 5.1 Lista completa (arquivos prontos em `bichos/modelos/`)

Tamanho = comprimento real (envergadura nos voadores). Vida/dano **(inicial)**, já usados no protótipo da ilha.

| Bicho | Arquivo | Tamanho | Tipo | Jeito | Vida | Dano | Especialidade quando domado |
|---|---|--:|---|---|--:|--:|---|
| Raptor | raptor.glb | 3,2 m | carnívoro, bando de 3 | caça o jogador (alcance 35 m) | 150 | 15 | montaria rápida, caça em bando |
| T-Rex | trex.glb | 12 m | carnívoro | caça (55 m) | 1500 | 70 | combate pesado |
| Carnotauro | carnotauro.glb | 7,8 m | carnívoro | caça (45 m) | 500 | 35 | montaria de ataque rápida |
| Espinossauro | espinossauro.glb | 16 m | carnívoro, terra e água | caça perto de rios | 1200 | 55 | combate na água, pesca |
| Dilofossauro | dilofossauro.glb | 3,3 m | carnívoro | cospe veneno que cega | 120 | 10 | guarda de base |
| Compsognato | compsognato.glb | 1 m | carnívoro, bando de 6 | ataca em grupo (18 m) | 25 | 4 | bichinho de colo |
| Galimimo | galimimo.glb | 6 m | herbívoro, medroso | foge | 120 | — | montaria mais rápida, carrega 2 |
| Terizinossauro | terizinossauro.glb | 9,5 m | herbívoro, bravo | revida com garras | 900 | 40 | coleta de fibra, frutas e madeira |
| Paquicefalossauro | (falta o modelo) | 4,3 m | herbívoro | cabeçada | 200 | 15 | derruba pedras |
| Iguanodonte | iguanodonte.glb | 8,5 m | herbívoro | anda em 4, corre em 2 | 400 | 20 | coleta de sementes e frutas |
| Parassauro | parassauro.glb | 9,5 m | herbívoro, medroso | foge, chama o bando | 350 | — | montaria inicial, alerta de predador |
| Tricerátops | triceratops.glb | 8,5 m | herbívoro, bravo | revida com chifres | 600 | 25 | coleta de frutas, tanque inicial |
| Paquirrinossauro | paquirrinossauro.glb | 6,4 m | herbívoro, bravo | investida | 500 | 25 | apoio de bando |
| Estegossauro | estegossauro.glb | 9 m | herbívoro, bravo | golpe de cauda | 700 | 30 | coleta de palha e frutas |
| Kentrossauro | kentrossauro.glb | 4 m | herbívoro, bravo | espinhos | 400 | 25 | defesa (reflete dano) |
| Anquilossauro | anquilossauro.glb | 7 m | herbívoro, bravo | clava na cauda | 800 | 30 | coleta de pedra e minério |
| Sauropelta | sauropelta.glb | 5,5 m | herbívoro | blindado | 650 | 20 | tanque de defesa |
| Braquiossauro | braquiossauro.glb | 21 m | herbívoro | pisada | 3000 | 70 | carga e alcance alto |
| Diplodoco | diplodoco.glb | 25 m | herbívoro | chicote de cauda | 2500 | 50 | transporte em plataforma |
| Argentinossauro | argentinossauro.glb | 32 m | herbívoro, bravo | pisada | 4000 | 80 | plataforma de construção móvel |
| Dimetrodonte | dimetrodonte.glb | 3,5 m | carnívoro | morde | 250 | 15 | aquece/resfria a base (incubadora) |
| Moschops | moschops.glb | 2,8 m | herbívoro | cabeçada | 200 | 10 | coleta de cogumelos e raízes |
| Mamute-lanoso | mamute.glb | 10 m (bebê adaptado: 7 m) | herbívoro, bravo | presas | 900 | 35 | coleta de madeira, resiste ao frio |
| Dodô | dodo.glb | 1 m | herbívoro | inofensivo | 30 | — | ovos (comida) |
| Rei-dodô (chefe) | reidodo.glb | 10 m | chefe | bicadas | 6000 | 60 | — |
| Pteranodonte | pteranodonte.glb | 7 m | voador | voa em círculos | 120 | 10 | primeiro voador, batedor |
| Quetzalcoatlus | quetzalcoatlus.glb | 11 m | voador | voa alto | 1500 | 30 | carrega plataforma voadora |
| Argentavis | argentavis.glb | 4,5–7 m | voador | voa e mergulha | 300 | 20 | carga voadora, carrega bichos pequenos |
| Titanoboa | titanoboa.glb | 13 m | carnívoro, terra e água | emboscada | 900 | 45 | (não domável) |
| Deinosuchus | deinosuchus.glb | 11 m | carnívoro, margem de rio | emboscada (20 m) | 600 | 40 | combate na margem |
| Mosassauro | mosassauro.glb | 14 m | marinho | caça no mar fundo (40 m) | 2000 | 90 | montaria marinha |
| Piranha-gigante | piranha.glb | 0,4 m | marinho, cardume de 5 | ataca quem nada (14 m) | 15 | 5 | (não domável) |
| Megatério | megaterio.glb | 5,5 m (4,95 m em pé) | herbívoro, bravo | garras | 900 | 35 | fibra e frutas no alto; forte contra insetos |
| Bisão-gigante | bisao.glb | 4,6 m | herbívoro, bando de 6 | investida em bando | 300 | 20 | carga barata, couro e palha |
| Paraceratério | paraceraterio.glb | 7,4 m (4,6 m de altura) | herbívoro | pisada | 1200 | 35 | plataforma de construção, madeira alta |
| Edmontossauro | edmontossauro.glb | 11 m | herbívoro | foge, chama o bando | 700 | — | coleta de frutas e sementes |
| Lystrosaurus | lystrosaurus.glb | 1,1 m | herbívoro | inofensivo | 40 | — | bichinho de colo: bônus de XP |
| Barionix | barionix.glb | 9 m | carnívoro, rio | caça na margem | 600 | 35 | pesca, forte contra piranhas |
| Suchomimo | suchomimo.glb | 11 m | carnívoro, rio | caça na margem | 800 | 40 | pesca e combate na água |
| Giganotossauro | giganotossauro.glb | 13 m | carnívoro, raro | caça agressivo | 1800 | 80 | o predador mais forte domável |
| Sarcosuchus | sarcosuchus.glb | 11 m | carnívoro, pântano | emboscada | 700 | 45 | combate no pântano |
| Chefe do Vulcão (dragão de lava) | chefe_vulcao.glb | 20 m | chefe | cospe fogo, pisa o chão | 20000 | 120 | — |
| Chefe do Gelo (mamute colossal) | chefe_gelo.glb | ~13 m | chefe | presas, avalanche | 15000 | 100 | — |
| Chefe do Pântano (sarcosuchus gigante) | chefe_pantano.glb | ~19 m | chefe | emboscada, rolamento | 15000 | 100 | — |
| Chefe do Mar (mosassauro abissal) | chefe_mar.glb | ~25 m | chefe | investida, sacudir a presa | 18000 | 110 | — |

### 5.2 Comportamento (IA)

- Estados: parado, passear (alvo aleatório num raio de 10–60 m de casa), comer, dormir (herbívoros à noite), fugir, caçar, atacar, morto.
- Herbívoros **medrosos** fogem quando o jogador chega a 14 m ou leva dano; **bravos** revidam por 20 s depois de atacados.
- Carnívoros caçam o jogador dentro do raio de alcance da tabela; atacam a cada 1,6 s, o dano entra 0,5 s depois do início da animação.
- Velocidade **(inicial)**: andar = 0,9 + 0,22 × comprimento (máx. 5 m/s); correr = 3,5 + 0,8 × comprimento (máx. 15 m/s).
- Bichos de terra não entram na água (exceto Deinosuchus, Sarcosuchus, Barionix, Suchomimo, Espinossauro); peixes e mosassauros só na água.
- Voadores voam em círculos (30–70 m de altura, raio 40–100 m), alternando `voar` e `planar`.
- Mortos ficam 40 s como carcaça (coleta de carne, couro, ossos, queratina/pelo) e renascem na área de origem.
- Só atualizar animação dos bichos a até 260 m do jogador.

### 5.3 Domar (inicial)

- **Nocaute:** cada bicho tem Torpor máximo = vida × 1,5. Golpes de mão, porrete e flechas tranquilizantes enchem o Torpor; ao lotar, cai desacordado.
- **Alimentar:** desacordado, aceita a comida da dieta (carnívoro: carne; herbívoro: frutas/verduras; ração especial dá 3×).
  Barra de "domando" sobe a cada mordida; o Torpor desce com o tempo e Narcóticos repõem. Apanhar reduz a efetividade.
- **Passivos** (Dodô, Lystrosaurus, Moschops, Galimimo **(inicial)**): domam dando comida na mão, sem nocaute.
- Chefes, Titanoboa e Piranha não são domáveis.
- Montar exige a **sela** da espécie (receita liberada por nível).

### 5.4 Comandos para bichos domados

Roda de comandos (segurar o botão): **Seguir**, **Ficar parado**, **Passivo**, **Neutro**, **Agressivo**, **Atacar meu alvo**,
**Seguir de longe / de perto**, **Pousar** (voadores). Pode mandar para um bicho só ou para todos por perto.

## 6. Animações (nomes exatos; cada uma é uma Action/clipe separado)

- **Comuns:** `parado` (loop), `andar` (loop), `correr` (loop), `atacar` (uma vez), `rugir` (uma vez), `comer` (loop), `dormir` (loop), `morrer` (uma vez, termina deitado).
- **Extras por espécie:** `nadar`, `nadar_rapido` (aquáticos), `voar`, `planar`, `decolar` (voadores), `chamar` (Parassauro), `atacar_cauda` (T-Rex),
  `cuspir_fogo` e `pisar_chao` (Chefe do Vulcão), `sentado` (dragão), e no Raptor/Compsognato também `pular`, `farejar`, `beber`, `ferido`, `trotar`.
- Aquáticos sem pernas usam `andar` = nado lento e `correr` = nado rápido.
- Voadores: a altitude é controlada pelo jogo, a animação não sobe nem desce o corpo.
- Esqueleto mínimo: quadril (raiz), coluna (3), pescoço (3), cabeça, mandíbula, cauda (6–8), braços (ombro, antebraço, mão), pernas (coxa, canela, pé, dedos).

## 7. Jogador

### 7.1 Atributos (inicial)

| Atributo | Valor inicial | Por ponto de nível |
|---|--:|--:|
| Vida | 100 | +10 |
| Fôlego (estamina) | 100 | +10 |
| Oxigênio | 100 | +20 |
| Comida | 100 | +10 |
| Água | 100 | +10 |
| Peso que carrega | 100 | +10 |
| Dano corpo a corpo | 100% | +5% |
| Velocidade de movimento | 100% | +2% (máx. 150%) |
| Resistência a frio/calor | 0 | +2 |
| Torpor (desmaio) | 0 / 200 | — |

- Andar 4,2 m/s, correr 8,5 m/s (gasta 18 de fôlego por segundo, recupera 10/s), nadar 2,6 m/s, pulo de 8 m/s, gravidade 22 m/s².
- Vida regenera 1,5/s com comida e água acima de 20%. Comida cai 1 a cada 30 s, água 1 a cada 20 s **(inicial)**.
- Ao morrer, o corpo vira uma bolsa com o inventário e o jogador renasce na praia (ou numa cama/saco de dormir).

### 7.2 Níveis e receitas (inicial)

- XP por coletar, fabricar, construir, matar e domar. Nível máximo 100. Cada nível dá 1 ponto de atributo e pontos de receita.
- Receitas por faixa de nível:
  - **1–10:** picareta e machado de pedra, lança, porrete, tocha, fogueira, saco de dormir, roupa de fibra, peças de palha e madeira.
  - **10–25:** arco e flechas (pedra e tranquilizante), pilão, peças de pedra P/M/G, muro e portal de pedra, selas pequenas.
  - **25–45:** forja, ferramentas de metal, roupas de couro e pelo, besta, muralhas grandes de pedra, rampas, pontes, selas médias.
  - **45–70:** muros de metal (normal, grande, gigante), portões gigantes, armas de pólvora, selas grandes.
  - **70–100:** obsidiana (muros, portal e portão gigantes), selas de plataforma, equipamento para os chefes.

## 8. Mundo

- Ilha de **~900 × 900 m** (o protótipo; o jogo final pode crescer), rodeada de mar.
- Regiões: **praias** (areia, Dodô, Deinosuchus), **campos** (bandos de herbívoros), **florestas** (Raptor, Compsognato, Megatério),
  **montanhas** (Anquilossauro, Mamute, T-Rex, minério e cristal), **lagoa e rios** (Barionix, Suchomimo, piranhas),
  **pântano** (Sarcosuchus, Titanoboa), **mar** (mosassauros, piranhas, petróleo, pérolas),
  **vulcão ao norte** (cratera com lava, obsidiana, arena do Chefe do Vulcão), **pico gelado** (Chefe do Gelo).
- Vegetação por região: **coqueiros/palmeiras** nas praias, mangue nas margens e no pântano, árvores de copa larga e samambaias nas florestas, 
  **árvores gigantes** (tipo sequoia, 40–60 m, de onde se tira muita madeira) nas florestas altas, pinheiros e árvores secas nas montanhas, 
  árvores cobertas de neve no pico gelado. Troncos caídos, pedras e conchas espalhados na areia.
- Ciclo de dia e noite: **8 minutos** por dia completo **(inicial)**; à noite os herbívoros dormem e os carnívoros caçam mais.
- Quantidade inicial por espécie (protótipo): Dodô 8, Galimimo 6, Parassauro 6, Tricerátops 4, Estegossauro 3, Anquilossauro 2, Bisão 6, Megatério 2,
  Mamute 3, Argentinossauro 2, Compsognato 6, Raptor 6, Carnotauro 2, T-Rex 1, Deinosuchus 2, Piranha 10, Mosassauro 2, Pteranodonte 4, Argentavis 2.

## 9. Interfaces (telas)

A **organização** das telas segue as imagens de referência em `Ark IMAGENS CLAUDE/`: mesmas telas, mesma posição dos blocos,
mesmas abas e botões. O **desenho** é do Isla: painéis translúcidos escuros com moldura fina, cantos chanfrados,
textura leve de pedra e destaques em âmbar; ícones próprios em traço simples; fonte limpa em caixa alta nos títulos.
Não usar arquivos, ícones, logos ou arte de outro jogo. Tudo legível em celular (alvos de toque de no mínimo 48 px).

### 9.1 HUD (em jogo, celular em modo paisagem)
- **Câmera:** 1ª pessoa mostrando as mãos/ferramenta na frente (padrão) ou 3ª pessoa atrás do personagem (alternar nas opções e com um botão).
- **Topo, centro:** avisos curtos em verde, ex.: "NOVO NÍVEL DISPONÍVEL! Abra o inventário para gastar o ponto".
- **Topo, esquerda:** botão do inventário (mochila) e botão de comandos dos domados.
- **Esquerda, embaixo:** joystick de movimento (aparece onde o polegar toca).
- **Direita, embaixo:** grade de botões de ação (atacar/usar, pular, agachar, montar/desmontar, construir) e, acima, a barra rápida.
- **Embaixo, centro:** **barra rápida de 10 espaços** com os itens equipáveis (no PC: teclas 1–0).
- **Direita, vertical:** ícones pequenos de estado que acendem quando algo fica baixo: comida, água, oxigênio, peso, frio/calor.
- **Barras:** vida e fôlego sempre visíveis; nome e vida do alvo no topo quando mira num bicho.
- **Mira** pequena no centro; ao olhar para recurso/item aparece "Coletar", "Pegar", "Abrir".

### 9.2 Inventário (tela cheia, 3 colunas)
- **Abas no topo da coluna esquerda:** INVENTÁRIO e FABRICAÇÃO. Fileira de botões de filtro (todos, recursos, ferramentas, consumíveis, estruturas) e busca.
- **Coluna esquerda:** grade de itens do jogador; cada espaço mostra ícone, quantidade e barra de durabilidade.
- **Coluna do meio — VOCÊ:** nível, XP atual/necessário, pontos para gastar, e a lista de atributos com valor atual/máximo e botão **+**:
  Vida, Fôlego, Oxigênio, Comida, Água, Peso, Dano corpo a corpo, Velocidade de movimento, Resistência (frio/calor), Fortaleza, Torpor.
- **Coluna direita:** o personagem em 3D girável, com os espaços de equipamento em volta (cabeça, peito, mãos, pernas, pés, escudo).
- **Embaixo:** a mesma barra rápida do HUD, para arrastar itens; contador de moedas/fichas à esquerda dela **(opcional)**.
- **Canto superior direito:** botão **X** para fechar.
- Quando aberto perto de um baú, bicho domado ou estação, a coluna direita vira o inventário desse lugar para arrastar itens de um lado para o outro.

### 9.3 Receitas (árvore de conhecimento)
- **Topo:** título RECEITAS e fileira de abas por categoria (ferramentas, armas, roupas, estruturas, selas, estações, consumíveis, cadeado = bloqueadas).
- **Centro:** linhas numeradas por **nível** (1, 2, 3, 4…) com os ícones das receitas daquele nível; bloqueadas aparecem em silhueta escura.
- **Ao tocar numa receita:** custo em pontos, materiais, onde fabricar e botão **Aprender**.
- **Embaixo:** "PONTOS DISPONÍVEIS: N" e a barra rápida.

### 9.4 Pausa
- Fundo do jogo escurecido e quatro botões grandes empilhados no centro: **RESUMIR**, **OPÇÕES**, **SALVAR JOGO**, **VOLTAR AO MENU PRINCIPAL**.

### 9.5 Opções
- **Coluna esquerda (abas):** ÁUDIO, GRÁFICOS, INTERFACE, JOGABILIDADE, CONTROLES.
- **Topo direito:** botão desfazer/restaurar padrão e botão **X**.
- **Painel direito:** conteúdo da aba.
  - Áudio: geral, música, efeitos, ambiente, bichos.
  - Gráficos: qualidade, distância de visão, sombras, grama, água, FPS 30/60, escala de resolução.
  - Interface: tamanho e transparência do HUD, mostrar números de dano, idioma.
  - Jogabilidade: 1ª/3ª pessoa, sensibilidade, inverter eixo Y, mira automática.
  - **Controles (celular):** título "CONTROLES BÁSICOS" e uma lista; cada linha mostra o **gesto** (com desenho do gesto) à direita e as **ações** à esquerda:
    - deslizar a partir da borda → abre a roda de ações/comandos;
    - deslizar para cima → pular · voar (montado) · subir;
    - deslizar para baixo → recarregar · pousar (montado);
    - tocar → usar / coletar · atacar / atirar · ativar;
    - tocar e segurar → olhar em volta · abrir inventário · montar/desmontar;
    - tocar duas vezes e segurar → repetir coleta · mirar com arco · disparo de torreta (montado);
    - tocar duas vezes num item do inventário → transferir item · mover para a barra rápida;
    - na tela do inventário, tocar e segurar no chão → andar; tocar duas vezes → correr.
  - Controles (PC): tabela de teclas editável (WASD, Shift, Espaço, C, E, F, I, Q, Tab, 1–0, mouse).

### 9.6 Roda de comandos dos domados
- Aparece no centro da tela, circular, dividida em fatias; o centro tem um ícone do bicho selecionado.
- Fatias: **Seguir (um)**, **Seguir (todos)**, **Parar (um)**, **Parar (todos)**, **Passivo**, **Neutro**, **Agressivo**, **Atacar meu alvo**,
  **Pousar (voadores)**, **Expressões** (acenar, dançar…), e uma fatia para trocar entre "um bicho" e "todos por perto".
- Escolher arrastando o dedo/mouse até a fatia e soltando.

### 9.7 Construção
- Ao escolher uma peça na barra rápida aparece a peça fantasma (verde = pode, vermelha = não pode) com o custo ao lado.
- Roda de peças por categoria (Fundação, Parede, Teto/Telhado, Escada/Rampa, Ponte, Muralha, Portão), seletor de material e de tamanho
  (P/M/G; normal/grande/gigante), botões girar 90°, confirmar e cancelar.

### 9.8 Bicho domado
- Igual ao inventário: coluna esquerda = inventário do jogador; meio = atributos do bicho (nível, vida, fôlego, comida, peso, dano, velocidade)
  com **+** para evoluir; direita = o bicho em 3D com o espaço da sela e o inventário dele. Mostra nome (editável), dono e comando atual.

### 9.9 Domando
- Ao olhar um bicho desacordado: barra **Domando %**, barra de **Torpor**, comida preferida, efetividade e tempo estimado.

### 9.10 Mapa
- Mapa da ilha desenhado à mão em **pergaminho** (terra cor de areia, mar verde-azulado, curvas de nível nas montanhas),
  com **grade de coordenadas de 10 a 90** nas bordas, posição do jogador, marcadores pessoais, camas e domados.

### 9.11 Outras telas
- **Inicial:** logo ISLA sobre uma praia, Jogar, Continuar, Opções, Créditos.
- **Carregamento:** imagem da ilha, barra de progresso e dicas.
- **Morte:** "VOCÊ MORREU", lista de onde renascer (praias da ilha ou camas) e botão Renascer.
- **Créditos:** lista do `bichos/CREDITOS.md`.

## 10. O que já está pronto no repositório

- `bichos/modelos/` — **44 `.glb`** com esqueleto e animações (texturas em WebP; total ~93 MB).
- `bichos/CREDITOS.md` — créditos obrigatórios (CC BY). **Atenção:** `titanoboa.glb` é CC BY-NC e de origem duvidosa (só uso não comercial);
  trocar antes de vender o jogo. Paquicefalossauro ainda não tem modelo.
- `bichos/` — ferramentas: `animar.mjs` (esqueleto automático), `adaptar.mjs`, `completar.mjs` (criar e consertar animações), `variante.mjs`
  (tamanho, cor e pele de chefe: gelo/musgo/abismo/lava), `congelar.mjs`, `ave.mjs`, `refazer.sh`; scripts Blender em `bichos/blender/`.
- `construcao-lowpoly/` — todas as peças de construção em `.glb`, `custos.json`, `CUSTOS.md`, editor no navegador.
- `prompts_dinos/` — prompts detalhados de cada bicho (cores, formas, triângulos, textura, esqueleto, animações).
- `ilha/` — protótipo jogável no navegador (terreno, mar, vulcão, vegetação, 77 bichos com IA, dia e noite, vida, fôlego e combate).
  Link de teste: https://claude.ai/artifact/6t1bVDgXZXc21c3Z8F2kRG
- `Ark IMAGENS CLAUDE/` — imagens de referência de clima e telas (só referência; não copiar).

## 11. Especificações técnicas

- Unidades em metros; Y para cima; bichos olhando para +Z; pés em Y = 0.
- Orçamento por bicho no celular: 4.000–16.000 triângulos (modelos acima disso devem ganhar LOD), textura 256–1024 px conforme o tamanho.
- Construção: textura 64×64 *nearest* e cor por vértice.
- Desempenho alvo: 30 FPS em celular intermediário, 60 FPS no PC; sombras só perto do jogador; vegetação instanciada; LOD e *culling* por distância.
- Salvar: mundo (peças, bichos domados, recursos no chão), jogador (atributos, inventário, receitas) em arquivo local; salvamento automático a cada 5 min.
- Dados de balanceamento em arquivos editáveis (JSON): recursos, receitas, custos de peças, atributos dos bichos.

## 12. Ordem de trabalho

1. Projeto na engine, importar bichos e peças; cena da ilha (terreno, mar, vegetação, céu, dia e noite).
2. Jogador: movimento, câmera, atributos, HUD, controles de celular e PC.
3. Coleta, inventário, fabricação, receitas e níveis.
4. Construção com encaixe, custos, vida das peças e demolição.
5. IA dos bichos, combate, carcaças e renascimento.
6. Domar, comandos, selas e montaria (terra, água e ar).
7. Chefes e suas arenas.
8. Menus, opções, salvar/carregar, créditos.
9. Otimização para celular e testes.

Ao terminar cada etapa: rode o jogo, confira se funciona, mostre o que foi feito e salve no Git.
