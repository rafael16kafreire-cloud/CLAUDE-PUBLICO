// =============================================================
// ROCHEDOS EM CAMADAS – blocos grandes de pedra escura em lajes
// empilhadas (rocha sedimentar), com faces retas, paredes com
// estratos e o topo com musgo/capim. São os paredões e pedregulhos
// que aparecem por toda a ilha (praia, campo e mata), no estilo
// das ilhas tropicais do ARK. Modelo e desenho feitos aqui (original).
// Tamanho do modelo: base com raio ~0,65 e altura 1 (a escala da
// vegetação estica para 3 a 12 metros).
// =============================================================
import * as THREE from 'three';
import { addWind, detailTexture } from './materials.js';

function rnd(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const CINZA = [new THREE.Color('#8f8f8b'), new THREE.Color('#7d7e7c'), new THREE.Color('#9a9893'), new THREE.Color('#858683')];
const TOPO_PEDRA = new THREE.Color('#a6a59e');
const TOPO_MUSGO = new THREE.Color('#6a7f38');

/**
 * variante: muda o formato (0..n). low: versão leve para média distância.
 * Devolve geometria sem índice com faces retas (luz "facetada"), cor por vértice e aWind = 0.
 */
export function makeLayeredRock(variante = 0, low = false) {
  const r = rnd(7919 * (variante + 1));
  const pos = [];
  const col = [];
  const lados = low ? 6 : 9;
  const camadas = low ? 3 : 3 + Math.floor(r() * 3);
  // perfil de cada camada: raio por ângulo (irregular), centro um pouco deslocado
  let y = -0.35;
  let R = 1.0;
  let cx = 0;
  let cz = 0;
  const forma = Array.from({ length: lados }, () => 0.72 + r() * 0.4);
  const tri = (a, b, c, cor) => {
    pos.push(...a, ...b, ...c);
    col.push(cor.r, cor.g, cor.b, cor.r, cor.g, cor.b, cor.r, cor.g, cor.b);
  };
  const quad = (a, b, c, d, cor) => {
    tri(a, b, c, cor);
    tri(a, c, d, cor);
  };
  for (let k = 0; k < camadas; k++) {
    const ultima = k === camadas - 1;
    const h = (k === 0 ? 0.75 : 0.32 + r() * 0.22) * (ultima ? 1.15 : 1);
    const y0 = y;
    const y1 = y + h;
    const ym = y0 + h * (0.45 + r() * 0.2);
    // anéis: base, barriga (um pouco para fora: aresta), topo (para dentro: o degrau da laje)
    const anel = (rr, yy, jit) =>
      forma.map((f, i) => {
        const a = (i / lados) * Math.PI * 2 + (k * 0.37);
        const rad = rr * f * (1 + (r() - 0.5) * jit);
        return [cx + Math.cos(a) * rad, yy, cz + Math.sin(a) * rad];
      });
    const base = anel(R, y0, 0.08);
    const meio = anel(R * 1.04, ym, 0.1);
    const topo = anel(R * (0.9 + r() * 0.06), y1, 0.1);
    const cor = CINZA[(k + variante) % CINZA.length].clone().multiplyScalar(0.92 + r() * 0.16);
    for (let i = 0; i < lados; i++) {
      const j = (i + 1) % lados;
      quad(base[i], base[j], meio[j], meio[i], cor);
      quad(meio[i], meio[j], topo[j], topo[i], cor.clone().multiplyScalar(1.05));
    }
    // tampa da laje (leque): no topo da pilha, musgo/capim; nas outras, pedra mais clara (degrau)
    const centro = [cx + (r() - 0.5) * 0.05, y1 + (ultima ? 0.04 : 0), cz + (r() - 0.5) * 0.05];
    const topoCor = (ultima && r() < 0.75 ? TOPO_MUSGO : TOPO_PEDRA).clone().multiplyScalar(0.9 + r() * 0.2);
    for (let i = 0; i < lados; i++) tri(topo[(i + 1) % lados], topo[i], centro, topoCor);
    // próxima laje: menor, deslocada e girada (forma de degrau irregular)
    y = y1 - 0.015;
    R *= 0.74 + r() * 0.16;
    cx += (r() - 0.5) * 0.35 * R;
    cz += (r() - 0.5) * 0.35 * R;
    for (let i = 0; i < lados; i++) forma[i] = forma[i] * 0.6 + (0.72 + r() * 0.4) * 0.4;
  }
  // normaliza a altura para ~1 (o pé fica 0,35 enterrado)
  let topY = 0;
  for (let i = 1; i < pos.length; i += 3) topY = Math.max(topY, pos[i]);
  const k = 1 / Math.max(0.3, topY);
  for (let i = 0; i < pos.length; i += 3) {
    pos[i] *= 0.62;
    pos[i + 1] *= k;
    pos[i + 2] *= 0.62;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals(); // sem índice: cada face com a sua normal (facetado)
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((pos.length / 3) * 2), 2));
  g.setAttribute('aWind', new THREE.Float32BufferAttribute(new Float32Array(pos.length / 3), 1));
  g.computeBoundingSphere();
  return g;
}

let matRocha = null;
/** Material da pedra: cor por vértice + grão e rachaduras "de três lados" (não estica nas paredes). */
export function layeredRockMaterial() {
  if (matRocha) return matRocha;
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uRockNoise = { value: detailTexture() };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vRW;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vRW = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
        #else
          vRW = (modelMatrix * vec4(transformed, 1.0)).xyz;
        #endif`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vRW;\nuniform sampler2D uRockNoise;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          vec3 fn = normalize(cross(dFdx(vRW), dFdy(vRW)));
          vec3 bw = pow(abs(fn), vec3(4.0));
          bw /= (bw.x + bw.y + bw.z);
          #define TRI(s) (texture2D(uRockNoise, vRW.zy * s).r * bw.x + texture2D(uRockNoise, vRW.xz * s).r * bw.y + texture2D(uRockNoise, vRW.xy * s).r * bw.z)
          float n1 = TRI(0.21);
          float n2 = TRI(0.83);
          float n3 = TRI(0.05);
          diffuseColor.rgb *= mix(0.62, 1.25, n1 * 0.5 + n2 * 0.3 + n3 * 0.2);
          // estratos finos e rachaduras escuras nas paredes
          float wall = 1.0 - bw.y;
          float st = smoothstep(0.82, 1.0, sin(vRW.y * 6.0 + n1 * 4.0));
          float crack = smoothstep(0.66, 0.72, n2) * (1.0 - smoothstep(0.72, 0.8, n2));
          diffuseColor.rgb *= 1.0 - (st * 0.22 + crack * 0.35) * wall;
          // musgo escorrendo das bordas de cima (só onde a cor já é verde: topo com capim)
          float greenTop = step(diffuseColor.g, diffuseColor.r * 1.02) < 0.5 ? 1.0 : 0.0;
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.92, 1.05, 0.7), greenTop * n2 * 0.4);
          #undef TRI
        }`);
  };
  addWind(mat, 0, 0);
  mat.customProgramCacheKey = () => 'rocha-camadas1';
  matRocha = mat;
  return mat;
}
