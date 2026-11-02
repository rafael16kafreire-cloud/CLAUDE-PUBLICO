# Isla — ilha jogável (protótipo)

Cena 3D no navegador (three.js) com a ilha e os bichos de `../bichos/modelos/`.

## Como abrir

O navegador não carrega os modelos `.glb` direto do disco (`file://`); é preciso um servidor local simples.
Na pasta raiz do projeto (a que tem `bichos/` e `ilha/`):

    npx serve .
    # ou: python -m http.server 8000

e abra `http://localhost:3000/ilha/` (ou `http://localhost:8000/ilha/`).

## Controles

| tecla | ação |
|---|---|
| W A S D | andar |
| Shift | correr (gasta fôlego) |
| Espaço | pular |
| mouse | olhar (clique na tela para prender o mouse; Esc solta) |
| clique | atacar com a lança |
| H | esconder a ajuda |
| T | avançar a hora (dia/noite) |

## O que tem

- Ilha de ~900 m com praias, campos, florestas, montanhas, uma lagoa e um vulcão com lava ao norte.
- 19 espécies (77 bichos) com comportamento próprio:
  - herbívoros passeiam, comem e dormem à noite; os medrosos fogem, os bravos revidam quando atacados;
  - carnívoros caçam o jogador quando ele chega perto;
  - piranhas e mosassauros no mar (atacam quem estiver nadando); pteranodontes e argentavis voam em círculos.
- Ciclo de dia e noite, vida e fôlego, morte e renascimento na praia.

## Créditos do cenário (todos CC0, domínio público — Poly Haven)

- Texturas do chão: coast_sand_01, leafy_grass, forest_leaves_04, aerial_rocks_02.
- Plantas (fotografadas dos modelos 3D em imagens com fundo transparente): island_tree_02, pine_sapling_small, searsia_lucida, shrub_02.
- Pedra: rock_07 (simplificada).

Créditos dos bichos: `../bichos/CREDITOS.md`.
