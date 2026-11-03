"""
GRAMA do jogo a partir do FBX "AnimatedGrass" (um trecho de campo com ~7700 lâminas).
Tira cada lâmina do trecho, guarda só o essencial (base, meio, ponta, largura) e monta
tufos de 5 lâminas vizinhas. Saída: src/world/imported/grama_tufos.js (poucos números).

Uso:  .blender-env/bin/python tools/models/grama_fbx.py caminho/AnimatedGrass.fbx
"""
import json, random, sys
import bpy
import bmesh
import numpy as np

SRC = sys.argv[sys.argv.index('--') + 1] if '--' in sys.argv else sys.argv[-1]
OUT = 'src/world/imported/grama_tufos.js'
ALTURA_M = 0.28        # altura mediana das lâminas, em metros (o jogo escala por tufo)
LAMINAS = 5            # pontas de grama por tufo
VARIANTES = 6

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.wm.fbx_import(filepath=SRC)
o = next(x for x in bpy.data.objects if x.type == 'MESH')
d = o.data
mw = np.array(o.matrix_world)
V = np.array([list(v.co) for v in d.vertices])
W = (np.c_[V, np.ones(len(V))] @ mw.T)[:, :3]
W = np.c_[W[:, 0], W[:, 2], -W[:, 1]]  # Z para cima (Blender) -> Y para cima

bm = bmesh.new()
bm.from_mesh(d)
seen = set()
blades = []
for f in bm.faces:
    if f.index in seen:
        continue
    stack = [f]; seen.add(f.index); vs = set()
    while stack:
        a = stack.pop()
        for vv in a.verts:
            vs.add(vv.index)
        for e in a.edges:
            for b in e.link_faces:
                if b.index not in seen:
                    seen.add(b.index); stack.append(b)
    P = W[list(vs)]
    y0, y1 = P[:, 1].min(), P[:, 1].max()
    h = y1 - y0
    if h <= 0:
        continue
    base = P[P[:, 1] < y0 + 0.14 * h]
    B = base.mean(0); B[1] = y0
    # direção da largura: eixo principal do pé da lâmina no chão
    xz = base[:, [0, 2]] - base[:, [0, 2]].mean(0)
    if len(xz) >= 2 and np.linalg.norm(xz) > 1e-9:
        u, s, vt = np.linalg.svd(xz, full_matrices=False)
        dirv = vt[0]
        wB = float(np.ptp(xz @ dirv))
    else:
        T0 = P[P[:, 1].argmax()]
        lean = np.array([T0[0] - B[0], T0[2] - B[2]])
        dirv = np.array([-lean[1], lean[0]]); dirv /= (np.linalg.norm(dirv) or 1)
        wB = 0.0
    midp = P[(P[:, 1] > y0 + 0.4 * h) & (P[:, 1] < y0 + 0.6 * h)]
    M = midp.mean(0) if len(midp) else (B + P[P[:, 1].argmax()]) / 2
    wM = float(np.ptp((midp[:, [0, 2]] @ dirv))) if len(midp) > 1 else wB * 0.7
    T = P[P[:, 1].argmax()]
    blades.append(dict(B=B, M=M, T=T, d=dirv, wB=wB, wM=wM, h=h))

H = np.array([b['h'] for b in blades])
med = float(np.median(H))
keep = [b for b in blades if 0.55 * med < b['h'] < 1.6 * med]
sc = ALTURA_M / med
print('lâminas', len(blades), 'usadas', len(keep), 'altura mediana (unid.)', round(med, 3), 'escala', round(sc, 4))

rnd = random.Random(7)
bases = np.array([[b['B'][0], b['B'][2]] for b in keep])
tufos = []
used = set()
tries = 0
while len(tufos) < VARIANTES and tries < 400:
    tries += 1
    i = rnd.randrange(len(keep))
    dist = np.hypot(bases[:, 0] - bases[i, 0], bases[:, 1] - bases[i, 1])
    near = np.argsort(dist)[:LAMINAS]
    if any(n in used for n in near) or dist[near].max() * sc > 0.16:  # lâminas bem juntas (até ~16 cm)
        continue
    used.update(int(n) for n in near)
    c = bases[near].mean(0)
    out = []
    for n in near:
        b = keep[n]
        mv = lambda p: [round(float((p[0] - c[0]) * sc), 4), round(float((p[1] - 0.0) * sc), 4), round(float((p[2] - c[1]) * sc), 4)]
        Bp = b['B'].copy(); Bp[1] = 0.0
        mid = b['M'].copy(); mid[1] = (b['M'][1] - b['B'][1])
        tip = b['T'].copy(); tip[1] = (b['T'][1] - b['B'][1])
        out.append(dict(
            b=mv(Bp), m=[round(float((mid[0] - c[0]) * sc), 4), round(float(mid[1] * sc), 4), round(float((mid[2] - c[1]) * sc), 4)],
            t=[round(float((tip[0] - c[0]) * sc), 4), round(float(tip[1] * sc), 4), round(float((tip[2] - c[1]) * sc), 4)],
            d=[round(float(b['d'][0]), 3), round(float(b['d'][1]), 3)],
            w=[round(max(0.03, b['wB'] * sc), 4), round(max(0.022, b['wM'] * sc), 4)]))
    tufos.append(out)
print('tufos', len(tufos), 'de', LAMINAS, 'lâminas')
with open(OUT, 'w') as f:
    f.write('// GRAMA – tufos de 5 lâminas tirados do modelo "AnimatedGrass" (enviado pelo jogador).\n')
    f.write('// Cada lâmina: b = pé, m = meio, t = ponta (metros, y para cima), d = direção da largura (x, z), w = largura no pé e no meio.\n')
    f.write('// Gerado por tools/models/grama_fbx.py (não editar à mão).\n')
    f.write('export default ' + json.dumps(tufos, separators=(',', ':')) + ';\n')
