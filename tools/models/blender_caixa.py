"""
Caixa de itens largados (engradado de madeira) feita no Blender, sem tela.
  - tábuas com veio de madeira (textura procedural renderizada em PNG),
  - 4 postes nos cantos, quadro em cima e embaixo, tampa de tábuas,
  - mapa de relevo calculado da altura.
Gera o render de visualização e o modelo no formato do jogo
(src/world/textures/veg_caixa.js; mesma estrutura das árvores do Blender).

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
from blender_arvore import arquivo_b64, parte_jogo, png_para_jpg_b64  # noqa: E402

LARG, PROF, ALT = 0.9, 0.62, 0.58      # metros (x, y, z; z para cima)
POSTE = 0.07
TAB = 0.012                            # espessura da tábua (parede)


def textura_madeira(pasta, tam=512):
    """Veio de madeira em PNG de cor e de altura (relevo)."""
    for modo in ('cor', 'altura'):
        bpy.ops.wm.read_factory_settings(use_empty=True)
        sc = bpy.context.scene
        m = bpy.data.materials.new('madeira')
        m.use_nodes = True
        nt = m.node_tree
        for n in list(nt.nodes):
            nt.nodes.remove(n)
        out = nt.nodes.new('ShaderNodeOutputMaterial')
        em = nt.nodes.new('ShaderNodeEmission')
        nt.links.new(em.outputs[0], out.inputs['Surface'])
        uv = nt.nodes.new('ShaderNodeTexCoord')
        mp = nt.nodes.new('ShaderNodeMapping')
        mp.inputs['Scale'].default_value = (1.0, 1.0, 1.0)
        nt.links.new(uv.outputs['UV'], mp.inputs['Vector'])
        # veios: ondas em faixas, distorcidas por ruído (esticado ao longo do veio)
        wv = nt.nodes.new('ShaderNodeTexWave')
        wv.wave_type = 'BANDS'
        wv.bands_direction = 'Y'
        wv.wave_profile = 'SAW'
        wv.inputs['Scale'].default_value = 5.0
        wv.inputs['Distortion'].default_value = 2.6
        wv.inputs['Detail'].default_value = 3.0
        wv.inputs['Detail Scale'].default_value = 1.5
        nt.links.new(mp.outputs[0], wv.inputs['Vector'])
        # fibras finas
        ns = nt.nodes.new('ShaderNodeTexNoise')
        ns.inputs['Scale'].default_value = 30.0
        ns.inputs['Detail'].default_value = 4.0
        mp2 = nt.nodes.new('ShaderNodeMapping')
        mp2.inputs['Scale'].default_value = (0.12, 1.0, 1.0)  # esticado no sentido do veio
        nt.links.new(uv.outputs['UV'], mp2.inputs['Vector'])
        nt.links.new(mp2.outputs[0], ns.inputs['Vector'])
        h = nt.nodes.new('ShaderNodeMix')
        h.data_type = 'FLOAT'
        h.inputs[0].default_value = 0.32
        nt.links.new(wv.outputs['Fac'], h.inputs[2])
        nt.links.new(ns.outputs['Fac'], h.inputs[3])
        if modo == 'altura':
            comb = nt.nodes.new('ShaderNodeCombineColor')
            for k in ('Red', 'Green', 'Blue'):
                nt.links.new(h.outputs[0], comb.inputs[k])
            nt.links.new(comb.outputs[0], em.inputs['Color'])
        else:
            ramp = nt.nodes.new('ShaderNodeValToRGB')
            ramp.color_ramp.elements[0].position = 0.25
            ramp.color_ramp.elements[0].color = (0.07, 0.035, 0.016, 1)
            ramp.color_ramp.elements[1].position = 0.85
            ramp.color_ramp.elements[1].color = (0.30, 0.17, 0.075, 1)
            nt.links.new(h.outputs[0], ramp.inputs['Fac'])
            nt.links.new(ramp.outputs['Color'], em.inputs['Color'])
        me = bpy.data.meshes.new('p')
        me.from_pydata([(-1, -1, 0), (1, -1, 0), (1, 1, 0), (-1, 1, 0)], [], [(0, 1, 2, 3)])
        uvl = me.uv_layers.new(name='UVMap')
        for lp, c in zip(me.loops, [(0, 0), (1, 0), (1, 1), (0, 1)]):
            uvl.data[lp.index].uv = c
        ob = bpy.data.objects.new('p', me)
        sc.collection.objects.link(ob)
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
        sc.render.resolution_x = sc.render.resolution_y = tam
        sc.view_settings.view_transform = 'Standard'
        sc.render.image_settings.file_format = 'PNG'
        sc.render.filepath = f'{pasta}/madeira_{modo}.png'
        bpy.ops.render.render(write_still=True)
    # normal map da altura
    img = bpy.data.images.load(f'{pasta}/madeira_altura.png')
    w, hh = img.size
    a = np.array(img.pixels[:], dtype=np.float32).reshape(hh, w, 4)[:, :, 0]
    dx = (np.roll(a, -1, 1) - np.roll(a, 1, 1)) * 2.5
    dy = (np.roll(a, -1, 0) - np.roll(a, 1, 0)) * 2.5
    n = np.dstack([-dx, -dy, np.ones_like(a)])
    n /= np.linalg.norm(n, axis=2, keepdims=True)
    rgb = n * 0.5 + 0.5
    novo = bpy.data.images.new('n', w, hh)
    novo.pixels = np.dstack([rgb, np.ones_like(a)]).reshape(-1).tolist()
    novo.filepath_raw = f'{pasta}/madeira_relevo.png'
    novo.file_format = 'PNG'
    novo.save()


class Malha:
    def __init__(self):
        self.V, self.U, self.F = [], [], []
        self.rng = random.Random(5)

    def caixa(self, cx, cy, cz, sx, sy, sz):
        """Bloco com UV de madeira: o veio corre no sentido do lado mais comprido."""
        hx, hy, hz = sx / 2, sy / 2, sz / 2
        lados = [
            ((1, 0, 0), (0, 1, 0), (0, 0, 1)),     # +x : eixos da face (a, b)
            ((-1, 0, 0), (0, -1, 0), (0, 0, 1)),
            ((0, 1, 0), (-1, 0, 0), (0, 0, 1)),
            ((0, -1, 0), (1, 0, 0), (0, 0, 1)),
            ((0, 0, 1), (1, 0, 0), (0, 1, 0)),
            ((0, 0, -1), (1, 0, 0), (0, -1, 0)),
        ]
        dims = (sx, sy, sz)
        grao = dims.index(max(dims))
        ou, ov = self.rng.random() * 0.5, self.rng.random() * 0.5
        for n, a, b in lados:
            n, a, b = Vector(n), Vector(a), Vector(b)
            ext_a = abs(a.x) * hx + abs(a.y) * hy + abs(a.z) * hz
            ext_b = abs(b.x) * hx + abs(b.y) * hy + abs(b.z) * hz
            centro = Vector((cx, cy, cz)) + Vector((n.x * hx, n.y * hy, n.z * hz))
            base = len(self.V)
            # o veio vai no eixo mais comprido; u = ao longo do veio, v = através
            ga = abs(a[grao]) > 0.5
            gb = abs(b[grao]) > 0.5
            for sa, sb in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
                p = centro + a * sa * ext_a + b * sb * ext_b
                ca, cb = (sa * ext_a, sb * ext_b)
                if gb and not ga:
                    ca, cb = cb, ca
                self.V.append(p)
                self.U.append((ou + (ca + max(ext_a, ext_b)) * 1.05, ov + (cb + min(ext_a, ext_b)) * 3.2))
            self.F += [(base, base + 1, base + 2), (base, base + 2, base + 3)]


def monta():
    m = Malha()
    # quadros e postes
    for sx in (-1, 1):
        for sy in (-1, 1):
            m.caixa(sx * (LARG / 2 - POSTE / 2), sy * (PROF / 2 - POSTE / 2), (ALT - 0.04) / 2, POSTE, POSTE, ALT - 0.04)
    for z in (POSTE / 2, ALT - POSTE / 2 - 0.045):
        m.caixa(0, PROF / 2 - POSTE / 2, z + (0.045 / 2 if z > POSTE else 0), LARG, POSTE * 0.7, POSTE if z < POSTE else 0.05)
        m.caixa(0, -PROF / 2 + POSTE / 2, z + (0.045 / 2 if z > POSTE else 0), LARG, POSTE * 0.7, POSTE if z < POSTE else 0.05)
    # tábuas das paredes (frente e fundo: no sentido do comprimento; laterais: idem)
    n_tab = 4
    alt_util = ALT - 0.11
    esp = alt_util / n_tab
    for i in range(n_tab):
        z = 0.06 + esp * (i + 0.5)
        m.caixa(0, PROF / 2 - TAB / 2, z, LARG - POSTE * 2 + 0.01, TAB, esp - 0.012)
        m.caixa(0, -PROF / 2 + TAB / 2, z, LARG - POSTE * 2 + 0.01, TAB, esp - 0.012)
        m.caixa(LARG / 2 - TAB / 2, 0, z, TAB, PROF - POSTE * 2 + 0.01, esp - 0.012)
        m.caixa(-LARG / 2 + TAB / 2, 0, z, TAB, PROF - POSTE * 2 + 0.01, esp - 0.012)
    # fundo e tampa (tábuas largas)
    m.caixa(0, 0, 0.05, LARG - POSTE, PROF - POSTE, 0.012)
    n_tampa = 4
    larg_t = (PROF - 0.02) / n_tampa
    for i in range(n_tampa):
        y = -PROF / 2 + 0.01 + larg_t * (i + 0.5)
        m.caixa(0, y, ALT - 0.015, LARG + 0.03, larg_t - 0.012, 0.03)
    # duas ripas de reforço sobre a tampa
    for x in (-LARG / 2 + 0.16, LARG / 2 - 0.16):
        m.caixa(x, 0, ALT + 0.004, 0.07, PROF + 0.02, 0.022)
    return m


def preview(m, pasta, saida):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    me = bpy.data.meshes.new('caixa')
    me.from_pydata([tuple(v) for v in m.V], [], [tuple(f) for f in m.F])
    me.update()
    uvl = me.uv_layers.new(name='UVMap')
    for lp in me.loops:
        uvl.data[lp.index].uv = m.U[lp.vertex_index]
    ob = bpy.data.objects.new('caixa', me)
    sc.collection.objects.link(ob)
    mt = bpy.data.materials.new('mad')
    mt.use_nodes = True
    nt = mt.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    bs = nt.nodes.new('ShaderNodeBsdfPrincipled')
    bs.inputs['Roughness'].default_value = 0.85
    tc = nt.nodes.new('ShaderNodeTexImage')
    tc.image = bpy.data.images.load(f'{pasta}/madeira_cor.png')
    tc.extension = 'REPEAT'
    tn = nt.nodes.new('ShaderNodeTexImage')
    tn.image = bpy.data.images.load(f'{pasta}/madeira_relevo.png')
    tn.image.colorspace_settings.name = 'Non-Color'
    nm = nt.nodes.new('ShaderNodeNormalMap')
    nt.links.new(tc.outputs['Color'], bs.inputs['Base Color'])
    nt.links.new(tn.outputs['Color'], nm.inputs['Color'])
    nt.links.new(nm.outputs['Normal'], bs.inputs['Normal'])
    nt.links.new(bs.outputs[0], out.inputs['Surface'])
    ob.data.materials.append(mt)
    bpy.ops.mesh.primitive_plane_add(size=30, location=(0, 0, 0))
    ch = bpy.context.active_object
    mc = bpy.data.materials.new('chao')
    mc.use_nodes = True
    mc.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.2, 0.15, 0.08, 1)
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
        sky.sun_elevation = math.radians(35)
        sky.sun_rotation = math.radians(220)
    except Exception:
        pass
    bg = nw.nodes.new('ShaderNodeBackground')
    wo = nw.nodes.new('ShaderNodeOutputWorld')
    nw.links.new(sky.outputs[0], bg.inputs['Color'])
    nw.links.new(bg.outputs[0], wo.inputs['Surface'])
    cam = bpy.data.cameras.new('c')
    cam.lens = 45
    co = bpy.data.objects.new('c', cam)
    sc.collection.objects.link(co)
    co.location = (1.5, -1.9, 1.1)
    co.rotation_euler = (Vector((0, 0, 0.3)) - co.location).to_track_quat('-Z', 'Y').to_euler()
    sc.camera = co
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = 48
    sc.render.resolution_x, sc.render.resolution_y = 900, 700
    sc.view_settings.view_transform = 'AgX'
    sc.render.filepath = saida
    bpy.ops.render.render(write_still=True)


if __name__ == '__main__':
    pasta = sys.argv[1]
    js = sys.argv[sys.argv.index('--js') + 1] if '--js' in sys.argv else None
    textura_madeira(pasta)
    m = monta()
    print(f'caixa: {len(m.V)} vert / {len(m.F)} tri')
    preview(m, pasta, f'{pasta}/caixa.png')
    if js:
        import json
        origem = np.array([0.0, 0.0, 0.0])
        # a caixa fica de pé no chão: altura 1 = ALT
        modelo = [parte_jogo(m.V, m.U, m.F, 'tronco_caixa', origem, ALT)]
        texs = {
            'tronco_caixa': png_para_jpg_b64(f'{pasta}/madeira_cor.png'),
            'tronco_caixa_relevo': png_para_jpg_b64(f'{pasta}/madeira_relevo.png', 92),
        }
        with open(js, 'w') as f:
            f.write('// Caixa de itens largados feita no Blender (tools/models/blender_caixa.py). Não editar à mão.\n')
            f.write(f'export const VEG_CX_MODELOS = {json.dumps({"caixa_bl": modelo})};\n')
            f.write(f'export const VEG_CX_TEXTURAS = {json.dumps(texs)};\n')
            f.write(f'export const CAIXA_ALTURA = {ALT};\n')
        print('escrito', js)
