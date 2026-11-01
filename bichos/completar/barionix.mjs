// Barionix: corrige o 'dormir' do esqueleto automático (a cabeça afundava no chão)
// Rode depois de: node animar.mjs config/barionix.json
export default {
  modelo: '../modelos/barionix.glb', saida: process.env.SAIDA || '../modelos/barionix.glb',
  clipes: [
    { nome: 'dormir', base: 'dormir', dur: 4, f: (t, d, u) => ({ pescoco_2: [-12, 0, 0], pescoco_3: [-18, 0, 0], cabeca: [-22, 0, 0] }) },
  ],
};
