// Argentavis (águia do GremorySaiyan): o modelo só sabe voar. Aqui são calculadas poses no chão
// (asas dobradas, pernas em pé, corpo inclinado) e, com elas, parado, andar, correr, atacar, rugir, comer, dormir, morrer.
// As poses são resolvidas aqui no node: para cada osso, a rotação que leva a direção de descanso até a direção desejada.
import { readFileSync } from 'node:fs';
const linhas = readFileSync(new URL('./argentavis_ossos.txt', import.meta.url), 'utf8').trim().split('\n').map(l => l.trim().split(/\s+/));
const P = Object.fromEntries(linhas.map(([n, , x, y, z]) => [n, [+x, +y, +z]]));
// --- quatérnios [x, y, z, w]
const mul = (a, b) => [a[3]*b[0] + a[0]*b[3] + a[1]*b[2] - a[2]*b[1], a[3]*b[1] - a[0]*b[2] + a[1]*b[3] + a[2]*b[0],
                       a[3]*b[2] + a[0]*b[1] - a[1]*b[0] + a[2]*b[3], a[3]*b[3] - a[0]*b[0] - a[1]*b[1] - a[2]*b[2]];
const inv = q => [-q[0], -q[1], -q[2], q[3]];
const norm = v => { const l = Math.hypot(...v); return v.map(x => x / l); };
const rot = (q, v) => { const r = mul(mul(q, [...v, 0]), inv(q)); return [r[0], r[1], r[2]]; };
const eixo = (ax, g) => { const h = g * Math.PI / 360, s = Math.sin(h), n = norm(ax); return [n[0] * s, n[1] * s, n[2] * s, Math.cos(h)]; };
const deVetor = (a, b) => { a = norm(a); b = norm(b); const c = [a[1]*b[2] - a[2]*b[1], a[2]*b[0] - a[0]*b[2], a[0]*b[1] - a[1]*b[0]], d = a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
  return norm([c[0], c[1], c[2], 1 + d]); };
const dir = (a, b) => norm([P[b][0] - P[a][0], P[b][1] - P[a][1], P[b][2] - P[a][2]]);
// corrente: [[osso, filho usado como ponta, direção desejada no mundo]...], T0 = rotação acumulada do pai
function apontar(T0, corrente) {
  const out = {}; let T = T0;
  for (const [osso, ponta, alvo] of corrente) {
    const atual = rot(T, dir(osso, ponta)), extra = deVetor(atual, alvo);   // gira a partir da direção já carregada pelo pai
    out[osso] = mul(inv(T), mul(extra, T));                                  // rotação no referencial de descanso do pai (como o completar.mjs usa)
    T = mul(extra, T);
  }
  return [out, T];
}
const espelha = v => [-v[0], v[1], v[2]];
function pose({ incl, pernas, dobra = 1, pescoco = [0, 0, 0], cabeca = 0 }) {
  const Pq = eixo([1, 0, 0], incl), out = { 'Bip01_Pelvis_02': Pq };
  // asas dobradas junto ao corpo (direções no referencial do corpo, depois inclinadas com ele)
  const asa = (lado, s) => apontar(Pq, [
    [`BN_Wing_${lado}_01_0${lado === 'L' ? '0' : '16'}`, `BN_Wing_${lado}_02_0${lado === 'L' ? '11' : '17'}`, rot(Pq, s([0.32, -0.12, -0.94]))],
    [`BN_Wing_${lado}_02_0${lado === 'L' ? '11' : '17'}`, `BN_Wing_${lado}_03_0${lado === 'L' ? '12' : '18'}`, rot(Pq, s([0.22, 0.05, 0.97]))],
    [`BN_Wing_${lado}_03_0${lado === 'L' ? '12' : '18'}`, `BN_Wing_${lado}_04_0${lado === 'L' ? '13' : '19'}`, rot(Pq, s([0.1, 0.02, -0.99]))],
  ])[0];
  if (dobra) { Object.assign(out, asa('L', v => v), asa('R', espelha)); out.BN_Wing_L_05_014 = [0, 0, 0, 1]; out.BN_Wing_R_05_020 = [0, 0, 0, 1]; }
  // pernas (direções no mundo)
  let pe = 0;
  for (const [lado, n] of [['L', ['Bip01_L_Thigh_022', 'Bip01_L_Calf_023', 'Bip01_L_HorseLink_024', 'Bip01_L_Foot_025', 'BN_Toe_L_30_028']],
                           ['R', ['Bip01_R_Thigh_034', 'Bip01_R_Calf_035', 'Bip01_R_HorseLink_036', 'Bip01_R_Foot_037', 'BN_Toe_R_10_038']]]) {
    const x = lado === 'L' ? 0.08 : -0.08;
    const [o] = apontar(Pq, n.slice(0, 4).map((b, i) => [b, n[i + 1], norm([x, ...pernas[i]])]));
    Object.assign(out, o);
    // altura do pé: soma dos ossos ao longo das direções desejadas
    let y = 0; n.slice(0, 4).forEach((b, i) => { const L = Math.hypot(...P[n[i + 1]].map((v, k) => v - P[b][k])); y += L * norm([x, ...pernas[i]])[1]; });
    pe = Math.min(pe, y);
  }
  // pescoço e cabeça: desfaz a inclinação do corpo e aplica a pose pedida
  out.Bip01_Neck_05 = eixo([1, 0, 0], -incl * 0.4 + pescoco[0]);
  out.Bip01_Neck1_06 = mul(eixo([0, 1, 0], pescoco[1]), eixo([1, 0, 0], -incl * 0.3));
  out.Bip01_Neck2_07 = eixo([1, 0, 0], -incl * 0.1 + pescoco[2]);
  out.Bip01_Head_08 = eixo([1, 0, 0], cabeca);
  out.Bip01_Spine_03 = [0, 0, 0, 1];
  // altura: quadril → coxa → pé tem que encostar no chão (+ 0.08 de dedos)
  const quadrilY = -pe + 0.08 + (P.Bip01_Pelvis_02[1] - P.Bip01_L_Thigh_022[1]);
  return { q: out, dy: quadrilY - P.Bip01_Pelvis_02[1] };
}
const POUSO = pose({ incl: -38, pernas: [[-0.45, 0.89], [-0.72, -0.69], [-0.99, 0.12], [-0.15, 0.99]], pescoco: [-22, 0, -4], cabeca: -6 });
const AGACHA = pose({ incl: -8, pernas: [[-0.25, 0.97], [-0.35, -0.94], [-0.45, 0.89], [-0.1, 0.99]], pescoco: [10, 0, 10], cabeca: 6 });
const ASAS = pose({ incl: -38, dobra: 0, pernas: [[-0.45, 0.89], [-0.72, -0.69], [-0.99, 0.12], [-0.15, 0.99]] });
// ---- código que roda no navegador (recebe as poses prontas)
const H = `({
  mul: (a, b) => [a[3]*b[0] + a[0]*b[3] + a[1]*b[2] - a[2]*b[1], a[3]*b[1] - a[0]*b[2] + a[1]*b[3] + a[2]*b[0], a[3]*b[2] + a[0]*b[1] - a[1]*b[0] + a[2]*b[3], a[3]*b[3] - a[0]*b[0] - a[1]*b[1] - a[2]*b[2]],
  slerp: (a, b, t) => { let d = a[0]*b[0] + a[1]*b[1] + a[2]*b[2] + a[3]*b[3]; if (d < 0) { b = b.map(x => -x); d = -d; }
    if (d > 0.9995) { const r = a.map((x, i) => x + (b[i] - x) * t), l = Math.hypot(...r); return r.map(x => x / l); }
    const th = Math.acos(d), s = Math.sin(th), wa = Math.sin((1 - t) * th) / s, wb = Math.sin(t * th) / s; return a.map((x, i) => x * wa + b[i] * wb); },
  eul: (x, y, z) => { const r = Math.PI / 360, cx = Math.cos(x*r), sx = Math.sin(x*r), cy = Math.cos(y*r), sy = Math.sin(y*r), cz = Math.cos(z*r), sz = Math.sin(z*r);
    return [sx*cy*cz + cx*sy*sz, cx*sy*cz - sx*cy*sz, cx*cy*sz - sx*sy*cz, cx*cy*cz + sx*sy*sz]; },
  // mistura duas poses (A→B por t) e soma ajustes em graus {osso: [x, y, z]}
  junta(A, B, t, extra = {}, dy = null) { const I = [0, 0, 0, 1], out = {}, nomes = new Set([...Object.keys(A.q), ...Object.keys(B.q), ...Object.keys(extra)]);
    for (const n of nomes) { let q = this.slerp(A.q[n] || I, B.q[n] || I, t); if (extra[n]) q = this.mul(this.eul(...extra[n]), q); out[n] = q; }
    out.$pos = { Bip01_Pelvis_02: [0, dy ?? (A.dy + (B.dy - A.dy) * t), 0] }; return out; }
})`;
const vars = { POUSO, AGACHA, ASAS, H };
const pre = 'const h = eval(H);';
const VOO = { q: {}, dy: 0 };
vars.VOO = VOO;
export default {
  modelo: '../modelos/argentavis.glb', saida: process.env.SAIDA || '../modelos/argentavis.glb', vars,
  clipes: [
    // planar: asas abertas paradas (quadro do voo com as asas na horizontal), balançando de leve
    { nome: 'planar', base: 'voar', baseT: 0.1, dur: 4, f: `(t, d, u) => ({ Bip01_Pelvis_02: [3 * u.sin(t, 4, 0.25), 0, 7 * u.sin(t, 4)], Bip01_Head_08: [0, -6 * u.sin(t, 4), 0],
      BN_Wing_L_01_00: [0, 0, 3 * u.sin(t, 2)], BN_Wing_R_01_016: [0, 0, -3 * u.sin(t, 2)], $pos: { Bip01_Pelvis_02: [0, 0.15 * u.sin(t, 4, 0.25), 0] } })` },
    { nome: 'parado', base: 'voar', baseT: 0, dur: 4, f: `(t, d, u) => { ${pre}
      return h.junta(POUSO, POUSO, 0, { Bip01_Spine1_04: [u.sin(t, 4) * 1.5, 0, 0], Bip01_Neck2_07: [0, 18 * u.sin(t, 4), 0], Bip01_Head_08: [3 * u.sin(t, 2), 0, 0] }); }` },
    { nome: 'andar', base: 'voar', baseT: 0, dur: 1.2, f: `(t, d, u) => { ${pre} const s = u.sin(t, 1.2), c = u.sin(t, 1.2, 0.25);
      const p = h.junta(POUSO, POUSO, 0, { Bip01_L_Thigh_022: [-22 * s, 0, 0], Bip01_R_Thigh_034: [22 * s, 0, 0], Bip01_L_Calf_023: [12 * Math.max(0, c), 0, 0], Bip01_R_Calf_035: [12 * Math.max(0, -c), 0, 0],
        Bip01_Pelvis_02: [0, 6 * s, 4 * s], Bip01_Neck1_06: [6 * Math.abs(s) - 3, 0, 0] });
      p.$pos.Bip01_Pelvis_02[1] -= 0.06 * Math.abs(c); return p; }` },
    { nome: 'correr', base: 'voar', baseT: 0, dur: 0.6, f: `(t, d, u) => { ${pre} const s = u.sin(t, 0.6), c = u.sin(t, 0.6, 0.25);
      const p = h.junta(POUSO, ASAS, 0.35, { Bip01_L_Thigh_022: [-34 * s, 0, 0], Bip01_R_Thigh_034: [34 * s, 0, 0], Bip01_L_Calf_023: [20 * Math.max(0, c), 0, 0], Bip01_R_Calf_035: [20 * Math.max(0, -c), 0, 0],
        Bip01_Pelvis_02: [14, 8 * s, 0], Bip01_Neck_05: [-10, 0, 0] });
      p.$pos.Bip01_Pelvis_02[1] -= 0.12 * Math.abs(c); return p; }` },
    { nome: 'atacar', base: 'voar', baseT: 0, dur: 1.3, f: `(t, d, u) => { ${pre} const a = u.ida(t, 0, 0.35, 0.35, 0.5), b = u.ida(t, 0.35, 0.55, 0.8, 1.3), m = u.ida(t, 0.3, 0.45, 0.65, 0.85), w = u.ida(t, 0, 0.3, 0.8, 1.3);
      return h.junta(POUSO, ASAS, 0.7 * w, { Bip01_Neck_05: [-20 * a + 40 * b, 0, 0], Bip01_Neck1_06: [-10 * a + 20 * b, 0, 0], Bip01_Head_08: [10 * b, 0, 0], BN_Jaw_09: [30 * m, 0, 0], Bip01_Pelvis_02: [-6 * a + 12 * b, 0, 0] }); }` },
    { nome: 'rugir', base: 'voar', baseT: 0, dur: 2.6, f: `(t, d, u) => { ${pre} const k = u.ida(t, 0, 0.6, 2.0, 2.6), m = u.ida(t, 0.5, 0.75, 1.9, 2.2), tr = u.sin(t, 0.14) * m;
      return h.junta(POUSO, ASAS, k, { Bip01_Neck_05: [-16 * k, 0, 0], Bip01_Neck1_06: [-10 * k, 0, 0], Bip01_Head_08: [-12 * k + 3 * tr, 4 * tr, 0], BN_Jaw_09: [38 * m, 0, 0] }); }` },
    { nome: 'comer', base: 'voar', baseT: 0, dur: 3, f: `(t, d, u) => { ${pre} const k = u.e(t, 0, 0.5) * (1 - u.e(t, 2.5, 3)), p = Math.max(0, u.sin(t, 1)) * k, m = Math.max(0, u.sin(t, 1, 0.6)) * k;
      return h.junta(POUSO, POUSO, 0, { Bip01_Pelvis_02: [22 * k, 0, 0], Bip01_Neck_05: [30 * k + 12 * p, 0, 0], Bip01_Neck1_06: [24 * k, 0, 0], Bip01_Neck2_07: [10 * k, 0, 0], Bip01_Head_08: [10 * k, 0, 0], BN_Jaw_09: [26 * m, 0, 0] }); }` },
    { nome: 'dormir', base: 'voar', baseT: 0, dur: 5, f: `(t, d, u) => { ${pre} const b = u.sin(t, 5);
      return h.junta(AGACHA, AGACHA, 0, { Bip01_Spine1_04: [b * 2, 0, 0], Bip01_Neck_05: [-20, 0, 0], Bip01_Neck1_06: [0, 110, 0], Bip01_Neck2_07: [0, 40, 0], Bip01_Head_08: [30, 0, 0] }); }` },
    { nome: 'morrer', base: 'voar', baseT: 0, dur: 3, f: `(t, d, u) => { ${pre} const a = u.ida(t, 0, 0.4, 0.5, 1.0), c = u.e(t, 0.6, 1.8), q = u.e(t, 1.5, 2.3);
      const p = h.junta(POUSO, ASAS, 0.6 * a + 0.4 * c, { Bip01_Pelvis_02: [-14 * a + 20 * c, 0, 85 * c], Bip01_Neck_05: [-20 * a + 30 * q, 0, 20 * q], Bip01_Neck1_06: [20 * q, 0, 0], Bip01_Head_08: [-10 * a, 0, 20 * q], BN_Jaw_09: [30 * a + 15 * q, 0, 0],
        Bip01_L_Thigh_022: [-30 * c, 0, 0], Bip01_R_Thigh_034: [-10 * c, 0, 0] });
      p.$pos.Bip01_Pelvis_02[1] *= (1 - 0.75 * c); return p; }` },
  ],
};
