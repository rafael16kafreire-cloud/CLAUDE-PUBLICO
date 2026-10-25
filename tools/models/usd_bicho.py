"""
CONVERSOR DE BICHO .usdz (passo 1 de 2): lê TODAS as malhas do modelo
(com ou sem esqueleto), as coordenadas de textura e a textura de cada
malha, e grava um .npz "cru" (posições no espaço do modelo, em
triângulos). O passo 2 (bicho_para_jogo.py) vira, encaixa os ossos do
jogo e gera o arquivo do jogo.

Uso (usd-core, numpy):
  python usd_bicho.py modelo.usdz pasta_saida
"""
import json
import os
import sys
import zipfile

import numpy as np
from pxr import Usd, UsdGeom, UsdShade, UsdSkel


def texture_of(prim, root):
    """Arquivo da textura de cor (e de relevo) ligada à malha."""
    mat, _ = UsdShade.MaterialBindingAPI(prim).ComputeBoundMaterial()
    found = {}
    if not mat:
        return found
    for p in Usd.PrimRange(mat.GetPrim()):
        sh = UsdShade.Shader(p)
        if not sh or sh.GetIdAttr().Get() != 'UsdUVTexture':
            continue
        f = sh.GetInput('file').Get()
        if f is None:
            continue
        path = os.path.join(root, str(f.path))
        # para qual entrada do material essa textura vai
        for q in Usd.PrimRange(mat.GetPrim()):
            s2 = UsdShade.Shader(q)
            if not s2:
                continue
            for inp in s2.GetInputs():
                for src in inp.GetConnectedSources()[0]:
                    if src.source.GetPrim() == p:
                        found.setdefault(inp.GetBaseName(), path)
    return found


def main(src, outdir):
    os.makedirs(outdir, exist_ok=True)
    zipfile.ZipFile(src).extractall(outdir)
    usd = [f for f in os.listdir(outdir) if f.endswith(('.usdc', '.usda', '.usd'))][0]
    st = Usd.Stage.Open(os.path.join(outdir, usd))
    info = {k: str(v) for k, v in (st.GetRootLayer().customLayerData or {}).items()}
    P, UV, F, MID = [], [], [], []
    texs = []
    base = 0
    for prim in st.Traverse():
        if not prim.IsA(UsdGeom.Mesh):
            continue
        if UsdGeom.Imageable(prim).ComputeVisibility() == 'invisible':
            continue
        m = UsdGeom.Mesh(prim)
        pts = np.array(m.GetPointsAttr().Get() or [], dtype=np.float64)
        if not len(pts):
            continue
        counts = np.array(m.GetFaceVertexCountsAttr().Get())
        fvi = np.array(m.GetFaceVertexIndicesAttr().Get())
        # posição no mundo: malha com esqueleto usa a pose de ligação
        skb = UsdSkel.BindingAPI(prim)
        gb = UsdGeom.PrimvarsAPI(prim).GetPrimvar('skel:geomBindTransform')
        skel = skb.GetSkeletonRel().GetTargets() if skb else []
        if gb and gb.Get() is not None and skel:
            xf = np.array(gb.Get()) @ np.array(UsdGeom.Xformable(st.GetPrimAtPath(skel[0])).ComputeLocalToWorldTransform(0))
        else:
            xf = np.array(UsdGeom.Xformable(prim).ComputeLocalToWorldTransform(0))
        w = (np.c_[pts, np.ones(len(pts))] @ xf)[:, :3]
        # coordenadas de textura (vertex ou faceVarying)
        pv = UsdGeom.PrimvarsAPI(prim)
        uvp = next((p for p in pv.GetPrimvars() if str(p.GetTypeName()) in ('texCoord2f[]', 'float2[]')), None)
        uv = np.array(uvp.ComputeFlattened(), dtype=np.float64) if uvp else np.zeros((len(pts), 2))
        interp = uvp.GetInterpolation() if uvp else 'vertex'
        # cantos de cada face -> triângulos (leque)
        corners = []
        off = 0
        for c in counts:
            for k in range(1, c - 1):
                corners.append((off, off + k, off + k + 1))
            off += c
        corners = np.array(corners)
        if interp == 'faceVarying':
            # um vértice por canto, depois junta os iguais
            cp = w[fvi]
            key = np.c_[np.round(cp, 5), np.round(uv, 5)]
            _, first, inv = np.unique(key, axis=0, return_index=True, return_inverse=True)
            inv = inv.reshape(-1)
            vp, vuv = cp[first], uv[first]
            tri = inv[corners]
        else:
            vp, vuv = w, uv
            tri = fvi[corners]
        tex = texture_of(prim, outdir)
        mid = len(texs)
        texs.append({'nome': prim.GetName(), **tex})
        P.append(vp)
        UV.append(vuv)
        F.append(tri + base)
        MID.append(np.full(len(vp), mid))
        base += len(vp)
    P = np.concatenate(P)
    np.savez(os.path.join(outdir, 'cru.npz'), P=P, UV=np.concatenate(UV), F=np.concatenate(F), MID=np.concatenate(MID))
    json.dump({'info': info, 'malhas': texs, 'up': UsdGeom.GetStageUpAxis(st)}, open(os.path.join(outdir, 'cru.json'), 'w'), indent=1)
    ext = P.max(0) - P.min(0)
    print(os.path.basename(src), 'vértices', len(P), 'triângulos', base and sum(len(f) for f in F), 'tamanho', ext.round(2).tolist())
    for t in texs:
        print('   ', {k: os.path.basename(v) if k != 'nome' else v for k, v in t.items()})


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
