// T-Rex: comer, dormir, morrer (feitas por cima da pose 'parado' do modelo da LasquetiSpice)
// Eixos do mundo: X = esquerda do bicho (+X abaixa o focinho), Y = cima (+Y vira p/ esquerda), Z = frente (+Z tomba p/ direita)
const BOCA = Object.fromEntries(['bn_Jaw11_11', 'bn_Tongue112_12', 'bn_Tongue213_13', 'bn_Tongue314_14', 'bn_LeftOuterLip23_23', 'bn_LeftInnerLip24_24',
  'bn_RightOuterLip25_25', 'bn_RightInnerLip26_26'].map(n => [n, ['parado', 0]]));
const L = 'bn_LeftUpLeg45_45', R = 'bn_RightUpLeg56_56';
export default {
  modelo: '../modelos/trex.glb', saida: process.env.SAIDA || '../modelos/trex.glb', vars: { L, R },
  clipes: [
    // a corrida original abre a boca o tempo todo: andar e correr ficam com a boca (e língua/lábios) do 'parado'
    { nome: 'correr', base: 'correr', dur: 9.27, fixo: BOCA, f: (t, d, u) => ({}) },
    { nome: 'andar', base: 'correr', baseVel: 0.5, dur: 18.53, fixo: BOCA, f: (t, d, u) => ({}) },
    { nome: 'comer', base: 'parado', dur: 4, f: (t, d, u) => {
      const k = u.e(t, 0, 0.6) * (1 - u.e(t, 3.4, 4)), m = Math.max(0, u.sin(t, 1)) * k, puxa = Math.max(0, u.sin(t, 1, 0.5)) * k;
      return {
        bn_Spine4_4: [24 * k, 0, 0], [L]: [-24 * k, 0, 0], [R]: [-24 * k, 0, 0], bn_Tail0167_67: [-14 * k, 0, 0],
        bn_Neck7_7: [14 * k, 0, 0], bn_Neck18_8: [14 * k, 0, 0], bn_Neck29_9: [12 * k - 8 * puxa, 6 * puxa, 0],
        bn_Head10_10: [8 * k, 0, 4 * puxa], bn_Jaw11_11: [18 * m, 0, 0],
      }; } },
    { nome: 'dormir', base: 'parado', baseT: 0, dur: 6, f: (t, d, u) => {
      const b = u.sin(t, 3);
      return {
        $pos: { bn_Spine4_4: [0, -1.95, 0] },
        bn_Spine4_4: [4, 0, 0], bn_Spine15_5: [b, 0, 0],
        [L]: [-75, 0, -8], bn_LeftLeg46_46: [100, 0, 0], bn_LeftFoot47_47: [-20, 0, 0],
        [R]: [-75, 0, 8], bn_RightLeg57_57: [100, 0, 0], bn_RightFoot58_58: [-20, 0, 0],
        bn_Neck7_7: [8, -6, 0], bn_Neck18_8: [8, -10, 0], bn_Neck29_9: [6, -10, 0], bn_Head10_10: [4 + b, -6, 8],
        bn_Jaw11_11: [-2, 0, 0], bn_LeftUpperEyeLid15_15: [25, 0, 0], bn_RightUpperEyeLid19_19: [25, 0, 0],
        bn_Tail0167_67: [-4, 0, 0], bn_Tail0268_68: [-8, 10, 0], bn_Tail0369_69: [-6, 14, 0], bn_Tail0470_70: [0, 14, 0], bn_Tail0571_71: [4, 12, 0],
      }; } },
    { nome: 'morrer', base: 'parado', baseT: 0, dur: 3.2, f: (t, d, u) => {
      const a = u.ida(t, 0, 0.45, 0.6, 1.1), c = u.e(t, 0.7, 1.9), q = u.e(t, 1.7, 2.3);
      return {
        $pos: { bn_Spine4_4: [-0.4 * c, -2.1 * c, 0] },
        bn_Spine4_4: [-12 * a + 6 * c, 0, 84 * c],
        [L]: [-30 * c, 0, -10 * c], bn_LeftLeg46_46: [20 * c, 0, 0], [R]: [-10 * c, 0, 20 * c], bn_RightLeg57_57: [30 * c, 0, 0],
        bn_Neck7_7: [-14 * a + 4 * c, 0, 6 * c], bn_Neck18_8: [-10 * a, 0, 6 * c], bn_Neck29_9: [-8 * a + 6 * q, 0, 10 * q], bn_Head10_10: [-12 * a, 0, 8 * q],
        bn_Jaw11_11: [26 * a + 14 * q, 0, 0],
        bn_Tail0167_67: [8 * a - 6 * c, 0, -10 * q], bn_Tail0268_68: [-4 * c, 0, -8 * q], bn_Tail0369_69: [0, 0, -8 * q],
      }; } },
  ],
};
