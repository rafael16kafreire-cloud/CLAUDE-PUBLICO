// =============================================================
// FOLHAGEM NO ESTILO DO ARK (arbustos, plantinhas do chão, samambaia/palminha e bananeira)
// Folhas grandes e curvas, desenhadas em cartões com recorte (alpha):
//  - hosta : folha larga e ovalada, verde-escura, com nervuras marcadas e ondulada (os arbustos
//            de baga e o chão da mata cheio de plantinhas)
//  - fronde: folha de palminha/samambaia com folíolos finos dos dois lados da nervura
//  - banana: folha comprida, verde-limão com manchas laranja, bordas rasgadas e nervuras paralelas
// As texturas são desenhadas na hora (canvas): nada de arquivo de imagem novo.
// =============================================================
import * as THREE from 'three';
import { addWind } from './materials.js';
import { addLeafLight } from './foliage_texture.js';

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function canvasTex(N, desenha) {
  const c = document.createElement('canvas');
  c.width = N;
  c.height = N;
  desenha(c.getContext('2d'), N);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

// ---------------- texturas (folha apontando para cima: base embaixo, ponta em cima) ----------------
function texHosta() {
  return canvasTex(256, (g, N) => {
    const r = rng(11);
    g.clearRect(0, 0, N, N);
    // contorno: ovalada, mais larga em 35% do comprimento, base em coração, ponta fina
    const larg = (t) => Math.pow(Math.sin(Math.PI * Math.pow(t, 0.62)), 0.85) * (0.47 + 0.03 * Math.sin(t * 9)) * N;
    const path = new Path2D();
    const pts = 48;
    for (let i = 0; i <= pts; i++) { const t = i / pts; path.lineTo(N / 2 - larg(t), N * (1 - 0.02 - t * 0.96)); }
    for (let i = pts; i >= 0; i--) { const t = i / pts; path.lineTo(N / 2 + larg(t), N * (1 - 0.02 - t * 0.96)); }
    path.closePath();
    g.save();
    g.clip(path);
    const gr = g.createLinearGradient(0, N, 0, 0);
    gr.addColorStop(0, '#347a42');
    gr.addColorStop(0.45, '#52a85a');
    gr.addColorStop(1, '#3c8650');
    g.fillStyle = gr;
    g.fillRect(0, 0, N, N);
    // mancha clara no meio e borda mais escura
    const rg = g.createRadialGradient(N / 2, N * 0.5, 10, N / 2, N * 0.5, N * 0.5);
    rg.addColorStop(0, 'rgba(150,205,140,0.35)');
    rg.addColorStop(1, 'rgba(10,40,20,0.35)');
    g.fillStyle = rg;
    g.fillRect(0, 0, N, N);
    // nervuras laterais (curvas) com sombra ao lado: a folha parece corrugada
    for (let k = 0; k < 11; k++) {
      const t = 0.1 + k * 0.078;
      const y = N * (1 - 0.02 - t * 0.96);
      for (const s of [-1, 1]) {
        const ex = N / 2 + s * larg(Math.min(0.98, t + 0.16)) * 0.96;
        const ey = N * (1 - 0.02 - Math.min(0.98, t + 0.2) * 0.96);
        g.strokeStyle = 'rgba(12,50,24,0.45)';
        g.lineWidth = 4;
        g.beginPath();
        g.moveTo(N / 2, y + 2);
        g.quadraticCurveTo(N / 2 + s * N * 0.22, y - 6, ex, ey + 2);
        g.stroke();
        g.strokeStyle = 'rgba(165,215,150,0.55)';
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(N / 2, y);
        g.quadraticCurveTo(N / 2 + s * N * 0.22, y - 8, ex, ey);
        g.stroke();
      }
    }
    // nervura central clara
    g.strokeStyle = 'rgba(190,225,160,0.9)';
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(N / 2, N * 0.98);
    g.lineTo(N / 2, N * 0.04);
    g.stroke();
    // grão
    for (let i = 0; i < 900; i++) {
      g.fillStyle = r() < 0.5 ? 'rgba(0,30,10,0.12)' : 'rgba(200,240,170,0.1)';
      g.fillRect(r() * N, r() * N, 1 + r() * 2, 1 + r() * 2);
    }
    g.restore();
  });
}

function texFronde() {
  return canvasTex(256, (g, N) => {
    const r = rng(23);
    g.clearRect(0, 0, N, N);
    // nervura central (ráquis)
    g.strokeStyle = '#6f9a2e';
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(N / 2, N);
    g.lineTo(N / 2, 0);
    g.stroke();
    // folíolos: finos, alternados, abrindo para cima e para fora; mais curtos perto da ponta
    const n = 22;
    for (let i = 0; i < n; i++) {
      const t = i / n;
      const y = N * (0.97 - t * 0.93);
      const comp = N * 0.5 * (0.35 + 0.65 * Math.sin(Math.PI * Math.min(1, t * 1.1 + 0.08)) ) * (1 - t * 0.35);
      for (const s of [-1, 1]) {
        const ex = N / 2 + s * comp;
        const ey = y - comp * 0.55;
        const g1 = g.createLinearGradient(N / 2, y, ex, ey);
        g1.addColorStop(0, '#3a7a28');
        g1.addColorStop(0.6, r() < 0.5 ? '#5fa534' : '#7dbb3c');
        g1.addColorStop(1, '#4f9a2c');
        g.fillStyle = g1;
        g.beginPath();
        g.moveTo(N / 2, y);
        g.quadraticCurveTo(N / 2 + s * comp * 0.5, y - comp * 0.12 - 6, ex, ey);
        g.quadraticCurveTo(N / 2 + s * comp * 0.5, y - comp * 0.12 + 6, N / 2, y + 3);
        g.fill();
        g.strokeStyle = 'rgba(30,80,20,0.6)';
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(N / 2, y);
        g.quadraticCurveTo(N / 2 + s * comp * 0.5, y - comp * 0.12, ex, ey);
        g.stroke();
      }
    }
  });
}

function texBanana() {
  return canvasTex(256, (g, N) => {
    const r = rng(31);
    g.clearRect(0, 0, N, N);
    // contorno: elipse comprida (mais larga no meio)
    const larg = (t) => Math.pow(Math.sin(Math.PI * Math.pow(t, 0.8)), 0.7) * 0.47 * N;
    const path = new Path2D();
    const pts = 40;
    for (let i = 0; i <= pts; i++) { const t = i / pts; path.lineTo(N / 2 - larg(t), N * (1 - 0.01 - t * 0.98)); }
    for (let i = pts; i >= 0; i--) { const t = i / pts; path.lineTo(N / 2 + larg(t), N * (1 - 0.01 - t * 0.98)); }
    path.closePath();
    g.save();
    g.clip(path);
    const gr = g.createLinearGradient(0, N, 0, 0);
    gr.addColorStop(0, '#8cb832');
    gr.addColorStop(0.5, '#b5d040');
    gr.addColorStop(1, '#6e9a2a');
    g.fillStyle = gr;
    g.fillRect(0, 0, N, N);
    // manchas amareladas e alaranjadas (folha envelhecendo)
    for (let i = 0; i < 16; i++) {
      const x = r() * N;
      const y = r() * N;
      const R = 14 + r() * 40;
      const rg = g.createRadialGradient(x, y, 0, x, y, R);
      const tom = r() < 0.5 ? '230,200,70' : '215,140,50';
      rg.addColorStop(0, `rgba(${tom},0.55)`);
      rg.addColorStop(1, `rgba(${tom},0)`);
      g.fillStyle = rg;
      g.fillRect(x - R, y - R, R * 2, R * 2);
    }
    // nervuras paralelas saindo da central
    for (let k = 0; k < 40; k++) {
      const y = N * (0.03 + k * 0.024);
      for (const s of [-1, 1]) {
        g.strokeStyle = 'rgba(70,100,20,0.35)';
        g.lineWidth = 1.5;
        g.beginPath();
        g.moveTo(N / 2, y);
        g.lineTo(N / 2 + s * N * 0.5, y - N * 0.1);
        g.stroke();
      }
    }
    g.strokeStyle = '#d8dc50';
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(N / 2, N);
    g.lineTo(N / 2, 0);
    g.stroke();
    g.restore();
    // rasgos: fendas das bordas até perto da nervura (transparentes), um pouco inclinadas
    g.globalCompositeOperation = 'destination-out';
    for (let k = 0; k < 9; k++) {
      const y = N * (0.12 + r() * 0.78);
      for (const s of [-1, 1]) {
        if (r() < 0.45) continue;
        g.lineWidth = 2 + r() * 3;
        g.beginPath();
        g.moveTo(N / 2 + s * N * (0.13 + r() * 0.1), y + 6);
        g.lineTo(N / 2 + s * N * 0.52, y - N * 0.07);
        g.stroke();
      }
    }
    g.globalCompositeOperation = 'source-over';
  });
}

// ---------------- materiais ----------------
const matCache = {};
function folhaMat(chave, tex, vento = [0.01, 0.03]) {
  if (matCache[chave]) return matCache[chave];
  const m = new THREE.MeshLambertMaterial({ map: tex(), alphaTest: 0.45, side: THREE.DoubleSide, vertexColors: true });
  addWind(m, vento[0], vento[1], 0);
  addLeafLight(m, 0.55);
  // verso da folha: a luz não vira de cabeça para baixo (igual ao capim)
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = (shader, renderer) => {
    prev?.(shader, renderer);
    shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_begin>', THREE.ShaderChunk.normal_fragment_begin.replace('gl_FrontFacing ? 1.0 : - 1.0', '1.0'));
  };
  const k = m.customProgramCacheKey;
  m.customProgramCacheKey = () => `${k ? k() : ''}-ark-${chave}`;
  matCache[chave] = m;
  return m;
}
export const matHosta = () => folhaMat('hosta', texHosta);
export const matFronde = () => folhaMat('fronde', texFronde, [0.012, 0.05]);
export const matBanana = () => folhaMat('banana', texBanana, [0.012, 0.04]);

// ---------------- geometria: folhas curvas em cartão ----------------
class Montador {
  constructor() { this.p = []; this.uv = []; this.i = []; this.c = []; this.w = []; }

  // Uma folha: sai de (x0,y0,z0), aponta para o ângulo "yaw", sobe com "elev" (rad) e vai pendendo
  // ("queda") ao longo do comprimento; "copa" levanta/abaixa as bordas (calha); segs = divisões.
  folha({ x0 = 0, y0 = 0, z0 = 0, yaw, elev, L, W, queda = 0.8, calha = 0.2, segs = [2, 4], cor = [1, 1, 1], giro = 0, vento = 1 }) {
    const [su, sv] = segs;
    const base = this.p.length / 3;
    const dx = Math.sin(yaw);
    const dz = Math.cos(yaw);
    const lx = dz; // lateral (perpendicular horizontal)
    const lz = -dx;
    // caminho do eixo da folha
    const eixo = [];
    let px = x0;
    let py = y0;
    let pz = z0;
    const passo = L / sv;
    for (let j = 0; j <= sv; j++) {
      const t = j / sv;
      eixo.push([px, py, pz, t]);
      const a = elev - queda * t * t * 1.6; // inclinação aqui
      px += Math.cos(a) * dx * passo;
      pz += Math.cos(a) * dz * passo;
      py += Math.sin(a) * passo;
    }
    for (let j = 0; j <= sv; j++) {
      const [ex, ey, ez, t] = eixo[j];
      for (let i = 0; i <= su; i++) {
        const u = i / su - 0.5; // -0.5..0.5
        const w = u * W;
        const lev = calha * Math.pow(u * 2, 2) * W * (0.4 + 0.6 * Math.sin(Math.PI * Math.min(1, t * 1.2)));
        // giro: a folha se inclina de lado ao longo do comprimento
        const gx = lx * Math.cos(giro * t) * w;
        const gz = lz * Math.cos(giro * t) * w;
        const gy = Math.sin(giro * t) * w;
        this.p.push(ex + gx, ey + gy + lev, ez + gz);
        this.uv.push(i / su, t);
        this.c.push(cor[0], cor[1], cor[2]);
        this.w.push(vento * t);
      }
    }
    for (let j = 0; j < sv; j++) {
      for (let i = 0; i < su; i++) {
        const a = base + j * (su + 1) + i;
        const b = a + 1;
        const c = a + su + 1;
        const d = c + 1;
        this.i.push(a, c, b, b, c, d);
      }
    }
  }

  geometria() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setAttribute('aWind', new THREE.Float32BufferAttribute(this.w, 1));
    g.setIndex(this.i);
    g.computeVertexNormals();
    // normais puxadas para cima: a folha acende como o chão (sem lado preto)
    const n = g.getAttribute('normal');
    for (let k = 0; k < n.count; k++) {
      const x = n.getX(k) * 0.4;
      const y = n.getY(k) * 0.4 + 0.6;
      const z = n.getZ(k) * 0.4;
      const l = Math.hypot(x, y, z) || 1;
      n.setXYZ(k, x / l, y / l, z / l);
    }
    return g;
  }
}

const ANG = 2.39996; // ângulo dourado

// Touceira de folhas largas (arbusto de baga / planta do chão). n folhas, tamanho em metros.
export function makeHostaClump({ n = 8, tam = 0.7, seed = 1, baixo = false, espalha = 0 } = {}) {
  const r = rng(seed);
  const M = new Montador();
  for (let k = 0; k < n; k++) {
    const yaw = k * ANG + r() * 0.4;
    const fora = k / n; // as de fora mais abertas e baixas
    const L = tam * (0.8 + 0.5 * r()) * (1 - fora * 0.1);
    const v = 0.78 + r() * 0.3;
    // espalha > 0: vira um canteiro de várias plantinhas lado a lado (uma instância cobre o chão)
    const ra = espalha * Math.sqrt(r());
    const ox = Math.sin(yaw * 3.7) * ra;
    const oz = Math.cos(yaw * 3.7) * ra;
    M.folha({
      x0: ox + Math.sin(yaw) * 0.04, y0: 0.02, z0: oz + Math.cos(yaw) * 0.04,
      yaw, elev: 0.5 + fora * 0.45 + r() * 0.25, L, W: L * 0.78, queda: 0.7 + r() * 0.5, calha: 0.22,
      segs: baixo ? (espalha ? [1, 1] : [2, 3]) : [3, 5], cor: [v, v * (0.95 + r() * 0.1), v * 0.9], giro: (r() - 0.5) * 0.6,
    });
  }
  return M.geometria();
}

// Palminha/samambaia: frondes arqueadas com folíolos
export function makeFrondeBush({ n = 7, tam = 1.0, seed = 1, baixo = false } = {}) {
  const r = rng(seed);
  const M = new Montador();
  for (let k = 0; k < n; k++) {
    const yaw = k * ANG + r() * 0.3;
    const L = tam * (0.8 + 0.4 * r());
    const v = 0.8 + r() * 0.3;
    M.folha({
      x0: 0, y0: 0.03, z0: 0, yaw, elev: 0.9 + r() * 0.5, L, W: L * 0.62, queda: 0.9 + r() * 0.8, calha: 0.1,
      segs: baixo ? [1, 3] : [2, 5], cor: [v, v, v * 0.92], giro: (r() - 0.5) * 0.4,
    });
  }
  return M.geometria();
}

// Bananeira: tronco de folhas amareladas e folhas grandes arqueadas; "cacho" põe as bananas.
export function makeBananaArk({ n = 8, tam = 2.0, seed = 1, cacho = true, baixo = false } = {}) {
  const r = rng(seed);
  const M = new Montador();
  for (let k = 0; k < n; k++) {
    const yaw = k * ANG + r() * 0.35;
    const L = tam * (0.75 + 0.45 * r());
    const alto = 0.55 + 0.9 * (1 - k / n);
    const v = 0.85 + r() * 0.25;
    M.folha({
      x0: Math.sin(yaw) * 0.05, y0: alto * 0.55, z0: Math.cos(yaw) * 0.05,
      yaw, elev: 0.85 + r() * 0.5, L, W: L * 0.36, queda: 0.8 + r() * 0.9, calha: 0.1,
      segs: baixo ? [2, 5] : [3, 8], cor: [v, v, v * 0.9], giro: (r() - 0.5) * 0.7,
    });
  }
  const g = M.geometria();
  // pseudo-tronco: cilindro verde-amarelado (mesma textura, trecho liso da nervura)
  const tronco = new THREE.CylinderGeometry(0.07, 0.1, 1.15, 8, 1, true);
  tronco.translate(0, 0.575, 0);
  const tp = tronco.attributes.position.count;
  tronco.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(tp * 3).fill(0.9), 3));
  tronco.setAttribute('aWind', new THREE.Float32BufferAttribute(new Float32Array(tp), 1));
  const u2 = new Float32Array(tp * 2);
  for (let k = 0; k < tp; k++) { u2[k * 2] = 0.5; u2[k * 2 + 1] = 0.5; } // ponto da nervura (amarelo-verde)
  tronco.setAttribute('uv', new THREE.BufferAttribute(u2, 2));
  const geos = [g, tronco];
  if (cacho) {
    // cacho de bananas pendurado: dedos curvos amarelo-esverdeados (também do ponto da nervura)
    const dedos = [];
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2;
      const d = new THREE.CylinderGeometry(0.018, 0.012, 0.2, 6);
      d.translate(0, -0.1, 0);
      d.rotateX(0.5);
      d.rotateY(a);
      d.translate(Math.cos(a) * 0.05, 0.95 - (k % 3) * 0.06, Math.sin(a) * 0.05 + 0.18);
      const nn = d.attributes.position.count;
      d.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(nn * 3).fill(1), 3));
      d.setAttribute('aWind', new THREE.Float32BufferAttribute(new Float32Array(nn), 1));
      const uu = new Float32Array(nn * 2);
      for (let q = 0; q < nn; q++) { uu[q * 2] = 0.5; uu[q * 2 + 1] = 0.55; }
      d.setAttribute('uv', new THREE.BufferAttribute(uu, 2));
      dedos.push(d);
    }
    geos.push(...dedos);
  }
  return mergeGeos(geos);
}

function mergeGeos(list) {
  let n = 0;
  let ni = 0;
  for (const g of list) { n += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; }
  const P = new Float32Array(n * 3);
  const N = new Float32Array(n * 3);
  const U = new Float32Array(n * 2);
  const C = new Float32Array(n * 3);
  const W = new Float32Array(n);
  const I = new Uint32Array(ni);
  let o = 0;
  let oi = 0;
  for (const g of list) {
    const cnt = g.attributes.position.count;
    P.set(g.attributes.position.array, o * 3);
    N.set(g.attributes.normal.array, o * 3);
    U.set(g.attributes.uv.array, o * 2);
    C.set(g.attributes.color.array, o * 3);
    W.set(g.attributes.aWind.array, o);
    if (g.index) for (let k = 0; k < g.index.count; k++) I[oi++] = g.index.array[k] + o;
    else for (let k = 0; k < cnt; k++) I[oi++] = o + k;
    o += cnt;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(P, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(N, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(U, 2));
  out.setAttribute('color', new THREE.BufferAttribute(C, 3));
  out.setAttribute('aWind', new THREE.BufferAttribute(W, 1));
  out.setIndex(new THREE.BufferAttribute(I, 1));
  return out;
}
