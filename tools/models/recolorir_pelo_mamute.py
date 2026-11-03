"""
Conserta o mamute: a textura dos pelos (material 0) veio com o RGB todo
preto (só o canal alpha tem o desenho dos fios). Aqui o RGB vira marrom de
pelo (mais claro onde o fio é mais cheio) e o alpha continua o mesmo.
Uso (Pillow + numpy): python tools/models/recolorir_pelo_mamute.py
Reescreve src/creatures/imported/mamute.js (roda uma vez só: se o RGB já
tem cor, não faz nada).
"""
import base64
import io
import re
import sys

import numpy as np
from PIL import Image

ARQ = 'src/creatures/imported/mamute.js'
s = open(ARQ, encoding='utf-8').read()
m = re.search(r'("map":"data:image/png;base64,)([A-Za-z0-9+/=]+)(")', s)
if not m:
    sys.exit('textura PNG dos pelos não encontrada')
im = Image.open(io.BytesIO(base64.b64decode(m.group(2)))).convert('RGBA')
a = np.array(im)
if a[..., :3].max() > 0:
    sys.exit('o RGB dos pelos já tem cor: nada a fazer')
alpha = a[..., 3].astype(np.float32) / 255
rng = np.random.default_rng(7)
ruido = rng.random(alpha.shape).astype(np.float32)
base = np.array([112, 72, 44], dtype=np.float32)
claro = 0.7 + 0.45 * alpha + 0.2 * (ruido - 0.5)
rgb = np.clip(base[None, None, :] * claro[..., None], 0, 255).astype(np.uint8)
out = np.dstack([rgb, a[..., 3]])  # (1024 px)
buf = io.BytesIO()
Image.fromarray(out, 'RGBA').resize((512, 512), Image.LANCZOS).save(buf, 'PNG', optimize=True)
novo = base64.b64encode(buf.getvalue()).decode()
s = s[:m.start(2)] + novo + s[m.end(2):]
open(ARQ, 'w', encoding='utf-8').write(s)
print('ok: pelos do mamute recoloridos', len(novo) // 1024, 'KB')
