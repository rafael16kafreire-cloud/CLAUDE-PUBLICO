# Ilha Primordial

Jogo 3D de sobrevivência com dinossauros, single player e offline.
Roda no celular (Android como app ou no navegador) e no PC.
Visual low-poly, feito para ser leve.

**Fase atual: 1 – Mundo e jogador**

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
   toque em **Mais detalhes → Instalar mesmo assim** (o app não pede nenhuma permissão).
4. Abra **Ilha Primordial** pelo ícone. O jogo abre em tela cheia, na horizontal.

Funciona no Android 7 ou mais novo. Não precisa de internet.
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
| Interagir (beber água) | E | Interagir |
| Atacar/Usar | clique | Atacar |
| Inventário / Construir / Montar | Tab / B / F | botões no topo |
| 1ª ou 3ª pessoa | V | botão "3ª pessoa" |
| FPS e desempenho | F3 | botão "FPS" |
| Pausa e opções | Esc | botão ❚❚ |

## Mudar os números do jogo (balanceamento)

Todos os números ficam em **`src/data/config/balanceamento.js`**, com explicação em
português ao lado de cada um (fome dura 25 min, sede 18 min, velocidade, dano, etc.).
O formato da ilha (montanha, lago, praias, quantidade de árvores) fica em
**`src/data/world/ilha.json`**. Depois de mudar, gere o jogo de novo (abaixo).

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
  data/world/          ilha.json – formato da ilha
  world/               ilha, terreno, água, vegetação, céu, saco de morte
  player/              jogador, câmera, atributos, interação
  ui/                  HUD, controles de toque, telas, estilo, fontes
  items/ inventory/ crafting/ building/ creatures/ taming/ save/ audio/   (próximas fases)
android/               app Android (tela cheia que abre o jogo) + script do APK
tests/                 teste automático
dist/                  arquivos prontos para jogar
```

## Créditos

Código, ilha, ícone e textos: originais deste projeto.
Motor 3D: [three.js](https://threejs.org) (licença MIT).
Fontes: Lilita One e Barlow Semi Condensed (SIL Open Font License, em `src/ui/fonts`).
