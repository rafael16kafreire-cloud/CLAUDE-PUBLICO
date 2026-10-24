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

// =============================================================
// CASCA DE ÁRVORE (128 x 256, repete sem emenda)
// Veios verticais com rachaduras escuras. Usada pelos troncos e
// galhos (r) e, em escala menor, como nervuras nas folhas (g).
// =============================================================
let bark = null;

function tileNoise(cellsX, cellsY, seed) {
  const R = rand(seed);
  const g = Array.from({ length: cellsX * cellsY }, () => R());
  const sm = (t) => t * t * (3 - 2 * t);
  return (u, v) => {
    const fx = u * cellsX;
    const fy = v * cellsY;
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const tx = sm(fx - x0);
    const ty = sm(fy - y0);
    const at = (x, y) => g[(((y % cellsY) + cellsY) % cellsY) * cellsX + (((x % cellsX) + cellsX) % cellsX)];
    const a = at(x0, y0) * (1 - tx) + at(x0 + 1, y0) * tx;
    const b = at(x0, y0 + 1) * (1 - tx) + at(x0 + 1, y0 + 1) * tx;
    return a * (1 - ty) + b * ty;
  };
}

export function barkTexture() {
  if (bark) return bark;
  const W = 128;
  const H = 256;
  const data = new Uint8Array(W * H * 4);
  // casca: muito mais detalhe na horizontal (veios em pé)
  const n1 = tileNoise(16, 4, 11);
  const n2 = tileNoise(32, 10, 12);
  const n3 = tileNoise(8, 3, 13);
  // nervuras: linhas finas diagonais
  const n4 = tileNoise(24, 24, 14);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const u = x / W;
      const v = y / H;
      const warp = (n3(u, v) - 0.5) * 0.08;
      const ridge = 1 - Math.abs(n1(u + warp, v) * 2 - 1); // 1 no meio do veio
      const fine = n2(u + warp, v);
      let b = 0.35 + ridge * 0.5 + (fine - 0.5) * 0.3;
      if (ridge < 0.18) b *= 0.45; // rachadura funda
      const vein = 0.75 + 0.25 * Math.abs(Math.sin((u * 6 + v * 3) * Math.PI * 2)) * (0.6 + n4(u, v) * 0.4);
      const i = (y * W + x) * 4;
      data[i] = Math.max(0, Math.min(255, Math.round(b * 255)));
      data[i + 1] = Math.round(vein * 255);
      data[i + 2] = 0;
      data[i + 3] = 255;
    }
  }
  bark = new THREE.DataTexture(data, W, H, THREE.RGBAFormat);
  bark.wrapS = THREE.RepeatWrapping;
  bark.wrapT = THREE.RepeatWrapping;
  bark.magFilter = THREE.LinearFilter;
  bark.minFilter = THREE.LinearMipmapLinearFilter;
  bark.generateMipmaps = true;
  bark.needsUpdate = true;
  return bark;
}

// Acrescenta a casca (troncos) e nervuras (folhas grandes) ao material
// das plantas. Só age nas partes que usam o pedaço branco da textura
// de folhagem; aWind diz se é tronco (0) ou folha (> 0).
export function addPlantDetail(material) {
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    prev?.(shader, renderer);
    shader.uniforms.uBark = { value: barkTexture() };
    shader.vertexShader = shader.vertexShader
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vPlantP = position;
        vPlantW = aWind;`)
      .replace('#include <common>', `#include <common>
        varying vec3 vPlantP;
        varying float vPlantW;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform sampler2D uBark;
        varying vec3 vPlantP;
        varying float vPlantW;`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        #ifdef USE_MAP
        if (vMapUv.x > 0.88) {
          vec3 pp = vPlantP;
          if (vMapUv.y < 0.6) {
            // pedra: manchinhas
            float st = texture2D(uBark, pp.xz * 0.9 + pp.y * 0.5).r;
            diffuseColor.rgb *= mix(0.75, 1.12, st);
          } else if (vPlantW < 0.2) {
            // casca: 5 voltas da textura em volta do tronco
            float ang = atan(pp.z, pp.x) / 6.28318;
            float bk = texture2D(uBark, vec2(ang * 5.0, pp.y * 0.22)).r;
            diffuseColor.rgb *= mix(0.42, 1.18, bk);
          } else {
            float vn = texture2D(uBark, pp.xz * 1.7 + pp.y * 0.3).g;
            diffuseColor.rgb *= mix(0.78, 1.1, vn);
          }
        }
        #endif`);
  };
  const key = material.customProgramCacheKey;
  material.customProgramCacheKey = () => `${key ? key() : ''}-planta`;
  return material;
}
