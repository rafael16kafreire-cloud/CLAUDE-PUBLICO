// =============================================================
// MATERIAIS – a "pintura" das superfícies
// - Terreno: cor do bioma + textura de detalhe gerada por código
//   (sem baixar imagens; leve para o celular).
// - Água: ondas, brilho do sol e reflexo do céu nas bordas.
// - Vento: grama e folhas balançando.
// =============================================================
import * as THREE from 'three';

// Tempo compartilhado pelos materiais animados (água e vento).
export const sharedTime = { value: 0 };

// ----------------------------------------------------------
// Textura de ruído que se repete sem emenda (para detalhe do chão)
// ----------------------------------------------------------
function makeDetailTexture(size = 256) {
  const data = new Uint8Array(size * size * 4);
  // ruído de valor com grade que "dá a volta" (repete sem emenda)
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
// Terreno: luz suave + detalhe em duas escalas (perto e longe)
// ----------------------------------------------------------
export function makeTerrainMaterial() {
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.detailMap = { value: detailTexture() };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nuniform sampler2D detailMap;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        float dNear = texture2D(detailMap, vWPos.xz * 0.21).r;
        float dFar = texture2D(detailMap, vWPos.xz * 0.019).r;
        float dMid = texture2D(detailMap, vWPos.zx * 0.067).r;
        float detail = dNear * 0.45 + dMid * 0.25 + dFar * 0.3;
        diffuseColor.rgb *= mix(0.72, 1.24, detail);`);
  };
  return mat;
}

// ----------------------------------------------------------
// Vento: balança os vértices de acordo com a altura (pé parado,
// topo mexendo). Funciona com objetos repetidos (instancing).
// ----------------------------------------------------------
export function addWind(material, strength = 0.12, heightScale = 1) {
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    prev?.(shader, renderer);
    shader.uniforms.uTime = sharedTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        {
          vec3 basePos = vec3(0.0);
          #ifdef USE_INSTANCING
            basePos = instanceMatrix[3].xyz;
          #endif
          float h = max(0.0, position.y) * ${heightScale.toFixed(3)};
          float w = sin(uTime * 1.7 + basePos.x * 0.35 + basePos.z * 0.27) * 0.6
                  + sin(uTime * 3.1 + basePos.x * 0.9) * 0.25;
          transformed.x += w * ${strength.toFixed(3)} * h;
          transformed.z += w * ${(strength * 0.6).toFixed(3)} * h;
        }`);
  };
  material.customProgramCacheKey = () => `wind-${strength}-${heightScale}`;
  return material;
}

// ----------------------------------------------------------
// Água
// ----------------------------------------------------------
export function makeWaterMaterial({ shallow, deep, opacity = 0.8, waveHeight = 0.12, sunDir, sky = '#bcd8e4', reflect = 0.7 }) {
  const uniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      uShallow: { value: new THREE.Color(shallow) },
      uDeep: { value: new THREE.Color(deep) },
      uSky: { value: new THREE.Color(sky) },
      uReflect: { value: reflect },
      uSunColor: { value: new THREE.Color('#fff2d6') },
      uSunDir: { value: sunDir.clone() },
      uOpacity: { value: opacity },
      uWave: { value: waveHeight },
    },
  ]);
  uniforms.uTime = sharedTime;
  return new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    side: THREE.DoubleSide,
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
      uniform vec3 uShallow;
      uniform vec3 uDeep;
      uniform vec3 uSky;
      uniform vec3 uSunColor;
      uniform vec3 uSunDir;
      uniform float uOpacity;
      uniform float uReflect;
      uniform float uTime;
      varying vec3 vWorld;
      void main() {
        vec2 p = vWorld.xz;
        float t = uTime;
        // inclinação das pequenas ondas (soma de senos em direções diferentes)
        vec2 g = vec2(0.0);
        g += vec2(0.55, 0.20) * cos(dot(p, vec2(0.55, 0.20)) * 1.0 + t * 1.6);
        g += vec2(-0.25, 0.60) * cos(dot(p, vec2(-0.25, 0.60)) * 1.3 + t * 1.9);
        g += vec2(0.80, -0.45) * cos(dot(p, vec2(0.80, -0.45)) * 2.1 + t * 2.4) * 0.5;
        g += vec2(-0.9, -0.3) * cos(dot(p, vec2(-0.9, -0.3)) * 3.7 + t * 3.1) * 0.25;
        vec3 n = normalize(vec3(-g.x * 0.18, 1.0, -g.y * 0.18));
        if (!gl_FrontFacing) n = -n;
        vec3 V = normalize(cameraPosition - vWorld);
        float fres = pow(1.0 - clamp(abs(dot(n, V)), 0.0, 1.0), 4.0);
        float dist = length(cameraPosition.xz - vWorld.xz);
        vec3 col = mix(uShallow, uDeep, smoothstep(0.0, 60.0, dist) * 0.6 + 0.2);
        col = mix(col, uSky, fres * uReflect);
        vec3 R = reflect(-uSunDir, n);
        float spec = pow(max(dot(R, V), 0.0), 120.0) * 1.6 + pow(max(dot(R, V), 0.0), 18.0) * 0.12;
        col += uSunColor * spec;
        gl_FragColor = vec4(col, clamp(uOpacity + fres * 0.25, 0.0, 1.0));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
}
