# Ilha Primordial

Jogo 3D de sobrevivência com dinossauros. Sozinho (offline) ou em **co-op online até 4 jogadores**.
Roda no celular (Android como app ou no navegador) e no PC.
Visual estilizado, feito para ser leve.

**Versão 0.8.2** – Quetzalcoatlus no tamanho real: 10–11 m de asa aberta e uns 5 m de
altura em pé (do tamanho de uma girafa). Agora ele também pousa: de vez em quando desce
planando, anda no chão de quatro (apoiado nas asas dobradas, com o pescoço em pé), caça
bichos pequenos a pé e depois levanta voo de novo (`envergadura_m`, `pousa` e `vel_chao`
em `criaturas.json`).

**Versão 0.8.0**
- **Domar:** soco e clava dão *torpor* (sono). Com o torpor no máximo o bicho desmaia;
  chegue perto e aperte Interagir para pôr a comida preferida dele no "prato" (ele come
  uma a cada 3 s). Encheu a barra = domado. Se o torpor acabar antes, ele acorda bravo —
  dê Baga-Escura para ele dormir mais. A lupa mostra o progresso.
- **Domado:** segue você e defende (ataca quem te bate e quem você ataca). Interagir nele
  manda *ficar* / *seguir*. Domado não some e vive bem mais.
- **Montar:** F (ou botão Montar) perto de um domado que dá para montar (parassauro,
  raptor, tricerátops, T-rex…). Joystick/WASD comanda, Correr corre, Atacar = o bicho
  ataca. F de novo para descer.
- **Construir:** Piso, Parede, Parede com Porta, Teto e Rampa (Inventário → Criar →
  Construção). Selecione a peça na barra: aparece um fantasma verde onde ela vai ficar
  (vermelho = não dá). Atacar coloca. As peças encaixam numa grade de 3 m; o teto vira
  chão do segundo andar e a rampa sobe até ele. Parede segura você e os bichos.
  Interagir numa peça desmonta (devolve metade); na porta, abre/fecha.
- **Jogo salvo:** o progresso (você, mochila, nível, habilidades, hora, construções e
  bichos domados) fica salvo no aparelho — sozinho a cada 30 s, ao pausar e ao sair.
  Na tela inicial aparece *Continuar*; *Novo jogo* apaga o salvo.
- Bichos por perto conforme a qualidade gráfica: baixa 14, média 20, **alta 45** (v0.8.1).
  O limite de carnívoros sobe junto (4 a cada 20 bichos: 9 na alta).
- Montado, a mordida dos predadores pega na montaria, não em você.

**Versão 0.7.0**
- **Chão de terra de verdade:** textura do arquivo *Soft Dirt Material* (cor + relevo)
  em toda a floresta, misturada com a cor de cada lugar.
- **Pedrinhas e gravetos no chão:** pegue com Interagir (E) desde o começo. Machado e
  picareta de pedra, tocha e fogueira agora usam gravetos; a fogueira também queima
  gravetos (o dobro da madeira).
- **Botões do celular no lugar que você quiser:** Pausa → *Ajustar posição dos botões*,
  arraste e aperte *Travar* (fica salvo; *Padrão* volta ao normal).
- **Bichos nascem e morrem:** macho e fêmea da mesma espécie perto um do outro têm
  filhotes; o filhote segue a mãe e cresce até virar adulto (~12 min). Um dia ficam
  velhos e morrem. Mais bichos na floresta (até 22 por perto).
- **Tamanhos reais** (do focinho à cauda): espinossauro 14–18 m, T-rex 11,5–12,4 m,
  deinosuchus 10–12 m, titanoboa 12–14 m, braquiossauro 20–22 m… (`comprimento_m` em
  `criaturas.json`). Sumaúmas agora têm 38–50 m, então nenhum bicho passa delas.
- **Stamina dobrada** (200) e **Habilidades** no inventário: cada nível dá 1 ponto para
  melhorar vida, stamina, comida, água, fôlego, peso ou força (`balanceamento.js` →
  `habilidades`).

**Versão 0.6.3** – lupa para inspecionar bichos: mire num bicho e aperte a lupa (canto de
cima) ou **R**. Em 2 s aparece a ficha com vida, força, peso que carrega, stamina,
velocidade e torpor. Cada bicho sorteia esses números entre o mínimo e o máximo da
espécie (`criaturas.json` → `atributos`), então dois raptores podem ser bem diferentes.
A velocidade sorteada muda o quanto ele corre de verdade, e agora os bichos cansam:
correndo gastam stamina e, sem stamina, só andam até recuperar.

**Versão 0.6.2** – bichos mais devagar (andar ~30% e correr ~35% mais lentos, passos
mais compridos, descansam mais) e brigas entre animais: carnívoros com fome caçam
herbívoros, os grandões comem carnívoros menores, rivais do mesmo porte brigam por
território, herbívoros fortes (tricerátops, estego, anquilo…) encaram e revidam, os
outros fogem. Tem sangue e som de mordida, e o vencedor fica comendo a carcaça.
Números em `balanceamento.js` → `brigas`. Golpe do jogador agora acerta qualquer parte
do bicho (cabeça, corpo ou cauda), não só o meio.

**Versão 0.6.1** – espinossauro com modelo 3D de verdade (11 mil triângulos, escamas e
relevo do modelo original, cor realista pintada por região, animado pelo jogo).

## Trocar o modelo de um animal

1. Coloque o arquivo `.usdz` (com esqueleto) numa pasta.
2. `python tools/models/usd_extrair.py modelo.usdz cru.json 15` (15 = comprimento em metros;
   precisa de `pip install usd-core numpy`).
3. Diminua as texturas (cor em cinza 1024, relevo 512) e rode
   `node tools/models/usd_para_jogo.mjs cru.json cor.jpg relevo.jpg src/creatures/imported/<id>.js 11000`.
4. Em `src/creatures/imported_model.js` acrescente a espécie em `IMPORTED`.
   (Os nomes dos ossos do modelo são ligados aos do jogo em `GROUPS`/`PIVOT` no conversor.)

**Versão 0.6** – água com física, bancada, música e animais mais reais.

- **Nadar com física**: o corpo boia (empuxo), a água freia, cada braçada empurra e as
  ondas do mar balançam. **Mergulho** com visual próprio: mar azul com raios de sol,
  pântano turvo, partículas boiando, bolhas e a visão ondulando; som abafado.
- **Bancada de Trabalho**: coloque no chão e use (Interagir) para abrir o crafting. Perto
  dela liberam **Machado de Sílex**, **Picareta de Sílex** (rendem +50%) e **Lança de Osso**.
- **Inventário/crafting novo**: categorias, cartões mostrando o que falta, barras de
  quanto você tem, botões Criar / ×5 / Máx, fila com cancelar e barra de peso.
- **Sumaúma (árvore gigante)**: só com machado; socar com a mão machuca e não dá nada.
  Ela não acaba.
- **Pântano**: sempre tem deinosuchus e titanoboa quando você chega perto (titanoboa só
  vive lá).
- **Animais em velocidade real** (mais lentos), **pterodáctilo e quetzalcoatlus maiores**,
  voando mais baixo e com cores que dá para ver.
- **Floresta mais densa**; o nome do bioma não aparece mais na tela.
- **Música de fundo** calma (volume próprio no menu de pausa) e mais pássaros, cigarras,
  tucanos e pica-paus na floresta.

**Versão 0.5** – sons, dia de 7 min e noite de 3 min.

- **Sons** (todos gerados por código): floresta de dia (vento, pássaros, insetos) e de
  noite (grilos, sapos, coruja), passos (mato/areia/água), golpes, madeira, pedra, folhas,
  fogueira estalando, água, comer, beber, dor, e a voz de cada animal (rugido, mugido,
  pio, chiado...) vindo da direção dele. Volume no menu de pausa.
- **Dia 7 minutos, noite 3 minutos** (mude em `balanceamento.js` → `dia`).
- Sem a lista de objetivos e sem os botões "1ª pessoa" e "FPS" no canto
  (câmera e FPS continuam no menu de pausa; no PC: V e F3).

**Versão 0.4** – sobrevivência, dia e noite e co-op.

- **Co-op online**: um jogador toca em **Criar partida co-op** e recebe um código de 6
  letras; os amigos tocam em **Entrar com código**. Precisa de internet nos dois aparelhos
  (um servidor público e gratuito só ajuda os aparelhos a se acharem; depois a conexão é
  direta). Quem criou a partida controla os animais e a hora do dia; se ele sair, os outros
  continuam sozinhos.
- **Dia e noite**: à noite esfria, os predadores enxergam mais longe
  e fica escuro — use **tocha** e **fogueira**.
- **Fogueira**: coloque no chão, acenda com madeira; perto dela a carne crua vira
  **carne assada** sozinha, e esquenta.
- **Saco de dormir**: vira um ponto de renascer no mapa e deixa dormir até de manhã.
- **Começo mais justo**: sem carnívoros perto das praias de renascer e dos sacos de dormir;
  nos primeiros minutos depois de nascer, poucos predadores e fracos. Agachado eles te
  veem menos.
- Casca nas árvores, nervuras nas folhas; um braço só, musculoso, em primeira pessoa.

- A ilha inteira é **Floresta Amazônica** fechada, com **pântano e igapó** no meio e
  uma faixa de praia. O nome do lugar aparece na tela ao entrar.
- Floresta densa: sumaúmas gigantes, árvores do dossel com folhas recortadas,
  açaí, bananeiras com cacho, **samambaias gigantes (~4 m)**, troncos caídos com musgo,
  pedras, cipós, mato no chão. Tudo balança com o vento (e treme quando você bate).
- **Coleta como nos jogos de sobrevivência**: bater em árvore dá palha (e madeira);
  com **machado** dá muita madeira. Pedra dá pedra e sílex. Interagir colhe
  **Baga-Mejo**, **Baga-Escura**, frutas, bananas e fibra. Carcaças dão carne, couro e ossos.
- **Inventário + crafting**: toque no que quer criar e veja o que precisa
  (verde = tem, vermelho = falta). Machado, picareta, lança, clava, bandagem e unguento.
  Barra rápida com 8 espaços; peso máximo; largar itens vira uma bolsa no chão.
- **23 animais**: carnívoros atacam quando te veem; herbívoros só revidam se apanharem
  (ou fogem). Raptor em bando, onça, aranha gigante, T-Rex, carnotauro, espinossauro,
  titanoboa, jacaré gigante e piranhas no pântano, pterossauros que mergulham, araras...
- Ao morrer, tudo vai para o saco de morte e você escolhe no mapa onde renascer.
- Qualidade automática: se o aparelho ficar lento, o jogo baixa a qualidade sozinho
  (dá para desligar no menu de pausa).

## Como jogar

| Onde | O que usar |
|---|---|
| Android (como app) | `dist/ilha-primordial.apk` – instalar no celular |
| Qualquer celular/PC | `dist/ilha-primordial.html` – abrir no navegador (Chrome, Safari, Edge) |

### Instalar o app no Android

1. Copie o arquivo `ilha-primordial.apk` para o celular (ou baixe direto nele).
2. Toque no arquivo. Se aparecer "instalação bloqueada", toque em **Configurações**
   e ative **Permitir desta fonte** (para o app que você usou: Chrome, Arquivos...).
3. Toque em **Instalar**. Se o Play Protect avisar "app desconhecido",
   toque em **Mais detalhes → Instalar mesmo assim** (a única permissão é internet, para o co-op).
4. Abra **Ilha Primordial** pelo ícone. O jogo abre em tela cheia, na horizontal.

Funciona no Android 7 ou mais novo. Sozinho não precisa de internet; o co-op precisa.
O botão/gesto **voltar** pausa o jogo; no menu de pausa há **Fechar o app**.

### iPhone

iPhone não instala APK. Abra o arquivo `ilha-primordial.html` (ou o link do jogo) no Safari.
Para ter um ícone na tela inicial: **Compartilhar → Adicionar à Tela de Início**.

## Controles

| Ação | PC | Celular |
|---|---|---|
| Andar | WASD | joystick (metade esquerda da tela) |
| Olhar | mouse (clique para prender o mouse) | arrastar o lado direito |
| Pular / subir nadando | Espaço | Pular |
| Correr | Shift (segurar) | Correr (liga/desliga) |
| Agachar / descer nadando | C | Agachar |
| Interagir (colher, beber, pegar saco) | E | Interagir |
| Atacar / coletar (soco ou ferramenta) | clique | Atacar |
| Barra rápida (comer / pegar ferramenta) | 1 a 8 | tocar no espaço |
| Inventário e crafting | Tab ou I | botão "Inventário" |
| Construir / Montar | B / F | botões no topo (próximas fases) |
| 1ª ou 3ª pessoa | V | botão "3ª pessoa" |
| FPS e desempenho | F3 | botão "FPS" |
| Pausa e opções | Esc | botão ❚❚ |

## Mudar os números do jogo (balanceamento)

Todos os números ficam em **`src/data/config/balanceamento.js`**, com explicação em
português ao lado de cada um (fome dura 25 min, sede 18 min, velocidade, dano, etc.).
O formato da ilha (pântanos, praias, quantidade de cada planta) fica em
**`src/data/world/ilha.json`**; o que cada planta/pedra dá em
**`src/data/world/recursos.json`**; itens em **`src/data/items/itens.json`**;
receitas de crafting em **`src/data/crafting/receitas.json`**; e os dados de cada animal
(vida, dano, velocidade, onde aparece, comportamento, carne/couro) em
**`src/data/creatures/criaturas.json`**.
O formato e as cores de cada dinossauro ficam em `src/creatures/creature_models.js`.
Depois de mudar, gere o jogo de novo (abaixo).

No menu de pausa há **"Teste: chamar animal"**, que cria a espécie escolhida na sua frente.

Os nomes "Baga-Mejo" e "Baga-Escura" são nossos (inspirados nas bagas pedidas);
dá para trocar em `itens.json`.

## Gerar o jogo (para quem for mexer no código)

Precisa de Node.js 18+ e, para o APK, Java 17+ e Python 3.

```bash
npm install        # uma vez
npm run build      # gera dist/ilha-primordial.html
npm test           # testa tudo num navegador automático (PC e celular)
npm run apk        # gera dist/ilha-primordial.apk (baixa as ferramentas na 1ª vez)
```

O APK é assinado com uma **chave de teste** (`android/keystore/ilha-teste.p12`,
senha `ilhaprimordial`). Ela serve para instalar e atualizar o app no seu celular.
Para publicar na Play Store será criada uma chave própria e secreta (Fase 13).
Para instalar uma versão nova por cima da antiga, aumente `androidVersionCode` no `package.json`.

## Pastas

```
src/
  main.js              liga tudo e roda o jogo quadro a quadro
  core/                "cérebros" globais: eventos, estado do jogo, opções, controles
  data/config/         balanceamento.js – TODOS os números
  data/world/          ilha.json – formato da ilha e biomas
  data/creatures/      criaturas.json – dados de cada animal
  data/items/          itens.json – itens (recursos, comida, ferramentas)
  data/crafting/       receitas.json – o que precisa para criar cada coisa
  world/               ilha, terreno, água, vegetação (+ textura de folhas), céu, efeitos, sacos
  creatures/           dinossauros: modelos, esqueleto/animação, IA e quem nasce onde
  player/              jogador, câmera, atributos, interação, ações (bater, colher, comer)
  items/ inventory/ crafting/   itens, inventário com peso e fila de crafting
  ui/                  HUD, barra rápida, inventário, controles de toque, telas, fontes
  building/ taming/ save/ audio/   (próximas fases)
android/               app Android (tela cheia que abre o jogo) + script do APK
tests/                 teste automático
dist/                  arquivos prontos para jogar
```

## Créditos

Código, ilha, ícone e textos: originais deste projeto.
Modelo 3D do espinossauro: **"Spinosaurus"** por **TheAquaticSpinosaurid**
(https://sketchfab.com/3d-models/spinosaurus-9d206a9686d549ca9b99a432089091ca),
licença **CC-BY 4.0** (https://creativecommons.org/licenses/by/4.0/). Mudanças: menos
triângulos, esqueleto ligado às animações do jogo e cores pintadas por região.
Motor 3D: [three.js](https://threejs.org) (licença MIT).
Fontes: Lilita One e Barlow Semi Condensed (SIL Open Font License, em `src/ui/fonts`).
