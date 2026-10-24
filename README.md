# Ilha Primordial

Jogo 3D de sobrevivência com dinossauros. Sozinho (offline) ou em **co-op online até 4 jogadores**.
Roda no celular (Android como app ou no navegador) e no PC.
Visual estilizado, feito para ser leve.

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
Motor 3D: [three.js](https://threejs.org) (licença MIT).
Fontes: Lilita One e Barlow Semi Condensed (SIL Open Font License, em `src/ui/fonts`).
