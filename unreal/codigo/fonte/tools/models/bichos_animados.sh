#!/bin/sh
# Converte os bichos ANIMADOS de bichos.json ("animado": true) para
# src/creatures/imported/<espécie>.js, com o esqueleto e as animações
# do próprio modelo.
# Uso: PY=python_com_usd sh tools/models/bichos_animados.sh pasta_dos_usdz pasta_temporaria [chave...]
set -e
SRC=$1; TMP=$2; shift 2
DIR=$(cd "$(dirname "$0")" && pwd)
ROOT=$DIR/../..
PY=${PY:-python3}
IDS=${*:-$(node -e "const b=require('$DIR/bichos.json');console.log(Object.keys(b).filter(k=>k[0]!=='_'&&b[k].animado).join(' '))")}
for key in $IDS; do
  cfg() { node -e "const c=require('$DIR/bichos.json')['$key'];console.log(c.$1 ?? '$2')"; }
  file=$(cfg arquivo)
  id=$(cfg especie "$key")
  usdz=$(ls "$SRC"/*"$file"*.usdz | head -1)
  out=$TMP/$key
  mkdir -p "$out"
  node -e "console.log(JSON.stringify(require('$DIR/bichos.json')['$key']))" > "$out/config.json"
  [ -f "$out/cru/cru.npz" ] || $PY -I "$DIR/usd_animado.py" "$usdz" "$out/cru" > /dev/null
  node "$DIR/bicho_ossos.mjs" "$id" > "$out/ossos.json"
  $PY -I "$DIR/bicho_animado_rig.py" "$out/cru" "$out/ossos.json" "$out/config.json" "$out/rig.json"
  $PY -I "$DIR/bicho_texturas.py" "$out/rig.json" "$out/tex" "$(cfg textura 1024)"
  node "$DIR/bicho_para_jogo.mjs" "$out/rig.json" "$out/tex/texturas.json" "$ROOT/src/creatures/imported/$id.js" "$(cfg triangulos 16000)" "$(cfg brilho 1)"
done
