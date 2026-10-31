# Tira a base redonda de estátua (tudo abaixo de BASE_Z) e mostra o que sobrou. Uso: DEFORMAR=blender/tirar_base.py BASE_Z=-3.3
import bmesh, os
corte = float(os.environ.get('BASE_Z', '0'))
bm = bmesh.new(); bm.from_mesh(obj.data)
fora = [f for f in bm.faces if max(v.co.z for v in f.verts) < corte]
bmesh.ops.delete(bm, geom=fora, context='FACES')
soltos = [v for v in bm.verts if not v.link_faces]; bmesh.ops.delete(bm, geom=soltos, context='VERTS')
bm.to_mesh(obj.data); bm.free(); print('BASE removida:', len(fora), 'faces')
# fica só com os pedaços grandes (tira farelos da base e lascas soltas)
bm = bmesh.new(); bm.from_mesh(obj.data); bm.verts.ensure_lookup_table()
vistos, ilhas = set(), []
for v0 in bm.verts:
    if v0.index in vistos: continue
    pilha, ilha = [v0], []
    vistos.add(v0.index)
    while pilha:
        v = pilha.pop(); ilha.append(v)
        for e in v.link_edges:
            w = e.other_vert(v)
            if w.index not in vistos: vistos.add(w.index); pilha.append(w)
    ilhas.append(ilha)
ilhas.sort(key=len, reverse=True)
maior = len(ilhas[0]); fora = [v for il in ilhas if len(il) < maior * 0.02 for v in il]
bmesh.ops.delete(bm, geom=fora, context='VERTS'); bm.to_mesh(obj.data); bm.free()
print('ilhas:', len(ilhas), 'removidas pequenas:', sum(1 for il in ilhas if len(il) < maior * 0.02))
