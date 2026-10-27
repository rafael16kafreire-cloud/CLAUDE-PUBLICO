"""
Skin do jogador (modelo "Base Chibi Fantasy Blocky Head", enviado pelo
jogador) -> src/player/skin_data.js

O modelo não tem esqueleto: é cortado em 6 pedaços (cabeça, tronco,
braços e pernas) pela altura e pela largura, e cada pedaço gira no seu
ponto (ombro, quadril, pescoço) como o boneco do jogo. Altura 1,8 m,
olhando para -Z.

Uso: python skin_jogador.py pasta_extraida saida.js
"""
import base64
import io
import json
import sys

import numpy as np
from PIL import Image

H_M = 1.8


def b64(a):
    return base64.b64encode(np.ascontiguousarray(a).tobytes()).decode()


def main(folder, out):
    z = np.load(f'{folder}/cru.npz')
    P, UV, F = z['P'].copy(), z['UV'], z['F']
    # frente do modelo em +Z -> jogo em -Z
    P[:, 0] *= -1
    P[:, 2] *= -1
    lo, hi = P.min(0), P.max(0)
    s = H_M / (hi[1] - lo[1])
    P = (P - [(lo[0] + hi[0]) / 2, lo[1], (lo[2] + hi[2]) / 2]) * s
    H = H_M
    W = (hi[0] - lo[0]) * s
    cen = P[F].mean(1)
    f = cen[:, 1] / H
    x = cen[:, 0]
    arm_x = 0.275 * W  # além disso (para os lados) é braço
    part = np.full(len(F), 'torso', dtype=object)
    part[f > 0.8] = 'head'
    part[(f < 0.24) & (x < 0)] = 'legL'
    part[(f < 0.24) & (x >= 0)] = 'legR'
    arms = (f >= 0.24) & (f <= 0.8) & (np.abs(x) > arm_x)
    part[arms & (x < 0)] = 'armL'
    part[arms & (x >= 0)] = 'armR'
    pivots = {
        'head': [0, 0.8 * H, 0],
        'torso': [0, 0, 0],
        'armL': [-arm_x * 0.95, 0.75 * H, 0],
        'armR': [arm_x * 0.95, 0.75 * H, 0],
        'legL': [-0.12 * W, 0.24 * H, 0],
        'legR': [0.12 * W, 0.24 * H, 0],
    }
    parts = {}
    for name, piv in pivots.items():
        tri = F[part == name]
        used = np.unique(tri)
        remap = np.full(len(P), -1)
        remap[used] = np.arange(len(used))
        q = P[used] - piv
        plo, phi = q.min(0), q.max(0)
        parts[name] = {
            'pivot': np.round(piv, 4).tolist(),
            'n': int(len(used)),
            'box': [*np.round(plo, 5).tolist(), *np.round(phi, 5).tolist()],
            'pos': b64(np.round((q - plo) / np.maximum(phi - plo, 1e-9) * 65535).astype('<u2')),
            'uv': b64(np.round(np.clip(UV[used], 0, 1) * 65535).astype('<u2')),
            'idx': b64(remap[tri].astype('<u2')),
        }
    im = Image.open(f'{folder}/0/material_0_baseColor.jpg').convert('RGB').resize((512, 512), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, 'JPEG', quality=85, optimize=True)
    tex = 'data:image/jpeg;base64,' + base64.b64encode(buf.getvalue()).decode()
    info = json.load(open(f'{folder}/cru.json'))['info']
    with open(out, 'w') as fo:
        fo.write('// Skin do jogador: "Base Chibi Fantasy Blocky Head" por UFRE Studio\n')
        fo.write('// (Sketchfab, CC-BY 4.0), cortado em pedaços para animar.\n')
        fo.write('// Gerado por tools/models/skin_jogador.py.\n')
        fo.write(f'export const SKIN_CREDITO = {json.dumps({"titulo": info.get("title"), "autor": "UFRE Studio"})};\n')
        fo.write(f'export const SKIN_PARTES = {json.dumps(parts)};\n')
        fo.write(f"export const SKIN_TEXTURA = '{tex}';\n")
    print({k: v['n'] for k, v in parts.items()})


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
