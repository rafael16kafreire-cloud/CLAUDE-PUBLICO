// =============================================================
// CORES DOS BICHOS – cada bicho selvagem nasce com uma combinação de
// cores própria (costas e barriga), como acontece no ARK: a maioria
// tem tons naturais (marrom, verde, cinza, areia) e alguns saem com
// cor forte (vermelho, azul-turquesa, roxo, laranja, preto).
// Feito no desenho do corpo: a cor nova troca o tom mas mantém o
// claro/escuro da pele (escamas, listras e relevo continuam).
// Cada bicho colorido ganha uma cópia do material com 3 números.
// O filhote herda cada região do pai ou da mãe.
// =============================================================
import * as THREE from 'three';

// [costas, barriga] em hex
const NATURAL = [
  ['#6b5232', '#c9b48a'], // marrom e creme
  ['#4f5a2c', '#b8b083'], // verde-oliva
  ['#5d5d58', '#b9b4a6'], // cinza
  ['#8a6a3c', '#e0cfa2'], // areia
  ['#3f4a33', '#9a9a78'], // verde-escuro
  ['#7a4a2a', '#d0b08a'], // ferrugem
  ['#4a3c30', '#a89880'], // chocolate
  ['#6e6a4a', '#d6ceaa'], // pardo
];
const VIVA = [
  ['#8e2418', '#d8a070'], // vermelho
  ['#1f6f78', '#a8d0c4'], // azul-turquesa
  ['#5a2f7a', '#c0a8d0'], // roxo
  ['#b0581a', '#ecc690'], // laranja
  ['#26262a', '#6e6a66'], // preto
  ['#2a4c8a', '#b8c4d8'], // azul
  ['#3d6e2a', '#d6d07a'], // verde-folha com barriga amarela
  ['#d8d2c4', '#f4efe4'], // quase branco
  ['#7a1c3a', '#d89ab0'], // vinho
];

const LUM = new THREE.Vector3(0.2126, 0.7152, 0.0722);
const _c = new THREE.Color();

// hex -> [r, g, b (tom com luminância 1), brilho relativo]
function tom(hex) {
  _c.set(hex); // vira linear
  const l = Math.max(0.004, _c.r * LUM.x + _c.g * LUM.y + _c.b * LUM.z);
  return [_c.r / l, _c.g / l, _c.b / l, Math.min(2.4, Math.max(0.25, Math.pow(l / 0.12, 0.5)))];
}

/** Sorteia as cores de um bicho selvagem. rand() = 0..1. Devolve null (cor original) ou {a, b, k}. */
export function sortearCor(rand) {
  const r = rand();
  if (r < 0.3) return null; // ~30% com a cor original do modelo
  const viva = r > 0.82;
  const lista = viva ? VIVA : NATURAL;
  const par = lista[Math.floor(rand() * lista.length)];
  // às vezes a barriga vem de outra combinação (mistura de regiões, como no ARK)
  const outra = rand() < 0.25 ? lista[Math.floor(rand() * lista.length)] : par;
  return { a: par[0], b: outra[1], k: +(viva ? 0.78 + rand() * 0.14 : 0.5 + rand() * 0.25).toFixed(2) };
}

/** Filhote: cada região vem do pai ou da mãe. */
export function herdarCor(mae, pai, rand) {
  const m = mae ?? null;
  const p = pai ?? null;
  if (!m && !p) return null;
  if (!m || !p) return rand() < 0.5 ? (m ?? p) : null;
  return { a: (rand() < 0.5 ? m : p).a, b: (rand() < 0.5 ? m : p).b, k: rand() < 0.5 ? m.k : p.k };
}

// material.clone() do three NÃO copia o onBeforeCompile (o desenho da pele, as feridas...): copia à mão
export function clonarMaterial(m) {
  const n = m.clone();
  n.onBeforeCompile = m.onBeforeCompile;
  n.customProgramCacheKey = m.customProgramCacheKey;
  return n;
}

function patch(mat, uni) {
  const prev = mat.onBeforeCompile;
  const prevKey = mat.customProgramCacheKey;
  mat.onBeforeCompile = function (shader, renderer) {
    prev?.call(this, shader, renderer);
    shader.uniforms.uCorA = uni.a;
    shader.uniforms.uCorB = uni.b;
    shader.uniforms.uCorK = uni.k;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCorN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCorN = normal;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCorN;\nuniform vec4 uCorA;\nuniform vec4 uCorB;\nuniform float uCorK;')
      .replace('#include <alphamap_fragment>', `{
          // costas (normal para cima) x barriga, com uma faixa macia no meio
          float costas = smoothstep(-0.3, 0.4, normalize(vCorN).y);
          vec4 tc = mix(uCorB, uCorA, costas);
          float l = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
          diffuseColor.rgb = mix(diffuseColor.rgb, tc.rgb * l * tc.a, uCorK);
        }
        #include <alphamap_fragment>`);
  };
  mat.customProgramCacheKey = function () {
    return `${prevKey ? prevKey.call(this) : ''}|cor1`;
  };
}

/** Aplica (ou troca) as cores de um bicho. cor = resultado de sortearCor/herdarCor (null = original). */
export function aplicarCor(c, cor) {
  c.cor = cor ?? null;
  const mesh = c.mesh;
  if (!mesh?.material) return;
  if (!c._cor) {
    if (!cor) return;
    const uni = { a: { value: new THREE.Vector4() }, b: { value: new THREE.Vector4() }, k: { value: 0 } };
    const sela = mesh.userData.selaIdx ?? -1;
    const clone = (m, i) => {
      if (i === sela) return m; // a sela embutida fica com a cor dela
      const n = clonarMaterial(m);
      patch(n, uni);
      n.needsUpdate = true;
      return n;
    };
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(clone) : clone(mesh.material, 0);
    c._cor = uni;
  }
  if (!cor) {
    c._cor.k.value = 0;
    return;
  }
  c._cor.a.value.set(...tom(cor.a));
  c._cor.b.value.set(...tom(cor.b));
  c._cor.k.value = cor.k ?? 0.7;
}
