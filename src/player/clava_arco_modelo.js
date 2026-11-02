// =============================================================
// CLAVA E ARCO (modelos detalhados), no mesmo estilo dos machados, picaretas e lanças.
//  - clava: tronco duro e nodoso, cabeça grossa e irregular com cascas e queimados,
//           lascas de sílex cravadas, pegada de couro e alça de corda no pé do cabo.
//  - arco : arco longo de madeira (tábua achatada, afinando para as pontas com curva invertida),
//           pegada de couro com prateleira da flecha, entalhes nas pontas, corda de fibra com
//           trançado no meio e uma flecha de sílex encaixada.
// Mesma orientação dos modelos antigos: clava com o cabo ao longo de +Y (mão em y≈-0.08);
// arco com o meio na mão, em pé (plano Y-Z), pontas e corda para +Z (para perto de quem atira).
// =============================================================
import * as THREE from 'three';
import { materiais, tuboFita, rng, canvasTex, madeiraTex } from './machado_modelo.js';
import ARCO from './imported/arco.js';

let mats = null;
function mat() {
  if (mats) return mats;
  const clava = canvasTex(256, (g, N) => {
    const r = rng(51);
    g.fillStyle = '#3a2a20';
    g.fillRect(0, 0, N, N);
    for (let i = 0; i < 160; i++) { // casca: sulcos compridos, claros e escuros
      const x = r() * N;
      g.strokeStyle = r() < 0.55 ? `rgba(20,12,8,${0.25 + r() * 0.3})` : `rgba(120,98,76,${0.1 + r() * 0.2})`;
      g.lineWidth = 1 + r() * 2.5;
      g.beginPath();
      g.moveTo(x, r() * N * 0.4);
      g.bezierCurveTo(x + 6, N * 0.4, x - 6, N * 0.7, x + (r() - 0.5) * 10, N);
      g.stroke();
    }
    for (let i = 0; i < 1100; i++) {
      const v = 30 + r() * 90;
      g.fillStyle = `rgba(${v + 10},${v},${v - 8},0.25)`;
      g.fillRect(r() * N, r() * N, 1 + r() * 2, 1 + r() * 6);
    }
  }, [1, 1]);
  const arco = madeiraTex('#8a5a30', 53, [1, 3]);
  const sílex = canvasTex(128, (g, N) => {
    const r = rng(7);
    g.fillStyle = '#4e4238';
    g.fillRect(0, 0, N, N);
    for (let i = 0; i < 40; i++) {
      const x = r() * N;
      const y = r() * N;
      const R = 6 + r() * 26;
      const gr = g.createRadialGradient(x, y, 0, x, y, R);
      const tom = r() < 0.5 ? '24,20,18' : '150,124,90';
      gr.addColorStop(0, `rgba(${tom},0.55)`);
      gr.addColorStop(1, `rgba(${tom},0)`);
      g.fillStyle = gr;
      g.fillRect(x - R, y - R, R * 2, R * 2);
    }
  }, [1, 1]);
  const std = (o) => new THREE.MeshStandardMaterial(o);
  mats = {
    clava: std({ map: clava, bumpMap: clava, bumpScale: 2.4, roughness: 0.9 }),
    arco: std({ map: arco, bumpMap: arco, bumpScale: 1.4, roughness: 0.5 }),
    silex: std({ map: sílex, bumpMap: sílex, bumpScale: 2, roughness: 0.4, flatShading: true }),
    corda: std({ color: '#d6c79a', roughness: 0.9 }),
    pena: std({ color: '#e9dfc6', roughness: 0.9, side: THREE.DoubleSide }),
    penaEscura: std({ color: '#7a4a32', roughness: 0.9, side: THREE.DoubleSide }),
    haste: std({ color: '#b88a58', roughness: 0.85 }),
  };
  return mats;
}

// ------------------------------------------------------------------ CLAVA
// Clava longa de madeira escura e áspera (casca grossa), fina na pegada com cordão enrolado,
// engrossando suave até a cabeça comprida e arredondada.
export function makeClub() {
  const M = materiais();
  const X = mat();
  const g = new THREE.Group();
  const P = [
    [0.004, -0.1], [0.022, -0.098], [0.025, -0.09], [0.0175, -0.075], [0.0165, -0.02], [0.0175, 0.1], [0.0185, 0.17],
    [0.027, 0.22], [0.04, 0.29], [0.05, 0.37], [0.056, 0.45], [0.056, 0.52], [0.05, 0.58], [0.036, 0.625], [0.014, 0.65], [0.0, 0.655],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const geo = new THREE.LatheGeometry(P, 26);
  const p = geo.attributes.position;
  const rnd = rng(61);
  const cache = new Map();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const a = Math.atan2(z, x);
    const cab = Math.min(1, Math.max(0, (y - 0.15) / 0.2));
    const key = `${a.toFixed(2)},${y.toFixed(2)}`;
    if (!cache.has(key)) cache.set(key, 1 + (rnd() - 0.5) * 0.09 * cab);
    // casca: sulcos compridos e irregulares + leve curvatura do tronco
    const k = cache.get(key) * (1 + 0.05 * cab * Math.sin(a * 7 + y * 9) + 0.03 * cab * Math.sin(a * 13 - y * 17));
    p.setX(i, x * k + 0.012 * Math.sin(y * 4.2));
    p.setZ(i, z * k + 0.006 * Math.sin(y * 3.1 + 1));
  }
  geo.computeVertexNormals();
  g.add(new THREE.Mesh(geo, X.clava));
  // cordão escuro enrolado na pegada (voltas apertadas)
  for (let i = 0; i < 17; i++) {
    const y = -0.07 + i * 0.0095;
    const pts = [];
    for (let q = 0; q < 20; q++) {
      const a = (q / 20) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * 0.0182, y, Math.sin(a) * 0.0182));
    }
    g.add(tuboFita(pts, true, 0.0042, M.cordao, [1, 1.5, 1]));
  }
  // sobra do cordão no fim da pegada
  const sobra = new THREE.CatmullRomCurve3([new THREE.Vector3(0.0185, 0.09, 0), new THREE.Vector3(0.03, 0.075, 0.01), new THREE.Vector3(0.028, 0.045, 0.02)]);
  g.add(new THREE.Mesh(new THREE.TubeGeometry(sobra, 10, 0.003, 4, false), M.cordao));
  g.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  return g;
}

// ------------------------------------------------------------------ ARCO
// Varre uma seção achatada (largura x, espessura z) ao longo de uma curva, afinando para as pontas.
function membro(curve, wf, tf, n = 40) {
  const seg = 8;
  const pos = [];
  const idx = [];
  const nrm = new THREE.Vector3();
  const T = new THREE.Vector3();
  const side = new THREE.Vector3(1, 0, 0);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const c = curve.getPoint(t);
    curve.getTangent(t, T);
    nrm.crossVectors(side, T).normalize(); // perpendicular no plano Y-Z
    const w = wf(t);
    const th = tf(t);
    for (let q = 0; q < seg; q++) {
      const a = (q / seg) * Math.PI * 2;
      const cx = Math.cos(a) * w;
      const cz = Math.sin(a) * th;
      pos.push(c.x + cx, c.y + nrm.y * cz, c.z + nrm.z * cz);
    }
  }
  for (let i = 0; i < n; i++) {
    for (let q = 0; q < seg; q++) {
      const a = i * seg + q;
      const b = i * seg + ((q + 1) % seg);
      idx.push(a, b, a + seg, b, b + seg, a + seg);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const uv = [];
  for (let i = 0; i <= n; i++) for (let q = 0; q < seg; q++) uv.push(q / seg, i / n);
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

const b64 = (t, Ctor) => {
  const bin = atob(t);
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return new Ctor(u.buffer);
};
const carrega = (url, srgb) => {
  const t = new THREE.TextureLoader().load(url);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
};

// Arco e flecha de verdade: modelo "Bow and Arrow" de Amatsukast (CC BY-NC-SA 4.0, Sketchfab).
// Arco em pé (Y para cima), meio na mão, corda do lado do arqueiro (+Z); flecha encaixada apontando para -Z.
let arcoCache = null;
function arcoDados() {
  if (arcoCache) return arcoCache;
  const T = ARCO.tex;
  const mk = (nome, cor, normal, rough, metal, extra = {}) => {
    const m = new THREE.MeshStandardMaterial({
      map: carrega(T[cor], true), normalMap: carrega(T[normal], false),
      roughnessMap: rough ? carrega(T[rough], false) : null, metalnessMap: metal ? carrega(T[metal], false) : null,
      roughness: 1, metalness: metal ? 0.3 : 0, ...extra,
    });
    m.name = nome;
    return m;
  };
  const mats = {
    bow_bow_wood_mt_0: mk('arco_madeira', 'bow_wood_cor', 'bow_wood_normal', 'bow_wood_rough', null),
    bow_bow_metal_mt_0: mk('arco_metal', 'bow_metal_cor', 'bow_metal_normal', 'bow_metal_rough', 'bow_metal_metal', { metalness: 0.3 }),
    arrow_arrow_mt_0: mk('flecha', 'arrow_cor', 'arrow_normal', 'arrow_rough', 'arrow_metal', { metalness: 0.15 }),
    arrow_wing_mt_0: mk('pena', 'wing_cor', 'wing_normal', null, null, { transparent: false, alphaTest: 0.4, side: THREE.DoubleSide }),
  };
  const geos = {};
  for (const [k, m] of Object.entries(ARCO.malhas)) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(b64(m.p, Float32Array), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(b64(m.n, Float32Array), 3));
    g.setAttribute('uv', new THREE.BufferAttribute(b64(m.uv, Float32Array), 2));
    g.setIndex(new THREE.BufferAttribute(b64(m.i, Uint16Array), 1));
    g.computeBoundingSphere();
    geos[k] = g;
  }
  arcoCache = { mats, geos };
  return arcoCache;
}

export function makeBow() {
  const { mats: MA, geos } = arcoDados();
  const g = new THREE.Group();
  for (const k of Object.keys(geos)) {
    const m = new THREE.Mesh(geos[k], MA[k]);
    m.frustumCulled = false;
    g.add(m);
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  return g;
}
