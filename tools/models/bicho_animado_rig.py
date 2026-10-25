"""
BICHO ANIMADO (passo 2): esqueleto e animação do AUTOR do modelo ->
rig.json do jogo (o mesmo formato do bicho_rig.py, mais "clipes").

- vira, escala e centraliza o modelo como o bicho_rig.py (cabeça para -Z,
  tamanho do molde da espécie)
- os ossos ficam "retos" (sem giro de descanso), na posição da pose de
  descanso. Assim as animações do jogo (rotation.x = levantar a perna...)
  funcionam igual aos outros bichos, e os pesos do autor continuam.
- ossos com nome do jogo (hips, neck, head, pernaE...) vêm de "ossos" na
  configuração; os outros viram o<número>. Ossos sem peso nenhum somem.
- cada clipe vira giros (quaternions) de cada osso por quadro, a 15/s

Uso: python bicho_animado_rig.py pasta_cru ossos_molde.json config.json rig.json
"""
import json
import sys

import numpy as np

sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
from bicho_rig import ROT, yaw  # noqa: E402

FPS_OUT = 15


def quat_from_matrix(m):
    """Matriz 3x3 (coluna, como o three.js) -> quaternion x, y, z, w."""
    t = np.trace(m)
    if t > 0:
        s = np.sqrt(t + 1.0) * 2
        q = [(m[2, 1] - m[1, 2]) / s, (m[0, 2] - m[2, 0]) / s, (m[1, 0] - m[0, 1]) / s, 0.25 * s]
    elif m[0, 0] > m[1, 1] and m[0, 0] > m[2, 2]:
        s = np.sqrt(1.0 + m[0, 0] - m[1, 1] - m[2, 2]) * 2
        q = [0.25 * s, (m[0, 1] + m[1, 0]) / s, (m[0, 2] + m[2, 0]) / s, (m[2, 1] - m[1, 2]) / s]
    elif m[1, 1] > m[2, 2]:
        s = np.sqrt(1.0 + m[1, 1] - m[0, 0] - m[2, 2]) * 2
        q = [(m[0, 1] + m[1, 0]) / s, 0.25 * s, (m[1, 2] + m[2, 1]) / s, (m[0, 2] - m[2, 0]) / s]
    else:
        s = np.sqrt(1.0 + m[2, 2] - m[0, 0] - m[1, 1]) * 2
        q = [(m[0, 2] + m[2, 0]) / s, (m[1, 2] + m[2, 1]) / s, 0.25 * s, (m[1, 0] - m[0, 1]) / s]
    q = np.array(q)
    return q / np.linalg.norm(q)


def ortho(m):
    """Tira escala/torção numérica de uma matriz 3x3."""
    u, _, vt = np.linalg.svd(m)
    r = u @ vt
    if np.linalg.det(r) < 0:
        u[:, -1] *= -1
        r = u @ vt
    return r


def qmul(a, b):
    ax, ay, az, aw = a
    bx, by, bz, bw = b
    return np.array([aw * bx + ax * bw + ay * bz - az * by, aw * by - ax * bz + ay * bw + az * bx,
                     aw * bz + ax * by - ay * bx + az * bw, aw * bw - ax * bx - ay * by - az * bz])


def qinv(q):
    return np.array([-q[0], -q[1], -q[2], q[3]])


def qrot(q, v):
    p = qmul(qmul(q, np.array([*v, 0.0])), qinv(q))
    return p[:3]


def main(folder, bones_path, cfg_path, out):
    cfg = json.load(open(cfg_path))
    proc = json.load(open(bones_path))
    body = proc['body']
    z = np.load(f'{folder}/cru.npz')
    meta = json.load(open(f'{folder}/cru.json'))
    P, UV, F, MID, JI, JW = z['P'], z['UV'], z['F'], z['MID'], z['JI'], z['JW']
    parents, bind, frames = z['parents'].copy(), z['bind'], z['frames']
    nj = len(parents)

    # ---------- 1. pose de descanso ----------
    # "ligacao" = pose em que o modelo foi feito (corrigida para a mesma
    # orientação da animação); número = um quadro da animação
    rest_cfg = cfg.get('repouso', 0)
    if rest_cfg == 'ligacao':
        r = int(np.where(parents < 0)[0][0])
        C = np.linalg.inv(bind[r]) @ frames[0][r]
        rest = bind @ C
    else:
        rest = frames[int(rest_cfg)]
    # malha na pose de descanso (vetor linha: p' = p @ inv(bind) @ rest)
    K = np.linalg.inv(bind) @ rest
    Ph = np.c_[P, np.ones(len(P))]
    P = np.zeros((len(P), 3))
    for q in range(4):
        P += JW[:, q:q + 1] * np.einsum('ni,nij->nj', Ph, K[JI[:, q]])[:, :3]

    # ---------- 2. virar, escalar e centralizar (como o bicho_rig.py) ----------
    R = ROT[cfg.get('giro', 'y180')]
    if cfg.get('yaw'):
        R = yaw(cfg['yaw']) @ R
    if cfg.get('pitch'):
        a = np.radians(cfg['pitch'])
        R = np.array([[1, 0, 0], [0, np.cos(a), -np.sin(a)], [0, np.sin(a), np.cos(a)]]) @ R
    P = P @ R.T
    pmin, pmax = np.array(proc['box'][0]), np.array(proc['box'][1])
    axis = 0 if body == 'flyer' else 2
    s = (pmax[axis] - pmin[axis]) / (P[:, axis].max() - P[:, axis].min())
    P = P * s
    lo, hi = P.min(0), P.max(0)
    off = np.zeros(3)
    off[0] = -(lo[0] + hi[0]) / 2
    off[1] = -(lo[1] - (pmin[1] if body in ('flyer', 'fish') else 0))
    off[2] = -((lo[2] + hi[2]) / 2 - (pmin[2] + pmax[2]) / 2)
    P = P + off
    # G: mundo do arquivo -> mundo do jogo (vetor linha)
    G = np.eye(4)
    G[:3, :3] = (s * R).T
    G[3, :3] = off
    Gi = np.linalg.inv(G)

    # ---------- 3. ossos usados (com peso, ou com nome do jogo, ou pais deles) ----------
    infl = np.zeros(nj)
    np.add.at(infl, JI.ravel(), JW.ravel())
    names_cfg = cfg.get('ossos', {})
    named = {}
    for name, j in names_cfg.items():
        named[int(j)] = name
    # pai novo (ex.: juntar a cauda no quadril)
    for j, p in cfg.get('pais', {}).items():
        parents[int(j)] = int(p)
    keep = (infl > 1e-3)
    for j in named:
        keep[j] = True
    for j in range(nj):
        if keep[j]:
            p = parents[j]
            while p >= 0 and not keep[p]:
                keep[p] = True
                p = parents[p]
    # ordem: pai antes do filho
    order = []
    seen = set()

    def visit(j):
        if j in seen:
            return
        if parents[j] >= 0:
            visit(parents[j])
        seen.add(j)
        order.append(j)
    for j in range(nj):
        if keep[j]:
            visit(j)
    new_of = {j: i + 1 for i, j in enumerate(order)}  # 0 = raiz do jogo
    # pesos de ossos que saíram vão para o pai que ficou
    def mapj(j):
        while j >= 0 and not keep[j]:
            j = parents[j]
        return new_of[j] if j >= 0 else 0
    lut = np.array([mapj(j) for j in range(nj)])
    SI = lut[JI]
    SW = JW.copy()

    # ---------- 4. ossos retos na pose de descanso ----------
    restG = rest @ G  # matriz de cada osso no mundo do jogo
    pos = {j: restG[j][3, :3] for j in order}
    # E = lado +x (como no molde): troca E/D se o modelo veio espelhado
    for name in list(names_cfg):
        if not name.endswith('E') or name[:-1] + 'D' not in names_cfg:
            continue
        je, jd = int(names_cfg[name]), int(names_cfg[name[:-1] + 'D'])
        if pos[je][0] < pos[jd][0]:
            for suf in ('', '_joelho', '_pe', '_punho'):
                a, b = name + suf, name[:-1] + 'D' + suf
                if a in names_cfg and b in names_cfg:
                    named[int(names_cfg[a])], named[int(names_cfg[b])] = b, a
    bones = [{'name': cfg.get('raiz', 'raiz'), 'parent': None, 'pos': [0.0, 0.0, 0.0]}]
    bname = {}
    for j in order:
        bname[j] = named.get(j, f'o{j}')
        p = parents[j]
        bones.append({'name': bname[j], 'parent': bname[p] if p >= 0 else bones[0]['name'], 'pos': pos[j].tolist()})

    # ---------- 5. clipes ----------
    fps_in = meta.get('fps', 30)
    clipes = {}
    for role, cc in cfg.get('clipes', {}).items():
        a = cc.get('de', 0)
        b = cc.get('ate', len(frames) - 1)
        idx = np.arange(a, b + 1e-9, fps_in / FPS_OUT).round().astype(int)
        idx = idx[idx < len(frames)]
        nb = len(order)
        Q = np.zeros((len(idx), nb, 4))
        T = np.zeros((len(idx), nb, 3))
        for fi, f in enumerate(idx):
            # mudança de cada osso desde o descanso, no mundo do jogo
            Mw = {}
            for k, j in enumerate(order):
                Kj = Gi @ np.linalg.inv(rest[j]) @ frames[f][j] @ G
                rw = ortho(Kj[:3, :3].T)  # coluna
                aw = np.r_[pos[j], 1] @ Kj
                Mw[j] = (quat_from_matrix(rw), aw[:3])
            for k, j in enumerate(order):
                qj, aj = Mw[j]
                p = parents[j]
                if p >= 0:
                    qp, ap = Mw[p]
                    Q[fi, k] = qmul(qinv(qp), qj)
                    T[fi, k] = qrot(qinv(qp), aj - ap)
                else:
                    Q[fi, k] = qj
                    T[fi, k] = aj
        # sinal contínuo (para interpolar sem dar a volta)
        for fi in range(1, len(idx)):
            flip = (Q[fi] * Q[fi - 1]).sum(1) < 0
            Q[fi, flip] *= -1
        size = (hi - lo).max()
        rest_local = np.array([pos[j] - (pos[parents[j]] if parents[j] >= 0 else 0) for j in order])
        moved_t = np.abs(T - rest_local[None]).max(axis=(0, 2)) > size * 0.004
        moved_q = np.abs(Q - Q[:1]).max(axis=(0, 2)) > 1e-3
        clip = {'fps': FPS_OUT, 'quadros': len(idx), 'loop': cc.get('loop', True),
                'giro': {bname[j]: np.round(Q[:, k], 4).tolist() for k, j in enumerate(order) if moved_q[k] or True},
                'pos': {bname[j]: np.round(T[:, k], 4).tolist() for k, j in enumerate(order) if moved_t[k]}}
        # passo: quanto o bicho anda em um ciclo (pé que mais se move pra frente/trás)
        feet = [n for n in named.values() if n.endswith('_pe')]
        inv_named = {v: k for k, v in named.items()}
        if feet and cc.get('anda', role == 'andar'):
            zr, cyc = [], []
            for fn in feet:
                j = inv_named[fn]
                zs = np.array([(frames[f][j] @ G)[3, 2] for f in range(a, b + 1)])
                zr.append(zs.max() - zs.min())
                spec = np.abs(np.fft.rfft(zs - zs.mean()))
                spec[0] = 0
                cyc.append(int(spec.argmax()))
            ciclos = cc.get('ciclos') or max(1, int(np.median(cyc)))
            clip['passo'] = round(float(np.median(zr)), 4)
            clip['ciclos'] = ciclos
        clipes[role] = clip
        print('clipe', role, 'quadros', len(idx), 'ossos girando', int(moved_q.sum()), 'com posição', int(moved_t.sum()),
              'passo', clip.get('passo'))

    # ---------- 6. saída (mesmo formato do bicho_rig.py) ----------
    _, wv = np.unique(np.round(P, 5), axis=0, return_inverse=True)
    wv = wv.reshape(-1)
    _, first = np.unique(np.sort(wv[F], 1), axis=0, return_index=True)
    two_sided = len(first) < len(F) * 0.8
    if two_sided:
        F = F[np.sort(first)]
    inc, exc = cfg.get('inclui'), cfg.get('exclui', [])
    if inc or exc:
        ok = np.array([(not inc or any(t in m['nome'] for t in inc)) and not any(t in m['nome'] for t in exc) for m in meta['malhas']])
        F = F[ok[MID[F[:, 0]]]]
    mats = []
    for mm in meta['malhas']:
        mats.append({'cor': mm.get('diffuseColor') or mm.get('emissiveColor'), 'relevo': mm.get('normal'),
                     'alfa': bool(mm.get('opacity'))})
    json.dump({
        'info': meta['info'],
        'body': body,
        'doisLados': bool(two_sided or cfg.get('dois_lados')),
        'bones': [{'name': b['name'], 'parent': b['parent'], 'pos': np.round(b['pos'], 4).tolist()} for b in bones],
        'positions': np.round(P, 4).tolist(),
        'uv': np.round(UV, 5).tolist(),
        'mat': MID.tolist(),
        'materiais': mats,
        'indices': F.tolist(),
        'skinIndex': SI.tolist(),
        'skinWeight': np.round(SW, 4).tolist(),
        'clipes': clipes,
    }, open(out, 'w'))
    print('vértices', len(P), 'triângulos', len(F), 'ossos', len(bones), 'tamanho', np.round(hi - lo, 2).tolist())


if __name__ == '__main__':
    main(*sys.argv[1:5])
