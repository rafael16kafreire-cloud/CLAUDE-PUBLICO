#!/bin/bash
# Monta a versão de PC (Windows 64 bits) em dist/ilha-primordial-windows.zip.
# Usa o Neutralino: um .exe pequeno que abre o jogo com o navegador que já
# vem no Windows (WebView2/Edge, com a placa de vídeo), sem abrir o
# navegador nem abas. O jogo é o mesmo dist/ilha-primordial.html.
# Não precisa de Windows: só junta os arquivos e compacta.
# Uso: npm run build && npm run pc
set -e
ROOT=$(cd "$(dirname "$0")/.." && pwd)
NEU=5.4.0
CACHE=$ROOT/build/neu
OUT=$ROOT/build/pc/IlhaPrimordial
APP=$ROOT/build/pc/app
mkdir -p "$CACHE"
if [ ! -f "$CACHE/bin/neutralino-win_x64.exe" ]; then
  curl -sSL -o "$CACHE/neu.zip" "https://github.com/neutralinojs/neutralinojs/releases/download/v$NEU/neutralinojs-v$NEU.zip"
  unzip -o -q "$CACHE/neu.zip" -d "$CACHE/bin"
fi
GAMEVER=$(node -e "console.log(require('$ROOT/package.json').version)")
rm -rf "$OUT" "$APP"
mkdir -p "$OUT" "$APP/resources"
cp "$ROOT/dist/ilha-primordial.html" "$APP/resources/index.html"
cp "$ROOT/pc/icon.png" "$APP/resources/icon.png"
sed "s/__VERSAO__/$GAMEVER/" "$ROOT/pc/neutralino.config.json" > "$APP/neutralino.config.json"
# resources.neu = pacote "asar" com a configuração e o jogo
node -e "require('@electron/asar').createPackage('$APP', '$OUT/resources.neu').then(() => console.log('resources.neu ok'))"
cp "$CACHE/bin/neutralino-win_x64.exe" "$OUT/IlhaPrimordial.exe"
cat > "$OUT/LEIA-ME.txt" <<TXT
ILHA PRIMORDIAL $GAMEVER - versão para PC (Windows 10/11, 64 bits)

1. Descompacte a pasta inteira (não abra de dentro do .zip).
2. Abra IlhaPrimordial.exe.
   Se o Windows avisar "O Windows protegeu o computador", clique em
   "Mais informações" e depois em "Executar assim mesmo" (o programa
   não tem assinatura digital paga, por isso o aviso).

O jogo usa o navegador Edge que já vem no Windows (WebView2), com a
placa de vídeo, numa janela própria. Se o Windows não tiver o WebView2,
ele pede para instalar (é grátis, da Microsoft).
TXT
cd "$ROOT/build/pc"
rm -f "$ROOT/dist/ilha-primordial-windows.zip"
zip -qr -9 "$ROOT/dist/ilha-primordial-windows.zip" IlhaPrimordial
ls -la "$ROOT/dist/ilha-primordial-windows.zip"
