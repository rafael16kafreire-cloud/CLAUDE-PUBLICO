# Reduz uma malha muito pesada e "assa" a cor da textura da versão detalhada numa UV nova da versão leve.
# Uso: blender -b -P reduzir_assar.py -- entrada.glb saida.glb [triangulos=40000] [textura=2048]
# (para modelos com muitas costuras de UV, onde reduzir direto estraga a textura)
import bpy, sys, os
a = sys.argv[sys.argv.index('--') + 1:]
src, out = a[0], a[1]
alvo = int(a[2]) if len(a) > 2 else 40000
tam = int(a[3]) if len(a) > 3 else 2048
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
meshes = [o for o in bpy.data.objects if o.type == 'MESH']
bpy.ops.object.select_all(action='DESELECT')
for o in meshes: o.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
if len(meshes) > 1: bpy.ops.object.join()
alta = bpy.context.view_layer.objects.active
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
# cópia leve
baixa = alta.copy(); baixa.data = alta.data.copy(); baixa.name = 'leve'
bpy.context.scene.collection.objects.link(baixa)
tris = sum(len(p.vertices) - 2 for p in baixa.data.polygons)
m = baixa.modifiers.new('reduzir', 'DECIMATE'); m.ratio = min(1, alvo / tris)
bpy.context.view_layer.objects.active = baixa
bpy.ops.object.modifier_apply(modifier=m.name)
# UV nova
while baixa.data.uv_layers: baixa.data.uv_layers.remove(baixa.data.uv_layers[0])
baixa.data.uv_layers.new(name='UV')
bpy.ops.object.select_all(action='DESELECT'); baixa.select_set(True); bpy.context.view_layer.objects.active = baixa
bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project(angle_limit=1.15, island_margin=0.003)
bpy.ops.object.mode_set(mode='OBJECT')
# material novo com imagem para assar
img = bpy.data.images.new('cor_assada', tam, tam)
mat = bpy.data.materials.new('pele'); mat.use_nodes = True
nt = mat.node_tree; bsdf = nt.nodes['Principled BSDF']
tex = nt.nodes.new('ShaderNodeTexImage'); tex.image = img
nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
bsdf.inputs['Roughness'].default_value = 0.85
baixa.data.materials.clear(); baixa.data.materials.append(mat)
nt.nodes.active = tex
# assa a cor (difusa) da alta para a baixa
sc = bpy.context.scene; sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = 1
bpy.ops.object.select_all(action='DESELECT'); alta.select_set(True); baixa.select_set(True); bpy.context.view_layer.objects.active = baixa
dims = max(baixa.dimensions)
bpy.ops.object.bake(type='DIFFUSE', pass_filter={'COLOR'}, use_selected_to_active=True, cage_extrusion=0.015 * dims, max_ray_distance=0.0, margin=8)
img.filepath_raw = os.path.splitext(out)[0] + '_cor.png'; img.file_format = 'PNG'; img.save()
bpy.data.objects.remove(alta, do_unlink=True)
bpy.ops.object.select_all(action='DESELECT'); baixa.select_set(True)
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', use_selection=True, export_animations=False, export_skins=False)
print('ASSADO', tris, '->', sum(len(p.vertices) - 2 for p in baixa.data.polygons), 'triângulos')
