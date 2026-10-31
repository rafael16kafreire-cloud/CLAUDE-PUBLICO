"""
CONVERSOR DE BICHO (passo 2 de 3): encaixa o esqueleto do jogo no modelo.

Os modelos enviados não trazem nomes nos ossos (n8, n9...) e alguns nem
têm esqueleto. Então o esqueleto vem do molde da espécie no jogo
(creature_models.js, exportado por bicho_ossos.mjs) e é encaixado na forma
do modelo:
  1. gira o modelo (cabeça para -Z, pés para baixo) e põe na escala do molde
  2. estica os ossos do molde até a caixa do modelo e acerta os pés
     (procura onde as patas tocam o chão)
  3. cada vértice segue os ossos: patas pela distância até a perna, asas
     pela distância do corpo, corpo/cauda/pescoço pela posição ao longo
     do corpo, com mistura suave nas juntas
  4. suaviza os pesos pelos vizinhos da malha (sem rachar nas costuras)

Uso (numpy):
  python bicho_rig.py pasta_cru ossos.json config.json saida.json
"""
import json
import sys

import numpy as np

ROT = {
    # cabeça do modelo em +Z -> -Z
    'y180': np.array([[-1, 0, 0], [0, 1, 0], [0, 0, -1]]),
    'nada': np.eye(3),
    # modelo em pé (cabeça para +Y, barriga para -Z) -> deitado
    'cabeca_cima': np.array([[1, 0, 0], [0, 0, 1], [0, -1, 0]]),
    # em pé com a cabeça para +Y e as costas para -Z (vira e desvira)
    'cabeca_cima_costas': np.array([[-1, 0, 0], [0, 0, -1], [0, -1, 0]]),
    # modelo em pé com a cabeça para -Y
    'cabeca_baixo': np.array([[1, 0, 0], [0, 0, -1], [0, 1, 0]]),
}


def yaw(deg):
    a = np.radians(deg)
    return np.array([[np.cos(a), 0, np.sin(a)], [0, 1, 0], [-np.sin(a), 0, np.cos(a)]])


def load(folder, cfg):
    z = np.load(f'{folder}/cru.npz')
    meta = json.load(open(f'{folder}/cru.json'))
    P, UV, F, MID = z['P'], z['UV'], z['F'], z['MID']
    inc, exc = cfg.get('inclui'), cfg.get('exclui', [])
    keep = []
    for m in meta['malhas']:
        ok = (not inc or any(s in m['nome'] for s in inc)) and not any(s in m['nome'] for s in exc)
        keep.append(ok)
    keep = np.array(keep)
    F = F[keep[MID[F[:, 0]]]]
    used = np.unique(F)
    remap = np.full(len(P), -1)
    remap[used] = np.arange(len(used))
    return P[used], UV[used], remap[F], MID[used], meta


def main(folder, bones_path, cfg_path, out):
    cfg = json.load(open(cfg_path))
    proc = json.load(open(bones_path))
    body = proc['body']
    P, UV, F, MID, meta = load(folder, cfg)

    # ---------- 1. girar e escalar ----------
    R = ROT[cfg.get('giro', 'y180')]
    P = P @ R.T
    if cfg.get('yaw'):
        P = P @ yaw(cfg['yaw']).T
    if cfg.get('pitch'):
        a = np.radians(cfg['pitch'])
        P = P @ np.array([[1, 0, 0], [0, np.cos(a), -np.sin(a)], [0, np.sin(a), np.cos(a)]]).T
    if cfg.get('espelho'):
        P[:, 0] *= -1
        F = F[:, ::-1]
    pmin, pmax = np.array(proc['box'][0]), np.array(proc['box'][1])
    axis = 0 if body == 'flyer' else 2
    s = (pmax[axis] - pmin[axis]) / (P[:, axis].max() - P[:, axis].min())
    P = P * s
    lo, hi = P.min(0), P.max(0)
    # centro pelo tronco (meio do comprimento): cauda torta não desloca
    mid = np.abs(P[:, 2] - (lo[2] + hi[2]) / 2) < 0.2 * (hi[2] - lo[2])
    P[:, 0] -= np.median(P[mid, 0]) if body not in ('flyer', 'snake') and mid.sum() > 50 else (lo[0] + hi[0]) / 2
    P[:, 1] -= lo[1] - (pmin[1] if body == 'flyer' else 0)
    P[:, 2] -= (lo[2] + hi[2]) / 2 - (pmin[2] + pmax[2]) / 2
    lo, hi = P.min(0), P.max(0)
    H = hi[1] - lo[1]

    # triângulos repetidos (modelo de "dois lados": cada face duas vezes,
    # uma virada para cada lado) -> fica uma e o jogo pinta os dois lados
    _, wv = np.unique(np.round(P, 5), axis=0, return_inverse=True)
    wv = wv.reshape(-1)
    _, first = np.unique(np.sort(wv[F], 1), axis=0, return_index=True)
    two_sided = len(first) < len(F) * 0.8
    if two_sided:
        print('faces repetidas:', len(F) - len(first))
        F = F[np.sort(first)]

    # ---------- 2. ossos do molde esticados até o modelo ----------
    fit = cfg.get('ajuste', {})
    def to_mesh(p):
        p = np.array(p, dtype=float)
        q = (p - pmin) / np.maximum(pmax - pmin, 1e-6) * (hi - lo) + lo
        if body != 'flyer':
            q[0] = p[0] * (hi[0] - lo[0]) / (pmax[0] - pmin[0])  # largura simétrica
        return q
    bones = [{'name': b['name'], 'parent': b['parent'], 'pos': to_mesh(b['pos'])} for b in proc['bones']]
    by = {b['name']: b for b in bones}
    for name, d in fit.items():  # correções à mão (metros do molde)
        if name in by:
            by[name]['pos'] = by[name]['pos'] + np.array(d) * (hi - lo) / np.maximum(pmax - pmin, 1e-6)
    legs = [l['name'] for l in proc['legs']]
    wings = [b['name'] for b in bones if b['name'].startswith('asa') and not b['name'].endswith('_punho')]

    # patas no chão: acha o pé de verdade de cada perna
    if body in ('quad', 'biped', 'croc'):
        low = P[P[:, 1] < lo[1] + H * cfg.get('altura_pe', 0.1)]
        ground = [l for l in legs if by[f'{l}_pe']['pos'][1] < lo[1] + H * 0.3]
        if ground and len(low):
            A = np.array([by[f'{l}_pe']['pos'] for l in ground])
            for _ in range(5):
                d = ((low[:, None, [0, 2]] - A[None, :, [0, 2]]) ** 2).sum(-1)
                # cada lado só pega o seu lado
                side = np.sign(A[:, 0])[None, :] * np.sign(low[:, 0])[:, None]
                d[side < 0] = 1e9
                k = d.argmin(1)
                for i in range(len(ground)):
                    sel = low[k == i]
                    if len(sel) > 20:
                        A[i, [0, 2]] = sel[:, [0, 2]].mean(0)
            for i, l in enumerate(ground):
                dx = A[i] - by[f'{l}_pe']['pos']
                dx[1] = 0
                by[f'{l}_pe']['pos'] = by[f'{l}_pe']['pos'] + dx
                by[f'{l}_joelho']['pos'] = by[f'{l}_joelho']['pos'] + dx * 0.8
                by[l]['pos'] = by[l]['pos'] + dx * np.array([0.6, 0, 0.5])

    # pescoço, cabeça e cauda no meio da carne do modelo (não no ar)
    hip_y = by['hips']['pos'][1] if 'hips' in by else H / 2
    L = hi[2] - lo[2]
    for b in bones:
        nm = b['name']
        if not (nm.startswith(('neck', 'tail', 'head')) or (nm[0] == 'b' and nm[1:].isdigit())):
            continue
        z0 = b['pos'][2]
        m = (np.abs(P[:, 2] - z0) < 0.02 * L) & (np.abs(P[:, 0]) < 0.25 * (hi[0] - lo[0]))
        if body != 'flyer':
            m &= P[:, 1] > hip_y * 0.45
        if m.sum() > 10:
            b['pos'][1] = (P[m, 1].min() + P[m, 1].max()) / 2

    # voador: corpo (quadril) na altura 0, como no molde
    if body == 'flyer':
        dy = by['hips']['pos'][1]
        P[:, 1] -= dy
        for b in bones:
            b['pos'][1] -= dy
        lo, hi = P.min(0), P.max(0)

    names = [b['name'] for b in bones]
    idx = {n: i for i, n in enumerate(names)}
    n = len(P)
    W = np.zeros((n, len(bones)))

    # ---------- 3a. corpo: posição ao longo do comprimento ----------
    root = next(b['name'] for b in bones if not b['parent'])
    limb = set()
    for l in legs:
        limb |= {l, f'{l}_joelho', f'{l}_pe'}
    for w in wings:
        limb |= {w, f'{w}_punho'}
    spine = [b for b in bones if b['name'] not in limb and b['name'] != 'jaw']
    spine.sort(key=lambda b: b['pos'][2])
    zs = np.array([b['pos'][2] for b in spine])
    r = [b['name'] for b in spine].index(root)
    z = P[:, 2]
    Wb = np.zeros((n, len(spine)))
    # quem é "dono" de cada trecho: para frente da raiz, o osso da frente
    # manda do seu ponto em diante; para trás, igual para a cauda
    owner = np.full(n, r)
    for i in range(r - 1, -1, -1):
        owner[z < zs[i]] = i
    for i in range(r + 1, len(spine)):
        owner[z > zs[i]] = i
    Wb[np.arange(n), owner] = 1
    # mistura suave em cada junta
    for i in range(len(spine)):
        if i == r:
            continue
        gap = min(abs(zs[i] - zs[i - 1]) if i > 0 else 1e9, abs(zs[i + 1] - zs[i]) if i + 1 < len(spine) else 1e9)
        bw = max(0.05, 0.35 * gap) if gap < 1e8 else 0.3
        inner = i + 1 if i < r else i - 1  # vizinho do lado da raiz
        t = (zs[i] - z) / bw if i < r else (z - zs[i]) / bw  # >0 = lado do osso
        m = np.abs(t) < 1
        a = (np.clip(t[m], -1, 1) + 1) / 2
        # só mexe em quem está entre os dois ossos
        sel = np.where(m)[0]
        Wb[sel] = 0
        Wb[sel, i] = a
        Wb[sel, inner] += 1 - a
    for j, b in enumerate(spine):
        W[:, idx[b['name']]] = Wb[:, j]

    # distância até a linha do corpo (para comparar com as pernas)
    sp = np.array([b['pos'] for b in spine])
    def dist_poly(Q, pts):
        best = np.full(len(Q), np.inf)
        tbest = np.zeros(len(Q))
        ibest = np.zeros(len(Q), int)
        for i in range(len(pts) - 1):
            a, b = pts[i], pts[i + 1]
            ab = b - a
            t = np.clip(((Q - a) @ ab) / max(ab @ ab, 1e-9), 0, 1)
            d = np.linalg.norm(Q - (a + t[:, None] * ab), axis=1)
            m = d < best
            best[m], tbest[m], ibest[m] = d[m], t[m], i
        return best, ibest, tbest
    # linha do corpo vai até as pontas do modelo (focinho e cauda)
    head_tip = np.array([0, P[P[:, 2] < lo[2] + 0.05 * (hi[2] - lo[2]), 1].mean(), lo[2]])
    tail_tip = np.array([0, P[P[:, 2] > hi[2] - 0.05 * (hi[2] - lo[2]), 1].mean(), hi[2]])
    dspine, _, _ = dist_poly(P, np.r_[[head_tip], sp, [tail_tip]])

    # ---------- 3b. pernas e braços ----------
    best_leg = np.full(n, np.inf)
    for l in legs:
        hip, knee, ank = by[l]['pos'], by[f'{l}_joelho']['pos'], by[f'{l}_pe']['pos']
        toe = ank.copy()
        toe[1] = lo[1]
        chain = np.array([hip, knee, ank, toe])
        d, seg, t = dist_poly(P, chain)
        sx = np.sign(hip[0])
        side_ok = P[:, 0] * sx > -0.02 * (hi[0] - lo[0])
        under = P[:, 1] < hip[1] + 0.15 * H
        take = side_ok & under & (d < dspine * cfg.get('perna_vs_corpo', 1.0)) & (d < best_leg)
        best_leg[take] = d[take]
        sel = np.where(take)[0]
        W[sel] = 0
        # coxa / canela / pé, misturando nas juntas
        ii = [idx[l], idx[f'{l}_joelho'], idx[f'{l}_pe'], idx[f'{l}_pe']]
        ss, tt = seg[sel], t[sel]
        for k in range(3):
            m = ss == k
            cur, nxt = ii[k], ii[k + 1]
            a = np.clip((tt[m] - 0.75) / 0.25, 0, 1) * 0.5 if k < 2 else np.zeros(m.sum())
            W[sel[m], cur] += 1 - a
            W[sel[m], nxt] += a
        # um pouco do corpo no alto da coxa (não descola)
        top = (ss == 0) & (tt < 0.25)
        a = (0.25 - tt[top]) / 0.25 * 0.5
        W[sel[top]] *= (1 - a)[:, None]
        W[sel[top], idx[by[l]['parent']]] += a

    # ---------- 3c. asas ----------
    for w in wings:
        sh, wr = by[w]['pos'], by[f'{w}_punho']['pos']
        sx = np.sign(sh[0])
        x = P[:, 0] * sx
        on = x > abs(sh[0]) * cfg.get('asa_inicio', 1.0)
        on &= x > 0
        sel = np.where(on)[0]
        W[sel] = 0
        span = abs(wr[0]) - abs(sh[0])
        a = np.clip((x[sel] - abs(wr[0]) + 0.15 * span) / (0.3 * span), 0, 1)
        b0 = np.clip((x[sel] - abs(sh[0])) / (0.25 * span), 0, 1)
        W[sel, idx[w]] = (1 - a) * b0
        W[sel, idx[f'{w}_punho']] = a * b0
        W[sel, idx['chest']] += 1 - b0

    # ---------- 4. suavizar pelos vizinhos (posições iguais = 1 vértice) ----------
    key = np.round(P, 5)
    _, pid, inv = np.unique(key, axis=0, return_index=True, return_inverse=True)
    inv = inv.reshape(-1)
    m = len(pid)
    Wp = np.zeros((m, W.shape[1]))
    np.add.at(Wp, inv, W)
    cnt = np.bincount(inv, minlength=m)[:, None]
    Wp /= np.maximum(cnt, 1)
    e = np.r_[F[:, [0, 1]], F[:, [1, 2]], F[:, [2, 0]]]
    e = inv[e]
    e = e[e[:, 0] != e[:, 1]]
    deg = np.bincount(e[:, 0], minlength=m) + np.bincount(e[:, 1], minlength=m)
    for _ in range(cfg.get('suavizar', 4)):
        acc = np.zeros_like(Wp)
        np.add.at(acc, e[:, 0], Wp[e[:, 1]])
        np.add.at(acc, e[:, 1], Wp[e[:, 0]])
        nb = acc / np.maximum(deg, 1)[:, None]
        Wp = np.where(deg[:, None] > 0, 0.5 * Wp + 0.5 * nb, Wp)
    W = Wp[inv]
    W /= np.maximum(W.sum(1, keepdims=True), 1e-9)

    top = np.argsort(-W, axis=1)[:, :4]
    tw = np.take_along_axis(W, top, 1)
    tw /= np.maximum(tw.sum(1, keepdims=True), 1e-9)

    mats = []
    for i, mm in enumerate(meta['malhas']):
        mats.append({'cor': mm.get('diffuseColor') or mm.get('emissiveColor'), 'relevo': mm.get('normal'),
                     'alfa': bool(mm.get('opacity'))})
    json.dump({
        'info': meta['info'],
        'body': body,
        'doisLados': bool(two_sided),
        'bones': [{'name': b['name'], 'parent': b['parent'], 'pos': np.round(b['pos'], 4).tolist()} for b in bones],
        'positions': np.round(P, 4).tolist(),
        'uv': np.round(UV, 5).tolist(),
        'mat': MID.tolist(),
        'materiais': mats,
        'indices': F.tolist(),
        'skinIndex': top.tolist(),
        'skinWeight': np.round(tw, 4).tolist(),
    }, open(out, 'w'))
    print('vértices', n, 'triângulos', len(F), 'tamanho', np.round(hi - lo, 2).tolist())


if __name__ == '__main__':
    main(*sys.argv[1:5])
