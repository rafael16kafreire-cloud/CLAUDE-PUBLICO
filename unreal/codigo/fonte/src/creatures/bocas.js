// =============================================================
// BOCAS: alguns modelos importados vêm de boca aberta (posados rugindo) e
// sem osso de mandíbula. Aqui ficam os números para o jogo criar o osso
// 'jaw', fechar a boca na pose parada e abrir só ao comer, rugir ou atacar.
// Gerado por: python tools/models/bocas.py <espécie> ...
//   dir    = lado do focinho no eixo z do modelo (-1 = olha para -z)
//   zr     = z da nuca;  hz, hy = dobradiça da mandíbula (z, y)
//   A, B   = reta y = A + B * (distância da nuca) que separa a mandíbula
//            de baixo (vai para o osso) da de cima
//   fecha  = quanto girar a mandíbula de baixo para fechar (radianos)
// =============================================================
export const BOCAS = {
  deinosuchus: { dir: -1, hz: -3.542, hy: 1.138, A: 1.179, B: -0.168, zr: -3.294, fecha: 0.38 }, // ~17° de abertura
  trex: { dir: -1, hz: -3.733, hy: 4.310, A: 4.390, B: -0.273, zr: -3.439, fecha: 0.2 }, // ~6°
  espinossauro: { dir: -1, hz: -4.975, hy: 3.907, A: 4.017, B: -0.338, zr: -4.650, fecha: 0.55 }, // ~22°
  quetzalcoatlus: { dir: -1, hz: -3.153, hy: 0.088, A: 0.217, B: -0.495, zr: -2.894, fecha: 0.9 }, // ~29°
  anquilossauro: { dir: -1, hz: -2.251, hy: 1.237, A: 1.270, B: -0.508, zr: -2.187, fecha: 0.55 },
  estegossauro: { dir: -1, hz: -2.667, hy: 1.106, A: 1.148, B: -0.717, zr: -2.608, fecha: 0.23 },
  argentavis: { dir: -1, hz: -1.207, hy: 0.039, A: 0.056, B: -0.186, zr: -1.118, fecha: 0.2 },
  reidodo: { dir: -1, hz: -3.231, hy: 3.856, A: 3.967, B: -0.475, zr: -2.997, fecha: 0.5 },
  braquiossauro: { dir: -1, hz: -7.675, hy: 16.696, A: 16.690, B: 0.031, zr: -7.459, fecha: 0.15 },
};
