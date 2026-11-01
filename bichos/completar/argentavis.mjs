// Argentavis (modelo novo: Osprey do Pigcraft, CC BY) — todas as animações feitas aqui, sobre o esqueleto do ave.mjs.
// Pose de descanso do modelo: asas para cima em V, pernas penduradas (tocam o chão), corpo inclinado ~21° (cabeça alta).
// Poses calculadas no node: para cada osso, a rotação que leva a direção de descanso até a direção desejada.
// Eixos do mundo: X = esquerda do bicho, Y = cima, Z = frente.  Rode depois de: node ave.mjs config/argentavis_rig.json
import { readFileSync } from 'node:fs';
const rig = JSON.parse(readFileSync(new URL('../config/argentavis_rig.json', import.meta.url), 'utf8'));
const O = Object.fromEntries(rig.ossos.map(([n, pai, h, t]) => [n, { pai, h, t }]));
const mul = (a, b) => [a[3]*b[0] + a[0]*b[3] + a[1]*b[2] - a[2]*b[1], a[3]*b[1] - a[0]*b[2] + a[1]*b[3] + a[2]*b[0],
                       a[3]*b[2] + a[0]*b[1] - a[1]*b[0] + a[2]*b[3], a[3]*b[3] - a[0]*b[0] - a[1]*b[1] - a[2]*b[2]];
const inv = q => [-q[0], -q[1], -q[2], q[3]];
const norm = v => { const l = Math.hypot(...v); return v.map(x => x / l); };
const rot = (q, v) => { const r = mul(mul(q, [...v, 0]), inv(q)); return [r[0], r[1], r[2]]; };
const eixo = (ax, g) => { const h = g * Math.PI / 360, s = Math.sin(h), n = norm(ax); return [n[0] * s, n[1] * s, n[2] * s, Math.cos(h)]; };
const deVetor = (a, b) => { a = norm(a); b = norm(b); const c = [a[1]*b[2] - a[2]*b[1], a[2]*b[0] - a[0]*b[2], a[0]*b[1] - a[1]*b[0]], d = a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
  return norm([c[0], c[1], c[2], 1 + d]); };
const dir = n => norm(O[n].t.map((v, k) => v - O[n].h[k]));
// corrente de ossos → rotações (no referencial de descanso do pai, como o completar.mjs usa)
function apontar(T0, lista) { const out = {}; let T = T0;
  for (const [n, alvo] of lista) { const extra = deVetor(rot(T, dir(n)), alvo); out[n] = mul(inv(T), mul(extra, T)); T = mul(extra, T); }
  return out; }
const esp = v => [-v[0], v[1], v[2]];
const corpo = eixo([1, 0, 0], -21);                 // inclinação natural do corpo (para alinhar as asas dobradas ao corpo)
const asas = (dirs, T0 = [0, 0, 0, 1]) => Object.assign(
  apontar(T0, [['asa1_E', dirs[0]], ['asa2_E', dirs[1]], ['asa3_E', dirs[2]]]),
  apontar(T0, [['asa1_D', esp(dirs[0])], ['asa2_D', esp(dirs[1])], ['asa3_D', esp(dirs[2])]]));
// asas dobradas em Z junto ao corpo
const DOBRADA = asas([rot(corpo, [0.32, -0.2, -0.92]), rot(corpo, [0.18, 0.02, 0.98]), rot(corpo, [0.1, -0.06, -0.99])]);
// asas abertas na horizontal (corpo nivelado depois, no clipe)
const ABERTA = asas([[1, 0.06, 0.02], [1, 0.08, -0.06], [1, 0.02, -0.12]]);
const vars = { DOBRADA, ABERTA, H: `({
  mul: (a, b) => [a[3]*b[0] + a[0]*b[3] + a[1]*b[2] - a[2]*b[1], a[3]*b[1] - a[0]*b[2] + a[1]*b[3] + a[2]*b[0], a[3]*b[2] + a[0]*b[1] - a[1]*b[0] + a[2]*b[3], a[3]*b[3] - a[0]*b[0] - a[1]*b[1] - a[2]*b[2]],
  slerp(a, b, t) { let d = a[0]*b[0] + a[1]*b[1] + a[2]*b[2] + a[3]*b[3]; if (d < 0) { b = b.map(x => -x); d = -d; }
    if (d > 0.9995) { const r = a.map((x, i) => x + (b[i] - x) * t), l = Math.hypot(...r); return r.map(x => x / l); }
    const th = Math.acos(d), s = Math.sin(th); return a.map((x, i) => x * Math.sin((1 - t) * th) / s + b[i] * Math.sin(t * th) / s); },
  eul(x, y, z) { const r = Math.PI / 360, cx = Math.cos(x*r), sx = Math.sin(x*r), cy = Math.cos(y*r), sy = Math.sin(y*r), cz = Math.cos(z*r), sz = Math.sin(z*r);
    return [sx*cy*cz + cx*sy*sz, cx*sy*cz - sx*cy*sz, cx*cy*sz - sx*sy*cz, cx*cy*cz + sx*sy*sz]; },
  // asas: mistura dobrada→aberta (a); extra: {osso: [graus x, y, z]} aplicado por cima; pos: deslocamento do quadril
  pose(a, extra = {}, pos = [0, 0, 0]) { const I = [0, 0, 0, 1], out = { $pos: { quadril: pos } };
    for (const n of new Set([...Object.keys(DOBRADA), ...Object.keys(extra)])) {
      let q = DOBRADA[n] ? this.slerp(DOBRADA[n], ABERTA[n], a) : I; if (extra[n]) q = this.mul(this.eul(...extra[n]), q); out[n] = q; }
    return out; }
})` };
const pre = 'const h = eval(H);';
export default {
  modelo: '../teste/ave_rig.glb', saida: process.env.SAIDA || '../modelos/argentavis.glb', vars, remover: ['repouso'],
  clipes: [
    { nome: 'parado', base: 'repouso', baseT: 0, dur: 4, f: `(t, d, u) => { ${pre}
      return h.pose(0, { coluna: [1.5 * u.sin(t, 4), 0, 0], pescoco: [4, 14 * u.sin(t, 4), 0], cabeca: [-6 + 3 * u.sin(t, 2), 10 * u.sin(t, 4, 0.1), 0], cauda_1: [0, 3 * u.sin(t, 2), 0] }); }` },
    { nome: 'andar', base: 'repouso', baseT: 0, dur: 1.2, f: `(t, d, u) => { ${pre} const s = u.sin(t, 1.2), c = u.sin(t, 1.2, 0.25);
      return h.pose(0, { coxa_E: [-24 * s, 0, 0], coxa_D: [24 * s, 0, 0], canela_E: [18 * Math.max(0, c), 0, 0], canela_D: [18 * Math.max(0, -c), 0, 0],
        quadril: [0, 7 * s, 5 * s], pescoco: [6 * Math.abs(s), -6 * s, 0], cauda_1: [0, -8 * s, 0] }, [0, -0.05 * Math.abs(c), 0]); }` },
    { nome: 'correr', base: 'repouso', baseT: 0, dur: 0.6, f: `(t, d, u) => { ${pre} const s = u.sin(t, 0.6), c = u.sin(t, 0.6, 0.25);
      return h.pose(0.35, { coxa_E: [-36 * s, 0, 0], coxa_D: [36 * s, 0, 0], canela_E: [30 * Math.max(0, c), 0, 0], canela_D: [30 * Math.max(0, -c), 0, 0],
        quadril: [12, 6 * s, 0], pescoco: [-6, 0, 0], asa1_E: [0, 0, 12 * s], asa1_D: [0, 0, -12 * s] }, [0, -0.1 * Math.abs(c), 0]); }` },
    { nome: 'voar', base: 'repouso', baseT: 0, dur: 1.0, f: `(t, d, u) => { ${pre} const s = u.sin(t, 1), s2 = u.sin(t, 1, -0.08);
      return h.pose(1, { quadril: [21 + 3 * s, 0, 0], pescoco: [-14, 0, 0], cabeca: [-8, 0, 0], asa1_E: [0, 0, 34 * s], asa1_D: [0, 0, -34 * s],
        asa2_E: [0, 0, 18 * s2], asa2_D: [0, 0, -18 * s2], asa3_E: [0, 0, 12 * s2], asa3_D: [0, 0, -12 * s2],
        coxa_E: [70, 0, 0], coxa_D: [70, 0, 0], canela_E: [40, 0, 0], canela_D: [40, 0, 0], cauda_1: [-8 - 3 * s, 0, 0] }, [0, 1.2 - 0.12 * s, 0]); }` },
    { nome: 'planar', base: 'repouso', baseT: 0, dur: 6, f: `(t, d, u) => { ${pre} const b = u.sin(t, 6);
      return h.pose(1, { quadril: [21 + 2 * u.sin(t, 3), 0, 9 * b], pescoco: [-14, -6 * b, 0], cabeca: [-8, -8 * b, 0], asa1_E: [0, 0, -4 + 3 * u.sin(t, 3)], asa1_D: [0, 0, 4 - 3 * u.sin(t, 3)],
        asa3_E: [0, 0, 6], asa3_D: [0, 0, -6], coxa_E: [70, 0, 0], coxa_D: [70, 0, 0], canela_E: [40, 0, 0], canela_D: [40, 0, 0], cauda_1: [-8, 0, 0] }, [0, 1.2 + 0.08 * u.sin(t, 3), 0]); }` },
    { nome: 'atacar', base: 'repouso', baseT: 0, dur: 1.3, f: `(t, d, u) => { ${pre} const a = u.ida(t, 0, 0.35, 0.35, 0.5), b = u.ida(t, 0.35, 0.55, 0.8, 1.3), w = u.ida(t, 0, 0.3, 0.85, 1.3);
      return h.pose(0.85 * w, { quadril: [-10 * a + 18 * b, 0, 0], pescoco: [-15 * a + 25 * b, 0, 0], cabeca: [-8 * a + 15 * b, 0, 0],
        coxa_E: [-40 * b, 0, 0], coxa_D: [-35 * b, 0, 0], canela_E: [-20 * b, 0, 0], canela_D: [-20 * b, 0, 0], asa1_E: [0, 0, 20 * a - 10 * b], asa1_D: [0, 0, -20 * a + 10 * b] },
        [0, 0.25 * b, 0.5 * b]); }` },
    { nome: 'rugir', base: 'repouso', baseT: 0, dur: 2.6, f: `(t, d, u) => { ${pre} const k = u.ida(t, 0, 0.6, 2.0, 2.6), tr = u.sin(t, 0.14) * u.ida(t, 0.5, 0.8, 1.8, 2.2);
      return h.pose(k, { quadril: [-6 * k, 0, 0], pescoco: [-18 * k, 3 * tr, 0], cabeca: [-14 * k + 3 * tr, 5 * tr, 0], asa1_E: [0, 0, 22 * k], asa1_D: [0, 0, -22 * k], cauda_1: [-10 * k, 0, 0] }); }` },
    { nome: 'comer', base: 'repouso', baseT: 0, dur: 3, f: `(t, d, u) => { ${pre} const k = u.e(t, 0, 0.5) * (1 - u.e(t, 2.5, 3)), p = Math.max(0, u.sin(t, 1)) * k;
      return h.pose(0.1 * p, { quadril: [30 * k, 0, 0], coluna: [10 * k, 0, 0], pescoco: [30 * k + 14 * p, 0, 0], cabeca: [15 * k - 10 * p, 0, 0], cauda_1: [-20 * k, 0, 0] }); }` },
    { nome: 'dormir', base: 'repouso', baseT: 0, dur: 5, f: `(t, d, u) => { ${pre} const b = u.sin(t, 5);
      return h.pose(0, { coxa_E: [-40, 0, 0], coxa_D: [-40, 0, 0], canela_E: [80, 0, 0], canela_D: [80, 0, 0], pe_E: [-40, 0, 0], pe_D: [-40, 0, 0],
        quadril: [12, 0, 0], coluna: [2 * b, 0, 0], pescoco: [-20, 120, 0], cabeca: [25, 40, 0], cauda_1: [-6, 0, 0] }, [0, -0.38, 0]); }` },
    { nome: 'morrer', base: 'repouso', baseT: 0, dur: 3, f: `(t, d, u) => { ${pre} const a = u.ida(t, 0, 0.4, 0.5, 1.0), c = u.e(t, 0.6, 1.8), q = u.e(t, 1.5, 2.3);
      return h.pose(0.7 * a + 0.5 * c, { quadril: [-14 * a + 30 * c, 0, 80 * c], pescoco: [-20 * a + 30 * q, 0, 20 * q], cabeca: [-10 * a, 0, 20 * q],
        coxa_E: [-30 * c, 0, 0], coxa_D: [-10 * c, 0, 0], asa1_E: [0, 0, 20 * a - 40 * c], asa1_D: [0, 0, -20 * a] }, [0, -0.5 * c, 0]); }` },
  ],
};
