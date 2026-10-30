// =============================================================
// FERIDAS NOS BICHOS (como no ARK depois das brigas): conforme perdem vida, o corpo
// ganha manchas de sangue escuro e feridas abertas. É feito no desenho do próprio corpo:
// um ruído 3D na posição do modelo (por isso as manchas ficam no lugar mesmo com ele
// andando) escurece e avermelha o couro. Cada bicho ferido ganha uma cópia do material
// (só quando apanha pela primeira vez), com UM número (uWound, 0 a 1) que cresce com o dano.
// Sem objeto novo na cena: o custo é só umas contas no desenho.
// =============================================================
import * as THREE from 'three';

const KEY = 'feridas1';

function patch(mat, uni, freq) {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader, renderer) => {
    prev?.(shader, renderer);
    shader.uniforms.uWound = uni;
    shader.uniforms.uWFreq = freq;
    shader.vertexShader = shader.vertexShader
      .replace('void main() {', 'varying vec3 vWPos;\nvoid main() {')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n  vWPos = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', `uniform float uWound; uniform float uWFreq; varying vec3 vWPos;
        float wh(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
        float wn(vec3 p) {
          vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(mix(wh(i), wh(i + vec3(1,0,0)), f.x), mix(wh(i + vec3(0,1,0)), wh(i + vec3(1,1,0)), f.x), f.y),
                     mix(mix(wh(i + vec3(0,0,1)), wh(i + vec3(1,0,1)), f.x), mix(wh(i + vec3(0,1,1)), wh(i + vec3(1,1,1)), f.x), f.y), f.z);
        }
        void main() {`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        if (uWound > 0.01) {
          vec3 q = vWPos * uWFreq;
          float n = wn(q) * 0.65 + wn(q * 2.3 + 7.0) * 0.35;
          float thr = 1.0 - uWound * 0.5;                    // mais dano = manchas maiores
          float blot = smoothstep(thr, thr + 0.05, n);
          float core = smoothstep(thr + 0.1, thr + 0.16, n); // miolo da ferida: mais escuro
          vec3 blood = mix(vec3(0.42, 0.04, 0.03), vec3(0.17, 0.01, 0.01), core);
          diffuseColor.rgb = mix(diffuseColor.rgb, blood, blot * 0.88);
          diffuseColor.rgb *= 1.0 - 0.18 * uWound;           // couro um pouco mais sujo
        }`);
  };
  mat.customProgramCacheKey = () => `${mat.customProgramCacheKey ? 'x' : ''}${KEY}`;
}

// frac = quanto da vida já perdeu (0 a 1). Chamar ao apanhar (e ao curar, se quiser).
export function aplicarFeridas(c, frac) {
  const mesh = c.mesh;
  if (!mesh?.material) return;
  const w = Math.max(0, Math.min(1, (frac - 0.1) / 0.8)); // até 10% de dano: sem marca
  if (!c._ferida) {
    if (w <= 0) return;
    const bb = mesh.geometry.boundingBox;
    const maxDim = bb ? Math.max(bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z) : 2;
    const uni = { value: 0 };
    const freq = { value: 7 / Math.max(0.5, maxDim) }; // ~7 manchas ao longo do corpo
    const clone = (m) => {
      const n = m.clone();
      patch(n, uni, freq);
      n.needsUpdate = true;
      return n;
    };
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(clone) : clone(mesh.material);
    c._ferida = uni;
  }
  c._ferida.value = w;
}
