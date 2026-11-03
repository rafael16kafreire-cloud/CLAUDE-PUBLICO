"""
Transforma o modelo "Great Mountain" (.usdz, um terreno em grade) em:
  - relevo 256x256 (Uint16, 0..65535)
  - máscara neve/rocha 256x256 (Uint8: 255 = neve, 0 = rocha) tirada da
    textura de cima do modelo (branco = neve, escuro = rocha)
e grava src/world/textures/montanha.js (base64).

Uso (usd-core, numpy, Pillow):
  python montanha_relevo.py pasta_extraida_do_usdz saida.js
"""
import base64
import sys

import numpy as np
from PIL import Image
from pxr import Usd, UsdGeom

N = 256


def main(folder, out):
    st = Usd.Stage.Open(f'{folder}/scene.usdc')
    mesh = next(p for p in st.Traverse() if p.IsA(UsdGeom.Mesh))
    pts = np.array(UsdGeom.Mesh(mesh).GetPointsAttr().Get(), dtype=np.float64)
    xf = np.array(UsdGeom.Xformable(mesh).ComputeLocalToWorldTransform(0))
    w = (np.c_[pts, np.ones(len(pts))] @ xf)[:, :3]
    # o modelo é uma grade quadrada de vértices
    g = int(round(np.sqrt(len(w))))
    x0, x1 = w[:, 0].min(), w[:, 0].max()
    z0, z1 = w[:, 2].min(), w[:, 2].max()
    gi = np.rint((w[:, 0] - x0) / (x1 - x0) * (g - 1)).astype(int)
    gj = np.rint((w[:, 2] - z0) / (z1 - z0) * (g - 1)).astype(int)
    H = np.full((g, g), np.nan)
    H[gj, gi] = w[:, 1]
    H = np.nan_to_num(H, nan=np.nanmin(H))
    H = (H - H.min()) / (H.max() - H.min())
    Hr = np.asarray(Image.fromarray((H * 65535).astype(np.float32)).resize((N, N), Image.BILINEAR))
    Hq = np.clip(Hr, 0, 65535).astype('<u2')

    # textura vista de cima: linha 0 da imagem = lado z máximo -> inverte
    tex = Image.open(f'{folder}/0/wire_228184153_diffuse.jpg').convert('L').resize((N, N), Image.LANCZOS)
    M = np.flipud(np.asarray(tex, dtype=np.float32))
    snow = np.clip((M - 60) / (200 - 60), 0, 1)
    Mq = (snow * 255).astype(np.uint8)

    span = x1 - x0
    relief = (w[:, 1].max() - w[:, 1].min()) / span
    with open(out, 'w') as f:
        f.write('// Relevo e neve da "Grande Montanha" (modelo Great Mountain enviado pelo\n')
        f.write('// jogador). Gerado por tools/models/montanha_relevo.py.\n')
        f.write(f'export const MONTANHA_N = {N};\n')
        f.write(f'export const MONTANHA_RELEVO_ORIGINAL = {relief:.4f}; // altura / largura no modelo\n')
        f.write(f"export const MONTANHA_ALTURAS = '{base64.b64encode(Hq.tobytes()).decode()}';\n")
        f.write('// 255 = neve, 0 = rocha (da textura de cima do modelo)\n')
        f.write(f"export const MONTANHA_NEVE = '{base64.b64encode(Mq.tobytes()).decode()}';\n")
    print('grade', g, 'largura', span, 'relevo', relief)


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
