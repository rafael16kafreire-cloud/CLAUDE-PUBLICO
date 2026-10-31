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

## Completar animações que faltam (`completar.mjs`)

Para modelos que já têm esqueleto mas não têm todas as animações do prompt, `completar.mjs` cria animações novas
girando ossos por cima de uma pose existente (eixos do mundo: X = esquerda do bicho, Y = cima, Z = frente).

    node completar.mjs modelos/trex.glb --ossos     # lista os ossos e onde estão
    node completar.mjs completar/trex.mjs           # gera as animações descritas no arquivo

| bicho | animações criadas |
|---|---|
| trex | comer, dormir, morrer |
| pteranodonte (e quetzalcoatlus) | correr, atacar, rugir, comer, dormir, morrer |
| chefe_vulcao | atacar, rugir, cuspir_fogo, pisar_chao, comer, dormir, morrer + pele de lava (refaça antes com `adaptar.mjs`) |
| argentavis | parado, andar, correr, atacar, rugir, comer, dormir, morrer (poses no chão calculadas) |
| titanoboa | parado, andar, correr, nadar, nadar_rapido, atacar, rugir, comer, dormir, morrer (depois `adaptar.mjs config/titanoboa.json`) |

`previa_glb.mjs` aceita `QUADROS=n OUT=pasta` (folha com n quadros de cada animação) e `ALVO=osso,tamanho` (câmera de perto).

## Moschops

Feito a partir do Dimetrodonte (cp4096, CC BY): `blender/moschops.py` achata a vela numa corcova, deixa o corpo em barril,
encurta a cauda, aumenta a cabeça e fecha a boca. Depois é rigado e animado como os outros:

    DEFORMAR=blender/moschops.py blender -b -P blender/preparar.py -- dime_cp.glb teste/moschops_parado.glb 30000
    node animar.mjs config/moschops.json

## Lote novo: Megatério, Bisão, Paraceratério, Edmontossauro, Barionix, Suchomimo, Giganotossauro, Sarcosuchus e chefes

- `congelar.mjs entrada.glb saida.glb [animação] [tempo]`: congela um modelo animado numa pose (como o three.js mostra) e exporta malha parada.
  Usado no Giganotossauro, cujo rig (Auto-Rig Pro) o Blender não reproduz.
- `blender/tirar_base.py` (com `DEFORMAR=` e `BASE_Z=`): tira a base redonda de estátua e lascas soltas (Barionix CC0).
- `preparar.py` aceita `GIRAR="x,-90"` para modelos deitados.
- `variante.mjs` aceita `"efeito": "gelo" | "musgo" | "abismo"` (chefes: chefe_gelo = mamute ×1.9, chefe_pantano = sarcosuchus ×1.7, chefe_mar = mosassauro ×1.8).
- Megatério e Bisão (Anees Animates) vêm com 1 animação; o resto é feito com `completar.mjs` (`completar/megaterio.mjs`, `completar/bisao.mjs`).

### Sugestão de funções no jogo (herbívoros)

| bicho | especialidade |
|---|---|
| megaterio | coleta de fibra e frutas no alto (anima puxando galhos), garras fortes contra insetos |
| bisao | montaria de carga barata, coleta de couro/palha, investida em bando |
| paraceraterio | carrega plataforma de construção, alcança árvores altas (madeira) |
| edmontossauro | coleta de frutas/sementes em quantidade, alarme do bando (rugido) |
| lystrosaurus | bichinho de colo (variante pequena do Moschops): bônus de experiência |
| moschops | coleta de cogumelos/raízes, cabeçada derruba pedra |
