// Pteranodonte (modelo do oscar.lopez.riviello): correr, atacar, rugir, comer, dormir, morrer
// Eixos do mundo: X = esquerda do bicho (+X abaixa o focinho), Y = cima, Z = frente (+Z tomba para a direita)
export default {
  modelo: '../modelos/pteranodonte.glb', saida: process.env.SAIDA || '../modelos/pteranodonte.glb',
  clipes: [
    // o voo original sobe ~4 m dentro da animação: nivela o corpo perto da altura de pé (o jogo controla a altitude)
    { nome: 'voar', base: 'voar', dur: 10.7, nivelar: ['center5_5', 3.2], f: (t, d, u) => ({}) },
    { nome: 'planar', base: 'voar', baseVel: 0.35, dur: 10.7 / 0.35, nivelar: ['center5_5', 3.2], f: (t, d, u) => ({}) },
    { nome: 'correr', base: 'andar', baseVel: 1.8, dur: 6.27 / 1.8, f: (t, d, u) => ({ chest9_9: [6, 0, 0] }) },
    { nome: 'atacar', base: 'parado', baseT: 0, dur: 1.3, f: (t, d, u) => {
      const arma = u.ida(t, 0, 0.35, 0.35, 0.5), bote = u.ida(t, 0.35, 0.5, 0.75, 1.25), boca = u.ida(t, 0.25, 0.42, 0.6, 0.8);
      const n = -18 * arma + 22 * bote;
      return { chest9_9: [-6 * arma + 8 * bote, 0, 0], neck_0110_10: [n, 0, 0], neck_0211_11: [n * 0.6, 0, 0], neck_0312_12: [n * 0.4, 0, 0],
        head15_15: [8 * bote, 0, 0], jaw16_16: [28 * boca, 0, 0],
        LupperArm32_32: [0, 0, 14 * arma], RupperArm62_62: [0, 0, -14 * arma] }; } },
    { nome: 'rugir', base: 'parado', baseT: 0, dur: 2.6, f: (t, d, u) => {
      const k = u.ida(t, 0, 0.5, 2.0, 2.6), b = u.ida(t, 0.45, 0.7, 1.8, 2.2), tr = u.sin(t, 0.18) * b;
      return { chest9_9: [-8 * k, 0, 0], neck_0110_10: [-22 * k, 0, 0], neck_0211_11: [-10 * k, 0, 0], neck_0312_12: [-6 * k, 0, 0],
        head15_15: [-10 * k + 2 * tr, 3 * tr, 0], jaw16_16: [34 * b, 0, 0],
        LupperArm32_32: [0, 0, 22 * k], RupperArm62_62: [0, 0, -22 * k], LforeArm33_33: [0, 0, 10 * k], RforeArm63_63: [0, 0, -10 * k] }; } },
    { nome: 'comer', base: 'parado', baseT: 0, dur: 3, f: (t, d, u) => {
      const k = u.e(t, 0, 0.5) * (1 - u.e(t, 2.5, 3)), p = Math.max(0, u.sin(t, 1)) * k, m = Math.max(0, u.sin(t, 1, 0.75)) * k;
      return { chest9_9: [10 * k, 0, 0], neck_0110_10: [30 * k + 8 * p, 0, 0], neck_0211_11: [18 * k, 0, 0], neck_0312_12: [10 * k, 0, 0],
        neck_0413_13: [6 * k, 0, 0], head15_15: [8 * k - 6 * m, 0, 0], jaw16_16: [22 * m, 0, 0] }; } },
    { nome: 'dormir', base: 'parado', baseT: 0, dur: 5, f: (t, d, u) => {
      const b = u.sin(t, 5);
      return { $pos: { center5_5: [0, -0.28, 0] }, Lthigh92_92: [-28, 0, 0], Rthigh110_110: [-28, 0, 0], Lknee93_93: [30, 0, 0], Rknee111_111: [30, 0, 0],
        spine27_7: [b, 0, 0], chest9_9: [6, 0, 0], neck_0110_10: [40, 12, 0], neck_0211_11: [24, 14, 0], neck_0312_12: [16, 10, 0], neck_0413_13: [8, 6, 0],
        head15_15: [4 + b, 0, -10], L_upperEyelid25_25: [40, 0, 0], R_upperEyelid27_27: [40, 0, 0] }; } },
    { nome: 'morrer', base: 'parado', baseT: 0, dur: 2.8, f: (t, d, u) => {
      const a = u.ida(t, 0, 0.35, 0.45, 0.9), c = u.e(t, 0.5, 1.5), q = u.e(t, 1.3, 1.9);
      return { $pos: { center5_5: [0, -0.75 * c, 0] }, center5_5: [0, 0, 80 * c],
        neck_0110_10: [-20 * a + 20 * q, 0, 15 * q], neck_0211_11: [10 * q, 0, 12 * q], neck_0312_12: [6 * q, 0, 10 * q], head15_15: [-10 * a, 0, 8 * q],
        jaw16_16: [30 * a + 14 * q, 0, 0], LupperArm32_32: [0, 0, 25 * a - 45 * c], LforeArm33_33: [0, 0, -20 * c], RupperArm62_62: [0, 0, -25 * a],
        Lthigh92_92: [-20 * c, 0, 0], Rthigh110_110: [10 * c, 0, 0], L_upperEyelid25_25: [30 * q, 0, 0], R_upperEyelid27_27: [30 * q, 0, 0] }; } },
  ],
};
