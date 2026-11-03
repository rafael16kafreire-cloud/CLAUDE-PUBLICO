#!/bin/sh
# Baixa os ícones provisórios da wiki do ARK (ver assets/icons/placeholder_ark/LEIA-ME.txt).
# Avisa o que falhar (não inventa nada). Uso: sh tools/baixar_icones_ark.sh
cd "$(dirname "$0")/../assets/icons/placeholder_ark" || exit 1
for f in $(node -e "const m=require('./mapa.json');console.log([...new Set(Object.entries(m).filter(([k])=>k[0]!=='_').map(([,v])=>v))].join(' '))"); do
  [ -s "$f" ] && continue  # já tem
  sleep 2                  # a wiki limita pedidos seguidos (erro 429)
  if curl -sSfL --max-time 30 -o "$f.tmp" "https://ark.wiki.gg/wiki/Special:FilePath/$f" && file "$f.tmp" | grep -q PNG; then
    mv "$f.tmp" "$f"; echo "ok    $f"
  else
    rm -f "$f.tmp"; echo "FALHOU $f"
  fi
done
# deixa os ícones com 96 px (no jogo aparecem com ~50 px)
python3 -c "
from PIL import Image;import glob
for f in glob.glob('*.png'):
  im=Image.open(f).convert('RGBA')
  if im.size[0]>96: im=im.resize((96,96),Image.LANCZOS)
  im.save(f,optimize=True)
" 2>/dev/null || echo "(python3 + Pillow não encontrados: ícones ficaram no tamanho original)"
