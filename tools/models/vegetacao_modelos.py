"""
Plantas da praia e da floresta enviadas pelo jogador -> um arquivo só
para o jogo (src/world/textures/veg_modelos.js, tudo em base64).

  praia:    "Palm Tree Realistic" (palmeira) e "Date palm and vegetation"
            (tamareiras + plantinhas da praia)
  floresta: "Low Poly Tree Scene Free" (duas árvores folhosas e tufos de
            capim) e "Grass" (textura do chão de folhagem)

Cada modelo tem altura 1 (a vegetação escala). Modelo com tronco e folhas
em texturas diferentes vira 2 partes (o jogo usa 2 materiais).

Uso (usd-core, numpy, Pillow): as pastas são os .usdz já extraídos pelo
usd_bicho.py (têm cru.npz / cru.json)
  python vegetacao_modelos.py pasta_palmeira pasta_tamareira pasta_arvores pasta_grama saida.js
"""
import base64
import io
import json
import sys

import numpy as np
from PIL import Image


def load(folder):
    z = np.load(f'{folder}/cru.npz')
    return z['P'], z['UV'], z['F'], z['MID'], json.load(open(f'{folder}/cru.json'))


def mesh(folder_data, ids):
    """Junta as malhas ids (lista) -> pos, uv, idx (com tri. só delas)."""
    P, UV, F, MID, _ = folder_data
    sel = np.isin(MID, ids)
    keep = sel[F[:, 0]]
    f = F[keep]
    used = np.unique(f)
    remap = np.full(len(P), -1)
    remap[used] = np.arange(len(used))
    return P[used].copy(), UV[used].copy(), remap[f]


def b64(a):
    return base64.b64encode(np.ascontiguousarray(a).tobytes()).decode()


def img(path, size, alpha):
    im = Image.open(path).convert('RGBA' if alpha else 'RGB')
    im = im.resize(size, Image.LANCZOS)
    buf = io.BytesIO()
    if alpha:
        im.save(buf, 'PNG', optimize=True)
        return 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode()
    im.save(buf, 'JPEG', quality=82, optimize=True)
    return 'data:image/jpeg;base64,' + base64.b64encode(buf.getvalue()).decode()


def model(parts, rot=None):
    """parts = [(pos, uv, idx, tex)] -> altura 1, centrado no tronco, no chão."""
    allp = np.concatenate([p for p, _, _, _ in parts])
    if rot is not None:
        parts = [(p @ rot.T, u, i, t) for p, u, i, t in parts]
        allp = allp @ rot.T
    # centro: base do tronco (pontos mais baixos)
    low = allp[allp[:, 1] < allp[:, 1].min() + 0.05 * (allp[:, 1].max() - allp[:, 1].min())]
    cx, cz = low[:, 0].mean(), low[:, 2].mean()
    y0 = allp[:, 1].min()
    h = allp[:, 1].max() - y0
    out = []
    for p, uv, idx, tex in parts:
        q = (p - [cx, y0, cz]) / h
        lo, hi = q.min(0), q.max(0)
        ulo, uhi = uv.min(0), uv.max(0)
        out.append({
            'n': int(len(q)),
            'box': [*np.round(lo, 5).tolist(), *np.round(hi, 5).tolist()],
            'uvbox': [*np.round(ulo, 5).tolist(), *np.round(uhi, 5).tolist()],
            'pos': b64(np.round((q - lo) / np.maximum(hi - lo, 1e-9) * 65535).astype('<u2')),
            'uv': b64(np.round((uv - ulo) / np.maximum(uhi - ulo, 1e-9) * 65535).astype('<u2')),
            'idx': b64(idx.astype('<u2')),
            'tex': tex,
        })
    return out


def main(palm, date, trees, grass, out):
    M = {}
    # ---- praia
    d = load(palm)
    p, u, i = mesh(d, [0])
    M['palmeira'] = model([(p, u, i, 'palm')])
    d = load(date)
    for key, mid in (('tamareira', 0), ('tamareira2', 2)):
        p, u, i = mesh(d, [mid])
        M[key] = model([(p, u, i, 'date')])
    p, u, i = mesh(d, [4])
    M['planta_praia'] = model([(p, u, i, 'small')])
    p, u, i = mesh(d, [6])
    M['capim_praia'] = model([(p, u, i, 'small')])
    # ---- floresta
    d = load(trees)
    for key, bark, leaves in (('arvore_folhosa', 2668, 2669), ('arvore_folhosa2', 2670, 2671)):
        p1, u1, i1 = mesh(d, [bark])
        p2, u2, i2 = mesh(d, [leaves])
        M[key] = model([(p1, u1, i1, 'bark'), (p2, u2, i2, 'leaves')])
    p, u, i = mesh(d, [2])
    M['capim'] = model([(p, u, i, 'grass')])
    T = {
        'palm': img(f'{palm}/0/Palm_Hamza_baseColor_cutoff206.png', (1024, 1024), True),
        'date': img(f'{date}/0/M_DatePalm_Leaves_2048_baseColor_cutoff93.png', (1024, 1024), True),
        'small': img(f'{date}/0/M_Small_Vegetation_baseColor_cutoff90.png', (512, 512), True),
        'bark': img(f'{trees}/0/Bark_baseColor.jpg', (256, 256), False),
        'leaves': img(f'{trees}/0/Leaves_baseColor_cutoff128.png', (512, 512), True),
        'grass': img(f'{trees}/0/Grass_C_baseColor_cutoff128.png', (256, 256), True),
    }
    # chão de folhagem (scan "Grass"): textura repetível
    folhagem = img(f'{grass}/0/Tile_1_0_baseColor.jpg', (1024, 1024), False)
    with open(out, 'w') as f:
        f.write('// Plantas da praia e da floresta enviadas pelo jogador (Palm Tree Realistic,\n')
        f.write('// Date palm and vegetation, Low Poly Tree Scene Free, Grass).\n')
        f.write('// Gerado por tools/models/vegetacao_modelos.py.\n')
        f.write(f'export const VEG_MODELOS = {json.dumps(M)};\n')
        f.write(f'export const VEG_TEXTURAS = {json.dumps(T)};\n')
        f.write(f"export const FOLHAGEM_COR = '{folhagem}';\n")
    print({k: [p['n'] for p in v] for k, v in M.items()})


if __name__ == '__main__':
    main(*sys.argv[1:6])
