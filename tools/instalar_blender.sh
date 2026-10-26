#!/bin/sh
# Instala o Blender (pacote "bpy" do Python, sem tela) num ambiente separado.
# Uso: sh tools/instalar_blender.sh [pasta]   (padrão: ./.blender-env)
# Depois: <pasta>/bin/python script.py   (dentro do script: import bpy)
DEST="${1:-.blender-env}"
python3 -m venv "$DEST" && "$DEST/bin/pip" install -q bpy && "$DEST/bin/python" -c "import bpy; print('Blender', bpy.app.version_string, 'pronto em $DEST')"
