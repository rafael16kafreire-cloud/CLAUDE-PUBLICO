// =============================================================
// PELE DOS ANIMAIS (desenhada pela placa de vídeo, original)
// Cada vértice do modelo diz:
//   aPat    = (desenho, frequência, força, pele)
//   aPatCol = cor do desenho (rgb) + tamanho das escamas (a: por metro)
// Desenhos: 0 nenhum, 1 listras, 2 manchas, 3 pintas de onça
//           (rosetas), 4 mosqueado, 5 anéis/faixas, 6 faixa nas costas
// Pele:     0 escamas, 1 pelo, 2 penas, 3 lisa (olhos, chifres, dentes)
// O desenho usa a posição no corpo do animal (não no mundo), então
// as listras andam junto com ele.
// =============================================================
import * as THREE from 'three';
import { detailTexture } from '../world/materials.js';

let scaleTex = null;

// Textura de escamas que se repete: células irregulares (Voronoi),
// com a borda escura (r) e o "volume" de cada escama (g).
function scaleTexture(size = 128, cells = 8) {
  if (scaleTex) return scaleTex;
  let seed = 4242;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const pts = [];
  for (let j = 0; j < cells; j++) {
    for (let i = 0; i < cells; i++) pts.push([(i + 0.15 + rnd() * 0.7) / cells, (j + 0.15 + rnd() * 0.7) / cells]);
  }
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      let f1 = 9;
      let f2 = 9;
      const ci = Math.floor(u * cells);
      const cj = Math.floor(v * cells);
      for (let dj = -1; dj <= 1; dj++) {
        for (let di = -1; di <= 1; di++) {
          const ii = (ci + di + cells) % cells;
          const jj = (cj + dj + cells) % cells;
          const p = pts[jj * cells + ii];
          // repete sem emenda: desloca o ponto para a célula vizinha
          const px = p[0] + Math.floor((ci + di) / cells);
          const py = p[1] + Math.floor((cj + dj) / cells);
          const dx = u - px;
          const dy = v - py;
          const d = Math.hypot(dx, dy) * cells;
          if (d < f1) {
            f2 = f1;
            f1 = d;
          } else if (d < f2) f2 = d;
        }
      }
      const edge = Math.min(1, Math.max(0, (f2 - f1) / 0.22));
      const dome = Math.max(0, 1 - f1 * 1.1);
      const o = (y * size + x) * 4;
      data[o] = Math.round(edge * 255);
      data[o + 1] = Math.round(dome * 255);
      data[o + 2] = 0;
      data[o + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  scaleTex = tex;
  return tex;
}

export function makeCreatureMaterial() {
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uNoise = { value: detailTexture() };
    shader.uniforms.uScales = { value: scaleTexture() };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        attribute vec4 aPat;
        attribute vec4 aPatCol;
        varying vec4 vPat;
        varying vec4 vPatCol;
        varying vec3 vObj;
        varying vec3 vObjN;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vPat = aPat;
        vPatCol = aPatCol;
        vObj = position;
        vObjN = normal;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform sampler2D uNoise;
        uniform sampler2D uScales;
        varying vec4 vPat;
        varying vec4 vPatCol;
        varying vec3 vObj;
        varying vec3 vObjN;
        // amostra "de três lados" (não estica nas laterais)
        float triN(vec3 p, vec3 w) {
          return texture2D(uNoise, p.yz).r * w.x + texture2D(uNoise, p.xz).r * w.y + texture2D(uNoise, p.xy).r * w.z;
        }
        vec2 triS(vec3 p, vec3 w) {
          return texture2D(uScales, p.yz).rg * w.x + texture2D(uScales, p.xz).rg * w.y + texture2D(uScales, p.xy).rg * w.z;
        }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          vec3 N = normalize(vObjN);
          vec3 w = N * N;
          w /= (w.x + w.y + w.z);
          float type = floor(vPat.x + 0.5);
          float freq = vPat.y;
          float strength = vPat.z;
          float skin = floor(vPat.w + 0.5);
          vec3 p = vObj;
          // variação suave da cor (o animal não fica "de plástico")
          float big = triN(p * 0.09, w);
          diffuseColor.rgb *= 0.86 + 0.28 * big;
          // desenho do corpo
          if (type > 0.5 && strength > 0.0) {
            float m = 0.0;
            float wob = (triN(p * 0.18, w) - 0.5) * 3.0;
            if (type < 1.5) {                       // listras de través
              m = smoothstep(0.25, 0.55, sin(p.z * freq + wob * 1.3 + p.y * 0.8));
            } else if (type < 2.5) {                // manchas
              m = smoothstep(0.6, 0.66, triN(p * freq * 0.05, w));
            } else if (type < 3.5) {                // rosetas (onça)
              float v = triN(p * freq * 0.05, w);
              // anel escuro em volta de um miolo mais claro + pintinhas
              m = smoothstep(0.54, 0.57, v) * (1.0 - smoothstep(0.64, 0.67, v)) + (1.0 - smoothstep(0.34, 0.37, v));
            } else if (type < 4.5) {                // mosqueado
              m = smoothstep(0.42, 0.72, triN(p * freq * 0.04, w)) * 0.85;
            } else if (type < 5.5) {                // anéis
              m = smoothstep(0.1, 0.4, sin(p.z * freq + wob * 0.6));
            } else {                                // faixa nas costas + manchinhas
              m = (1.0 - smoothstep(0.08, 0.3, abs(p.x) / max(0.05, freq * 0.02))) * smoothstep(0.0, 0.5, N.y);
              m = max(m, smoothstep(0.64, 0.68, triN(p * 0.9, w)) * 0.7);
            }
            // barriga sem desenho (menos nos anéis)
            float dorsal = type > 4.5 && type < 5.5 ? 1.0 : smoothstep(-0.35, 0.35, N.y);
            diffuseColor.rgb = mix(diffuseColor.rgb, vPatCol.rgb, clamp(m * strength * dorsal, 0.0, 1.0));
          }
          // pele
          // a textura tem 8 escamas por lado
          float tiles = vPatCol.a / 8.0;
          if (skin < 0.5) {
            vec2 sc = triS(p * tiles, w);
            diffuseColor.rgb *= mix(0.7, 1.04, sc.r) * (0.9 + 0.16 * sc.g);
          } else if (skin < 1.5) {
            // pelo: riscos finos no sentido do corpo
            float f = texture2D(uNoise, vec2(p.x * 6.0 + p.y * 2.0, p.z * 0.6)).r * w.y + texture2D(uNoise, vec2(p.y * 6.0, p.z * 0.6)).r * (w.x + w.z);
            diffuseColor.rgb *= 0.78 + 0.36 * f;
          } else if (skin < 2.5) {
            // penas: escamas grandes e macias
            vec2 sc = triS(p * tiles * 0.6, w);
            diffuseColor.rgb *= mix(0.8, 1.05, sc.r) * (0.94 + 0.1 * sc.g);
          }
        }`);
  };
  mat.customProgramCacheKey = () => 'pele-v1';
  return mat;
}
