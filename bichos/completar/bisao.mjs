// Bisão-gigante (Bison latifrons) a partir do bisão animado do Anees Animates (CC BY): o original só anda.
// Eixos do mundo: X = esquerda do bicho (+X abaixa a cabeça / perna vai para trás), Y = cima, Z = frente (+Z tomba p/ direita)
const P = ['Bone010l_06', 'Bone010r_014'], T = ['Bone014l_010', 'Bone014r_018'];
export default {
  modelo: '../modelos/bisao.glb', saida: process.env.SAIDA || '../modelos/bisao.glb', vars: { P, T },
  clipes: [
    { nome: 'parado', base: 'andar', baseT: 0, dur: 4, f: (t, d, u) => ({
      [P[0]]: [-6, 0, 0], [P[1]]: [10, 0, 0], [T[0]]: [6, 0, 0], [T[1]]: [-8, 0, 0],
      Bone011l_07: [4, 0, 0], Bone011r_015: [-8, 0, 0],
      Bone002_02: [u.sin(t, 4) * 1, 0, 0], Bone004_04: [3 * u.sin(t, 4, 0.2), 6 * u.sin(t, 8), 0], Bone006_024: [0, 12 * u.sin(t, 1.3), 0] }) },
    { nome: 'correr', base: 'andar', baseVel: 2, dur: 4.17 / 2, f: (t, d, u) => ({ Bone004_04: [8, 0, 0], Bone_00: [3 * u.sin(t, 4.17 / 4), 0, 0] }) },
    { nome: 'atacar', base: 'andar', baseT: 0, dur: 1.5, f: (t, d, u) => {
      const a = u.ida(t, 0, 0.4, 0.4, 0.6), b = u.ida(t, 0.45, 0.65, 0.8, 1.4), up = u.ida(t, 0.7, 0.85, 0.95, 1.3);
      return { $pos: { Bone_00: [0, -0.1 * a, -0.3 * a + 0.7 * b] }, Bone_00: [-4 * a + 4 * b, 0, 0],
        Bone003_03: [10 * a + 10 * b, 0, 0], Bone004_04: [20 * a + 18 * b - 40 * up, 0, 0], Bone005_05: [10 * b - 15 * up, 0, 0] }; } },
    { nome: 'rugir', base: 'andar', baseT: 0, dur: 2.6, f: (t, d, u) => {
      const k = u.ida(t, 0, 0.5, 2.0, 2.6), tr = u.sin(t, 0.2) * u.ida(t, 0.5, 0.8, 1.7, 2.1);
      return { Bone003_03: [-8 * k, 0, 0], Bone004_04: [-20 * k, 4 * tr, 0], Bone005_05: [-18 * k + 2 * tr, 0, 0], Bone006_024: [-25 * k, 0, 0] }; } },
    { nome: 'comer', base: 'andar', baseT: 0, dur: 3, f: (t, d, u) => {
      const k = u.e(t, 0, 0.5) * (1 - u.e(t, 2.5, 3)), m = u.sin(t, 0.6) * k;
      return { Bone003_03: [12 * k, 0, 0], Bone004_04: [32 * k + 3 * m, 4 * u.sin(t, 1.5) * k, 0], Bone005_05: [22 * k, 0, 0], [P[0]]: [-10 * k, 0, 0] }; } },
    { nome: 'dormir', base: 'andar', baseT: 0, dur: 5, f: (t, d, u) => {
      const b = u.sin(t, 5);
      return { $pos: { Bone_00: [0, -1.05, 0], Bone006_024: [0, -1.05, 0] },
        [P[0]]: [40, 0, 0], [P[1]]: [40, 0, 0], Bone011l_07: [-110, 0, 0], Bone011r_015: [-110, 0, 0],
        [T[0]]: [-50, 0, -10], [T[1]]: [-50, 0, 10], Bone015l_011: [100, 0, 0], Bone015r_019: [100, 0, 0],
        Bone002_02: [b, 0, 0], Bone004_04: [18, 20, 0], Bone005_05: [12 + b, 10, 0], Bone006_024: [-30, 0, 0] }; } },
    { nome: 'morrer', base: 'andar', baseT: 0, dur: 2.8, f: (t, d, u) => {
      const a = u.ida(t, 0, 0.4, 0.5, 0.9), c = u.e(t, 0.6, 1.6), q = u.e(t, 1.4, 2.1);
      return { $pos: { Bone_00: [-0.3 * c, -1.0 * c, 0], Bone006_024: [-0.3 * c, -1.0 * c, 0] }, Bone_00: [0, 0, 82 * c], Bone006_024: [0, 0, 82 * c],
        Bone004_04: [-20 * a + 20 * q, 0, 15 * q], Bone005_05: [-10 * a + 10 * q, 0, 0],
        [P[0]]: [-20 * c, 0, 0], [T[0]]: [20 * c, 0, 0], [P[1]]: [10 * c, 0, 0], [T[1]]: [-10 * c, 0, 0] }; } },
  ],
};
