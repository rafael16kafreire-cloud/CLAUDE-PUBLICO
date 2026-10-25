// =============================================================
// FORMATO DE CADA ESPÉCIE (medidas em metros, tamanho adulto)
// spine: pontos da coluna, da ponta da cauda até o focinho:
//        [x, y, z, raio, achatamento, osso]
//        (o animal olha para -z; y = altura do chão)
// legs:  quadril, joelho, tornozelo, dedos e grossura de cada parte
//        phase = em que momento do passo a perna se move (0 ou 0.5)
// Troque as cores aqui para mudar a aparência.
// skin:    pele – 'escamas', 'pelo', 'penas' ou 'lisa'
// pattern: desenho do corpo – type: 'listras', 'manchas', 'rosetas',
//          'mosqueado', 'aneis', 'dorsal'; count (quantas listras) ou
//          freq (tamanho das manchas: maior = menores); strength; color
// teeth:   dentes ao longo da boca (n por lado, tamanho em metros)
// =============================================================

const EYE = '#120f0b';

// Olho: íris colorida, pupila escura e um pontinho de brilho.
function eyes(x, y, z, r, bone = 'head', iris = '#a57a2a') {
  const out = [];
  for (const s of [1, -1]) {
    out.push({ type: 'ellipsoid', bone, p: [s * x, y, z], r: [r, r, r], color: iris, seg: [8, 6] });
    out.push({ type: 'ellipsoid', bone, p: [s * (x + r * 0.35), y, z - r * 0.12], r: [r * 0.7, r * 0.78, r * 0.55], color: EYE, seg: [6, 5] });
    out.push({ type: 'ellipsoid', bone, p: [s * (x + r * 0.62), y + r * 0.38, z - r * 0.3], r: [r * 0.2, r * 0.2, r * 0.2], color: '#fbf6e8', seg: [4, 3] });
  }
  return out;
}

// Penas (tufos alongados) ao longo de um osso.
function feathers(bone, from, to, n, len, color, spread = 0.1) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = n > 1 ? i / (n - 1) : 0;
    const x = from[0] + (to[0] - from[0]) * t;
    const y = from[1] + (to[1] - from[1]) * t;
    const z = from[2] + (to[2] - from[2]) * t;
    for (const sd of [1, -1]) {
      out.push({ type: 'ellipsoid', bone, p: [sd * (x + spread), y - len * 0.25, z + len * 0.35], r: [len * 0.08, len * 0.28, len * 0.55], color, seg: [5, 4], skin: 'penas' });
    }
  }
  return out;
}

function pair(name, parent, hip, knee, ankle, toe, r, phase, color) {
  const m = (p) => [-p[0], p[1], p[2]];
  return [
    { name: `${name}E`, parent, hip, knee, ankle, toe, r, phase, color },
    { name: `${name}D`, parent, hip: m(hip), knee: m(knee), ankle: m(ankle), toe: m(toe), r, phase: (phase + 0.5) % 1, color },
  ];
}

export const MODELS = {
  // -------------------------------------------------- Dodô
  dodo: {
    body: 'biped',
    colors: { top: '#6e6a66', belly: '#bdb5a6', pattern: '#55524d' },
    skin: 'penas', pattern: { type: 'mosqueado', freq: 14, strength: 0.4 },
    spine: [
      [0, 0.62, 0.42, 0.04, 1, 'tail1'],
      [0, 0.56, 0.3, 0.17, 1, 'tail1'],
      [0, 0.5, 0.1, 0.27, 1, 'hips'],
      [0, 0.5, -0.12, 0.25, 1, 'chest'],
      [0, 0.68, -0.27, 0.1, 1, 'neck'],
      [0, 0.8, -0.33, 0.11, 1, 'head'],
      [0, 0.79, -0.43, 0.075, 1, 'head'],
      [0, 0.73, -0.55, 0.03, 1, 'head'],
    ],
    legs: pair('perna', 'hips', [0.1, 0.38, 0.06], [0.11, 0.22, 0.1], [0.11, 0.07, 0.04], [0.11, 0.0, -0.09], [0.06, 0.03, 0.025], 0, '#c6a24a'),
    extras: [
      ...eyes(0.07, 0.84, -0.37, 0.022),
      { type: 'ellipsoid', bone: 'head', p: [0, 0.76, -0.47], r: [0.06, 0.06, 0.1], color: '#c9a33b' },
      { type: 'ellipsoid', bone: 'chest', p: [0.22, 0.52, -0.02], r: [0.06, 0.12, 0.17], color: '#615e58' },
      { type: 'ellipsoid', bone: 'chest', p: [-0.22, 0.52, -0.02], r: [0.06, 0.12, 0.17], color: '#615e58' },
      { type: 'ellipsoid', bone: 'tail1', p: [0, 0.68, 0.4], r: [0.1, 0.08, 0.06], color: '#e6e0d2' },
    ],
  },

  // -------------------------------------------------- Parassauro
  parassauro: {
    body: 'quad',
    colors: { top: '#5d7838', belly: '#dccf9a', pattern: '#33461c' },
    skin: 'escamas', pattern: { type: 'listras', count: 11, strength: 0.65 },
    spine: [
      [0, 1.9, 4.3, 0.05, 1, 'tail3'],
      [0, 2.0, 3.1, 0.22, 1, 'tail2'],
      [0, 2.1, 1.8, 0.42, 1, 'tail1'],
      [0, 2.15, 0.6, 0.72, 1.1, 'hips'],
      [0, 2.05, -0.7, 0.72, 1.05, 'chest'],
      [0, 2.1, -1.55, 0.4, 1, 'chest'],
      [0, 2.75, -2.15, 0.24, 1, 'neck'],
      [0, 3.2, -2.5, 0.23, 1.1, 'head'],
      [0, 3.12, -2.95, 0.17, 0.9, 'head'],
      [0, 2.95, -3.35, 0.08, 0.8, 'head'],
    ],
    legs: [
      ...pair('trás', 'hips', [0.45, 1.95, 0.6], [0.5, 1.15, 0.25], [0.5, 0.35, 0.55], [0.5, 0.0, 0.25], [0.32, 0.18, 0.12], 0),
      ...pair('frente', 'chest', [0.42, 1.7, -1.05], [0.44, 1.0, -1.15], [0.44, 0.3, -1.05], [0.44, 0.0, -1.2], [0.15, 0.1, 0.07], 0.25),
    ],
    extras: [
      ...eyes(0.17, 3.3, -2.6, 0.045),
      { type: 'tube', bone: 'head', points: [[0, 3.35, -2.55], [0, 3.65, -2.05], [0, 3.85, -1.35]], radii: [0.11, 0.09, 0.05], color: '#c0602c', pele: { type: 'listras', freq: 22, color: '#5a2a14', strength: 0.5 } },
    ],
  },

  // -------------------------------------------------- Paquicefalossauro
  paquicefalossauro: {
    body: 'biped',
    colors: { top: '#7a5636', belly: '#d8c6a0', pattern: '#3f2a18' },
    skin: 'escamas', pattern: { type: 'manchas', freq: 9, strength: 0.6 },
    spine: [
      [0, 1.3, 2.3, 0.04, 1, 'tail3'],
      [0, 1.32, 1.6, 0.16, 1, 'tail2'],
      [0, 1.35, 0.9, 0.3, 1, 'tail1'],
      [0, 1.36, 0.2, 0.48, 1.05, 'hips'],
      [0, 1.4, -0.5, 0.45, 1.05, 'chest'],
      [0, 1.6, -1.0, 0.24, 1, 'neck'],
      [0, 1.76, -1.3, 0.23, 1, 'head'],
      [0, 1.68, -1.62, 0.12, 0.9, 'head'],
    ],
    legs: [
      ...pair('perna', 'hips', [0.3, 1.2, 0.2], [0.33, 0.7, -0.05], [0.33, 0.2, 0.2], [0.33, 0.0, -0.05], [0.2, 0.12, 0.08], 0),
      ...pair('braco', 'chest', [0.26, 1.3, -0.65], [0.29, 1.08, -0.75], [0.29, 0.94, -0.9], [0.29, 0.9, -1.0], [0.06, 0.05, 0.04], 0),
    ],
    extras: [
      ...eyes(0.15, 1.82, -1.42, 0.035),
      { type: 'ellipsoid', bone: 'head', p: [0, 1.98, -1.28], r: [0.27, 0.22, 0.3], color: '#d6c7a4' },
      { type: 'ellipsoid', bone: 'head', p: [0.2, 1.9, -1.08], r: [0.06, 0.05, 0.06], color: '#b39c76' },
      { type: 'ellipsoid', bone: 'head', p: [-0.2, 1.9, -1.08], r: [0.06, 0.05, 0.06], color: '#b39c76' },
    ],
  },

  // -------------------------------------------------- Braquiossauro
  braquiossauro: {
    body: 'quad',
    colors: { top: '#6c7872', belly: '#c6c4b2', pattern: '#46524e' },
    skin: 'escamas', pattern: { type: 'mosqueado', freq: 2.5, strength: 0.55 },
    ringsPerMeter: 2.5,
    spine: [
      [0, 4.6, 12.5, 0.15, 1, 'tail3'],
      [0, 5.6, 8.8, 0.6, 1, 'tail2'],
      [0, 6.6, 5.2, 1.2, 1, 'tail1'],
      [0, 7.1, 2.0, 1.95, 1.05, 'hips'],
      [0, 7.6, -1.5, 2.15, 1.1, 'chest'],
      [0, 8.8, -4.2, 1.2, 1, 'chest'],
      [0, 10.6, -5.9, 0.78, 1, 'neck'],
      [0, 12.5, -6.9, 0.58, 1, 'neck2'],
      [0, 13.7, -7.5, 0.52, 1.05, 'head'],
      [0, 13.6, -8.4, 0.34, 0.9, 'head'],
      [0, 13.35, -8.95, 0.16, 0.8, 'head'],
    ],
    legs: [
      ...pair('trás', 'hips', [1.3, 6.3, 2.0], [1.4, 3.5, 2.3], [1.4, 0.8, 2.0], [1.4, 0.0, 1.6], [0.95, 0.7, 0.6], 0),
      ...pair('frente', 'chest', [1.4, 7.3, -2.6], [1.5, 4.0, -2.8], [1.5, 0.9, -2.6], [1.5, 0.0, -2.9], [0.85, 0.65, 0.55], 0.25),
    ],
    extras: [
      ...eyes(0.4, 13.95, -7.9, 0.09),
      { type: 'ellipsoid', bone: 'head', p: [0, 14.15, -7.45], r: [0.38, 0.32, 0.4], color: '#6f7878' },
    ],
  },

  // -------------------------------------------------- Raptor
  raptor: {
    body: 'biped',
    colors: { top: '#8c5630', belly: '#e2d0a6', pattern: '#341f10' },
    skin: 'penas', pattern: { type: 'listras', count: 15, strength: 0.75 }, teeth: { n: 9, size: 0.035 },
    spine: [
      [0, 1.05, 2.05, 0.03, 1, 'tail3'],
      [0, 1.0, 1.35, 0.08, 1, 'tail2'],
      [0, 0.98, 0.62, 0.16, 1, 'tail1'],
      [0, 0.97, 0.05, 0.27, 1.05, 'hips'],
      [0, 1.0, -0.45, 0.26, 1.05, 'chest'],
      [0, 1.26, -0.8, 0.12, 1, 'neck'],
      [0, 1.45, -0.95, 0.14, 1, 'head'],
      [0, 1.42, -1.2, 0.1, 0.85, 'head'],
      [0, 1.36, -1.42, 0.04, 0.8, 'head'],
    ],
    legs: [
      ...pair('perna', 'hips', [0.17, 0.92, 0.05], [0.2, 0.55, -0.15], [0.2, 0.2, 0.12], [0.2, 0.0, -0.08], [0.12, 0.07, 0.05], 0),
      ...pair('braco', 'chest', [0.18, 0.92, -0.5], [0.22, 0.72, -0.55], [0.22, 0.62, -0.75], [0.22, 0.6, -0.86], [0.05, 0.04, 0.03], 0),
    ],
    extras: [
      ...eyes(0.09, 1.52, -1.02, 0.025, 'head', '#c89a2a'),
      ...feathers('bracoE', [0.2, 0.86, -0.5], [0.22, 0.7, -0.62], 3, 0.22, '#4a2a14', 0.03).filter((f) => f.p[0] > 0),
      ...feathers('bracoD', [0.2, 0.86, -0.5], [0.22, 0.7, -0.62], 3, 0.22, '#4a2a14', 0.03).filter((f) => f.p[0] < 0),
      { type: 'ellipsoid', bone: 'tail3', p: [0, 1.06, 1.95], r: [0.12, 0.03, 0.3], color: '#3a2212', skin: 'penas' },
      { type: 'ellipsoid', bone: 'head', p: [0, 1.62, -0.88], r: [0.03, 0.06, 0.16], color: '#7a2c18', skin: 'penas' },
      { type: 'cone', bone: 'pernaE_pe', base: [0.2, 0.06, 0.0], tip: [0.24, 0.16, -0.12], r: 0.025, color: '#2a2420' },
    ],
  },

  // -------------------------------------------------- T-Rex
  trex: {
    body: 'biped',
    colors: { top: '#4c4836', belly: '#b9aa86', pattern: '#2a271d' },
    skin: 'escamas', pattern: { type: 'mosqueado', freq: 4, strength: 0.65 }, teeth: { n: 11, size: 0.17 },
    ringsPerMeter: 4,
    bones: [{ name: 'jaw', parent: 'head', pos: [0, 3.85, -3.6] }],
    spine: [
      [0, 3.0, 7.0, 0.1, 1, 'tail3'],
      [0, 3.2, 4.8, 0.45, 1, 'tail2'],
      [0, 3.35, 2.6, 0.85, 1, 'tail1'],
      [0, 3.4, 0.5, 1.3, 1.1, 'hips'],
      [0, 3.5, -1.4, 1.25, 1.15, 'chest'],
      [0, 3.9, -2.7, 0.75, 1, 'neck'],
      [0, 4.25, -3.45, 0.75, 1.05, 'head'],
      [0, 4.15, -4.3, 0.6, 0.95, 'head'],
      [0, 3.98, -5.1, 0.4, 0.85, 'head'],
      [0, 3.85, -5.5, 0.15, 0.8, 'head'],
    ],
    legs: [
      ...pair('perna', 'hips', [0.75, 3.0, 0.5], [0.85, 1.75, -0.4], [0.85, 0.55, 0.6], [0.85, 0.0, 0.0], [0.62, 0.35, 0.22], 0),
      ...pair('braco', 'chest', [0.6, 3.1, -1.9], [0.66, 2.78, -2.05], [0.66, 2.62, -2.3], [0.66, 2.58, -2.45], [0.12, 0.09, 0.06], 0),
    ],
    extras: [
      ...eyes(0.42, 4.5, -3.9, 0.07),
      { type: 'ellipsoid', bone: 'jaw', p: [0, 3.68, -4.4], r: [0.48, 0.24, 0.95], color: '#8f8462' },
      { type: 'ellipsoid', bone: 'head', p: [0.4, 4.62, -3.75], r: [0.12, 0.06, 0.2], color: '#4a4930' },
      { type: 'ellipsoid', bone: 'head', p: [-0.4, 4.62, -3.75], r: [0.12, 0.06, 0.2], color: '#4a4930' },
    ],
  },

  // -------------------------------------------------- Titanoboa
  titanoboa: {
    body: 'snake',
    root: 'head',
    colors: { top: '#55602f', belly: '#c6b47c', pattern: '#1b2010' },
    skin: 'escamas', scalesPerMeter: 16, pattern: { type: 'manchas', freq: 6, strength: 0.9 },
    ringsPerMeter: 4,
    spine: [
      [0, 0.25, 6.6, 0.05, 1, 'b9'],
      [0, 0.32, 5.4, 0.22, 0.9, 'b8'],
      [0, 0.38, 4.1, 0.36, 0.9, 'b7'],
      [0, 0.42, 2.8, 0.44, 0.88, 'b6'],
      [0, 0.44, 1.5, 0.47, 0.88, 'b5'],
      [0, 0.44, 0.2, 0.48, 0.88, 'b4'],
      [0, 0.43, -1.1, 0.46, 0.88, 'b3'],
      [0, 0.41, -2.4, 0.42, 0.88, 'b2'],
      [0, 0.38, -3.7, 0.36, 0.9, 'b1'],
      [0, 0.36, -4.9, 0.29, 0.9, 'b0'],
      [0, 0.38, -5.7, 0.32, 0.8, 'head'],
      [0, 0.34, -6.3, 0.22, 0.7, 'head'],
      [0, 0.3, -6.65, 0.08, 0.6, 'head'],
    ],
    extras: [...eyes(0.24, 0.5, -5.95, 0.05)],
  },

  // -------------------------------------------------- Deinosuchus
  deinosuchus: {
    body: 'croc',
    colors: { top: '#3e4930', belly: '#b8ae82', pattern: '#1e2316' },
    skin: 'escamas', pattern: { type: 'aneis', count: 15, strength: 0.55 }, teeth: { n: 12, size: 0.07 },
    ringsPerMeter: 4,
    spine: [
      [0, 0.55, 5.1, 0.06, 0.8, 'tail3'],
      [0, 0.6, 3.5, 0.35, 0.8, 'tail2'],
      [0, 0.65, 1.8, 0.6, 0.7, 'tail1'],
      [0, 0.7, 0.3, 0.85, 0.6, 'hips'],
      [0, 0.72, -1.4, 0.85, 0.6, 'chest'],
      [0, 0.7, -2.6, 0.55, 0.62, 'neck'],
      [0, 0.68, -3.3, 0.5, 0.5, 'head'],
      [0, 0.6, -4.3, 0.3, 0.45, 'head'],
      [0, 0.55, -5.05, 0.14, 0.45, 'head'],
    ],
    legs: [
      ...pair('trás', 'hips', [0.72, 0.6, 0.4], [1.25, 0.45, 0.5], [1.3, 0.12, 0.3], [1.35, 0.0, 0.05], [0.28, 0.2, 0.14], 0),
      ...pair('frente', 'chest', [0.68, 0.6, -1.5], [1.15, 0.4, -1.6], [1.2, 0.1, -1.75], [1.25, 0.0, -1.95], [0.22, 0.16, 0.12], 0.25),
    ],
    extras: [
      ...eyes(0.28, 0.98, -3.35, 0.07),
      { type: 'ellipsoid', bone: 'hips', p: [0.3, 1.18, 0.2], r: [0.16, 0.1, 0.5], color: '#2e3424' },
      { type: 'ellipsoid', bone: 'hips', p: [-0.3, 1.18, 0.2], r: [0.16, 0.1, 0.5], color: '#2e3424' },
      { type: 'ellipsoid', bone: 'chest', p: [0.3, 1.2, -1.2], r: [0.16, 0.1, 0.5], color: '#2e3424' },
      { type: 'ellipsoid', bone: 'chest', p: [-0.3, 1.2, -1.2], r: [0.16, 0.1, 0.5], color: '#2e3424' },
      { type: 'ellipsoid', bone: 'tail1', p: [0, 1.05, 1.6], r: [0.12, 0.12, 0.6], color: '#2e3424' },
    ],
  },

  // -------------------------------------------------- Pterodáctilo
  pterodactilo: {
    body: 'flyer',
    colors: { top: '#9a6a3c', belly: '#f2e2c0', pattern: '#4a2e18' },
    skin: 'pelo', pattern: { type: 'dorsal', freq: 8, strength: 0.6 },
    wingPattern: { type: 'manchas', freq: 14, color: '#7a3e1c', strength: 0.6 },
    spine: [
      [0, 0, 0.45, 0.03, 1, 'tail1'],
      [0, 0, 0.2, 0.1, 1, 'hips'],
      [0, 0, -0.1, 0.13, 1, 'chest'],
      [0, 0.08, -0.36, 0.07, 1, 'neck'],
      [0, 0.15, -0.5, 0.08, 1, 'head'],
      [0, 0.13, -0.88, 0.025, 1, 'head'],
    ],
    wings: [
      { name: 'asaE', points: [[0.1, 0.02, -0.12], [0.8, 0.06, -0.18], [1.55, 0, 0.12], [0.75, 0, 0.3], [0.08, 0, 0.28]], armR: 0.035, color: '#d89a5c' },
      { name: 'asaD', points: [[-0.1, 0.02, -0.12], [-0.8, 0.06, -0.18], [-1.55, 0, 0.12], [-0.75, 0, 0.3], [-0.08, 0, 0.28]], armR: 0.035, color: '#d89a5c' },
    ],
    extras: [
      ...eyes(0.06, 0.2, -0.52, 0.018),
      { type: 'cone', bone: 'head', base: [0, 0.2, -0.45], tip: [0, 0.4, -0.12], r: 0.06, color: '#e0482a' },
    ],
  },

  // -------------------------------------------------- Quetzalcoatlus
  quetzalcoatlus: {
    body: 'flyer',
    colors: { top: '#d8cfbc', belly: '#fbf6ea', pattern: '#6e665a' },
    skin: 'pelo', pattern: { type: 'mosqueado', freq: 4, strength: 0.45 },
    wingPattern: { type: 'mosqueado', freq: 3, color: '#6a4426', strength: 0.55 },
    spine: [
      [0, 0, 1.0, 0.06, 1, 'tail1'],
      [0, 0, 0.5, 0.35, 1, 'hips'],
      [0, 0, -0.3, 0.42, 1, 'chest'],
      [0, 0.3, -1.2, 0.18, 1, 'neck'],
      [0, 0.52, -2.1, 0.16, 1, 'neck2'],
      [0, 0.62, -2.6, 0.22, 1, 'head'],
      [0, 0.5, -3.9, 0.05, 1, 'head'],
    ],
    wings: [
      { name: 'asaE', points: [[0.35, 0.05, -0.3], [2.8, 0.15, -0.45], [5.6, 0, 0.4], [2.6, 0, 0.95], [0.25, 0, 0.75]], armR: 0.12, color: '#c89a68' },
      { name: 'asaD', points: [[-0.35, 0.05, -0.3], [-2.8, 0.15, -0.45], [-5.6, 0, 0.4], [-2.6, 0, 0.95], [-0.25, 0, 0.75]], armR: 0.12, color: '#c89a68' },
    ],
    // pernas de trás (no voo ficam esticadas para trás; no chão, em pé)
    claws: false,
    legs: pair('perna', 'hips', [0.24, -0.12, 0.55], [0.3, -1.25, 0.82], [0.3, -2.35, 0.62], [0.3, -2.6, 0.35], [0.12, 0.08, 0.055], 0, '#b89a72'),
    extras: [
      ...eyes(0.16, 0.74, -2.75, 0.04),
      { type: 'tube', bone: 'head', points: [[0, 0.75, -2.55], [0, 1.05, -2.2], [0, 1.25, -1.7]], radii: [0.2, 0.15, 0.05], color: '#e85030' },
    ],
  },

  // -------------------------------------------------- Triceratops
  triceratops: {
    body: 'quad',
    colors: { top: '#6a6046', belly: '#c8b68a', pattern: '#38331f' },
    skin: 'escamas', pattern: { type: 'mosqueado', freq: 4, strength: 0.55 },
    ringsPerMeter: 4,
    spine: [
      [0, 1.6, 4.4, 0.08, 1, 'tail3'],
      [0, 1.9, 3.2, 0.35, 1, 'tail2'],
      [0, 2.1, 1.9, 0.65, 1, 'tail1'],
      [0, 2.2, 0.5, 1.15, 1.0, 'hips'],
      [0, 2.1, -1.0, 1.15, 1.0, 'chest'],
      [0, 1.9, -2.0, 0.75, 1, 'neck'],
      [0, 1.8, -2.6, 0.65, 1, 'head'],
      [0, 1.55, -3.4, 0.42, 0.9, 'head'],
      [0, 1.35, -3.9, 0.16, 0.9, 'head'],
    ],
    legs: [
      ...pair('trás', 'hips', [0.75, 1.95, 0.6], [0.85, 1.15, 0.8], [0.85, 0.35, 0.55], [0.85, 0.0, 0.35], [0.45, 0.3, 0.22], 0),
      ...pair('frente', 'chest', [0.8, 1.7, -1.4], [0.95, 0.95, -1.5], [0.95, 0.3, -1.4], [0.95, 0.0, -1.6], [0.32, 0.24, 0.2], 0.25),
    ],
    extras: [
      ...eyes(0.42, 2.0, -3.05, 0.06),
      { type: 'ellipsoid', bone: 'head', p: [0, 2.45, -2.25], r: [1.25, 1.05, 0.18], color: '#8a6038', pele: { type: 'manchas', freq: 14, color: '#d4a048', strength: 0.8, skin: 'escamas' } },
      { type: 'cone', bone: 'head', base: [0.35, 2.25, -2.75], tip: [0.42, 2.95, -3.65], r: 0.1, color: '#e2d6b8' },
      { type: 'cone', bone: 'head', base: [-0.35, 2.25, -2.75], tip: [-0.42, 2.95, -3.65], r: 0.1, color: '#e2d6b8' },
      { type: 'cone', bone: 'head', base: [0, 1.72, -3.45], tip: [0, 2.12, -3.8], r: 0.09, color: '#e2d6b8' },
      { type: 'cone', bone: 'head', base: [0, 1.38, -3.75], tip: [0, 1.15, -4.15], r: 0.14, color: '#2e2a22' },
    ],
  },

  // -------------------------------------------------- Estegossauro
  estegossauro: {
    body: 'quad',
    colors: { top: '#687048', belly: '#cdc39a', pattern: '#3c4426' },
    skin: 'escamas', pattern: { type: 'listras', count: 9, strength: 0.5 },
    ringsPerMeter: 4,
    spine: [
      [0, 2.2, 4.6, 0.1, 1, 'tail3'],
      [0, 2.6, 3.3, 0.35, 1, 'tail2'],
      [0, 2.9, 2.0, 0.65, 1, 'tail1'],
      [0, 3.0, 0.6, 1.05, 1.05, 'hips'],
      [0, 2.6, -0.9, 0.95, 1.0, 'chest'],
      [0, 1.9, -2.0, 0.45, 1, 'neck'],
      [0, 1.55, -2.6, 0.3, 1, 'head'],
      [0, 1.45, -3.0, 0.14, 0.9, 'head'],
    ],
    legs: [
      ...pair('trás', 'hips', [0.6, 2.6, 0.6], [0.7, 1.5, 0.8], [0.7, 0.4, 0.6], [0.7, 0.0, 0.35], [0.45, 0.3, 0.22], 0),
      ...pair('frente', 'chest', [0.55, 1.9, -1.1], [0.6, 1.1, -1.2], [0.6, 0.3, -1.15], [0.6, 0.0, -1.35], [0.28, 0.2, 0.16], 0.25),
    ],
    extras: [
      ...eyes(0.2, 1.68, -2.7, 0.04),
      ...[[3.1, 3.1, 0.05, 0.4, 0.35, 'tail2'], [3.75, 2.0, 0.06, 0.62, 0.5, 'tail1'], [4.15, 1.1, 0.06, 0.88, 0.7, 'hips'],
        [4.25, 0.2, 0.06, 0.95, 0.75, 'hips'], [3.75, -0.6, 0.06, 0.78, 0.6, 'chest'], [3.25, -1.3, 0.05, 0.56, 0.45, 'chest']]
        .map(([y, z, rx, ry, rz, bone], i) => ({ type: 'ellipsoid', bone, p: [i % 2 ? 0.12 : -0.12, y, z], r: [rx, ry, rz], color: '#a6542e', pele: { type: 'mosqueado', freq: 10, color: '#5e2a14', strength: 0.6, skin: 'escamas' } })),
      { type: 'cone', bone: 'tail3', base: [0.15, 2.3, 4.2], tip: [0.75, 2.65, 4.8], r: 0.07, color: '#d8ccb0' },
      { type: 'cone', bone: 'tail3', base: [-0.15, 2.3, 4.2], tip: [-0.75, 2.65, 4.8], r: 0.07, color: '#d8ccb0' },
      { type: 'cone', bone: 'tail3', base: [0.12, 2.15, 4.5], tip: [0.65, 2.45, 5.2], r: 0.06, color: '#d8ccb0' },
      { type: 'cone', bone: 'tail3', base: [-0.12, 2.15, 4.5], tip: [-0.65, 2.45, 5.2], r: 0.06, color: '#d8ccb0' },
    ],
  },

  // -------------------------------------------------- Anquilossauro
  anquilossauro: {
    body: 'quad',
    colors: { top: '#5c5640', belly: '#ab9e7a', pattern: '#353224' },
    skin: 'escamas', scalesPerMeter: 7, pattern: { type: 'mosqueado', freq: 6, strength: 0.6 },
    ringsPerMeter: 4,
    spine: [
      [0, 0.9, 3.6, 0.22, 1, 'tail3'],
      [0, 1.0, 2.6, 0.18, 1, 'tail2'],
      [0, 1.2, 1.6, 0.4, 0.8, 'tail1'],
      [0, 1.35, 0.4, 1.05, 0.62, 'hips'],
      [0, 1.3, -0.9, 1.0, 0.62, 'chest'],
      [0, 1.05, -1.8, 0.45, 0.8, 'neck'],
      [0, 1.0, -2.2, 0.42, 0.8, 'head'],
      [0, 0.9, -2.6, 0.25, 0.8, 'head'],
    ],
    legs: [
      ...pair('trás', 'hips', [0.75, 1.0, 0.5], [0.85, 0.55, 0.6], [0.85, 0.18, 0.5], [0.85, 0.0, 0.3], [0.35, 0.26, 0.2], 0),
      ...pair('frente', 'chest', [0.7, 0.95, -1.0], [0.8, 0.5, -1.05], [0.8, 0.15, -1.0], [0.8, 0.0, -1.2], [0.3, 0.22, 0.18], 0.25),
    ],
    extras: [
      ...eyes(0.3, 1.15, -2.3, 0.05),
      { type: 'ellipsoid', bone: 'tail3', p: [0, 0.9, 3.75], r: [0.48, 0.3, 0.42], color: '#8a7a5a' },
      ...[-0.55, 0, 0.55].flatMap((x) => [0.9, 0.2, -0.5, -1.2].map((z) => ({
        type: 'ellipsoid', bone: z > -0.2 ? 'hips' : 'chest', p: [x, 1.95 - Math.abs(x) * 0.35, z], r: [0.16, 0.12, 0.16], color: '#4a4834',
      }))),
      ...[0.6, -0.2, -1.0].flatMap((z) => [1, -1].map((s) => ({
        type: 'cone', bone: z > -0.2 ? 'hips' : 'chest', base: [s * 0.95, 1.3, z], tip: [s * 1.45, 1.2, z], r: 0.1, color: '#c8bc98',
      }))),
    ],
  },

  // -------------------------------------------------- Galimimo
  galimimo: {
    body: 'biped',
    colors: { top: '#8e7a54', belly: '#e6dabc', pattern: '#4a3a24' },
    skin: 'penas', pattern: { type: 'dorsal', freq: 14, strength: 0.65 },
    spine: [
      [0, 1.5, 1.8, 0.04, 1, 'tail3'],
      [0, 1.45, 1.2, 0.12, 1, 'tail2'],
      [0, 1.42, 0.6, 0.22, 1, 'tail1'],
      [0, 1.42, 0.0, 0.36, 1, 'hips'],
      [0, 1.5, -0.5, 0.32, 1, 'chest'],
      [0, 1.85, -0.85, 0.12, 1, 'neck'],
      [0, 2.25, -1.05, 0.1, 1, 'neck2'],
      [0, 2.42, -1.15, 0.11, 1, 'head'],
      [0, 2.38, -1.42, 0.04, 0.8, 'head'],
    ],
    legs: [
      ...pair('perna', 'hips', [0.18, 1.35, 0.0], [0.22, 0.85, -0.2], [0.22, 0.3, 0.15], [0.22, 0.0, -0.05], [0.15, 0.08, 0.05], 0),
      ...pair('braco', 'chest', [0.2, 1.4, -0.55], [0.24, 1.2, -0.62], [0.24, 1.08, -0.82], [0.24, 1.04, -0.9], [0.05, 0.04, 0.03], 0),
    ],
    extras: [...eyes(0.07, 2.47, -1.2, 0.022)],
  },

  // -------------------------------------------------- Capivara
  capivara: {
    body: 'quad',
    colors: { top: '#7c5a38', belly: '#a07c56', pattern: '#5a3e24' },
    skin: 'pelo', pattern: { type: 'mosqueado', freq: 12, strength: 0.3 },
    spine: [
      [0, 0.52, 0.64, 0.12, 1, 'hips'],
      [0, 0.55, 0.45, 0.33, 0.95, 'hips'],
      [0, 0.55, 0.0, 0.36, 0.95, 'chest'],
      [0, 0.58, -0.4, 0.28, 1, 'neck'],
      [0, 0.6, -0.6, 0.22, 1.1, 'head'],
      [0, 0.55, -0.84, 0.16, 1.0, 'head'],
    ],
    legs: [
      ...pair('trás', 'hips', [0.2, 0.4, 0.3], [0.22, 0.25, 0.38], [0.22, 0.08, 0.3], [0.22, 0.0, 0.22], [0.12, 0.07, 0.05], 0),
      ...pair('frente', 'chest', [0.18, 0.38, -0.25], [0.2, 0.22, -0.27], [0.2, 0.07, -0.25], [0.2, 0.0, -0.32], [0.09, 0.06, 0.05], 0.25),
    ],
    extras: [
      ...eyes(0.14, 0.72, -0.66, 0.025),
      { type: 'ellipsoid', bone: 'head', p: [0.12, 0.82, -0.52], r: [0.04, 0.05, 0.03], color: '#5a3e28' },
      { type: 'ellipsoid', bone: 'head', p: [-0.12, 0.82, -0.52], r: [0.04, 0.05, 0.03], color: '#5a3e28' },
    ],
  },

  // -------------------------------------------------- Espinossauro
  espinossauro: {
    body: 'biped',
    colors: { top: '#485860', belly: '#c4bc96', pattern: '#253238' },
    skin: 'escamas', pattern: { type: 'listras', count: 13, strength: 0.5 }, teeth: { n: 14, size: 0.08 },
    ringsPerMeter: 3.5,
    bones: [{ name: 'jaw', parent: 'head', pos: [0, 4.45, -3.7] }],
    spine: [
      [0, 3.2, 7.5, 0.12, 1, 'tail3'],
      [0, 3.5, 5.0, 0.5, 1.3, 'tail2'],
      [0, 3.7, 2.6, 0.9, 1.1, 'tail1'],
      [0, 3.8, 0.4, 1.2, 1.1, 'hips'],
      [0, 3.8, -1.6, 1.1, 1.1, 'chest'],
      [0, 4.3, -2.9, 0.55, 1, 'neck'],
      [0, 4.6, -3.6, 0.5, 0.9, 'head'],
      [0, 4.35, -4.8, 0.3, 0.7, 'head'],
      [0, 4.15, -5.8, 0.14, 0.7, 'head'],
    ],
    legs: [
      ...pair('perna', 'hips', [0.7, 3.4, 0.4], [0.8, 2.0, -0.4], [0.8, 0.6, 0.5], [0.8, 0.0, -0.1], [0.55, 0.32, 0.2], 0),
      ...pair('braco', 'chest', [0.6, 3.4, -1.8], [0.75, 2.8, -2.1], [0.75, 2.4, -2.5], [0.75, 2.3, -2.75], [0.18, 0.13, 0.1], 0),
    ],
    extras: [
      ...eyes(0.32, 4.82, -3.85, 0.06),
      { type: 'ellipsoid', bone: 'hips', p: [0, 5.7, 0.4], r: [0.08, 1.9, 1.6], color: '#a8482e', pele: { type: 'aneis', freq: 9, color: '#4a1c10', strength: 0.55, skin: 'escamas' } },
      { type: 'ellipsoid', bone: 'chest', p: [0, 5.45, -1.3], r: [0.08, 1.6, 1.4], color: '#a8482e', pele: { type: 'aneis', freq: 9, color: '#4a1c10', strength: 0.55, skin: 'escamas' } },
      { type: 'ellipsoid', bone: 'tail1', p: [0, 4.6, 2.4], r: [0.07, 1.0, 1.2], color: '#984030', pele: { type: 'aneis', freq: 9, color: '#4a1c10', strength: 0.55, skin: 'escamas' } },
      { type: 'ellipsoid', bone: 'jaw', p: [0, 4.15, -4.7], r: [0.25, 0.14, 1.0], color: '#8f8462' },
    ],
  },

  // -------------------------------------------------- Dilofossauro
  dilofossauro: {
    body: 'biped',
    colors: { top: '#5c7436', belly: '#e2d6a2', pattern: '#233012' },
    skin: 'escamas', pattern: { type: 'manchas', freq: 11, strength: 0.75 }, teeth: { n: 9, size: 0.05 },
    spine: [
      [0, 1.35, 2.7, 0.04, 1, 'tail3'],
      [0, 1.3, 1.8, 0.11, 1, 'tail2'],
      [0, 1.28, 0.85, 0.21, 1, 'tail1'],
      [0, 1.27, 0.1, 0.34, 1, 'hips'],
      [0, 1.3, -0.55, 0.32, 1, 'chest'],
      [0, 1.62, -1.0, 0.15, 1, 'neck'],
      [0, 1.85, -1.2, 0.16, 1, 'head'],
      [0, 1.8, -1.55, 0.11, 0.85, 'head'],
      [0, 1.72, -1.82, 0.05, 0.8, 'head'],
    ],
    legs: [
      ...pair('perna', 'hips', [0.22, 1.2, 0.1], [0.26, 0.72, -0.18], [0.26, 0.26, 0.15], [0.26, 0.0, -0.1], [0.15, 0.09, 0.06], 0),
      ...pair('braco', 'chest', [0.22, 1.2, -0.6], [0.27, 0.95, -0.68], [0.27, 0.82, -0.9], [0.27, 0.78, -1.0], [0.06, 0.05, 0.04], 0),
    ],
    extras: [
      ...eyes(0.1, 1.93, -1.3, 0.025),
      { type: 'ellipsoid', bone: 'head', p: [0.07, 2.08, -1.42], r: [0.025, 0.14, 0.32], color: '#d0522a', pele: { type: 'listras', freq: 30, color: '#f0c040', strength: 0.7 } },
      { type: 'ellipsoid', bone: 'head', p: [-0.07, 2.08, -1.42], r: [0.025, 0.14, 0.32], color: '#d0522a', pele: { type: 'listras', freq: 30, color: '#f0c040', strength: 0.7 } },
    ],
  },

  // -------------------------------------------------- Compsognato
  compsognato: {
    body: 'biped',
    colors: { top: '#5e7a38', belly: '#e6d8a0', pattern: '#22320f' },
    skin: 'escamas', pattern: { type: 'dorsal', freq: 6, strength: 0.75 }, teeth: { n: 6, size: 0.012 },
    radial: 8,
    spine: [
      [0, 0.42, 0.62, 0.015, 1, 'tail3'],
      [0, 0.4, 0.42, 0.035, 1, 'tail2'],
      [0, 0.39, 0.2, 0.06, 1, 'tail1'],
      [0, 0.38, 0.02, 0.1, 1, 'hips'],
      [0, 0.4, -0.15, 0.09, 1, 'chest'],
      [0, 0.5, -0.27, 0.045, 1, 'neck'],
      [0, 0.58, -0.32, 0.05, 1, 'head'],
      [0, 0.56, -0.42, 0.03, 0.85, 'head'],
    ],
    legs: [
      ...pair('perna', 'hips', [0.06, 0.36, 0.02], [0.08, 0.22, -0.05], [0.08, 0.08, 0.04], [0.08, 0.0, -0.03], [0.045, 0.025, 0.018], 0),
    ],
    extras: [...eyes(0.03, 0.6, -0.35, 0.01)],
  },

  // -------------------------------------------------- Carnotauro
  carnotauro: {
    body: 'biped',
    colors: { top: '#7e3826', belly: '#d4b088', pattern: '#331209' },
    skin: 'escamas', pattern: { type: 'dorsal', freq: 22, strength: 0.7 }, teeth: { n: 10, size: 0.09 },
    ringsPerMeter: 5,
    bones: [{ name: 'jaw', parent: 'head', pos: [0, 2.85, -2.2] }],
    spine: [
      [0, 2.3, 4.6, 0.08, 1, 'tail3'],
      [0, 2.4, 3.1, 0.32, 1, 'tail2'],
      [0, 2.45, 1.6, 0.58, 1, 'tail1'],
      [0, 2.45, 0.3, 0.85, 1.05, 'hips'],
      [0, 2.5, -0.9, 0.8, 1.1, 'chest'],
      [0, 2.85, -1.75, 0.45, 1, 'neck'],
      [0, 3.05, -2.2, 0.45, 1.1, 'head'],
      [0, 2.95, -2.75, 0.33, 0.95, 'head'],
      [0, 2.8, -3.1, 0.12, 0.85, 'head'],
    ],
    legs: [
      ...pair('perna', 'hips', [0.5, 2.2, 0.3], [0.58, 1.3, -0.3], [0.58, 0.4, 0.35], [0.58, 0.0, -0.05], [0.42, 0.24, 0.15], 0),
      ...pair('braco', 'chest', [0.4, 2.3, -1.2], [0.45, 2.1, -1.3], [0.45, 2.0, -1.4], [0.45, 1.98, -1.48], [0.07, 0.05, 0.04], 0),
    ],
    extras: [
      ...eyes(0.3, 3.22, -2.45, 0.05),
      { type: 'cone', bone: 'head', base: [0.28, 3.32, -2.15], tip: [0.62, 3.65, -1.95], r: 0.1, color: '#3a2a20' },
      { type: 'cone', bone: 'head', base: [-0.28, 3.32, -2.15], tip: [-0.62, 3.65, -1.95], r: 0.1, color: '#3a2a20' },
      { type: 'ellipsoid', bone: 'jaw', p: [0, 2.72, -2.65], r: [0.3, 0.14, 0.5], color: '#a47a5a' },
    ],
  },

  // -------------------------------------------------- Onça-pintada
  onca: {
    body: 'quad',
    colors: { top: '#cc9238', belly: '#efe1c0', pattern: '#1a120c' },
    skin: 'pelo', pattern: { type: 'rosetas', freq: 15, strength: 0.95 }, claws: false,
    spine: [
      [0, 0.78, 1.75, 0.035, 1, 'tail3'],
      [0, 0.62, 1.3, 0.055, 1, 'tail2'],
      [0, 0.68, 0.8, 0.085, 1, 'tail1'],
      [0, 0.72, 0.42, 0.24, 1.0, 'hips'],
      [0, 0.75, -0.25, 0.27, 1.05, 'chest'],
      [0, 0.85, -0.62, 0.16, 1, 'neck'],
      [0, 0.9, -0.8, 0.17, 1, 'head'],
      [0, 0.84, -1.0, 0.1, 0.85, 'head'],
    ],
    legs: [
      ...pair('trás', 'hips', [0.15, 0.65, 0.4], [0.17, 0.4, 0.52], [0.17, 0.15, 0.42], [0.17, 0.0, 0.32], [0.11, 0.07, 0.05], 0),
      ...pair('frente', 'chest', [0.14, 0.62, -0.32], [0.16, 0.35, -0.3], [0.16, 0.1, -0.32], [0.16, 0.0, -0.4], [0.09, 0.06, 0.05], 0.25),
    ],
    extras: [
      ...eyes(0.08, 0.97, -0.92, 0.02),
      { type: 'cone', bone: 'head', base: [0.1, 1.02, -0.76], tip: [0.12, 1.12, -0.74], r: 0.045, color: '#8a6428' },
      { type: 'cone', bone: 'head', base: [-0.1, 1.02, -0.76], tip: [-0.12, 1.12, -0.74], r: 0.045, color: '#8a6428' },
      { type: 'ellipsoid', bone: 'head', p: [0, 0.8, -1.05], r: [0.05, 0.035, 0.03], color: '#2a1e14' },
    ],
  },

  // -------------------------------------------------- Aranha-gigante
  aranha: {
    body: 'spider',
    colors: { top: '#2a221c', belly: '#4a3a2a', pattern: '#9a7430', limbs: '#2e2620' },
    skin: 'pelo', pattern: { type: 'listras', count: 6, strength: 0.55 }, claws: false,
    spine: [
      [0, 1.05, 1.35, 0.08, 1, 'tail1'],
      [0, 1.1, 0.95, 0.55, 0.85, 'tail1'],
      [0, 0.95, 0.35, 0.45, 0.85, 'hips'],
      [0, 0.82, -0.15, 0.36, 0.8, 'chest'],
      [0, 0.76, -0.52, 0.28, 0.8, 'head'],
      [0, 0.7, -0.74, 0.1, 0.8, 'head'],
    ],
    legs: [0, 1, 2, 3].flatMap((k) => pair(`pata${k}`, 'chest',
      [0.22, 0.8, -0.35 + k * 0.16], [0.85, 1.3, -0.5 + k * 0.32 + (k - 1.5) * 0.15],
      [1.35, 0.55, -0.55 + k * 0.38 + (k - 1.5) * 0.3], [1.5, 0.0, -0.6 + k * 0.42 + (k - 1.5) * 0.35],
      [0.07, 0.05, 0.035], k % 2 ? 0.5 : 0, '#2e2620')),
    extras: [
      ...eyes(0.08, 0.88, -0.72, 0.035),
      { type: 'ellipsoid', bone: 'head', p: [0.13, 0.92, -0.66], r: [0.025, 0.025, 0.025], color: '#a01810' },
      { type: 'ellipsoid', bone: 'head', p: [-0.13, 0.92, -0.66], r: [0.025, 0.025, 0.025], color: '#a01810' },
      { type: 'cone', bone: 'head', base: [0.07, 0.68, -0.78], tip: [0.05, 0.42, -0.86], r: 0.04, color: '#1a1412' },
      { type: 'cone', bone: 'head', base: [-0.07, 0.68, -0.78], tip: [-0.05, 0.42, -0.86], r: 0.04, color: '#1a1412' },
    ],
  },

  // -------------------------------------------------- Piranha-gigante
  piranha: {
    body: 'fish',
    root: 'chest',
    colors: { top: '#5c6268', belly: '#c4442e', pattern: '#a8b2b8' },
    skin: 'escamas', scalesPerMeter: 40, pattern: { type: 'manchas', freq: 22, strength: 0.35 }, teeth: { n: 4, size: 0.02 },
    spine: [
      [0, 0, 0.55, 0.03, 1, 'tail2'],
      [0, 0, 0.35, 0.1, 1.2, 'tail1'],
      [0, 0, 0.1, 0.18, 1.5, 'chest'],
      [0, 0, -0.15, 0.18, 1.5, 'chest'],
      [0, -0.02, -0.35, 0.13, 1.3, 'head'],
      [0, -0.04, -0.46, 0.05, 1, 'head'],
    ],
    extras: [
      ...eyes(0.08, 0.06, -0.36, 0.022),
      { type: 'ellipsoid', bone: 'tail2', p: [0, 0, 0.66], r: [0.02, 0.2, 0.12], color: '#4a4e52' },
      { type: 'ellipsoid', bone: 'chest', p: [0, 0.27, 0.0], r: [0.02, 0.12, 0.15], color: '#4a4e52' },
      { type: 'ellipsoid', bone: 'chest', p: [0, -0.25, 0.08], r: [0.02, 0.1, 0.12], color: '#8a2a20' },
      { type: 'cone', bone: 'head', base: [0.03, -0.1, -0.42], tip: [0.03, -0.02, -0.44], r: 0.015, color: '#f0eadc' },
      { type: 'cone', bone: 'head', base: [-0.03, -0.1, -0.42], tip: [-0.03, -0.02, -0.44], r: 0.015, color: '#f0eadc' },
    ],
  },

  // -------------------------------------------------- Arara
  arara: {
    body: 'flyer',
    colors: { top: '#c4282a', belly: '#c4282a', pattern: '#c4282a' },
    skin: 'penas',
    radial: 8,
    spine: [
      [0, 0, 0.3, 0.02, 1, 'tail1'],
      [0, 0, 0.18, 0.07, 1, 'hips'],
      [0, 0, 0.0, 0.1, 1, 'chest'],
      [0, 0.08, -0.15, 0.07, 1, 'neck'],
      [0, 0.12, -0.24, 0.08, 1, 'head'],
      [0, 0.07, -0.34, 0.03, 1, 'head'],
    ],
    wings: [
      { name: 'asaE', points: [[0.06, 0.02, -0.04], [0.3, 0.04, -0.06], [0.6, 0, 0.08], [0.3, 0, 0.18], [0.05, 0, 0.15]], armR: 0.012, color: '#2a5ab8' },
      { name: 'asaD', points: [[-0.06, 0.02, -0.04], [-0.3, 0.04, -0.06], [-0.6, 0, 0.08], [-0.3, 0, 0.18], [-0.05, 0, 0.15]], armR: 0.012, color: '#2a5ab8' },
    ],
    extras: [
      ...eyes(0.05, 0.15, -0.27, 0.012),
      { type: 'ellipsoid', bone: 'tail1', p: [0, 0, 0.55], r: [0.05, 0.015, 0.3], color: '#2a5ab8' },
      { type: 'ellipsoid', bone: 'tail1', p: [0, 0.01, 0.45], r: [0.035, 0.015, 0.22], color: '#e8c030' },
      { type: 'ellipsoid', bone: 'head', p: [0, 0.14, -0.21], r: [0.06, 0.05, 0.05], color: '#f0e8e0' },
      { type: 'cone', bone: 'head', base: [0, 0.08, -0.3], tip: [0, 0.0, -0.38], r: 0.03, color: '#2a2420' },
    ],
  },
};
