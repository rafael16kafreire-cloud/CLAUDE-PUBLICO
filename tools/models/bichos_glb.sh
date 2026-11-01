#!/bin/sh
# Converte bichos .glb de bichos/modelos (esqueleto padrão e as animações
# parado, andar, correr, atacar, rugir...) para src/creatures/imported/<espécie>.js.
# Uso: sh tools/models/bichos_glb.sh pasta_temporaria espécie[:arquivo] ...
#   ex.: sh tools/models/bichos_glb.sh /tmp/glb triceratops pterodactilo:pteranodonte
set -e
TMP=$1; shift
DIR=$(cd "$(dirname "$0")" && pwd)
ROOT=$DIR/../..
PY=${PY:-python3}
BL=${BLENDER_PY:-$ROOT/.blender-env/bin/python}
for arg in "$@"; do
  id=${arg%%:*}
  file=${arg#*:}
  out=$TMP/$id
  mkdir -p "$out"
  node -e "const b=require('$DIR/bichos.json');const c=b['$id']??{};const g=(b._glb??{})['$id']??{};
console.log(JSON.stringify({credito:c.credito,...g}))" > "$out/base.json"
  [ -f "$out/cru/cru.npz" ] || "$BL" "$DIR/fbx_animado.py" "$ROOT/bichos/modelos/$file.glb" "$out/cru" > /dev/null
  node "$DIR/bicho_ossos.mjs" "$id" > "$out/ossos.json"
  $PY -I "$DIR/glb_config.py" "$out/cru" "$out/ossos.json" "$out/base.json" "$out/config.json"
  $PY -I "$DIR/bicho_animado_rig.py" "$out/cru" "$out/ossos.json" "$out/config.json" "$out/rig.json"
  cfg() { node -e "const c=require('$out/config.json');console.log(c.$1 ?? '$2')"; }
  $PY -I "$DIR/bicho_texturas.py" "$out/rig.json" "$out/tex" "$(cfg textura 640)"
  node "$DIR/bicho_para_jogo.mjs" "$out/rig.json" "$out/tex/texturas.json" "$ROOT/src/creatures/imported/$id.js" "$(cfg triangulos 8000)" "$(cfg brilho 1)"
done
