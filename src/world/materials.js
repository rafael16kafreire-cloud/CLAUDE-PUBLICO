// =============================================================
// MATERIAIS – a "pintura" das superfícies
// - Terreno: cor do bioma + textura de detalhe gerada por código.
// - Vegetação: vento (a planta enverga e as folhas tremulam) e
//   tremida quando você bate numa árvore.
// - Água: sabe a profundidade (clara e com espuma na beira,
//   escura no fundo), ondulação e reflexo do céu e do sol.
// - Céu: degradê, brilho do sol e nuvens que andam.
// - Impostor: árvore distante desenhada como "foto" (bem leve).
// =============================================================
import * as THREE from 'three';
import { TERRA_COR, TERRA_RELEVO, TERRA_MEDIA } from './textures/terra.js';
import { NEVE_COR, NEVE_RELEVO } from './textures/neve.js';

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
function loadTiled(url, srgb) {
  const tex = new THREE.TextureLoader().load(url);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function makeTerrainMaterial() {
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  // Textura de terra (arquivo Soft Dirt): cor + relevo. A cor do bioma
  // continua mandando no brilho/tom; a terra dá os grãos, raízes e torrões.
  const dirtMap = loadTiled(TERRA_COR, true);
  const dirtNormal = loadTiled(TERRA_RELEVO, false);
  const avg = new THREE.Color().setRGB(...TERRA_MEDIA, THREE.SRGBColorSpace);
  // neve (arquivo Snow Material) para a Lapônia
  const snowMap = loadTiled(NEVE_COR, true);
  const snowNormal = loadTiled(NEVE_RELEVO, false);
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.detailMap = { value: detailTexture() };
    shader.uniforms.dirtMap = { value: dirtMap };
    shader.uniforms.dirtNormal = { value: dirtNormal };
    shader.uniforms.dirtAvg = { value: new THREE.Vector3(avg.r, avg.g, avg.b) };
    shader.uniforms.snowMap = { value: snowMap };
    shader.uniforms.snowNormal = { value: snowNormal };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nattribute float aDirt;\nvarying float vDirt;\nattribute float aSnow;\nvarying float vSnow;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvDirt = aDirt;\nvSnow = aSnow;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nvarying float vDirt;\nuniform sampler2D detailMap;\nuniform sampler2D dirtMap;\nuniform sampler2D dirtNormal;\nuniform vec3 dirtAvg;\nvarying float vSnow;\nuniform sampler2D snowMap;\nuniform sampler2D snowNormal;')
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
          vec2 uvA = vWPos.xz * 0.36;
          vec2 uvB = vec2(vWPos.z, -vWPos.x) * 0.11 + 0.31;
          vec3 dA = texture2D(dirtMap, uvA).rgb;
          vec3 dB = texture2D(dirtMap, uvB).rgb;
          vec3 dc = mix(dA, dB, 0.35 * dFar);
          // relevo falso: o normal map clareia o lado virado para o sol
          vec3 nm = texture2D(dirtNormal, uvA).xyz * 2.0 - 1.0;
          float relief = 1.0 + dot(nm.xy, vec2(0.55, -0.45)) * 0.55;
          // padrão da terra com o brilho/tom do bioma
          float lumB = dot(diffuseColor.rgb, vec3(0.333));
          vec3 hueB = diffuseColor.rgb / max(lumB, 0.001);
          vec3 hueD = dirtAvg / dot(dirtAvg, vec3(0.333));
          vec3 pattern = dc / dirtAvg;
          vec3 soil = lumB * pattern * mix(hueD, hueB, 0.45) * relief;
          diffuseColor.rgb = mix(diffuseColor.rgb, soil, clamp(vDirt, 0.0, 1.0) * 0.9);
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
        }`);
  };
  return mat;
}

// ----------------------------------------------------------
// Vento na vegetação.
//   bend: quanto a planta inteira enverga (por metro de altura)
//   flutter: quanto as folhas tremulam (usa o atributo aWind:
//            0 = tronco, 1 = folha)
// O deslocamento é aplicado depois da posição de cada instância,
// então o vento sopra na mesma direção para todas as plantas.
// ----------------------------------------------------------
export function addWind(material, bend = 0.012, flutter = 0.05) {
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    prev?.(shader, renderer);
    shader.uniforms.uTime = sharedTime;
    shader.uniforms.uShake = sharedShake;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        uniform float uTime;
        uniform vec4 uShake;
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
        }
        mvPosition = modelViewMatrix * mvPosition;
        gl_Position = projectionMatrix * mvPosition;`);
  };
  material.customProgramCacheKey = () => `wind-${bend}-${flutter}`;
  return material;
}

// ----------------------------------------------------------
// Água com profundidade
// ----------------------------------------------------------
export function makeWaterMaterial({
  shallow, deep, foam = '#e8efe6', sky = '#bcd8e4', sunDir, map, level,
  opacityShallow = 0.35, opacityDeep = 0.93, deepAt = 6, waveHeight = 0.1,
  reflect = 0.65, foamAmount = 1,
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
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        wp.y += (sin(wp.x * 0.09 + uTime * 1.1) + cos(wp.z * 0.08 + uTime * 0.85)) * uWave;
        vWorld = wp.xyz;
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <common>
      #include <fog_pars_fragment>
      uniform vec3 uShallow, uDeep, uFoam, uSky, uSunColor, uSunDir;
      uniform float uLevel, uMapSize, uMapHalf, uOpS, uOpD, uDeepAt, uReflect, uTime, uFoamAmt, uDay;
      uniform sampler2D uHeight;
      uniform sampler2D uNoise;
      varying vec3 vWorld;
      float nz(vec2 p) { return texture2D(uNoise, p).r; }
      void main() {
        vec2 p = vWorld.xz;
        float t = uTime;
        // profundidade: nível da água menos a altura do chão
        vec2 huv = (p + uMapHalf) / uMapSize;
        float ground = texture2D(uHeight, huv).r;
        float depth = max(uLevel - ground, 0.0);

        // ondinhas: duas camadas de ruído andando em direções diferentes
        vec2 uv1 = p * 0.055 + vec2(t * 0.018, t * 0.011);
        vec2 uv2 = p * 0.091 - vec2(t * 0.012, -t * 0.016);
        float e = 0.004;
        float h1 = nz(uv1) + nz(uv2);
        float hx = nz(uv1 + vec2(e, 0.0)) + nz(uv2 + vec2(e, 0.0));
        float hz = nz(uv1 + vec2(0.0, e)) + nz(uv2 + vec2(0.0, e));
        vec3 n = normalize(vec3((h1 - hx) * 9.0, 1.0, (h1 - hz) * 9.0));
        if (!gl_FrontFacing) n = -n;

        vec3 V = normalize(cameraPosition - vWorld);
        float fres = pow(1.0 - clamp(abs(dot(n, V)), 0.0, 1.0), 4.0);
        float dk = smoothstep(0.0, uDeepAt, depth);
        vec3 col = mix(uShallow, uDeep, dk) * uDay;
        col = mix(col, uSky * uDay, fres * uReflect);
        vec3 R = reflect(-uSunDir, n);
        float s = max(dot(R, V), 0.0);
        col += uSunColor * (pow(s, 160.0) * 1.8 + pow(s, 20.0) * 0.1) * max(uDay, 0.35);

        // espuma na beira
        float foamLine = 1.0 - smoothstep(0.0, 0.5, depth);
        float foamNoise = smoothstep(0.45, 0.7, nz(p * 0.35 + vec2(t * 0.03, 0.0)) + 0.25 * sin(depth * 18.0 - t * 2.0));
        float foam = foamLine * foamNoise * uFoamAmt;
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
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        float y = d.y;
        vec3 col = mix(uHorizon, uZenith, smoothstep(0.0, 0.55, y));
        float sd = max(dot(d, uSunDir), 0.0);
        if (y > 0.0) {
          vec2 uv = d.xz / (y + 0.12) * 0.22 + vec2(uTime * 0.0025, uTime * 0.0012);
          float nn = texture2D(uNoise, uv).r * 0.65 + texture2D(uNoise, uv * 2.7 + 0.3).r * 0.35;
          float cl = smoothstep(0.48, 0.72, nn) * smoothstep(0.0, 0.22, y);
          vec3 cloud = (mix(vec3(0.78, 0.8, 0.82), vec3(1.0), smoothstep(0.5, 0.8, nn)) + uSunColor * pow(sd, 6.0) * 0.25) * uCloud;
          col = mix(col, cloud, cl * 0.9);
        }
        col += uSunColor * (pow(sd, 900.0) * 6.0 + pow(sd, 16.0) * 0.22);
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
