// =============================================================
// TEXTURA DE FOLHAGEM (desenhada por código, original)
// Uma imagem só para toda a vegetação (512 x 512):
//   - em cima à esquerda: um "tufo" de folhinhas com fundo
//     transparente, usado nos cartões de folhas de perto;
//   - em cima à direita: um quadrado branco liso, usado por troncos,
//     galhos e folhas grandes (a cor vem do próprio modelo);
//   - embaixo: um tapete de folhas sem buracos, que cobre as copas
//     "sólidas" (miolo das copas e copas de média distância).
// Os tons são claros e quase cinza: a cor verde de cada árvore
// vem da cor do modelo, multiplicada por esta imagem.
// =============================================================
import * as THREE from 'three';

// Coordenadas (u, v) dentro da imagem.
// (a imagem fica de cabeça para baixo na placa de vídeo: v = 1 é o topo)
export const WHITE_UV = [0.94, 0.75];
export const LEAF_UV = { u0: 0.0, u1: 0.5, v0: 0.5, v1: 1.0 };
export const TILE_UV = { u0: 0.02, u1: 0.98, v0: 0.02, v1: 0.45 };

let texture = null;

function rand(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Uma folha: elipse pontuda com nervura.
function leaf(ctx, x, y, len, wid, ang, lum, warm) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  const r = Math.round(Math.min(255, lum * (226 + warm * 22)));
  const g = Math.round(Math.min(255, lum * 255));
  const b = Math.round(Math.min(255, lum * (196 - warm * 30)));
  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(len * 0.45, -wid, len, 0);
  ctx.quadraticCurveTo(len * 0.45, wid, 0, 0);
  ctx.fill();
  ctx.strokeStyle = `rgba(${Math.round(r * 0.7)},${Math.round(g * 0.72)},${Math.round(b * 0.6)},0.8)`;
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(1, 0);
  ctx.lineTo(len * 0.9, 0);
  ctx.stroke();
  ctx.restore();
}

export function foliageTexture() {
  if (texture) return texture;
  const W = 512;
  const H = 512;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, W, H);

  // quadrado branco (troncos e folhas grandes)
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(448, 0, 64, 256);

  // tufo de folhas (centro 128,128; raio ~112)
  const R = rand(7);
  const cx = 128;
  const cy = 128;
  // raminhos por baixo
  ctx.lineCap = 'round';
  for (let i = 0; i < 9; i++) {
    const a = R() * Math.PI * 2;
    const l = 50 + R() * 50;
    ctx.strokeStyle = `rgb(${110 + R() * 30},${92 + R() * 20},${70 + R() * 15})`;
    ctx.lineWidth = 2.6 - i * 0.15;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * 8, cy + Math.sin(a) * 8);
    ctx.quadraticCurveTo(cx + Math.cos(a + 0.3) * l * 0.5, cy + Math.sin(a + 0.3) * l * 0.5, cx + Math.cos(a) * l, cy + Math.sin(a) * l);
    ctx.stroke();
  }
  // folhas: de dentro (escuras) para fora (claras)
  const N = 260;
  for (let i = 0; i < N; i++) {
    const t = i / N;
    const a = R() * Math.PI * 2;
    const d = Math.sqrt(R()) * (58 + 22 * t) * (0.85 + R() * 0.2);
    const x = cx + Math.cos(a) * d;
    const y = cy + Math.sin(a) * d;
    const len = 16 + R() * 18;
    const wid = len * (0.28 + R() * 0.12);
    // folhas apontam mais ou menos para fora do tufo
    const ang = a + (R() - 0.5) * 1.6;
    const lum = 0.5 + t * 0.35 + R() * 0.18;
    leaf(ctx, x, y, len, wid, ang, lum, R() < 0.15 ? 1 : R() * 0.3);
  }
  // garante a borda transparente (sem "vazar" para fora do tufo)
  ctx.clearRect(250, 0, 198, 256);
  ctx.clearRect(0, 250, 448, 22);

  // tapete de folhas (sem buracos): fundo escuro + muitas folhas
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 272, W, 240);
  ctx.clip();
  ctx.fillStyle = 'rgb(92,104,80)';
  ctx.fillRect(0, 272, W, 240);
  for (let i = 0; i < 1500; i++) {
    const t = i / 1500;
    const x = R() * W;
    const y = 272 + R() * 240;
    const len = 12 + R() * 16;
    leaf(ctx, x, y, len, len * (0.3 + R() * 0.12), R() * Math.PI * 2, 0.5 + t * 0.32 + R() * 0.2, R() < 0.12 ? 1 : R() * 0.3);
  }
  ctx.restore();

  texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 2;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  return texture;
}
