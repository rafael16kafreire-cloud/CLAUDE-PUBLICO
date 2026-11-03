#!/bin/sh
# Converte bichos que vieram em .fbx (bichos.json com "fbx": true) para
# src/creatures/imported/<espécie>.js, com o esqueleto e a animação do próprio modelo.
# Uso: sh tools/models/bichos_fbx.sh pasta_do_zip pasta_temporaria espécie
#   (pasta_do_zip = onde estão o .fbx e as texturas; caminhos relativos a ela em bichos.json: fbx_arquivo, fbx_opcoes)
set -e
SRC=$1; TMP=$2; id=$3
DIR=$(cd "$(dirname "$0")" && pwd)
ROOT=$DIR/../..
PY=${PY:-python3}
BL=${BLENDER_PY:-$ROOT/.blender-env/bin/python}
cfg() { node -e "const c=require('$DIR/bichos.json')['$id'];console.log(c.$1 ?? '$2')"; }
out=$TMP/$id
mkdir -p "$out"
node -e "console.log(JSON.stringify(require('$DIR/bichos.json')['$id']))" > "$out/config.json"
node -e "
const c=require('$DIR/bichos.json')['$id'];const o=c.fbx_opcoes??{};
for(const k of Object.keys(o.texturas??{})) o.texturas[k]=(o.texturas[k].startsWith('tools/')?'$ROOT/':'$SRC/')+o.texturas[k];
console.log(JSON.stringify(o))" > "$out/opcoes.json"
[ -f "$out/cru/cru.npz" ] || "$BL" "$DIR/fbx_animado.py" "$SRC/$(cfg fbx_arquivo)" "$out/cru" "$out/opcoes.json" > /dev/null
node "$DIR/bicho_ossos.mjs" "$id" > "$out/ossos.json"
if [ "$(cfg animado false)" = "true" ]; then
  $PY -I "$DIR/bicho_animado_rig.py" "$out/cru" "$out/ossos.json" "$out/config.json" "$out/rig.json"
else  # modelo sem esqueleto: o jogo encaixa o dele
  $PY -I "$DIR/bicho_rig.py" "$out/cru" "$out/ossos.json" "$out/config.json" "$out/rig.json"
fi
$PY -I "$DIR/bicho_texturas.py" "$out/rig.json" "$out/tex" "$(cfg textura 1024)"
node "$DIR/bicho_para_jogo.mjs" "$out/rig.json" "$out/tex/texturas.json" "$ROOT/src/creatures/imported/$id.js" "$(cfg triangulos 16000)" "$(cfg brilho 1)"
