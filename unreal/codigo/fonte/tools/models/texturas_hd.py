"""
Texturas em alta resolução (qualidade gráfica "alta").
Lê as texturas originais dos .usdz já descompactados e grava
src/world/textures/hd.js com tudo em base64 (JPEG/PNG).

Uso (Pillow):
  python texturas_hd.py pasta_terra pasta_neve pasta_pedra pasta_arvores pasta_espino saida.js
"""
import base64
import io
import sys

from PIL import Image


def data_url(im, fmt='JPEG', q=88):
    buf = io.BytesIO()
    if fmt == 'PNG':
        im.save(buf, 'PNG', optimize=True)
        return 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode()
    im.save(buf, 'JPEG', quality=q, optimize=True)
    return 'data:image/jpeg;base64,' + base64.b64encode(buf.getvalue()).decode()


def jpg(path, size=None, mode='RGB', q=88):
    im = Image.open(path).convert(mode)
    if size and im.size != size:
        im = im.resize(size, Image.LANCZOS)
    return data_url(im, 'JPEG', q)


def png(path, size=None):
    im = Image.open(path).convert('RGBA')
    if size and im.size != size:
        im = im.resize(size, Image.LANCZOS)
    return data_url(im, 'PNG')


def main(terra, neve, pedra, arvores, espino, out):
    T = {
        'TERRA_COR_HD': jpg(f'{terra}/0/lambert1_baseColor.jpg', (1024, 1024)),
        'TERRA_RELEVO_HD': jpg(f'{terra}/0/lambert1_normal.jpg', (1024, 1024)),
        'NEVE_COR_HD': jpg(f'{neve}/0/initialShadingGroup_baseColor.jpg', (2048, 2048), q=85),
        'NEVE_RELEVO_HD': jpg(f'{neve}/0/initialShadingGroup_normal.jpg', (1024, 1024), q=85),
        'PEDRA_COR_HD': jpg(f'{pedra}/0/BASE_01_baseColor.jpg', (2048, 2048), q=85),
        'PEDRA_RELEVO_HD': jpg(f'{pedra}/0/BASE_01_normal_norm.jpg', (2048, 2048), q=85),
        'ARVORE_MORTA_HD': png(f'{arvores}/0/deadtreehero_baseColor.png', (512, 512)),
        'ARVORE_SECA_HD': png(f'{arvores}/0/treebaretall_baseColor.png', (512, 1024)),
        # espinossauro: o jogo pinta as cores; a textura dá os detalhes (tons de cinza)
        'ESPINO_COR_HD': jpg(f'{espino}/0/40_Spino1_1_0_0_baseColor.jpg', (2048, 2048), mode='L', q=85),
        'ESPINO_RELEVO_HD': jpg(f'{espino}/0/40_Spino1_1_0_0_normal.jpg', (2048, 2048), q=85),
    }
    with open(out, 'w') as f:
        f.write('// Texturas em alta resolução, usadas na qualidade gráfica "alta".\n')
        f.write('// Gerado por tools/models/texturas_hd.py a partir dos arquivos originais.\n')
        for k, v in T.items():
            f.write(f"export const {k} = '{v}';\n")
    total = sum(len(v) for v in T.values())
    print('ok', round(total / 1024 / 1024, 1), 'MB em base64')


if __name__ == '__main__':
    main(*sys.argv[1:7])
