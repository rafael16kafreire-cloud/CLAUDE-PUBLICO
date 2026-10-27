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

// Uma folha: elipse pontuda com gradiente (mais clara na borda), nervura
// central e nervuras laterais finas.
function leaf(ctx, x, y, len, wid, ang, lum, warm) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  const shade = (k) => {
    const r = Math.round(Math.min(255, lum * k * (226 + warm * 22)));
    const g = Math.round(Math.min(255, lum * k * 255));
    const b = Math.round(Math.min(255, lum * k * (196 - warm * 30)));
    return [r, g, b];
  };
  const [r, g, b] = shade(1);
  const [r2, g2, b2] = shade(0.78);
  const grd = ctx.createLinearGradient(0, -wid, 0, wid);
  grd.addColorStop(0, `rgb(${r},${g},${b})`);
  grd.addColorStop(0.5, `rgb(${r2},${g2},${b2})`);
  grd.addColorStop(1, `rgb(${r},${g},${b})`);
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(len * 0.4, -wid, len, 0);
  ctx.quadraticCurveTo(len * 0.4, wid, 0, 0);
  ctx.fill();
  // nervura central clara e nervuras laterais escuras
  ctx.lineCap = 'round';
  ctx.strokeStyle = `rgba(${Math.min(255, r + 28)},${Math.min(255, g + 26)},${Math.min(255, b + 10)},0.85)`;
  ctx.lineWidth = Math.max(0.7, wid * 0.11);
  ctx.beginPath();
  ctx.moveTo(1, 0);
  ctx.lineTo(len * 0.92, 0);
  ctx.stroke();
  ctx.strokeStyle = `rgba(${Math.round(r * 0.62)},${Math.round(g * 0.66)},${Math.round(b * 0.55)},0.55)`;
  ctx.lineWidth = 0.55;
  for (let k = 1; k <= 3; k++) {
    const t = k * 0.22;
    const px = len * t;
    const py = wid * 0.55 * Math.sin(t * Math.PI);
    ctx.beginPath();
    ctx.moveTo(px, 0);
    ctx.lineTo(px + len * 0.12, -py);
    ctx.moveTo(px, 0);
    ctx.lineTo(px + len * 0.12, py);
    ctx.stroke();
  }
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
  const N = 380;
  for (let i = 0; i < N; i++) {
    const t = i / N;
    const a = R() * Math.PI * 2;
    const d = Math.sqrt(R()) * (58 + 22 * t) * (0.85 + R() * 0.2);
    const x = cx + Math.cos(a) * d;
    const y = cy + Math.sin(a) * d;
    const len = 15 + R() * 20;
    const wid = len * (0.3 + R() * 0.14);
    // folhas apontam mais ou menos para fora do tufo
    const ang = a + (R() - 0.5) * 1.6;
    const lum = 0.5 + t * 0.35 + R() * 0.18;
    leaf(ctx, x, y, len, wid, ang, lum, R() < 0.22 ? 1 : R() * 0.3);
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
  texture.anisotropy = 4;
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
  const W = 256;
  const H = 512;
  const data = new Uint8Array(W * H * 4);
  // casca: veios compridos em pé, rachaduras fundas, placas e grão fino
  const n1 = tileNoise(24, 5, 11);
  const n2 = tileNoise(64, 20, 12);
  const n3 = tileNoise(10, 4, 13);
  const n7 = tileNoise(128, 40, 17);   // grão fino
  const n8 = tileNoise(12, 16, 18);    // placas (quebram o veio a cada tanto)
  // nervuras: linhas finas diagonais
  const n4 = tileNoise(24, 24, 14);
  // líquen e musgo: manchas grandes e miúdas
  const n5 = tileNoise(5, 10, 15);
  const n6 = tileNoise(14, 26, 16);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const u = x / W;
      const v = y / H;
      const warp = (n3(u, v) - 0.5) * 0.1 + (n8(u, v) - 0.5) * 0.03;
      const ridge = 1 - Math.abs(n1(u + warp, v) * 2 - 1); // 1 no meio do veio
      const fine = n2(u + warp, v);
      const grain = n7(u, v);
      const plate = n8(u, v);
      let b = 0.3 + ridge * 0.5 + (fine - 0.5) * 0.34 + (grain - 0.5) * 0.14 + (plate - 0.5) * 0.12;
      if (ridge < 0.2) b *= 0.4;          // rachadura funda
      else if (ridge < 0.32) b *= 0.7;    // beira da rachadura
      const vein = 0.75 + 0.25 * Math.abs(Math.sin((u * 6 + v * 3) * Math.PI * 2)) * (0.6 + n4(u, v) * 0.4);
      const i = (y * W + x) * 4;
      data[i] = Math.max(0, Math.min(255, Math.round(b * 255)));
      data[i + 1] = Math.round(vein * 255);
      data[i + 2] = Math.round(Math.min(1, n5(u, v) * 0.62 + n6(u, v) * 0.38) * 255);
      data[i + 3] = 255;
    }
  }
  bark = new THREE.DataTexture(data, W, H, THREE.RGBAFormat);
  bark.wrapS = THREE.RepeatWrapping;
  bark.wrapT = THREE.RepeatWrapping;
  bark.magFilter = THREE.LinearFilter;
  bark.anisotropy = 4;
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
        float plantLeaf = 1.0;
        float plantBump = 0.0;
        #ifdef USE_MAP
        if (vMapUv.x > 0.88 && vPlantW < 0.2) plantLeaf = 0.0;
        if (plantLeaf > 0.5) {
          // variação de cor por tufo: alguns mais amarelados, outros mais escuros
          float hv = fract(sin(dot(floor(vPlantP * 0.9), vec3(12.9898, 78.233, 37.719))) * 43758.5453);
          diffuseColor.rgb *= mix(vec3(0.9, 0.98, 0.9), vec3(1.28, 1.12, 0.62), smoothstep(0.55, 0.95, hv));
          diffuseColor.rgb *= 1.12;
        }
        if (vMapUv.x > 0.88) {
          vec3 pp = vPlantP;
          if (vMapUv.y < 0.6) {
            // pedra: manchinhas
            float st = texture2D(uBark, pp.xz * 0.9 + pp.y * 0.5).r;
            diffuseColor.rgb *= mix(0.75, 1.12, st);
          } else if (vPlantW < 0.2) {
            // casca: 5 voltas da textura em volta do tronco, com líquen e musgo
            float ang = atan(pp.z, pp.x) / 6.28318;
            vec3 bt = texture2D(uBark, vec2(ang * 6.0, pp.y * 0.25)).rgb;
            vec3 base = diffuseColor.rgb * mix(0.36, 1.2, bt.r);
            float low = 1.0 - smoothstep(0.0, 7.0, pp.y);
            float lich = smoothstep(0.52, 0.78, bt.b);
            base = mix(base, vec3(0.6, 0.66, 0.56) * (0.55 + 0.55 * bt.r), lich * 0.5 * (1.0 - low * 0.4));
            float moss = smoothstep(0.42, 0.8, bt.b * (0.55 + low * 0.8));
            base = mix(base, vec3(0.24, 0.38, 0.13) * (0.65 + 0.7 * bt.r), moss * (0.3 + low * 0.45));
            diffuseColor.rgb = base;
            plantBump = bt.r;
          } else {
            float vn = texture2D(uBark, pp.xz * 1.7 + pp.y * 0.3).g;
            diffuseColor.rgb *= mix(0.78, 1.1, vn);
          }
        }
        #endif`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        vec2 dHp = vec2(dFdx(plantBump), dFdy(plantBump));
        if (plantBump > 0.0) {
          vec3 sX = dFdx(-vViewPosition);
          vec3 sY = dFdy(-vViewPosition);
          vec3 R1 = cross(sY, normal);
          vec3 R2 = cross(normal, sX);
          float det = dot(sX, R1);
          vec2 dH = dHp * 1.6;
          vec3 gr = sign(det) * (dH.x * R1 + dH.y * R2);
          normal = normalize(abs(det) * normal - gr);
        }`)
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
        reflectedLight.indirectDiffuse *= mix(1.0, 1.22, plantLeaf);
        #if NUM_DIR_LIGHTS > 0
        {
          // luz atravessando a folha (contraluz): clareia e esquenta o verde
          vec3 Vd = normalize(vViewPosition);
          float tr = pow(clamp(-dot(Vd, directionalLights[0].direction), 0.0, 1.0), 2.0);
          reflectedLight.directDiffuse += directionalLights[0].color * diffuseColor.rgb * vec3(1.0, 1.0, 0.55) * tr * 0.75 * plantLeaf;
        }
        #endif`);
  };
  const key = material.customProgramCacheKey;
  material.customProgramCacheKey = () => `${key ? key() : ''}-planta4`;
  return material;
}

// Luz atravessando as folhas, para modelos prontos com textura própria
// (só materiais com recorte alfa = folhas).
export function addLeafLight(material, strength = 0.6) {
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    prev?.(shader, renderer);
    shader.fragmentShader = shader.fragmentShader.replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
        reflectedLight.indirectDiffuse *= 1.18;
        #if NUM_DIR_LIGHTS > 0
        {
          vec3 Vd = normalize(vViewPosition);
          float tr = pow(clamp(-dot(Vd, directionalLights[0].direction), 0.0, 1.0), 2.0);
          reflectedLight.directDiffuse += directionalLights[0].color * diffuseColor.rgb * vec3(1.0, 1.0, 0.6) * tr * ${strength.toFixed(2)};
        }
        #endif`);
  };
  const key = material.customProgramCacheKey;
  material.customProgramCacheKey = () => `${key ? key() : ''}-luzfolha`;
  return material;
}
