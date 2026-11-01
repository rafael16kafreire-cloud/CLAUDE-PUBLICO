"""
Casca de árvore feita no Blender (sem tela, Cycles em CPU).
Gera 3 imagens que se repetem sem emenda nos dois sentidos:
  <base>_cor.png     cor (rachaduras escuras, placas, líquen cinza-esverdeado e musgo)
  <base>_altura.png  mapa de altura em cinza
  <base>_relevo.png  normal map (calculado da altura)

O padrão vem do Voronoi "distância até a borda" esticado na vertical (placas
compridas separadas por rachaduras) + ruído fino. Para repetir sem emenda,
as coordenadas são levadas para um "toro" 4D (cos/sen nos dois sentidos).

Uso: .blender-env/bin/python tools/models/blender_casca.py pasta/base [tamanho] [estilo]
  estilo: placas (padrão, árvore da mata) | claro (tronco claro, sumaúma) | pinho
"""
import math
import sys

import bpy  # noqa: E402  (bpy primeiro: é ele que registra os outros módulos)
import numpy as np  # noqa: E402

ESTILOS = {
    # cor das rachaduras, cor das placas (duas), líquen, musgo, escala (horizontal, vertical)
    'placas': dict(crack=(0.075, 0.052, 0.036), a=(0.32, 0.24, 0.17), b=(0.50, 0.40, 0.30),
                   lich=(0.50, 0.56, 0.47), moss=(0.13, 0.25, 0.06), esc=(4.0, 1.1), lich_q=0.53, moss_q=0.6),
    'claro': dict(crack=(0.10, 0.085, 0.07), a=(0.42, 0.37, 0.30), b=(0.58, 0.52, 0.44),
                  lich=(0.62, 0.66, 0.56), moss=(0.20, 0.32, 0.10), esc=(3.0, 0.9), lich_q=0.58, moss_q=0.62),
    'pinho': dict(crack=(0.03, 0.02, 0.014), a=(0.26, 0.15, 0.09), b=(0.42, 0.25, 0.14),
                  lich=(0.45, 0.5, 0.4), moss=(0.15, 0.24, 0.06), esc=(5.0, 1.6), lich_q=0.68, moss_q=0.7),
}


def sem_tela():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def no_toro(nt, uv_out, esc_u, esc_v, raio=1.0):
    """Coordenadas que repetem sem emenda: devolve (vetor, w) a partir da UV."""
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    nt.links.new(uv_out, sep.inputs['Vector'])

    def trig(fn, eixo, escala):
        m = nt.nodes.new('ShaderNodeMath')
        m.operation = 'MULTIPLY'
        nt.links.new(sep.outputs[eixo], m.inputs[0])
        m.inputs[1].default_value = math.tau
        f = nt.nodes.new('ShaderNodeMath')
        f.operation = fn
        nt.links.new(m.outputs[0], f.inputs[0])
        g = nt.nodes.new('ShaderNodeMath')
        g.operation = 'MULTIPLY'
        nt.links.new(f.outputs[0], g.inputs[0])
        g.inputs[1].default_value = escala
        return g.outputs[0]

    cu, su = trig('COSINE', 'X', esc_u), trig('SINE', 'X', esc_u)
    cv, sv = trig('COSINE', 'Y', esc_v), trig('SINE', 'Y', esc_v)
    comb = nt.nodes.new('ShaderNodeCombineXYZ')
    nt.links.new(cu, comb.inputs['X'])
    nt.links.new(su, comb.inputs['Y'])
    nt.links.new(cv, comb.inputs['Z'])
    return comb.outputs[0], sv


def monta_material(estilo, modo):
    """modo: 'cor' ou 'altura' (a saída vai por Emission, sem iluminação)."""
    E = ESTILOS[estilo]
    m = bpy.data.materials.new(f'casca_{modo}')
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    em = nt.nodes.new('ShaderNodeEmission')
    nt.links.new(em.outputs[0], out.inputs['Surface'])
    uv = nt.nodes.new('ShaderNodeTexCoord')

    # placas: Voronoi distância-até-a-borda, esticado na vertical (escala v menor)
    vec_p, w_p = no_toro(nt, uv.outputs['UV'], E['esc'][0], E['esc'][1])
    # entorta o padrão com ruído (rachaduras onduladas, não polígonos retos)
    vec_w, w_w = no_toro(nt, uv.outputs['UV'], 3.0, 2.2)
    nw = nt.nodes.new('ShaderNodeTexNoise')
    nw.noise_dimensions = '4D'
    nw.inputs['Scale'].default_value = 1.6
    nw.inputs['Detail'].default_value = 4.0
    nt.links.new(vec_w, nw.inputs['Vector'])
    nt.links.new(w_w, nw.inputs['W'])
    esc_w = nt.nodes.new('ShaderNodeVectorMath')
    esc_w.operation = 'SCALE'
    esc_w.inputs['Scale'].default_value = 0.9
    nt.links.new(nw.outputs['Color'], esc_w.inputs[0])
    soma = nt.nodes.new('ShaderNodeVectorMath')
    soma.operation = 'ADD'
    nt.links.new(vec_p, soma.inputs[0])
    nt.links.new(esc_w.outputs[0], soma.inputs[1])
    vor = nt.nodes.new('ShaderNodeTexVoronoi')
    vor.voronoi_dimensions = '4D'
    vor.feature = 'DISTANCE_TO_EDGE'
    vor.inputs['Scale'].default_value = 1.0
    nt.links.new(soma.outputs[0], vor.inputs['Vector'])
    nt.links.new(w_p, vor.inputs['W'])

    # ruído que entorta as rachaduras e dá grão
    vec_g, w_g = no_toro(nt, uv.outputs['UV'], 5.5, 5.5)
    n1 = nt.nodes.new('ShaderNodeTexNoise')
    n1.noise_dimensions = '4D'
    n1.inputs['Scale'].default_value = 3.0
    n1.inputs['Detail'].default_value = 6.0
    nt.links.new(vec_g, n1.inputs['Vector'])
    nt.links.new(w_g, n1.inputs['W'])
    vec_f, w_f = no_toro(nt, uv.outputs['UV'], 24.0, 18.0)
    n2 = nt.nodes.new('ShaderNodeTexNoise')
    n2.noise_dimensions = '4D'
    n2.inputs['Scale'].default_value = 2.0
    n2.inputs['Detail'].default_value = 3.0
    nt.links.new(vec_f, n2.inputs['Vector'])
    nt.links.new(w_f, n2.inputs['W'])

    # altura: placa alta no meio, rachadura funda na borda
    placa = nt.nodes.new('ShaderNodeMapRange')
    placa.inputs['From Min'].default_value = 0.0
    placa.inputs['From Max'].default_value = 0.34
    placa.interpolation_type = 'SMOOTHSTEP'
    nt.links.new(vor.outputs['Distance'], placa.inputs['Value'])
    h1 = nt.nodes.new('ShaderNodeMath')
    h1.operation = 'MULTIPLY'
    nt.links.new(placa.outputs['Result'], h1.inputs[0])
    h1.inputs[1].default_value = 0.78
    h2 = nt.nodes.new('ShaderNodeMath')
    h2.operation = 'MULTIPLY_ADD'
    nt.links.new(n2.outputs['Fac'], h2.inputs[0])
    h2.inputs[1].default_value = 0.22
    nt.links.new(h1.outputs[0], h2.inputs[2])
    # as placas ficam mais fundas/altas por região
    h3 = nt.nodes.new('ShaderNodeMath')
    h3.operation = 'MULTIPLY_ADD'
    nt.links.new(n1.outputs['Fac'], h3.inputs[0])
    h3.inputs[1].default_value = 0.35
    nt.links.new(h2.outputs[0], h3.inputs[2])
    h3.use_clamp = True

    if modo == 'altura':
        comb = nt.nodes.new('ShaderNodeCombineColor')
        for k in ('Red', 'Green', 'Blue'):
            nt.links.new(h3.outputs[0], comb.inputs[k])
        nt.links.new(comb.outputs[0], em.inputs['Color'])
        return m

    # cor: das rachaduras (escuras) às placas (duas cores), com líquen e musgo
    mix_p = nt.nodes.new('ShaderNodeMix')
    mix_p.data_type = 'RGBA'
    nt.links.new(n1.outputs['Fac'], mix_p.inputs[0])
    mix_p.inputs[6].default_value = (*E['a'], 1)
    mix_p.inputs[7].default_value = (*E['b'], 1)
    mix_c = nt.nodes.new('ShaderNodeMix')
    mix_c.data_type = 'RGBA'
    nt.links.new(placa.outputs['Result'], mix_c.inputs[0])
    mix_c.inputs[6].default_value = (*E['crack'], 1)
    nt.links.new(mix_p.outputs[2], mix_c.inputs[7])
    # brilho por altura (grão)
    bril = nt.nodes.new('ShaderNodeMix')
    bril.data_type = 'RGBA'
    bril.blend_type = 'MULTIPLY'
    bril.inputs[0].default_value = 1.0
    gr = nt.nodes.new('ShaderNodeMapRange')
    gr.inputs['To Min'].default_value = 0.65
    gr.inputs['To Max'].default_value = 1.3
    nt.links.new(n2.outputs['Fac'], gr.inputs['Value'])
    nt.links.new(mix_c.outputs[2], bril.inputs[6])
    nt.links.new(gr.outputs['Result'], bril.inputs[7])

    vec_l, w_l = no_toro(nt, uv.outputs['UV'], 2.6, 2.4)
    nl = nt.nodes.new('ShaderNodeTexNoise')
    nl.noise_dimensions = '4D'
    nl.inputs['Scale'].default_value = 2.2
    nl.inputs['Detail'].default_value = 5.0
    nt.links.new(vec_l, nl.inputs['Vector'])
    nt.links.new(w_l, nl.inputs['W'])
    lich = nt.nodes.new('ShaderNodeMapRange')
    lich.inputs['From Min'].default_value = E['lich_q']
    lich.inputs['From Max'].default_value = E['lich_q'] + 0.14
    lich.interpolation_type = 'SMOOTHSTEP'
    nt.links.new(nl.outputs['Fac'], lich.inputs['Value'])
    # o líquen só cobre as placas altas, não as rachaduras
    lich_m = nt.nodes.new('ShaderNodeMath')
    lich_m.operation = 'MULTIPLY'
    nt.links.new(lich.outputs['Result'], lich_m.inputs[0])
    nt.links.new(placa.outputs['Result'], lich_m.inputs[1])
    mix_l = nt.nodes.new('ShaderNodeMix')
    mix_l.data_type = 'RGBA'
    nt.links.new(lich_m.outputs[0], mix_l.inputs[0])
    nt.links.new(bril.outputs[2], mix_l.inputs[6])
    mix_l.inputs[7].default_value = (*E['lich'], 1)

    vec_m, w_m = no_toro(nt, uv.outputs['UV'], 1.7, 1.5)
    nm = nt.nodes.new('ShaderNodeTexNoise')
    nm.noise_dimensions = '4D'
    nm.inputs['Scale'].default_value = 2.8
    nm.inputs['Detail'].default_value = 4.0
    nt.links.new(vec_m, nm.inputs['Vector'])
    nt.links.new(w_m, nm.inputs['W'])
    moss = nt.nodes.new('ShaderNodeMapRange')
    moss.inputs['From Min'].default_value = E['moss_q']
    moss.inputs['From Max'].default_value = E['moss_q'] + 0.12
    moss.interpolation_type = 'SMOOTHSTEP'
    nt.links.new(nm.outputs['Fac'], moss.inputs['Value'])
    moss_m = nt.nodes.new('ShaderNodeMath')
    moss_m.operation = 'MULTIPLY'
    nt.links.new(moss.outputs['Result'], moss_m.inputs[0])
    moss_m.inputs[1].default_value = 0.85
    mix_m = nt.nodes.new('ShaderNodeMix')
    mix_m.data_type = 'RGBA'
    nt.links.new(moss_m.outputs[0], mix_m.inputs[0])
    nt.links.new(mix_l.outputs[2], mix_m.inputs[6])
    mix_m.inputs[7].default_value = (*E['moss'], 1)
    nt.links.new(mix_m.outputs[2], em.inputs['Color'])
    return m


def renderiza(modo, estilo, tam, caminho):
    sc = bpy.context.scene
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o)
    me = bpy.data.meshes.new('plano')
    me.from_pydata([(-1, -1, 0), (1, -1, 0), (1, 1, 0), (-1, 1, 0)], [], [(0, 1, 2, 3)])
    uvl = me.uv_layers.new(name='UVMap')
    for lp, uv in zip(me.loops, [(0, 0), (1, 0), (1, 1), (0, 1)]):
        uvl.data[lp.index].uv = uv
    ob = bpy.data.objects.new('plano', me)
    sc.collection.objects.link(ob)
    ob.data.materials.append(monta_material(estilo, modo))
    cam = bpy.data.cameras.new('cam')
    cam.type = 'ORTHO'
    cam.ortho_scale = 2.0
    co = bpy.data.objects.new('cam', cam)
    sc.collection.objects.link(co)
    co.location = (0, 0, 3)
    sc.camera = co
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = 1
    sc.cycles.use_denoising = False
    sc.render.resolution_x = tam
    sc.render.resolution_y = tam * 2  # a casca é mais comprida que larga
    co.data.ortho_scale = 2.0
    sc.render.resolution_percentage = 100
    sc.render.film_transparent = False
    sc.view_settings.view_transform = 'Standard'
    sc.render.image_settings.file_format = 'PNG'
    sc.render.image_settings.color_mode = 'RGB'
    sc.render.filepath = caminho
    # moldura com a proporção 1:2 (a malha é quadrada; ajusta a câmera)
    co.data.sensor_fit = 'HORIZONTAL'
    ob.scale = (1.0, 2.0, 1.0)
    co.data.ortho_scale = 2.0
    bpy.ops.render.render(write_still=True)


def normal_da_altura(caminho_altura, caminho_saida, forca=3.0):
    """Normal map a partir do mapa de altura (diferenças finitas, repete sem emenda)."""
    img = bpy.data.images.load(caminho_altura)
    w, h = img.size
    a = np.array(img.pixels[:], dtype=np.float32).reshape(h, w, 4)[:, :, 0]
    dx = (np.roll(a, -1, 1) - np.roll(a, 1, 1)) * forca
    dy = (np.roll(a, -1, 0) - np.roll(a, 1, 0)) * forca
    n = np.dstack([-dx, -dy, np.ones_like(a)])
    n /= np.linalg.norm(n, axis=2, keepdims=True)
    rgb = n * 0.5 + 0.5
    out = np.dstack([rgb, np.ones_like(a)]).reshape(-1)
    novo = bpy.data.images.new('normal', w, h)
    novo.pixels = out.tolist()
    novo.filepath_raw = caminho_saida
    novo.file_format = 'PNG'
    novo.save()


if __name__ == '__main__':
    base = sys.argv[1]
    tam = int(sys.argv[2]) if len(sys.argv) > 2 else 256
    estilo = sys.argv[3] if len(sys.argv) > 3 else 'placas'
    for modo in ('cor', 'altura'):
        sem_tela()
        renderiza(modo, estilo, tam, f'{base}_{modo}.png')
    normal_da_altura(f'{base}_altura.png', f'{base}_relevo.png')
    print('ok', base)
