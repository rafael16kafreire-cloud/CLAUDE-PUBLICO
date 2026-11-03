#!/usr/bin/env bash
# =============================================================
# GERA O APP ANDROID (APK):  npm run apk
# 1) empacota ícone, nome e o jogo (assets/index.html)
# 2) compila o Java da tela do app e converte para o Android
# 3) assina o APK (sem assinatura o Android não instala)
# Resultado: dist/ilha-primordial.apk
# =============================================================
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TOOLS="$ROOT/android/.tools"
APP="$ROOT/android/app/src/main"
OUT="$ROOT/build/android"
KEYSTORE="${KEYSTORE:-$ROOT/android/keystore/ilha-teste.p12}"
KEYPASS="${KEYPASS:-ilhaprimordial}"
KEYALIAS="${KEYALIAS:-ilha}"
VERSION_NAME="$(node -p "require('$ROOT/package.json').version")"
# Código de versão: cada APK novo precisa de um número maior para atualizar.
VERSION_CODE="${VERSION_CODE:-$(node -p "require('$ROOT/package.json').androidVersionCode")}"

[ -x "$TOOLS/aapt2" ] || bash "$ROOT/android/get-tools.sh"
[ -s "$APP/assets/index.html" ] || { echo "Rode antes: npm run build"; exit 1; }

rm -rf "$OUT"
mkdir -p "$OUT/classes" "$OUT/stubs"

echo "1/4 Recursos (nome, ícone, jogo)..."
"$TOOLS/aapt2" compile --dir "$APP/res" -o "$OUT/res.zip"
"$TOOLS/aapt2" link -o "$OUT/base.apk" \
  -I "$TOOLS/android-framework.jar" \
  --manifest "$APP/AndroidManifest.xml" \
  --min-sdk-version 24 --target-sdk-version 34 \
  --version-code "$VERSION_CODE" --version-name "$VERSION_NAME" \
  -A "$APP/assets" "$OUT/res.zip"

echo "2/4 Código do app (Java -> dex)..."
javac -nowarn --release 8 -cp "$TOOLS/android-stubs.jar" -d "$OUT/stubs" \
  "$ROOT/android/stubs/android/webkit/JavascriptInterface.java"
javac -nowarn --release 8 -cp "$TOOLS/android-stubs.jar:$OUT/stubs" -d "$OUT/classes" \
  $(find "$APP/java" -name '*.java')
java -cp "$TOOLS/dx.jar" com.android.dx.command.Main --dex --min-sdk-version=24 \
  --output="$OUT/classes.dex" "$OUT/classes"
(cd "$OUT" && zip -q -j base.apk classes.dex)
python3 "$ROOT/tools/android/zipalign.py" "$OUT/base.apk" "$OUT/aligned.apk"

echo "3/4 Assinando..."
mkdir -p "$OUT/signer"
javac -nowarn -cp "$TOOLS/apksig.jar" -d "$OUT/signer" "$ROOT/tools/android/SignApk.java"
mkdir -p "$ROOT/dist"
java --add-exports=java.base/sun.security.x509=ALL-UNNAMED \
  --add-exports=java.base/sun.security.pkcs=ALL-UNNAMED \
  --add-exports=java.base/sun.security.util=ALL-UNNAMED \
  -cp "$TOOLS/apksig.jar:$OUT/signer" SignApk "$KEYSTORE" "$KEYPASS" "$KEYALIAS" \
  "$OUT/aligned.apk" "$ROOT/dist/ilha-primordial.apk"

echo "4/4 Conferindo..."
python3 "$ROOT/tools/android/check_apk.py" "$ROOT/dist/ilha-primordial.apk"
"$TOOLS/aapt2" dump badging "$ROOT/dist/ilha-primordial.apk" 2>/dev/null | grep -E "^(package|sdkVersion|targetSdkVersion|application-label|launchable-activity)" || true
ls -la "$ROOT/dist/ilha-primordial.apk"
