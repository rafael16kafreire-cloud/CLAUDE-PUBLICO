// Megatério (Anees Animates, CC BY): o original só tem 'parado' (em pé respirando).
// Aqui: andar, correr, atacar (patada com as garras), rugir, comer (puxa galho do alto), dormir (sentado), morrer
// Eixos do mundo: X = esquerda do bicho (+X inclina para a frente / perna vai para trás), Y = cima, Z = frente (+Z tomba p/ direita)
const vars = { MAND: +(process.env.MAND ?? 1) };
export default {
  modelo: '../modelos/megaterio.glb', saida: process.env.SAIDA || '../modelos/megaterio.glb', vars,
  clipes: [
    { nome: 'andar', base: 'parado', baseT: 0, dur: 1.8, f: (t, d, u) => {
      const s = u.sin(t, 1.8), c = u.sin(t, 1.8, 0.25);
      return { $pos: { Bone_01: [0, -0.06 * Math.abs(c), 0] }, Bone_01: [4, 5 * s, 4 * s], Bone002_03: [0, -6 * s, -3 * s],
        Bonel011_032: [-20 * s, 0, 0], Boner011_042: [20 * s, 0, 0], Bonel012_033: [22 * Math.max(0, c), 0, 0], Boner012_043: [22 * Math.max(0, -c), 0, 0],
        Bonel_08: [14 * s, 0, 0], Boner_019: [-14 * s, 0, 0], Bone008_052: [0, -8 * s, 0], Bone005_05: [0, 5 * s, 0] }; } },
    { nome: 'correr', base: 'parado', baseT: 0, dur: 1.0, f: (t, d, u) => {
      const s = u.sin(t, 1), c = u.sin(t, 1, 0.25);
      return { $pos: { Bone_01: [0, -0.12 * Math.abs(c), 0] }, Bone_01: [14, 7 * s, 5 * s], Bone002_03: [6, -8 * s, -4 * s], Bone005_05: [-12, 6 * s, 0],
        Bonel011_032: [-32 * s, 0, 0], Boner011_042: [32 * s, 0, 0], Bonel012_033: [36 * Math.max(0, c), 0, 0], Boner012_043: [36 * Math.max(0, -c), 0, 0],
        Bonel_08: [26 * s - 20, 0, 0], Boner_019: [-26 * s - 20, 0, 0], Bonel001_09: [-30, 0, 0], Boner001_020: [-30, 0, 0], Bone008_052: [0, -10 * s, 0] }; } },
    { nome: 'atacar', base: 'parado', baseT: 0, dur: 1.5, f: (t, d, u) => {
      const a = u.ida(t, 0, 0.45, 0.45, 0.65), b = u.ida(t, 0.45, 0.7, 0.9, 1.5);
      return { Bone_01: [6 * b, -18 * a + 22 * b, 0], Bone002_03: [10 * b, -10 * a + 14 * b, 0],
        Boner_019: [-105 * a - 20 * b, 0, -12 * a], Boner001_020: [-40 * a + 20 * b, 0, 0], Boner002_021: [30 * a, 0, 0],
        Bonel_08: [-30 * a + 10 * b, 0, 10 * a], Bone005_05: [-10 * a + 8 * b, 0, 0], Bone007_07: [20 * u.ida(t, 0.3, 0.5, 0.8, 1.1) * MAND, 0, 0] }; } },
    { nome: 'rugir', base: 'parado', baseT: 0, dur: 2.8, f: (t, d, u) => {
      const k = u.ida(t, 0, 0.6, 2.2, 2.8), m = u.ida(t, 0.5, 0.8, 1.9, 2.3), tr = u.sin(t, 0.16) * m;
      return { Bone_01: [-6 * k, 0, 0], Bone002_03: [-8 * k, 0, 0], Bone004_04: [-12 * k, 0, 0], Bone005_05: [-14 * k + 2 * tr, 3 * tr, 0],
        Bonel_08: [-75 * k, 0, 0], Boner_019: [-75 * k, 0, 0], Bonel001_09: [-30 * k, 0, 0], Boner001_020: [-30 * k, 0, 0],
        Bone007_07: [30 * m * MAND, 0, 0] }; } },
    { nome: 'comer', base: 'parado', dur: 3.25, f: (t, d, u) => {
      // estica os braços para o alto, puxa um galho e mastiga
      const k = u.e(t, 0, 0.6) * (1 - u.e(t, 2.65, 3.25)), p = (0.5 + 0.5 * u.sin(t, 1.3)) * k, m = Math.max(0, u.sin(t, 0.65)) * k;
      return { Bone_01: [-4 * k, 0, 0], Bone004_04: [-16 * k + 8 * p, 0, 0], Bone005_05: [-14 * k + 6 * p, 0, 0],
        Bonel_08: [-150 * k + 40 * p, 0, -10 * k], Boner_019: [-140 * k + 40 * p, 0, 10 * k], Bonel001_09: [-10 * k + 30 * p, 0, 0], Boner001_020: [-10 * k + 30 * p, 0, 0],
        Bone007_07: [14 * m * MAND, 0, 0] }; } },
    { nome: 'dormir', base: 'parado', baseT: 0, dur: 5, f: (t, d, u) => {
      const b = u.sin(t, 5);
      return { $pos: { Bone_01: [0, -0.85, -0.2], Bone008_052: [0, -0.85, -0.2] }, Bone_01: [-8, 0, 0],
        Bonel011_032: [-70, 0, -10], Boner011_042: [-70, 0, 10], Bonel012_033: [75, 0, 0], Boner012_043: [75, 0, 0], Bonel013_034: [-10, 0, 0], Boner013_044: [-10, 0, 0],
        Bone001_02: [14 + b, 0, 0], Bone002_03: [16, 0, 0], Bone004_04: [12, 0, 0], Bone005_05: [18 + b, 0, 0],
        Bonel_08: [-10, 0, -10], Boner_019: [-10, 0, 10], Bonel001_09: [-30, 0, 0], Boner001_020: [-30, 0, 0], Bone008_052: [-20, 0, 0] }; } },
    { nome: 'morrer', base: 'parado', baseT: 0, dur: 3.2, f: (t, d, u) => {
      const a = u.ida(t, 0, 0.5, 0.6, 1.1), c = u.e(t, 0.7, 2.0), q = u.e(t, 1.8, 2.5);
      return { $pos: { Bone_01: [-0.6 * c, -0.95 * c, 0], Bone008_052: [-0.6 * c, -0.95 * c, 0] },
        Bone_01: [-10 * a + 20 * c, 0, 72 * c], Bonel011_032: [-40 * c, 0, -50 * c], Boner011_042: [-20 * c, 0, -40 * c], Bonel012_033: [40 * c, 0, 0],
        Bone005_05: [-20 * a, 0, 20 * q], Bone004_04: [0, 0, 10 * q], Bonel_08: [-60 * a, 0, 30 * a - 40 * c], Boner_019: [-60 * a, 0, -30 * a],
        Bone008_052: [0, 0, 40 * c], Bone007_07: [(25 * a + 15 * q) * MAND, 0, 0] }; } },
  ],
};
