// Chefe do vulcão (dragão da Regina Cachoa): atacar, rugir, cuspir_fogo, pisar_chao, comer, dormir, morrer + pele de lava
// Eixos do mundo: X = esquerda do bicho (+X abaixa o focinho), Y = cima (+Y vira p/ esquerda), Z = frente (+Z tomba p/ direita)
const vars = {
  B: +(process.env.BOCA ?? 1),   // sentido de abrir a boca (teste)
};
export default {
  modelo: '../modelos/chefe_vulcao.glb', saida: process.env.SAIDA || '../modelos/chefe_vulcao.glb', vars,
  clipes: [
    { nome: 'atacar', base: 'parado', baseT: 0, dur: 1.6, f: (t, d, u) => {
      const a = u.ida(t, 0, 0.4, 0.4, 0.6), b = u.ida(t, 0.4, 0.6, 0.9, 1.5), m = u.ida(t, 0.3, 0.5, 0.7, 0.95);
      return { 'DEF-Spine005_07': [-8 * a + 10 * b, 0, 0], 'DEF-neck_08': [-14 * a + 18 * b, 0, 0], 'DEF-neck001_09': [-8 * a + 12 * b, 0, 0],
        'DEF-neck003_011': [6 * a - 8 * b, 0, 0], 'DEF-neck004_012': [-6 * b, 0, 0], 'DEF-Bone_014': [32 * m * B, 0, 0],
        $pos: { 'DEF-Spine_02': [0, -0.3 * b, 0.6 * b] } }; } },
    { nome: 'rugir', base: 'parado', baseT: 0, dur: 3.2, f: (t, d, u) => {
      const k = u.ida(t, 0, 0.6, 2.5, 3.2), m = u.ida(t, 0.5, 0.8, 2.3, 2.8), tr = u.sin(t, 0.15) * m;
      return { 'DEF-Spine005_07': [-10 * k, 0, 0], 'DEF-neck_08': [-18 * k, 0, 0], 'DEF-neck001_09': [-14 * k, 0, 0], 'DEF-neck003_011': [-8 * k, 0, 0],
        'DEF-neck004_012': [-14 * k + 2 * tr, 2 * tr, 0], 'DEF-Bone_014': [40 * m * B, 0, 0],
        'DEF-Wing_BaseL_081': [0, 0, -25 * k], 'DEF-Wing_BaseR_097': [0, 0, 25 * k] }; } },
    { nome: 'cuspir_fogo', base: 'parado', baseT: 0, dur: 3.4, f: (t, d, u) => {
      const k = u.ida(t, 0, 0.6, 2.8, 3.4), m = u.ida(t, 0.5, 0.8, 2.6, 3.0), v = Math.sin((t - 0.8) / 2 * Math.PI * 2) * u.ida(t, 0.8, 1.2, 2.4, 2.8);
      return { 'DEF-Spine005_07': [6 * k, 0, 0], 'DEF-neck_08': [10 * k, 16 * v, 0], 'DEF-neck001_09': [-6 * k, 10 * v, 0], 'DEF-neck002_010': [-10 * k, 0, 0],
        'DEF-neck003_011': [-10 * k, 0, 0], 'DEF-neck004_012': [-12 * k, 0, 0], 'DEF-Bone_014': [45 * m * B, 0, 0],
        'DEF-Wing_BaseL_081': [0, 0, -12 * k], 'DEF-Wing_BaseR_097': [0, 0, 12 * k], $pos: { 'DEF-Spine_02': [0, 0, -0.5 * k] } }; } },
    { nome: 'pisar_chao', base: 'parado', baseT: 0, dur: 2.6, f: (t, d, u) => {
      const up = u.e(t, 0.1, 0.9) * (1 - u.e(t, 1.1, 1.35)), im = u.ida(t, 1.25, 1.35, 1.45, 2.0), m = u.ida(t, 0.5, 0.9, 1.4, 1.9);
      return { 'DEF-Spine_02': [-28 * up + 4 * im, 0, 0], $pos: { 'DEF-Spine_02': [0, 0.6 * up - 0.5 * im, -0.8 * up] },
        'DEF-thighL_0112': [28 * up - 4 * im, 0, 0], 'DEF-thighR_0132': [28 * up - 4 * im, 0, 0], 'DEF-tail_0151': [22 * up, 0, 0],
        'DEF-upper_armL_040': [-30 * up, 0, 0], 'DEF-upper_armR_061': [-30 * up, 0, 0], 'DEF-forearmL_042': [40 * up, 0, 0], 'DEF-forearmR_063': [40 * up, 0, 0],
        'DEF-neck_08': [10 * up + 10 * im, 0, 0], 'DEF-neck004_012': [6 * im, 0, 0], 'DEF-Bone_014': [30 * m * B, 0, 0],
        'DEF-Wing_BaseL_081': [0, 0, -30 * up], 'DEF-Wing_BaseR_097': [0, 0, 30 * up] }; } },
    { nome: 'comer', base: 'parado', baseT: 0, dur: 4, f: (t, d, u) => {
      const k = u.e(t, 0, 0.7) * (1 - u.e(t, 3.3, 4)), m = Math.max(0, u.sin(t, 1.2)) * k, p = Math.max(0, u.sin(t, 1.2, 0.5)) * k;
      return { 'DEF-Spine005_07': [14 * k, 0, 0], 'DEF-neck_08': [24 * k, 0, 0], 'DEF-neck001_09': [22 * k - 6 * p, 0, 0], 'DEF-neck002_010': [12 * k, 0, 0],
        'DEF-neck003_011': [6 * k, 0, 5 * p], 'DEF-neck004_012': [4 * k, 0, 0], 'DEF-Bone_014': [22 * m * B, 0, 0] }; } },
    { nome: 'dormir', base: 'sentado', baseT: 0, dur: 6, f: (t, d, u) => {
      const b = u.sin(t, 6);
      return { $pos: { 'DEF-Spine_02': [0, -1.2, 0] }, 'DEF-Spine001_03': [b, 0, 0], 'DEF-Spine005_07': [10, 0, 0],
        'DEF-neck_08': [34, 10, 0], 'DEF-neck001_09': [26, 14, 0], 'DEF-neck002_010': [14, 12, 0], 'DEF-neck003_011': [6, 6, 0], 'DEF-neck004_012': [b, 0, -8],
        'DEF-Wing_BaseL_081': [0, 0, 18], 'DEF-Wing_BaseR_097': [0, 0, -18] }; } },
    { nome: 'morrer', base: 'parado', baseT: 0, dur: 3.6, f: (t, d, u) => {
      const a = u.ida(t, 0, 0.5, 0.6, 1.2), c = u.e(t, 0.8, 2.2), q = u.e(t, 1.9, 2.7);
      return { 'DEF-Spine_02': [-8 * a, 0, 78 * c], $pos: { 'DEF-Spine_02': [0, -3.2 * c, 0] },
        'DEF-neck_08': [-16 * a + 10 * q, 0, 10 * q], 'DEF-neck001_09': [-10 * a + 10 * q, 0, 10 * q], 'DEF-neck004_012': [-10 * a, 0, 10 * q],
        'DEF-Bone_014': [(40 * a + 18 * q) * B, 0, 0],
        'DEF-thighL_0112': [-25 * c, 0, 0], 'DEF-thighR_0132': [-10 * c, 0, 0], 'DEF-upper_armL_040': [-20 * c, 0, 0],
        'DEF-Wing_BaseL_081': [0, 0, 20 * a - 40 * c], 'DEF-Wing_BaseR_097': [0, 0, -20 * a], 'DEF-tail_0151': [-6 * c, 0, 0] }; } },
  ],
  // pele de lava: as manchas avermelhadas da textura viram brilho de lava (emissive) e o resto escurece
  material: (THREE, m) => {
    // rodar só uma vez: antes refaça modelos/chefe_vulcao.glb com 'node adaptar.mjs config/chefe_vulcao.json'
    if (!m.map || !m.map.image) return;
    const img = m.map.image, w = img.width, h = img.height, mkc = () => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
    const cv = mkc(), cx = cv.getContext('2d'); cx.drawImage(img, 0, 0); const d = cx.getImageData(0, 0, w, h), p = d.data;
    const bv = mkc(), bx = bv.getContext('2d'); bx.filter = 'blur(' + Math.max(2, Math.round(w / 300)) + 'px)'; bx.drawImage(img, 0, 0); const bp = bx.getImageData(0, 0, w, h).data;
    const ev = mkc(), ex = ev.getContext('2d'), e = ex.createImageData(w, h), q = e.data;
    for (let i = 0; i < p.length; i += 4) {
      const r = p[i], g = p[i + 1], b = p[i + 2], lum = (r + g + b) / 3, blum = (bp[i] + bp[i + 1] + bp[i + 2]) / 3, red = r - (g + b) / 2;
      // fendas (mais escuras que a vizinhança) e manchas vermelhas viram lava
      const k = Math.min(1, Math.max(0, (blum - lum - 6) / 14) + Math.max(0, (red - 18) / 50));
      q[i] = 255 * k; q[i + 1] = 30 + 120 * k * k; q[i + 2] = 10 * k; q[i + 3] = 255;
      q[i] *= k > 0.05 ? 1 : 0; q[i + 1] *= k > 0.05 ? 1 : 0;
      p[i] = r * 0.5; p[i + 1] = g * 0.42; p[i + 2] = b * 0.4;
    }
    cx.putImageData(d, 0, 0); ex.putImageData(e, 0, 0);
    const mk = c => { const tx = new THREE.CanvasTexture(c); tx.flipY = m.map.flipY; tx.colorSpace = THREE.SRGBColorSpace; tx.wrapS = m.map.wrapS; tx.wrapT = m.map.wrapT; tx.channel = m.map.channel; return tx; };
    m.map = mk(cv); m.emissiveMap = mk(ev); m.emissive = new THREE.Color(1, 0.6, 0.35); m.emissiveIntensity = 2.4; m.needsUpdate = true;
  },
};
