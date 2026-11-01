// =============================================================
// CORES DOS BICHOS – cada bicho selvagem nasce com uma combinação de
// cores própria (costas e barriga), com as cores de bicho do ARK
// (Marrom-Escuro Dino, Verde-Escuro Dino...): a maioria tons naturais,
// alguns com cor forte (vermelho, azul) e, bem raro, albino.
// Feito no desenho do corpo: a cor nova troca o tom mas mantém o
// claro/escuro da pele (escamas, listras e relevo continuam).
// Cada bicho colorido ganha uma cópia do material com 3 números.
// O filhote herda cada região do pai ou da mãe.
// =============================================================
import * as THREE from 'three';

// Cores de bicho do ARK (id, nome e cor sRGB, da lista "Color IDs" da wiki do ARK).
// Cada bicho sorteia uma cor para as costas e outra para a barriga.
export const CORES_ARK = {
  8: ['Cinza-Claro', '#C8CACA'], 9: ['Marrom-Claro', '#786759'], 13: ['Cinza-Escuro', '#7B7B7B'],
  14: ['Preto', '#3B3B3B'], 15: ['Marrom', '#593A2A'], 17: ['Vermelho-Escuro', '#812118'],
  19: ['Vermelho-Claro Dino', '#FFA8A8'], 20: ['Vermelho-Escuro Dino', '#592B2B'],
  21: ['Laranja-Claro Dino', '#FFB694'], 22: ['Laranja-Escuro Dino', '#88532F'],
  23: ['Amarelo-Claro Dino', '#CACAA0'], 24: ['Amarelo-Escuro Dino', '#94946C'],
  26: ['Verde-Médio Dino', '#799479'], 27: ['Verde-Escuro Dino', '#224122'],
  28: ['Azul-Claro Dino', '#D9E0FF'], 29: ['Azul-Escuro Dino', '#394263'],
  31: ['Roxo-Escuro Dino', '#403459'], 32: ['Marrom-Claro Dino', '#FFE0BA'],
  33: ['Marrom-Médio Dino', '#948575'], 34: ['Marrom-Escuro Dino', '#594E41'],
  35: ['Cinza-Mais-Escuro Dino', '#595959'], 36: ['Albino Dino', '#FFFFFF'],
  12: ['Vermelho-Claro', '#FF756C'], 10: ['Laranja-Claro', '#FFB46C'],
  53: ['Azul-Médio Dino', '#5FA4EA'], 54: ['Azul-Profundo Dino', '#4568D4'],
};
// costas: tons mais escuros; barriga: mais claros (como a maioria dos bichos do ARK)
const COSTAS = [9, 13, 14, 15, 17, 20, 22, 24, 26, 27, 29, 31, 33, 34, 35];
const BARRIGA = [8, 19, 21, 23, 26, 28, 32, 33, 24, 13];
const VIVA = [12, 10, 53, 54, 17, 31];
const hexDe = (id) => CORES_ARK[id][1];

const LUM = new THREE.Vector3(0.2126, 0.7152, 0.0722);
const _c = new THREE.Color();

// hex -> [r, g, b (tom com luminância 1), brilho relativo]
function tom(hex) {
  _c.set(hex); // vira linear
  const l = Math.max(0.004, _c.r * LUM.x + _c.g * LUM.y + _c.b * LUM.z);
  return [_c.r / l, _c.g / l, _c.b / l, Math.min(2.4, Math.max(0.25, Math.pow(l / 0.12, 0.5)))];
}

/** Sorteia as cores de um bicho selvagem (cores do ARK). rand() = 0..1. Devolve null (cor original) ou {a, b, k, ids}. */
export function sortearCor(rand) {
  const r = rand();
  if (r < 0.2) return null; // ~20% com a cor original do modelo
  const pega = (l) => l[Math.floor(rand() * l.length)];
  const viva = r > 0.9; // raro: cor forte nas costas
  const albino = r > 0.995;
  const ca = albino ? 36 : viva ? pega(VIVA) : pega(COSTAS);
  const cb = albino ? 36 : pega(BARRIGA);
  return { a: hexDe(ca), b: hexDe(cb), k: +(viva || albino ? 0.85 : 0.6 + rand() * 0.25).toFixed(2), ids: [ca, cb] };
}

/** Nome das cores do bicho (ex.: "Marrom-Escuro Dino / Amarelo-Claro Dino"), ou null. */
export function nomeCor(cor) {
  if (!cor?.ids) return null;
  return cor.ids.map((id) => CORES_ARK[id]?.[0] ?? `cor ${id}`).join(' / ');
}

/** Filhote: cada região vem do pai ou da mãe. */
export function herdarCor(mae, pai, rand) {
  const m = mae ?? null;
  const p = pai ?? null;
  if (!m && !p) return null;
  if (!m || !p) return rand() < 0.5 ? (m ?? p) : null;
  const ca = rand() < 0.5 ? m : p;
  const cb = rand() < 0.5 ? m : p;
  return { a: ca.a, b: cb.b, k: rand() < 0.5 ? m.k : p.k, ids: ca.ids && cb.ids ? [ca.ids[0], cb.ids[1]] : undefined };
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
