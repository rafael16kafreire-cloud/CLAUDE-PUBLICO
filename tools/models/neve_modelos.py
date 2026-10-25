"""
Junta os modelos da neve num arquivo só para o jogo:
  - árvores do "Snow Trees Pack" (cartões com textura transparente)
  - pedra "W041 Snowy Rock" (malha + textura)
  - textura de rocha nevada ("Snowy Rock PBR Material") para os paredões
e grava src/world/textures/neve_modelos.js (tudo em base64).

Uso (usd-core, numpy, Pillow):
  python neve_modelos.py pasta_arvores pasta_pedra pasta_material saida.js
(as pastas são os .usdz já descompactados)
"""
import base64
import io
import json
import sys

import numpy as np
from PIL import Image
from pxr import Usd, UsdGeom


def meshes(folder):
    st = Usd.Stage.Open(f'{folder}/scene.usdc')
    for p in st.Traverse():
        if not p.IsA(UsdGeom.Mesh):
            continue
        m = UsdGeom.Mesh(p)
        pts = np.array(m.GetPointsAttr().Get(), dtype=np.float64)
        xf = np.array(UsdGeom.Xformable(p).ComputeLocalToWorldTransform(0))
        w = (np.c_[pts, np.ones(len(pts))] @ xf)[:, :3]
        uv = np.array(UsdGeom.PrimvarsAPI(p).GetPrimvar('st0').Get(), dtype=np.float64)
        idx = np.array(m.GetFaceVertexIndicesAttr().Get(), dtype=np.int64)
        yield p.GetName(), w, uv, idx


def b64(a):
    return base64.b64encode(np.ascontiguousarray(a).tobytes()).decode()


def img_b64(path, size, fmt):
    im = Image.open(path)
    im = im.convert('RGBA' if fmt == 'PNG' else 'RGB').resize(size, Image.LANCZOS)
    buf = io.BytesIO()
    if fmt == 'PNG':
        im.save(buf, 'PNG', optimize=True)
        return 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode()
    im.save(buf, 'JPEG', quality=80, optimize=True)
    return 'data:image/jpeg;base64,' + base64.b64encode(buf.getvalue()).decode()


def pack(w, uv, idx):
    """Centraliza em x/z, apoia no chão (y=0), altura 1; quantiza."""
    w = w.copy()
    w[:, 0] -= (w[:, 0].min() + w[:, 0].max()) / 2
    w[:, 2] -= (w[:, 2].min() + w[:, 2].max()) / 2
    w[:, 1] -= w[:, 1].min()
    h = w[:, 1].max()
    w /= h
    lo = w.min(0)
    hi = w.max(0)
    q = np.round((w - lo) / (hi - lo) * 65535).astype('<u2')
    return {
        'n': int(len(w)),
        'box': [*lo.round(5).tolist(), *hi.round(5).tolist()],
        'pos': b64(q),
        'uv': b64((np.clip(uv, 0, 1) * 65535).round().astype('<u2')),
        'idx': b64(idx.astype('<u2')),
    }


def main(trees, rock, material, out):
    parts = {}
    # nome no arquivo -> (nome no jogo, textura, tamanho da textura)
    wanted = {
        'snowtree_tree1_0': ('pinheiro_neve', 'tree1_baseColor.png', (256, 512)),
        'deadtreehero_deadtreehero_0': ('arvore_morta', 'deadtreehero_baseColor.png', (256, 256)),
        'TreeBareTall_treebaretall_0': ('arvore_seca', 'treebaretall_baseColor.png', (256, 512)),
        'snowbush1_snowbush_0': ('arbusto_neve', 'snowbush_baseColor.png', (256, 128)),
    }
    for name, w, uv, idx in meshes(trees):
        if name in wanted:
            key, tex, size = wanted[name]
            parts[key] = pack(w, uv, idx)
            parts[key]['tex'] = img_b64(f'{trees}/0/{tex}', size, 'PNG')
    name, w, uv, idx = next(meshes(rock))
    pedra = pack(w, uv, idx)
    pedra['tex'] = img_b64(f'{rock}/0/BASE_01_baseColor.jpg', (1024, 1024), 'JPEG')
    # rocha nevada para os paredões: um pedaço do meio de um dos triângulos
    mat = Image.open(f'{material}/0/material_baseColor.jpg').convert('RGB')
    W = mat.width
    crop = mat.crop((int(W * 0.15), int(W * 0.17), int(W * 0.15) + W // 7, int(W * 0.17) + W // 7))
    buf = io.BytesIO()
    crop.resize((512, 512), Image.LANCZOS).save(buf, 'JPEG', quality=82, optimize=True)
    rocha = 'data:image/jpeg;base64,' + base64.b64encode(buf.getvalue()).decode()
    with open(out, 'w') as f:
        f.write('// Modelos da neve enviados pelo jogador: árvores (Snow Trees Pack),\n')
        f.write('// pedra (W041 Snowy Rock) e rocha nevada (Snowy Rock PBR Material).\n')
        f.write('// Gerado por tools/models/neve_modelos.py.\n')
        f.write(f'export const ARVORES_NEVE = {json.dumps(parts)};\n')
        f.write(f'export const PEDRA_NEVE = {json.dumps(pedra)};\n')
        f.write(f"export const ROCHA_NEVADA = '{rocha}';\n")
    print('ok', list(parts), 'pedra', pedra['n'])


if __name__ == '__main__':
    main(*sys.argv[1:5])
