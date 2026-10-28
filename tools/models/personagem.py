#!/usr/bin/env python3
"""Personagem musculoso (estilo ARK): corpo todo esculpido por código, só com numpy + Pillow.

Cada parte é um "tubo" de seções elípticas (raio por altura) com relevos de músculo somados ao
raio: peitoral, abdômen em gomos, costas largas (dorsais), trapézio, ombros, bíceps, tríceps,
antebraço, coxa (quadríceps), panturrilha, glúteos, rosto (testa, nariz, maçãs, queixo).
Cor por vértice (pele sombreada nas dobras, bermuda de pano, cinto de corda, cabelo, barba)
multiplicada por uma textura de pele gerada aqui (poros, sardas, sujeira, arranhões).

Também gera o braço da primeira pessoa: antebraço grosso, punho fechado com nós dos dedos e
polegar por cima, e a pulseira com a gema verde (como a do ARK).

Saída: src/player/skin_data.js no MESMO formato de antes (SKIN_PARTES com pivot, SKIN_TEXTURA),
mais colunas 'col' (cor por vértice) e 'nrm' (normais) e a peça FP_BRACO.

Uso: python3 tools/models/personagem.py [saida.js] [--previa pasta]
"""
import base64
import io
import json
import math
import random
import sys

import numpy as np
from PIL import Image

PI = math.pi
TAU = 2 * math.pi


# ---------------------------------------------------------------- utilidades
def angd(a, b):
    return (a - b + PI) % TAU - PI


def relevo(specs):
    """specs: lista de (theta0, s0, w_theta, w_s, amplitude). Devolve f(theta[], s) -> soma."""
    def f(theta, s):
        out = np.zeros_like(theta, dtype=float)
        for th0, s0, wth, ws, amp in specs:
            out += amp * np.exp(-(angd(theta, th0) / wth) ** 2 - ((s - s0) / ws) ** 2)
        return out
    return f


def interp(tab, s):
    xs = [t[0] for t in tab]
    return [float(np.interp(s, xs, [t[k] for t in tab])) for k in range(1, len(tab[0]))]


class Malha:
    def __init__(self):
        self.V, self.U, self.C, self.F = [], [], [], []

    def n(self):
        return len(self.V)

    def add_tri(self, a, b, c):
        self.F.append((a, b, c))

    def mirror_x(self):
        self.V = [(-v[0], v[1], v[2]) for v in self.V]
        self.F = [(a, c, b) for a, b, c in self.F]

    def move(self, d):
        self.V = [(v[0] + d[0], v[1] + d[1], v[2] + d[2]) for v in self.V]

    def add(self, o):
        base = self.n()
        self.V += o.V
        self.U += o.U
        self.C += o.C
        self.F += [(a + base, b + base, c + base) for a, b, c in o.F]


PELE = np.array([1.0, 1.0, 1.0])


def tubo(est, lados, bump=None, cor=None, utiles=None, vtile=0.5, cap0=True, cap1=True):
    """est: lista de (centro, S, F, rx, rz, s). theta=0 aponta para S e theta=pi/2 para F."""
    m = Malha()
    th = np.linspace(0, TAU, lados + 1)
    cs = [np.array(e[0], float) for e in est]
    circ = max(2 * PI * (est[len(est) // 2][3] + est[len(est) // 2][4]) / 2, 0.05)
    ut = utiles if utiles else max(1, round(circ / 0.5))
    aneis = []
    for (c, S, F, rx, rz, s) in est:
        c = np.array(c, float)
        S = np.array(S, float)
        F = np.array(F, float)
        b = bump(th, s) if bump else np.zeros_like(th)
        fac = (1.0 + b)[:, None]
        pts = c + (np.cos(th)[:, None] * S * rx + np.sin(th)[:, None] * F * rz) * fac
        col = cor(th, s, b, pts) if cor else np.ones((len(th), 3)) * np.clip(1 + 2.2 * b[:, None], 0.55, 1.3)
        ring = []
        for j in range(lados + 1):
            ring.append(m.n())
            m.V.append(tuple(pts[j]))
            m.U.append((j / lados * ut, s / vtile))
            m.C.append(tuple(col[j]))
        aneis.append(ring)
    for i in range(len(est) - 1):
        for j in range(lados):
            a, b_ = aneis[i][j], aneis[i][j + 1]
            c, d = aneis[i + 1][j], aneis[i + 1][j + 1]
            m.add_tri(a, c, b_)
            m.add_tri(b_, c, d)
    for cap, idx, ok in ((0, 0, cap0), (1, len(est) - 1, cap1)):
        if not ok:
            continue
        ctr = m.n()
        m.V.append(tuple(cs[idx]))
        m.U.append((0.5, est[idx][5] / vtile))
        m.C.append(tuple(m.C[aneis[idx][0]]))
        for j in range(lados):
            a, b_ = aneis[idx][j], aneis[idx][j + 1]
            m.add_tri(ctr, b_, a) if cap == 0 else m.add_tri(ctr, a, b_)
    # orientação: normais para fora (testa contra o eixo)
    eixo = np.mean(cs, axis=0)
    soma = 0.0
    P = np.array(m.V)
    for a, b_, c in m.F:
        n = np.cross(P[b_] - P[a], P[c] - P[a])
        soma += float(np.dot(n, (P[a] + P[b_] + P[c]) / 3 - eixo))
    if soma < 0:
        m.F = [(a, c, b_) for a, b_, c in m.F]
    return m


def elipsoide(c, r, cor, lados=14, aneis=9, escala=(1, 1, 1)):
    m = Malha()
    idx = []
    for i in range(aneis + 1):
        a = PI * i / aneis
        ring = []
        for j in range(lados + 1):
            b = TAU * j / lados
            p = (c[0] + r * escala[0] * math.sin(a) * math.cos(b), c[1] + r * escala[1] * math.cos(a), c[2] + r * escala[2] * math.sin(a) * math.sin(b))
            ring.append(m.n())
            m.V.append(p)
            m.U.append((j / lados, i / aneis))
            m.C.append(tuple(cor))
        idx.append(ring)
    for i in range(aneis):
        for j in range(lados):
            a, b_ = idx[i][j], idx[i][j + 1]
            c_, d = idx[i + 1][j], idx[i + 1][j + 1]
            m.add_tri(a, b_, c_)
            m.add_tri(b_, d, c_)
    return m


def cano(pontos, raios, lados, cor, vtile=0.3):
    """Tubo por uma linha de pontos qualquer (dedos, polegar)."""
    est = []
    s = 0.0
    P = [np.array(p, float) for p in pontos]
    for i, p in enumerate(P):
        if i:
            s += np.linalg.norm(p - P[i - 1])
        t = P[min(i + 1, len(P) - 1)] - P[max(i - 1, 0)]
        t = t / (np.linalg.norm(t) + 1e-9)
        ref = np.array([0.0, 1.0, 0.0]) if abs(t[1]) < 0.9 else np.array([1.0, 0.0, 0.0])
        S = np.cross(t, ref)
        S /= np.linalg.norm(S) + 1e-9
        F = np.cross(S, t)
        est.append((p, S, F, raios[i], raios[i], s))
    return tubo(est, lados, None, lambda th, s_, b, pts: np.ones((len(th), 3)) * np.array(cor), utiles=1, vtile=vtile)


# ---------------------------------------------------------------- cores
SKIN_C = np.array([1.0, 1.0, 1.0])
PANO = np.array([0.34, 0.26, 0.18])       # pano da bermuda (sujo)
CORDA = np.array([0.62, 0.5, 0.3])
CABELO = np.array([0.17, 0.12, 0.085])
BARBA = np.array([0.72, 0.62, 0.55])
OUTRO = np.array([0.16, 0.15, 0.16])


def sombra(b):
    return np.clip(1 + 3.4 * b[:, None], 0.42, 1.3)


# ---------------------------------------------------------------- tronco
TRONCO = [  # y, rx, rz
    (0.80, 0.06, 0.06), (0.83, 0.12, 0.09), (0.87, 0.165, 0.118), (0.94, 0.176, 0.124), (1.02, 0.16, 0.113), (1.10, 0.152, 0.106),
    (1.18, 0.174, 0.116), (1.26, 0.22, 0.132), (1.32, 0.246, 0.142), (1.38, 0.258, 0.138),
    (1.43, 0.225, 0.12), (1.47, 0.16, 0.105), (1.51, 0.105, 0.092), (1.545, 0.088, 0.084), (1.585, 0.075, 0.074),
]
f = PI / 2
b_ = 3 * PI / 2
BUMP_TRONCO = relevo(
    [(f + sg * 0.64, 1.315, 0.46, 0.075, 0.24) for sg in (-1, 1)]            # peitorais
    + [(f, 1.30, 0.08, 0.14, -0.16), (f, 1.42, 0.5, 0.05, 0.05)]            # sulco do peito e clavícula
    + [(f + sg * 0.19, y, 0.17, 0.034, 0.13) for sg in (-1, 1) for y in (1.205, 1.125, 1.05)]  # gomos
    + [(f, 1.11, 0.06, 0.14, -0.1)]                                         # linha do abdômen
    + [(f + sg * 1.05, 1.15, 0.35, 0.1, 0.07) for sg in (-1, 1)]             # oblíquos
    + [(b_ + sg * 0.85, 1.28, 0.55, 0.12, 0.26) for sg in (-1, 1)]           # dorsais
    + [(b_ + sg * 0.4, 1.46, 0.55, 0.075, 0.28) for sg in (-1, 1)]            # trapézio
    + [(b_, 1.22, 0.07, 0.3, -0.05)]                                         # coluna
    + [(b_ + sg * 0.75, 1.36, 0.3, 0.06, 0.07) for sg in (-1, 1)]            # omoplatas
    + [(b_ + sg * 0.5, 0.88, 0.45, 0.085, 0.15) for sg in (-1, 1)]           # glúteos
    + [(f + sg * 1.0, 1.43, 0.7, 0.05, 0.08) for sg in (-1, 1)]              # ombros (união)
)


def cor_tronco(th, y, b, pts):
    base = sombra(b) * np.ones((len(th), 3))
    if y < 1.0:
        base = base * 0 + PANO * (0.9 + 0.25 * np.abs(np.sin(th * 7 + y * 40)))[:, None] * np.clip(1 + 1.6 * b[:, None], 0.7, 1.2)
    elif y < 1.045:
        base = base * 0 + CORDA * (0.85 + 0.3 * np.abs(np.sin(th * 11)))[:, None]
    return base


def tronco():
    est = [((0, y, 0), (1, 0, 0), (0, 0, -1), rx, rz, y) for y, rx, rz in TRONCO]
    # estações extras para o relevo (mais anéis)
    ys = np.linspace(TRONCO[0][0], TRONCO[-1][0], 46)
    ests = []
    for y in ys:
        rx, rz = interp([(a, b, c) for a, b, c in TRONCO], y)
        ests.append(((0, y, 0), (1, 0, 0), (0, 0, -1), rx, rz, float(y)))
    return tubo(ests, 40, BUMP_TRONCO, cor_tronco, vtile=0.6)


# ---------------------------------------------------------------- braço
BRACO = [  # s, rx, rz  (s = distância descendo do ombro; negativo = topo do ombro, arredondado)
    (-0.07, 0.022, 0.022), (-0.05, 0.05, 0.05), (-0.02, 0.082, 0.08), (0.00, 0.092, 0.088), (0.03, 0.098, 0.093),
    (0.08, 0.095, 0.09), (0.14, 0.087, 0.083), (0.20, 0.084, 0.08),
    (0.26, 0.065, 0.062), (0.30, 0.057, 0.056), (0.34, 0.067, 0.063), (0.40, 0.064, 0.059),
    (0.48, 0.048, 0.042), (0.54, 0.036, 0.031), (0.56, 0.034, 0.029),
]
BUMP_BRACO = relevo([
    (0.0, 0.05, 1.5, 0.075, 0.13), (f * 0.5, 0.06, 1.0, 0.06, 0.07), (b_ + 0.5, 0.06, 1.0, 0.06, 0.06),  # deltoide
    (f + 0.2, 0.19, 0.8, 0.075, 0.21), (f - 0.4, 0.16, 0.5, 0.06, 0.09),                                    # bíceps
    (b_, 0.16, 0.95, 0.095, 0.2), (b_ + 0.65, 0.14, 0.4, 0.08, 0.07), (b_ - 0.65, 0.14, 0.4, 0.08, 0.07),   # tríceps
    (f - 0.95, 0.37, 0.6, 0.06, 0.15), (f + 0.75, 0.37, 0.6, 0.07, 0.1),                                    # antebraço
    (b_ - 0.3, 0.41, 0.8, 0.08, 0.09), (f, 0.52, 0.5, 0.05, -0.03),
])


def veias(th, s):
    """Veias saltadas: linhas finas que correm pelo antebraço e bíceps (valor 0..1)."""
    out = np.zeros_like(th)
    for k, (t0, a, w) in enumerate(((f - 0.55, 0.25, 0.1), (f + 0.2, 0.2, 0.09), (f - 1.15, 0.3, 0.09), (b_ - 0.5, 0.3, 0.09))):
        th_c = t0 + a * np.sin(s * (9 + k * 3) + k)
        out += np.exp(-(angd(th, th_c) / w) ** 2)
    return np.clip(out, 0, 1) * (np.exp(-((s - 0.38) / 0.17) ** 2) + 0.6 * np.exp(-((s - 0.17) / 0.07) ** 2))


def cor_braco(th, s, b, pts):
    c = sombra(b) * np.ones((len(th), 3))
    v = veias(th, s)
    c[:, 0] *= 1 - 0.14 * v
    c[:, 1] *= 1 - 0.06 * v
    return c


def braco(gema=True):
    ss = np.linspace(-0.07, 0.56, 40)
    est = []
    for s in ss:
        rx, rz = interp(BRACO, s)
        est.append(((0, -float(s), 0), (1, 0, 0), (0, 0, -1), rx, rz, float(s)))
    m = tubo(est, 28, BUMP_BRACO, cor_braco, vtile=0.5)
    # mão relaxada: palma + dedos juntos + polegar
    pele = tuple(PELE)
    palma = [(0, -0.56, 0), (0, -0.6, -0.002), (0, -0.65, -0.004), (0, -0.7, -0.01), (0, -0.74, -0.02)]
    m.add(cano(palma, [0.03, 0.041, 0.042, 0.035, 0.014], 12, pele))
    for k, x in enumerate((-0.024, -0.008, 0.008, 0.024)):
        m.add(cano([(x, -0.66, -0.012), (x, -0.7, -0.022), (x, -0.735, -0.04), (x, -0.745, -0.06)], [0.0125] * 4, 8, pele))
    m.add(cano([(-0.03, -0.6, -0.02), (-0.036, -0.64, -0.034), (-0.032, -0.675, -0.045)], [0.014, 0.0135, 0.012], 8, pele))
    # pulseira de couro e gema verde (só no antebraço direito: o esquerdo é espelhado, sem gema)
    m.add(pulseira(0.5, gema=gema))
    return m


def pulseira(s0, gema=False, y_base=0.0):
    """Faixa de couro em volta do antebraço + placa com gema verde (ARK)."""
    rx, rz = interp(BRACO, s0)
    ests = []
    for k in np.linspace(-0.04, 0.04, 5):
        rx2, rz2 = interp(BRACO, s0 + k)
        ests.append(((0, -(s0 + k), 0), (1, 0, 0), (0, 0, -1), rx2 + 0.005, rz2 + 0.005, float(k)))
    couro = lambda th, s, b, pts: np.ones((len(th), 3)) * np.array([0.22, 0.15, 0.1]) * (0.85 + 0.3 * np.abs(np.sin(th * 5)))[:, None]
    m = tubo(ests, 20, None, couro, utiles=1, vtile=0.3)
    if gema:
        # placa metálica no lado de fora do antebraço, com a pedra verde brilhando
        x = rx + 0.012
        m.add(elipsoide((x, -s0, 0.0), 0.028, (0.35, 0.37, 0.36), 10, 6, (0.35, 1.25, 1.15)))
        m.add(elipsoide((x + 0.012, -s0, 0.0), 0.017, (0.1, 1.9, 0.9), 10, 6, (0.6, 1.2, 0.9)))
    return m


# ---------------------------------------------------------------- perna
PERNA = [  # s, rx, rz
    (-0.07, 0.04, 0.04), (-0.045, 0.08, 0.08), (-0.02, 0.102, 0.104), (0.00, 0.108, 0.11), (0.08, 0.11, 0.113), (0.18, 0.103, 0.108), (0.28, 0.087, 0.092), (0.38, 0.067, 0.07),
    (0.43, 0.059, 0.064), (0.50, 0.062, 0.064), (0.58, 0.07, 0.072), (0.66, 0.059, 0.061), (0.78, 0.044, 0.044),
    (0.86, 0.036, 0.038), (0.9, 0.036, 0.038),
]
BUMP_PERNA = relevo([
    (f, 0.2, 0.9, 0.11, 0.15), (f + 0.7, 0.28, 0.5, 0.09, 0.07),                    # quadríceps
    (b_, 0.18, 0.9, 0.1, 0.11), (0.0, 0.2, 0.5, 0.1, 0.05),                         # posterior e lado
    (f, 0.43, 0.5, 0.045, 0.08),                                                    # joelho
    (b_ + 0.45, 0.59, 0.5, 0.075, 0.2), (b_ - 0.45, 0.59, 0.5, 0.075, 0.18),        # panturrilha
    (f, 0.66, 0.3, 0.1, -0.03), (f + 0.2, 0.62, 0.3, 0.12, 0.03),                   # canela
])


def cor_perna(th, s, b, pts):
    pele = sombra(b) * np.ones((len(th), 3))
    pano = PANO * (0.85 + 0.3 * np.abs(np.sin(th * 7 + s * 30)))[:, None] * np.clip(1 + 1.4 * b[:, None], 0.7, 1.2)
    bainha = 0.21 + 0.025 * np.sin(th * 6 + 1.0)
    return np.where((s < bainha)[:, None], pano, pele)


def perna():
    ss = np.linspace(-0.07, 0.9, 48)
    est = []
    for s in ss:
        rx, rz = interp(PERNA, s)
        est.append(((0, -float(s), 0), (1, 0, 0), (0, 0, -1), rx, rz, float(s)))
    m = tubo(est, 28, BUMP_PERNA, cor_perna, vtile=0.5)
    # pé: elipsoide alongado para frente
    pe = elipsoide((0.0, -0.915, -0.07), 0.05, tuple(PELE * 0.97), 16, 10, (0.95, 0.62, 2.1))
    m.add(pe)
    dedos = elipsoide((0.0, -0.925, -0.185), 0.04, tuple(PELE * 0.95), 12, 8, (1.1, 0.5, 0.9))
    m.add(dedos)
    return m


# ---------------------------------------------------------------- cabeça
CABECA = [  # y (relativo ao pescoço), rx, rz
    (0.00, 0.078, 0.076), (0.05, 0.072, 0.072), (0.095, 0.066, 0.074), (0.125, 0.076, 0.086), (0.155, 0.088, 0.098),
    (0.195, 0.095, 0.105), (0.235, 0.094, 0.104), (0.275, 0.087, 0.096), (0.31, 0.068, 0.076), (0.335, 0.03, 0.036),
]
BUMP_CABECA = relevo(
    [(f + sg * 0.42, 0.205, 0.22, 0.034, -0.1) for sg in (-1, 1)]                # olhos fundos
    + [(f + sg * 0.95, 0.18, 0.5, 0.055, 0.15) for sg in (-1, 1)]                # maçãs do rosto
    + [(f + sg * 1.3, 0.12, 0.5, 0.065, 0.14) for sg in (-1, 1)]                 # mandíbula
    + [(f, 0.112, 0.55, 0.04, 0.16)]                                            # queixo
    + [(f, 0.232, 1.0, 0.032, 0.17)]                                            # arcada
    + [(f, 0.265, 1.2, 0.05, 0.05)]                                             # testa
    + [(f, 0.148, 0.5, 0.008, -0.1)]                                            # linha da boca
    + [(PI if sg > 0 else 0.0, 0.2, 0.28, 0.04, 0.1) for sg in (-1, 1)]         # orelhas (base)
)


def mascara_cabelo(th, y):
    sin = np.sin(th)
    limite = np.where(sin > 0.2, 0.258 + 0.012 * np.cos(th * 3), np.where(sin < -0.1, 0.165, 0.22))
    return 1.0 / (1.0 + np.exp(-(y - limite) / 0.008))


def cor_cabeca(th, y, b, pts):
    n = len(th)
    c = sombra(b) * np.ones((n, 3))
    sin = np.sin(th)
    mh = mascara_cabelo(th, y)
    ruido = (0.75 + 0.5 * np.abs(np.sin(th * 29 + y * 140) * np.sin(th * 7 - y * 60)))[:, None]
    c = c * (1 - mh[:, None]) + CABELO * ruido * mh[:, None]
    barba = (y < 0.17) & (y > 0.082) & (sin > -0.25) & (np.abs(th - PI / 2) < 1.45)
    c = np.where(barba[:, None], c * BARBA, c)
    return c


def cabeca():
    ys = np.linspace(0, 0.335, 56)
    est = []
    for y in ys:
        rx, rz = interp(CABECA, y)
        est.append(((0, float(y), 0), (1, 0, 0), (0, 0, -1), rx, rz, float(y)))
    # cabelo com volume: sobe um pouco o raio onde é cabelo (com fios irregulares)
    base_bump = BUMP_CABECA

    def bump(th, y):
        mh = mascara_cabelo(th, y)
        return base_bump(th, y) + mh * (0.05 + 0.03 * np.sin(th * 13 + y * 70) * np.sin(y * 45))
    m = tubo(est, 56, bump, cor_cabeca, vtile=0.4, cap0=False)
    pele = tuple(PELE)
    # nariz: ponte + ponta + asas
    m.add(elipsoide((0, 0.19, -0.104), 0.013, tuple(PELE * 0.98), 10, 8, (0.8, 2.0, 1.0)))
    m.add(elipsoide((0, 0.168, -0.114), 0.0135, tuple(PELE * 0.96), 10, 8, (1.0, 0.95, 1.05)))
    for sg in (-1, 1):
        m.add(elipsoide((sg * 0.014, 0.164, -0.108), 0.0115, tuple(PELE * 0.94), 8, 6, (1.0, 0.9, 0.9)))
    # boca: lábios
    m.add(elipsoide((0, 0.152, -0.1), 0.012, (0.62, 0.4, 0.34), 10, 6, (2.7, 0.45, 0.9)))
    m.add(elipsoide((0, 0.139, -0.099), 0.012, (0.66, 0.42, 0.36), 10, 6, (2.3, 0.5, 0.9)))
    for sg in (-1, 1):
        x = sg * 0.037
        # olho: globo, íris, pupila, pálpebra de cima e sobrancelha
        m.add(elipsoide((x, 0.205, -0.0955), 0.0128, (0.93, 0.93, 0.9), 12, 8, (1.25, 0.8, 0.85)))
        m.add(elipsoide((x, 0.205, -0.1085), 0.0072, (0.2, 0.12, 0.06), 10, 6, (1, 1, 0.45)))
        m.add(elipsoide((x, 0.205, -0.1105), 0.0034, (0.02, 0.02, 0.02), 6, 4, (1, 1, 0.4)))
        m.add(elipsoide((x, 0.2155, -0.102), 0.0145, tuple(PELE * 0.82), 10, 6, (1.4, 0.45, 0.8)))
        m.add(elipsoide((x, 0.2335, -0.112), 0.0115, tuple(CABELO), 10, 6, (2.3, 0.5, 0.9)))
        m.add(elipsoide((sg * 0.092, 0.2, 0.004), 0.023, tuple(PELE * 0.95), 8, 6, (0.4, 1.15, 0.8)))
    return m


# ---------------------------------------------------------------- braço em primeira pessoa
def braco_fp():
    """Braço direito visto da câmera: origem no centro do punho, antebraço para +z,
    costas da mão para cima (+y), polegar para o lado de dentro (-x), nós dos dedos para -z."""
    m = Malha()
    pele = tuple(PELE)
    # antebraço + braço: tubo ao longo de +z (de z=0.05 no pulso até z=0.62)
    est = []
    for z in np.linspace(0.045, 0.62, 38):
        s = (z - 0.045) / 1.0
        # sobe o perfil do braço: pulso (s ~0) -> cotovelo (0.26) -> bíceps (0.5)
        sa = 0.56 - s            # posição no perfil BRACO (0.56 = pulso)
        rx, rz = interp(BRACO, max(0.0, sa))
        k = 0.96
        est.append(((0, 0.0, float(z)), (1, 0, 0), (0, 1, 0), rx * k, rz * k, float(s)))
    # theta=0 -> +x ; theta=pi/2 -> +y (costas da mão para cima). No perfil BRACO "front" era o lado do bíceps:
    # aqui o bíceps aponta para baixo (-y), então espelhamos o relevo usando 3*pi/2 como frente.
    bump = lambda th, s: BUMP_BRACO(th + PI, 0.56 - s)
    cor = lambda th, s, b, pts: cor_braco(th + PI, 0.56 - s, b, pts)
    m.add(tubo(est, 36, bump, cor, vtile=0.5))
    # punho fechado
    hand = Malha()
    hand.add(elipsoide((0, 0.0, 0.0), 0.04, pele, 16, 10, (1.12, 0.62, 1.25)))            # costas da mão / palma
    hand.add(elipsoide((0, -0.012, -0.012), 0.036, pele, 14, 8, (1.12, 0.7, 1.2)))        # volume da palma
    # 4 dedos dobrados: do nó (frente) descendo para a palma
    for k, x in enumerate((-0.027, -0.009, 0.009, 0.027)):
        y0 = 0.016 - 0.0007 * abs(k - 1.5)
        pts = [(x, y0, -0.035), (x, y0 + 0.003, -0.066), (x, y0 - 0.011, -0.088), (x, y0 - 0.034, -0.082), (x, y0 - 0.044, -0.06), (x, y0 - 0.043, -0.04)]
        rd = [0.0125, 0.0145, 0.0145, 0.0135, 0.0125, 0.011]
        hand.add(cano(pts, rd, 10, pele))
        # nó do dedo (articulação): ressalto
        hand.add(elipsoide((x, y0 + 0.006, -0.066), 0.0125, tuple(PELE * 1.05), 8, 6, (1.0, 0.85, 0.9)))
        hand.add(elipsoide((x, y0 - 0.008, -0.092), 0.0108, tuple(PELE * 0.93), 8, 6, (1.0, 0.9, 0.8)))
    # polegar: por cima dos dedos (do lado de dentro)
    th_pts = [(-0.046, 0.0, 0.0), (-0.052, -0.004, -0.028), (-0.044, -0.014, -0.058), (-0.03, -0.028, -0.082), (-0.012, -0.036, -0.088)]
    hand.add(cano(th_pts, [0.022, 0.019, 0.0165, 0.0145, 0.013], 10, pele))
    hand.add(elipsoide((-0.052, -0.004, -0.028), 0.018, tuple(PELE), 8, 6, (1.1, 1.0, 1.1)))
    hand.V = [(v[0] * 1.3, v[1] * 1.3, v[2] * 1.3) for v in hand.V]
    m.add(hand)
    return m
    # (pulseira e gema: peças separadas no jogo)
    est2 = []
    for z in np.linspace(0.19, 0.25, 5):
        s = z - 0.045
        rx, rz = interp(BRACO, max(0.0, 0.56 - s))
        est2.append(((0, 0.0, float(z)), (1, 0, 0), (0, 1, 0), rx + 0.006, rz + 0.006, float(z)))
    couro = lambda th, s, b, pts: np.ones((len(th), 3)) * np.array([0.22, 0.15, 0.1]) * (0.85 + 0.3 * np.abs(np.sin(th * 5)))[:, None]
    m.add(tubo(est2, 24, None, couro, utiles=1, vtile=0.3))
    rx, rz = interp(BRACO, 0.56 - (0.22 - 0.045))
    top = rz + 0.012
    m.add(elipsoide((0, top, 0.22), 0.03, (0.34, 0.36, 0.35), 12, 8, (1.15, 0.32, 1.35)))
    return m


# ---------------------------------------------------------------- textura de pele
def ruido_per(W, H, rng, termos, kx, ky):
    y, x = np.mgrid[0:H, 0:W]
    u, v = x / W, y / H
    out = np.zeros((H, W))
    for _ in range(termos):
        a, b = rng.randint(0, kx), rng.randint(0, ky)
        out += rng.uniform(0.4, 1) * np.sin(TAU * (a * u + b * v) + rng.uniform(0, TAU))
    return out / termos ** 0.5


def textura_pele(seed=5):
    rng = random.Random(seed)
    nr = np.random.default_rng(seed)
    W = H = 512
    base = np.array([184.0, 128.0, 92.0])
    img = np.ones((H, W, 3)) * base
    mot = ruido_per(W, H, rng, 14, 6, 6)
    img *= (1 + 0.07 * mot)[..., None]
    # tom avermelhado onde "queima": manchas largas
    red = np.clip(ruido_per(W, H, rng, 8, 4, 4) * 0.8, 0, 1)[..., None]
    img = img * (1 - 0.1 * red) + np.array([200, 110, 85]) * 0.1 * red
    # poros/grão fino
    img *= (1 + nr.normal(0, 0.03, (H, W)))[..., None]
    for _ in range(2600):
        x, y = nr.integers(0, W), nr.integers(0, H)
        img[y, x] *= 0.86
    # sardas
    for _ in range(420):
        x, y = nr.integers(0, W - 3), nr.integers(0, H - 3)
        r = nr.integers(1, 3)
        img[y:y + r, x:x + r] *= np.array([0.84, 0.76, 0.7])
    # sujeira (marrom escuro, manchas irregulares)
    suj = np.clip(ruido_per(W, H, rng, 10, 9, 9) * 1.1 - 0.35, 0, 1)
    suj *= np.clip(ruido_per(W, H, rng, 6, 12, 12) * 1.2, 0, 1)
    img = img * (1 - 0.32 * suj[..., None]) + np.array([70, 50, 36]) * 0.32 * suj[..., None]
    # pelos finos em pé (curtos) e arranhões claros
    for _ in range(900):
        x, y = nr.integers(2, W - 2), nr.integers(0, H - 8)
        l = nr.integers(3, 7)
        img[y:y + l, x] *= 0.8
    for _ in range(26):
        x0, y0 = nr.integers(0, W - 60), nr.integers(0, H - 60)
        a = nr.uniform(0, PI)
        for t in range(nr.integers(14, 50)):
            x, y = int(x0 + math.cos(a) * t + math.sin(t * 0.2) * 2), int(y0 + math.sin(a) * t)
            if 0 <= x < W and 0 <= y < H:
                img[y, x] = img[y, x] * 0.55 + np.array([205, 150, 140]) * 0.45
    return Image.fromarray(np.clip(img, 0, 255).astype(np.uint8), 'RGB')


# ---------------------------------------------------------------- exportação
def normais(m):
    P = np.array(m.V)
    Fi = np.array(m.F)
    fn = np.cross(P[Fi[:, 1]] - P[Fi[:, 0]], P[Fi[:, 2]] - P[Fi[:, 0]])
    chave = {}
    ids = np.zeros(len(P), dtype=int)
    for i, p in enumerate(np.round(P, 4)):
        k = tuple(p)
        ids[i] = chave.setdefault(k, len(chave))
    acc = np.zeros((len(chave), 3))
    for t, f_ in enumerate(Fi):
        for v in f_:
            acc[ids[v]] += fn[t]
    n = acc[ids]
    n /= np.linalg.norm(n, axis=1, keepdims=True) + 1e-9
    return n


def b64(a):
    return base64.b64encode(np.ascontiguousarray(a).tobytes()).decode()


def exporta(m, pivot):
    P = np.array(m.V) - np.array(pivot)
    U = np.array(m.U)
    lo, hi = P.min(0), P.max(0)
    N = normais(m)
    C = np.clip(np.array(m.C), 0, 1.3) / 1.3
    return {
        'n': int(len(P)),
        'box': [*np.round(lo, 5).tolist(), *np.round(hi, 5).tolist()],
        'pos': b64(np.round((P - lo) / np.maximum(hi - lo, 1e-9) * 65535).astype('<u2')),
        'uvf': b64(U.astype('<f4')),
        'idx': b64(np.array(m.F, dtype='<u2').reshape(-1)),
        'nrm': b64(np.round(N * 127).astype('i1')),
        'col': b64(np.round(C * 255).astype('u1')),
        'pivot': [float(x) for x in pivot],
    }


if __name__ == '__main__':
    saida = sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith('--') else 'src/player/skin_data.js'
    previa = sys.argv[sys.argv.index('--previa') + 1] if '--previa' in sys.argv else None
    tx = textura_pele()
    if previa:
        tx.save(f'{previa}/pele.png')
    partes = {}
    # tronco (pivô na origem)
    partes['torso'] = exporta(tronco(), (0, 0, 0))
    # cabeça (pivô na base do pescoço)
    cab = cabeca()
    cab.V = [(v[0] * 1.07, v[1] * 1.07, v[2] * 1.07) for v in cab.V]
    cab.move((0, 1.53, 0))
    partes['head'] = exporta(cab, (0, 1.53, 0))
    # braço direito (+x); o esquerdo é o espelho (sem a pulseira com gema não dá: espelho simples)
    bd = braco()
    bd.move((0.255, 1.44, 0))
    partes['armR'] = exporta(bd, (0.255, 1.44, 0))
    be = braco(gema=False)
    be.mirror_x()
    be.move((-0.255, 1.44, 0))
    partes['armL'] = exporta(be, (-0.255, 1.44, 0))
    pd = perna()
    pd.move((0.095, 0.93, 0))
    partes['legR'] = exporta(pd, (0.095, 0.93, 0))
    pe = perna()
    pe.mirror_x()
    pe.move((-0.095, 0.93, 0))
    partes['legL'] = exporta(pe, (-0.095, 0.93, 0))
    fp = braco_fp()
    partes_fp = exporta(fp, (0, 0, 0))
    buf = io.BytesIO()
    tx.save(buf, 'JPEG', quality=90)
    textura = 'data:image/jpeg;base64,' + base64.b64encode(buf.getvalue()).decode()
    print({k: (v['n'], len(base64.b64decode(v['idx'])) // 6) for k, v in partes.items()}, 'fp:', partes_fp['n'], len(base64.b64decode(partes_fp['idx'])) // 6)
    with open(saida, 'w') as fo:
        fo.write('// Personagem musculoso gerado por tools/models/personagem.py. Não editar à mão.\n')
        fo.write(f'export const SKIN_PARTES = {json.dumps(partes)};\n')
        fo.write(f'export const FP_BRACO = {json.dumps(partes_fp)};\n')
        fo.write(f'export const SKIN_TEXTURA = {json.dumps(textura)};\n')
    print('escrito', saida)
