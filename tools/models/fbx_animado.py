"""
BICHO ANIMADO .fbx (passo 1): malha, esqueleto, pesos e animação do AUTOR do modelo
-> pasta "cru" (cru.npz + cru.json), o mesmo formato do usd_animado.py (passo 2 em diante é igual).
Usa o Blender sem tela (bpy 5.x: importador novo bpy.ops.wm.fbx_import).

Tudo em metros e com Y para cima (o Blender usa Z para cima: convertido aqui, como o USD):
  P, UV, F, MID   malha na pose de ligação (um vértice por par posição+UV)
  JI, JW          4 ossos e pesos por vértice
  parents, bind, frames   esqueleto (matrizes 4x4 em vetor-linha: p' = p @ M), 30 quadros por segundo

Uso: .blender-env/bin/python tools/models/fbx_animado.py modelo.fbx textura.png pasta_saida
"""
import json
import os
import shutil
import sys

import bpy
import numpy as np

FPS = 30


def main(src, tex, out):
    os.makedirs(out, exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.wm.fbx_import(filepath=src)
    arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
    mesh = next(o for o in bpy.data.objects if o.type == 'MESH')
    bones = list(arm.data.bones)
    nj = len(bones)
    idx = {b.name: i for i, b in enumerate(bones)}
    parents = np.array([idx[b.parent.name] if b.parent else -1 for b in bones])
    # Blender (x, y, z; Z para cima) -> Y para cima: (x, z, -y), em vetor-linha
    Ah = np.eye(4)
    Ah[:3, :3] = [[1, 0, 0], [0, 0, -1], [0, 1, 0]]
    Ai = np.linalg.inv(Ah)

    def row(m):  # matriz coluna do Blender (já em metros) -> vetor-linha, Y para cima
        return Ai @ np.array(m, dtype=np.float64).T @ Ah

    mw = np.array(arm.matrix_world)
    bind = np.array([row(arm.matrix_world @ b.matrix_local) for b in bones])

    # ---------- malha ----------
    d = mesh.data
    d.calc_loop_triangles()
    mmw = np.array(mesh.matrix_world)
    co = np.array([list(v.co) for v in d.vertices])
    w = (np.c_[co, np.ones(len(co))] @ mmw.T @ Ah)[:, :3]
    uvl = d.uv_layers[0].data
    # pesos: 4 maiores por vértice
    ji = np.zeros((len(co), 4), int)
    jw = np.zeros((len(co), 4))
    gname = {g.index: g.name for g in mesh.vertex_groups}
    for v in d.vertices:
        gs = sorted(((g.weight, idx[gname[g.group]]) for g in v.groups if gname.get(g.group) in idx), reverse=True)[:4]
        for k, (wt, j) in enumerate(gs):
            ji[v.index, k], jw[v.index, k] = j, wt
    jw /= np.maximum(jw.sum(1, keepdims=True), 1e-9)
    # um vértice por par (posição, UV)
    key2new, P, UV, JI, JW, F = {}, [], [], [], [], []
    for t in d.loop_triangles:
        tri = []
        for li, vi in zip(t.loops, t.vertices):
            u = tuple(np.round(uvl[li].uv, 5))
            k = (vi, u)
            if k not in key2new:
                key2new[k] = len(P)
                P.append(w[vi]); UV.append(u); JI.append(ji[vi]); JW.append(jw[vi])
            tri.append(key2new[k])
        F.append(tri)
    P, UV, JI, JW, F = np.array(P), np.array(UV), np.array(JI), np.array(JW), np.array(F)

    # ---------- animação: matriz de cada osso no mundo, quadro a quadro ----------
    sc = bpy.context.scene
    f0, f1 = int(sc.frame_start), int(sc.frame_end)
    act = bpy.data.actions[0] if bpy.data.actions else None
    if act:
        f0, f1 = int(act.frame_range[0]), int(act.frame_range[1])
    frames = []
    for f in range(f0, f1 + 1):
        sc.frame_set(f)
        bpy.context.view_layer.update()
        frames.append(np.array([row(arm.matrix_world @ arm.pose.bones[b.name].matrix) for b in bones]))
    frames = np.array(frames)

    shutil.copy(tex, os.path.join(out, 'textura.png'))
    np.savez(os.path.join(out, 'cru.npz'), P=P, UV=UV, F=F, MID=np.zeros(len(P), int), JI=JI, JW=JW,
             parents=parents, bind=bind, frames=frames)
    json.dump({'info': {'origem': os.path.basename(src)},
               'malhas': [{'nome': mesh.name, 'diffuseColor': os.path.join(out, 'textura.png'), 'normal': None, 'opacity': None}],
               'clip': 'Base Stack', 'fps': FPS, 'ossos': [b.name for b in bones], 'quadros_de_para': [f0, f1]},
              open(os.path.join(out, 'cru.json'), 'w'), indent=1)
    print(os.path.basename(src), 'vértices', len(P), 'triângulos', len(F), 'ossos', nj, 'quadros', len(frames), 'tamanho', (P.max(0) - P.min(0)).round(2).tolist())


if __name__ == '__main__':
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
    main(args[0], args[1], args[2])
