#!/bin/sh
# Converte os bichos de bichos.json para src/creatures/imported/<espécie>.js
# Uso: PY=python_com_usd sh tools/models/bichos.sh pasta_dos_usdz pasta_temporaria [espécie...]
set -e
SRC=$1; TMP=$2; shift 2
DIR=$(cd "$(dirname "$0")" && pwd)
ROOT=$DIR/../..
PY=${PY:-python3}
IDS=${*:-$(node -e "console.log(Object.keys(require('$DIR/bichos.json')).filter(k=>k[0]!=='_').join(' '))")}
for id in $IDS; do
  file=$(node -e "console.log(require('$DIR/bichos.json')['$id'].arquivo)")
  usdz=$(ls "$SRC"/*"$file"*.usdz | head -1)
  out=$TMP/$id
  mkdir -p "$out"
  node -e "console.log(JSON.stringify(require('$DIR/bichos.json')['$id']))" > "$out/config.json"
  [ -f "$out/cru/cru.npz" ] || $PY -I "$DIR/usd_bicho.py" "$usdz" "$out/cru" > /dev/null
  node "$DIR/bicho_ossos.mjs" "$id" > "$out/ossos.json"
  $PY -I "$DIR/bicho_rig.py" "$out/cru" "$out/ossos.json" "$out/config.json" "$out/rig.json"
  size=$(node -e "console.log(require('$DIR/bichos.json')['$id'].textura ?? 1024)")
  $PY -I "$DIR/bicho_texturas.py" "$out/rig.json" "$out/tex" "$size"
  tris=$(node -e "console.log(require('$DIR/bichos.json')['$id'].triangulos)")
  brilho=$(node -e "console.log(require('$DIR/bichos.json')['$id'].brilho ?? 1)")
  sela=$(node -e "console.log(require('$DIR/bichos.json')['$id'].sela_embutida ?? '')")
  node "$DIR/bicho_para_jogo.mjs" "$out/rig.json" "$out/tex/texturas.json" "$ROOT/src/creatures/imported/$id.js" "$tris" "$brilho" "$sela"
done
