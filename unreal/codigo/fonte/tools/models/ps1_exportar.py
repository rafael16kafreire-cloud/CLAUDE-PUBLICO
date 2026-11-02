#!/usr/bin/env python3
"""Personagem PS1 -> formato do jogo (src/player/skin_data.js).

Lê o .npz de ps1_extrair.py, separa a malha em partes rígidas (cabeça, tronco, braços, pernas) com
o pivô na articulação, refaz a textura sem a roupa (só bermuda e pele) e junta o braço em primeira
pessoa (tools/models/personagem.py) com uma pele da mesma cor.

Uso: python3 tools/models/ps1_exportar.py <ps1.npz> <textura.jpg> [saida.js] [--cru] [--previa pasta]
  --cru: mantém a roupa original (para olhar o modelo).
"""
import base64
import io
import json
import math
import sys

import numpy as np
from PIL import Image, ImageFilter

sys.path.insert(0, __import__('os').path.dirname(__file__))
import personagem as pg  # noqa: E402

N = 512
PIV = {'head': 'n11', 'armL': 'n15', 'armR': 'n24', 'legL': 'n32', 'legR': 'n36'}


def b64(a):
    return base64.b64encode(np.ascontiguousarray(a).tobytes()).decode()


def rasteriza(P, tris, uv, parte, normal_z):
    """Para cada texel: parte do corpo, posição no mundo (x,y,z) e se a face olha para a frente."""
    mask = -np.ones((N, N), int)
    pos = np.zeros((N, N, 3))
    frente = np.zeros((N, N), bool)
    for t in range(len(tris)):
        uvs = uv[t] * np.array([N, N])
        uvs[:, 1] = (1 - uv[t][:, 1]) * N
        w3 = P[tris[t]]
        x0, y0 = np.floor(uvs.min(0)).astype(int)
        x1, y1 = np.ceil(uvs.max(0)).astype(int)
        a, b, c = uvs
        den = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1])
        if abs(den) < 1e-9:
            continue
        ys, xs = np.mgrid[max(0, y0):min(N, y1 + 1), max(0, x0):min(N, x1 + 1)]
        px, py = xs + 0.5, ys + 0.5
        w0 = ((b[1] - c[1]) * (px - c[0]) + (c[0] - b[0]) * (py - c[1])) / den
        w1 = ((c[1] - a[1]) * (px - c[0]) + (a[0] - c[0]) * (py - c[1])) / den
        w2 = 1 - w0 - w1
        ok = (w0 >= -0.03) & (w1 >= -0.03) & (w2 >= -0.03)
        mask[ys[ok], xs[ok]] = parte[t]
        pos[ys[ok], xs[ok]] = w0[ok, None] * w3[0] + w1[ok, None] * w3[1] + w2[ok, None] * w3[2]
        frente[ys[ok], xs[ok]] = normal_z[t] < 0
    return mask, pos, frente


def amostra_pele(img, mask, chaves):
    """Cor média da pele: pega dos braços (pixels rosados)."""
    a = np.array(img).astype(float)
    ids = [chaves.index('armL'), chaves.index('armR')]
    m = np.isin(mask, ids)
    px = a[m]
    # só os rosados (r > g > b e saturação razoável)
    sel = (px[:, 0] > px[:, 1] + 12) & (px[:, 1] > px[:, 2] - 5) & (px[:, 0] > 120)
    return px[sel].mean(0) if sel.any() else np.array([200.0, 150.0, 130.0])


def refaz_textura(img, mask, pos, frente, chaves, cru):
    if cru:
        return img
    a = np.array(img).astype(float)
    pele = amostra_pele(img, mask, chaves)
    idx = {k: i for i, k in enumerate(chaves)}
    rng = np.random.default_rng(3)
    ruido = 1 + rng.normal(0, 0.025, (N, N, 1))
    y = pos[..., 1]
    x = pos[..., 0]
    z = pos[..., 2]
    base = np.ones((N, N, 3)) * pele * ruido
    out = a.copy()
    # tronco: pele em tudo acima do cós da bermuda; embaixo, o jeans vira bermuda
    tr = mask == idx['torso']
    acima = tr & (y > 0.99)
    # sombreado suave de peito/barriga (natural, sem exagero): linhas finas na frente
    sh = np.ones((N, N))
    fr = frente & tr
    # mamilos
    for sg in (-1, 1):
        d = np.hypot((x - sg * 0.085) / 0.012, (y - 1.275) / 0.012)
        sh *= np.where(fr, 1 - 0.28 * np.exp(-d ** 2), 1)
    # umbigo
    d = np.hypot(x / 0.01, (y - 1.07) / 0.012)
    sh *= np.where(fr, 1 - 0.25 * np.exp(-d ** 2), 1)
    # sulco do peito e linha do abdômen, bem leves
    sh *= np.where(fr & (y > 1.0), 1 - 0.07 * np.exp(-(x / 0.012) ** 2), 1)
    # base do peitoral
    sh *= np.where(fr, 1 - 0.07 * np.exp(-((y - 1.235) / 0.012) ** 2) * (np.abs(x) < 0.16), 1)
    # costelas leves
    sh *= np.where(fr, 1 - 0.035 * (np.sin((y - 1.1) * 150) > 0.8) * (y > 1.1) * (y < 1.25), 1)
    # coluna nas costas
    sh *= np.where(tr & ~frente & (y > 1.0), 1 - 0.08 * np.exp(-(x / 0.012) ** 2), 1)
    tpele = base * sh[..., None]
    out[acima] = tpele[acima]
    # braços: pele do ombro à mão (as mangas viram pele)
    br = np.isin(mask, [idx['armL'], idx['armR']])
    r_, g_, b_ = a[..., 0], a[..., 1], a[..., 2]
    manga = br & ~((r_ > g_ + 10) & (r_ > 120))          # tudo que não é rosado é manga
    manga_suave = np.array(Image.fromarray((manga * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(2.2))).astype(float)[..., None] / 255
    novo = base * (0.97 + 0.06 * np.random.default_rng(5).random((N, N, 1)))
    out = np.where(br[..., None], a * (1 - manga_suave) + novo * manga_suave, out)
    # pernas: jeans só do cós até a bainha da bermuda; abaixo, pele
    pe = np.isin(mask, [idx['legL'], idx['legR']])
    hem = 0.58
    abaixo = pe & (y < hem)
    out[abaixo] = (base * (0.93 + 0.12 * rng.random((N, N, 1))) * (1 - 0.1 * (y[..., None] < 0.12)))[abaixo]
    # bainha: faixa mais escura e um pouco desfiada
    bainha = pe & (y >= hem) & (y < hem + 0.02)
    out[bainha] = out[bainha] * 0.72
    # o jeans da bermuda fica mais claro/desbotado e sujo
    jeans = (pe & (y >= hem)) | (tr & (y <= 0.99))
    out[jeans] = out[jeans] * np.array([0.92, 1.0, 1.28]) + np.array([4, 4, 10])   # jeans mais azul e desbotado
    # sujeira leve em tudo que é pele
    peles = out.copy()
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))


def monta_parte(P, tris, uv, parte, normal, k, piv, ossos):
    sel = np.where(parte == k)[0]
    verts, uvs, idx = [], [], []
    mapa = {}
    for t in sel:
        for j in range(3):
            v = int(tris[t][j])
            u = tuple(np.round(uv[t][j], 5))
            key = (v, u)
            if key not in mapa:
                mapa[key] = len(verts)
                verts.append(P[v])
                uvs.append((uv[t][j][0], uv[t][j][1]))
            idx.append(mapa[key])
    V = np.array(verts) - piv
    U = np.array(uvs)
    F = np.array(idx).reshape(-1, 3)
    # normais suaves por posição (soldando vértices iguais)
    fn = np.cross(V[F[:, 1]] - V[F[:, 0]], V[F[:, 2]] - V[F[:, 0]])
    chave = {}
    ids = np.array([chave.setdefault(tuple(np.round(p, 4)), len(chave)) for p in V])
    acc = np.zeros((len(chave), 3))
    for t, f in enumerate(F):
        for v in f:
            acc[ids[v]] += fn[t]
    N_ = acc[ids]
    N_ /= np.linalg.norm(N_, axis=1, keepdims=True) + 1e-9
    lo, hi = V.min(0), V.max(0)
    return {
        'n': int(len(V)),
        'box': [*np.round(lo, 5).tolist(), *np.round(hi, 5).tolist()],
        'pos': b64(np.round((V - lo) / np.maximum(hi - lo, 1e-9) * 65535).astype('<u2')),
        'uvf': b64(U.astype('<f4')),
        'idx': b64(F.reshape(-1).astype('<u2')),
        'nrm': b64(np.round(N_ * 127).astype('i1')),
        'pivot': [float(x) for x in piv],
    }


if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    npz, tex_jpg = args[0], args[1]
    saida = args[2] if len(args) > 2 else 'src/player/skin_data.js'
    cru = '--cru' in sys.argv
    previa = sys.argv[sys.argv.index('--previa') + 1] if '--previa' in sys.argv else None
    d = np.load(npz, allow_pickle=True)
    P, tris, uv, parte = d['P'], d['tris'], d['uv'], d['parte']
    chaves = [str(c) for c in d['chaves']]
    ossos = {r[0]: np.array(r[1:], float) for r in d['ossos']}
    fnorm = np.cross(P[tris[:, 1]] - P[tris[:, 0]], P[tris[:, 2]] - P[tris[:, 0]])
    fnorm /= np.linalg.norm(fnorm, axis=1, keepdims=True) + 1e-9
    img = Image.open(tex_jpg).convert('RGB').resize((N, N), Image.LANCZOS)
    mask, pos, frente = rasteriza(P, tris, uv, parte, fnorm[:, 2])
    tex = refaz_textura(img, mask, pos, frente, chaves, cru)
    partes = {}
    for i, k in enumerate(chaves):
        piv = ossos[PIV[k]] if k in PIV else np.zeros(3)
        partes[k] = monta_parte(P, tris, uv, parte, fnorm, i, piv, ossos)
    if previa:
        tex.save(f'{previa}/ps1_textura.png')
    buf = io.BytesIO()
    tex.save(buf, 'PNG', optimize=True)
    textura = 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode()
    # braço em primeira pessoa (procedural) com a pele da mesma cor
    pele = amostra_pele(img, mask, chaves)
    fp = pg.exporta(pg.braco_fp(), (0, 0, 0))
    ptx = pg.textura_pele()
    arr = np.array(ptx).astype(float)
    arr = arr / arr.reshape(-1, 3).mean(0) * pele * 1.0
    ptx = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))
    buf2 = io.BytesIO()
    ptx.save(buf2, 'JPEG', quality=90)
    fp_tex = 'data:image/jpeg;base64,' + base64.b64encode(buf2.getvalue()).decode()
    if previa:
        ptx.save(f'{previa}/fp_pele.png')
    with open(saida, 'w') as f:
        f.write('// Personagem (modelo PS1 do jogador) e braço em primeira pessoa. Gerado por tools/models/ps1_exportar.py.\n')
        f.write(f'export const SKIN_PARTES = {json.dumps(partes)};\n')
        f.write(f'export const FP_BRACO = {json.dumps(fp)};\n')
        f.write(f'export const SKIN_TEXTURA = {json.dumps(textura)};\n')
        f.write(f'export const FP_TEXTURA = {json.dumps(fp_tex)};\n')
    print('escrito', saida, {k: v['n'] for k, v in partes.items()}, 'pele', pele.round())
