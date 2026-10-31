"""
BICHO ANIMADO .usdz (passo 1): lê a malha, o esqueleto ORIGINAL, os
pesos e a animação que vem no arquivo, e grava um .npz "cru".
Diferente do usd_bicho.py (que só pega a malha e depois o jogo inventa
os ossos), aqui os ossos e o movimento são os do autor do modelo.

Tudo sai no espaço do mundo do arquivo (metros):
  P, UV, F, MID      malha na pose de ligação (como usd_bicho.py)
  JI, JW             4 ossos e pesos por vértice
  parents            pai de cada osso (-1 = raiz)
  bind               matriz 4x4 de cada osso na pose de ligação
  frames             matrizes 4x4 de cada osso em cada quadro (30/s)
(convenção do USD: vetor linha, p' = p @ M)

Uso (usd-core, numpy):
  python usd_animado.py modelo.usdz pasta_saida
"""
import json
import os
import sys
import zipfile

import numpy as np
from pxr import Gf, Usd, UsdGeom, UsdSkel

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from usd_bicho import texture_of  # noqa: E402

FPS = 30


def main(src, outdir):
    os.makedirs(outdir, exist_ok=True)
    zipfile.ZipFile(src).extractall(outdir)
    usd = [f for f in os.listdir(outdir) if f.endswith(('.usdc', '.usda', '.usd'))][0]
    st = Usd.Stage.Open(os.path.join(outdir, usd))
    info = {k: str(v) for k, v in (st.GetRootLayer().customLayerData or {}).items()}
    cache = UsdSkel.Cache()
    skel_prim = next(p for p in st.Traverse() if p.IsA(UsdSkel.Skeleton))
    root = next(p for p in st.Traverse() if p.IsA(UsdSkel.Root))
    cache.Populate(UsdSkel.Root(root), Usd.TraverseInstanceProxies())
    sq = cache.GetSkelQuery(UsdSkel.Skeleton(skel_prim))
    topo = sq.GetTopology()
    nj = topo.GetNumJoints()
    parents = np.array([topo.GetParent(i) for i in range(nj)])
    X = np.array(UsdGeom.Xformable(skel_prim).ComputeLocalToWorldTransform(0))
    bind = np.array([np.array(m) for m in sq.GetJointWorldBindTransforms()]) @ X

    P, UV, F, MID, JI, JW = [], [], [], [], [], []
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
        skq = cache.GetSkinningQuery(prim)
        counts = np.array(m.GetFaceVertexCountsAttr().Get())
        fvi = np.array(m.GetFaceVertexIndicesAttr().Get())
        gb = np.array(skq.GetGeomBindTransform()) if skq else np.eye(4)
        w = (np.c_[pts, np.ones(len(pts))] @ gb @ X)[:, :3]
        # ossos e pesos de cada ponto (na ordem do esqueleto)
        ji = np.zeros((len(pts), 4), int)
        jw = np.zeros((len(pts), 4))
        if skq:
            idx, wt = skq.ComputeJointInfluences()
            k = skq.GetNumInfluencesPerComponent()
            idx = np.array(idx).reshape(-1, k)
            wt = np.array(wt).reshape(-1, k)
            mapper = skq.GetJointMapper()
            if mapper and not mapper.IsIdentity():
                order = list(skq.GetJointOrder())
                names = [str(j) for j in sq.GetJointOrder()]
                lut = np.array([names.index(str(j)) for j in order])
                idx = lut[idx]
            if skq.IsRigidlyDeformed():
                idx = np.repeat(idx, len(pts), 0)
                wt = np.repeat(wt, len(pts), 0)
            top = np.argsort(-wt, 1)[:, :4]
            ji[:, :min(4, k)] = np.take_along_axis(idx, top, 1)
            jw[:, :min(4, k)] = np.take_along_axis(wt, top, 1)
            jw /= np.maximum(jw.sum(1, keepdims=True), 1e-9)
        pv = UsdGeom.PrimvarsAPI(prim)
        uvp = next((p for p in pv.GetPrimvars() if str(p.GetTypeName()) in ('texCoord2f[]', 'float2[]')), None)
        uv = np.array(uvp.ComputeFlattened(), dtype=np.float64) if uvp else np.zeros((len(pts), 2))
        interp = uvp.GetInterpolation() if uvp else 'vertex'
        corners = []
        off = 0
        for c in counts:
            for q in range(1, c - 1):
                corners.append((off, off + q, off + q + 1))
            off += c
        corners = np.array(corners)
        if interp == 'faceVarying':
            cp = w[fvi]
            key = np.c_[np.round(cp, 5), np.round(uv, 5)]
            _, first, inv = np.unique(key, axis=0, return_index=True, return_inverse=True)
            inv = inv.reshape(-1)
            vp, vuv = cp[first], uv[first]
            vji, vjw = ji[fvi][first], jw[fvi][first]
            tri = inv[corners]
        else:
            vp, vuv, vji, vjw = w, uv, ji, jw
            tri = fvi[corners]
        texs.append({'nome': prim.GetName(), **texture_of(prim, outdir)})
        P.append(vp)
        UV.append(vuv)
        F.append(tri + base)
        MID.append(np.full(len(vp), len(texs) - 1))
        JI.append(vji)
        JW.append(vjw)
        base += len(vp)

    # animação: matrizes de cada osso no mundo, quadro a quadro
    t0, t1 = st.GetStartTimeCode(), st.GetEndTimeCode()
    tps = st.GetTimeCodesPerSecond() or 24
    # muitos arquivos do Sketchfab não ligam a animação ao esqueleto:
    # usa a primeira SkelAnimation do arquivo, pelos nomes dos ossos
    anim_prim = next((p for p in st.Traverse() if p.IsA(UsdSkel.Animation)), None)
    clip = anim_prim.GetName() if anim_prim else 'pose'
    anim = UsdSkel.Animation(anim_prim) if anim_prim else None
    skel_joints = [str(j) for j in UsdSkel.Skeleton(skel_prim).GetJointsAttr().Get()]
    rest = np.array([np.array(m) for m in (UsdSkel.Skeleton(skel_prim).GetRestTransformsAttr().Get() or [])])
    if not len(rest):
        rest = np.array([np.array(m) for m in sq.ComputeJointLocalTransforms(0, True)])
    slot = [skel_joints.index(str(j)) if str(j) in skel_joints else -1 for j in anim.GetJointsAttr().Get()] if anim else []
    n = max(1, int(round((t1 - t0) / tps * FPS)) + 1)
    frames = []
    for i in range(n):
        t = Usd.TimeCode(t0 + i * tps / FPS)
        loc = rest.copy()
        if anim:
            T = anim.GetTranslationsAttr().Get(t)
            R = anim.GetRotationsAttr().Get(t)
            S = anim.GetScalesAttr().Get(t)
            for k, j in enumerate(slot):
                if j < 0:
                    continue
                m = Gf.Matrix4d(1)
                if S is not None:
                    m.SetScale(Gf.Vec3d(S[k]))
                r = Gf.Matrix4d(1)
                if R is not None:
                    r.SetRotate(Gf.Quatd(R[k]))
                m = m * r
                if T is not None:
                    m.SetTranslateOnly(Gf.Vec3d(T[k]))
                loc[j] = np.array(m)
        world = np.zeros_like(loc)
        for j in range(nj):  # pai sempre vem antes do filho
            world[j] = loc[j] if parents[j] < 0 else loc[j] @ world[parents[j]]
        frames.append(world @ X)
    frames = np.array(frames)

    np.savez(os.path.join(outdir, 'cru.npz'), P=np.concatenate(P), UV=np.concatenate(UV), F=np.concatenate(F),
             MID=np.concatenate(MID), JI=np.concatenate(JI), JW=np.concatenate(JW),
             parents=parents, bind=bind, frames=frames)
    names = [str(j).split('/')[-1] for j in sq.GetJointOrder()]
    json.dump({'info': info, 'malhas': texs, 'clip': clip, 'fps': FPS, 'ossos': names},
              open(os.path.join(outdir, 'cru.json'), 'w'), indent=1)
    Pc = np.concatenate(P)
    print(os.path.basename(src), 'vértices', len(Pc), 'ossos', nj, 'clipe', clip, 'quadros', n,
          'tamanho', (Pc.max(0) - Pc.min(0)).round(2).tolist())


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
