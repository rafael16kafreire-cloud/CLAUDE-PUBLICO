"""
Mais plantas enviadas pelo jogador -> src/world/textures/veg_modelos2.js
  - "Agarwood" (árvore alta da mata): o original tem 640 mil triângulos;
    fica o tronco reduzido, uma parte das folhas (cartões maiores para
    compensar) e um pouco dos cipós. Os "frutos" (440 mil tri.) saem.
  - "Bush with Berries" (arbusto redondo com bagas): sem textura no
    original; as bolas de folhas ganham a textura de folhagem (scan
    "Grass") projetada em esfera; as bagas ficam com a cor de cada tipo
    (o jogo pinta: Baga-Mejo, Baga-Escura, frutas).
Mesmo formato do vegetacao_modelos.py (altura 1, partes com textura).

Uso (usd-core, numpy, Pillow, meshoptimizer via node não é preciso):
  python vegetacao_modelos2.py pasta_agarwood pasta_arbusto saida.js
"""
import json
import sys

import numpy as np

from vegetacao_modelos import load, mesh, img, model


def sample_cards(p, u, i, frac, grow, seed=1):
    """Fica com uma fração dos cartões (2 triângulos seguidos = 1 cartão),
    cada um aumentado em volta do próprio centro."""
    rng = np.random.default_rng(seed)
    n = len(i) // 2
    keep = np.where(rng.random(n) < frac)[0]
    tris = np.concatenate([i[keep * 2], i[keep * 2 + 1]]) if len(keep) else i[:0]
    used = np.unique(tris)
    remap = np.full(len(p), -1)
    remap[used] = np.arange(len(used))
    q = p[used].copy()
    # aumenta cada cartão em volta do seu centro
    for k in keep:
        vs = np.unique(np.r_[i[k * 2], i[k * 2 + 1]])
        c = p[vs].mean(0)
        q[remap[vs]] = c + (p[vs] - c) * grow
    return q, u[used], remap[tris]


def simplify(p, i, target):
    """Reduz por agrupamento em grade (vertex clustering) – sem dependências."""
    lo, hi = p.min(0), p.max(0)
    for cells in (64, 48, 36, 28, 20, 14):
        size = (hi - lo).max() / cells
        key = np.floor((p - lo) / size).astype(np.int64)
        _, rep, inv = np.unique(key, axis=0, return_index=True, return_inverse=True)
        inv = inv.reshape(-1)
        t = inv[i]
        t = t[(t[:, 0] != t[:, 1]) & (t[:, 1] != t[:, 2]) & (t[:, 0] != t[:, 2])]
        if len(t) <= target:
            break
    return rep, t


def main(agar, bush, out):
    M = {}
    T = {}
    # ---------- Agarwood ----------
    d = load(agar)
    P, UV, F, MID, meta = d
    names = [(m.get('diffuseColor') or '').split('/')[-1] for m in meta['malhas']]
    ids = lambda key: [k for k, n in enumerate(names) if key in n]
    # tronco: reduz por grade (perde a costura da textura em poucos lugares)
    p, u, i = mesh(d, ids('AgarwoodBark'))
    rep, t = simplify(p, i, 2600)
    pb, ub, ib = p[rep], u[rep], t
    # folhas e cipós: só uma parte dos cartões
    p1, u1, i1 = mesh(d, ids('AgarwoodLeaf_1'))
    p1, u1, i1 = sample_cards(p1, u1, i1, 0.05, 2.0, 1)
    p2, u2, i2 = mesh(d, ids('AgarwoodLeaf_2'))
    p2, u2, i2 = sample_cards(p2, u2, i2, 0.06, 2.0, 2)
    pv, uv, iv = mesh(d, ids('AgarwoodVines'))
    pv, uv, iv = sample_cards(pv, uv, iv, 0.12, 1.3, 3)
    M['arvore_agar'] = model([(pb, ub, ib, 'agar_casca'), (p1, u1, i1, 'agar_folha1'), (p2, u2, i2, 'agar_folha2'), (pv, uv, iv, 'agar_cipo')])
    T['agar_casca'] = img(f'{agar}/0/AgarwoodBark_diffuse_scale2.jpg', (512, 512), False)
    T['agar_folha1'] = img(f'{agar}/0/AgarwoodLeaf_1_diffuse_cutoff174.png', (256, 256), True)
    T['agar_folha2'] = img(f'{agar}/0/AgarwoodLeaf_2_diffuse_cutoff86.png', (256, 256), True)
    T['agar_cipo'] = img(f'{agar}/0/AgarwoodVines_diffuse.jpg', (256, 256), False)
    # ---------- Arbusto com bagas ----------
    d = load(bush)
    p, u, i = mesh(d, [0, 2])
    # textura de folhas projetada em esfera (cada bola de folhas)
    c = p.mean(0)
    v = p - c
    lon = np.arctan2(v[:, 2], v[:, 0]) / (2 * np.pi) + 0.5
    lat = np.arctan2(v[:, 1], np.hypot(v[:, 0], v[:, 2])) / np.pi + 0.5
    uvs = np.c_[lon * 3, lat * 1.5]  # repete a textura
    # bolas de folhas lisas: menos triângulos (o celular desenha muitos arbustos)
    rep, i = simplify(p, i, 1400)
    p, uvs = p[rep], uvs[rep]
    pb2, ub2, ib2 = mesh(d, [1])
    M['arbusto_bagas'] = model([(p, uvs, i, 'folhagem_arbusto'), (pb2, ub2 * 0, ib2, 'baga')])
    print({k: [x['n'] for x in v] for k, v in M.items()})
    with open(out, 'w') as f:
        f.write('// Mais plantas enviadas pelo jogador: Agarwood (árvore da mata) e\n')
        f.write('// Bush with Berries (arbusto redondo com bagas).\n')
        f.write('// Gerado por tools/models/vegetacao_modelos2.py.\n')
        f.write(f'export const VEG_MODELOS2 = {json.dumps(M)};\n')
        f.write(f'export const VEG_TEXTURAS2 = {json.dumps(T)};\n')


if __name__ == '__main__':
    main(*sys.argv[1:4])
