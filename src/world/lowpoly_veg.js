// =============================================================
// VEGETAÇÃO E PEDRAS LOW-POLY (estilo Valheim) – tudo feito aqui
// com formas simples (cone, cilindro, icosaedro, dodecaedro e
// tiras de triângulos), cores da paleta (core/paleta.js) e faces
// planas. Nenhum arquivo de modelo ou textura.
//
// Cada gerador devolve uma geometria com:
//   position, normal (de face), color (uma cor por face),
//   uv (zeros) e aWind (0 = parado, 1 = balança com o vento).
// A escala e a rotação de cada planta vêm da vegetação (InstancedMesh).
//
// >>> PARA AJUSTAR: tamanhos estão nos parâmetros de cada função;
//     cores vêm da paleta (PALETA.musgo, PALETA.marrom...).
// =============================================================
import * as THREE from 'three';
import { PALETA, mistura } from '../core/paleta.js';
import { addWind, addRelief } from './materials.js';

function rnd(seed) {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const _v = new THREE.Vector3();
const _n = new THREE.Vector3();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

// Junta pedaços numa geometria só, com uma cor por face.
class Malha {
  constructor(seed = 1) {
    this.pos = [];
    this.col = [];
    this.wind = [];
    this.r = rnd(seed);
  }

  // cor de cada face: cor fixa, ou função (centro, normal) -> THREE.Color
  add(geo, { cor, varia = 0.07, vento = 0, jitter = 0, m = null, corFace = null, ventoPorAltura = 0 }) {
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    if (m) g.applyMatrix4(m);
    const p = g.attributes.position;
    // tremidinha nos vértices (sem abrir buracos: o mesmo vértice anda igual)
    if (jitter > 0) {
      const mapa = new Map();
      for (let i = 0; i < p.count; i++) {
        const k = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
        let d = mapa.get(k);
        if (!d) {
          d = [(this.r() - 0.5) * jitter, (this.r() - 0.5) * jitter, (this.r() - 0.5) * jitter];
          mapa.set(k, d);
        }
        p.setXYZ(i, p.getX(i) + d[0], p.getY(i) + d[1], p.getZ(i) + d[2]);
      }
    }
    const tmp = new THREE.Color();
    for (let i = 0; i < p.count; i += 3) {
      _a.fromBufferAttribute(p, i);
      _b.fromBufferAttribute(p, i + 1);
      _c.fromBufferAttribute(p, i + 2);
      _n.subVectors(_c, _b).cross(_v.subVectors(_a, _b)).normalize();
      _v.copy(_a).add(_b).add(_c).multiplyScalar(1 / 3);
      tmp.copy(corFace ? corFace(_v, _n) : cor);
      tmp.multiplyScalar(1 + (this.r() - 0.5) * 2 * varia);
      for (let k = 0; k < 3; k++) {
        const q = k === 0 ? _a : k === 1 ? _b : _c;
        this.pos.push(q.x, q.y, q.z);
        this.col.push(tmp.r, tmp.g, tmp.b);
        this.wind.push(ventoPorAltura > 0 ? Math.min(1, Math.max(0, q.y / ventoPorAltura)) * vento : vento);
      }
    }
  }

  // um triângulo solto (folhas, lâminas de capim); vento por vértice
  tri(a, b, c, cor, va = 0, vb = 0, vc = 0) {
    this.pos.push(...a, ...b, ...c);
    for (let k = 0; k < 3; k++) this.col.push(cor.r, cor.g, cor.b);
    this.wind.push(va, vb, vc);
  }

  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.computeVertexNormals(); // sem índice = normal de face (facetado)
    const n = this.pos.length / 3;
    g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2));
    g.setAttribute('aWind', new THREE.Float32BufferAttribute(this.wind, 1));
    g.computeBoundingSphere();
    return g;
  }
}

const M4 = () => new THREE.Matrix4();
const pos = (x, y, z) => M4().makeTranslation(x, y, z);
// cilindro ligando dois pontos
function cilindroEntre(p0, p1, r0, r1, lados) {
  const d = new THREE.Vector3().subVectors(p1, p0);
  const L = d.length();
  const g = new THREE.CylinderGeometry(r1, r0, L, lados, 1);
  g.translate(0, L / 2, 0);
  const q = new THREE.Quaternion().setFromUnitVectors(UP, d.normalize());
  g.applyQuaternion(q);
  g.translate(p0.x, p0.y, p0.z);
  return g;
}
const cor = (nome) => PALETA[nome];
const mix = (a, b, t) => mistura(a, b, t);

// ------------------------------------------------------------
// PINHEIRO: tronco + 3 a 5 cones empilhados (com neve opcional)
// ------------------------------------------------------------
export function pinheiro(alt = 20, { neve = false, seed = 1, low = false, camadas = 5 } = {}) {
  const M = new Malha(seed);
  const r = M.r;
  const n = low ? 3 : camadas;
  M.add(new THREE.CylinderGeometry(alt * 0.012, alt * 0.03, alt * 0.4, low ? 4 : 6), { cor: cor('marrom'), m: pos(0, alt * 0.2, 0) });
  const verdeA = mix('musgoEscuro', 'musgo', 0.25);
  const verdeB = mix('musgoEscuro', 'musgo', 0.6);
  const branca = cor('neve');
  for (let i = 0; i < n; i++) {
    const k = i / (n - 1 || 1);
    const R = alt * (0.23 - 0.16 * k) + 0.3;
    const H = alt * (0.34 - 0.1 * k);
    const y0 = alt * (0.16 + 0.62 * k);
    const g = new THREE.ConeGeometry(R, H, low ? 5 : 7, 1);
    g.rotateY(r() * 6.28);
    const verde = i % 2 ? verdeA : verdeB;
    M.add(g, {
      m: pos((r() - 0.5) * 0.3, y0 + H / 2, (r() - 0.5) * 0.3),
      vento: 0.35 + 0.2 * k,
      jitter: low ? 0 : R * 0.12,
      corFace: neve ? (c, nn) => (nn.y > 0.32 && r() < 0.88 ? branca : verde) : () => verde,
    });
  }
  return M.build();
}

// ------------------------------------------------------------
// CARVALHO / árvore de copa: tronco, galhos e copa de "bolas" facetadas
// larg: largura da copa; achatada: copa de guarda-chuva (árvores gigantes da mata)
// ------------------------------------------------------------
export function carvalho(alt = 14, { seed = 1, low = false, larg = 1, achatada = false, folhas = ['musgo', 'folhaClara', 'musgoEscuro'], troncoCor = 'marrom', bolas = 6, grosso = 1 } = {}) {
  const M = new Malha(seed);
  const r = M.r;
  const yc = alt * (achatada ? 0.8 : 0.66);
  const rt = Math.max(0.15, alt * 0.035) * grosso;
  M.add(new THREE.CylinderGeometry(rt * 0.55, rt, yc, low ? 5 : 7), { cor: cor(troncoCor), m: pos(0, yc / 2, 0), jitter: low ? 0 : rt * 0.25 });
  const R = alt * 0.27 * larg;
  if (!low) {
    // galhos subindo para a copa
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * 6.28 + r();
      const p0 = new THREE.Vector3(0, yc * (0.55 + r() * 0.2), 0);
      const p1 = new THREE.Vector3(Math.cos(a) * R * 0.6, yc + R * 0.1, Math.sin(a) * R * 0.6);
      M.add(cilindroEntre(p0, p1, rt * 0.45, rt * 0.2, 5), { cor: cor(troncoCor) });
    }
  }
  const nb = low ? Math.max(2, Math.round(bolas / 2)) : bolas;
  for (let i = 0; i < nb; i++) {
    const a = (i / nb) * 6.28 + r() * 0.8;
    const d = i === 0 ? 0 : R * (0.45 + r() * 0.35);
    const rb = R * (i === 0 ? 0.75 : 0.45 + r() * 0.25);
    const g = new THREE.IcosahedronGeometry(rb, 0);
    g.scale(1, achatada ? 0.5 : 0.82, 1);
    const verde = mix(folhas[i % folhas.length], folhas[(i + 1) % folhas.length], r() * 0.4);
    M.add(g, {
      cor: verde,
      m: pos(Math.cos(a) * d, yc + R * (achatada ? 0.15 : 0.3) + (r() - 0.3) * R * (achatada ? 0.2 : 0.45), Math.sin(a) * d),
      vento: 0.6,
      jitter: low ? 0 : rb * 0.22,
      varia: 0.1,
    });
  }
  return M.build();
}

// ------------------------------------------------------------
// PALMEIRA: tronco curvo em gomos + folhas em tiras caídas (com cocos)
// ------------------------------------------------------------
function folhaTira(M, base, ang, L, larg, caida, corF, segs = 4) {
  const r = M.r;
  const dx = Math.cos(ang);
  const dz = Math.sin(ang);
  const sx = -dz;
  const sz = dx;
  const P = (t) => {
    const out = t * L;
    return [base.x + dx * out, base.y + Math.sin(0.5) * out - caida * t * t * L, base.z + dz * out];
  };
  for (let i = 0; i < segs; i++) {
    const t0 = i / segs;
    const t1 = (i + 1) / segs;
    const a = P(t0);
    const b = P(t1);
    const w0 = larg * Math.sin(Math.PI * Math.min(1, t0 * 1.2 + 0.08));
    const w1 = larg * Math.sin(Math.PI * Math.min(1, t1 * 1.2 + 0.08)) * (i === segs - 1 ? 0.15 : 1);
    // dobra no meio (nervura): as duas metades formam um "V" raso
    const sp = 0.06 * L;
    const aL = [a[0] + sx * w0, a[1] - sp * 0.4, a[2] + sz * w0];
    const aR = [a[0] - sx * w0, a[1] - sp * 0.4, a[2] - sz * w0];
    const bL = [b[0] + sx * w1, b[1] - sp * 0.4, b[2] + sz * w1];
    const bR = [b[0] - sx * w1, b[1] - sp * 0.4, b[2] - sz * w1];
    const c = corF.clone().multiplyScalar(0.92 + r() * 0.16);
    M.tri(a, aL, bL, c, t0, t0, t1);
    M.tri(a, bL, b, c, t0, t1, t1);
    M.tri(a, b, bR, c.clone().multiplyScalar(0.9), t0, t1, t1);
    M.tri(a, bR, aR, c.clone().multiplyScalar(0.9), t0, t1, t0);
  }
}

export function palmeira(alt = 12, { seed = 1, low = false, curva = 0.12, folhas = 8, cocos = true, larg = 0.6, caida = 0.55, tronco = ['marrom', 'madeira'] } = {}) {
  const M = new Malha(seed);
  const r = M.r;
  const segs = low ? 4 : 7;
  const dirA = r() * 6.28;
  const pts = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const off = curva * alt * t * t;
    pts.push(new THREE.Vector3(Math.cos(dirA) * off, alt * t, Math.sin(dirA) * off));
  }
  const rb = Math.max(0.14, alt * 0.025);
  for (let i = 0; i < segs; i++) {
    const t = i / segs;
    M.add(cilindroEntre(pts[i], pts[i + 1], rb * (1 - t * 0.35), rb * (1 - (t + 1 / segs) * 0.35) * 1.12, low ? 5 : 6), { cor: cor(tronco[i % 2]) });
  }
  const topo = pts[segs];
  const nf = low ? Math.max(5, folhas - 3) : folhas;
  const verdes = [mix('musgo', 'folhaClara', 0.3), mix('musgoEscuro', 'musgo', 0.6), cor('folhaClara')];
  for (let i = 0; i < nf; i++) {
    folhaTira(M, topo, (i / nf) * 6.28 + r() * 0.4, alt * (0.3 + r() * 0.08), alt * 0.05 * larg * 1.6, caida + r() * 0.2, verdes[i % 3], low ? 2 : 4);
  }
  if (cocos && !low) {
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * 6.28 + r();
      M.add(new THREE.IcosahedronGeometry(rb * 0.9, 0), { cor: cor('terraEscura'), m: pos(topo.x + Math.cos(a) * rb * 1.4, topo.y - rb * 1.6, topo.z + Math.sin(a) * rb * 1.4) });
    }
  }
  return M.build();
}

// Bananeira: tronco verde curto e folhas largas; com cacho (amarelo) ou sem
export function bananeira({ seed = 1, low = false, cacho = true } = {}) {
  const M = new Malha(seed);
  const r = M.r;
  const alt = 3.6;
  M.add(new THREE.CylinderGeometry(0.16, 0.24, alt, low ? 5 : 7), { cor: mix('musgo', 'marrom', 0.4), m: pos(0, alt / 2, 0) });
  const topo = new THREE.Vector3(0, alt, 0);
  const nf = low ? 5 : 7;
  for (let i = 0; i < nf; i++) folhaTira(M, topo, (i / nf) * 6.28 + r() * 0.5, 2.2 + r() * 0.5, 0.42, 0.7, mix('folhaClara', 'musgo', r() * 0.5), low ? 2 : 3);
  if (cacho) {
    const am = mix('capimSeco', 'solLaranja', 0.45);
    for (let i = 0; i < (low ? 3 : 7); i++) {
      const a = (i / 7) * 6.28;
      const g = new THREE.CylinderGeometry(0.05, 0.06, 0.32, 4);
      g.rotateZ(0.5);
      M.add(g, { cor: am, m: pos(Math.cos(a) * 0.22, alt - 0.55 - (i % 3) * 0.16, Math.sin(a) * 0.22) });
    }
  }
  return M.build();
}

// ------------------------------------------------------------
// ARBUSTO: 3 a 4 bolas facetadas (com bagas coloridas ou neve)
// ------------------------------------------------------------
export function arbusto({ raio = 0.8, seed = 1, low = false, bagas = null, neve = false, folhas = ['musgo', 'musgoEscuro'] } = {}) {
  const M = new Malha(seed);
  const r = M.r;
  const nb = low ? 2 : 4;
  const branca = cor('neve');
  for (let i = 0; i < nb; i++) {
    const a = (i / nb) * 6.28 + r();
    const d = i === 0 ? 0 : raio * 0.5;
    const rb = raio * (i === 0 ? 0.75 : 0.5 + r() * 0.2);
    const verde = mix(folhas[0], folhas[1], r());
    M.add(new THREE.IcosahedronGeometry(rb, 0), {
      m: pos(Math.cos(a) * d, rb * 0.75, Math.sin(a) * d),
      vento: 0.4,
      jitter: low ? 0 : rb * 0.25,
      corFace: neve ? (c, nn) => (nn.y > 0.25 ? branca : verde) : () => verde,
    });
  }
  if (bagas && !low) {
    for (let i = 0; i < 14; i++) {
      const a = r() * 6.28;
      const e = 0.2 + r() * 0.9;
      const g = new THREE.OctahedronGeometry(raio * 0.07, 0);
      M.add(g, { cor: bagas, m: pos(Math.cos(a) * Math.cos(e) * raio * 0.85, raio * 0.6 + Math.sin(e) * raio * 0.55, Math.sin(a) * Math.cos(e) * raio * 0.85), vento: 0.4, varia: 0.15 });
    }
  }
  return M.build();
}

// ------------------------------------------------------------
// SAMAMBAIA (rasteira) e SAMAMBAIA GIGANTE (com tronco)
// ------------------------------------------------------------
export function samambaia({ tam = 0.9, seed = 1, folhas = 7 } = {}) {
  const M = new Malha(seed);
  const r = M.r;
  for (let i = 0; i < folhas; i++) folhaTira(M, new THREE.Vector3(0, 0.05, 0), (i / folhas) * 6.28 + r() * 0.5, tam * (0.8 + r() * 0.4), tam * 0.12, 0.9, mix('musgo', 'folhaClara', r() * 0.6), 3);
  return M.build();
}

export function samambaiaGigante({ seed = 1, low = false } = {}) {
  const M = new Malha(seed);
  const r = M.r;
  const alt = 4.2;
  M.add(new THREE.CylinderGeometry(0.16, 0.22, alt, low ? 5 : 6), { cor: mix('marrom', 'terraEscura', 0.4), m: pos(0, alt / 2, 0), jitter: low ? 0 : 0.04 });
  const topo = new THREE.Vector3(0, alt, 0);
  const nf = low ? 6 : 9;
  for (let i = 0; i < nf; i++) folhaTira(M, topo, (i / nf) * 6.28 + r() * 0.3, 2.4 + r() * 0.4, 0.32, 1.0, mix('musgo', 'folhaClara', r() * 0.5), low ? 2 : 4);
  return M.build();
}

// ------------------------------------------------------------
// PLANTINHA: tufo rasteiro de folhas largas (o "chão cheio de plantinhas" da selva)
// ------------------------------------------------------------
export function plantinha({ seed = 1, brotos = 7, folhas = 5, tam = 0.55 } = {}) {
  const M = new Malha(seed);
  const r = M.r;
  for (let b = 0; b < brotos; b++) {
    // cada broto fica num ponto do tufo (um tufo cobre ~2 m² do chão)
    const ba = r() * 6.28;
    const bd = b === 0 ? 0 : 0.4 + r() * 1.3; // um tufo cobre ~8 m² do chão
    const ox = Math.cos(ba) * bd;
    const oz = Math.sin(ba) * bd;
    for (let i = 0; i < folhas; i++) {
      const a = (i / folhas) * 6.28 + r() * 0.7;
      const L = tam * (0.7 + r() * 0.5);
      const larg = L * (0.34 + r() * 0.1);
      const subida = 0.28 + r() * 0.34; // folha mais deitada ou mais em pé
      const dx = Math.cos(a);
      const dz = Math.sin(a);
      const base = [ox + dx * 0.03, 0.03, oz + dz * 0.03];
      const meio = [ox + dx * L * 0.55, 0.03 + L * subida, oz + dz * L * 0.55];
      const ponta = [ox + dx * L, 0.02 + L * subida * 0.9, oz + dz * L];
      const sx = -dz * larg;
      const sz = dx * larg;
      const c = mix('musgo', 'folhaClara', 0.35 + r() * 0.6);
      const c2 = mix('musgo', 'folhaClara', 0.1 + r() * 0.4);
      // losango em duas metades (nervura no meio): bem pouco vento, só na ponta
      M.tri(base, [meio[0] + sx, meio[1], meio[2] + sz], [meio[0] - sx, meio[1], meio[2] - sz], c2, 0, 0.25, 0.25);
      M.tri([meio[0] + sx, meio[1], meio[2] + sz], ponta, [meio[0] - sx, meio[1], meio[2] - sz], c, 0.25, 0.5, 0.25);
    }
  }
  return M.build();
}

// ------------------------------------------------------------
// CAPIM / JUNCO / TABOA / MARGARIDA: tufos de lâminas (1 triângulo cada)
// ------------------------------------------------------------
export function capim({ alt = 0.8, laminas = 9, seed = 1, cores = ['musgo', 'folhaClara', 'capimSeco'], cabeca = null, flor = null, abre = 0.35, larg = 0.05 } = {}) {
  const M = new Malha(seed);
  const r = M.r;
  for (let i = 0; i < laminas; i++) {
    const a = r() * 6.28;
    const d = r() * 0.12;
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d;
    const h = alt * (0.6 + r() * 0.5);
    const lean = h * abre * (0.3 + r() * 0.7);
    const px = Math.cos(a + 1.57) * larg;
    const pz = Math.sin(a + 1.57) * larg;
    const tip = [x + Math.cos(a) * lean, h, z + Math.sin(a) * lean];
    const c = mix(cores[i % cores.length], cores[(i + 1) % cores.length], r() * 0.5);
    M.tri([x - px, 0, z - pz], [x + px, 0, z + pz], tip, c, 0, 0, 1);
    if (cabeca && i % 3 === 0) {
      const g = new THREE.CylinderGeometry(0.045, 0.045, 0.22, 5);
      M.add(g, { cor: cabeca, m: pos(tip[0], tip[1] - 0.05, tip[2]), vento: 1 });
    }
    if (flor && i % 3 === 0) {
      const g = new THREE.CircleGeometry(0.09, 5);
      g.rotateX(-Math.PI / 2);
      M.add(g, { cor: flor, m: pos(tip[0], tip[1], tip[2]), vento: 1 });
      const g2 = new THREE.CircleGeometry(0.035, 4);
      g2.rotateX(-Math.PI / 2);
      M.add(g2, { cor: cor('solLaranja'), m: pos(tip[0], tip[1] + 0.01, tip[2]), vento: 1 });
    }
  }
  return M.build();
}

// ------------------------------------------------------------
// TRONCO CAÍDO: cilindro deitado no eixo X (pontas de madeira clara, musgo em cima)
// ------------------------------------------------------------
export function troncoCaido({ meio = 2.3, raio = 0.6, seed = 1, low = false, musgo = true } = {}) {
  const M = new Malha(seed);
  const g = new THREE.CylinderGeometry(raio, raio * 1.08, meio * 2, low ? 5 : 7, 1);
  g.rotateZ(Math.PI / 2);
  const casca = cor('marrom');
  const ponta = cor('madeira');
  const verde = cor('musgo');
  M.add(g, {
    m: pos(0, raio * 0.9, 0),
    jitter: low ? 0 : raio * 0.1,
    corFace: (c, nn) => (Math.abs(nn.x) > 0.85 ? ponta : musgo && nn.y > 0.55 && M.r() < 0.7 ? verde : casca),
  });
  return M.build();
}

// ------------------------------------------------------------
// ÁRVORE MORTA (galhos secos, opcional com neve)
// ------------------------------------------------------------
export function arvoreMorta(alt = 7, { seed = 1, low = false, neve = false, corTronco = 'marrom' } = {}) {
  const M = new Malha(seed);
  const r = M.r;
  const rt = alt * 0.035;
  const base = mix(corTronco, 'pedraClara', 0.35);
  const branca = cor('neve');
  const cf = (c, nn) => (neve && nn.y > 0.45 ? branca : base);
  M.add(new THREE.CylinderGeometry(rt * 0.4, rt, alt, low ? 4 : 6), { m: pos(0, alt / 2, 0), corFace: cf, jitter: low ? 0 : rt * 0.3 });
  const ng = low ? 2 : 5;
  for (let i = 0; i < ng; i++) {
    const a = r() * 6.28;
    const y = alt * (0.4 + r() * 0.5);
    const L = alt * (0.18 + r() * 0.15);
    const p0 = new THREE.Vector3(0, y, 0);
    const p1 = new THREE.Vector3(Math.cos(a) * L, y + L * (0.4 + r() * 0.5), Math.sin(a) * L);
    M.add(cilindroEntre(p0, p1, rt * 0.4, rt * 0.12, 4), { corFace: cf });
  }
  return M.build();
}

// ------------------------------------------------------------
// PEDRAS: pedregulho facetado (raio ~1, altura ~1) e variações de minério
// ------------------------------------------------------------
export function pedregulho({ seed = 1, low = false, cores = ['pedra', 'pedraEscura'], topo = null, veio = null, achata = 0.75 } = {}) {
  const M = new Malha(seed);
  const r = M.r;
  const g = low ? new THREE.IcosahedronGeometry(1, 0) : new THREE.DodecahedronGeometry(1, 0); // longe: icosaedro (octaedro virava pirâmide)
  g.scale(1, achata, 1);
  const cA = cor(cores[0]);
  const cB = cor(cores[1]);
  const cT = topo ? cor(topo) : null;
  const cV = veio ? cor(veio) : null;
  M.add(g, {
    m: pos(0, achata * 0.7, 0),
    jitter: low ? 0.1 : 0.32,
    varia: 0.1,
    corFace: (c, nn) => {
      if (cT && nn.y > 0.55) return cT;
      if (cV && M.r() < 0.28) return cV;
      return M.r() < 0.5 ? cA : cB;
    },
  });
  if (!low) {
    // pedra menor encostada (forma menos "bola")
    const g2 = new THREE.DodecahedronGeometry(0.55, 0);
    g2.scale(1, achata, 1);
    const a = r() * 6.28;
    M.add(g2, { m: pos(Math.cos(a) * 0.8, achata * 0.35, Math.sin(a) * 0.8), jitter: 0.16, varia: 0.1, corFace: (c, nn) => (cT && nn.y > 0.55 ? cT : M.r() < 0.5 ? cA : cB) });
  }
  return M.build();
}

export function cristais({ seed = 1 } = {}) {
  const M = new Malha(seed);
  const r = M.r;
  const c = mix('neve', 'agua', 0.45);
  for (let i = 0; i < 5; i++) {
    const g = new THREE.OctahedronGeometry(0.22 + r() * 0.12, 0);
    g.scale(1, 3 + r() * 1.5, 1);
    g.rotateZ((r() - 0.5) * 0.7);
    g.rotateX((r() - 0.5) * 0.7);
    const a = r() * 6.28;
    M.add(g, { cor: c, m: pos(Math.cos(a) * 0.25, 0.5, Math.sin(a) * 0.25), varia: 0.15 });
  }
  M.add(new THREE.DodecahedronGeometry(0.45, 0), { cor: cor('pedraEscura'), m: pos(0, 0.15, 0), jitter: 0.1 });
  return M.build();
}

export function pedrinhas({ seed = 1 } = {}) {
  const M = new Malha(seed);
  const r = M.r;
  for (let i = 0; i < 5; i++) {
    const a = r() * 6.28;
    const d = 0.1 + r() * 0.25;
    const s = 0.06 + r() * 0.08;
    M.add(new THREE.DodecahedronGeometry(s, 0), { cor: mix('pedra', 'pedraClara', r()), m: pos(Math.cos(a) * d, s * 0.5, Math.sin(a) * d), jitter: s * 0.3 });
  }
  return M.build();
}

export function gravetos({ seed = 1 } = {}) {
  const M = new Malha(seed);
  const r = M.r;
  for (let i = 0; i < 4; i++) {
    const g = new THREE.CylinderGeometry(0.02, 0.025, 0.6 + r() * 0.3, 4);
    g.rotateZ(Math.PI / 2);
    g.rotateY(r() * 6.28);
    M.add(g, { cor: mix('marrom', 'madeira', r()), m: pos((r() - 0.5) * 0.3, 0.03 + i * 0.02, (r() - 0.5) * 0.3) });
  }
  return M.build();
}

export function cogumelos({ seed = 1 } = {}) {
  const M = new Malha(seed);
  const r = M.r;
  for (let i = 0; i < 3; i++) {
    const a = r() * 6.28;
    const d = r() * 0.2;
    const h = 0.08 + r() * 0.12;
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d;
    M.add(new THREE.CylinderGeometry(0.018, 0.024, h, 5), { cor: cor('neve'), m: pos(x, h / 2, z) });
    M.add(new THREE.ConeGeometry(0.07 + r() * 0.04, 0.06, 6), { cor: i % 2 ? cor('ferrugem') : cor('capimSeco'), m: pos(x, h + 0.02, z) });
  }
  return M.build();
}

export function concha({ seed = 1 } = {}) {
  const M = new Malha(seed);
  const g = new THREE.ConeGeometry(0.16, 0.08, 7, 1);
  M.add(g, { m: pos(0, 0.03, 0), corFace: (c, nn) => (M.r() < 0.5 ? cor('neve') : cor('areia')) });
  return M.build();
}

export function vitoriaRegia({ seed = 1 } = {}) {
  const M = new Malha(seed);
  const r = M.r;
  const g = new THREE.CylinderGeometry(0.6, 0.6, 0.03, 9, 1);
  M.add(g, { cor: mix('musgo', 'folhaClara', 0.3), m: pos(0, 0.015, 0) });
  if (r() < 0.4) M.add(new THREE.ConeGeometry(0.1, 0.14, 6), { cor: cor('neve'), m: pos(0.2, 0.09, 0.1) });
  return M.build();
}

// ------------------------------------------------------------
// MANGUE: árvore baixa sobre raízes em arco
// SUMAÚMA: árvore gigante com raízes tabulares (as raízes batem com a colisão: ROOTS em vegetation.js)
// ------------------------------------------------------------
export function mangue({ seed = 1, low = false } = {}) {
  const base = carvalho(8, { seed, low, larg: 1.1, bolas: 5 });
  const M = new Malha(seed + 7);
  const r = M.r;
  const nr = low ? 3 : 6;
  for (let i = 0; i < nr; i++) {
    const a = (i / nr) * 6.28 + r() * 0.4;
    const p0 = new THREE.Vector3(0, 1.6, 0);
    const p1 = new THREE.Vector3(Math.cos(a) * 1.6, -0.2, Math.sin(a) * 1.6);
    M.add(cilindroEntre(p0, p1, 0.12, 0.08, 4), { cor: cor('marrom') });
  }
  return junta(base, M.build());
}

export function sumauma(raizes, { seed = 1, low = false } = {}) {
  const base = carvalho(34, { seed, low, larg: 1.4, achatada: true, bolas: 8, folhas: ['musgo', 'musgoEscuro', 'folhaClara'] });
  const M = new Malha(seed + 3);
  for (const p of raizes) {
    // raiz tabular: lâmina em cunha do tronco até o ponto da colisão
    const d = Math.hypot(p.x, p.z);
    const g = new THREE.BoxGeometry(d, p.top, Math.max(0.25, p.r * 0.6));
    g.translate(d / 2, p.top / 2, 0);
    // afina para fora
    const ps = g.attributes.position;
    for (let i = 0; i < ps.count; i++) if (ps.getX(i) > d * 0.6) ps.setY(i, Math.min(ps.getY(i), p.top * 0.25));
    g.rotateY(-Math.atan2(p.z, p.x));
    M.add(g, { cor: cor('marrom'), varia: 0.06 });
  }
  return junta(base, M.build());
}

function junta(a, b) {
  const g = new THREE.BufferGeometry();
  for (const k of ['position', 'color', 'normal', 'uv', 'aWind']) {
    const A = a.getAttribute(k);
    const B = b.getAttribute(k);
    const arr = new Float32Array(A.array.length + B.array.length);
    arr.set(A.array, 0);
    arr.set(B.array, A.array.length);
    g.setAttribute(k, new THREE.BufferAttribute(arr, A.itemSize));
  }
  g.computeBoundingSphere();
  return g;
}

// ------------------------------------------------------------
// MATERIAL ÚNICO de toda a vegetação low-poly: cor por face, luz facetada,
// dos dois lados (folhas finas) e vento (aWind). As folhas recebem um pouco
// mais de luz ambiente (senão o lado de baixo ficava preto).
// ------------------------------------------------------------
let matVeg = null;
export function materialLowPoly() {
  if (matVeg) return matVeg;
  const m = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide });
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vFolha;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFolha = aWind;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vFolha;')
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
        // >>> folhas: um pouco mais de luz ambiente (luz atravessando a folha)
        reflectedLight.indirectDiffuse *= 1.0 + 0.45 * clamp(vFolha, 0.0, 1.0);`);
  };
  addRelief(m, { amp: 0.03, freq: 1.1, folha: true, fade: [15, 45] }); // casca dos troncos e pedras com relevo
  addWind(m, 0.012, 0.016, 0); // vento bem de leve e nada empurra as plantas do chão quando se passa por cima
  const k = m.customProgramCacheKey;
  m.customProgramCacheKey = () => `${k ? k() : ''}-lowpoly-veg1`;
  matVeg = m;
  return m;
}

// ------------------------------------------------------------
// TABELA: cada tipo de planta/pedra do jogo -> modelo low-poly (perto e médio).
// Os nomes, tamanhos de colisão e recursos continuam os de vegetation.js.
// collider (opcional): novo raio de colisão quando o formato mudou muito.
// ------------------------------------------------------------
export function MODELOS_LOWPOLY(raizes) {
  const L = { low: true };
  const par = (f) => ({ hi: () => f({}), lo: () => f(L) });
  const C = (nome) => PALETA[nome];
  const arv = (alt, o) => par((x) => carvalho(alt, { ...o, ...x }));
  const pin = (alt, o) => par((x) => pinheiro(alt, { ...o, ...x }));
  const pal = (alt, o) => par((x) => palmeira(alt, { ...o, ...x }));
  const ped = (o, extra = {}) => ({ ...par((x) => pedregulho({ ...o, ...x })), ...extra });
  const so = (f) => ({ hi: f, lo: f });
  return {
    // árvores da mata e do campo
    sumauma: par((x) => sumauma(raizes, { seed: 40, ...x })),
    arvore_dossel: arv(24, { seed: 41, achatada: true, larg: 1.15, bolas: 7 }),
    arvore_media: arv(10, { seed: 42, larg: 0.9, bolas: 4 }),
    copa_a: arv(30, { seed: 5, achatada: true, larg: 1.15, bolas: 7, grosso: 1.1 }),
    copa_b: arv(37, { seed: 6, achatada: true, larg: 1.25, bolas: 8, grosso: 1.1 }),
    copa_c: arv(25.8, { seed: 7, achatada: true, larg: 1.1, bolas: 7 }),
    copa_g_a: arv(47.8, { seed: 8, achatada: true, larg: 1.3, bolas: 9, grosso: 1.6 }),
    copa_g_b: arv(45.7, { seed: 9, achatada: true, larg: 1.3, bolas: 9, grosso: 1.5 }),
    media_a: arv(13.8, { seed: 10, larg: 0.85 }),
    media_b: arv(16.9, { seed: 11, larg: 0.85 }),
    arvore_bl_a: arv(22, { seed: 14 }),
    arvore_bl_b: arv(22, { seed: 15, folhas: ['folhaClara', 'musgo', 'capimSeco'] }),
    arvore_bl_c: arv(22, { seed: 16, folhas: ['musgoEscuro', 'musgo', 'folhaClara'] }),
    arvore_folhosa: arv(15, { seed: 17 }),
    arvore_folhosa2: arv(11, { seed: 18, larg: 0.9 }),
    arvore_agar: arv(24, { seed: 19, larg: 0.9, achatada: true }),
    mangue: par((x) => mangue({ seed: 43, ...x })),
    // pinheiros (verdes e com neve)
    pinheiro: pin(14, { seed: 24 }),
    pinheiro_vd_a: pin(24.9, { seed: 27 }),
    pinheiro_vd_b: pin(19.9, { seed: 28 }),
    pinheiro_neve: pin(14, { seed: 25, neve: true }),
    pinheiro_nv_a: pin(22.9, { seed: 29, neve: true }),
    pinheiro_nv_b: pin(27.9, { seed: 30, neve: true }),
    pinheiro_nv_c: pin(18.9, { seed: 31, neve: true }),
    // palmeiras
    coqueiro: pal(11, { seed: 1, curva: 0.18 }),
    palma_bl_a: pal(14.2, { seed: 2, curva: 0.12 }),
    palma_bl_b: pal(11, { seed: 3, curva: 0.2 }),
    palma_bl_c: pal(16.1, { seed: 4, curva: 0.08 }),
    tamareira: pal(8.5, { seed: 12, curva: 0.05, folhas: 10, larg: 0.8, caida: 0.45, cocos: false }),
    tamareira2: pal(7, { seed: 13, curva: 0.07, folhas: 9, larg: 0.8, caida: 0.5, cocos: false }),
    acai: pal(13, { seed: 44, curva: 0.04, folhas: 7, cocos: false, larg: 0.45, caida: 0.85, tronco: ['marrom', 'marrom'] }),
    bananeira: par((x) => bananeira({ seed: 45, cacho: true, ...x })),
    bananeira_vazia: par((x) => bananeira({ seed: 45, cacho: false, ...x })),
    samambaia_gigante: par((x) => samambaiaGigante({ seed: 46, ...x })),
    // mortas e secas
    arvore_morta: par((x) => arvoreMorta(7, { seed: 47, ...x })),
    arvore_morta_neve: par((x) => arvoreMorta(10, { seed: 48, neve: true, ...x })),
    arvore_seca: par((x) => arvoreMorta(5, { seed: 49, neve: true, ...x })),
    // arbustos (bagas: a cor de cada tipo)
    // todos os arbustos são iguais (sem fruta à mostra); o que cada um dá ao colher
    // fica em recursos.json (baga_mejo, baga_escura, frutas, arbusto...)
    arbusto_mejo: par((x) => arbusto({ seed: 53, ...x })),
    arbusto_escura: par((x) => arbusto({ seed: 53, ...x })),
    arbusto_frutas: par((x) => arbusto({ seed: 53, ...x })),
    arbusto: par((x) => arbusto({ seed: 53, ...x })),
    arbusto_neve: par((x) => arbusto({ seed: 54, neve: true, folhas: ['musgoEscuro', 'pedraEscura'], raio: 0.6, ...x })),
    // capins, juncos e flores
    capim: so(() => capim({ alt: 0.8, laminas: 8, seed: 60 })),
    plantinha: par((x) => plantinha({ seed: 70, brotos: x.low ? 4 : 7 })),
    capim_bq_a: so(() => capim({ alt: 0.9, laminas: 9, seed: 61 })),
    capim_bq_d: so(() => capim({ alt: 0.8, laminas: 8, seed: 62, cores: ['folhaClara', 'capimSeco', 'musgo'] })),
    margarida_bq: so(() => capim({ alt: 0.6, laminas: 7, seed: 63, flor: C('neve') })),
    capim_praia: so(() => capim({ alt: 0.9, laminas: 7, seed: 64, cores: ['capimSeco', 'folhaClara'] })),
    planta_praia: so(() => capim({ alt: 1.0, laminas: 8, seed: 65, cores: ['folhaClara', 'musgo', 'capimSeco'], abre: 0.6, larg: 0.09 })),
    junco: so(() => capim({ alt: 1.6, laminas: 10, seed: 66, abre: 0.15, larg: 0.035 })),
    taboa: so(() => capim({ alt: 1.7, laminas: 9, seed: 67, cabeca: C('marrom'), abre: 0.12, larg: 0.04 })),
    samambaia: so(() => samambaia({ tam: 0.9, seed: 68 })),
    vitoria_regia: so(() => vitoriaRegia({ seed: 69 })),
    // chão
    tronco_caido: par((x) => troncoCaido({ meio: 2.3, raio: 0.7, seed: 70, ...x })),
    tronco_pinho: par((x) => troncoCaido({ meio: 4.3, raio: 0.45, seed: 71, musgo: false, ...x })),
    pedrinhas: so(() => pedrinhas({ seed: 72 })),
    gravetos: so(() => gravetos({ seed: 73 })),
    cogumelos: so(() => cogumelos({ seed: 74 })),
    concha: so(() => concha({ seed: 75 })),
    cristal: so(() => cristais({ seed: 76 })),
    // pedras (raio ~1 e altura ~1 antes da escala)
    rochedo: ped({ seed: 80 }),
    rochedo_camadas: ped({ seed: 81, cores: ['pedra', 'pedraClara'], achata: 0.95 }, { collider: 1.2 }),
    rochedo_camadas_b: ped({ seed: 82, cores: ['pedraEscura', 'pedra'], topo: 'musgo', achata: 0.85 }, { collider: 1.2 }),
    rochedo_camadas_c: ped({ seed: 83, cores: ['pedra', 'pedraEscura'], achata: 1.0 }, { collider: 1.2 }),
    pedra_musgo: ped({ seed: 84, topo: 'musgo', achata: 0.7 }),
    rocha_metal: ped({ seed: 85, cores: ['pedraEscura', 'pedra'], veio: 'pedraClara' }),
    minerio_ferro: ped({ seed: 86, cores: ['pedra', 'pedraEscura'], veio: 'ferrugem' }),
    rocha_obsidiana: ped({ seed: 87, cores: ['ceuNoite', 'pedraEscura'], achata: 0.9 }),
    rocha_petroleo: ped({ seed: 88, cores: ['terraEscura', 'pedraEscura'], veio: 'ceuNoite', achata: 0.6 }),
  };
}
