// Mosassauro (e o chefe do mar, que é variante dele): andar, correr, rugir, comer, dormir
// No jogo ele vive na água: 'andar' e 'correr' são nado lento e rápido.
// (o esqueleto automático deste modelo não separa a mandíbula: a 'boca' vira movimento de cabeça)
// Eixos do mundo: X = esquerda do bicho (+X abaixa o focinho / abre a boca), Y = cima (+Y vira p/ esquerda), Z = frente
// Depois: node variante.mjs config/chefe_mar.json
export default {
  modelo: '../modelos/mosassauro.glb', saida: process.env.SAIDA || '../modelos/mosassauro.glb',
  clipes: [
    { nome: 'andar', base: 'nadar', baseVel: 0.6, dur: 2 / 0.6, f: (t, d, u) => ({}) },
    { nome: 'correr', base: 'nadar_rapido', dur: 1, f: (t, d, u) => ({}) },
    { nome: 'rugir', base: 'nadar', baseVel: 0.5, dur: 4, f: (t, d, u) => {
      const k = u.ida(t, 0, 0.8, 3.0, 4), m = u.ida(t, 0.7, 1.1, 2.6, 3.1), tr = u.sin(t, 0.15) * m;
      return { quadril: [-14 * k, 0, 0], coluna_3: [-6 * k, 0, 0], pescoco_1: [-8 * k, 0, 0], pescoco_2: [-6 * k, 0, 0],
        cabeca: [-14 * k - 8 * m + 2 * tr, 5 * tr, 0], cauda_1: [8 * k, 0, 0], $pos: { quadril: [0, 0.6 * k, 0] } }; } },
    { nome: 'comer', base: 'nadar', baseVel: 0.5, dur: 4, f: (t, d, u) => {
      // morde e sacode a presa de um lado para o outro
      const k = u.e(t, 0, 0.4) * (1 - u.e(t, 3.6, 4)), sac = u.sin(t, 0.5) * k, m = (0.5 + 0.5 * u.sin(t, 1, 0.25)) * k;
      return { pescoco_1: [6 * k, 14 * sac, 0], pescoco_2: [4 * k, 12 * sac, 4 * sac], cabeca: [4 * k - 6 * m, 10 * sac, 6 * sac],
        coluna_3: [0, -6 * sac, 0], cauda_2: [0, 8 * sac, 0] }; } },
    { nome: 'dormir', base: 'parado', baseT: 0, dur: 6, f: (t, d, u) => {
      // boiando parado, quase sem mexer, a cauda balança devagar
      const b = u.sin(t, 6), w = u.sin(t, 6, 0.25);
      return { $pos: { quadril: [0, 0.15 * b, 0] }, quadril: [2 * b, 0, 0], pescoco_2: [5, 0, 0], cabeca: [6, 0, 0],
        cauda_3: [0, 4 * w, 0], cauda_5: [0, 6 * w, 0], cauda_7: [0, 8 * w, 0] }; } },
  ],
};
