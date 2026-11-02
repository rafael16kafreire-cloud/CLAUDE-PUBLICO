// =============================================================
// PICARETAS E LANÇAS (modelos detalhados), no mesmo estilo dos três machados
//  - picareta_pedra : cabo chato de madeira clara + pedra comprida e pontuda amarrada por cima,
//                     com tiras de couro cru.
//  - picareta_silex : picareta de batalha negra (obsidiana): cabeça em arco com pontas prateadas,
//                     encaixe esculpido, cabo de cordão negro com argolas e ponteira.
//  - picareta_metal : picareta de aço forjado com cabeça em arco, olho com rebites, cabo curvo
//                     avermelhado e alça de couro.
//  - lanca          : haste de madeira clara com ponta de sílex lascado amarrada com fibra.
//  - lanca_osso     : haste escura com ponta longa de osso (com farpas), tiras de couro e um dente
//                     pendurado por uma cordinha.
// Orientação: cabo ao longo de +Y (mão em y≈-0.08); a cabeça da picareta fica ao longo de Z.
// =============================================================
import * as THREE from 'three';
import { materiais, caboLathe, perfil, tuboFita, rng, canvasTex, madeiraTex } from './machado_modelo.js';

let extra = null;
function materiaisExtra() {
  if (extra) return extra;
  const osso = canvasTex(256, (g, N) => {
    const r = rng(41);
    g.fillStyle = '#e4d9bf';
    g.fillRect(0, 0, N, N);
    for (let i = 0; i < 160; i++) { // veios ao longo do osso
      g.strokeStyle = `rgba(${150 + r() * 40},${130 + r() * 40},${96 + r() * 30},${0.12 + r() * 0.2})`;
      g.lineWidth = 1;
      const x = r() * N;
      g.beginPath();
      g.moveTo(x, 0);
      g.bezierCurveTo(x + 5, N * 0.3, x - 5, N * 0.7, x + (r() - 0.5) * 8, N);
      g.stroke();
    }
    for (let i = 0; i < 500; i++) {
      g.fillStyle = `rgba(110,90,60,${r() * 0.25})`;
      g.fillRect(r() * N, r() * N, 1, 1 + r() * 2);
    }
  }, [1, 2]);
  const silex = canvasTex(256, (g, N) => {
    const r = rng(43);
    g.fillStyle = '#5a4a3c';
    g.fillRect(0, 0, N, N);
    for (let i = 0; i < 60; i++) {
      const x = r() * N;
      const y = r() * N;
      const R = 8 + r() * 40;
      const gr = g.createRadialGradient(x, y, 0, x, y, R);
      const tom = r() < 0.5 ? '30,26,24' : '150,128,96';
      gr.addColorStop(0, `rgba(${tom},0.5)`);
      gr.addColorStop(1, `rgba(${tom},0)`);
      g.fillStyle = gr;
      g.fillRect(x - R, y - R, R * 2, R * 2);
    }
    for (let i = 0; i < 900; i++) {
      const v = 40 + r() * 140;
      g.fillStyle = `rgba(${v},${v - 6},${v - 18},0.4)`;
      g.fillRect(r() * N, r() * N, 1 + r() * 2, 1 + r() * 2);
    }
  }, [1, 1]);
  const madeiraLanca = madeiraTex('#b99466', 21, [1, 6]);
  const madeiraLancaEscura = madeiraTex('#5a3f2a', 22, [1, 6]);
  const std = (o) => new THREE.MeshStandardMaterial(o);
  extra = {
    osso: std({ map: osso, bumpMap: osso, bumpScale: 1.2, roughness: 0.55 }),
    silex: std({ map: silex, bumpMap: silex, bumpScale: 2.4, roughness: 0.4, metalness: 0.05, flatShading: true }),
    hasteClara: std({ map: madeiraLanca, bumpMap: madeiraLanca, bumpScale: 1.4, roughness: 0.88 }),
    hasteEscura: std({ map: madeiraLancaEscura, bumpMap: madeiraLancaEscura, bumpScale: 1.2, roughness: 0.6 }),
  };
  return extra;
}

// tábua chata de madeira clara (cabo da picareta de pedra): de y=-0.1 a y=yTopo
function tabua(yTopo, larg = 0.044, esp = 0.021) {
  const M = materiais();
  const len = yTopo + 0.1;
  const box = new THREE.BoxGeometry(esp, len, larg, 3, 22, 3);
  const bp = box.attributes.position;
  const r = rng(7);
  for (let i = 0; i < bp.count; i++) {
    const y = bp.getY(i);
    const t = (y + len / 2) / len;
    if (t < 0.16) {
      const k = 0.35 + (t / 0.16) * 0.65;
      bp.setZ(i, bp.getZ(i) * k);
      bp.setX(i, bp.getX(i) * (0.55 + 0.45 * (t / 0.16)));
    }
    bp.setX(i, bp.getX(i) + (r() - 0.5) * 0.0022 + 0.003 * Math.sin(y * 9));
    bp.setZ(i, bp.getZ(i) + (r() - 0.5) * 0.0022 + 0.004 * Math.sin(y * 6 + 1));
    bp.setY(i, y + len / 2 - 0.1);
  }
  box.computeVertexNormals();
  const uvp = box.attributes.uv;
  for (let i = 0; i < uvp.count; i++) uvp.setXY(i, uvp.getX(i), uvp.getY(i) * 1.6);
  return new THREE.Mesh(box, M.madeiraClara);
}

// cabeça de picareta em arco, ao longo de Z (pontas em +Z e -Z, curvando para baixo)
function arcoPicareta(yc, { meio = 0.2, alt = 0.12, esp = 0.03, mat, corFio = null, base }) {
  const sh = new THREE.Shape();
  sh.moveTo(meio, -0.075);
  sh.quadraticCurveTo(0.0, alt, -meio, -0.075); // por cima
  sh.quadraticCurveTo(0.0, -0.016, meio, -0.075); // por baixo
  const kf = (s) => Math.pow(Math.max(0, 1 - Math.abs(s) / meio), 0.75);
  const geo = perfil(sh, { depth: esp, bevel: 0.004, kf, corFio, base: base ?? [1, 1, 1] });
  const m = new THREE.Mesh(geo, mat);
  m.position.y = yc;
  return m;
}

// ---------------- PICARETA DE PEDRA ----------------
function picaretaPedra() {
  const M = materiais();
  const g = new THREE.Group();
  const topo = 0.52;
  g.add(tabua(topo + 0.02));
  // pedra comprida e pontuda, deitada por cima do cabo (ao longo de Z)
  const ico = new THREE.IcosahedronGeometry(0.1, 2);
  const ip = ico.attributes.position;
  const r2 = rng(19);
  const jit = new Map();
  for (let i = 0; i < ip.count; i++) {
    const key = `${ip.getX(i).toFixed(3)},${ip.getY(i).toFixed(3)},${ip.getZ(i).toFixed(3)}`;
    if (!jit.has(key)) jit.set(key, 0.86 + r2() * 0.28);
    const k = jit.get(key);
    const z = ip.getZ(i); // -0.1..0.1
    const afina = Math.pow(Math.max(0.12, 1 - Math.abs(z) / 0.115), 0.9); // pontas
    ip.setXYZ(i, ip.getX(i) * 0.5 * k * afina, ip.getY(i) * 0.62 * k * afina, z * 2.0 * k);
  }
  ico.computeVertexNormals();
  const pu = new Float32Array(ip.count * 2);
  for (let i = 0; i < ip.count; i++) { pu[i * 2] = ip.getZ(i) * 4 + ip.getX(i) * 3; pu[i * 2 + 1] = ip.getY(i) * 6; }
  ico.setAttribute('uv', new THREE.BufferAttribute(pu, 2));
  const ng = ico.toNonIndexed();
  ng.computeVertexNormals();
  const pedra = new THREE.Mesh(ng, M.pedra);
  pedra.position.set(0, topo + 0.045, 0);
  pedra.rotation.set(0.04, 0, 0.05);
  g.add(pedra);
  // tiras de couro: voltas em volta do cabo, logo abaixo da pedra...
  for (let i = 0; i < 9; i++) {
    const y = topo - 0.06 + i * 0.0095;
    const pts = [];
    for (let q = 0; q < 24; q++) {
      const a = (q / 24) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.sign(Math.cos(a)) * Math.abs(Math.cos(a)) ** 0.7 * 0.0225, y, Math.sign(Math.sin(a)) * Math.abs(Math.sin(a)) ** 0.7 * 0.0285));
    }
    g.add(tuboFita(pts, true, 0.005, M.tira, [1, 1.7, 1]));
  }
  // ...e duas voltas prendendo a pedra ao topo (uma de cada lado do cabo)
  for (const sz of [-1, 1]) {
    for (let k = 0; k < 3; k++) {
      const pts = [];
      for (let q = 0; q < 24; q++) {
        const a = (q / 24) * Math.PI * 2;
        pts.push(new THREE.Vector3(Math.cos(a) * 0.032, topo + 0.03 + Math.sin(a) * 0.036, sz * (0.03 + k * 0.01)));
      }
      g.add(tuboFita(pts, true, 0.0042, M.tira, [1, 1, 1.6]));
    }
  }
  const solta = new THREE.CatmullRomCurve3([new THREE.Vector3(0.022, topo - 0.05, 0.02), new THREE.Vector3(0.036, topo - 0.08, 0.034), new THREE.Vector3(0.03, topo - 0.12, 0.04)]);
  g.add(new THREE.Mesh(new THREE.TubeGeometry(solta, 12, 0.003, 4, false), M.tira));
  return g;
}

// ---------------- PICARETA DE OBSIDIANA (batalha negra) ----------------
function picaretaObsidiana() {
  const M = materiais();
  const g = new THREE.Group();
  const topo = 0.58;
  g.add(new THREE.Mesh(caboLathe({ y0: -0.11, y1: topo + 0.02, r: (t) => 0.0215 + (t < 0.03 ? -0.004 : 0) }), M.cordao));
  for (const dy of [0.09, 0.22, 0.4]) {
    const a = new THREE.Mesh(new THREE.TorusGeometry(0.0232, 0.0042, 5, 18), M.prata);
    a.rotation.x = Math.PI / 2;
    a.position.y = dy;
    g.add(a);
  }
  const disco = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.027, 0.014, 16), M.negroLiso);
  disco.position.y = -0.112;
  const ponta = new THREE.Mesh(new THREE.ConeGeometry(0.026, 0.06, 12), M.negroLiso);
  ponta.rotation.x = Math.PI;
  ponta.position.y = -0.152;
  g.add(disco, ponta);
  // cabeça em arco longo, pontas prateadas
  g.add(arcoPicareta(topo - 0.02, { meio: 0.26, alt: 0.14, esp: 0.03, mat: M.negro, corFio: [2.4, 2.45, 2.6], base: [0.85, 0.88, 1.0] }));
  // encaixe esculpido
  const bloco = new THREE.Mesh(new THREE.BoxGeometry(0.056, 0.1, 0.086), M.negroLiso);
  bloco.position.set(0, topo - 0.03, 0);
  const placa = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.07, 0.05), M.prata);
  placa.position.set(0, topo - 0.03, 0);
  placa.scale.setScalar(0.8);
  const colar = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.025, 0.035, 16), M.negroLiso);
  colar.position.y = topo - 0.095;
  const anel = new THREE.Mesh(new THREE.TorusGeometry(0.027, 0.004, 5, 18), M.prata);
  anel.rotation.x = Math.PI / 2;
  anel.position.y = topo - 0.116;
  g.add(bloco, placa, colar, anel);
  // espigão curto no topo
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.024, 0.028, 12), M.negroLiso);
  base.position.y = topo + 0.052;
  const esp = new THREE.Mesh(new THREE.ConeGeometry(0.016, 0.09, 8), M.negroLiso);
  esp.position.y = topo + 0.11;
  g.add(base, esp);
  return g;
}

// ---------------- PICARETA DE METAL (aço forjado, cabo vermelho) ----------------
function picaretaMetal() {
  const M = materiais();
  const g = new THREE.Group();
  const topo = 0.54;
  g.add(new THREE.Mesh(
    caboLathe({
      y0: -0.1, y1: topo + 0.03, curva: 0.03, oval: 1.18,
      r: (t) => {
        let r = 0.019 + 0.012 * Math.exp(-(((t - 0.0) / 0.1) ** 2)) + 0.007 * Math.exp(-(((t - 0.93) / 0.12) ** 2));
        r += 0.0025 * Math.sin(t * 5);
        if (t < 0.02) r *= 0.9 + t * 5;
        return r;
      },
    }),
    M.madeiraVerm,
  ));
  // cabeça de aço em arco, com chanfro nas pontas e riscos de lima
  g.add(arcoPicareta(topo - 0.02, { meio: 0.24, alt: 0.12, esp: 0.026, mat: M.aco, corFio: [1.5, 1.55, 1.65], base: [0.95, 0.97, 1.0] }));
  const olho = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.088, 0.07), M.aco);
  olho.position.set(0, topo - 0.02, 0);
  g.add(olho);
  for (const sx of [-1, 1]) for (const dz of [-0.022, 0.022]) {
    const rb = new THREE.Mesh(new THREE.SphereGeometry(0.0065, 8, 6), M.prata);
    rb.position.set(sx * 0.0235, topo - 0.02, dz);
    g.add(rb);
  }
  // alça de couro pendurada no pé do cabo
  const alca = [];
  for (let i = 0; i <= 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    alca.push(new THREE.Vector3(0.0, -0.05 - 0.085 * (1 - Math.cos(a)) * 0.62, 0.042 + 0.045 * Math.sin(a)));
  }
  g.add(tuboFita(alca, true, 0.0038, M.couroAlca, [3, 1, 1]));
  const nó = new THREE.Mesh(new THREE.TorusGeometry(0.0255, 0.004, 4, 14), M.couroAlca);
  nó.rotation.x = Math.PI / 2;
  nó.position.set(0, -0.045, 0);
  g.add(nó);
  return g;
}

// ---------------- LANÇA (sílex) ----------------
function haste(clara) {
  const E = materiaisExtra();
  return new THREE.Mesh(
    caboLathe({
      y0: -0.12, y1: 1.3, curva: 0.006,
      r: (t) => (clara ? 0.0165 : 0.0175) + 0.003 * Math.exp(-(((t - 0.0) / 0.05) ** 2)) - 0.003 * t + (t < 0.015 ? -0.005 : 0),
    }),
    clara ? E.hasteClara : E.hasteEscura,
  );
}

function lancaSilex() {
  const M = materiais();
  const E = materiaisExtra();
  const g = new THREE.Group();
  g.add(haste(true));
  // ponta de sílex lascado (folha), presa na ponta da haste
  const sh = new THREE.Shape();
  sh.moveTo(0, 0);
  sh.quadraticCurveTo(0.052, 0.04, 0.034, 0.1);
  sh.quadraticCurveTo(0.02, 0.16, 0, 0.215);
  sh.quadraticCurveTo(-0.02, 0.16, -0.034, 0.1);
  sh.quadraticCurveTo(-0.052, 0.04, 0, 0);
  const kf = (s, y) => Math.max(0.0, 1 - Math.abs(s) / 0.05) * Math.min(1, 1.5 - y * 4);
  const geo = perfil(sh, { depth: 0.014, bevel: 0.0035, kf: (s, y) => Math.pow(Math.max(0, 1 - Math.abs(s) / 0.055), 0.7) });
  // a ponta fica no plano X-Y: gira para o fio apontar de lado (como lâmina em pé)
  const tip = new THREE.Mesh(geo, E.silex);
  tip.rotation.y = Math.PI / 4;
  tip.position.y = 1.17;
  g.add(tip);
  // fenda da haste e amarração de fibra/couro
  for (let i = 0; i < 12; i++) {
    const y = 1.1 + i * 0.0105;
    const pts = [];
    for (let q = 0; q < 20; q++) {
      const a = (q / 20) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * (0.0215 - i * 0.00015), y, Math.sin(a) * (0.0215 - i * 0.00015)));
    }
    g.add(tuboFita(pts, true, 0.0042, M.tira, [1, 1.5, 1]));
  }
  const solta = new THREE.CatmullRomCurve3([new THREE.Vector3(0.021, 1.12, 0.0), new THREE.Vector3(0.034, 1.08, 0.01), new THREE.Vector3(0.03, 1.02, 0.016)]);
  g.add(new THREE.Mesh(new THREE.TubeGeometry(solta, 12, 0.003, 4, false), M.tira));
  // pegada: tiras de couro enroladas no meio da haste
  for (let i = 0; i < 10; i++) {
    const y = 0.28 + i * 0.0105;
    const pts = [];
    for (let q = 0; q < 20; q++) {
      const a = (q / 20) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * 0.0195, y, Math.sin(a) * 0.0195));
    }
    g.add(tuboFita(pts, true, 0.0042, M.tira, [1, 1.5, 1]));
  }
  return g;
}

// ---------------- LANÇA DE OSSO ----------------
function lancaOsso() {
  const M = materiais();
  const E = materiaisExtra();
  const g = new THREE.Group();
  g.add(haste(false));
  // ponta de osso: longa, levemente curva, com farpas
  const pts = [];
  const n = 18;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const r = 0.0215 * Math.pow(Math.max(0, 1 - t), 0.9) * (1 + 0.25 * Math.sin(t * Math.PI)) + (t >= 1 ? 0 : 0.0006);
    pts.push(new THREE.Vector2(Math.max(r, 0.0002), t * 0.3));
  }
  const lat = new THREE.LatheGeometry(pts, 14);
  const lp = lat.attributes.position;
  for (let i = 0; i < lp.count; i++) {
    const t = lp.getY(i) / 0.3;
    lp.setX(i, lp.getX(i) + 0.012 * t * t); // curva a ponta
  }
  lat.computeVertexNormals();
  const osso = new THREE.Mesh(lat, E.osso);
  osso.position.y = 1.16;
  g.add(osso);
  // farpas
  for (const sx of [-1, 1]) {
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.009, 0.06, 6), E.osso);
    f.position.set(sx * 0.02, 1.215, 0);
    f.rotation.z = -sx * 0.55;
    g.add(f);
  }
  // amarração de couro entre haste e osso
  for (let i = 0; i < 11; i++) {
    const y = 1.11 + i * 0.0098;
    const pp = [];
    for (let q = 0; q < 20; q++) {
      const a = (q / 20) * Math.PI * 2;
      pp.push(new THREE.Vector3(Math.cos(a) * 0.0225, y, Math.sin(a) * 0.0225));
    }
    g.add(tuboFita(pp, true, 0.0045, M.couroAlca, [1, 1.5, 1]));
  }
  // dente e cordinha pendurados
  const cord = new THREE.CatmullRomCurve3([new THREE.Vector3(0.022, 1.11, 0.0), new THREE.Vector3(0.04, 1.07, 0.012), new THREE.Vector3(0.042, 1.02, 0.02)]);
  g.add(new THREE.Mesh(new THREE.TubeGeometry(cord, 12, 0.0028, 4, false), new THREE.MeshStandardMaterial({ color: '#8a2a22', roughness: 0.9 })));
  const dente = new THREE.Mesh(new THREE.ConeGeometry(0.009, 0.05, 6), E.osso);
  dente.position.set(0.042, 0.995, 0.02);
  dente.rotation.x = Math.PI;
  g.add(dente);
  // pegada de couro
  for (let i = 0; i < 12; i++) {
    const y = 0.25 + i * 0.0105;
    const pp = [];
    for (let q = 0; q < 20; q++) {
      const a = (q / 20) * Math.PI * 2;
      pp.push(new THREE.Vector3(Math.cos(a) * 0.0205, y, Math.sin(a) * 0.0205));
    }
    g.add(tuboFita(pp, true, 0.0043, M.couroAlca, [1, 1.5, 1]));
  }
  return g;
}

const mk = (ids, fabrica) => () => {
  const g = new THREE.Group();
  for (const id of ids) {
    const a = fabrica[id]();
    a.name = id;
    a.visible = id === ids[0];
    a.traverse((o) => { if (o.isMesh) o.castShadow = false; });
    g.add(a);
  }
  g.userData.setVariant = (id) => g.children.forEach((c) => { c.visible = c.name === (ids.includes(id) ? id : ids[0]); });
  return g;
};

export const makePicks = mk(['picareta_pedra', 'picareta_silex', 'picareta_metal'], { picareta_pedra: picaretaPedra, picareta_silex: picaretaObsidiana, picareta_metal: picaretaMetal });
export const makeSpears = mk(['lanca', 'lanca_osso'], { lanca: lancaSilex, lanca_osso: lancaOsso });
