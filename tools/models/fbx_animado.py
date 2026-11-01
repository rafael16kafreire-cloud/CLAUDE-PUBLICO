"""
BICHO ANIMADO .fbx (passo 1): malha, esqueleto, pesos e animação do AUTOR do modelo
-> pasta "cru" (cru.npz + cru.json), o mesmo formato do usd_animado.py (passo 2 em diante é igual).
Usa o Blender sem tela (bpy 5.x: importador novo bpy.ops.wm.fbx_import).

Tudo em metros e com Y para cima (o Blender usa Z para cima: convertido aqui, como o USD):
  P, UV, F, MID   malha na pose de ligação (um vértice por par posição+UV)
  JI, JW          4 ossos e pesos por vértice
  parents, bind, frames   esqueleto (matrizes 4x4 em vetor-linha: p' = p @ M), 30 quadros por segundo

Uso: .blender-env/bin/python tools/models/fbx_animado.py modelo.fbx pasta_saida opcoes.json
  opcoes.json: {"texturas": {"nome do material": "arquivo.png", ...}, "manter": ["osso", ...]}
  manter = ossos que ficam (o peso dos outros, como dedos, língua e lábios, vai para o osso que fica mais perto, acima deles)
"""
import json
import os
import shutil
import sys

import bpy
import numpy as np

FPS = 30


def main(src, out, opc):
    os.makedirs(out, exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    if src.lower().endswith('.stl'):
        bpy.ops.wm.stl_import(filepath=src)
    else:
        bpy.ops.wm.fbx_import(filepath=src)
    arm = next((o for o in bpy.data.objects if o.type == 'ARMATURE'), None)  # sem esqueleto: modelo estático (o jogo encaixa o dele)
    mesh = next(o for o in bpy.data.objects if o.type == 'MESH')
    bones = list(arm.data.bones) if arm else []
    nj = len(bones)
    idx = {b.name: i for i, b in enumerate(bones)}
    parents = np.array([idx[b.parent.name] if b.parent else -1 for b in bones])
    # Blender (x, y, z; Z para cima) -> Y para cima: (x, z, -y), em vetor-linha
    Ah = np.eye(4)
    Ah[:3, :3] = [[1, 0, 0], [0, 0, -1], [0, 1, 0]]
    Ai = np.linalg.inv(Ah)

    def row(m):  # matriz coluna do Blender (já em metros) -> vetor-linha, Y para cima
        return Ai @ np.array(m, dtype=np.float64).T @ Ah

    bind = np.array([row(arm.matrix_world @ b.matrix_local) for b in bones]) if arm else np.zeros((0, 4, 4))

    # ---------- malha ----------
    d = mesh.data
    d.calc_loop_triangles()
    mmw = np.array(mesh.matrix_world)
    co = np.array([list(v.co) for v in d.vertices])
    w = (np.c_[co, np.ones(len(co))] @ mmw.T @ Ah)[:, :3]
    uvl = d.uv_layers[0].data if d.uv_layers else None  # sem UV (ex.: dodô sem textura): zeros
    # pesos: 4 maiores por vértice
    # ossos que ficam: o peso dos outros vai para o ancestral mais perto que fica
    manter = set(opc.get('manter') or [b.name for b in bones])
    gname = {g.index: g.name for g in mesh.vertex_groups}
    alvo = {}
    for b in bones:
        a = b
        while a is not None and a.name not in manter:
            a = a.parent
        alvo[b.name] = idx[a.name] if a is not None else 0
    ji = np.zeros((len(co), 4), int)
    jw = np.zeros((len(co), 4))
    gname = {g.index: g.name for g in mesh.vertex_groups}
    for v in d.vertices:
        acc = {}
        for g in v.groups:
            n = gname.get(g.group)
            if n in idx:
                acc[alvo[n]] = acc.get(alvo[n], 0.0) + g.weight
        gs = sorted(((wt, j) for j, wt in acc.items()), reverse=True)[:4]
        for k, (wt, j) in enumerate(gs):
            ji[v.index, k], jw[v.index, k] = j, wt
    jw /= np.maximum(jw.sum(1, keepdims=True), 1e-9)
    # um vértice por par (posição, UV)
    key2new, P, UV, JI, JW, F, MID = {}, [], [], [], [], [], []
    for t in d.loop_triangles:
        tri = []
        for li, vi in zip(t.loops, t.vertices):
            u = tuple(np.round(uvl[li].uv, 5)) if uvl is not None else (0.0, 0.0)
            k = (vi, u)
            if k not in key2new:
                key2new[k] = len(P)
                P.append(w[vi]); UV.append(u); JI.append(ji[vi]); JW.append(jw[vi]); MID.append(t.material_index)
            tri.append(key2new[k])
        F.append(tri)
    P, UV, JI, JW, F, MID = np.array(P), np.array(UV), np.array(JI), np.array(JW), np.array(F), np.array(MID)

    # asas abertas em T (modelo estático): dobra para baixo em volta do ombro
    asas = opc.get('dobrar_asas')
    if asas:
        a0, yp = asas['x0'], asas['y']
        ang = np.radians(asas.get('graus', 85))
        dx = np.abs(P[:, 0]) - a0
        sel = dx > 0
        t = np.clip(dx / 0.8, 0, 1)
        t = t * t * (3 - 2 * t)
        a = ang * np.where(sel, t, 0)
        dy = P[:, 1] - yp
        nx = dx * np.cos(a) + dy * np.sin(a)
        ny = -dx * np.sin(a) + dy * np.cos(a)
        P[sel, 0] = np.sign(P[sel, 0]) * (a0 + nx[sel])
        P[sel, 1] = yp + ny[sel]
    # ---------- animação: matriz de cada osso no mundo, quadro a quadro ----------
    sc = bpy.context.scene
    f0, f1 = int(sc.frame_start), int(sc.frame_end)
    act = bpy.data.actions[0] if bpy.data.actions else None
    if act:
        f0, f1 = int(act.frame_range[0]), int(act.frame_range[1])
    if not act:  # sem animação: só a pose de ligação
        f1 = f0
    frames = []
    for f in (range(f0, f1 + 1) if arm else []):
        sc.frame_set(f)
        bpy.context.view_layer.update()
        frames.append(np.array([row(arm.matrix_world @ arm.pose.bones[b.name].matrix) for b in bones]))
    frames = np.array(frames) if frames else np.zeros((1, 0, 4, 4))

    np.savez(os.path.join(out, 'cru.npz'), P=P, UV=UV, F=F, MID=MID, JI=JI, JW=JW,
             parents=parents, bind=bind, frames=frames)
    json.dump({'info': {'origem': os.path.basename(src)},
               'malhas': ([{'nome': m.name if m else f'material{i}', 'diffuseColor': (opc.get('texturas') or {}).get(m.name if m else '', None), 'normal': None, 'opacity': None}
                           for i, m in enumerate(d.materials)]
                          or [{'nome': 'cor', 'diffuseColor': (opc.get('texturas') or {}).get('*'), 'normal': None, 'opacity': None}]),
               'clip': 'Base Stack', 'fps': FPS, 'ossos': [b.name for b in bones], 'quadros_de_para': [f0, f1]},
              open(os.path.join(out, 'cru.json'), 'w'), indent=1)
    print(os.path.basename(src), 'vértices', len(P), 'triângulos', len(F), 'ossos', nj, 'quadros', len(frames), 'tamanho', (P.max(0) - P.min(0)).round(2).tolist())


if __name__ == '__main__':
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
    main(args[0], args[1], json.load(open(args[2])) if len(args) > 2 else {})
