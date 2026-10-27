"""
Caixa de itens largados feita no Blender, sem tela: um pacote retangular de
cantos arredondados, com a superfície laranja/ferrugem envelhecida (manchas
escuras, pontos ocre e desgaste claro nos cantos) amarrado com cordas
trançadas (duas voltas em volta da largura e duas em volta do comprimento,
que se cruzam por cima).

Gera o render de visualização e o modelo no formato do jogo
(src/world/textures/veg_caixa.js): duas partes, "tronco_caixa" (corpo) e
"tronco_corda" (corda), cada uma com cor + relevo.

Uso: .blender-env/bin/python tools/models/blender_caixa.py <pasta> [--js arquivo.js]
"""
import math
import os
import random
import sys

import bpy  # noqa: E402  (bpy primeiro: é ele que registra os outros módulos)
import numpy as np  # noqa: E402
from mathutils import Vector  # noqa: E402

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from blender_arvore import Ramo, arquivo_b64, parte_jogo, png_para_jpg_b64, tubo  # noqa: E402

L, W, H = 0.86, 0.56, 0.40       # comprimento (x), largura (y), altura (z), em metros
RAIO = 0.075                     # arredondamento dos cantos
CORDA = 0.014                    # raio da corda
OFF = 0.006                      # a corda afunda um pouco no pacote


# ---------------------------------------------------------------
# Texturas (renderizadas pelo Blender com Emission, sem iluminação)
# ---------------------------------------------------------------
def _novo_material(nome):
    m = bpy.data.materials.new(nome)
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    return m, nt


def _noise(nt, escala, detalhe, esticar=(1, 1, 1), semente=0.0):
    uv = nt.nodes.new('ShaderNodeTexCoord')
    mp = nt.nodes.new('ShaderNodeMapping')
    mp.inputs['Scale'].default_value = esticar
    mp.inputs['Location'].default_value = (semente, semente * 0.7, 0)
    nt.links.new(uv.outputs['UV'], mp.inputs['Vector'])
    n = nt.nodes.new('ShaderNodeTexNoise')
    n.inputs['Scale'].default_value = escala
    n.inputs['Detail'].default_value = detalhe
    nt.links.new(mp.outputs[0], n.inputs['Vector'])
    return n.outputs['Fac']


def _ramp(nt, entrada, paradas):
    r = nt.nodes.new('ShaderNodeValToRGB')
    # remove os 2 elementos padrão e recria
    while len(r.color_ramp.elements) > 1:
        r.color_ramp.elements.remove(r.color_ramp.elements[-1])
    r.color_ramp.elements[0].position = paradas[0][0]
    r.color_ramp.elements[0].color = (*paradas[0][1], 1)
    for pos, cor in paradas[1:]:
        e = r.color_ramp.elements.new(pos)
        e.color = (*cor, 1)
    nt.links.new(entrada, r.inputs['Fac'])
    return r.outputs['Color']


def _mistura(nt, fator, a, b):
    m = nt.nodes.new('ShaderNodeMix')
    m.data_type = 'RGBA'
    nt.links.new(fator, m.inputs[0])
    nt.links.new(a, m.inputs[6])
    nt.links.new(b, m.inputs[7])
    return m.outputs[2]


def _cte(nt, rgb):
    n = nt.nodes.new('ShaderNodeRGB')
    n.outputs[0].default_value = (*rgb, 1)
    return n.outputs[0]


def _mapa(nt, saida, v0, v1, pos=None):
    r = nt.nodes.new('ShaderNodeMapRange')
    r.inputs['From Min'].default_value = v0
    r.inputs['From Max'].default_value = v1
    r.interpolation_type = 'SMOOTHSTEP'
    nt.links.new(saida, r.inputs['Value'])
    return r.outputs['Result']


def _estica(nt, saida, a=0.33, b=0.67):
    r = nt.nodes.new('ShaderNodeMapRange')
    r.inputs['From Min'].default_value = a
    r.inputs['From Max'].default_value = b
    r.clamp = True
    nt.links.new(saida, r.inputs['Value'])
    return r.outputs['Result']


def textura_corpo(modo):
    m, nt = _novo_material('corpo')
    grande = _estica(nt, _noise(nt, 2.4, 7.0, semente=1.3))
    medio = _estica(nt, _noise(nt, 8.0, 6.0, semente=4.1))
    fino = _estica(nt, _noise(nt, 70.0, 4.0, semente=7.7), 0.3, 0.7)
    pontos = _estica(nt, _noise(nt, 11.0, 3.0, semente=2.2))
    if modo == 'altura':
        a = nt.nodes.new('ShaderNodeMath')
        a.operation = 'MULTIPLY_ADD'
        nt.links.new(grande, a.inputs[0])
        a.inputs[1].default_value = 0.55
        nt.links.new(fino, a.inputs[2])
        b = nt.nodes.new('ShaderNodeMath')
        b.operation = 'MULTIPLY_ADD'
        nt.links.new(medio, b.inputs[0])
        b.inputs[1].default_value = 0.35
        nt.links.new(a.outputs[0], b.inputs[2])
        return m, nt, b.outputs[0]
    # cor: do ferrugem escuro ao laranja e ao claro gasto
    base = _ramp(nt, grande, [(0.0, (0.09, 0.03, 0.012)), (0.35, (0.38, 0.135, 0.035)), (0.65, (0.62, 0.25, 0.06)), (1.0, (0.82, 0.44, 0.19))])
    ocre = _mapa(nt, pontos, 0.62, 0.8)
    cor1 = _mistura(nt, ocre, base, _cte(nt, (0.78, 0.40, 0.09)))
    # ferrugem escura em manchas médias
    escuro = _mapa(nt, medio, 0.1, 0.5)
    cor2 = _mistura(nt, escuro, _ramp(nt, fino, [(0.0, (0.07, 0.022, 0.008)), (1.0, (0.2, 0.07, 0.025))]), cor1)
    # grão fino
    gr = nt.nodes.new('ShaderNodeMix')
    gr.data_type = 'RGBA'
    gr.blend_type = 'MULTIPLY'
    gr.inputs[0].default_value = 1.0
    nt.links.new(cor2, gr.inputs[6])
    mapa = nt.nodes.new('ShaderNodeMapRange')
    mapa.inputs['To Min'].default_value = 0.6
    mapa.inputs['To Max'].default_value = 1.3
    nt.links.new(fino, mapa.inputs['Value'])
    nt.links.new(mapa.outputs['Result'], gr.inputs[7])
    return m, nt, gr.outputs[2]


def textura_corda(modo):
    m, nt = _novo_material('corda')
    uv = nt.nodes.new('ShaderNodeTexCoord')
    mp = nt.nodes.new('ShaderNodeMapping')
    nt.links.new(uv.outputs['UV'], mp.inputs['Vector'])
    wv = nt.nodes.new('ShaderNodeTexWave')
    wv.wave_type = 'BANDS'
    wv.bands_direction = 'DIAGONAL'
    wv.wave_profile = 'SAW'
    wv.inputs['Scale'].default_value = 26.0
    wv.inputs['Distortion'].default_value = 1.2
    wv.inputs['Detail'].default_value = 2.0
    nt.links.new(mp.outputs[0], wv.inputs['Vector'])
    fib = _noise(nt, 60.0, 3.0, esticar=(1.0, 0.25, 1.0))
    h = nt.nodes.new('ShaderNodeMix')
    h.data_type = 'FLOAT'
    h.inputs[0].default_value = 0.3
    nt.links.new(wv.outputs['Fac'], h.inputs[2])
    nt.links.new(fib, h.inputs[3])
    if modo == 'altura':
        return m, nt, h.outputs[0]
    cor = _ramp(nt, h.outputs[0], [(0.15, (0.26, 0.19, 0.10)), (0.55, (0.55, 0.43, 0.24)), (0.95, (0.80, 0.68, 0.44))])
    return m, nt, cor


def renderiza_textura(pasta, nome, fabrica, largura, altura):
    """Renderiza cor e altura de um material (plano visto de cima) e calcula o normal map."""
    for modo in ('cor', 'altura'):
        bpy.ops.wm.read_factory_settings(use_empty=True)
        sc = bpy.context.scene
        m, nt, saida = fabrica(modo)
        out = nt.nodes.new('ShaderNodeOutputMaterial')
        em = nt.nodes.new('ShaderNodeEmission')
        nt.links.new(em.outputs[0], out.inputs['Surface'])
        if modo == 'altura':
            comb = nt.nodes.new('ShaderNodeCombineColor')
            for k in ('Red', 'Green', 'Blue'):
                nt.links.new(saida, comb.inputs[k])
            nt.links.new(comb.outputs[0], em.inputs['Color'])
        else:
            nt.links.new(saida, em.inputs['Color'])
        me = bpy.data.meshes.new('p')
        me.from_pydata([(-1, -1, 0), (1, -1, 0), (1, 1, 0), (-1, 1, 0)], [], [(0, 1, 2, 3)])
        uvl = me.uv_layers.new(name='UVMap')
        for lp, c in zip(me.loops, [(0, 0), (1, 0), (1, 1), (0, 1)]):
            uvl.data[lp.index].uv = c
        ob = bpy.data.objects.new('p', me)
        sc.collection.objects.link(ob)
        ob.scale = (1.0, altura / largura, 1.0)
        ob.data.materials.append(m)
        cam = bpy.data.cameras.new('c')
        cam.type = 'ORTHO'
        cam.ortho_scale = 2.0
        co = bpy.data.objects.new('c', cam)
        sc.collection.objects.link(co)
        co.location = (0, 0, 3)
        sc.camera = co
        sc.render.engine = 'CYCLES'
        sc.cycles.device = 'CPU'
        sc.cycles.samples = 1
        sc.cycles.use_denoising = False
        sc.render.resolution_x, sc.render.resolution_y = largura, altura
        sc.view_settings.view_transform = 'Standard'
        sc.render.image_settings.file_format = 'PNG'
        sc.render.filepath = f'{pasta}/{nome}_{modo}.png'
        bpy.ops.render.render(write_still=True)
    img = bpy.data.images.load(f'{pasta}/{nome}_altura.png')
    w, hh = img.size
    a = np.array(img.pixels[:], dtype=np.float32).reshape(hh, w, 4)[:, :, 0]
    dx = (np.roll(a, -1, 1) - np.roll(a, 1, 1)) * 3.0
    dy = (np.roll(a, -1, 0) - np.roll(a, 1, 0)) * 3.0
    n = np.dstack([-dx, -dy, np.ones_like(a)])
    n /= np.linalg.norm(n, axis=2, keepdims=True)
    novo = bpy.data.images.new('n', w, hh)
    novo.pixels = np.dstack([n * 0.5 + 0.5, np.ones_like(a)]).reshape(-1).tolist()
    novo.filepath_raw = f'{pasta}/{nome}_relevo.png'
    novo.file_format = 'PNG'
    novo.save()


# ---------------------------------------------------------------
# Geometria
# ---------------------------------------------------------------
def corpo(n=20):
    """Caixa arredondada: seis grades (uma por face) empurradas para o formato de
    "caixa com cantos redondos". UV por projeção plana em cada face."""
    rng = random.Random(11)
    hx, hy, hz = L / 2, W / 2, H / 2
    ix, iy, iz = hx - RAIO, hy - RAIO, hz - RAIO
    V, U, F = [], [], []
    faces = [
        ((1, 0, 0), (0, 1, 0), (0, 0, 1)), ((-1, 0, 0), (0, 0, 1), (0, 1, 0)),
        ((0, 1, 0), (0, 0, 1), (1, 0, 0)), ((0, -1, 0), (1, 0, 0), (0, 0, 1)),
        ((0, 0, 1), (1, 0, 0), (0, 1, 0)), ((0, 0, -1), (0, 1, 0), (1, 0, 0)),
    ]
    for nrm, a, b in faces:
        nrm, a, b = Vector(nrm), Vector(a), Vector(b)
        base = len(V)
        ou, ov = rng.random() * 0.4, rng.random() * 0.4
        for j in range(n + 1):
            for i in range(n + 1):
                s = i / n * 2 - 1
                t = j / n * 2 - 1
                # mais pontos perto das quinas (onde a curva é mais forte)
                s = math.copysign(1 - (1 - abs(s)) ** 1.5, s)
                t = math.copysign(1 - (1 - abs(t)) ** 1.5, t)
                p = Vector((nrm.x * hx, nrm.y * hy, nrm.z * hz)) + a * s * Vector((abs(a.x) * hx, abs(a.y) * hy, abs(a.z) * hz)).length \
                    + b * t * Vector((abs(b.x) * hx, abs(b.y) * hy, abs(b.z) * hz)).length
                q = Vector((max(-ix, min(ix, p.x)), max(-iy, min(iy, p.y)), max(-iz, min(iz, p.z))))
                d = p - q
                if d.length > 1e-9:
                    p = q + d.normalized() * RAIO
                # leve barriga: o pacote estufa um pouco no meio das faces grandes
                bar = 0.012 * (1 - s * s) * (1 - t * t)
                p = p + nrm * bar
                V.append(p)
                ua = (p.dot(a) + 0.5)
                ub = (p.dot(b) + 0.5)
                U.append((ou + ua * 0.9, ov + ub * 0.9))
        for j in range(n):
            for i in range(n):
                k = base + j * (n + 1) + i
                F += [(k, k + 1, k + n + 2), (k, k + n + 2, k + n + 1)]
    # garante normais para fora (o vértice 0 de cada face aponta para fora do centro)
    out = []
    for f in F:
        a, b, c = (V[i] for i in f)
        nr = (b - a).cross(c - a)
        cen = (a + b + c) / 3
        out.append(f if nr.dot(cen) > 0 else (f[0], f[2], f[1]))
    return V, U, out


def caminho_retangulo(plano, centro, meia_a, meia_b, raio, pts=44):
    """Contorno de retângulo com cantos redondos num plano ('yz', 'xz' ou 'xy')."""
    P = []
    raio = min(raio, meia_a, meia_b)
    cantos = [(meia_a - raio, meia_b - raio, 0), (-(meia_a - raio), meia_b - raio, 0.5 * math.pi),
              (-(meia_a - raio), -(meia_b - raio), math.pi), (meia_a - raio, -(meia_b - raio), 1.5 * math.pi)]
    por = pts // 4
    for ca, cb, a0 in cantos:
        for k in range(por):
            ang = a0 + (k / (por - 1)) * 0.5 * math.pi
            a = ca + math.cos(ang) * raio
            b = cb + math.sin(ang) * raio
            if plano == 'yz':
                P.append(Vector((centro, a, b)))
            elif plano == 'xz':
                P.append(Vector((a, centro, b)))
            else:
                P.append(Vector((a, b, centro)))
    P.append(P[0].copy())
    return P


def cordas():
    V, U, F = [], [], []
    r_c = RAIO + OFF
    caminhos = []
    for x0 in (-0.22, 0.22):                       # voltas em volta da largura
        caminhos.append(caminho_retangulo('yz', x0, W / 2 + OFF, H / 2 + OFF, r_c))
    for y0 in (-0.14, 0.14):                       # voltas em volta do comprimento
        caminhos.append(caminho_retangulo('xz', y0, L / 2 + OFF, H / 2 + OFF, r_c))
    # cruz de corda por cima do pacote (as pontas somem sob as voltas)
    zt = H / 2 + OFF + 0.004
    for sg in (1, -1):
        diag = []
        for i in range(14):
            t = i / 13
            diag.append(Vector((-0.31 + 0.62 * t, sg * (-0.19 + 0.38 * t), zt)))
        caminhos.append(diag)
    for k, pts in enumerate(caminhos):
        raios = [CORDA] * len(pts)
        # a corda sobe um pouco onde cruza outra (por cima), para não afundar no pacote
        for i, p in enumerate(pts):
            if p.z > H / 2 - 0.02:
                raios[i] = CORDA * (1.0 + 0.12 * (k % 2))
        v, u, f = tubo(Ramo(pts, raios, 3), 7, 1, 0.1, 0.0)
        base = len(V)
        V += v
        U += u
        F += [(a + base, b + base, c + base) for a, b, c in f]
    return V, U, F


# ---------------------------------------------------------------
# Visualização
# ---------------------------------------------------------------
def objeto(sc, nome, V, U, F, mat):
    me = bpy.data.meshes.new(nome)
    me.from_pydata([tuple(v) for v in V], [], [tuple(f) for f in F])
    me.update()
    uvl = me.uv_layers.new(name='UVMap')
    for lp in me.loops:
        uvl.data[lp.index].uv = U[lp.vertex_index]
    for p in me.polygons:
        p.use_smooth = True
    ob = bpy.data.objects.new(nome, me)
    sc.collection.objects.link(ob)
    ob.data.materials.append(mat)
    return ob


def material_png(nome, pasta, base, rug=0.8):
    m, nt = _novo_material(nome)
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    bs = nt.nodes.new('ShaderNodeBsdfPrincipled')
    bs.inputs['Roughness'].default_value = rug
    tc = nt.nodes.new('ShaderNodeTexImage')
    tc.image = bpy.data.images.load(f'{pasta}/{base}_cor.png')
    tn = nt.nodes.new('ShaderNodeTexImage')
    tn.image = bpy.data.images.load(f'{pasta}/{base}_relevo.png')
    tn.image.colorspace_settings.name = 'Non-Color'
    nm = nt.nodes.new('ShaderNodeNormalMap')
    nm.inputs['Strength'].default_value = 1.4
    nt.links.new(tc.outputs['Color'], bs.inputs['Base Color'])
    nt.links.new(tn.outputs['Color'], nm.inputs['Color'])
    nt.links.new(nm.outputs['Normal'], bs.inputs['Normal'])
    nt.links.new(bs.outputs[0], out.inputs['Surface'])
    return m


def preview(corpo_m, corda_m, pasta, saida):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    objeto(sc, 'corpo', *corpo_m, material_png('corpo', pasta, 'corpo', 0.88))
    objeto(sc, 'corda', *corda_m, material_png('corda', pasta, 'corda', 0.95))
    bpy.ops.mesh.primitive_plane_add(size=30, location=(0, 0, -H / 2))
    ch = bpy.context.active_object
    mc = bpy.data.materials.new('chao')
    mc.use_nodes = True
    mc.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.18, 0.15, 0.1, 1)
    mc.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = 1.0
    ch.data.materials.append(mc)
    w = bpy.data.worlds.new('w')
    sc.world = w
    w.use_nodes = True
    nw = w.node_tree
    for n in list(nw.nodes):
        nw.nodes.remove(n)
    sky = nw.nodes.new('ShaderNodeTexSky')
    try:
        sky.sky_type = 'NISHITA'
        sky.sun_elevation = math.radians(32)
        sky.sun_rotation = math.radians(215)
    except Exception:
        pass
    bg = nw.nodes.new('ShaderNodeBackground')
    bg.inputs['Strength'].default_value = 0.55
    wo = nw.nodes.new('ShaderNodeOutputWorld')
    nw.links.new(sky.outputs[0], bg.inputs['Color'])
    nw.links.new(bg.outputs[0], wo.inputs['Surface'])
    cam = bpy.data.cameras.new('c')
    cam.lens = 42
    co = bpy.data.objects.new('c', cam)
    sc.collection.objects.link(co)
    co.location = (1.25, -1.5, 0.75)
    co.rotation_euler = (Vector((0, 0, 0)) - co.location).to_track_quat('-Z', 'Y').to_euler()
    sc.camera = co
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = 64
    sc.render.resolution_x, sc.render.resolution_y = 1000, 720
    sc.view_settings.view_transform = 'Standard'
    sc.view_settings.look = 'None'
    sc.render.filepath = saida
    bpy.ops.render.render(write_still=True)


if __name__ == '__main__':
    pasta = sys.argv[1]
    js = sys.argv[sys.argv.index('--js') + 1] if '--js' in sys.argv else None
    renderiza_textura(pasta, 'corpo', textura_corpo, 512, 512)
    renderiza_textura(pasta, 'corda', textura_corda, 128, 256)
    cm = corpo()
    cd = cordas()
    print(f'corpo {len(cm[0])} vert / {len(cm[2])} tri   corda {len(cd[0])} vert / {len(cd[2])} tri')
    preview(cm, cd, pasta, f'{pasta}/caixa.png')
    if js:
        import json
        alt = H + 2 * (OFF + CORDA)
        # origem: centro da base (o jogo trata a posição da caixa como o centro; veja death_bag.js)
        origem = np.array([0.0, 0.0, 0.0])
        # o modelo é centrado em z=0; sobe H/2 para a base ficar no chão
        def sobe(parte):
            V, U, F = parte
            return [v + Vector((0, 0, alt / 2)) for v in V], U, F
        pc, pd = sobe(cm), sobe(cd)
        modelo = [parte_jogo(*pc, 'tronco_caixa', origem, alt), parte_jogo(*pd, 'tronco_corda', origem, alt)]
        texs = {
            'tronco_caixa': png_para_jpg_b64(f'{pasta}/corpo_cor.png'),
            'tronco_caixa_relevo': png_para_jpg_b64(f'{pasta}/corpo_relevo.png', 92),
            'tronco_corda': png_para_jpg_b64(f'{pasta}/corda_cor.png'),
            'tronco_corda_relevo': png_para_jpg_b64(f'{pasta}/corda_relevo.png', 92),
        }
        with open(js, 'w') as f:
            f.write('// Caixa de itens largados feita no Blender (tools/models/blender_caixa.py). Não editar à mão.\n')
            f.write(f'export const VEG_CX_MODELOS = {json.dumps({"caixa_bl": modelo})};\n')
            f.write(f'export const VEG_CX_TEXTURAS = {json.dumps(texs)};\n')
            f.write(f'export const CAIXA_ALTURA = {round(alt, 4)};\n')
        print('escrito', js)
