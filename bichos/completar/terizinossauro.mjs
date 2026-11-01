// Terizinossauro: ataque com as garras (golpe cruzado com os dois braços) no lugar da mordida
// Rode depois de: node animar.mjs config/terizinossauro.json
// Eixos do mundo: X = esquerda do bicho (+X abaixa / braço vai para trás), Y = cima, Z = frente
export default {
  modelo: '../modelos/terizinossauro.glb', saida: process.env.SAIDA || '../modelos/terizinossauro.glb',
  clipes: [
    { nome: 'atacar', base: 'parado', baseT: 0, dur: 1.6, f: (t, d, u) => {
      const r = u.ida(t, 0, 0.35, 0.4, 0.55), g = u.ida(t, 0.4, 0.55, 0.75, 1.3), g2 = u.ida(t, 0.6, 0.75, 0.9, 1.4);
      return {
        coluna_3: [-8 * r + 10 * g, 10 * r - 14 * g, 0], pescoco_1: [-6 * r + 4 * g, 0, 0], cabeca: [-6 * r, 0, 0],
        ombro_D: [-110 * r + 60 * g, 0, -30 * r + 20 * g], antebraco_D: [-40 * r + 50 * g, 0, 0],
        ombro_E: [-60 * r - 40 * g + 80 * g2, 0, 20 * r], antebraco_E: [-30 * r + 40 * g2, 0, 0],
        $pos: { quadril: [0, -0.1 * g, 0.4 * g] },
      }; } },
  ],
};
