#!/usr/bin/env python3
"""Árvores com folhagem de verdade (estilo ARK): em vez de bolas duras, copas feitas de
muitos cartões com textura de ramos/folhas, em tons diferentes por tufo.

  - copa_a/b/c   árvores grandes de mata (copa larga, tronco alto com raízes tabulares)
  - copa_g_a/b   gigantes (sumaúma): tronco enorme com sapopemas e copa em guarda-chuva
  - media_a/b    árvores médias do sub-bosque
  - pinheiro_nv_a/b/c  pinheiros/redwoods com neve; pinheiro_vd_a/b  sem neve

Só numpy + Pillow. Saída: src/world/textures/veg_copas.js (mesmo formato de
tools/models/palmeiras.py, com cor por vértice). O tronco usa a textura 'tronco_bl'
(casca do Blender) que já existe no jogo.

Uso: python3 tools/models/copas.py [saida.js] [--previa pasta]
"""
import json
import math
import random
import sys

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter

from palmeiras import Malha, jpg_b64, norm, parte_jogo, png_b64, vec

UP = vec(0, 0, 1)


# ================================================================ texturas
def curva(p0, p1, p2, n):
    out = []
    for i in range(n + 1):
        t = i / n
        out.append(((1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0],
                    (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1]))
    return out


def textura_folha_copa(seed=9):
    """Raminho com folhas ovais, nervuras e tons variados. Fundo transparente."""
    rng = random.Random(seed)
    S = 2
    W = H = 512 * S
    img = Image.new('RGBA', (W, H), (60, 110, 40, 0))
    d = ImageDraw.Draw(img)
    # galho: sobe de baixo, curvando um pouco
    haste = curva((W * 0.46, H * 0.99), (W * 0.40, H * 0.55), (W * 0.54, H * 0.06), 30)
    d.line(haste, fill=(70, 62, 40, 255), width=int(5 * S))

    def folha(base, ang, comp, larg, g):
        # eixo com leve curva para baixo
        c = [(base[0] + math.cos(ang) * comp * s + math.sin(ang) * comp * 0.12 * s * s,
              base[1] + math.sin(ang) * comp * s - math.cos(ang) * comp * 0.12 * s * s) for s in [i / 14 for i in range(15)]]
        a, b = [], []
        for i, (px, py) in enumerate(c):
            s = i / 14
            q = c[min(i + 1, 14)]
            r = c[max(i - 1, 0)]
            nx, ny = -(q[1] - r[1]), q[0] - r[0]
            ln = math.hypot(nx, ny) or 1
            nx, ny = nx / ln, ny / ln
            hw = larg * math.sin(math.pi * (0.04 + 0.94 * s ** 0.82)) ** 0.85
            a.append((px + nx * hw, py + ny * hw))
            b.append((px - nx * hw, py - ny * hw))
        cor = (int(34 + 46 * g), int(88 + 70 * g), int(26 + 26 * g), 255)
        claro = (min(255, cor[0] + 34), min(255, cor[1] + 34), min(255, cor[2] + 14), 255)
        d.polygon(a + b[::-1], fill=cor)
        # metade clara (brilho) e nervuras
        meio = [((x1 + x2) / 2, (y1 + y2) / 2) for (x1, y1), (x2, y2) in zip(a, b)]
        d.polygon([((x1 + mx) / 2 + (x1 - mx) * 0.0, (y1 + my) / 2) for (x1, y1), (mx, my) in zip(a, meio)] + meio[::-1], fill=(cor[0] + 8, cor[1] + 10, cor[2] + 3, 255))
        d.line(c, fill=claro, width=max(1, int(2.2 * S)))
        for k in range(2, 13, 2):
            (px, py), (x1, y1), (x2, y2) = c[k], a[k], b[k]
            d.line([(px, py), ((px + x1) / 2 + (x1 - px) * 0.3, (py + y1) / 2 + (y1 - py) * 0.3)], fill=claro, width=max(1, int(S)))
            d.line([(px, py), ((px + x2) / 2 + (x2 - px) * 0.3, (py + y2) / 2 + (y2 - py) * 0.3)], fill=claro, width=max(1, int(S)))
        d.line(a + [], fill=(cor[0] - 16, cor[1] - 22, cor[2] - 8, 255), width=max(1, int(S)))
        d.line(b + [], fill=(cor[0] - 16, cor[1] - 22, cor[2] - 8, 255), width=max(1, int(S)))

    n = 12
    for i in range(n):
        t = 0.10 + 0.82 * i / (n - 1)
        px, py = haste[min(len(haste) - 1, int(t * (len(haste) - 1)))]
        env = 1.0 - 0.55 * t
        lado = 1 if i % 2 else -1
        ang = -math.pi / 2 + lado * math.radians(rng.uniform(48, 66))
        comp = W * 0.34 * env * rng.uniform(0.86, 1.1)
        folha((px, py), ang, comp, comp * 0.24, rng.random())
    # folha da ponta
    folha(haste[-1], -math.pi / 2 + 0.08, W * 0.24, W * 0.065, rng.random())
    return img.resize((512, 512), Image.LANCZOS)


def _ramo(seed, neve):
    """Ramo de conífera visto de cima: eixo na horizontal, raminhos para os dois lados
    apontando para a ponta (direita), todos cobertos de agulhas."""
    rng = random.Random(seed)
    S = 2
    W, H = 1024 * S // 2, 512 * S // 2   # 1024x512 no total (S=2 aplicado abaixo)
    W, H = 1024, 512
    img = Image.new('RGBA', (W, H), (40, 90, 48, 0))
    d = ImageDraw.Draw(img)
    cy = H / 2
    n = 23
    eixo = [(W * 0.01 + W * 0.93 * i / 60, cy + math.sin(i / 60 * 5) * H * 0.012 + (i / 60) ** 2 * H * 0.03) for i in range(61)]
    d.line(eixo, fill=(66, 52, 36, 255), width=7)

    def agulhas(pts, ang, comp_ag, dens):
        """Agulhas ao longo de um raminho, abrindo para frente dos dois lados."""
        for i in range(len(pts) - 1):
            (x0, y0), (x1, y1) = pts[i], pts[i + 1]
            seg = math.hypot(x1 - x0, y1 - y0)
            k = max(1, int(seg / dens))
            for j in range(k):
                t = (j + rng.random() * 0.8) / k
                px, py = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
                dirang = math.atan2(y1 - y0, x1 - x0)
                for lado in (-1, 1):
                    a = dirang + lado * math.radians(rng.uniform(38, 62))
                    L = comp_ag * rng.uniform(0.7, 1.15)
                    g = rng.uniform(0, 1)
                    cor = (int(24 + 30 * g), int(66 + 52 * g), int(38 + 22 * g), 255)
                    d.line([(px, py), (px + math.cos(a) * L, py + math.sin(a) * L)], fill=cor, width=2)

    for lado in (-1, 1):
        for k in range(n):
            t = 0.03 + 0.94 * (k + rng.uniform(-0.3, 0.3)) / n
            ex, ey = eixo[min(60, int(t * 60))]
            env = math.sin(math.pi * (0.08 + 0.9 * t)) ** 0.7
            L = H * 0.44 * (0.32 + 0.68 * env) * rng.uniform(0.85, 1.1)
            a = math.radians(rng.uniform(46, 62) - 14 * t) * lado
            dx, dy = math.cos(a), math.sin(a)
            # raminho levemente curvo, apontando para a ponta
            pts = [(ex + dx * L * s + 0.0, ey + dy * L * s + L * 0.12 * s * s * (1 if lado > 0 else -1) * -0.0) for s in [i / 8 for i in range(9)]]
            pts = [(x + (L * 0.35 * (s / 8) ** 1.5), y) for s, (x, y) in enumerate(pts)]   # puxa para a direita
            d.line(pts, fill=(60, 50, 36, 255), width=3)
            agulhas(pts, a, 20 + 8 * env, 10)
            # raminho de segunda ordem perto da ponta
            if rng.random() < 0.7:
                mid = pts[5]
                a2 = a + math.radians(rng.uniform(-30, 30))
                p2 = [(mid[0] + math.cos(a2) * L * 0.3 * s + L * 0.2 * s, mid[1] + math.sin(a2) * L * 0.3 * s) for s in [i / 4 for i in range(5)]]
                agulhas(p2, a2, 15, 11)
    agulhas(eixo, 0, 18, 10)
    if neve:
        # neve: tufos brancos sobre onde há agulhas (máscara = alfa engrossado)
        alfa = img.getchannel('A').filter(ImageFilter.MaxFilter(5))
        sn = Image.new('L', (W, H), 0)
        ds = ImageDraw.Draw(sn)
        for _ in range(520):
            x, y = rng.uniform(0, W * 0.97), rng.uniform(H * 0.05, H * 0.95)
            r = rng.uniform(3, 7)
            ds.ellipse((x - r * 1.9, y - r * 0.8, x + r * 1.9, y + r * 0.8), fill=255)
        sn = ImageChops.multiply(sn.filter(ImageFilter.GaussianBlur(1.2)), alfa)
        branco = Image.new('RGBA', (W, H), (238, 245, 252, 255))
        # mantém um pouco de verde por baixo: só 80% da máscara vira neve
        img.paste(branco, (0, 0), sn.point(lambda v: int(v * 0.62)))
    return img


def textura_ramo_pinho(seed=4):
    return _ramo(seed, False)


def textura_ramo_neve(seed=4):
    return _ramo(seed, True)


# ================================================================ geometria base
def cresce(rng, origem, direcao, comp, r0, r1, jit, foto=0.0, grav=0.0, passo=0.7):
    n = max(3, int(comp / passo))
    p = origem.copy()
    d = norm(direcao)
    pts, raios = [p.copy()], [r0]
    for i in range(1, n + 1):
        t = i / n
        ruido = vec(rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(-1, 1))
        d = norm(d + ruido * jit + UP * foto - UP * grav * t)
        p = p + d * (comp / n)
        pts.append(p.copy())
        raios.append(r0 + (r1 - r0) * (t ** 0.8))
    return pts, raios


def ponto_em(pts, raios, t):
    n = len(pts) - 1
    x = max(0.0, min(1.0, t)) * n
    i = min(int(x), n - 1)
    f = x - i
    p = pts[i] * (1 - f) + pts[i + 1] * f
    d = norm(pts[i + 1] - pts[i])
    r = raios[i] * (1 - f) + raios[i + 1] * f
    return p, d, r


def tubo(M, pts, raios, lados, vtile=2.6, comp_u=1.3, off=0.0):
    """Tubo com UV de casca: u dá voltas inteiras (sem emenda), v segue o comprimento."""
    urep = max(1, round(math.tau * max(raios[0], 0.03) / comp_u))
    n = len(pts)
    N = norm(np.cross(norm(pts[min(1, n - 1)] - pts[0]), vec(1, 0, 0)))
    if np.linalg.norm(N) < 1e-3:
        N = vec(0, 1, 0)
    s = 0.0
    filas = []
    prevT = norm(pts[1] - pts[0])
    for i in range(n):
        T = norm(pts[min(n - 1, i + 1)] - pts[max(0, i - 1)])
        # transporte paralelo do vetor normal
        v = np.cross(prevT, T)
        if np.linalg.norm(v) > 1e-6:
            ang = math.asin(min(1.0, np.linalg.norm(v)))
            k = norm(v)
            N = N * math.cos(ang) + np.cross(k, N) * math.sin(ang) + k * np.dot(k, N) * (1 - math.cos(ang))
        prevT = T
        B = norm(np.cross(T, N))
        if i:
            s += np.linalg.norm(pts[i] - pts[i - 1])
        fila = []
        for j in range(lados + 1):
            a = j / lados * math.tau
            fila.append(M.add(pts[i] + (N * math.cos(a) + B * math.sin(a)) * raios[i], (j / lados * urep + off, s / vtile)))
        filas.append(fila)
    for i in range(n - 1):
        for j in range(lados):
            a, b = filas[i][j], filas[i][j + 1]
            c, d = filas[i + 1][j], filas[i + 1][j + 1]
            M.tri(a, c, b)
            M.tri(b, c, d)


def cartao(M, C, pos, t1, t2, h, cor, flip=False, hv=None):
    """Quadrado de folhagem com a textura inteira; cor por vértice."""
    hv = h if hv is None else hv
    base = len(M.V)
    for a, b in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
        M.add(pos + t1 * a * h + t2 * b * hv, ((1.0 if ((a > 0) != flip) else 0.0), 1.0 if b > 0 else 0.0))
        C.append(cor)
    M.tri(base, base + 1, base + 2)
    M.tri(base, base + 2, base + 3)


def tom_conifera(rng):
    k = rng.uniform(0.82, 1.08)
    return (k, k, k)


def tom(rng, claro, base_variacao=0.14):
    """Cor por tufo: quase sempre verde, às vezes amarelado ou mais escuro."""
    k = 1.0 + rng.uniform(-base_variacao, base_variacao)
    r = rng.random()
    if r < 0.14:
        return (min(1.0, 1.18 * k), min(1.0, 1.08 * k), 0.62 * k)      # amarelado
    if r < 0.34:
        return (0.78 * k, 0.9 * k, 0.8 * k)                            # mais escuro
    return (k * claro[0], k * claro[1], k * claro[2])


# ================================================================ árvores de folha larga
def gera_copa(seed, P, lod=False):
    rng = random.Random(seed)
    mt, mf, cf = Malha(), Malha(), []
    H = P['altura']
    lean = vec(rng.uniform(-0.1, 0.1), rng.uniform(-0.1, 0.1), 1.0)
    pts, raios = cresce(rng, vec(0, 0, 0), lean, H, P['r_base'], P['r_topo'], 0.04, 0.0, 0.0, passo=0.9)
    for i, p in enumerate(pts):
        raios[i] *= 1.0 + P['flare'] * math.exp(-p[2] / P['flare_z'])
    lados = 5 if lod else 10
    tubo(mt, pts[::3] + ([pts[-1]] if (len(pts) - 1) % 3 else []) if lod else pts,
         raios[::3] + ([raios[-1]] if (len(raios) - 1) % 3 else []) if lod else raios, lados)
    # sapopemas (raízes tabulares)
    for k in range(P['raizes'] if not lod else 0):
        a = k / P['raizes'] * math.tau + rng.uniform(-0.3, 0.3)
        d0 = vec(math.cos(a) * 0.95, math.sin(a) * 0.95, 0.3)
        rp, rr = cresce(rng, vec(math.cos(a) * 0.1, math.sin(a) * 0.1, P['raiz_z']), d0, rng.uniform(2.4, 3.6) * P['raiz_esc'],
                        P['r_base'] * 0.55, 0.06, 0.05, 0.0, 0.9, passo=0.5)
        tubo(mt, rp, rr, 5)
    centro = vec(0, 0, H * (P['galho_ini'] + P['galho_fim']) / 2 * 1.05)
    pontas = []
    a0 = rng.uniform(0, math.tau)
    for k in range(P['galhos']):
        t = P['galho_ini'] + (P['galho_fim'] - P['galho_ini']) * (k / max(1, P['galhos'] - 1))
        pos, _, r = ponto_em(pts, raios, t)
        a = a0 + k * 2.399963 + rng.uniform(-0.25, 0.25)
        f = (t - P['galho_ini']) / (P['galho_fim'] - P['galho_ini'] + 1e-6)
        incl = math.radians(rng.uniform(55, 80) - P['galho_sobe'] * f)
        comp = P['galho_comp'] * rng.uniform(0.8, 1.15) * (1.15 - 0.5 * f)
        dirv = vec(math.sin(incl) * math.cos(a), math.sin(incl) * math.sin(a), math.cos(incl))
        gp, gr = cresce(rng, pos, dirv, comp, r * 0.5, 0.06, 0.07, 0.03, 0.0, passo=1.0)
        gr[-1] = 0.012
        tubo(mt, gp if not lod else [gp[0], gp[-1]], gr if not lod else [gr[0], gr[-1]], 6 if not lod else 3)
        pontas.append((gp[-1], 1.0))
        for j in range(rng.randint(*P['sub'])):
            tt = 0.3 + 0.62 * (j + rng.random() * 0.6) / P['sub'][1]
            p2, d2, r2 = ponto_em(gp, gr, tt)
            eixo = norm(np.cross(d2, UP)) * rng.choice((-1, 1))
            dir2 = norm(d2 * 0.55 + eixo * 0.75 + UP * rng.uniform(0.0, 0.5))
            sp, sr = cresce(rng, p2, dir2, comp * rng.uniform(0.32, 0.5), r2 * 0.55, 0.012, 0.09, 0.04, 0.0, passo=0.8)
            if not lod:
                sr[-1] = 0.008
                tubo(mt, sp, sr, 5)
            pontas.append((sp[-1], 0.9))
            pontas.append((ponto_em(sp, sr, 0.55)[0], 0.7))
        pontas.append((ponto_em(gp, gr, 0.62)[0], 0.7))
    # tufos de folhas nas pontas
    tam = P['cartao']
    for pos, peso in pontas:
        if lod and rng.random() > 0.42:
            continue
        cor = tom(rng, P['cor'])
        n = (P['cartoes'] if not lod else 2)
        for _ in range(n):
            off = vec(rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(-0.55, 0.8)) * tam * 0.55 * peso
            q = pos + off
            fora = norm(norm(q - centro) * 0.7 + vec(rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(-0.2, 1)) * 0.65 + UP * 0.2)
            t1 = np.cross(fora, vec(rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(-1, 1)))
            if np.linalg.norm(t1) < 1e-3:
                t1 = vec(1, 0, 0)
            t1 = norm(t1)
            t2 = norm(np.cross(fora, t1))
            h = tam * rng.uniform(0.75, 1.2) * (2.1 if lod else 1.0) / 2
            c = tuple(np.clip(np.array(cor) * rng.uniform(0.94, 1.06), 0, 1.25))
            cartao(mf, cf, q, t1, t2, h, c, rng.random() < 0.5)
    return mt, mf, cf


# ================================================================ coníferas
def gera_conifera(seed, P, lod=False):
    rng = random.Random(seed)
    mt, mf, cf = Malha(), Malha(), []
    H = P['altura']
    lean = vec(rng.uniform(-0.03, 0.03), rng.uniform(-0.03, 0.03), 1.0)
    pts, raios = cresce(rng, vec(0, 0, 0), lean, H, P['r_base'], 0.07, 0.012, 0.0, 0.0, passo=1.2)
    for i, p in enumerate(pts):
        raios[i] *= 1.0 + 0.9 * math.exp(-p[2] / 0.9)
    tubo(mt, pts[::3] + ([pts[-1]] if (len(pts) - 1) % 3 else []) if lod else pts,
         raios[::3] + ([raios[-1]] if (len(raios) - 1) % 3 else []) if lod else raios, 5 if lod else 9)
    z0 = H * P['base_copa']
    z = z0
    k = 0
    a0 = rng.uniform(0, math.tau)
    while z < H * 0.985:
        f = (z - z0) / (H - z0)
        por_volta = 3 if f < 0.6 else 2
        for q in range(por_volta):
            if lod and (k % 3):
                k += 1
                continue
            a = a0 + k * 2.399963 + rng.uniform(-0.15, 0.15)
            k += 1
            comp = (P['galho'] * (1 - f) ** 0.9 + 0.55) * rng.uniform(0.82, 1.15)
            elev = math.radians(P['queda'] - (P['queda'] + P['sobe']) * f + rng.uniform(-6, 6))
            dh = vec(math.cos(a), math.sin(a), 0)
            pos, _, _ = ponto_em(pts, raios, z / H)
            segs = 1 if lod else 3
            # eixo do ramo: sai quase horizontal, cai com o peso e a ponta volta a subir
            ramo = []
            for i in range(segs + 1):
                s = i / segs
                dz = math.sin(elev) * comp * s - 0.18 * comp * s * s + 0.2 * comp * s ** 3
                ramo.append(pos + dh * math.cos(elev) * comp * s + UP * dz)
            if not lod and comp > 1.6:
                tubo(mt, [ramo[0], ramo[-1]], [0.05, 0.015], 3)
            lado = norm(np.cross(dh, UP))
            largura = comp * P['largura'] * 0.72 + 0.2
            rolos = (0.0,) if lod else (rng.uniform(-0.25, 0.25), 0.9 + rng.uniform(-0.2, 0.2), -0.9 + rng.uniform(-0.2, 0.2))
            for rolo in rolos:
                cor = tom_conifera(rng)
                cols = []
                # cartão em tira ao longo do ramo, dobrado em V (o meio mais alto)
                nrows = len(ramo)
                base = len(mf.V)
                eixo_l = lado * math.cos(rolo) + UP * math.sin(rolo)
                for i, p in enumerate(ramo):
                    s = i / (nrows - 1)
                    w = largura * (0.35 + 0.65 * math.sin(math.pi * min(1.0, s * 0.9 + 0.08)) ** 0.7)
                    for u, sgn in ((0.0, -1), (0.5, 0), (1.0, 1)):
                        v_ = p + eixo_l * sgn * w * 0.5 - UP * (0.0 if sgn == 0 else 0.1 * w)
                        mf.add(v_, (s, u))
                        cf.append(cor)
                for i in range(nrows - 1):
                    for c_ in range(2):
                        a_ = base + i * 3 + c_
                        b_ = base + (i + 1) * 3 + c_
                        mf.tri(a_, b_, a_ + 1)
                        mf.tri(a_ + 1, b_, b_ + 1)
        z += P['espaco'] * rng.uniform(0.8, 1.2) * (1.0 + 0.4 * f)
    # ponta (flecha)
    topo = pts[-1]
    for k2 in range(2 if lod else 4):
        a = k2 * math.pi / 2 + rng.uniform(0, 0.4)
        dh = vec(math.cos(a), math.sin(a), 0)
        ramo = [topo - UP * 1.2 + dh * 0.05, topo + dh * 0.15 + UP * 0.9]
        lado = norm(np.cross(dh, UP))
        cor = (1.0, 1.0, 1.0)
        base = len(mf.V)
        for i, p in enumerate(ramo):
            w = 0.9 * (1 - i * 0.8)
            for u, sgn in ((0.0, -1), (0.5, 0), (1.0, 1)):
                mf.add(p + lado * sgn * w * 0.5, (i, u))
                cf.append(cor)
        for c_ in range(2):
            mf.tri(base + c_, base + 3 + c_, base + c_ + 1)
            mf.tri(base + c_ + 1, base + 3 + c_, base + 3 + c_ + 1)
    return mt, mf, cf


# ================================================================ lista de modelos
COPAS = [
    # nome, semente, parâmetros
    ('copa_a', 101, dict(altura=26, r_base=0.62, r_topo=0.17, flare=1.2, flare_z=1.3, raizes=6, raiz_z=0.5, raiz_esc=1.0,
                         galhos=11, galho_ini=0.40, galho_fim=0.92, galho_comp=10.5, galho_sobe=18, sub=(3, 5),
                         cartao=3.1, cartoes=7, cor=(0.95, 1.0, 0.9))),
    ('copa_b', 211, dict(altura=32, r_base=0.7, r_topo=0.18, flare=1.3, flare_z=1.5, raizes=7, raiz_z=0.55, raiz_esc=1.1,
                         galhos=12, galho_ini=0.5, galho_fim=0.94, galho_comp=9.5, galho_sobe=22, sub=(3, 5),
                         cartao=3.3, cartoes=7, cor=(0.9, 1.0, 0.86))),
    ('copa_c', 331, dict(altura=22, r_base=0.55, r_topo=0.17, flare=1.0, flare_z=1.2, raizes=5, raiz_z=0.45, raiz_esc=0.9,
                         galhos=10, galho_ini=0.34, galho_fim=0.9, galho_comp=9.0, galho_sobe=14, sub=(3, 5),
                         cartao=3.0, cartoes=7, cor=(1.0, 1.02, 0.9))),
    ('copa_g_a', 401, dict(altura=40, r_base=1.5, r_topo=0.38, flare=1.6, flare_z=3.2, raizes=8, raiz_z=1.4, raiz_esc=2.3,
                           galhos=12, galho_ini=0.62, galho_fim=0.96, galho_comp=13.5, galho_sobe=30, sub=(3, 5),
                           cartao=4.0, cartoes=8, cor=(0.88, 1.0, 0.84))),
    ('copa_g_b', 503, dict(altura=36, r_base=1.4, r_topo=0.36, flare=1.5, flare_z=3.0, raizes=7, raiz_z=1.3, raiz_esc=2.1,
                           galhos=12, galho_ini=0.58, galho_fim=0.95, galho_comp=12.5, galho_sobe=26, sub=(3, 5),
                           cartao=3.8, cartoes=8, cor=(0.92, 1.0, 0.86))),
    ('media_a', 601, dict(altura=11, r_base=0.3, r_topo=0.1, flare=0.8, flare_z=0.8, raizes=3, raiz_z=0.3, raiz_esc=0.5,
                          galhos=7, galho_ini=0.35, galho_fim=0.92, galho_comp=4.6, galho_sobe=14, sub=(2, 4),
                          cartao=2.0, cartoes=7, cor=(1.0, 1.04, 0.92))),
    ('media_b', 709, dict(altura=14, r_base=0.34, r_topo=0.1, flare=0.8, flare_z=0.9, raizes=3, raiz_z=0.3, raiz_esc=0.5,
                          galhos=8, galho_ini=0.42, galho_fim=0.94, galho_comp=5.2, galho_sobe=16, sub=(2, 4),
                          cartao=2.2, cartoes=7, cor=(0.96, 1.02, 0.9))),
]
PINHEIROS = [
    ('pinheiro_nv_a', 11, True, dict(altura=22, r_base=0.5, base_copa=0.14, galho=7.0, largura=0.72, queda=16, sobe=40, espaco=0.62)),
    ('pinheiro_nv_b', 23, True, dict(altura=27, r_base=0.58, base_copa=0.16, galho=8.2, largura=0.7, queda=20, sobe=45, espaco=0.66)),
    ('pinheiro_nv_c', 37, True, dict(altura=18, r_base=0.42, base_copa=0.12, galho=6.0, largura=0.74, queda=14, sobe=38, espaco=0.58)),
    ('pinheiro_vd_a', 53, False, dict(altura=24, r_base=0.5, base_copa=0.15, galho=7.2, largura=0.7, queda=14, sobe=42, espaco=0.64)),
    ('pinheiro_vd_b', 67, False, dict(altura=19, r_base=0.42, base_copa=0.12, galho=6.2, largura=0.72, queda=12, sobe=38, espaco=0.58)),
]

if __name__ == '__main__':
    saida = sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith('--') else 'src/world/textures/veg_copas.js'
    previa = sys.argv[sys.argv.index('--previa') + 1] if '--previa' in sys.argv else None
    tf, tn, tp = textura_folha_copa(), textura_ramo_neve(), textura_ramo_pinho()
    if previa:
        for nome, im in (('folha_copa', tf), ('ramo_neve', tn), ('ramo_pinho', tp)):
            fundo = Image.new('RGBA', im.size, (150, 190, 230, 255))
            fundo.alpha_composite(im)
            fundo.convert('RGB').save(f'{previa}/{nome}.png')
    modelos, alturas = {}, {}
    for nome, sd, P in COPAS:
        mt, mf, cf = gera_copa(sd, P)
        alt = max(v[2] for v in mt.V + mf.V)
        modelos[nome] = [parte_jogo(mt, 'tronco_bl', alt), parte_jogo(mf, 'folha_copa', alt, cf)]
        lt, lf, lc = gera_copa(sd, P, lod=True)
        modelos[nome + '_lo'] = [parte_jogo(lt, 'tronco_bl', alt), parte_jogo(lf, 'folha_copa', alt, lc)]
        alturas[nome] = round(alt, 2)
        print(f'{nome}: tronco {len(mt.F)} + folhas {len(mf.F)} tri (lod {len(lt.F)}+{len(lf.F)})  altura {alt:.1f} m')
    for nome, sd, neve, P in PINHEIROS:
        tex = 'ramo_neve' if neve else 'ramo_pinho'
        mt, mf, cf = gera_conifera(sd, P)
        alt = max(v[2] for v in mt.V + mf.V)
        modelos[nome] = [parte_jogo(mt, 'tronco_bl', alt), parte_jogo(mf, tex, alt, cf)]
        lt, lf, lc = gera_conifera(sd, P, lod=True)
        modelos[nome + '_lo'] = [parte_jogo(lt, 'tronco_bl', alt), parte_jogo(lf, tex, alt, lc)]
        alturas[nome] = round(alt, 2)
        print(f'{nome}: tronco {len(mt.F)} + folhas {len(mf.F)} tri (lod {len(lt.F)}+{len(lf.F)})  altura {alt:.1f} m')
    texs = {'folha_copa': png_b64(tf), 'ramo_neve': png_b64(tn), 'ramo_pinho': png_b64(tp)}
    with open(saida, 'w') as f:
        f.write('// Copas e coníferas com folhagem em cartões (tools/models/copas.py). Não editar à mão.\n')
        f.write(f'export const VEG_CP_MODELOS = {json.dumps(modelos)};\n')
        f.write(f'export const VEG_CP_TEXTURAS = {json.dumps(texs)};\n')
        f.write(f'export const VEG_CP_ALTURA = {json.dumps(alturas)};\n')
    print('escrito', saida)
