"""
GRAMA estilo "campo denso": faz uma imagem (atlas) de tufos cheios de lâminas a partir do
FBX "AnimatedGrass". Cada tufo vira duas figuras (de frente e de lado, ~45 lâminas cada) que o
jogo cola em dois retângulos cruzados (em X), com recorte pela transparência. Assim cada tufo
tem dezenas de lâminas e custa só 4 triângulos.

Uso:  .blender-env/bin/python tools/models/grama_atlas.py -- caminho/AnimatedGrass.fbx
Saída: src/world/imported/grama_atlas.js
"""
import base64, io, random, sys
import bpy
import bmesh
import numpy as np
from PIL import Image, ImageDraw

SRC = sys.argv[-1]
OUT = 'src/world/imported/grama_atlas.js'
ALTURA_M = 0.30       # altura mediana das lâminas (m)
JANELA_L = 0.64       # largura do recorte (m)
JANELA_A = 0.46       # altura do recorte (m)
CEL = 256             # pixels de cada figura
VARIANTES = 4
LADO_SEL = 0.50       # tamanho do quadrado de lâminas de cada tufo (m)
SS = 2                # desenha em dobro e reduz (bordas suaves)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.wm.fbx_import(filepath=SRC)
o = next(x for x in bpy.data.objects if x.type == 'MESH')
d = o.data
mw = np.array(o.matrix_world)
V = np.array([list(v.co) for v in d.vertices])
W = (np.c_[V, np.ones(len(V))] @ mw.T)[:, :3]
W = np.c_[W[:, 0], W[:, 2], -W[:, 1]]

bm = bmesh.new()
bm.from_mesh(d)
seen = set()
blades = []   # cada uma: lista de triângulos (3x3)
for f in bm.faces:
    if f.index in seen:
        continue
    stack = [f]; seen.add(f.index); faces = []
    while stack:
        a = stack.pop(); faces.append(a)
        for e in a.edges:
            for b in e.link_faces:
                if b.index not in seen:
                    seen.add(b.index); stack.append(b)
    tris = []
    for fc in faces:
        vs = [W[v.index] for v in fc.verts]
        for k in range(1, len(vs) - 1):
            tris.append(np.array([vs[0], vs[k], vs[k + 1]]))
    P = np.vstack(tris)
    blades.append(dict(tris=tris, y0=P[:, 1].min(), h=P[:, 1].max() - P[:, 1].min(), c=P.mean(0)))

med = float(np.median([b['h'] for b in blades]))
sc = ALTURA_M / med
for b in blades:
    b['tris'] = [t * sc for t in b['tris']]
    b['c'] = b['c'] * sc
    b['y0'] *= sc
    b['h'] *= sc
print('lâminas', len(blades), 'escala', round(sc, 3))
C = np.array([[b['c'][0], b['c'][2]] for b in blades])
base_col = np.array([45, 74, 28]); mid_col = np.array([93, 138, 48]); tip_col = np.array([157, 187, 85])

def cor(t, var):
    t = min(1.0, max(0.0, t))
    c = base_col + (mid_col - base_col) * (t / 0.5) if t < 0.5 else mid_col + (tip_col - mid_col) * ((t - 0.5) / 0.5)
    return tuple(int(min(255, max(0, v * var))) for v in c)

def figura(sel, cx, cz, vista, rnd):
    S = CEL * SS
    im = Image.new('RGBA', (S, S), (60, 100, 36, 0))
    dr = ImageDraw.Draw(im)
    # as de trás primeiro
    ordem = sorted(sel, key=lambda b: (b['c'][2] if vista == 'f' else b['c'][0]) * (1 if vista == 'f' else 1), reverse=True)
    for b in ordem:
        var = 0.8 + rnd.random() * 0.4
        prof = (b['c'][2] - cz) if vista == 'f' else (b['c'][0] - cx)
        sombra = 0.82 + 0.18 * min(1, max(0, 0.5 - prof / (LADO_SEL * 1.0)))  # o fundo um pouco mais escuro
        for t in b['tris']:
            pts = []
            for p in t:
                u = ((p[0] - cx) if vista == 'f' else (p[2] - cz)) / JANELA_L + 0.5
                v = 1.0 - (p[1] / JANELA_A)
                pts.append((u * S, v * S))
            h = (t[:, 1].mean() - b['y0']) / max(1e-6, b['h'])
            dr.polygon(pts, fill=cor(h, var * sombra) + (255,))
    return im.resize((CEL, CEL), Image.LANCZOS)

rnd = random.Random(11)
atlas = Image.new('RGBA', (CEL * 4, CEL * 2), (60, 100, 36, 0))
usados = []
v = 0
tent = 0
while v < VARIANTES and tent < 500:
    tent += 1
    i = rnd.randrange(len(blades))
    cx, cz = C[i]
    if any(np.hypot(cx - ux, cz - uz) < LADO_SEL for ux, uz in usados):
        continue
    sel = [b for b, (x, z) in zip(blades, C) if abs(x - cx) < LADO_SEL / 2 and abs(z - cz) < LADO_SEL / 2]
    if len(sel) < 35:
        continue
    usados.append((cx, cz))
    atlas.paste(figura(sel, cx, cz, 'f', rnd), ((v % 4) * CEL, 0))
    atlas.paste(figura(sel, cx, cz, 's', rnd), ((v % 4) * CEL, CEL))
    print('variante', v, 'lâminas', len(sel))
    v += 1
# para a imagem ficar menor: tabela de 256 cores com transparência
q = atlas.quantize(colors=96, method=Image.FASTOCTREE, dither=Image.NONE)
buf = io.BytesIO()
q.save(buf, 'PNG', optimize=True)  # imagem de paleta (pequena) com transparência
png = buf.getvalue()
print('atlas PNG', len(png) // 1024, 'KB')
atlas.save('/tmp/claude-0/ajuda/atlas_grama.png')
with open(OUT, 'w') as fh:
    fh.write('// GRAMA – atlas de tufos cheios (figuras de frente e de lado) tirado do modelo "AnimatedGrass" (enviado pelo jogador).\n')
    fh.write('// Gerado por tools/models/grama_atlas.py (não editar à mão). Linha de cima = de frente, de baixo = de lado; uma variante por coluna.\n')
    fh.write("export default { png: 'data:image/png;base64,%s', cols: 4, rows: 2, largura: %s, altura: %s };\n" % (base64.b64encode(png).decode(), JANELA_L, JANELA_A))
