# Bichos de Isla (low-poly)

Gerados por código, com esqueleto (Armature) e animações, no mesmo estilo low-poly das construções.

- `index.html` — visualizador: escolha o bicho, toque nas animações, baixe o `.glb`.
- `modelos/` — os `.glb` prontos (malha + esqueleto + animações, textura embutida).
- `previas/` — imagens de cada animação.
- `exportar.mjs` — gera tudo de novo (`node exportar.mjs`, precisa do `playwright`).

Padrão de todos: tamanho real em metros, pés no chão (y = 0), olhando para a frente
(no Blender aparece olhando para −Y), material único com textura de escamas 256×256 (suave, sem pixel) e cor por vértice.
Ossos e animações com os nomes do prompt (`parado`, `andar`, `correr`, `atacar`, `rugir`, `comer`, `dormir`, `morrer`).

| Bicho | Arquivo | Triângulos | Ossos |
|---|---|--:|--:|
| T-Rex | `trex.glb` | 6.156 | 31 |
| Raptor | `raptor.glb` | 4.754 | 31 |
