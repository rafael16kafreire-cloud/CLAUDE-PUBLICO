"""
Mede, em cada modelo importado, o quanto a boca vem aberta e calcula os
números para fechar a boca na pose parada (usados em src/creatures/bocas.js).
Uso (numpy): python tools/models/bocas.py especie [especie...]
Imprime uma linha JS pronta para colar na tabela BOCAS.
Como funciona: pega os vértices da cabeça, corta em fatias do pescoço ao
focinho e acha, em cada fatia, o maior vão vertical (a boca aberta). Uma reta
pelos vãos separa mandíbula de baixo (vai para o osso 'jaw') da de cima; o
ângulo vem da abertura na ponta do focinho.
"""
import base64
import json
import math
import re
import sys

import numpy as np


def carrega(nome):
    s = open(f'src/creatures/imported/{nome}.js', encoding='utf-8').read()

    def grab(k):
        return re.search(r'\n  %s:\s*[\'"]([^\'"]+)[\'"]' % k, s).group(1)

    n = int(re.search(r'vertices:\s*(\d+)', s).group(1))
    box = json.loads(re.search(r'box:\s*(\[\[.*?\]\])', s).group(1))
    bones = json.loads(re.search(r'bones:\s*(\[.*?\}\]),\n', s, re.S).group(1))
    qp = np.frombuffer(base64.b64decode(grab('position')), dtype=np.uint16).reshape(n, 3).astype(float)
    bmin, bmax = np.array(box[0]), np.array(box[1])
    pos = bmin + qp / 65535 * (bmax - bmin)
    si = np.frombuffer(base64.b64decode(grab('skinIndex')), dtype=np.uint8).reshape(n, 4)
    sw = np.frombuffer(base64.b64decode(grab('skinWeight')), dtype=np.uint8).reshape(n, 4)
    return n, bones, pos, si, sw


def analisa(nome, fatias=16, limiar=0.045):
    n, bones, pos, si, sw = carrega(nome)
    nomes = [b['name'] for b in bones]
    hi = nomes.index('head')
    jaw = nomes.index('jaw') if 'jaw' in nomes else None
    dom = si[np.arange(n), sw.argmax(1)]
    sel = dom == hi
    if jaw is not None:
        sel |= dom == jaw
    hv = pos[sel]
    hips = np.array(bones[nomes.index('hips')]['pos'], float) if 'hips' in nomes else np.zeros(3)
    H = np.array(bones[hi]['pos'], float)
    dir_ = 1.0 if H[2] > hips[2] else -1.0  # lado do focinho no eixo z
    zr = hv[:, 2].max() if dir_ < 0 else hv[:, 2].min()  # nuca
    zf = (zr - hv[:, 2]) * (1 if dir_ < 0 else -1)  # 0 na nuca, cresce até o focinho
    L = zf.max()
    alt = hv[:, 1].max() - hv[:, 1].min()
    sl = L / fatias
    linhas = []
    for k in range(fatias):
        m = (zf >= k * sl) & (zf < (k + 1) * sl)
        if m.sum() < 10:
            continue
        ys = np.sort(hv[m, 1])
        g = np.diff(ys)
        gi = g.argmax()
        linhas.append((k * sl + sl / 2, (ys[gi] + ys[gi + 1]) / 2, g[gi], m.sum()))
    # fatias com vão de boca aberta (do meio para a ponta)
    boca = [r for r in linhas if r[0] > L * 0.2 and r[2] > limiar * alt]
    if len(boca) < 3:
        return dict(nome=nome, aberta=False, L=L, alt=alt)
    X = np.array([r[0] for r in boca])
    Y = np.array([r[1] for r in boca])
    B, A = np.polyfit(X, Y, 1)  # y = A + B*zf
    ponta = [r for r in linhas if r[0] > L * 0.65]
    g_ponta = max((r[2] for r in ponta), default=0)
    zf_h = 0.14 * L
    zf_ponta = max((r[0] for r in ponta), default=L)
    theta = math.atan2(g_ponta, zf_ponta - zf_h) * 0.95
    hy = A + B * zf_h
    hz = zr - dir_ * zf_h * (1 if dir_ < 0 else -1) * (1 if dir_ < 0 else 1)
    # z da dobradiça: andar zf_h da nuca em direção ao focinho
    hz = zr + dir_ * zf_h
    return dict(nome=nome, aberta=True, dir=dir_, L=L, alt=alt, hz=hz, hy=hy, A=A, B=B, zr=zr, theta=theta, graus=math.degrees(theta), gponta=g_ponta)


if __name__ == '__main__':
    for nome in sys.argv[1:]:
        r = analisa(nome)
        if not r['aberta']:
            print(f"// {nome}: boca já fechada (cabeça {r['L']:.2f} m)")
            continue
        print(f"  {nome}: {{ dir: {r['dir']:+.0f}, hz: {r['hz']:.3f}, hy: {r['hy']:.3f}, A: {r['A']:.3f}, B: {r['B']:.3f}, zr: {r['zr']:.3f}, fecha: {r['theta']:.3f} }}, // ~{r['graus']:.0f}° de abertura, cabeça {r['L']:.2f} m")
