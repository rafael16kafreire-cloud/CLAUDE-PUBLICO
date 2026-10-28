"""
Grama e margarida do arquivo .blend enviado -> src/world/textures/veg_capim.js
Uso (Blender sem tela): .blender-env/bin/python tools/models/capim_blender.py arquivo.blend [saida.js]

O .blend tem 3 modelos sem textura (só cor por vértice): Grass_Basic_A (476 folhas soltas, 2.298 triângulos),
Grass_Basic_D (67 tufinhos, 1.467 triângulos) e Flower_Daisy_A (32 margaridas, 448 triângulos). Pesado demais
para um campo inteiro, então para cada um saem duas versões:
  perto  (hi):  só parte das folhas, um pouco mais largas
  médio  (lo):  bem menos folhas, bem mais largas (de longe parece o mesmo tufo)
A cor vem de Grass_bqm (verde) + atributo 'dry' (pontas secas); a margarida ganha pétalas brancas e miolo amarelo.
Altura 1 = altura do tufo; o jogo escala (vegetation.js).
"""
import base64
import json
import struct
import sys
import zlib

import bpy
import numpy as np

ARQ = sys.argv[-2] if sys.argv[-1].endswith('.js') else sys.argv[-1]
SAIDA = sys.argv[-1] if sys.argv[-1].endswith('.js') else 'src/world/textures/veg_capim.js'
bpy.ops.wm.open_mainfile(filepath=ARQ)

VERDE = np.array([0.34, 0.52, 0.07])      # Grass_bqm (linear), clareado para combinar com a grama do jogo
SECO = np.array([0.60, 0.48, 0.12])
CAULE = np.array([0.16, 0.38, 0.06])
PETALA = np.array([0.86, 0.86, 0.80])
MIOLO = np.array([0.80, 0.52, 0.03])


def b64(a):
    return base64.b64encode(np.ascontiguousarray(a).tobytes()).decode()


def malha(nome):
    o = bpy.data.objects[nome]
    d = o.data
    d.calc_loop_triangles()
    M = np.array(o.matrix_world)[:3, :3]
    v = np.array([list(x.co) for x in d.vertices]) @ M.T
    tris = np.array([list(t.vertices) for t in d.loop_triangles])
    attr = d.color_attributes[0]
    col = np.zeros((len(v), 3))
    cnt = np.zeros(len(v))
    for li, loop in enumerate(d.loops):
        col[loop.vertex_index] += np.array(attr.data[li].color[:3])
        cnt[loop.vertex_index] += 1
    col /= np.maximum(cnt, 1)[:, None]
    # no arquivo o "para cima" do tufo é o eixo X do mundo: vira (x, y, z) do jogo = (by, bx, -bz)
    up = v[:, 0]
    return v[:, [1, 0, 2]] * np.array([1, 1, -1]), up, tris, col[:, 0]


def componentes(n, tris):
    par = list(range(n))

    def f(a):
        while par[a] != a:
            par[a] = par[par[a]]
            a = par[a]
        return a
    for a, b, c in tris:
        par[f(b)] = f(a)
        par[f(c)] = f(a)
    grupos = {}
    for t in tris:
        grupos.setdefault(f(t[0]), []).append(t)
    return list(grupos.values())


def monta(nome, manter, largura, esticar, cor_fn, rng, tex='capim_bq', top_ref=None):
    """Escolhe 'manter' pedaços soltos, alarga cada um em volta do próprio centro e pinta."""
    v, up, tris, dry = malha(nome)
    comps = componentes(len(v), tris)
    if manter < len(comps):
        escolhidos = [comps[i] for i in rng.choice(len(comps), manter, replace=False)]
    else:
        escolhidos = comps
    V, F, C = [], [], []
    base = 0
    h0 = v[:, 1].min()
    alt = v[:, 1].max() - h0
    for comp in escolhidos:
        ids = sorted(set(np.array(comp).reshape(-1).tolist()))
        loc = {g: i for i, g in enumerate(ids)}
        p = v[ids].copy()
        cen = p.mean(0)
        p[:, [0, 2]] = cen[[0, 2]] + (p[:, [0, 2]] - cen[[0, 2]]) * largura  # alarga só na horizontal
        p[:, 1] = h0 + (p[:, 1] - h0) * esticar  # mais alta
        V.append(p)
        C.append(cor_fn(p, dry[ids], (p[:, 1] - h0) / (alt * esticar), rng))
        F.append(np.array([[loc[a] + base for a in t] for t in comp]))
        base += len(ids)
    V = np.vstack(V)
    F = np.vstack(F)
    C = np.vstack(C)
    # altura 1: divide pela altura do tufo
    q = V.copy()
    q[:, 1] = (q[:, 1] - h0)
    top = top_ref or q[:, 1].max()  # a versão média usa a altura da versão de perto (os dois ficam do mesmo tamanho)
    q = q / top
    lo, hi = q.min(0), q.max(0)
    return {
        'n': int(len(q)),
        'box': [*np.round(lo, 5).tolist(), *np.round(hi, 5).tolist()],
        'uvbox': [0.0, 0.0, 1.0, 1.0],
        'pos': b64(np.round((q - lo) / np.maximum(hi - lo, 1e-9) * 65535).astype('<u2')),
        'uv': b64(np.zeros((len(q), 2), dtype='<u2')),
        'idx': b64(F.reshape(-1).astype('<u2')),
        'tex': tex,
        'col': b64(np.round(np.clip(C, 0, 1) * 255).astype('u1')),
    }, float(top), int(len(F))


def cor_capim(p, dry, t, rng):
    # base mais escura, ponta mais clara e um pouco seca; cada folha varia de tom
    var = 0.85 + rng.random() * 0.3
    t = np.clip(t, 0, 1)[:, None]
    verde = VERDE * (0.8 + 0.9 * t) * var
    seco = SECO * (0.8 + 0.6 * t) * var
    d = np.clip(dry, 0, 1)[:, None] * 0.75
    return verde * (1 - d) + seco * d


def cor_margarida(p, dry, t, rng):
    c = np.tile(CAULE, (len(p), 1)) * (0.8 + 0.5 * np.clip(t, 0, 1)[:, None])
    top = p[:, 1].max()
    cabeca = p[:, 1] > top - 0.018 * max(1.0, (top - p[:, 1].min()) / 0.17)
    if cabeca.any():
        cen = p[cabeca].mean(0)
        raio = np.linalg.norm(p[cabeca][:, [0, 2]] - cen[[0, 2]], axis=1)
        r = raio.max() + 1e-9
        idx = np.where(cabeca)[0]
        for k, i in enumerate(idx):
            c[i] = MIOLO if raio[k] < 0.4 * r else PETALA
    return c


def main():
    rng = np.random.default_rng(5)
    modelos, alturas = {}, {}
    # (chave, objeto, folhas/pedaços mantidos, alargar, esticar vertical, cor)
    receitas = [
        ('capim_bq_a', 'Grass_Basic_A_spring-summer', 120, 1.35, 1.5, cor_capim),
        ('capim_bq_a_lo', 'Grass_Basic_A_spring-summer', 22, 2.6, 1.5, cor_capim),
        ('capim_bq_d', 'Grass_Basic_D_spring-summer', 30, 1.3, 1.5, cor_capim),
        ('capim_bq_d_lo', 'Grass_Basic_D_spring-summer', 8, 2.2, 1.5, cor_capim),
        ('margarida_bq', 'Flower_Daisy_A_spring-summer', 32, 1.0, 1.7, cor_margarida),
        ('margarida_bq_lo', 'Flower_Daisy_A_spring-summer', 12, 1.0, 1.7, cor_margarida),
    ]
    for chave, obj, manter, larg, esticar, cor in receitas:
        parte, top, ntri = monta(obj, manter, larg, esticar, cor, rng, top_ref=alturas.get(chave.replace('_lo', '')) if chave.endswith('_lo') else None)
        modelos[chave] = [parte]
        alturas[chave] = round(top, 4)
        print(f'{chave:18} triângulos={ntri:4d} altura(original)={top:.3f}')
    # textura branca 4x4 (a cor vem dos vértices)
    raw = b''.join(b'\x00' + b'\xff\xff\xff\xff' * 4 for _ in range(4))

    def chunk(t, d):
        return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    png = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', 4, 4, 8, 6, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw)) + chunk(b'IEND', b'')
    texs = {'capim_bq': 'data:image/png;base64,' + base64.b64encode(png).decode()}
    with open(SAIDA, 'w', encoding='utf-8') as f:
        f.write('// Grama e margarida do .blend enviado (tools/models/capim_blender.py). Não editar à mão.\n')
        f.write(f'export const VEG_CAP_MODELOS = {json.dumps(modelos)};\n')
        f.write(f'export const VEG_CAP_TEXTURAS = {json.dumps(texs)};\n')
        f.write(f'export const VEG_CAP_ALTURA = {json.dumps(alturas)};\n')
    print('gravado', SAIDA)


main()
