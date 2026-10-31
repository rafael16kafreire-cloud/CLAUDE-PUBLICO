# Construção Low-Poly (estilo nórdico)

Kit de peças modulares para construção — no esquema do ARK (fundação, parede, teto, batente, telhado...)
mas com visual low-poly nórdico, texturas pixeladas e madeira rústica.

![Casa de exemplo](previas/casa_exemplo.jpg)

## Como usar

- **Arquivos prontos:** pasta [`modelos/`](modelos) — um `.glb` por peça, mais `kit_construcao.glb` (todas juntas) e `casa_exemplo.glb`.
- **Editor no navegador:** abra `index.html` (precisa de internet para carregar o three.js). Dá para girar a câmera, ver cada peça,
  trocar o tom da madeira, gerar variações e baixar os `.glb`.
- **Gerar tudo de novo:** `node exportar.mjs` (precisa do `playwright`). Cria `modelos/` e `previas/`.

## Grade e medidas

Tudo em **metros**. Módulo de **3 × 3 m**, paredes de **3 m** de altura, telhado a **45°**.

| Peça | Arquivo | Origem (ponto de encaixe) |
|---|---|---|
| Fundação de pedra / madeira | `fundacao_pedra.glb`, `fundacao_madeira.glb` | centro do topo (o chão fica em y = 0) |
| Fundação triangular | `fundacao_triangular.glb` | meio da aresta de base |
| Parede de tábuas / troncos / janela / batente | `parede_*.glb`, `batente_porta.glb` | centro da base; lado de fora = +Z |
| Meia parede | `meia_parede.glb` | centro da base |
| Porta | `porta.glb` | dobradiça (canto de baixo); vão do batente = 1,5 × 2,29 m |
| Parede triangular (empena) | `parede_triangular.glb` | canto baixo; gire 180° para o outro lado |
| Teto / piso | `teto_madeira.glb` | centro de baixo (apoia no topo da parede) |
| Telhado de palha / tabuinhas | `telhado_palha.glb`, `telhado_tabuinhas.glb` | centro do módulo, altura do topo da parede; beiral = +Z |
| Cumeeira, ornamento | `cumeeira.glb`, `ornamento_empena.glb` | ponto mais alto do telhado |
| Pilar, viga, escada, cerca | `pilar.glb`, `viga.glb`, `escada.glb`, `cerca.glb` | base / centro |

Exemplo de encaixe: fundação em `y = 0` → paredes em `y = 0` nas bordas (±1,5 m) → telhado e empena em `y = 3`
→ cumeeira em `y = 6`.

## Importar na engine

- **Godot 4:** arraste o `.glb` para o projeto.
- **Unity:** instale o pacote **glTFast** (Package Manager → `com.unity.cloud.gltfast`) e arraste o `.glb`.
- **Unreal 5:** Import → `.glb` (plugin glTF Importer vem ativado).
- **Blender:** File → Import → glTF 2.0.

Cada peça usa poucos materiais compartilhados (`madeira`, `madeira_escura`, `tronco`, `palha`, `pedra`, `ferro`),
textura 64×64 com filtro *point/nearest* e **cor por vértice** (a variação de tom entre tábuas).
Se a madeira ficar toda igual na engine, ative o uso de *vertex color* no material.

O visual "Valheim" completo também depende da engine: neblina, luz quente de fim de tarde, sombras suaves e grama balançando.
