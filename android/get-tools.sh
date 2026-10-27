#!/usr/bin/env bash
# Baixa as ferramentas para montar o APK (uma vez só) em android/.tools
# - aapt2 e "android-framework.jar": de dentro do Apktool (empacota recursos)
# - android-stubs.jar: para compilar o Java
# - dx.jar: converte Java para o formato do Android (dex)
# - apksig.jar: assina o APK
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)/.tools"
mkdir -p "$DIR"
cd "$DIR"

get() {
  [ -s "$1" ] && return 0
  for i in 1 2 3 4 5; do
    curl -sSfL --max-time 300 -o "$1" "$2" && return 0
    echo "tentando de novo ($i): $1"; sleep $((i * 3))
  done
  return 1
}

MAVEN=https://repo1.maven.org/maven2
get apktool.jar https://github.com/iBotPeaches/Apktool/releases/download/v2.10.0/apktool_2.10.0.jar
get android-stubs.jar $MAVEN/com/google/android/android/4.1.1.4/android-4.1.1.4.jar
get dx.jar $MAVEN/com/jakewharton/android/repackaged/dalvik-dx/16.0.1/dalvik-dx-16.0.1.jar
get apksig.jar $MAVEN/com/android/tools/build/apksig/2.3.0/apksig-2.3.0.jar
[ -x aapt2 ] || { unzip -o -q -j apktool.jar prebuilt/linux/aapt2_64 -d . && mv aapt2_64 aapt2 && chmod +x aapt2; }
[ -s android-framework.jar ] || unzip -o -q -j apktool.jar brut/androlib/android-framework.jar -d .
echo "Ferramentas prontas em $DIR"
