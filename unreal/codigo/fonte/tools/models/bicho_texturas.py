"""
Reduz as texturas de cada material do bicho e grava texturas.json
(lista na mesma ordem dos materiais do rig.json) para o passo 3.
Uso (Pillow): python bicho_texturas.py rig.json pasta_saida tamanho
"""
import json
import os
import sys

from PIL import Image


def main(rig, out, size):
    size = int(size)
    os.makedirs(out, exist_ok=True)
    mats = json.load(open(rig))['materiais']
    res, done = [], {}
    for m in mats:
        item = {'map': None, 'normalMap': None, 'alpha': m['alfa']}
        for k, src in (('map', m['cor']), ('normalMap', m['relevo'])):
            if not src:
                continue
            key = (src, k, m['alfa'])
            if key not in done:
                im = Image.open(src)
                s = min(size, im.width) if k == 'map' else min(size // 2, im.width)
                alpha = m['alfa'] and k == 'map'
                im = im.convert('RGBA' if alpha else 'RGB').resize((s, s * im.height // im.width), Image.LANCZOS)
                name = os.path.join(out, f'{len(done)}_{k}.' + ('png' if alpha else 'jpg'))
                if alpha:
                    im.save(name, 'PNG', optimize=True)
                else:
                    im.save(name, 'JPEG', quality=82, optimize=True)
                done[key] = name
            item[k] = done[key]
        res.append(item)
    json.dump(res, open(os.path.join(out, 'texturas.json'), 'w'), indent=1)


if __name__ == '__main__':
    main(*sys.argv[1:4])
