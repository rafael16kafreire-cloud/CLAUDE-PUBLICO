# Guia de todos os sistemas do Ilha Primordial

Para quando você (ou outra IA) refizer o jogo no Unreal. Cada seção diz: **o que é**, **onde está o código**
(em `unreal/codigo/fonte/src/…`, cópia do jogo) e **como refazer** no Unreal. Os números estão em `unreal/dados/`.
O índice arquivo por arquivo está em `INDICE_DO_CODIGO.md`.

## Visão geral
Jogo de sobrevivência 3D inspirado no ARK. Mundo em formato da Finlândia, praia, selva, pântano, campos,
serra e neve. 43 criaturas, domar e montar, construção, criação (ovos), progressão por nível, chefes, co-op.

Arquitetura (JavaScript):
- `main.js` liga tudo (cria mundo, jogador, bichos, interface) e roda o laço do jogo.
- `core/` base: balanceamento (números), eventos (`event_bus.js`), entrada (`input.js`), salvar (`save.js`), configurações.
- `world/` mundo: terreno, água, céu, vegetação, pedras, estruturas construídas.
- `player/` jogador: movimento, ações, mãos, modelo, atributos (`player_stats.js`).
- `creatures/` bichos: IA, animação, domar, criação, habilidades, temperamentos.
- `progression/` XP, níveis, engramas. `crafting/`, `inventory/`, `items/` itens e receitas.
- `ui/` todas as telas. `net/` co-op com PeerJS. `audio/` sons gerados por código.
- `data/` arquivos de dados (JSON) editáveis.

No Unreal isso vira: **GameInstance/GameMode** (regras e eventos), **Character** (jogador), **AIController +
Behavior Tree** (bichos), **Data Tables** (os CSV/JSON), **UMG** (interface), **Landscape/PCG** (mundo).

## 1. Jogador (`player/`)
- Movimento a pé, correr, agachar, pular, nadar, mergulhar (oxigênio), montar. Câmera 1ª e 3ª pessoa.
- Atributos (`player_stats.js`): vida, estamina, oxigênio, comida, água, peso, dano corpo a corpo, velocidade.
  Fome e sede caem com o tempo; frio e calor tiram vida (temperatura por bioma, hora do dia e fogueira).
- Peso: acima do limite fica lento (`OVERWEIGHT_SPEED_MULT`).
- Ações (`player_actions.js`): bater, coletar (árvore só com machado; pedra com picareta), atirar flechas.
- Unreal: `ACharacter` + `CharacterMovementComponent`; atributos num `UActorComponent` (vida etc.) com
  replicação; coleta com line trace.

## 2. Progressão (`progression/`)
- Nível 1–100. XP para subir do nível N: `round(10 × N^1.8)`. 1 ponto de atributo por nível.
- Pontos de engrama: 8 iniciais + `3 + floor(nível/25)` por nível (total 459 até o 100).
- Engramas (`engram_database.js`, gerado por `tools/dados/gerar_engrams.py`): cada receita tem nível mínimo e custo.
- XP por: coletar, fabricar (tempo × 0,8), matar (nível × multiplicador do porte), domar (nível × 10), primeira vez (+25).
- Poção de reset de atributos. Debug: `/xp /level /resetprog /unlockall /points`.
- Unreal: `UPlayerProgressionComponent` com uma Data Table de engramas.

## 3. Itens, inventário e fabricação
- `data/items/itens.json` (133 itens), `data/crafting/receitas.json` (101 receitas), `crafting.js`.
- Comida estraga com o tempo (carne crua apodrece). Armadura de pele em 5 partes, cantil, baú.
- Estações: bancada, pilão, forja, fogueira. Pilão: faísca, pólvora, pasta de cimento.
- Unreal: `UInventoryComponent` (TArray de FItemStack) + Data Table de itens/receitas + `UCraftingComponent`.

## 4. Mundo (`world/`)
- Terreno por mapa (`island_generator.js`, `terrain.js`): biomas praia/selva/igapó/pântano/campos/serra/neve/mar.
  Chão com textura sem repetição visível (mistura estocástica) e relevo.
- Vegetação instanciada (`vegetation.js`): árvores, palmeiras, bananeiras, arbustos que dão frutas, plantinhas de chão
  (~14 cm, 3× mais densas), pedras estilo ARK (`rocha_ark.js`). Árvores gigantes só com machado.
- Praias com palmeiras e manadas fixas de dodôs (`creature_manager.js`, `ensureBeachHerds`).
- Água e céu: `water.js`, `sky.js`, dia 7 min + noite 3 min, chuva, neve, névoa.
- Temperatura por região e hora: `world.temperatureAt()` (importante para o ovo chocar).
- Recursos por região: `data/world/recursos.json` (metal, obsidiana, cristal, petróleo, sílica…).
- Unreal: Landscape + Landscape Layers (biomas), PCG/Foliage para vegetação, Water plugin, Sky Atmosphere.

## 5. Construção (`world/building.js`, `structures.js`)
- Peças encaixadas em grade 3 m: fundação, parede, porta, teto, rampa… em 4 níveis (palha, madeira, pedra, metal).
- Cada peça tem vida; bichos fortes quebram. Demolir devolve parte do custo. Custos em `construcao-lowpoly/custos.json`.
- Unreal: sistema de snap por soquetes (Sockets) nas malhas + Data Table de custos.

## 6. Criaturas (`creatures/`)
- Dados: `unreal/dados/criaturas.csv`. Modelos: `bichos/modelos/*.glb`.
- Estados da IA: parado, vagar, comer, dormir, fugir, perseguir, atacar, desmaiado (KO), morto, voltar.
- Nível do selvagem 1–150 (de 5 em 5). Pontos sorteados entre vida/estamina/oxigênio/comida/peso/dano; torpor sobe por nível.
- Velocidades reais (m/s) e estamina de corrida/ataque (`core/movimento_config.js`).
- Animação por ossos em código (`creature.js`, `gait_profiles.js`, `tracos.js`) ou clipes dos .glb.
- Spawn por bioma e peso, bichos nascem e morrem, cadeia alimentar (`creature_manager.js`).
- Unreal: `ACharacter` por espécie + `UCreatureDataAsset`; `AIController` com Behavior Tree/EQS; Animation Blueprint.

## 7. Temperamentos e IA (`creatures/temperamentos.js`)
- Cada espécie tem um temperamento do ARK. `decideReaction(temperamento, evento, contexto)` devolve o estado.
- Inofensivos (oblivious, cowardly, skittish, passive) fogem ao apanhar; docile/defensive/neutral/reactive revidam;
  aggressive/territorial/patient/short_tempered/extremely_aggressive atacam o jogador. Filhote sempre foge.
- Chave `HERBIVOROS_NUNCA_FOGEM` (false) liga o modo "todo herbívoro revida".
- Domado: 5 modos (passivo-foge, passivo, neutro, atacar alvo, agressivo) e comandos (seguir, ficar, vagar…).
- Unreal: Behavior Tree com Blackboard (Alvo, Ameaça, Estado) e AIPerception (visão e audição).

## 8. Domar e montar
- Tirar torpor até desmaiar (soco, clava, flecha tranquilizante, narcótico) → dar a comida preferida até a barra encher.
- Eficiência cai se apanhar desmaiado; bônus de nível = `floor(nível × eficiência / 2)`.
- Sela por porte (`selas.json`): pequena, média, grande, plataforma; modelo da sela no bicho.
- Montado: o bicho obedece ao jogador; ataque (clique) e **uma habilidade especial** (Q). Coleta montada por espécie.
- Unreal: `Possess` do bicho pelo jogador, assento por socket, Enhanced Input.

## 9. Habilidades (`creatures/habilidades_dados.js`, `habilidades.js`)
- 86 habilidades em `habilidades.csv` (dano, estamina, recarga). Cada dino tem **uma** especial (`ESPECIAL`).
- Efeitos: sangramento, torpor (titanoboa ×3), atordoamento, medo (rugido do Rex), Intimidar, placas do Estegossauro,
  Rugido de Bando do Raptor, fúria do Giganotossauro.
- Regras do rugido do Rex: alvo com peso ≤ 200 e nível menor; mesmo alvo só depois de 6 min.
- Não feitas: cuspe, agarrar, scan, feromônios, lentidão, veneno, Giga Mordida com carga.
- Unreal: Gameplay Ability System (GAS) encaixa muito bem (habilidades, cooldowns, custos, efeitos).

## 10. Criação / ovos (`creatures/reproducao.js`, `breeding_config.js`)
- Cooldown só da fêmea (18–48 h); gêmeos 10%, trigêmeos 2%; herança 55/45; mutação 3×2,5% (teto 20 por lado, +2 pontos).
- Ovo choca só na faixa de temperatura da espécie; fora dela perde saúde. Filhote amadurece (Rex 92 h 35 min).
- Impressão: pedido a cada 8 h, janela de 4 h; 100% = +20% nos atributos.
- Tempo corre por relógio real (`Date.now`), inclusive com o jogo fechado. Titanoboa: sem sexo, bota ovo sozinha.
- Unreal: guardar `FDateTime` no save e calcular o progresso ao carregar.

## 11. Chefes
- Mamute de Gelo (neve), Rei do Abismo (mar), Senhor do Pântano, Dragão do Vulcão (cospe fogo). Covil fixo, imunes a torpor.

## 12. Co-op (`net/`)
- PeerJS (WebRTC) com código de sala; o anfitrião roda a IA e os convidados recebem posição e eventos.
- Unreal: Replication nativa (servidor autoritativo).

## 13. Interface (`ui/`)
- HUD, hotbar, inventário (3 colunas), fabricação, receitas/engramas, mapa, minimapa, pausa, opções,
  roda de comandos, menu do bicho, inspeção, tela de morte, tela inicial, créditos, controles por toque.
- Unreal: UMG + Common UI.

## 14. Sons (`audio/audio.js`)
- Todos gerados por código (Web Audio): ambiente dia/noite, passos, golpes, vozes dos bichos, música.
- Unreal: MetaSounds ou arquivos de som; os nomes dos sons estão no arquivo.

## 15. Salvar (`core/save.js`, `main.js` → `gameSnapshot`)
- 3 espaços. Guarda jogador, inventário, estruturas, bichos domados (com ovos, cooldowns, imprint) e `salvoEm` (hora real).

## 16. Testes
- `tests/progression.test.mjs` (106 testes rápidos): fórmulas de XP, engramas, temperamentos, criação, habilidades.
- `tests/smoke.test.mjs`: teste de fumaça no navegador (lento).

## 17. Como gerar o jogo atual
`npm install` → `npm run build` (gera `dist/ilha-primordial.html`) → `npm run apk` (Android) → `npm run pc` (Windows).

## 18. Lições do que não funcionou
- Realismo visual de PC não sai de um jogo em three.js no celular: use o Unreal para isso.
- Animação dos bichos feita por código ficou fraca; use animações de verdade (clipes) importadas.
- Faltam dados da wiki do ARK (tempos de ovo/maturação por espécie, duração da barra de acasalamento).
