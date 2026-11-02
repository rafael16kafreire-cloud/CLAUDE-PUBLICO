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

let mats = null;
function mat() {
  if (mats) return mats;
  const clava = madeiraTex('#7a5634', 51, [1, 1]);
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
export function makeClub() {
  const M = materiais();
  const X = mat();
  const g = new THREE.Group();
  // perfil (raio, altura): cabo fino, pescoço, cabeça bojuda, topo arredondado
  const P = [
    [0.012, -0.095], [0.026, -0.092], [0.022, -0.08], [0.0195, -0.02], [0.0205, 0.1], [0.022, 0.18],
    [0.03, 0.235], [0.05, 0.285], [0.067, 0.335], [0.07, 0.385], [0.06, 0.44], [0.04, 0.475], [0.012, 0.495], [0.0, 0.5],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const geo = new THREE.LatheGeometry(P, 22);
  const p = geo.attributes.position;
  const rnd = rng(61);
  const cache = new Map();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const a = Math.atan2(z, x);
    const cab = Math.min(1, Math.max(0, (y - 0.2) / 0.1)); // só a cabeça é irregular
    const key = `${a.toFixed(2)},${y.toFixed(2)}`;
    if (!cache.has(key)) cache.set(key, 1 + (rnd() - 0.5) * 0.16 * cab);
    const k = cache.get(key) * (1 + 0.13 * cab * Math.sin(a * 3 + y * 22) + 0.07 * cab * Math.sin(a * 5 - y * 31 + 1.7));
    p.setX(i, x * k + 0.006 * Math.sin(y * 7)); // levemente torto
    p.setZ(i, z * k);
  }
  geo.computeVertexNormals();
  const tronco = new THREE.Mesh(geo, X.clava);
  g.add(tronco);
  // lascas de sílex cravadas na cabeça (pontas para fora)
  const rs = rng(77);
  for (let i = 0; i < 11; i++) {
    const a = rs() * Math.PI * 2;
    const y = 0.3 + rs() * 0.15;
    const rr = 0.066 * (y > 0.43 ? 0.7 : 1);
    const c = new THREE.Mesh(new THREE.ConeGeometry(0.0125 + rs() * 0.006, 0.05 + rs() * 0.02, 4), X.silex);
    c.position.set(Math.cos(a) * rr, y, Math.sin(a) * rr);
    c.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(Math.cos(a), 0.3, Math.sin(a)).normalize());
    c.position.addScaledVector(new THREE.Vector3(Math.cos(a), 0.3, Math.sin(a)).normalize(), 0.012);
    g.add(c);
  }
  // pegada: tiras de couro enroladas
  for (let i = 0; i < 14; i++) {
    const y = -0.03 + i * 0.0105;
    const pts = [];
    for (let q = 0; q < 20; q++) {
      const a = (q / 20) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * 0.0215, y, Math.sin(a) * 0.0215));
    }
    g.add(tuboFita(pts, true, 0.0044, M.tira, [1, 1.5, 1]));
  }
  // alça de corda no pé do cabo
  const alca = [];
  for (let i = 0; i <= 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    alca.push(new THREE.Vector3(0.0, -0.085 - 0.07 * (1 - Math.cos(a)) * 0.5 * 1.2, 0.034 + 0.04 * Math.sin(a)));
  }
  g.add(tuboFita(alca, true, 0.0035, M.tira, [3, 1, 1]));
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

export function makeBow() {
  const M = materiais();
  const X = mat();
  const g = new THREE.Group();
  const H = 0.37; // meia altura do arco
  const zAt = (y) => {
    const u = Math.abs(y) / H;
    // curva em D e ponta invertida (recurva) perto das pontas
    return 0.2 * u * u - 0.07 * Math.max(0, u - 0.78) ** 2 * 9;
  };
  const pts = [];
  for (let i = 0; i <= 28; i++) {
    const y = -H + (2 * H * i) / 28;
    pts.push(new THREE.Vector3(0, y, zAt(y)));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const wf = (t) => 0.0125 * (1 - Math.abs(2 * t - 1) ** 1.6 * 0.58) + 0.005; // mais largo no meio
  const tf = (t) => 0.0085 * (1 - Math.abs(2 * t - 1) ** 1.3 * 0.45) + 0.003;
  g.add(new THREE.Mesh(membro(curve, wf, tf), X.arco));
  // pegada de couro (com sobras) e prateleira da flecha
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.0225, 0.0225, 0.12, 14), M.tira);
  grip.position.set(0, 0, 0);
  g.add(grip);
  for (const dy of [-0.065, -0.035, 0.035, 0.065]) {
    const r = new THREE.Mesh(new THREE.TorusGeometry(0.0228, 0.0032, 4, 14), M.tira);
    r.rotation.x = Math.PI / 2;
    r.position.y = dy;
    g.add(r);
  }
  const prateleira = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.012, 0.03), X.arco);
  prateleira.position.set(0, 0.075, -0.008);
  g.add(prateleira);
  // pontas: entalhe com pontinha de osso/madeira clara
  const topZ = zAt(H);
  for (const s of [-1, 1]) {
    const nock = new THREE.Mesh(new THREE.ConeGeometry(0.0085, 0.03, 8), X.haste);
    nock.position.set(0, s * (H + 0.012), topZ - 0.006);
    nock.rotation.x = s > 0 ? -0.35 : Math.PI + 0.35;
    g.add(nock);
  }
  // corda de fibra, de ponta a ponta, com trançado no meio
  const corda = new THREE.Mesh(new THREE.CylinderGeometry(0.0028, 0.0028, 2 * H, 4), X.corda);
  corda.position.set(0, 0, topZ - 0.006);
  g.add(corda);
  const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.0055, 0.0055, 0.07, 6), X.corda);
  tr.position.set(0, 0, topZ - 0.006);
  g.add(tr);
  // flecha de sílex encaixada na corda, apontando para a frente (-Z)
  const zb = topZ - 0.006; // atrás (na corda)
  const compr = 0.62;
  const haste = new THREE.Mesh(new THREE.CylinderGeometry(0.0042, 0.0042, compr, 6).rotateX(Math.PI / 2), X.haste);
  haste.position.set(0, 0.0, zb - compr / 2);
  g.add(haste);
  const ponta = new THREE.Mesh(new THREE.ConeGeometry(0.0095, 0.05, 4).rotateX(-Math.PI / 2), X.silex);
  ponta.position.set(0, 0, zb - compr - 0.02);
  g.add(ponta);
  for (let k = 0; k < 3; k++) { // penas
    const pena = new THREE.Mesh(new THREE.PlaneGeometry(0.075, 0.017), k === 0 ? X.penaEscura : X.pena);
    pena.position.set(0, 0, zb - 0.055);
    pena.rotation.z = (k * Math.PI * 2) / 3;
    pena.position.x = Math.sin(pena.rotation.z) * 0.007;
    pena.position.y = -Math.cos(pena.rotation.z) * 0.007;
    pena.rotation.set(0, Math.PI / 2, pena.rotation.z);
    g.add(pena);
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  return g;
}
