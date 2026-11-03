#!/usr/bin/env python3
"""Palmeiras da praia (estilo ARK): tronco alto e fino, com anéis, levemente curvo,
e uma copa de folhas longas e caídas (folha pinada em cartão dobrado em V).

Feito só com numpy + Pillow (sem Blender): as malhas e as texturas são geradas aqui.
Saída: src/world/textures/veg_palmas.js (formato de tools/models/blender_arvore.py:
altura 1, base no chão, posições/UV em uint16 base64, Y para cima no jogo).

Uso: python3 tools/models/palmeiras.py [saida.js] [--previa pasta]
"""
import base64
import io
import json
import math
import random
import sys

import numpy as np
from PIL import Image, ImageDraw


# ---------------------------------------------------------------- texturas
def ruido_periodico(W, H, rng, termos, kx_max, ky_max):
    """Soma de senos com frequências inteiras: repete sem emenda nos dois eixos."""
    y, x = np.mgrid[0:H, 0:W]
    u, v = x / W, y / H
    out = np.zeros((H, W))
    for _ in range(termos):
        kx, ky = rng.randint(0, kx_max), rng.randint(0, ky_max)
        ph = rng.uniform(0, math.tau)
        out += rng.uniform(0.4, 1.0) * np.sin(math.tau * (kx * u + ky * v) + ph)
    return out / termos ** 0.5


def textura_tronco(seed=3):
    rng = random.Random(seed)
    W, H = 256, 512
    y, x = np.mgrid[0:H, 0:W]
    u, v = x / W, y / H
    base = np.array([124, 108, 90], dtype=float)
    # fibras compridas em pé
    fib = ruido_periodico(W, H, rng, 14, 24, 2)
    fino = ruido_periodico(W, H, rng, 18, 50, 8)
    mancha = ruido_periodico(W, H, rng, 8, 4, 6)
    # anéis: uma cicatriz a cada 64 px (8 anéis em 512; repete sem emenda)
    ondula = 0.9 * ruido_periodico(W, H, rng, 6, 5, 0)  # a linha do anel sobe e desce
    fase = (v * 8.0 + ondula * 0.05) % 1.0
    cicatriz = np.exp(-((fase - 0.05) / 0.045) ** 2)       # sulco escuro
    crista = np.exp(-((fase - 0.2) / 0.09) ** 2)          # borda levantada logo acima
    lum = 1.0 + 0.09 * fib + 0.06 * fino + 0.1 * mancha - 0.42 * cicatriz + 0.14 * crista
    # cicatriz com pontos (restos de folha): mais escura nas pontas das fibras
    lum -= 0.1 * np.clip(fino, 0, 1) * cicatriz
    img = np.clip(lum[..., None] * base, 0, 255)
    # esverdeado/acinzentado de líquen em manchas
    lic = np.clip(ruido_periodico(W, H, rng, 7, 3, 5) * 1.3 - 0.25, 0, 1)[..., None]
    img = img * (1 - lic * 0.28) + np.array([96, 108, 78]) * lic * 0.28
    return Image.fromarray(img.astype(np.uint8), 'RGB')


def textura_folha(seed=5):
    """Folha de palmeira pinada: eixo no meio, folíolos para os dois lados apontando
    para a ponta (parte de cima da imagem). Fundo transparente."""
    rng = random.Random(seed)
    S = 2  # supersampling
    W, H = 512 * S, 1024 * S
    img = Image.new('RGBA', (W, H), (70, 120, 40, 0))
    d = ImageDraw.Draw(img)
    cx = W // 2
    y_base, y_tip = int(H * 0.985), int(H * 0.012)
    comp = y_base - y_tip
    # eixo central (afina para a ponta)
    N = 24
    pts_l, pts_r = [], []
    for i in range(N + 1):
        t = i / N
        yy = y_base - comp * t
        w = (7.0 * (1 - t) + 1.6 * t) * S
        pts_l.append((cx - w, yy))
        pts_r.append((cx + w, yy))
    d.polygon(pts_l + pts_r[::-1], fill=(88, 112, 52, 255))
    nf = 44
    for lado in (-1, 1):
        for k in range(nf):
            t = 0.04 + 0.93 * (k + rng.uniform(-0.25, 0.25)) / nf
            t = min(max(t, 0.02), 0.985)
            if rng.random() < 0.07:
                continue  # folíolo rasgado
            yy = y_base - comp * t
            # folíolos maiores no meio, curtos na base e na ponta
            esc = math.sin(math.pi * min(1, 0.1 + 0.9 * t)) ** 0.55
            esc = 0.28 + 0.72 * esc
            L = (W * 0.5 - 6 * S) * esc * rng.uniform(0.86, 1.08)
            if rng.random() < 0.08:
                L *= rng.uniform(0.45, 0.7)
            ang = math.radians(rng.uniform(46, 62) - 10 * t)  # abre menos perto da ponta
            dx, dy = math.cos(ang) * lado, -math.sin(ang)
            # linha central com curva para baixo (cai um pouco)
            M = 12
            cen = []
            for j in range(M + 1):
                s = j / M
                cen.append((cx + dx * L * s, yy + dy * L * s + L * 0.16 * s * s))
            wmax = (5.2 + 2.8 * esc) * S * rng.uniform(0.8, 1.15)
            lado_a, lado_b = [], []
            for j in range(M + 1):
                s = j / M
                px, py = cen[j]
                nx_, ny_ = -(cen[min(j + 1, M)][1] - cen[max(j - 1, 0)][1]), cen[min(j + 1, M)][0] - cen[max(j - 1, 0)][0]
                ln = math.hypot(nx_, ny_) or 1
                nx_, ny_ = nx_ / ln, ny_ / ln
                hw = wmax * (math.sin(math.pi * min(1, s ** 0.75 * 0.97 + 0.02)) ** 0.8) * (1 - 0.15 * s)
                lado_a.append((px + nx_ * hw, py + ny_ * hw))
                lado_b.append((px - nx_ * hw, py - ny_ * hw))
            g = rng.uniform(0.0, 1.0)
            cor = (int(78 + 34 * g), int(142 + 40 * g), int(40 + 22 * g), 255)
            if rng.random() < 0.09:
                cor = (int(132 + 25 * g), int(158 + 20 * g), int(48), 255)  # amarelado
            d.polygon(lado_a + lado_b[::-1], fill=cor)
            # nervura central do folíolo, mais escura
            d.line(cen, fill=(max(0, cor[0] - 26), max(0, cor[1] - 34), max(0, cor[2] - 12), 255), width=max(1, S))
            # brilho na metade de cima
            d.line([(a[0] * 0.5 + b[0] * 0.5 + (a[0] - b[0]) * 0.2, a[1] * 0.5 + b[1] * 0.5 + (a[1] - b[1]) * 0.2) for a, b in zip(lado_a, lado_b)],
                   fill=(min(255, cor[0] + 26), min(255, cor[1] + 26), min(255, cor[2] + 10), 255), width=max(1, S))
    return img.resize((512, 1024), Image.LANCZOS)


# ---------------------------------------------------------------- geometria
def vec(a, b, c):
    return np.array([a, b, c], dtype=float)


def norm(v):
    n = np.linalg.norm(v)
    return v / n if n > 1e-9 else v


class Malha:
    def __init__(self):
        self.V, self.U, self.F = [], [], []

    def add(self, v, u):
        self.V.append(v)
        self.U.append(u)
        return len(self.V) - 1

    def tri(self, a, b, c):
        self.F.append((a, b, c))


def tronco(rng, H, r0, r1, lados, aneis, malha):
    """Tronco curvo: Z para cima. Devolve o caminho (pontos, raios)."""
    lean = vec(rng.uniform(-1, 1), rng.uniform(-1, 1), 0)
    lean = norm(lean) * H * rng.uniform(0.05, 0.14)
    ondula = rng.uniform(0, math.tau)
    pts, raios = [], []
    for i in range(aneis + 1):
        t = i / aneis
        p = vec(0, 0, H * t) + lean * (t ** 1.7)
        p += vec(math.sin(t * 5 + ondula) * 0.07 * H * 0.1, math.cos(t * 4 + ondula) * 0.06 * H * 0.1, 0) * t
        r = r0 + (r1 - r0) * (t ** 0.8)
        r *= 1.0 + 0.9 * math.exp(-p[2] / 0.55)   # base alargada
        pts.append(p)
        raios.append(r)
    # tubo
    s = 0.0
    filas = []
    for i, p in enumerate(pts):
        if i:
            s += np.linalg.norm(p - pts[i - 1])
        a = pts[max(0, i - 1)]
        b = pts[min(len(pts) - 1, i + 1)]
        T = norm(b - a)
        N = norm(np.cross(T, vec(1, 0, 0)))
        B = norm(np.cross(T, N))
        fila = []
        for j in range(lados + 1):
            ang = j / lados * math.tau
            v = p + (N * math.cos(ang) + B * math.sin(ang)) * raios[i]
            fila.append(malha.add(v, (j / lados, s / 3.0)))
        filas.append(fila)
    for i in range(aneis):
        for j in range(lados):
            a, b = filas[i][j], filas[i][j + 1]
            c, d = filas[i + 1][j], filas[i + 1][j + 1]
            malha.tri(a, b, c)   # normais para fora
            malha.tri(b, d, c)
    return pts, raios


def folha(rng, base, az, elev, comp, larg, queda, dobra, segs, malha):
    """Uma folha: eixo curvando para baixo (peso) e cartão dobrado em V."""
    d0 = vec(math.cos(az) * math.cos(elev), math.sin(az) * math.cos(elev), math.sin(elev))
    p = base.copy()
    d = d0.copy()
    colunas = []
    pts = [p.copy()]
    dirs = [d.copy()]
    for i in range(1, segs + 1):
        t = i / segs
        e = elev - queda * (t ** 1.35)
        d = vec(math.cos(az) * math.cos(e), math.sin(az) * math.cos(e), math.sin(e))
        p = p + d * (comp / segs)
        pts.append(p.copy())
        dirs.append(d.copy())
    for i, (p, d) in enumerate(zip(pts, dirs)):
        t = i / segs
        lado = norm(np.cross(d, vec(0, 0, 1)))
        if np.linalg.norm(lado) < 1e-6:
            lado = vec(1, 0, 0)
        w = larg * (0.05 + 0.95 * math.sin(math.pi * min(1.0, t * 0.92 + 0.06)) ** 0.7) * (1 - 0.35 * t)
        baixo = vec(0, 0, -1)
        e_l = p - lado * w * math.cos(dobra) + baixo * w * math.sin(dobra)
        e_r = p + lado * w * math.cos(dobra) + baixo * w * math.sin(dobra)
        colunas.append((malha.add(e_l, (0.0, t)), malha.add(p, (0.5, t)), malha.add(e_r, (1.0, t))))
    for i in range(segs):
        a, b = colunas[i], colunas[i + 1]
        for k in range(2):
            malha.tri(a[k], b[k], a[k + 1])
            malha.tri(a[k + 1], b[k], b[k + 1])


def palmeira(seed, P, lod=False):
    rng = random.Random(seed)
    mt, mf = Malha(), Malha()
    lados = 4 if lod else 8
    aneis = 6 if lod else 18
    pts, raios = tronco(rng, P['altura'], P['r_base'], P['r_topo'], lados, aneis, mt)
    topo = pts[-1] + vec(0, 0, 0.05)
    n = P['folhas'] // (2 if lod else 1)
    segs = 3 if lod else 7
    for k in range(n):
        f = k / n
        az = k * 2.399963 + rng.uniform(-0.2, 0.2)
        # as de cima ficam em pé; as de baixo (mais velhas) caem
        elev = math.radians(72 - 105 * f ** 0.85 + rng.uniform(-6, 6))
        queda = rng.uniform(0.7, 1.05) + 0.6 * f
        comp = P['folha_comp'] * rng.uniform(0.85, 1.15) * (0.7 + 0.3 * (0.3 + f))
        larg = P['folha_larg'] * rng.uniform(0.9, 1.15)
        folha(rng, topo + vec(0, 0, -0.15 * f), az, elev, comp, larg, queda, math.radians(rng.uniform(26, 38)), segs, mf)
    return mt, mf


# ---------------------------------------------------------------- exportação
def b64(a):
    return base64.b64encode(np.ascontiguousarray(a).tobytes()).decode()


def parte_jogo(M, tex, altura, cores=None):
    """Blender/aqui: Z para cima. Jogo: Y para cima (x, z, -y). Normaliza pela altura."""
    p = np.array([(v[0], v[2], -v[1]) for v in M.V], dtype=float)
    uv = np.array(M.U, dtype=float)
    idx = np.array(M.F, dtype=np.int64).reshape(-1)
    q = p / altura
    lo, hi = q.min(0), q.max(0)
    ulo, uhi = uv.min(0), uv.max(0)
    return {
        'n': int(len(q)),
        'box': [*np.round(lo, 5).tolist(), *np.round(hi, 5).tolist()],
        'uvbox': [*np.round(ulo, 5).tolist(), *np.round(uhi, 5).tolist()],
        'pos': b64(np.round((q - lo) / np.maximum(hi - lo, 1e-9) * 65535).astype('<u2')),
        'uv': b64(np.round((uv - ulo) / np.maximum(uhi - ulo, 1e-9) * 65535).astype('<u2')),
        'idx': b64(idx.astype('<u2')),
        'tex': tex,
        **({'col': b64(np.round(np.clip(np.array(cores), 0, 1) * 255).astype('u1'))} if cores is not None else {}),
    }


def jpg_b64(img, q=88):
    b = io.BytesIO()
    img.convert('RGB').save(b, 'JPEG', quality=q)
    return 'data:image/jpeg;base64,' + base64.b64encode(b.getvalue()).decode()


def png_b64(img):
    b = io.BytesIO()
    img.save(b, 'PNG', optimize=True)
    return 'data:image/png;base64,' + base64.b64encode(b.getvalue()).decode()


PARAMS = [
    # nome, semente, altura, raios, folhas
    ('palma_bl_a', 11, dict(altura=11.5, r_base=0.19, r_topo=0.12, folhas=17, folha_comp=4.4, folha_larg=0.95)),
    ('palma_bl_b', 23, dict(altura=9.0, r_base=0.17, r_topo=0.11, folhas=15, folha_comp=4.0, folha_larg=0.9)),
    ('palma_bl_c', 37, dict(altura=13.5, r_base=0.2, r_topo=0.12, folhas=19, folha_comp=4.8, folha_larg=1.0)),
]

if __name__ == '__main__':
    saida = sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith('--') else 'src/world/textures/veg_palmas.js'
    previa = sys.argv[sys.argv.index('--previa') + 1] if '--previa' in sys.argv else None
    tt, tf = textura_tronco(), textura_folha()
    if previa:
        tt.save(f'{previa}/tronco_palma.png')
        tf.save(f'{previa}/folha_palma.png')
    modelos, alturas = {}, {}
    for nome, sd, P in PARAMS:
        mt, mf = palmeira(sd, P)
        alt = max(v[2] for v in mt.V + mf.V)
        modelos[nome] = [parte_jogo(mt, 'tronco_palma', alt), parte_jogo(mf, 'folha_palma', alt)]
        lt, lf = palmeira(sd, P, lod=True)
        modelos[nome + '_lo'] = [parte_jogo(lt, 'tronco_palma', alt), parte_jogo(lf, 'folha_palma', alt)]
        alturas[nome] = round(alt, 2)
        print(f'{nome}: {len(mt.F)}+{len(mf.F)} tri (lod {len(lt.F)}+{len(lf.F)})  altura {alt:.1f} m')
    texs = {'tronco_palma': jpg_b64(tt), 'folha_palma': png_b64(tf)}
    with open(saida, 'w') as f:
        f.write('// Palmeiras da praia (tools/models/palmeiras.py). Não editar à mão.\n')
        f.write(f'export const VEG_PL_MODELOS = {json.dumps(modelos)};\n')
        f.write(f'export const VEG_PL_TEXTURAS = {json.dumps(texs)};\n')
        f.write(f'export const VEG_PL_ALTURA = {json.dumps(alturas)};\n')
    print('escrito', saida)
