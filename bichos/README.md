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
| T-Rex | `trex.glb` | 18.292 (sombreado suave, pele lisa 64×64) | 31 |
| Raptor | `raptor.glb` | 4.754 | 31 |

## Animar modelos prontos (IA do Blender, Sketchfab com licença livre)

Para usar um modelo realista que já existe (sem esqueleto ou com esqueleto diferente):

1. **Preparar** (tira esqueleto/animações antigas, junta as partes, reduz triângulos):
   `blender -b -P blender/preparar.py -- modelo_original.fbx teste/meu_bicho_parado.glb 15000`
   (aceita `.glb`, `.gltf`, `.fbx`, `.obj`, `.blend`, `.usdz`, `.stl`)
2. **Configurar**: crie `config/<nome>.json` com o nome, o arquivo parado, o comprimento real em metros,
   a rotação para a cabeça apontar para a frente e o tipo de ataque/rugido (veja `config/teste_trex.json`).
3. **Animar**: `node animar.mjs config/<nome>.json` → gera `modelos/<nome>.glb` com o esqueleto padrão
   (mesmos nomes de ossos) e as 8 animações, mais `previas/<nome>_ossos.jpg` para conferir o encaixe.
   Se algum osso ficar fora do lugar, corrija com `"ajuste"` no JSON (ex.: `zQuadril`, `yQuadril`, `zPescoco`, `zCranio`, `zPe`, `xPe`).

Os modelos originais (baixados do Sketchfab) e os arquivos intermediários não ficam no repositório, só os `.glb` prontos em `modelos/`.
Para refazer um bicho: baixe o original pelo link em `CREDITOS.md`, salve em `originais/` com o nome usado no `config/<nome>.json`
(campo `entrada`/`modelo`), rode o `preparar.py` (veja o campo `preparo` no JSON, se houver) e depois `animar.mjs` ou `adaptar.mjs`.

**Licença dos modelos:** use só modelos feitos por você/sua IA ou com licença CC0/CC-BY do próprio autor.
Modelos extraídos de jogos (ex.: ARK, Jurassic World Evolution) não podem ir para o jogo, mesmo que o site diga "grátis".

## Variantes e criaturas feitas do zero

Para espécies sem modelo realista livre, `variante.mjs` cria uma variante de um modelo parecido
(mesmo esqueleto e animações, escala e cor diferentes):

    node variante.mjs config/diplodoco.json   # {nome, base, saida, escala, cor:[r,g,b]}

Variantes atuais: diplodoco (argentinossauro), kentrossauro (estegossauro), paquirrinossauro (triceratops),
quetzalcoatlus (pteranodonte), compsognato (raptor), dilofossauro (carnotauro), iguanodonte (parassauro).
A titanoboa é procedural (`buildTitanoboa` no index.html; exporte com `node exportar.mjs titanoboa`).
