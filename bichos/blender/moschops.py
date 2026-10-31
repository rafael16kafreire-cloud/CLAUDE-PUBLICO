# Remodela o Dimetrodonte (cp4096, CC BY 4.0) em um Moschops:
#  - a vela das costas é achatada até virar uma corcova baixa nos ombros
#  - corpo em barril (mais largo e mais alto), cauda curta, cabeça grande com focinho curto
# Uso: DEFORMAR=blender/moschops.py blender -b -P blender/preparar.py -- dime_cp.glb teste/moschops_parado.glb
# (no modelo original: y pequeno = cabeça, y grande = cauda, z = altura, x = largura)
import numpy as np
me = obj.data
v = np.array([tuple(x.co) for x in me.vertices])
x, y, z = v[:, 0].copy(), v[:, 1].copy(), v[:, 2].copy()
# 0) fecha a boca: a mandíbula de baixo (abaixo de z≈0.42, na frente da articulação) gira para cima
hy, hz, ang = 0.34, 0.42, np.radians(-56)
peso = np.clip((0.36 - y) / 0.1, 0, 1) * (z < 0.42)
dy, dz = y - hy, z - hz
c, sn = np.cos(ang * peso), np.sin(ang * peso)
y, z = hy + c * dy - sn * dz, hz + sn * dy + c * dz
# 1) linha das costas: maior altura do corpo (longe do meio) em cada fatia ao longo do comprimento
bins = np.linspace(y.min(), y.max(), 41)
topo = np.full(40, -1.0)
for i in range(40):
    s = (y >= bins[i]) & (y < bins[i + 1]) & (np.abs(x) > 0.06)
    if s.any(): topo[i] = z[s].max()
ok = topo > 0; ctr = (bins[:-1] + bins[1:]) / 2
topo = np.interp(ctr, ctr[ok], topo[ok])
topo = np.convolve(np.pad(topo, 2, mode='edge'), np.ones(5) / 5, mode='valid')
top_y = np.interp(y, ctr, topo)
# 2) achata a vela: tudo que passa da linha das costas desce para uma corcova baixa (mais alta nos ombros)
acima = z > top_y + 0.01
corcova = 0.05 + 0.07 * np.exp(-((y - 0.75) / 0.35) ** 2)
alt = np.maximum(1e-3, z.max() - top_y)
z = np.where(acima, top_y + corcova * np.sqrt(np.clip((z - top_y) / alt, 0, 1)), z)
# 3) cauda curta (a partir dos quadris)
q = 1.85
y = np.where(y > q, q + (y - q) * 0.32, y)
# 4) corpo em barril: mais largo no tronco, mais alto em cima
tronco = np.exp(-((y - 1.05) / 0.75) ** 2)
x = x * (1.35 + 0.45 * tronco)
zc = 0.45
z = np.where(z > zc, zc + (z - zc) * (1.0 + 0.35 * tronco), z)
# 5) cabeça grande e focinho curto (frente: y < 0.35)
cab = np.clip((0.35 - y) / 0.35, 0, 1)
hc = np.array([0.0, 0.2, 0.45])
k = 1 + 0.3 * cab
x = x * (1 + 0.25 * cab)
z = np.where(cab > 0, hc[2] + (z - hc[2]) * k, z)
y = np.where(y < 0.12, 0.12 + (y - 0.12) * 0.7, y)
for i, vv in enumerate(me.vertices):
    vv.co = (x[i], y[i], z[i])
me.update()
# (a cor mais terrosa é aplicada depois com variante.mjs)
print('MOSCHOPS: vela achatada em', int(acima.sum()), 'vértices')
