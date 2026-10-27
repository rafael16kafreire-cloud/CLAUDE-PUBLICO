"""
Textura de folhas feita no Blender (sem tela, Cycles em CPU).
Renderiza um "tufo" de folhas visto de cima, com fundo transparente:
cada folha tem forma de verdade (pontuda, mais larga no meio), nervura
central clara, bordas mais escuras e cor um pouco diferente das vizinhas.
O PNG serve de cartão de folhas nas árvores do jogo.

Uso:  .blender-env/bin/python tools/models/blender_folhas.py saida.png [tipo] [tamanho]
  tipo: largas (padrão, árvore da mata) | finas (folíolos de samambaia/acácia)
"""
import math
import random
import sys

import bpy  # noqa: E402  (bpy primeiro: é ele que registra o módulo bmesh)
import bmesh  # noqa: E402


def limpa():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def folha_malha(nome, comp, larg, curva, forma):
    """Folha como malha: 10 divisões no comprimento, 3 de cada lado da nervura.
    A cor (atributo 'Col') fica clara na nervura e escura na borda."""
    me = bpy.data.meshes.new(nome)
    bm = bmesh.new()
    nl, nw = 16, 8
    grade = []
    for i in range(nl + 1):
        t = i / nl
        # largura ao longo da folha: pontuda nas duas pontas
        w = (math.sin(math.pi * t) ** forma) * larg * 0.5 * (1.0 - 0.25 * t)
        linha = []
        for j in range(-nw, nw + 1):
            s = j / nw
            x = s * w
            y = t * comp
            # a folha dobra um pouco na nervura e cai na ponta
            z = abs(s) * w * 0.35 + (t ** 2) * curva * comp
            linha.append(bm.verts.new((x, y, z)))
        grade.append(linha)
    for i in range(nl):
        for j in range(2 * nw):
            bm.faces.new((grade[i][j], grade[i][j + 1], grade[i + 1][j + 1], grade[i + 1][j]))
    bm.normal_update()
    col = bm.loops.layers.color.new('Col')
    for f in bm.faces:
        for lp in f.loops:
            v = lp.vert.co
            t = v.y / comp
            w = (math.sin(math.pi * max(0.0, min(1.0, t))) ** forma) * larg * 0.5 * (1.0 - 0.25 * t) + 1e-6
            s = abs(v.x) / w                      # 0 na nervura, 1 na borda
            base = 0.62 + 0.38 * (1 - s ** 1.5)   # borda mais escura
            vein = 1.0 if s < 0.09 else 0.0       # nervura clara
            # nervuras laterais: riscos em diagonal a partir da central
            ph = (t * 9.0 - s * 1.6) % 1.0
            lat = 1.0 if (ph < 0.09 and 0.1 < t < 0.92 and 0.09 < s < 0.92) else 0.0
            c = base + vein * 0.5 - lat * 0.42
            lp[col] = (c, c, c, 1.0)
    bm.to_mesh(me)
    bm.free()
    return me


def material_folha():
    m = bpy.data.materials.new('folha')
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    em = nt.nodes.new('ShaderNodeEmission')
    col = nt.nodes.new('ShaderNodeVertexColor')
    col.layer_name = 'Col'
    obj = nt.nodes.new('ShaderNodeObjectInfo')
    # cor base: do verde-escuro ao verde-amarelado, sorteada por folha
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].position = 0.0
    ramp.color_ramp.elements[0].color = (0.05, 0.22, 0.04, 1)
    ramp.color_ramp.elements[1].position = 1.0
    ramp.color_ramp.elements[1].color = (0.36, 0.55, 0.09, 1)
    mid = ramp.color_ramp.elements.new(0.5)
    mid.color = (0.12, 0.36, 0.05, 1)
    mix = nt.nodes.new('ShaderNodeMix')
    mix.data_type = 'RGBA'
    mix.blend_type = 'MULTIPLY'
    mix.inputs[0].default_value = 1.0
    nt.links.new(obj.outputs['Random'], ramp.inputs['Fac'])
    nt.links.new(ramp.outputs['Color'], mix.inputs[6])
    nt.links.new(col.outputs['Color'], mix.inputs[7])
    nt.links.new(mix.outputs[2], em.inputs['Color'])
    em.inputs['Strength'].default_value = 1.0
    nt.links.new(em.outputs['Emission'], out.inputs['Surface'])
    return m


def monta(tipo):
    rnd = random.Random(7)
    mat = material_folha()
    if tipo == 'finas':
        # folíolos finos e compridos, em leque (samambaia/acácia)
        medidas = dict(comp=(0.9, 1.5), larg=(0.14, 0.22), curva=(-0.25, -0.05), forma=0.9)
        n, raio = 120, 1.55
    else:
        medidas = dict(comp=(0.55, 0.95), larg=(0.24, 0.36), curva=(-0.2, -0.02), forma=0.75)
        n, raio = 230, 1.5
    for i in range(n):
        # de dentro (escuras, por baixo) para fora (claras, por cima)
        ang = rnd.uniform(0, math.tau)
        d = rnd.random() * raio * 0.5
        me = folha_malha(f'f{i}', rnd.uniform(*medidas['comp']), rnd.uniform(*medidas['larg']),
                         rnd.uniform(*medidas['curva']), medidas['forma'])
        ob = bpy.data.objects.new(f'f{i}', me)
        bpy.context.scene.collection.objects.link(ob)
        ob.data.materials.append(mat)
        # a folha aponta para fora do centro, com variação
        a = ang + rnd.uniform(-0.8, 0.8)
        ob.rotation_euler = (rnd.uniform(-0.25, 0.25), rnd.uniform(-0.25, 0.25), a - math.pi / 2)
        ob.location = (math.cos(ang) * d, math.sin(ang) * d, i * 0.004)


def render(saida, tamanho):
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = 12
    sc.cycles.use_denoising = False
    sc.render.film_transparent = True
    sc.render.resolution_x = sc.render.resolution_y = tamanho
    sc.render.image_settings.file_format = 'PNG'
    sc.render.image_settings.color_mode = 'RGBA'
    sc.view_settings.view_transform = 'Standard'
    cam = bpy.data.cameras.new('cam')
    cam.type = 'ORTHO'
    cam.ortho_scale = 3.2
    co = bpy.data.objects.new('cam', cam)
    bpy.context.scene.collection.objects.link(co)
    co.location = (0, 0, 6)
    co.rotation_euler = (0, 0, 0)
    sc.camera = co
    sc.render.filepath = saida
    bpy.ops.render.render(write_still=True)


if __name__ == '__main__':
    saida = sys.argv[1]
    tipo = sys.argv[2] if len(sys.argv) > 2 else 'largas'
    tam = int(sys.argv[3]) if len(sys.argv) > 3 else 512
    limpa()
    monta(tipo)
    render(saida, tam)
    print('ok', saida)
