"""
Transforma um terreno .usdz (ex.: "Snow alps Low poly") em:
  - mapa de relevo 256x256 (Uint16) – usado para as montanhas da Lapônia
  - máscara neve/rocha 256x256 (Uint8) tirada da textura do modelo
    (cinza = neve, preto = rocha exposta)
e grava src/world/textures/alpes.js (base64).

Uso (precisa de usd-core, numpy e Pillow):
  python alpes_relevo.py pasta_extraida_do_usdz saida.js
"""
import base64
import sys

import numpy as np
from PIL import Image
from pxr import Usd, UsdGeom

N_H = 256   # resolução do relevo
N_C = 256   # resolução da máscara de neve


def main(folder, out):
    st = Usd.Stage.Open(f'{folder}/scene.usdc')
    tex = np.asarray(Image.open(f'{folder}/0/material_0_baseColor.jpg').convert('RGB'), dtype=np.float32)
    th, tw = tex.shape[:2]
    P, U = [], []
    for p in st.Traverse():
        if not p.IsA(UsdGeom.Mesh):
            continue
        m = UsdGeom.Mesh(p)
        pts = np.array(m.GetPointsAttr().Get(), dtype=np.float64)
        xf = np.array(UsdGeom.Xformable(p).ComputeLocalToWorldTransform(0))
        w = (np.c_[pts, np.ones(len(pts))] @ xf)[:, :3]
        uv = np.array(UsdGeom.PrimvarsAPI(p).GetPrimvar('st0').Get(), dtype=np.float64)
        P.append(w)
        U.append(uv)
    P = np.concatenate(P)
    U = np.concatenate(U)
    x0, x1 = P[:, 0].min(), P[:, 0].max()
    z0, z1 = P[:, 2].min(), P[:, 2].max()
    size = max(x1 - x0, z1 - z0)
    hmin, hmax = P[:, 1].min(), P[:, 1].max()
    print('pontos', len(P), 'tamanho', size, 'altura', hmin, hmax)

    def grid(n):
        gi = np.clip(((P[:, 0] - x0) / size * n).astype(int), 0, n - 1)
        gj = np.clip(((P[:, 2] - z0) / size * n).astype(int), 0, n - 1)
        return gi, gj

    # relevo: maior altura de cada célula; buracos preenchidos pelos vizinhos
    gi, gj = grid(N_H)
    H = np.full((N_H, N_H), np.nan)
    np.fmax.at(H, (gj, gi), P[:, 1])
    for _ in range(64):
        nan = np.isnan(H)
        if not nan.any():
            break
        Hp = np.pad(H, 1, constant_values=np.nan)
        neigh = np.stack([Hp[:-2, 1:-1], Hp[2:, 1:-1], Hp[1:-1, :-2], Hp[1:-1, 2:]])
        H[nan] = np.nanmean(neigh, axis=0)[nan]
    H = np.nan_to_num(H, nan=hmin)
    Hn = ((H - hmin) / (hmax - hmin) * 65535).astype('<u2')

    # cor: média da foto aérea em cada célula (pela coordenada de textura)
    gi, gj = grid(N_C)
    px = np.clip((U[:, 0] * (tw - 1)).astype(int), 0, tw - 1)
    py = np.clip(((1 - U[:, 1]) * (th - 1)).astype(int), 0, th - 1)
    col = tex[py, px]
    acc = np.zeros((N_C, N_C, 3))
    cnt = np.zeros((N_C, N_C))
    np.add.at(acc, (gj, gi), col)
    np.add.at(cnt, (gj, gi), 1)
    C = acc / np.maximum(cnt, 1)[..., None]
    for _ in range(64):
        empty = cnt == 0
        if not empty.any():
            break
        Cp = np.pad(C, ((1, 1), (1, 1), (0, 0)))
        cp = np.pad(cnt > 0, 1)
        s = Cp[:-2, 1:-1] * cp[:-2, 1:-1, None] + Cp[2:, 1:-1] * cp[2:, 1:-1, None] + Cp[1:-1, :-2] * cp[1:-1, :-2, None] + Cp[1:-1, 2:] * cp[1:-1, 2:, None]
        k = cp[:-2, 1:-1].astype(int) + cp[2:, 1:-1] + cp[1:-1, :-2] + cp[1:-1, 2:]
        fill = empty & (k > 0)
        C[fill] = s[fill] / k[fill, None]
        cnt[fill] = 1
    # máscara: claridade (a textura usa ~128 para neve e ~0 para rocha)
    lum = C.mean(axis=2)
    snow = np.clip(lum / 128.0, 0, 1)
    M = (snow * 255).astype(np.uint8)

    relief = (hmax - hmin) / size
    with open(out, 'w') as f:
        f.write('// Relevo e cor das montanhas, tirados do modelo "Snow alps Low poly"\n')
        f.write('// (arquivo enviado pelo jogador). Gerado por tools/models/alpes_relevo.py.\n')
        f.write(f'// ALPES_N x ALPES_N alturas (0 a 65535); ALPES_RELEVO = altura / largura do modelo.\n')
        f.write(f'export const ALPES_N = {N_H};\n')
        f.write(f'export const ALPES_RELEVO = {relief:.5f};\n')
        f.write(f"export const ALPES_ALTURAS = '{base64.b64encode(Hn.tobytes()).decode()}';\n")
        f.write('// ALPES_NEVE: 0 = rocha exposta, 255 = neve\n')
        f.write(f"export const ALPES_NEVE = '{base64.b64encode(M.tobytes()).decode()}';\n")
    print('relevo', relief)


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
