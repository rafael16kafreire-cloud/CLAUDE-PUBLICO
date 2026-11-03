# =============================================================
# CONVERSOR DE MODELO .usdz -> dados para o jogo (passo 1 de 2)
# Lê malha, coordenadas de textura, esqueleto e pesos do modelo e
# grava um JSON "cru" no espaço do jogo (Y para cima, cabeça
# para -Z, em metros). O passo 2 (usd_para_jogo.mjs) reduz os
# triângulos e cria o arquivo que o jogo usa.
#
# Uso (precisa de: pip install usd-core numpy):
#   python usd_extrair.py modelo.usdz saida.json comprimento_m
# =============================================================
import json
import sys
import zipfile
import tempfile
import os
import numpy as np
from pxr import Usd, UsdGeom, UsdSkel

src, out, length_m = sys.argv[1], sys.argv[2], float(sys.argv[3])
tmp = tempfile.mkdtemp()
zipfile.ZipFile(src).extractall(tmp)
usd = [f for f in os.listdir(tmp) if f.endswith(('.usdc', '.usda', '.usd'))][0]
stage = Usd.Stage.Open(os.path.join(tmp, usd))
layer = stage.GetRootLayer()
info = dict(layer.customLayerData or {})

skel = next(UsdSkel.Skeleton(p) for p in stage.Traverse() if p.GetTypeName() == 'Skeleton')
joints = [str(j) for j in skel.GetJointsAttr().Get()]
bind = skel.GetBindTransformsAttr().Get()
jpos = np.array([list(m.ExtractTranslation()) for m in bind])

P, UV, JI, JW, IDX = [], [], [], [], []
for prim in stage.Traverse():
    if prim.GetTypeName() != 'Mesh':
        continue
    mesh = UsdGeom.Mesh(prim)
    pv = UsdGeom.PrimvarsAPI(prim)
    pts = np.array(mesh.GetPointsAttr().Get(), dtype=np.float64)
    counts = np.array(mesh.GetFaceVertexCountsAttr().Get())
    fvi = np.array(mesh.GetFaceVertexIndicesAttr().Get())
    assert (counts == 3).all(), 'só triângulos'
    st = np.array(pv.GetPrimvar('st0').Get(), dtype=np.float64)
    assert pv.GetPrimvar('st0').GetInterpolation() == 'vertex'
    ji = pv.GetPrimvar('skel:jointIndices')
    jw = pv.GetPrimvar('skel:jointWeights')
    es = ji.GetElementSize()
    ji = np.array(ji.Get()).reshape(-1, es)
    jw = np.array(jw.Get(), dtype=np.float64).reshape(-1, es)
    gb = pv.GetPrimvar('skel:geomBindTransform')
    if gb and gb.Get() is not None:
        m = np.array(gb.Get())
        pts = np.c_[pts, np.ones(len(pts))] @ m
        pts = pts[:, :3]
    base = len(P)
    P.extend(pts.tolist())
    UV.extend(st.tolist())
    JI.extend(ji.tolist())
    JW.extend(jw.tolist())
    IDX.extend((fvi + base).tolist())

P = np.array(P)
jp = jpos.copy()
# virar para o jogo: a cabeça do modelo aponta para +Z; no jogo, -Z
P[:, 0] *= -1; P[:, 2] *= -1
jp[:, 0] *= -1; jp[:, 2] *= -1
# escala pelo comprimento e pés no chão (y = 0)
L = P[:, 2].max() - P[:, 2].min()
s = length_m / L
P *= s
jp *= s
ground = P[:, 1].min()
P[:, 1] -= ground
jp[:, 1] -= ground
# centraliza no quadril (primeiro osso) em x/z
cx, cz = jp[0, 0], jp[0, 2]
P[:, 0] -= cx; P[:, 2] -= cz
jp[:, 0] -= cx; jp[:, 2] -= cz
# o jogo usa v para cima (USD também); mantém
json.dump({
    'info': info,
    'joints': [j.split('/')[-1] for j in joints],
    'jointPos': jp.round(4).tolist(),
    'positions': P.round(4).tolist(),
    'uv': np.array(UV).round(5).tolist(),
    'jointIndices': JI,
    'jointWeights': np.array(JW).round(4).tolist(),
    'indices': IDX,
    'scale': s,
}, open(out, 'w'))
print('vértices', len(P), 'triângulos', len(IDX) // 3, 'escala', round(s, 4), 'altura', round(P[:, 1].max(), 2))
