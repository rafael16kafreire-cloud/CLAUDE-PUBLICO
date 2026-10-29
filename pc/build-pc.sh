#!/bin/bash
# Monta a versão de PC (Windows 64 bits) em dist/ilha-primordial-windows.zip.
# Usa o Neutralino: um .exe pequeno que abre o jogo com o navegador que já
# vem no Windows (WebView2/Edge, com a placa de vídeo), sem abrir o
# navegador nem abas. O jogo é o mesmo dist/ilha-primordial.html.
# Não precisa de Windows: só junta os arquivos e compacta.
# Também monta dist/ilha-primordial-linux.zip (Linux 64 bits, usa o WebKitGTK 4.0 do sistema).
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

# ---------- Linux 64 bits ----------
LIN=$ROOT/build/pc/IlhaPrimordial-linux
rm -rf "$LIN"
mkdir -p "$LIN"
cp "$OUT/resources.neu" "$LIN/resources.neu"
cp "$CACHE/bin/neutralino-linux_x64" "$LIN/IlhaPrimordial"
chmod +x "$LIN/IlhaPrimordial"
cat > "$LIN/jogar.sh" <<'SH'
#!/bin/sh
cd "$(dirname "$0")" && chmod +x ./IlhaPrimordial && exec ./IlhaPrimordial
SH
chmod +x "$LIN/jogar.sh"
cat > "$LIN/LEIA-ME.txt" <<TXT
ILHA PRIMORDIAL $GAMEVER - versão para Linux (64 bits)

1. Descompacte a pasta inteira.
2. Abra um terminal na pasta e rode:   ./jogar.sh
   (ou ./IlhaPrimordial; se der "permissão negada": chmod +x IlhaPrimordial jogar.sh)

Precisa do WebKitGTK 4.0 (o Neutralino 5.4 usa a biblioteca libwebkit2gtk-4.0.so.37):
  Ubuntu 22.04 / Debian 11-12:  sudo apt install libwebkit2gtk-4.0-37
  Fedora:                       sudo dnf install webkit2gtk3
  Arch:                         instale o pacote webkit2gtk (AUR: webkit2gtk-4.0 se o seu só tiver a 4.1)
  Ubuntu 24.04 ou mais novo tirou essa versão dos repositórios: use o jogo em HTML
  (ilha-primordial.html) no Chrome/Firefox, que funciona em qualquer Linux.
Para o jogo ficar fluido, use o driver de vídeo da sua placa (aceleração 3D ligada).
TXT
cd "$ROOT/build/pc"
rm -f "$ROOT/dist/ilha-primordial-linux.zip"
zip -qr -9 "$ROOT/dist/ilha-primordial-linux.zip" IlhaPrimordial-linux
ls -la "$ROOT/dist/ilha-primordial-linux.zip"
