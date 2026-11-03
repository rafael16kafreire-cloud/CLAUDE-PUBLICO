// =============================================================
// MATERIAIS – a "pintura" das superfícies
// - Terreno: low-poly, uma cor da paleta por face, luz facetada.
// - Vegetação: vento (a planta enverga e as folhas tremulam) e
//   tremida quando você bate numa árvore.
// - Água: sabe a profundidade (clara e com espuma na beira,
//   escura no fundo), ondulação e reflexo do céu e do sol.
// - Céu: degradê, brilho do sol e nuvens que andam.
// - Impostor: árvore distante desenhada como "foto" (bem leve).
// =============================================================
import * as THREE from 'three';
import { PALETA, mistura } from '../core/paleta.js';
import { TERRA_COR, TERRA_RELEVO, TERRA_MEDIA } from './textures/terra.js';
import { FOLHAGEM_COR } from './textures/veg_modelos.js';
import { NEVE_COR, NEVE_RELEVO } from './textures/neve.js';
import { ROCHA_NEVADA } from './textures/neve_modelos.js';
import { TERRA_COR_HD, TERRA_RELEVO_HD, NEVE_COR_HD, NEVE_RELEVO_HD } from './textures/hd.js';
import { hdTextures } from '../core/settings.js';
import { REALISTA } from '../core/estilo_mundo.js';

// cor da paleta como constante GLSL (vec3 linear)
const glsl = (c) => `vec3(${c.r.toFixed(4)}, ${c.g.toFixed(4)}, ${c.b.toFixed(4)})`;

// Tempo compartilhado pelos materiais animados.
export const sharedTime = { value: 0 };
// Árvore sendo atingida: (x, z, momento, força).
// Claridade do dia (1 = meio-dia, ~0.2 = noite), para materiais
// que não usam as luzes da cena (água, céu, árvores distantes).
export const sharedDay = { value: 1 };
export const sharedShake = { value: new THREE.Vector4(1e9, 1e9, -10, 0) };

export function shakeAt(x, z, strength = 1) {
  sharedShake.value.set(x, z, sharedTime.value, strength);
}

// Empurradores (jogador, bichos, árvore caindo): a grama, as samambaias e os
// arbustos perto deles se curvam para o lado. (x, z, raio em metros, força 0..1)
export const MAX_PUSH = 8;
export const sharedPush = { value: Array.from({ length: MAX_PUSH }, () => new THREE.Vector4(0, 0, 0, 0)) };
export function setPushers(list) {
  const a = sharedPush.value;
  for (let i = 0; i < MAX_PUSH; i++) {
    const p = list[i];
    if (p) a[i].set(p.x, p.z, p.r, p.w ?? 1);
    else a[i].set(0, 0, 0, 0);
  }
}

// ----------------------------------------------------------
// Textura de ruído que se repete sem emenda
// ----------------------------------------------------------
function makeDetailTexture(size = 256) {
  const data = new Uint8Array(size * size * 4);
  const layers = [
    { cells: 8, amp: 0.45 },
    { cells: 16, amp: 0.25 },
    { cells: 32, amp: 0.18 },
    { cells: 64, amp: 0.12 },
  ];
  let seed = 12345;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const grids = layers.map((l) => {
    const g = new Float32Array(l.cells * l.cells);
    for (let i = 0; i < g.length; i++) g[i] = rnd();
    return g;
  });
  const smooth = (t) => t * t * (3 - 2 * t);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let v = 0;
      layers.forEach((l, li) => {
        const g = grids[li];
        const n = l.cells;
        const fx = (x / size) * n;
        const fy = (y / size) * n;
        const x0 = Math.floor(fx);
        const y0 = Math.floor(fy);
        const tx = smooth(fx - x0);
        const ty = smooth(fy - y0);
        const a = g[(y0 % n) * n + (x0 % n)];
        const b = g[(y0 % n) * n + ((x0 + 1) % n)];
        const c = g[((y0 + 1) % n) * n + (x0 % n)];
        const d = g[((y0 + 1) % n) * n + ((x0 + 1) % n)];
        v += l.amp * ((a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty);
      });
      const b = Math.max(0, Math.min(255, Math.round(v * 255)));
      const i = (y * size + x) * 4;
      data[i] = b;
      data[i + 1] = b;
      data[i + 2] = b;
      data[i + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

let detailTex = null;
export function detailTexture() {
  if (!detailTex) detailTex = makeDetailTexture();
  return detailTex;
}

// ----------------------------------------------------------
// Terreno
// ----------------------------------------------------------

// ----------------------------------------------------------
// TERRENO REALISTA: textura de terra, folhagem rasteira, rocha, neve e areia (estilo ARK)
// ----------------------------------------------------------
function loadTiled(url, srgb) {
  const tex = new THREE.TextureLoader().load(url);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function makeTerrainMaterialRealista() {
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  // Textura de terra (arquivo Soft Dirt): cor + relevo. A cor do bioma
  // continua mandando no brilho/tom; a terra dá os grãos, raízes e torrões.
  const hd = hdTextures();
  const dirtMap = loadTiled(hd ? TERRA_COR_HD : TERRA_COR, true);
  const dirtNormal = loadTiled(hd ? TERRA_RELEVO_HD : TERRA_RELEVO, false);
  const avg = new THREE.Color().setRGB(...TERRA_MEDIA, THREE.SRGBColorSpace);
  // neve (arquivo Snow Material) para a Lapônia
  const snowMap = loadTiled(hd ? NEVE_COR_HD : NEVE_COR, true);
  const snowNormal = loadTiled(hd ? NEVE_RELEVO_HD : NEVE_RELEVO, false);
  // rocha nevada (arquivo Snowy Rock PBR Material) nos paredões
  const rockMap = loadTiled(ROCHA_NEVADA, true);
  // folhagem rasteira no chão da floresta (arquivo Grass)
  const leafMap = loadTiled(FOLHAGEM_COR, true);
  rockMap.wrapS = THREE.MirroredRepeatWrapping;
  rockMap.wrapT = THREE.MirroredRepeatWrapping;
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.detailMap = { value: detailTexture() };
    shader.uniforms.dirtMap = { value: dirtMap };
    shader.uniforms.dirtNormal = { value: dirtNormal };
    shader.uniforms.dirtAvg = { value: new THREE.Vector3(avg.r, avg.g, avg.b) };
    shader.uniforms.snowMap = { value: snowMap };
    shader.uniforms.snowNormal = { value: snowNormal };
    shader.uniforms.rockMap = { value: rockMap };
    shader.uniforms.leafMap = { value: leafMap };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nattribute float aDirt;\nvarying float vDirt;\nattribute float aSnow;\nvarying float vSnow;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvDirt = aDirt;\nvSnow = aSnow;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vWPos;\nvarying float vDirt;\nuniform sampler2D detailMap;\nuniform sampler2D dirtMap;\nuniform sampler2D dirtNormal;\nuniform vec3 dirtAvg;\nvarying float vSnow;\nuniform sampler2D snowMap;\nuniform sampler2D snowNormal;\nuniform sampler2D rockMap;\nuniform sampler2D leafMap;
        vec4 hash4nt(vec2 p) { return fract(sin(vec4(1.0 + dot(p, vec2(37.0, 17.0)), 2.0 + dot(p, vec2(11.0, 47.0)), 3.0 + dot(p, vec2(41.0, 29.0)), 4.0 + dot(p, vec2(23.0, 31.0)))) * 103.0); }
        // textura SEM repetição visível: cada ladrilho sorteia um deslocamento e os 4 vizinhos se misturam
        vec3 texNoTile(sampler2D smp, vec2 uv) {
          vec2 iuv = floor(uv);
          vec2 f = fract(uv);
          vec2 ddx = dFdx(uv);
          vec2 ddy = dFdy(uv);
          vec3 res = vec3(0.0);
          float wsum = 0.0;
          for (int j = 0; j <= 1; j++) {
            for (int i = 0; i <= 1; i++) {
              vec2 g = vec2(float(i), float(j));
              vec4 o = hash4nt(iuv + g);
              vec2 r = g - f + o.xy;
              float w = exp(-6.0 * dot(r, r));
              res += w * textureGrad(smp, uv + o.zw, ddx, ddy).rgb;
              wsum += w;
            }
          }
          return res / wsum;
        }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float dNear = texture2D(detailMap, vWPos.xz * 0.23).r;
        float dFar = texture2D(detailMap, vWPos.xz * 0.019).r;
        float dMid = texture2D(detailMap, vWPos.zx * 0.071).r;
        float detail = dNear * 0.45 + dMid * 0.25 + dFar * 0.3;
        // manchinhas de folhas secas e terra
        float spots = smoothstep(0.55, 0.75, texture2D(detailMap, vWPos.xz * 0.43 + 0.37).r);
        diffuseColor.rgb *= mix(0.7, 1.28, detail);
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.25, 1.0, 0.7), spots * 0.35);
        if (vDirt > 0.01) {
          // 1 repetição a cada ~2,8 m, girada numa segunda escala para não "quadricular"
          vec2 uvA = vWPos.xz * 0.25;
          vec2 uvB = vec2(vWPos.z, -vWPos.x) * 0.11 + 0.31;
          vec3 dA = texNoTile(dirtMap, uvA);
          vec3 dB = texNoTile(dirtMap, uvB * 1.7);
          vec3 dc = mix(dA, dB, 0.35 * dFar);
          // relevo falso: o normal map clareia o lado virado para o sol
          vec3 nm = texNoTile(dirtNormal, uvA) * 2.0 - 1.0;
          float relief = 1.0 + dot(nm.xy, vec2(0.55, -0.45)) * 0.55;
          // padrão da terra com o brilho/tom do bioma
          float lumB = dot(diffuseColor.rgb, vec3(0.333));
          vec3 hueB = diffuseColor.rgb / max(lumB, 0.001);
          vec3 hueD = dirtAvg / dot(dirtAvg, vec3(0.333));
          vec3 pattern = dc / dirtAvg;
          vec3 soil = lumB * pattern * mix(hueD, hueB, 0.45) * relief;
          diffuseColor.rgb = mix(diffuseColor.rgb, soil, clamp(vDirt, 0.0, 1.0) * 0.9);
          // floresta: manchas de folhagem rasteira (textura Grass) por cima da terra
          if (vDirt > 0.9) {
            float patchN = texture2D(detailMap, vWPos.xz * 0.006 + 0.13).r * 0.6 + dMid * 0.4;
            float leafK = smoothstep(0.42, 0.62, patchN);
            vec3 lc = texNoTile(leafMap, vWPos.xz * 0.28) * 0.65 + texNoTile(leafMap, vWPos.zx * 0.083 + 0.4) * 0.35;
            diffuseColor.rgb = mix(diffuseColor.rgb, lc * 0.85 * relief, leafK * 0.85);
            // folhas secas coloridas no chão da mata (laranja, ferrugem e rosa), como no ARK
            float macro = texture2D(detailMap, vWPos.xz * 0.011 + 0.2).r * 0.6 + texture2D(detailMap, vWPos.zx * 0.027).r * 0.4;
            diffuseColor.rgb *= mix(vec3(0.82, 0.8, 0.78), vec3(1.2, 1.12, 1.0), macro);
            float lt = texture2D(detailMap, vWPos.xz * 0.9).r;
            float lt2 = texture2D(detailMap, vWPos.xz * 0.33 + 0.3).r;
            vec3 litter = mix(vec3(0.55, 0.24, 0.13), vec3(0.74, 0.5, 0.2), lt2);
            litter = mix(litter, vec3(0.6, 0.26, 0.36), step(0.78, lt) * 0.7);
            float lk = smoothstep(0.55, 0.7, lt) * (1.0 - leafK * 0.75) * (1.0 - smoothstep(14.0, 40.0, length(vViewPosition)) * 0.6);
            diffuseColor.rgb = mix(diffuseColor.rgb, litter * relief * 0.9, lk * 0.75);
            diffuseColor.rgb *= 1.22; // chão da mata mais claro (ARK)
          }
        }
        if (vDirt < -0.01) {
          // rocha da montanha: textura "por três lados" (funciona em paredão
          // vertical), com camadas, rachaduras e lascas
          vec3 fn = normalize(cross(dFdx(vWPos), dFdy(vWPos)));
          vec3 bw = pow(abs(fn), vec3(4.0));
          bw /= (bw.x + bw.y + bw.z);
          float r1 = texture2D(detailMap, vWPos.zy * 0.09).r * bw.x + texture2D(detailMap, vWPos.xz * 0.09).r * bw.y + texture2D(detailMap, vWPos.xy * 0.09).r * bw.z;
          float f1 = texture2D(detailMap, vWPos.zy * 0.55).r * bw.x + texture2D(detailMap, vWPos.xz * 0.55).r * bw.y + texture2D(detailMap, vWPos.xy * 0.55).r * bw.z;
          float big = texture2D(detailMap, vWPos.xz * 0.012 + vec2(0.0, vWPos.y * 0.01)).r;
          // camadas horizontais (estratos) bem marcadas nos paredões
          float strata = smoothstep(0.35, 0.65, 0.5 + 0.5 * sin(vWPos.y * 0.9 + r1 * 4.0 + big * 6.0));
          float vert = 1.0 - bw.y; // quanto é parede
          float rockK = mix(0.55, 1.4, r1) * mix(0.8, 1.15, f1) * mix(0.75, 1.15, big) * mix(1.0, mix(0.72, 1.12, strata), vert);
          diffuseColor.rgb *= rockK;
          // textura de rocha nevada do arquivo, projetada pelos três lados
          vec3 rt = texture2D(rockMap, vWPos.zy * 0.05).rgb * bw.x + texture2D(rockMap, vWPos.xz * 0.05).rgb * bw.y + texture2D(rockMap, vWPos.xy * 0.05).rgb * bw.z;
          diffuseColor.rgb = mix(diffuseColor.rgb, rt * mix(0.75, 1.1, r1), 0.55);
          // líquen/ferrugem em manchas
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.15, 1.0, 0.82), smoothstep(0.62, 0.8, f1) * 0.4);
        }
        if (vSnow > 0.01) {
          // neve: textura do arquivo em duas escalas + relevo falso
          vec2 su = vWPos.xz * 0.21;
          vec3 sc = texture2D(snowMap, su).rgb * 0.6 + texture2D(snowMap, vWPos.zx * 0.047 + 0.5).rgb * 0.4;
          vec3 sn = texture2D(snowNormal, su).xyz * 2.0 - 1.0;
          float srel = 1.0 + dot(sn.xy, vec2(0.5, -0.4)) * 0.35;
          vec3 snowCol = sc * 1.32 * srel;
          // borda da neve mais suja, sem corte reto
          float k = smoothstep(0.15, 0.75, vSnow + (dNear - 0.5) * 0.35);
          diffuseColor.rgb = mix(diffuseColor.rgb, snowCol, k);
        }
        // areia: ondulações do vento/maré, grão fino e faixa molhada perto da água.
        // sandGrad alimenta o relevo (mais abaixo, em normal_fragment_maps).
        float sandK = (1.0 - smoothstep(0.0, 0.35, abs(vDirt))) * (1.0 - smoothstep(0.0, 0.3, vSnow));
        float sandNear = 1.0 - smoothstep(22.0, 75.0, length(vViewPosition));
        vec2 sandGrad = vec2(0.0);
        if (sandK > 0.01) {
          vec2 sp = vWPos.xz;
          float sw = texture2D(detailMap, sp * 0.05).r;
          float sw2 = texture2D(detailMap, sp * 0.21).r;
          float a1 = dot(sp, vec2(0.83, 0.56)) * 4.2 + sw * 9.0;
          float a2 = dot(sp, vec2(-0.5, 0.86)) * 11.0 + sw2 * 7.0;
          float ripple = sin(a1) * 0.6 + sin(a2) * 0.4;
          float grain = texture2D(detailMap, sp * 1.9).r;
          float wet = 1.0 - smoothstep(0.1, 0.75, vWPos.y);
          diffuseColor.rgb *= 1.0 + sandK * sandNear * (ripple * 0.12 + (grain - 0.5) * 0.3);
          diffuseColor.rgb *= mix(1.0, 0.7, wet * sandK);
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.95, 0.97, 1.05), wet * sandK * 0.5);
          sandGrad = (cos(a1) * 0.6 * 4.2 * vec2(0.83, 0.56) + cos(a2) * 0.4 * 11.0 * vec2(-0.5, 0.86)) * 0.11 * sandNear;
        }`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        normal = normalize(normal + (viewMatrix * vec4(-sandGrad.x, 0.0, -sandGrad.y, 0.0)).xyz * sandK);`);
  };
  return mat;
}


// ----------------------------------------------------------
// TERRENO LOW-POLY (estilo Valheim)
// - Faces planas (flatShading): cada triângulo tem uma luz só.
// - Uma cor por face: o vértice "dono" do triângulo pinta a face toda
//   (variável "flat" no shader), sem degradê e sem textura.
// - Neve: onde aSnow passa de 0,45 a face fica com a cor de neve da paleta.
// As cores vêm de island_generator.js (_colorFor), que usa a paleta (core/paleta.js).
// ----------------------------------------------------------
export function makeTerrainMaterial() {
  if (REALISTA) return makeTerrainMaterialRealista();
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uSnowCol = { value: PALETA.neve.clone() };
    shader.vertexShader = shader.vertexShader
      .replace('#include <color_pars_vertex>', 'flat varying vec3 vColor;')
      .replace('#include <common>', '#include <common>\nattribute float aSnow;\nflat varying float vSnow;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSnow = aSnow;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <color_pars_fragment>', 'flat varying vec3 vColor;')
      .replace('#include <common>', '#include <common>\nflat varying float vSnow;\nuniform vec3 uSnowCol;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        // neve chapada (sem textura): a borda da neve segue as faces do terreno
        if (vSnow > 0.45) diffuseColor.rgb = uSnowCol;`);
  };
  mat.customProgramCacheKey = () => 'terreno-lowpoly1';
  return addRelief(mat, { amp: 0.16, freq: 0.9, fade: [45, 140] });
}


// ----------------------------------------------------------
// RELEVO procedural (chão, pedra, tronco): mexe na normal da superfície com um
// ruído em 3 lados (não estica nas paredes), então a luz do sol marca grãos,
// rachaduras e ondulações mesmo nas faces planas do estilo low-poly.
//   amp:  altura do relevo em metros   freq: tamanho dos grãos (1/m)
//   folha: true = o relevo some nas folhas (precisa do varying vFolha) – folha fica lisa
// Some com a distância (nada de tremer de longe).
// ----------------------------------------------------------
export function addRelief(material, { amp = 0.1, freq = 1.2, folha = 0, fade = [35, 110] } = {}) {
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    prev?.(shader, renderer);
    shader.uniforms.uReliefNoise = { value: detailTexture() };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vRelW;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vRelW = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
        #else
          vRelW = (modelMatrix * vec4(transformed, 1.0)).xyz;
        #endif`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vRelW;\nuniform sampler2D uReliefNoise;')
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        {
          vec3 rn = normalize(cross(dFdx(vRelW), dFdy(vRelW)));
          vec3 rb = pow(abs(rn), vec3(4.0));
          rb /= (rb.x + rb.y + rb.z);
          #define RTRI(s) (texture2D(uReliefNoise, vRelW.zy * s).r * rb.x + texture2D(uReliefNoise, vRelW.xz * s).r * rb.y + texture2D(uReliefNoise, vRelW.xy * s).r * rb.z)
          float rh = RTRI(${freq.toFixed(3)}) * 0.65 + RTRI(${(freq * 3.7).toFixed(3)}) * 0.35;
          #undef RTRI
          vec3 rsp = -vViewPosition;
          vec3 rdx = dFdx(rsp);
          vec3 rdy = dFdy(rsp);
          vec3 rr1 = cross(rdy, normal);
          vec3 rr2 = cross(normal, rdx);
          float rdet = dot(rdx, rr1);
          vec3 rgrad = sign(rdet) * (dFdx(rh) * rr1 + dFdy(rh) * rr2);
          float rk = ${amp.toFixed(3)} ${folha ? '* (1.0 - clamp(vFolha, 0.0, 1.0))' : ''} * (1.0 - smoothstep(${fade[0].toFixed(1)}, ${fade[1].toFixed(1)}, length(vViewPosition)));
          normal = normalize(abs(rdet) * normal - rk * rgrad);
        }`);
  };
  const k = material.customProgramCacheKey;
  material.customProgramCacheKey = () => `${k ? k.call(material) : ''}-relevo-${amp}-${freq}`;
  return material;
}

// ----------------------------------------------------------
// Vento na vegetação.
//   bend: quanto a planta inteira enverga (por metro de altura)
//   flutter: quanto as folhas tremulam (usa o atributo aWind:
//            0 = tronco, 1 = folha)
// O deslocamento é aplicado depois da posição de cada instância,
// então o vento sopra na mesma direção para todas as plantas.
// ----------------------------------------------------------
export function addWind(material, bend = 0.012, flutter = 0.05, push = 0) {
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    prev?.(shader, renderer);
    shader.uniforms.uTime = sharedTime;
    shader.uniforms.uShake = sharedShake;
    shader.uniforms.uPush = sharedPush;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        uniform float uTime;
        uniform vec4 uShake;
        uniform vec4 uPush[${MAX_PUSH}];
        attribute float aWind;`)
      .replace('#include <project_vertex>', `
        vec4 mvPosition = vec4(transformed, 1.0);
        vec3 ip = vec3(0.0);
        #ifdef USE_INSTANCING
          mvPosition = instanceMatrix * mvPosition;
          ip = instanceMatrix[3].xyz;
        #endif
        {
          float h = max(mvPosition.y - ip.y, 0.0);
          float ph = ip.x * 0.37 + ip.z * 0.23;
          float gust = 0.55 + 0.45 * sin(uTime * 0.31 + ip.x * 0.013 + ip.z * 0.007);
          float bendW = (sin(uTime * 1.05 + ph) * 0.6 + sin(uTime * 2.2 + ph * 1.7) * 0.25) * gust;
          float sway = bendW * ${bend.toFixed(4)} * h * h / (h + 5.0);
          float fl = sin(uTime * 6.5 + position.x * 2.3 + position.z * 1.9 + ph * 3.0) * aWind * ${flutter.toFixed(4)} * (0.5 + gust);
          // tremida da árvore atingida
          float sd = distance(ip.xz, uShake.xy);
          float st = uTime - uShake.z;
          float shake = (sd < 0.8 && st < 0.7) ? sin(st * 38.0) * (0.7 - st) * uShake.w * h * 0.02 : 0.0;
          mvPosition.x += sway + fl + shake;
          mvPosition.z += sway * 0.55 + fl * 0.8 + shake * 0.6;
          mvPosition.y += fl * 0.35;
          ${push > 0 ? `
          // quem passa empurra a planta baixa para o lado e a amassa um pouco
          float low = 1.0 - smoothstep(1.0, 2.4, h);
          for (int i = 0; i < ${MAX_PUSH}; i++) {
            vec4 pu = uPush[i];
            if (pu.w > 0.0) {
              vec2 dp = mvPosition.xz - pu.xy;
              float Ld = length(dp);
              float kk = 1.0 - smoothstep(0.0, pu.z, Ld);
              float amt = kk * kk * pu.w * aWind * low;
              vec2 dir = Ld > 0.001 ? dp / Ld : vec2(1.0, 0.0);
              mvPosition.xz += dir * amt * pu.z * ${(0.55 * push).toFixed(3)};
              mvPosition.y -= amt * ${(0.3 * push).toFixed(3)};
            }
          }` : ''}
        }
        mvPosition = modelViewMatrix * mvPosition;
        gl_Position = projectionMatrix * mvPosition;`);
  };
  material.customProgramCacheKey = () => `wind-${bend}-${flutter}-${push}`;
  return material;
}

// ----------------------------------------------------------
// Água com profundidade
// ----------------------------------------------------------
export function makeWaterMaterial({
  shallow, deep, foam = '#e8efe6', sky = '#bcd8e4', sunDir, map, level,
  opacityShallow = 0.35, opacityDeep = 0.93, deepAt = 6, waveHeight = 0.1,
  reflect = 0.65, foamAmount = 1, ring = [0, 1e9], zenith = '#5f95c4',
}) {
  const uniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      uShallow: { value: new THREE.Color(shallow) },
      uDeep: { value: new THREE.Color(deep) },
      uFoam: { value: new THREE.Color(foam) },
      uSky: { value: new THREE.Color(sky) },
      uSunColor: { value: new THREE.Color('#fff2d6') },
      uSunDir: { value: sunDir },
      uLevel: { value: level },
      uMapSize: { value: map.size },
      uMapHalf: { value: map.half },
      uOpS: { value: opacityShallow },
      uOpD: { value: opacityDeep },
      uDeepAt: { value: deepAt },
      uWave: { value: waveHeight },
      uReflect: { value: reflect },
      uFoamAmt: { value: foamAmount },
      uRing: { value: new THREE.Vector2(ring[0], ring[1]) },
      uZenith: { value: new THREE.Color(zenith) },
    },
  ]);
  uniforms.uTime = sharedTime;
  uniforms.uDay = sharedDay;
  uniforms.uHeight = { value: map.heightTexture() };
  uniforms.uNoise = { value: detailTexture() };
  return new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    fog: true,
    vertexShader: /* glsl */ `
      #include <common>
      #include <fog_pars_vertex>
      uniform float uTime;
      uniform float uWave;
      varying vec3 vWorld;
      varying float vCrest;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        // ondas: 2 grandes + 1 cruzada menor (mesma conta de WaterSystem.waveAt)
        float w = sin(wp.x * 0.09 + uTime * 1.1) + cos(wp.z * 0.08 + uTime * 0.85)
          + 0.45 * sin((wp.x + wp.z) * 0.16 + uTime * 1.7);
        wp.y += w * uWave;
        vCrest = w / 2.45; // -1..1: crista da onda
        vWorld = wp.xyz;
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <common>
      #include <fog_pars_fragment>
      uniform vec3 uShallow, uDeep, uFoam, uSky, uSunColor, uSunDir, uZenith;
      uniform float uLevel, uMapSize, uMapHalf, uOpS, uOpD, uDeepAt, uReflect, uTime, uFoamAmt, uDay, uWave;
      uniform vec2 uRing;
      uniform sampler2D uHeight;
      uniform sampler2D uNoise;
      varying vec3 vWorld;
      varying float vCrest;
      float nz(vec2 p) { return texture2D(uNoise, p).r; }
      void main() {
        vec2 p = vWorld.xz;
        // mar em 2 malhas: detalhada perto da câmera, simples longe
        float camD = length(p - cameraPosition.xz);
        if (camD < uRing.x || camD >= uRing.y) discard;
        float t = uTime;
        // profundidade: nível da água menos a altura do chão
        vec2 huv = (p + uMapHalf) / uMapSize;
        float ground = texture2D(uHeight, huv).r;
        float depth = max((uLevel < -999.0 ? vWorld.y : uLevel) - ground, 0.0);

        // ondinhas: duas camadas de ruído andando em direções diferentes
        vec2 uv1 = p * 0.055 + vec2(t * 0.018, t * 0.011);
        vec2 uv2 = p * 0.091 - vec2(t * 0.012, -t * 0.016);
        vec2 uv3 = p * 0.23 + vec2(-t * 0.035, t * 0.028); // marolinha fina
        float e = 0.004;
        float h1 = nz(uv1) + nz(uv2) + 0.5 * nz(uv3);
        float hx = nz(uv1 + vec2(e, 0.0)) + nz(uv2 + vec2(e, 0.0)) + 0.5 * nz(uv3 + vec2(e, 0.0));
        float hz = nz(uv1 + vec2(0.0, e)) + nz(uv2 + vec2(0.0, e)) + 0.5 * nz(uv3 + vec2(0.0, e));
        // longe a água fica mais lisa (sem chuvisco de pixels)
        float bump = 9.0 * (1.0 - smoothstep(60.0, 400.0, camD) * 0.7);
        vec3 n = normalize(vec3((h1 - hx) * bump, 1.0, (h1 - hz) * bump));
        if (!gl_FrontFacing) n = -n;

        vec3 V = normalize(cameraPosition - vWorld);
        float fres = 0.02 + 0.98 * pow(1.0 - clamp(abs(dot(n, V)), 0.0, 1.0), 5.0);
        float dk = smoothstep(0.0, uDeepAt, depth);
        vec3 col = mix(uShallow, uDeep, dk) * uDay;
        // luz passando pela crista da onda (verde-água mais claro)
        col += uShallow * uDay * smoothstep(0.35, 1.0, vCrest) * 0.35 * dk * step(0.001, uWave);
        // reflexo do céu: perto do horizonte claro, para cima azul
        vec3 Rv = reflect(-V, n);
        vec3 skyCol = mix(uSky, uZenith, smoothstep(0.0, 0.6, Rv.y)) * uDay;
        col = mix(col, skyCol, clamp(fres * uReflect * 1.15, 0.0, 0.75));
        vec3 R = reflect(-uSunDir, n);
        float s = max(dot(R, V), 0.0);
        col += uSunColor * (pow(s, 220.0) * 2.2 + pow(s, 24.0) * 0.12) * max(uDay, 0.35);

        // espuma na beira
        float foamLine = 1.0 - smoothstep(0.0, 0.5, depth);
        float foamNoise = smoothstep(0.45, 0.7, nz(p * 0.35 + vec2(t * 0.03, 0.0)) + 0.25 * sin(depth * 18.0 - t * 2.0));
        // espuma nas cristas das ondas do mar aberto (carneirinhos)
        float caps = smoothstep(0.78, 0.95, vCrest) * smoothstep(0.55, 0.75, nz(p * 0.12 + vec2(t * 0.02, -t * 0.015))) * step(0.001, uWave);
        float foam = (foamLine * foamNoise + caps * 0.7) * uFoamAmt;
        col = mix(col, uFoam * uDay, clamp(foam, 0.0, 0.85));

        float alpha = mix(uOpS, uOpD, dk) + fres * 0.2 + foam * 0.5;
        if (!gl_FrontFacing) alpha = 0.85;
        gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
}

// ----------------------------------------------------------
// Céu com nuvens
// ----------------------------------------------------------
export function makeSkyMaterial({ horizon, zenith, sunDir }) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uHorizon: { value: horizon },
      uZenith: { value: zenith },
      uSunDir: { value: sunDir },
      uSunColor: { value: new THREE.Color('#fff4dc') },
      uCloud: { value: 1 },
      uNight: { value: 0 },
      uNoise: { value: detailTexture() },
      uTime: sharedTime,
    },
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
    fog: false,
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uHorizon, uZenith, uSunDir, uSunColor;
      uniform sampler2D uNoise;
      uniform float uTime;
      uniform float uCloud;
      uniform float uNight;
      varying vec3 vDir;
      float hash3(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
      void main() {
        vec3 d = normalize(vDir);
        float y = d.y;
        float sd = max(dot(d, uSunDir), 0.0);
        float day = 1.0 - uNight;
        // degradê do céu: horizonte claro, azul mais fundo no alto
        vec3 col = mix(uHorizon, uZenith, pow(smoothstep(-0.02, 0.5, y), 0.7));
        // luz do sol espalhada no ar: halo largo e, perto do horizonte, brilho dourado em volta do sol
        float hz = 1.0 - smoothstep(0.0, 0.45, y);
        col += uSunColor * day * (pow(sd, 3.0) * 0.1 + pow(sd, 7.0) * hz * 0.5 + pow(sd, 28.0) * 0.32);
        // estrelas (só de noite, e só onde a nuvem deixa)
        float cl = 0.0;
        vec3 cloud = vec3(0.0);
        if (y > 0.0) {
          // nuvens cúmulos (como no ARK): bolos brancos bem definidos, barriga cinza-azulada
          // e borda prateada do lado do sol. O ruído é o mesmo do chão (sem textura nova).
          vec2 wind = vec2(uTime * 0.0025, uTime * 0.0012);
          vec2 uv = d.xz / (y + 0.1) * 0.16 + wind;
          float n1 = texture2D(uNoise, uv).r;
          float n2 = texture2D(uNoise, uv * 2.3 + 0.3).r;
          float n3 = texture2D(uNoise, uv * 5.3 + 0.7).r;
          float nn = n1 * 0.6 + n2 * 0.28 + n3 * 0.12;
          cl = smoothstep(0.48, 0.64, nn) * smoothstep(0.0, 0.16, y); // borda macia (nuvem de Valheim é suave)
          float dens = smoothstep(0.52, 0.78, nn);
          // luz por dentro da nuvem: compara com o ruído um pouco na direção do sol
          vec2 toSun = normalize(uSunDir.xz + 1e-4) * 0.035;
          float ns = texture2D(uNoise, uv + toSun).r * 0.6 + texture2D(uNoise, (uv + toSun) * 2.3 + 0.3).r * 0.28 + n3 * 0.12;
          float lit = clamp(0.62 + (nn - ns) * 5.0, 0.0, 1.0);
          vec3 shade = ${glsl(mistura('pedraClara', 'agua', 0.3))};
          cloud = mix(shade, ${glsl(PALETA.neve)} * 1.04, lit * (1.0 - dens * 0.45) + 0.18) + uSunColor * (pow(sd, 5.0) * 0.35 + pow(sd, 40.0) * 0.6) * (1.0 - dens * 0.5);
          cloud *= uCloud;
          vec3 st = d * 180.0;
          vec3 ip = floor(st);
          vec3 fp = fract(st) - 0.5;
          float h = hash3(ip);
          float tw = 0.55 + 0.45 * sin(uTime * (1.5 + h * 4.0) + h * 60.0);
          float star = step(0.982, h) * smoothstep(0.34, 0.0, length(fp)) * tw;
          float big = step(0.9975, hash3(ip + 7.0)) * smoothstep(0.45, 0.0, length(fp)) * 1.6;
          col += ${glsl(PALETA.neve)} * (star + big) * uNight * smoothstep(0.02, 0.3, y) * (1.0 - cl);
        }
        col = mix(col, cloud, cl * 0.92);
        // sol: disco forte com borda macia (valores acima de 1: estoura em branco com o tom do filme)
        float disc = smoothstep(0.99955, 0.99985, sd);
        col += uSunColor * day * (disc * 14.0 + pow(sd, 400.0) * 3.0 + pow(sd, 90.0) * 0.8);
        // lua: disco claro com halo fraco (a luz da noite vem da mesma direção)
        float md = sd;
        col += ${glsl(PALETA.neve)} * uNight * (smoothstep(0.9994, 0.99957, md) * 1.15 + pow(md, 260.0) * 0.2 + pow(md, 26.0) * 0.05);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

// ----------------------------------------------------------
// Impostor: retângulo que sempre vira para a câmera, com a "foto"
// da árvore. Usado para árvores longe.
// ----------------------------------------------------------
export function makeImpostorMaterial(texture) {
  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog]);
  uniforms.map = { value: texture };
  uniforms.uTime = sharedTime;
  uniforms.uDay = sharedDay;
  return new THREE.ShaderMaterial({
    uniforms,
    fog: true,
    vertexShader: /* glsl */ `
      #include <common>
      #include <fog_pars_vertex>
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vTint;
      void main() {
        vUv = uv;
        vec3 ip = instanceMatrix[3].xyz;
        float sx = length(instanceMatrix[0].xyz);
        float sy = length(instanceMatrix[1].xyz);
        vec3 toCam = cameraPosition - ip;
        toCam.y = 0.0;
        vec3 dir = normalize(toCam + vec3(1e-4, 0.0, 0.0));
        vec3 right = vec3(dir.z, 0.0, -dir.x);
        vec3 wp = ip + right * position.x * sx + vec3(0.0, position.y * sy, 0.0);
        wp.x += sin(uTime * 1.05 + ip.x * 0.37 + ip.z * 0.23) * 0.012 * position.y * sy;
        vTint = vec3(1.0);
        #ifdef USE_INSTANCING_COLOR
          vTint = instanceColor;
        #endif
        vec4 mvPosition = viewMatrix * vec4(wp, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <common>
      #include <fog_pars_fragment>
      uniform sampler2D map;
      uniform float uDay;
      varying vec2 vUv;
      varying vec3 vTint;
      void main() {
        vec4 c = texture2D(map, vUv);
        if (c.a < 0.45) discard;
        gl_FragColor = vec4(c.rgb * vTint * (0.12 + 0.88 * uDay), 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
}
