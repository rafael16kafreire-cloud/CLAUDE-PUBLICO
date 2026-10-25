"""
TRONCOS CAÍDOS enviados pelo jogador (passo 1 de 2): deita cada tronco
ao longo de X, encosta no chão, deixa com comprimento 1 e reduz a
textura. Grava troncos.json para o troncos_para_jogo.mjs.

Uso (numpy, Pillow): python troncos_modelos.py saida.json chave=pasta_cru[:tamanho_textura] ...
(pasta_cru = saída do usd_bicho.py)
"""
import base64
import io
import json
import sys

import numpy as np
from PIL import Image


def main(out, *items):
    res = {}
    for it in items:
        key, rest = it.split('=')
        parts = rest.split(':')
        folder = parts[0]
        size = parts[1] if len(parts) > 1 else '512'
        chao = parts[2] if len(parts) > 2 else '0'
        z = np.load(f'{folder}/cru.npz')
        meta = json.load(open(f'{folder}/cru.json'))
        P, UV, F = z['P'], z['UV'], z['F']
        if float(chao) > 0:
            # modelo escaneado com um pedaço de chão: tira as faces quase
            # planas que estão baixas (o chão), fica o tronco e os galhos
            span = (P.max(0) - P.min(0)).max()
            y0 = P[:, 1].min()
            a, b, c = P[F[:, 0]], P[F[:, 1]], P[F[:, 2]]
            n = np.cross(b - a, c - a)
            ny = np.abs(n[:, 1]) / np.maximum(np.linalg.norm(n, axis=1), 1e-12)
            low = np.max(np.stack([a[:, 1], b[:, 1], c[:, 1]]), 0) < y0 + float(chao) * span
            F = F[~(low & (ny > 0.75))]
            # fica só o que está perto da linha do tronco (os pontos mais
            # altos marcam o tronco deitado)
            hi = P[np.unique(F)]
            top = hi[hi[:, 1] > y0 + 2.2 * float(chao) * span]
            c0 = top.mean(0)
            _, _, vt = np.linalg.svd(top[:, [0, 2]] - c0[[0, 2]], full_matrices=False)
            d = vt[0]
            rel = P[:, [0, 2]] - c0[[0, 2]]
            along = rel @ d
            dist = np.abs(rel @ np.array([-d[1], d[0]]))
            t_lo, t_hi = np.percentile(top[:, [0, 2]] @ d - c0[[0, 2]] @ d, [1, 99])
            near = (dist < 0.06 * span) & (along > t_lo - 0.03 * span) & (along < t_hi + 0.03 * span)
            F = F[near[F].all(1)]
            used = np.unique(F)
            remap = np.full(len(P), -1)
            remap[used] = np.arange(len(used))
            P, UV, F = P[used], UV[used], remap[F]
        # eixo comprido no chão (x/z) vira X
        xz = P[:, [0, 2]] - P[:, [0, 2]].mean(0)
        _, _, vt = np.linalg.svd(xz, full_matrices=False)
        a = np.arctan2(vt[0, 1], vt[0, 0])
        c, s = np.cos(a), np.sin(a)
        x = xz[:, 0] * c + xz[:, 1] * s
        zz = -xz[:, 0] * s + xz[:, 1] * c
        Q = np.c_[x, P[:, 1], zz]
        Q[:, 0] -= (Q[:, 0].min() + Q[:, 0].max()) / 2
        Q[:, 2] -= (Q[:, 2].min() + Q[:, 2].max()) / 2
        Q[:, 1] -= Q[:, 1].min()
        Q /= Q[:, 0].max() - Q[:, 0].min()
        m = meta['malhas'][0]
        im = Image.open(m['diffuseColor']).convert('RGB').resize((int(size), int(size)), Image.LANCZOS)
        buf = io.BytesIO()
        im.save(buf, 'JPEG', quality=82, optimize=True)
        tex = {'map': 'data:image/jpeg;base64,' + base64.b64encode(buf.getvalue()).decode()}
        if m.get('normal'):
            nm = Image.open(m['normal']).convert('RGB').resize((int(size) // 2, int(size) // 2), Image.LANCZOS)
            buf = io.BytesIO()
            nm.save(buf, 'JPEG', quality=85, optimize=True)
            tex['normalMap'] = 'data:image/jpeg;base64,' + base64.b64encode(buf.getvalue()).decode()
        res[key] = {'pos': np.round(Q, 5).tolist(), 'uv': np.round(UV, 5).tolist(), 'idx': F.tolist(), **tex}
        print(key, 'vértices', len(Q), 'triângulos', len(F), 'tamanho', np.round(Q.max(0) - Q.min(0), 3).tolist())
    json.dump(res, open(out, 'w'))


if __name__ == '__main__':
    main(*sys.argv[1:])
