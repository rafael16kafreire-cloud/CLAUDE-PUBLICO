// =============================================================
// PEDRAS NO ESTILO DO ARK
// Rochas anguladas e cinzentas, de faces planas, com manchas de ferrugem, veios claros,
// líquen e rachaduras. A forma sai de uma esfera cortada por vários planos (cada pedra é
// diferente) e a textura é desenhada na hora e projetada "por três lados" no mundo
// (não estica nas paredes e não se repete igual em cada pedra).
// =============================================================
import * as THREE from 'three';
import { addRelief } from './materials.js';

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

// Rocha: esfera cortada por planos. alt = altura relativa, musgo = cor de musgo no topo
export function makeRockArk({ seed = 1, low = false, achata = 0.8, cortes = 11, esticar = 1.15 } = {}) {
  const r = rng(seed * 977 + 13);
  const g = new THREE.IcosahedronGeometry(1, low ? 2 : 4);
  const planos = [];
  for (let k = 0; k < cortes; k++) {
    const n = new THREE.Vector3(r() * 2 - 1, (r() * 2 - 1) * 0.8 + (k < 3 ? 0.9 : 0), r() * 2 - 1).normalize();
    planos.push({ n, d: 0.58 + r() * 0.26 });
  }
  const pos = g.attributes.position;
  const p = new THREE.Vector3();
  const e = esticar;
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    for (const pl of planos) {
      const dist = p.dot(pl.n) - pl.d;
      if (dist > 0) p.addScaledVector(pl.n, -dist); // achata contra o plano: faceta
    }
    // pequenas irregularidades (iguais para pontos iguais)
    const h = Math.sin(p.x * 12.9 + p.y * 7.3 + p.z * 4.1 + seed) * 43758.5453;
    const n1 = (h - Math.floor(h)) - 0.5;
    p.multiplyScalar(1 + n1 * 0.03);
    pos.setXYZ(i, p.x * e, p.y * achata, p.z / e);
  }
  // base reta e levemente afundada no chão (a pedra assenta)
  g.computeBoundingBox();
  const minY = g.boundingBox.min.y;
  for (let i = 0; i < pos.count; i++) pos.setY(i, Math.max(pos.getY(i), minY * 0.62) - minY * 0.62);
  g.computeVertexNormals();
  // cor por vértice: mais escura embaixo e nas partes viradas para baixo, mais clara no topo
  const col = new Float32Array(pos.count * 3);
  const nrm = g.attributes.normal;
  g.computeBoundingBox();
  const H = g.boundingBox.max.y || 1;
  for (let i = 0; i < pos.count; i++) {
    const t = pos.getY(i) / H;
    const up = nrm.getY(i);
    const v = 0.62 + 0.38 * t + 0.16 * up;
    col[i * 3] = v;
    col[i * 3 + 1] = v;
    col[i * 3 + 2] = v * 0.98;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const uv = new Float32Array(pos.count * 2).fill(0.5);
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setAttribute('aWind', new THREE.BufferAttribute(new Float32Array(pos.count), 1));
  return g;
}

function texRocha() {
  const N = 512;
  const c = document.createElement('canvas');
  c.width = N;
  c.height = N;
  const g = c.getContext('2d');
  const r = rng(77);
  // base cinza com nuvens claras e escuras
  g.fillStyle = '#6f7074';
  g.fillRect(0, 0, N, N);
  for (let i = 0; i < 90; i++) {
    const x = r() * N;
    const y = r() * N;
    const R = 20 + r() * 90;
    const gr = g.createRadialGradient(x, y, 0, x, y, R);
    const v = r() < 0.5 ? '40,42,48' : '150,150,154';
    gr.addColorStop(0, `rgba(${v},0.5)`);
    gr.addColorStop(1, `rgba(${v},0)`);
    g.fillStyle = gr;
    g.fillRect(x - R, y - R, R * 2, R * 2);
  }
  // ferrugem laranja em faixas (escorrida)
  for (let i = 0; i < 14; i++) {
    const x = r() * N;
    const y = r() * N;
    const gr = g.createLinearGradient(x, y, x + (r() - 0.5) * 40, y + 90 + r() * 120);
    gr.addColorStop(0, 'rgba(176,96,40,0.55)');
    gr.addColorStop(1, 'rgba(176,96,40,0)');
    g.fillStyle = gr;
    g.fillRect(x - 10 - r() * 20, y, 20 + r() * 40, 220);
  }
  // veios claros (quartzo) e rachaduras escuras
  for (let i = 0; i < 26; i++) {
    g.strokeStyle = i % 3 ? 'rgba(236,236,230,0.55)' : 'rgba(24,24,28,0.6)';
    g.lineWidth = 1 + r() * 2.5;
    g.beginPath();
    let x = r() * N;
    let y = r() * N;
    g.moveTo(x, y);
    for (let k = 0; k < 6; k++) {
      x += (r() - 0.5) * 90;
      y += (r() - 0.2) * 70;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  // líquen e pontinhos claros
  for (let i = 0; i < 700; i++) {
    const x = r() * N;
    const y = r() * N;
    g.fillStyle = r() < 0.7 ? `rgba(220,220,214,${0.2 + r() * 0.4})` : `rgba(120,140,70,${0.2 + r() * 0.3})`;
    g.beginPath();
    g.arc(x, y, 1 + r() * 3.5, 0, 7);
    g.fill();
  }
  for (let i = 0; i < 2500; i++) { // grão
    const v = 40 + r() * 140;
    g.fillStyle = `rgba(${v},${v},${v},0.25)`;
    g.fillRect(r() * N, r() * N, 1, 1 + r() * 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

let mat = null;
export function matRochaArk() {
  if (mat) return mat;
  const m = new THREE.MeshLambertMaterial({ vertexColors: true });
  const tex = texRocha();
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uRocha = { value: tex };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vRkW;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vRkW = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
        #else
          vRkW = (modelMatrix * vec4(transformed, 1.0)).xyz;
        #endif`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vRkW;\nuniform sampler2D uRocha;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          vec3 fn = normalize(cross(dFdx(vRkW), dFdy(vRkW)));
          vec3 bw = pow(abs(fn), vec3(4.0));
          bw /= (bw.x + bw.y + bw.z);
          #define RK(s, o) (texture2D(uRocha, vRkW.zy * s + o).rgb * bw.x + texture2D(uRocha, vRkW.xz * s + o).rgb * bw.y + texture2D(uRocha, vRkW.xy * s + o).rgb * bw.z)
          vec3 t1 = RK(0.16, vec2(0.0));
          vec3 t2 = RK(0.53, vec2(0.37, 0.61));
          #undef RK
          // duas escalas misturadas: a repetição some
          vec3 rock = t1 * 0.68 + t2 * 0.5;
          diffuseColor.rgb *= rock * 1.55;
        }`);
  };
  addRelief(m, { amp: 0.09, freq: 0.9, fade: [25, 90] });
  const k = m.customProgramCacheKey;
  m.customProgramCacheKey = () => `${k ? k.call(m) : ''}-rochaark1`;
  mat = m;
  return m;
}
