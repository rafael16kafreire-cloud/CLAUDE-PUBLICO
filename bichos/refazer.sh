#!/bin/bash
# Refaz as malhas paradas (teste/*_parado.glb) e as animações de todos os bichos com esqueleto automático,
# depois os ajustes (completar/*.mjs) e as variantes. Precisa das fontes baixadas em $FONTES (sf/ e sf2/ do Sketchfab)
# e do Blender como módulo Python em $BPY. Uso: FONTES=... BPY=... THREE_DIR=... bash refazer.sh [nome...]
set -e
cd "$(dirname "$0")"
P() { # P fonte destino [triangulos] (REMOVER/GIRAR/DEFORMAR/BASE_Z pelo ambiente)
  "$BPY" -c "import runpy,sys; sys.argv=['x','--','$1','teste/$2_parado.glb','${3:-16000}']; runpy.run_path('blender/preparar.py')" 2>&1 | grep -E "PREPARADO|Error" || true; }
quer() { [ -z "$ALVOS" ] || [[ " $ALVOS " == *" $1 "* ]]; }
ALVOS="$*"
quer anquilossauro && P $FONTES/anquilo_pikabob.glb anquilossauro
quer argentinossauro && P $FONTES/argentino_nobilis.glb argentinossauro
quer braquiossauro && P $FONTES/braquio_paleo.glb braquiossauro
quer estegossauro && P $FONTES/estego_pandras.glb estegossauro
quer sauropelta && P $FONTES/sauropelta_anees.glb sauropelta
quer mamute && P $FONTES/mamute_sdpm.glb mamute
quer triceratops && P $FONTES/tri_john.glb triceratops
quer deinosuchus && P $FONTES/croc_beerus.glb deinosuchus
quer mosassauro && P $FONTES/tylo_freddy.glb mosassauro
quer piranha && P $FONTES/piranha_freddy.glb piranha
quer dimetrodonte && P $FONTES/dime_cp.glb dimetrodonte
quer galimimo && P $FONTES/galimimo_skinny.glb galimimo
quer terizinossauro && REMOVER="babys,icosphere" P $FONTES/terizino_freddy.glb terizinossauro
quer parassauro && REMOVER="object_9,object_11,icosphere" P $FONTES/parasauro_htqj.glb parassauro
quer carnotauro && REMOVER="object_82,object_11,icosphere" P $FONTES/carno_wormhole.glb carnotauro
quer espinossauro && P $FONTES/espino_pebegou.glb espinossauro
quer dodo && REMOVER="sphere.001_0,sphere.002,icosphere" P $FONTES/dodo_bluemesh.glb dodo
quer moschops && DEFORMAR=blender/moschops.py P $FONTES/dime_cp.glb moschops 30000
true
