# Prepara um modelo qualquer para ser animado:
#  - abre .glb/.gltf/.fbx/.obj/.blend/.usdz/.stl
#  - tira esqueleto/animações antigas (fica só a malha na pose de descanso)
#  - junta tudo, aplica transformações e (opcional) reduz triângulos
#  - exporta .glb parado
# Uso: blender -b -P preparar.py -- entrada saida.glb [max_triangulos]
import bpy, sys, os
a = sys.argv[sys.argv.index('--') + 1:]
src, out = a[0], a[1]
maxtris = int(a[2]) if len(a) > 2 else 0
ext = os.path.splitext(src)[1].lower()
if ext == '.blend':
    bpy.ops.wm.open_mainfile(filepath=src)
else:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    imp = {'.glb': lambda: bpy.ops.import_scene.gltf(filepath=src), '.gltf': lambda: bpy.ops.import_scene.gltf(filepath=src),
           '.fbx': lambda: bpy.ops.import_scene.fbx(filepath=src), '.obj': lambda: bpy.ops.wm.obj_import(filepath=src),
           '.usdz': lambda: bpy.ops.wm.usd_import(filepath=src), '.usd': lambda: bpy.ops.wm.usd_import(filepath=src),
           '.usdc': lambda: bpy.ops.wm.usd_import(filepath=src), '.stl': lambda: bpy.ops.wm.stl_import(filepath=src)}
    imp[ext]()
# pose de descanso e sem animação
for o in bpy.data.objects:
    if o.type == 'ARMATURE':
        o.data.pose_position = 'REST'
        if o.animation_data: o.animation_data_clear()
bpy.context.view_layer.update()
meshes = [o for o in bpy.data.objects if o.type == 'MESH' and o.visible_get()]
# aplica modificadores (inclusive o de esqueleto em pose de descanso) e solta do pai
deps = bpy.context.evaluated_depsgraph_get()
new = []
for o in meshes:
    me = bpy.data.meshes.new_from_object(o.evaluated_get(deps))
    me.transform(o.matrix_world)
    n = bpy.data.objects.new(o.name + '_fixo', me)
    bpy.context.scene.collection.objects.link(n); new.append(n)
for o in list(bpy.data.objects):
    if o not in new: bpy.data.objects.remove(o, do_unlink=True)
bpy.ops.object.select_all(action='DESELECT')
for o in new: o.select_set(True)
bpy.context.view_layer.objects.active = new[0]
if len(new) > 1: bpy.ops.object.join()
obj = bpy.context.view_layer.objects.active
tris = sum(len(p.vertices) - 2 for p in obj.data.polygons)
if maxtris and tris > maxtris:
    m = obj.modifiers.new('reduzir', 'DECIMATE'); m.ratio = maxtris / tris
    bpy.ops.object.modifier_apply(modifier=m.name)
tris2 = sum(len(p.vertices) - 2 for p in obj.data.polygons)
print(f"PREPARADO {os.path.basename(src)}: {tris} -> {tris2} triângulos, materiais={[s.material.name if s.material else None for s in obj.material_slots]}")
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_animations=False, export_skins=False)
