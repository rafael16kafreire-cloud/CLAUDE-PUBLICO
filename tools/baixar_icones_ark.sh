#!/bin/sh
# Baixa os ícones provisórios da wiki do ARK (ver assets/icons/placeholder_ark/LEIA-ME.txt).
# Avisa o que falhar (não inventa nada). Uso: sh tools/baixar_icones_ark.sh
cd "$(dirname "$0")/../assets/icons/placeholder_ark" || exit 1
for f in $(node -e "const m=require('./mapa.json');console.log([...new Set(Object.entries(m).filter(([k])=>k[0]!=='_').map(([,v])=>v))].join(' '))"); do
  if curl -sSfL --max-time 30 -o "$f.tmp" "https://ark.wiki.gg/wiki/Special:FilePath/$f" && file "$f.tmp" | grep -q PNG; then
    mv "$f.tmp" "$f"; echo "ok    $f"
  else
    rm -f "$f.tmp"; echo "FALHOU $f"
  fi
done
