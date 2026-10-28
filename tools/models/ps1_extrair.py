"""Extrai a malha do personagem PS1 (.usdz) com o Blender (sem tela) e separa por partes do corpo.

Uso: .blender-env/bin/python tools/models/ps1_extrair.py <scene.usdc> <saida.npz> [altura_m]
Cada face vai para a parte do corpo cujos ossos mais pesam nos vértices dela. O modelo é virado
180° (o personagem do USD olha para +z; no jogo a frente é -z) e escalado para `altura_m`.
"""
import sys

import bpy
import numpy as np

arq, saida = sys.argv[-3] if len(sys.argv) > 3 and not sys.argv[-1].replace('.', '').isdigit() else sys.argv[-2], None
args = [a for a in sys.argv[sys.argv.index('--') + 1:]] if '--' in sys.argv else sys.argv[-3:]
arq, saida = args[0], args[1]
altura = float(args[2]) if len(args) > 2 else 1.78

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.wm.usd_import(filepath=arq)
obj = [o for o in bpy.data.objects if o.type == 'MESH'][0]
arm = [o for o in bpy.data.objects if o.type == 'ARMATURE'][0]
M = np.array(obj.matrix_world)
me = obj.data
P0 = np.array([(M @ np.append(np.array(v.co), 1.0))[:3] for v in me.vertices])
h0 = P0[:, 1].max() - P0[:, 1].min()
s = altura / h0
def tr(p):
    p = np.asarray(p, float)
    return np.stack([-p[..., 0] * s, p[..., 1] * s, -p[..., 2] * s], -1)
P = tr(P0)
nomes = {g.index: g.name for g in obj.vertex_groups}
PARTES = {
    'head': ['n11', 'n12'],
    'torso': ['n8', 'n9', 'n10', 'n14', 'n23'],
    'armL': ['n15', 'n16', 'n17', 'n21'],
    'armR': ['n24', 'n25', 'n26', 'n30'],
    'legL': ['n32', 'n33', 'n34'],
    'legR': ['n36', 'n37', 'n38'],
}
chaves = list(PARTES)
osso_parte = {b: i for i, k in enumerate(chaves) for b in PARTES[k]}
W = np.zeros((len(me.vertices), len(chaves)))
for v in me.vertices:
    for g in v.groups:
        b = nomes[g.group]
        if b in osso_parte:
            W[v.index, osso_parte[b]] += g.weight
faces = np.array([[me.loops[l].vertex_index for l in p.loop_indices] for p in me.polygons], dtype=object)
uvl = me.uv_layers.active.data
# triangula (quads viram 2 triângulos)
tris, tuv, tparte = [], [], []
for p in me.polygons:
    vs = list(p.loop_indices)
    for k in range(1, len(vs) - 1):
        tri = [vs[0], vs[k], vs[k + 1]]
        tris.append([me.loops[l].vertex_index for l in tri])
        tuv.append([tuple(uvl[l].uv) for l in tri])
        wsum = sum(W[me.loops[l].vertex_index] for l in tri)
        tparte.append(int(np.argmax(wsum)))
ossos = {}
for b in arm.data.bones:
    ossos[b.name] = tr(np.array(arm.matrix_world @ b.head_local)).tolist()
np.savez(saida, P=P, tris=np.array(tris), uv=np.array(tuv), parte=np.array(tparte), chaves=np.array(chaves), escala=s,
         ossos=np.array([[k, *v] for k, v in ossos.items()], dtype=object))
print('verts', len(P), 'tris', len(tris), 'escala', s, 'altura', P[:, 1].max() - P[:, 1].min(), 'x', P[:, 0].min(), P[:, 0].max(), 'z', P[:, 2].min(), P[:, 2].max())
print({c: int((np.array(tparte) == i).sum()) for i, c in enumerate(chaves)})
for k in ('n11', 'n12', 'n15', 'n24', 'n32', 'n36'):
    print(k, np.round(ossos[k], 3))
