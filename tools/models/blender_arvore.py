"""
Árvore feita no Blender (sem tela): ramificação de verdade, casca com relevo e
folhas em cartões. Gera:
  - um render de visualização (Cycles, CPU) para olhar o resultado;
  - o modelo no formato do jogo (src/world/textures/veg_blender.js).

Como a árvore cresce:
  tronco (nível 0): sobe com uma curva suave e uma base mais larga (sapopemas);
  galhos grandes (nível 1): saem em espiral na parte de cima, abrem para os lados
    e sobem de novo atrás da luz;
  galhos médios (nível 2) e ramos finos (nível 3): saem dos anteriores;
  folhas: cartões com a textura de folhas nas pontas dos ramos.

Uso:
  .blender-env/bin/python tools/models/blender_arvore.py <pasta_saida> [semente] [--js arquivo.js]
Antes, gere as texturas:
  blender_casca.py <pasta>/casca 256 placas   e   blender_folhas.py <pasta>/folhas.png largas 512
"""
import base64
import json
import math
import random
import sys

import bpy  # noqa: E402  (bpy primeiro: é ele que registra os outros módulos)
import numpy as np  # noqa: E402
from mathutils import Vector  # noqa: E402

UP = Vector((0, 0, 1))


# ---------------------------------------------------------------
# Esqueleto da árvore
# ---------------------------------------------------------------
class Ramo:
    def __init__(self, pts, raios, nivel):
        self.pts, self.raios, self.nivel = pts, raios, nivel


def ponto_em(ramo, t):
    """Posição, direção e raio em t (0 a 1) ao longo do ramo."""
    n = len(ramo.pts) - 1
    x = max(0.0, min(1.0, t)) * n
    i = min(int(x), n - 1)
    f = x - i
    p = ramo.pts[i].lerp(ramo.pts[i + 1], f)
    d = (ramo.pts[i + 1] - ramo.pts[i]).normalized()
    r = ramo.raios[i] * (1 - f) + ramo.raios[i + 1] * f
    return p, d, r


def cresce(rng, origem, direcao, comp, r0, r1, nivel, jit, foto, grav, passo=0.55):
    n = max(3, int(comp / passo))
    p = origem.copy()
    d = direcao.normalized()
    pts, raios = [p.copy()], [r0]
    for i in range(1, n + 1):
        t = i / n
        ruido = Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(-1, 1)))
        d = (d + ruido * jit + UP * foto - UP * grav * t).normalized()
        p = p + d * (comp / n)
        pts.append(p.copy())
        raios.append(r0 + (r1 - r0) * (t ** 0.8))
    return Ramo(pts, raios, nivel)


def azimute(a, incl):
    """Direção a `incl` radianos da vertical, virada para o ângulo a."""
    return Vector((math.sin(incl) * math.cos(a), math.sin(incl) * math.sin(a), math.cos(incl)))


def gera_arvore(seed, P):
    rng = random.Random(seed)
    ramos = []
    H = P['altura']
    # tronco: sobe com uma curva leve
    lean = Vector((rng.uniform(-0.12, 0.12), rng.uniform(-0.12, 0.12), 1.0))
    tronco = cresce(rng, Vector((0, 0, 0)), lean, H, P['r_base'], P['r_topo'], 0, 0.045, 0.0, 0.0, passo=0.5)
    # base mais larga (sapopemas): infla os raios perto do chão
    for i, p in enumerate(tronco.pts):
        tronco.raios[i] *= 1.0 + P['flare'] * math.exp(-p.z / 1.2)
    ramos.append(tronco)

    # raízes tabulares: pequenos contrafortes saindo da base
    for k in range(P['raizes']):
        a = k / P['raizes'] * math.tau + rng.uniform(-0.3, 0.3)
        d0 = Vector((math.cos(a) * 0.9, math.sin(a) * 0.9, 0.35))
        r = cresce(rng, Vector((math.cos(a) * 0.15, math.sin(a) * 0.15, 0.55)), d0, rng.uniform(2.0, 3.2),
                   P['r_base'] * 0.55, 0.05, 1, 0.05, 0.0, 0.9, passo=0.4)
        ramos.append(r)

    # galhos grandes em espiral na parte de cima do tronco
    a0 = rng.uniform(0, math.tau)
    for k in range(P['galhos']):
        t = P['galho_ini'] + (P['galho_fim'] - P['galho_ini']) * (k / max(1, P['galhos'] - 1))
        pos, _, r = ponto_em(tronco, t)
        a = a0 + k * 2.399963 + rng.uniform(-0.25, 0.25)
        incl = math.radians(rng.uniform(52, 78) - 18 * (t - P['galho_ini']) / (P['galho_fim'] - P['galho_ini'] + 1e-6))
        comp = P['galho_comp'] * rng.uniform(0.8, 1.15) * (1.15 - 0.45 * (t - P['galho_ini']) / (P['galho_fim'] - P['galho_ini'] + 1e-6))
        g = cresce(rng, pos, azimute(a, incl), comp, r * 0.55, 0.05, 1, 0.07, 0.02, 0.0, passo=1.0)
        ramos.append(g)
        # galhos médios ao longo do galho grande
        nm = rng.randint(P['medios'][0], P['medios'][1])
        for j in range(nm):
            tt = 0.18 + 0.78 * (j + rng.random() * 0.6) / nm
            p2, d2, r2 = ponto_em(g, tt)
            lado = rng.choice((-1, 1))
            eixo = d2.cross(UP).normalized() * lado
            dir2 = (d2 * 0.6 + eixo * 0.7 + UP * rng.uniform(0.0, 0.5)).normalized()
            m = cresce(rng, p2, dir2, comp * rng.uniform(0.32, 0.5), r2 * 0.6, 0.03, 2, 0.09, 0.03, 0.0, passo=0.9)
            ramos.append(m)
            # ramos finos
            nt = rng.randint(P['finos'][0], P['finos'][1])
            for q in range(nt):
                t3 = 0.35 + 0.6 * (q + rng.random() * 0.5) / nt
                p3, d3, r3 = ponto_em(m, t3)
                eixo3 = d3.cross(Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(-0.2, 1)))).normalized()
                dir3 = (d3 * 0.7 + eixo3 * 0.6 + UP * 0.25).normalized()
                ramos.append(cresce(rng, p3, dir3, comp * rng.uniform(0.12, 0.22), r3 * 0.55, 0.012, 3, 0.1, 0.03, 0.0, passo=0.8))
    return ramos, rng


# ---------------------------------------------------------------
# Malhas
# ---------------------------------------------------------------
def tubo(ramo, lados, urep, vtile, bark_off):
    """Tubo com UV de casca: u dá voltas (urep, inteiro: sem emenda), v segue o comprimento."""
    pts, raios = ramo.pts, ramo.raios
    n = len(pts)
    # quadros por transporte paralelo
    T = []
    for i in range(n):
        a = pts[max(0, i - 1)]
        b = pts[min(n - 1, i + 1)]
        T.append((b - a).normalized())
    N0 = T[0].cross(Vector((1, 0, 0)))
    if N0.length < 1e-3:
        N0 = T[0].cross(Vector((0, 1, 0)))
    N = [N0.normalized()]
    for i in range(1, n):
        v = T[i - 1].cross(T[i])
        s = v.length
        if s > 1e-6:
            rot = Vector(N[-1])
            ang = math.asin(min(1.0, s))
            from mathutils import Quaternion
            q = Quaternion(v.normalized(), ang)
            rot.rotate(q)
            N.append(rot.normalized())
        else:
            N.append(N[-1].copy())
    verts, uvs, tris = [], [], []
    s = 0.0
    for i in range(n):
        if i:
            s += (pts[i] - pts[i - 1]).length
        B = T[i].cross(N[i]).normalized()
        for j in range(lados + 1):
            a = j / lados * math.tau
            off = N[i] * math.cos(a) + B * math.sin(a)
            verts.append(pts[i] + off * raios[i])
            uvs.append((j / lados * urep + bark_off, s / vtile))
    for i in range(n - 1):
        for j in range(lados):
            a = i * (lados + 1) + j
            b = a + 1
            c = a + lados + 1
            d = c + 1
            tris.append((a, c, b))
            tris.append((b, c, d))
    return verts, uvs, tris


def monta_tronco(ramos, rng, P):
    V, U, F = [], [], []
    for r in ramos:
        if r.nivel == 0:
            lados, comp_u = 10, 1.3
        elif r.nivel == 1:
            lados, comp_u = 5, 1.3
        elif r.nivel == 2:
            lados, comp_u = 4, 1.3
        else:
            lados, comp_u = 3, 1.3
        r0 = max(r.raios[0], 0.02)
        urep = max(1, round(math.tau * r0 / comp_u))
        v, u, f = tubo(r, lados, urep, 2.6, rng.random())
        base = len(V)
        V += v
        U += u
        F += [(a + base, b + base, c + base) for a, b, c in f]
    return V, U, F


def monta_folhas(ramos, rng, P):
    """Cartões de folha nas pontas dos ramos médios e finos."""
    V, U, F = [], [], []
    centro = Vector((0, 0, P['altura'] * P['galho_fim'] * 0.92))
    for r in ramos:
        if r.nivel < 1 or r.raios[0] > 0.8 and r.nivel == 0:
            continue
        if r.nivel == 1 and r.pts[0].z < 1.5:
            continue  # raízes
        n = P['cartoes_fino'] if r.nivel == 3 else P['cartoes_medio'] if r.nivel == 2 else P['cartoes_galho']
        t_ini = 0.5 if r.nivel == 1 else 0.45
        for k in range(n):
            t = t_ini + (1 - t_ini) * rng.random() if k else 1.0
            pos, d, _ = ponto_em(r, t)
            pos = pos + Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(-0.6, 0.8))) * 0.5
            fora = (pos - centro)
            fora = (fora.normalized() * 0.7 + Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(-0.3, 1))) * 0.7 + UP * 0.2).normalized()
            t1 = fora.cross(Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(-1, 1))))
            if t1.length < 1e-3:
                t1 = Vector((1, 0, 0))
            t1.normalize()
            t2 = fora.cross(t1).normalized()
            s = P['cartao'] * rng.uniform(0.8, 1.25)
            h = s / 2
            flip = rng.random() < 0.5
            quad = [(-1, -1), (1, -1), (1, 1), (-1, 1)]
            base = len(V)
            for a, b in quad:
                V.append(pos + t1 * a * h + t2 * b * h)
                u = 1.0 if ((a > 0) != flip) else 0.0
                U.append((u, 1.0 if b > 0 else 0.0))
            F += [(base, base + 1, base + 2), (base, base + 2, base + 3)]
    return V, U, F



def monta_lod(ramos, rng, P):
    """Versão muito leve para a distância (centenas de árvores aparecem nessa faixa):
    só o tronco, decimado (5 lados, 1 anel a cada ~2 m), e poucos cartões de folha
    grandes na copa (~250 triângulos no total)."""
    Vt, Ut, Ft, Vf, Uf, Ff = [], [], [], [], [], []
    centro = Vector((0, 0, P['altura'] * P['galho_fim'] * 0.92))
    for i, r in enumerate(ramos):
        if r.nivel == 0:
            pts = r.pts[::4] + ([r.pts[-1]] if (len(r.pts) - 1) % 4 else [])
            raios = r.raios[::4] + ([r.raios[-1]] if (len(r.raios) - 1) % 4 else [])
            urep = max(1, round(math.tau * max(r.raios[0], 0.02) / 1.3))
            v, u, f = tubo(Ramo(pts, raios, 0), 5, urep, 2.6, rng.random())
            Vt += v
            Ut += u
            Ft += f
            continue
        if r.nivel == 1 and r.pts[0].z < 1.5:
            continue  # raízes
        if r.nivel > 2 or (r.nivel == 2 and i % 5 != 0):
            continue
        n = 3 if r.nivel == 1 else 2
        for k in range(n):
            t = 0.55 + 0.45 * rng.random() if k else 1.0
            pos, d, _ = ponto_em(r, t)
            pos = pos + Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(-0.5, 0.9))) * 0.8
            fora = (pos - centro)
            fora = (fora.normalized() * 0.7 + Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(-0.3, 1))) * 0.7 + UP * 0.2).normalized()
            t1 = fora.cross(Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(-1, 1))))
            if t1.length < 1e-3:
                t1 = Vector((1, 0, 0))
            t1.normalize()
            t2 = fora.cross(t1).normalized()
            h = P['cartao'] * rng.uniform(1.8, 2.5) / 2
            flip = rng.random() < 0.5
            base = len(Vf)
            for a2, b2 in [(-1, -1), (1, -1), (1, 1), (-1, 1)]:
                Vf.append(pos + t1 * a2 * h + t2 * b2 * h)
                Uf.append((1.0 if ((a2 > 0) != flip) else 0.0, 1.0 if b2 > 0 else 0.0))
            Ff += [(base, base + 1, base + 2), (base, base + 2, base + 3)]
    return Vt, Ut, Ft, Vf, Uf, Ff


# ---------------------------------------------------------------
# Exportação para o jogo
# ---------------------------------------------------------------
def b64(a):
    return base64.b64encode(np.ascontiguousarray(a).tobytes()).decode()


def parte_jogo(V, U, F, tex, origem, altura):
    """Mesmo formato de tools/models/vegetacao_modelos.py (altura 1, base no chão).
    Blender: Z para cima. Jogo: Y para cima (x, z, -y)."""
    p = np.array([(v.x, v.z, -v.y) for v in V], dtype=np.float64)
    uv = np.array(U, dtype=np.float64)
    idx = np.array(F, dtype=np.int64).reshape(-1)
    q = (p - origem) / altura
    lo, hi = q.min(0), q.max(0)
    ulo, uhi = uv.min(0), uv.max(0)
    return {
        'n': int(len(q)),
        'box': [*np.round(lo, 5).tolist(), *np.round(hi, 5).tolist()],
        'uvbox': [*np.round(ulo, 5).tolist(), *np.round(uhi, 5).tolist()],
        'pos': b64(np.round((q - lo) / np.maximum(hi - lo, 1e-9) * 65535).astype('<u2')),
        'uv': b64(np.round((uv - ulo) / np.maximum(uhi - ulo, 1e-9) * 65535).astype('<u2')),
        'idx': b64(idx.astype('<u2')),
        'tex': tex,
    }


def png_para_jpg_b64(caminho, qualidade=88):
    img = bpy.data.images.load(caminho)
    img.file_format = 'JPEG'
    tmp = caminho + '.jpg'
    sc = bpy.context.scene
    sc.render.image_settings.file_format = 'JPEG'
    sc.render.image_settings.quality = qualidade
    img.save_render(tmp, scene=sc)
    return 'data:image/jpeg;base64,' + base64.b64encode(open(tmp, 'rb').read()).decode()


def arquivo_b64(caminho, mime):
    return f'data:{mime};base64,' + base64.b64encode(open(caminho, 'rb').read()).decode()


# ---------------------------------------------------------------
# Visualização (Cycles)
# ---------------------------------------------------------------
def cena_preview(Vt, Ut, Ft, Vf, Uf, Ff, pasta, saida, largura=900, altura=1100, amostras=48):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene

    def objeto(nome, V, U, F):
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
        return ob

    def mat_img(nome, caminho, cor_srgb=True):
        m = bpy.data.materials.new(nome)
        m.use_nodes = True
        nt = m.node_tree
        for n in list(nt.nodes):
            nt.nodes.remove(n)
        return m, nt

    # casca
    tr = objeto('tronco', Vt, Ut, Ft)
    m, nt = mat_img('casca', None)
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    bs = nt.nodes.new('ShaderNodeBsdfPrincipled')
    bs.inputs['Roughness'].default_value = 0.92
    tc = nt.nodes.new('ShaderNodeTexImage')
    tc.image = bpy.data.images.load(f'{pasta}/casca_cor.png')
    tn = nt.nodes.new('ShaderNodeTexImage')
    tn.image = bpy.data.images.load(f'{pasta}/casca_relevo.png')
    tn.image.colorspace_settings.name = 'Non-Color'
    nm = nt.nodes.new('ShaderNodeNormalMap')
    nm.inputs['Strength'].default_value = 1.2
    nt.links.new(tc.outputs['Color'], bs.inputs['Base Color'])
    nt.links.new(tn.outputs['Color'], nm.inputs['Color'])
    nt.links.new(nm.outputs['Normal'], bs.inputs['Normal'])
    nt.links.new(bs.outputs[0], out.inputs['Surface'])
    tr.data.materials.append(m)

    # folhas
    fo = objeto('folhas', Vf, Uf, Ff)
    m2, nt2 = mat_img('folhas', None)
    out2 = nt2.nodes.new('ShaderNodeOutputMaterial')
    bs2 = nt2.nodes.new('ShaderNodeBsdfPrincipled')
    bs2.inputs['Roughness'].default_value = 0.55
    if 'Subsurface Weight' in bs2.inputs:
        bs2.inputs['Subsurface Weight'].default_value = 0.15
    ti = nt2.nodes.new('ShaderNodeTexImage')
    ti.image = bpy.data.images.load(f'{pasta}/folhas.png')
    ti.interpolation = 'Linear'
    tr2 = nt2.nodes.new('ShaderNodeBsdfTransparent')
    mix = nt2.nodes.new('ShaderNodeMixShader')
    nt2.links.new(ti.outputs['Color'], bs2.inputs['Base Color'])
    nt2.links.new(ti.outputs['Alpha'], mix.inputs['Fac'])
    nt2.links.new(tr2.outputs[0], mix.inputs[1])
    nt2.links.new(bs2.outputs[0], mix.inputs[2])
    nt2.links.new(mix.outputs[0], out2.inputs['Surface'])
    fo.data.materials.append(m2)
    fo.active_material.use_backface_culling = False

    # chão
    bpy.ops.mesh.primitive_plane_add(size=120, location=(0, 0, 0))
    ch = bpy.context.active_object
    mc = bpy.data.materials.new('chao')
    mc.use_nodes = True
    mc.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.035, 0.07, 0.02, 1)
    mc.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = 1.0
    ch.data.materials.append(mc)

    # céu e sol
    w = bpy.data.worlds.new('mundo')
    sc.world = w
    w.use_nodes = True
    nw = w.node_tree
    for n in list(nw.nodes):
        nw.nodes.remove(n)
    sky = nw.nodes.new('ShaderNodeTexSky')
    try:
        sky.sky_type = 'NISHITA'
        sky.sun_elevation = math.radians(38)
        sky.sun_rotation = math.radians(210)
        sky.sun_size = math.radians(1.2)
        sky.air_density = 1.0
        sky.dust_density = 1.2
    except Exception:
        pass
    bg = nw.nodes.new('ShaderNodeBackground')
    bg.inputs['Strength'].default_value = 1.0
    wo = nw.nodes.new('ShaderNodeOutputWorld')
    nw.links.new(sky.outputs[0], bg.inputs['Color'])
    nw.links.new(bg.outputs[0], wo.inputs['Surface'])

    # câmera
    alt = max(v.z for v in Vt)
    cam = bpy.data.cameras.new('cam')
    cam.lens = 38
    co = bpy.data.objects.new('cam', cam)
    sc.collection.objects.link(co)
    co.location = (alt * 0.9, -alt * 1.7, alt * 0.38)
    alvo = Vector((0, 0, alt * 0.5))
    dir_ = alvo - co.location
    co.rotation_euler = dir_.to_track_quat('-Z', 'Y').to_euler()
    sc.camera = co

    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = amostras
    try:
        sc.cycles.use_denoising = True
    except Exception:
        pass
    sc.cycles.transparent_max_bounces = 16
    sc.render.resolution_x, sc.render.resolution_y = largura, altura
    sc.render.film_transparent = False
    sc.view_settings.view_transform = 'AgX'
    sc.render.image_settings.file_format = 'PNG'
    sc.render.filepath = saida
    bpy.ops.render.render(write_still=True)


# ---------------------------------------------------------------
PARAMS = {
    'dossel': dict(altura=22.0, r_base=0.62, r_topo=0.16, flare=1.1, raizes=6,
                   galhos=10, galho_ini=0.42, galho_fim=0.92, galho_comp=10.5,
                   medios=(4, 5), finos=(2, 3), cartao=3.3, cartoes_medio=8, cartoes_fino=6, cartoes_galho=10),
}

if __name__ == '__main__':
    pasta = sys.argv[1]
    seed = int(sys.argv[2]) if len(sys.argv) > 2 and not sys.argv[2].startswith('--') else 1
    js = sys.argv[sys.argv.index('--js') + 1] if '--js' in sys.argv else None
    sementes = [int(x) for x in sys.argv[sys.argv.index('--sementes') + 1].split(',')] if '--sementes' in sys.argv else [seed]
    P = PARAMS['dossel']
    modelos, alturas = {}, {}
    for k, sd in enumerate(sementes):
        ramos, rng = gera_arvore(sd, P)
        Vt, Ut, Ft = monta_tronco(ramos, rng, P)
        Vf, Uf, Ff = monta_folhas(ramos, rng, P)
        print(f'semente {sd}: ramos {len(ramos)}  tronco {len(Vt)} vert / {len(Ft)} tri   folhas {len(Vf)} vert / {len(Ff)} tri')
        if '--sem-render' not in sys.argv and k == 0:
            cena_preview(Vt, Ut, Ft, Vf, Uf, Ff, pasta, f'{pasta}/arvore_{sd}.png')
        alt = max(v.z for v in Vt)
        origem = np.array([0.0, 0.0, 0.0])
        chave = f'arvore_bl_{"abcdefgh"[k]}'
        modelos[chave] = [parte_jogo(Vt, Ut, Ft, 'tronco_bl', origem, alt), parte_jogo(Vf, Uf, Ff, 'folhas_bl', origem, alt)]
        alturas[chave] = round(alt, 2)
        # versão de longe (mesma textura): altura igual à de perto, para a troca não pular
        Lt, LUt, LFt, Lf, LUf, LFf = monta_lod(ramos, random.Random(sd + 99), P)
        modelos[chave + '_lo'] = [parte_jogo(Lt, LUt, LFt, 'tronco_bl', origem, alt), parte_jogo(Lf, LUf, LFf, 'folhas_bl', origem, alt)]
        print(f'   lod: tronco {len(LFt)} tri / folhas {len(LFf)} tri')
    if js:
        texs = {
            'tronco_bl': png_para_jpg_b64(f'{pasta}/casca_cor.png'),
            'tronco_bl_relevo': png_para_jpg_b64(f'{pasta}/casca_relevo.png', 92),
            'folhas_bl': arquivo_b64(f'{pasta}/folhas.png', 'image/png'),
        }
        with open(js, 'w') as f:
            f.write('// Árvores feitas no Blender (tools/models/blender_arvore.py). Não editar à mão.\n')
            f.write(f'export const VEG_BL_MODELOS = {json.dumps(modelos)};\n')
            f.write(f'export const VEG_BL_TEXTURAS = {json.dumps(texs)};\n')
            f.write(f'export const VEG_BL_ALTURA = {json.dumps(alturas)};\n')
        print('escrito', js, f'({len(modelos)} árvores)')
