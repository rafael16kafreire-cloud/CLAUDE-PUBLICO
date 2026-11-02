"""
Arco e flecha (.usdz do Sketchfab, "Bow and Arrow" de Amatsukast, CC BY-NC-SA 4.0) -> dados para o jogo.
Lê as malhas do arco (madeira + metal) e de uma flecha (haste + pena), põe no espaço do jogo
(arco em pé: Y para cima, corda do lado +Z, flecha apontando para -Z, em metros) e grava
um JSON com posições/normais/uv/índices e as texturas reduzidas.
Uso: python3 -I arco_usd.py pasta_do_usdz_extraido saida_pasta
"""
import json, os, sys
import numpy as np
from PIL import Image
from pxr import Usd, UsdGeom

src, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
st = Usd.Stage.Open(os.path.join(src, 'scene.usdc'))
S = 0.02  # metros por unidade do modelo (arco com ~0,8 m de altura)
GRIP_X, GRIP_Z = -4.5, 20.0   # centro da pegada no modelo
STRING_X = -9.12              # corda, no modelo


def malha(nome):
    p = next(p for p in st.Traverse() if p.GetName() == nome and p.GetTypeName() == 'Mesh')
    m = UsdGeom.Mesh(p)
    pts = np.array(m.GetPointsAttr().Get(), dtype=np.float64)
    nrm = np.array(m.GetNormalsAttr().Get(), dtype=np.float64)
    uv = np.array(UsdGeom.PrimvarsAPI(p).GetPrimvar('st0').Get(), dtype=np.float64)
    cnt = m.GetFaceVertexCountsAttr().Get()
    idx = m.GetFaceVertexIndicesAttr().Get()
    tri, k = [], 0
    for c in cnt:
        f = idx[k:k + c]
        for i in range(1, c - 1):
            tri += [f[0], f[i], f[i + 1]]
        k += c
    return pts, nrm, uv, np.array(tri, dtype=np.uint32)


def arco(pts, nrm):
    # modelo (x,y,z) -> jogo: X = y, Y = z - centro, Z = -(x - pegada)  (a corda fica do lado do arqueiro, +Z)
    f = lambda a: np.stack([a[:, 1], a[:, 2] - GRIP_Z, -(a[:, 0] - GRIP_X)], 1)
    return f(pts) * S, f(nrm)


def flecha(pts, nrm, cx, cy):
    # eixo da flecha (z do modelo) vira -Z do jogo (a ponta para frente); a cauda fica logo à frente da corda
    zb = -(STRING_X - GRIP_X) * S - 0.03
    p = np.stack([(pts[:, 1] - cy) * S, (pts[:, 0] - cx) * S, zb - (28.6 - pts[:, 2]) * S], 1)
    n = np.stack([nrm[:, 1], nrm[:, 0], nrm[:, 2]], 1)
    return p, n


res = {}
for nome, cam in (('bow_bow_wood_mt_0', 'arco'), ('bow_bow_metal_mt_0', 'arco'), ('arrow_arrow_mt_0', 'flecha'), ('arrow_wing_mt_0', 'flecha')):
    pts, nrm, uv, tri = malha(nome)
    if cam == 'arco':
        p, n = arco(pts, nrm)
    else:
        a = malha('arrow_arrow_mt_0')[0]
        cx, cy = (a[:, 0].min() + a[:, 0].max()) / 2, (a[:, 1].min() + a[:, 1].max()) / 2
        p, n = flecha(pts, nrm, cx, cy)
    # inverter a ordem dos triângulos (a troca de eixos inverte o sentido)
    tri = tri.reshape(-1, 3)[:, ::-1].reshape(-1)
    res[nome] = {'p': np.round(p, 5).astype(np.float32).ravel().tolist(), 'n': np.round(n, 4).astype(np.float32).ravel().tolist(),
                 'uv': np.round(uv, 5).astype(np.float32).ravel().tolist(), 'i': tri.tolist()}
    print(nome, len(p), len(tri) // 3, p.min(0).round(3), p.max(0).round(3))
json.dump(res, open(os.path.join(out, 'malhas.json'), 'w'))

tex = {}
def tx(arq, nome, lado, jpg=True, q=82):
    im = Image.open(os.path.join(src, '0', arq))
    if im.width > lado:
        im = im.resize((lado, lado * im.height // im.width), Image.LANCZOS)
    dst = os.path.join(out, nome + ('.jpg' if jpg else '.png'))
    if jpg:
        im.convert('RGB').save(dst, 'JPEG', quality=q, optimize=True)
    else:
        im.convert('RGBA').save(dst, 'PNG', optimize=True)
    tex[nome] = dst
for m, a in (('bow_wood_mt', 'bow_wood'), ('bow_metal_mt', 'bow_metal'), ('arrow_mt', 'arrow')):
    tx(f'{m}_baseColor.jpg', a + '_cor', 1024)
    tx(f'{m}_normal.jpg', a + '_normal', 1024, q=78)
    tx(f'{m}_metallicRoughness_rough.jpg', a + '_rough', 512, q=70)
    tx(f'{m}_metallicRoughness_metal.jpg', a + '_metal', 512, q=70)
tx('wing_mt_baseColor.png', 'wing_cor', 512, jpg=False)
tx('wing_mt_normal.jpg', 'wing_normal', 512, q=75)
json.dump(tex, open(os.path.join(out, 'texturas.json'), 'w'))
