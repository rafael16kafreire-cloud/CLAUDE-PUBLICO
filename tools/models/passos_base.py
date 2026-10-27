"""
"JEITO DE ANDAR" tirado das animações de verdade, para os bichos que não
têm animação própria. Lê o clipe 'andar' do rig.json de um bicho animado
(saída do bicho_animado_rig.py) e grava, para cada parte da perna (coxa,
joelho, pé) da frente e de trás, a curva do giro durante um passo, mais
o atraso entre as pernas e o balanço da cauda.

Uso: python passos_base.py saida.js nome=pasta/rig.json [nome=pasta/rig.json ...]
"""
import json
import sys

import numpy as np

N = 24  # pontos por passo


def euler_xyz(q):
    x, y, z, w = q.T
    m11 = 1 - 2 * (y * y + z * z)
    m12 = 2 * (x * y - z * w)
    m13 = 2 * (x * z + y * w)
    m22 = 1 - 2 * (x * x + z * z)
    m23 = 2 * (y * z - x * w)
    m32 = 2 * (y * z + x * w)
    m33 = 1 - 2 * (x * x + y * y)
    ey = np.arcsin(np.clip(m13, -1, 1))
    ex = np.where(np.abs(m13) < 0.9999, np.arctan2(-m23, m33), np.arctan2(m32, m22))
    ez = np.arctan2(-m12, m11)
    return ex, ey, ez


def resample(v, n=N):
    """Um ciclo (v já é periódico) -> n pontos."""
    t = np.linspace(0, len(v), n, endpoint=False)
    vv = np.r_[v, v[:1]]
    return np.interp(t, np.arange(len(vv)), vv)


def lag(a, b):
    """Quanto (0..1 do passo) b está atrasado em relação a a."""
    n = len(a)
    best = max(range(n), key=lambda k: float(np.dot(a - a.mean(), np.roll(b, -k) - b.mean())))
    return best / n


def profile(rig):
    clip = rig['clipes']['andar']
    cyc = clip.get('ciclos') or 1
    g = clip['giro']
    n = clip['quadros']
    per = n // cyc  # quadros de um ciclo
    def curve(bone, axis=0):
        q = np.array(g[bone])[:per]
        return euler_xyz(q)[axis]
    out = {'pernas': {}, 'cauda': []}
    groups = sorted({b[:-1] for b in g if b.endswith('E') and b[:-1] + 'D' in g and not b.startswith('o')})
    ref = None
    for grp in groups:
        e = curve(grp + 'E')
        d = curve(grp + 'D')
        if ref is None:
            ref = e
        parts = {}
        for suf, key in (('', 'coxa'), ('_joelho', 'joelho'), ('_pe', 'pe')):
            if grp + 'E' + suf in g:
                c = resample(curve(grp + 'E' + suf))
                parts[key] = np.round(c - c.mean(), 3).tolist()
        out['pernas'][grp] = {**parts, 'atraso': round(lag(resample(ref), resample(e)), 3),
                              'atraso_D': round(lag(resample(e), resample(d)), 3)}
    for t in ('tail1', 'tail2', 'tail3'):
        if t in g:
            c = resample(curve(t, 1))
            out['cauda'].append(np.round(c - c.mean(), 3).tolist())
    return out


def main(out, *pairs):
    data = {}
    for p in pairs:
        name, path = p.split('=')
        data[name] = profile(json.load(open(path)))
    js = ('// =============================================================\n'
          '// JEITO DE ANDAR tirado de animações de verdade (gerado por\n'
          '// tools/models/passos_base.py). Para cada grupo de pernas: a curva\n'
          '// do giro (radianos, em volta da média) da coxa, joelho e pé durante\n'
          '// um passo; atraso = em que parte do passo a perna começa;\n'
          '// atraso_D = atraso da perna direita em relação à esquerda.\n'
          '// cauda = balanço de lado (tail1..3) durante o passo.\n'
          '// NÃO edite à mão: rode o script.\n'
          '// =============================================================\n'
          f'export const PASSOS = {json.dumps(data)};\n')
    open(out, 'w').write(js)
    for k, v in data.items():
        print(k, {g: (p['atraso'], p['atraso_D']) for g, p in v['pernas'].items()})


if __name__ == '__main__':
    main(*sys.argv[1:])
