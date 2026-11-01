// =============================================================
// MACHADO DE PEDRA (modelo detalhado, na mão em 1ª pessoa)
// - Cabo de madeira com veio, levemente torto e mais grosso na ponta de baixo e no topo.
// - Lâmina de sílex lascado: perfil de machado, faces facetadas e fio fino de verdade.
// - Amarração de fibra: voltas em hélice e voltas cruzadas pela fenda do cabo.
// Texturas desenhadas na hora (veio, grão da pedra, trançado da fibra) e usadas também como
// relevo (bumpMap), então a luz marca o veio, as lascas e as voltas da corda.
// Orientação: cabo ao longo de +Y (mão em y≈-0.08), fio da lâmina apontando para -Z.
// =============================================================
import * as THREE from 'three';

function rng(seed) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

function canvasTex(N, desenha, repeat = [1, 1], srgb = true) {
  const c = document.createElement('canvas');
  c.width = N;
  c.height = N;
  desenha(c.getContext('2d'), N);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(...repeat);
  t.anisotropy = 4;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

let mats = null;
function materiais() {
  if (mats) return mats;
  // madeira: veio ao longo do cabo (v do Lathe corre pelo comprimento) com nós e fibras
  const madeira = canvasTex(256, (g, N) => {
    const r = rng(11);
    g.fillStyle = '#8a6238';
    g.fillRect(0, 0, N, N);
    for (let x = 0; x < N; x += 1) {
      const k = 0.78 + 0.3 * Math.sin(x * 0.55 + r() * 2) * 0.5 + r() * 0.18;
      g.fillStyle = `rgba(${Math.round(90 * k)}, ${Math.round(58 * k)}, ${Math.round(30 * k)}, ${0.35 + r() * 0.4})`;
      g.fillRect(x, 0, 1 + (r() < 0.3 ? 1 : 0), N);
    }
    for (let i = 0; i < 90; i++) { // fibras mais claras/escuras
      g.strokeStyle = r() < 0.5 ? 'rgba(60,36,16,0.35)' : 'rgba(190,150,100,0.25)';
      g.lineWidth = 1;
      const x = r() * N;
      g.beginPath();
      g.moveTo(x, r() * N);
      g.bezierCurveTo(x + 4, r() * N, x - 4, r() * N, x + (r() - 0.5) * 6, r() * N);
      g.stroke();
    }
    for (let i = 0; i < 3; i++) { // nós
      const x = r() * N;
      const y = r() * N;
      const gr = g.createRadialGradient(x, y, 1, x, y, 11);
      gr.addColorStop(0, 'rgba(40,24,10,0.9)');
      gr.addColorStop(1, 'rgba(40,24,10,0)');
      g.fillStyle = gr;
      g.fillRect(x - 12, y - 12, 24, 24);
    }
  }, [1, 2]);
  // pedra: cinza-azulada com manchas, riscos claros e grãos
  const pedra = canvasTex(256, (g, N) => {
    const r = rng(5);
    g.fillStyle = '#585a5e';
    g.fillRect(0, 0, N, N);
    for (let i = 0; i < 160; i++) {
      const x = r() * N;
      const y = r() * N;
      const R = 4 + r() * 22;
      const v = 80 + r() * 60;
      const gr = g.createRadialGradient(x, y, 0, x, y, R);
      gr.addColorStop(0, `rgba(${v},${v + 4},${v + 10},0.35)`);
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr;
      g.fillRect(x - R, y - R, R * 2, R * 2);
    }
    for (let i = 0; i < 1400; i++) {
      const v = 60 + r() * 120;
      g.fillStyle = `rgba(${v},${v},${v + 6},0.5)`;
      g.fillRect(r() * N, r() * N, 1 + r() * 1.5, 1 + r() * 1.5);
    }
    g.strokeStyle = 'rgba(210,214,220,0.25)';
    for (let i = 0; i < 14; i++) { // veios claros
      g.lineWidth = 1 + r();
      g.beginPath();
      const x = r() * N;
      const y = r() * N;
      g.moveTo(x, y);
      g.lineTo(x + (r() - 0.5) * 70, y + (r() - 0.5) * 70);
      g.stroke();
    }
  }, [1, 1]);
  // fibra trançada: diagonais finas
  const fibra = canvasTex(128, (g, N) => {
    const r = rng(3);
    g.fillStyle = '#8c7648';
    g.fillRect(0, 0, N, N);
    for (let i = -N; i < N * 2; i += 5) {
      g.strokeStyle = `rgba(${70 + r() * 30},${52 + r() * 24},${28 + r() * 16},0.6)`;
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(i, 0);
      g.lineTo(i + N * 0.6, N);
      g.stroke();
      g.strokeStyle = 'rgba(190,168,118,0.35)';
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(i + 2, 0);
      g.lineTo(i + 2 + N * 0.6, N);
      g.stroke();
    }
  }, [6, 1]);
  // obsidiana: vidro vulcânico preto, liso e brilhante, com reflexo arroxeado e ondas de lasca
  const obsid = canvasTex(256, (g, N) => {
    const r = rng(9);
    g.fillStyle = '#1b1a25';
    g.fillRect(0, 0, N, N);
    for (let i = 0; i < 70; i++) { // ondas de fratura concoidal
      const x = r() * N;
      const y = r() * N;
      g.strokeStyle = `rgba(${120 + r() * 90},${100 + r() * 70},${170 + r() * 80},${0.07 + r() * 0.12})`;
      g.lineWidth = 1 + r() * 1.5;
      g.beginPath();
      g.arc(x, y, 10 + r() * 50, r() * 6, r() * 6 + 1.4 + r() * 1.5);
      g.stroke();
    }
    for (let i = 0; i < 400; i++) {
      g.fillStyle = `rgba(200,190,230,${r() * 0.25})`;
      g.fillRect(r() * N, r() * N, 1, 1);
    }
  }, [1, 1]);
  // aço batido: martelado, com riscos de lima e manchas escuras de forja
  const aco = canvasTex(256, (g, N) => {
    const r = rng(17);
    g.fillStyle = '#a9aeb6';
    g.fillRect(0, 0, N, N);
    for (let i = 0; i < 260; i++) { // marcas de martelo
      const x = r() * N;
      const y = r() * N;
      const R = 3 + r() * 9;
      const gr = g.createRadialGradient(x, y, 0, x, y, R);
      const v = r() < 0.5 ? 0 : 255;
      gr.addColorStop(0, `rgba(${v},${v},${v},0.16)`);
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr;
      g.fillRect(x - R, y - R, R * 2, R * 2);
    }
    for (let i = 0; i < 120; i++) { // riscos de lima
      g.strokeStyle = `rgba(${r() < 0.5 ? '40,44,52' : '235,240,250'},${0.1 + r() * 0.15})`;
      g.lineWidth = 1;
      const x = r() * N;
      const y = r() * N;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + 20 + r() * 40, y + (r() - 0.5) * 6);
      g.stroke();
    }
    for (let i = 0; i < 8; i++) { // mancha de forja
      const x = r() * N;
      const y = r() * N;
      const gr = g.createRadialGradient(x, y, 0, x, y, 30);
      gr.addColorStop(0, 'rgba(60,50,40,0.28)');
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr;
      g.fillRect(x - 30, y - 30, 60, 60);
    }
  }, [1, 1]);
  // couro: grão e costura
  const couro = canvasTex(128, (g, N) => {
    const r = rng(31);
    g.fillStyle = '#4a2f1c';
    g.fillRect(0, 0, N, N);
    for (let i = 0; i < 900; i++) {
      const v = 40 + r() * 50;
      g.fillStyle = `rgba(${v + 20},${v},${v - 16},0.5)`;
      g.fillRect(r() * N, r() * N, 1 + r() * 2, 1 + r());
    }
  }, [2, 1]);
  mats = {
    obsidiana: new THREE.MeshStandardMaterial({ map: obsid, bumpMap: obsid, bumpScale: 0.8, roughness: 0.12, metalness: 0.35, flatShading: true, emissive: '#14101f', emissiveIntensity: 0.4 }),
    aco: new THREE.MeshStandardMaterial({ map: aco, bumpMap: aco, bumpScale: 1.8, roughness: 0.38, metalness: 0.6 }),
    acoEscuro: new THREE.MeshStandardMaterial({ color: '#5b5f66', roughness: 0.5, metalness: 0.6 }),
    latao: new THREE.MeshStandardMaterial({ color: '#b08a3c', roughness: 0.35, metalness: 0.6 }),
    couro: new THREE.MeshStandardMaterial({ map: couro, bumpMap: couro, bumpScale: 1.2, roughness: 0.8, metalness: 0 }),
    madeiraEscura: new THREE.MeshStandardMaterial({ map: madeira, bumpMap: madeira, bumpScale: 1.2, roughness: 0.55, metalness: 0, color: '#9b6c44' }),
    madeira: new THREE.MeshStandardMaterial({ map: madeira, bumpMap: madeira, bumpScale: 1.4, roughness: 0.82, metalness: 0 }),
    pedra: new THREE.MeshStandardMaterial({ map: pedra, bumpMap: pedra, bumpScale: 2.6, roughness: 0.55, metalness: 0.02, flatShading: true }),
    fibra: new THREE.MeshStandardMaterial({ map: fibra, bumpMap: fibra, bumpScale: 2.2, roughness: 0.95, metalness: 0 }),
  };
  return mats;
}

// Cabo: torneado (mais grosso embaixo e no topo), com leve curva e um calombo da pegada.
function cabo(altura, topo) {
  const pts = [];
  const n = 26;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const y = -0.1 + t * altura;
    let r = 0.0175 + 0.0035 * (1 - t) ** 2 * 1.2; // alarga na base
    r += 0.0045 * Math.exp(-(((y - topo) / 0.035) ** 2)); // volta o topo (encaixe da cabeça)
    r += 0.002 * Math.exp(-(((y - 0.1) / 0.05) ** 2)); // pegada
    if (t < 0.03) r *= 0.82 + t * 6; // ponta de baixo arredondada
    pts.push(new THREE.Vector2(r, y));
  }
  const geo = new THREE.LatheGeometry(pts, 20);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    p.setX(i, p.getX(i) + 0.008 * Math.sin((y + 0.1) * 5.2)); // cabo não é reto
    p.setZ(i, p.getZ(i) + 0.003 * Math.sin((y + 0.1) * 3.1 + 1));
  }
  geo.computeVertexNormals();
  return geo;
}

// Cabeça de sílex lascado: cunha de verdade. Grossa atrás (onde encosta no cabo), abre em leque
// e termina num fio fino e curvo na frente. Faces facetadas pelas lascas, cada uma com sua luz.
function lamina(yc, o = {}) {
  const L = o.L ?? 0.182;
  const hhf = o.hh ?? ((u) => 0.032 + 0.058 * Math.pow(u, 0.85));
  const T = o.T ?? 0.021;
  const BU = o.bulge ?? 0.036;
  const RIP = o.rip ?? 1;
  const NU = 13; // de trás para frente
  const NV = 11; // de baixo para cima
  const r = rng(21);
  const jit = new Map();
  const J = (u, v, s) => {
    const k = `${u},${v},${s}`;
    if (!jit.has(k)) jit.set(k, [(r() - 0.5), (r() - 0.5), (r() - 0.5)]);
    return jit.get(k);
  };
  const pt = (i, j, s) => {
    const u = i / NU;
    const v = j / NV;
    const w = 2 * v - 1; // -1 (baixo) .. 1 (cima)
    const hh = hhf(u); // meia altura: abre em leque
    const bulge = BU * u * u * (1 - w * w); // o fio sai mais para a frente no meio (curvo)
    const z = THREE.MathUtils.lerp(0.032, 0.032 - L, u) - bulge + 0.012 * u * Math.abs(w) ** 3;
    const y = yc + w * hh;
    // espessura: grossa atrás e no meio, some no fio e nas pontas de cima/baixo
    const t = (T * Math.pow(1 - u, 1.15) + 0.0025) * Math.pow(Math.max(0, 1 - w * w), 0.55);
    // lascas: ondas cruzadas + sorteio por ponto (igual nos dois lados do mesmo ponto)
    const j3 = J(i, j, 0);
    const fl = RIP * (0.0022 * Math.sin(u * 17 + w * 7 + 1.3) * (1 - u * 0.6) + 0.0016 * Math.sin(u * 9 - w * 13));
    const x = s * (t + fl * (t > 0.004 ? 1 : 0.2));
    return [x + j3[0] * 0.0014, y + j3[1] * 0.004, z + j3[2] * 0.004];
  };
  const P = [];
  const idx = [];
  const id = {};
  const add = (i, j, s) => {
    const k = `${i},${j},${s}`;
    if (id[k] === undefined) { id[k] = P.length / 3; P.push(...pt(i, j, s)); }
    return id[k];
  };
  const quad = (a, b, c, d, flip) => (flip ? idx.push(a, c, b, b, c, d) : idx.push(a, b, c, b, d, c));
  for (const s of [-1, 1]) {
    for (let i = 0; i < NU; i++) {
      for (let j = 0; j < NV; j++) quad(add(i, j, s), add(i + 1, j, s), add(i, j + 1, s), add(i + 1, j + 1, s), s < 0);
    }
  }
  // fecha as bordas (atrás, fio, embaixo, em cima) ligando as duas faces
  for (let j = 0; j < NV; j++) {
    quad(add(0, j, -1), add(0, j + 1, -1), add(0, j, 1), add(0, j + 1, 1), false);
    quad(add(NU, j, -1), add(NU, j, 1), add(NU, j + 1, -1), add(NU, j + 1, 1), false);
  }
  for (let i = 0; i < NU; i++) {
    quad(add(i, 0, -1), add(i, 0, 1), add(i + 1, 0, -1), add(i + 1, 0, 1), false);
    quad(add(i, NV, -1), add(i + 1, NV, -1), add(i, NV, 1), add(i + 1, NV, 1), false);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  geo.setIndex(idx);
  const ni = geo.toNonIndexed();
  ni.computeVertexNormals();
  const q = ni.attributes.position;
  const uv = new Float32Array(q.count * 2);
  for (let i = 0; i < q.count; i++) {
    uv[i * 2] = q.getZ(i) * 6 + q.getX(i) * 4;
    uv[i * 2 + 1] = q.getY(i) * 6;
  }
  ni.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return ni;
}

// Amarração: voltas bem apertadas em volta do cabo e da base da cabeça, mais duas voltas cruzadas
// por cima, e uma pontinha de corda sobrando.
function amarracao(yc) {
  const g = new THREE.Group();
  const M = materiais();
  const y0 = yc - 0.062;
  const y1 = yc + 0.05;
  const pts = [];
  const voltas = 13;
  for (let i = 0; i <= voltas * 16; i++) {
    const t = i / (voltas * 16);
    const a = t * voltas * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a) * 0.031, y0 + (y1 - y0) * t + 0.0015 * Math.sin(a * 3), -0.002 + Math.sin(a) * 0.04));
  }
  g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), voltas * 16, 0.0042, 5, false), M.fibra));
  for (const s of [-1, 1]) { // voltas em X por cima da cabeça
    const c = [];
    for (let i = 0; i <= 28; i++) {
      const a = (i / 28) * Math.PI * 2;
      c.push(new THREE.Vector3(Math.cos(a) * 0.033, yc + s * 0.02 * Math.cos(a) + s * 0.004, -0.002 + Math.sin(a) * 0.042));
    }
    g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(c, true), 56, 0.0036, 5, true), M.fibra));
  }
  // pontinha solta
  const tail = new THREE.CatmullRomCurve3([new THREE.Vector3(0.03, y1, 0.0), new THREE.Vector3(0.05, y1 - 0.02, 0.012), new THREE.Vector3(0.056, y1 - 0.06, 0.02), new THREE.Vector3(0.05, y1 - 0.09, 0.016)]);
  g.add(new THREE.Mesh(new THREE.TubeGeometry(tail, 12, 0.0035, 4, false), M.fibra));
  return g;
}

// ---------- Machado de Sílex/Obsidiana: lâmina longa e preta, presa por tiras de couro ----------
function amarracaoCouro(yc) {
  const g = new THREE.Group();
  const M = materiais();
  // três tiras de couro em volta do cabo e da raiz da lâmina
  for (const [dy, r0] of [[-0.045, 0.03], [-0.012, 0.032], [0.02, 0.03]]) {
    const pts = [];
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * r0, yc + dy, -0.004 + Math.sin(a) * (r0 + 0.006)));
    }
    const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 48, 0.0065, 5, true), M.couro);
    g.add(m);
  }
  // cordinha vermelha de enfeite e um dente de osso pendurado
  const cord = new THREE.CatmullRomCurve3([new THREE.Vector3(0.036, yc - 0.05, 0.0), new THREE.Vector3(0.056, yc - 0.075, 0.014), new THREE.Vector3(0.058, yc - 0.1, 0.02)]);
  g.add(new THREE.Mesh(new THREE.TubeGeometry(cord, 10, 0.003, 4, false), new THREE.MeshStandardMaterial({ color: '#8a2a22', roughness: 0.9 })));
  const dente = new THREE.Mesh(new THREE.ConeGeometry(0.0085, 0.05, 6), new THREE.MeshStandardMaterial({ color: '#e6dcc4', roughness: 0.6 }));
  dente.position.set(0.058, yc - 0.125, 0.02);
  dente.rotation.x = Math.PI;
  g.add(dente);
  return g;
}

function machadoSilex() {
  const M = materiais();
  const g = new THREE.Group();
  const altura = 0.74;
  const topo = 0.52;
  const haste = new THREE.Mesh(cabo(altura, topo + 0.03), M.madeiraEscura);
  // lâmina de obsidiana: longa, mais estreita, larga no meio e com o fio bem fino e curvo
  const head = new THREE.Mesh(
    lamina(topo, { L: 0.25, hh: (u) => 0.016 + 0.046 * Math.sin(Math.min(1, u * 1.02) * Math.PI * 0.8) ** 0.8, T: 0.016, bulge: 0.065, rip: 2.2 }),
    M.obsidiana,
  );
  g.add(haste, head, amarracaoCouro(topo));
  // pegada de couro no cabo
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.0235, 0.0235, 0.16, 14), M.couro);
  grip.position.y = 0.06;
  g.add(grip);
  return g;
}

// ---------- Machado de Metal: cabeça forjada de aço com encaixe (olho), costas de martelo e barba ----------
function cabecaMetal(yc) {
  const M = materiais();
  const g = new THREE.Group();
  // perfil clássico de machado visto de lado (x = frente(-)/trás(+) em z do jogo, y = altura)
  const sh = new THREE.Shape();
  sh.moveTo(0.05, 0.035); // costas (martelo)
  sh.lineTo(0.05, -0.035);
  sh.lineTo(0.012, -0.04);
  sh.lineTo(-0.02, -0.075);
  sh.lineTo(-0.075, -0.135); // barba: desce
  sh.lineTo(-0.1, -0.11);
  sh.quadraticCurveTo(-0.132, -0.0, -0.1, 0.095); // fio curvo
  sh.lineTo(-0.075, 0.115);
  sh.lineTo(-0.02, 0.06);
  sh.lineTo(0.012, 0.04);
  sh.closePath();
  const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.022, bevelEnabled: true, bevelThickness: 0.009, bevelSize: 0.007, bevelSegments: 2, curveSegments: 8 });
  geo.translate(0, 0, -0.011);
  geo.rotateY(Math.PI / 2); // espessura em X; frente em -Z
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { // chanfro do fio: afina para a frente
    const z = p.getZ(i);
    const k = THREE.MathUtils.clamp((-z - 0.03) / 0.09, 0, 1);
    p.setX(i, p.getX(i) * (1 - 0.88 * k * k));
  }
  geo.computeVertexNormals();
  geo.translate(0, yc, 0);
  // UV por posição para a textura de aço não esticar
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) { uv[i * 2] = p.getZ(i) * 5 + p.getX(i) * 4; uv[i * 2 + 1] = p.getY(i) * 5; }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.add(new THREE.Mesh(geo, M.aco));
  // encaixe (olho) em volta do cabo: bloco de aço mais escuro com cantos chanfrados
  const olho = new THREE.Mesh(new THREE.BoxGeometry(0.062, 0.1, 0.078), M.acoEscuro);
  olho.position.set(0, yc, 0.008);
  g.add(olho);
  // rebites de latão
  for (const sx of [-1, 1]) for (const dy of [-0.032, 0.032]) {
    const rb = new THREE.Mesh(new THREE.SphereGeometry(0.0085, 8, 6), M.latao);
    rb.position.set(sx * 0.032, yc + dy, 0.012);
    g.add(rb);
  }
  // colar de metal logo abaixo da cabeça
  const colar = new THREE.Mesh(new THREE.CylinderGeometry(0.0285, 0.0255, 0.05, 16), M.acoEscuro);
  colar.position.y = yc - 0.075;
  g.add(colar);
  return g;
}

function machadoMetal() {
  const M = materiais();
  const g = new THREE.Group();
  const altura = 0.76;
  const topo = 0.54;
  const haste = new THREE.Mesh(cabo(altura, topo + 0.03), M.madeiraEscura);
  g.add(haste, cabecaMetal(topo));
  // pegada de couro enrolada com costura e tampa de metal no fim do cabo
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.0238, 0.0238, 0.2, 16), M.couro);
  grip.position.y = 0.04;
  g.add(grip);
  for (let i = 0; i < 6; i++) {
    const cinta = new THREE.Mesh(new THREE.TorusGeometry(0.0243, 0.0027, 4, 16), M.couro);
    cinta.rotation.x = Math.PI / 2;
    cinta.position.y = -0.04 + i * 0.0325;
    g.add(cinta);
  }
  const tampa = new THREE.Mesh(new THREE.CylinderGeometry(0.027, 0.03, 0.03, 16), M.acoEscuro);
  tampa.position.y = -0.105;
  g.add(tampa);
  return g;
}

export function makeAxe(variante = 'machado_pedra') {
  if (variante === 'machado_silex') return machadoSilex();
  if (variante === 'machado_metal') return machadoMetal();
  const M = materiais();
  const g = new THREE.Group();
  g.name = 'MachadoPedra';
  const altura = 0.7;
  const topo = 0.5; // altura do centro da cabeça
  const haste = new THREE.Mesh(cabo(altura, topo + 0.03), M.madeira);
  const head = new THREE.Mesh(lamina(topo), M.pedra);
  g.add(haste, head, amarracao(topo));
  g.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  return g;
}

export const MACHADOS = ['machado_pedra', 'machado_silex', 'machado_metal'];

// Os três machados juntos num grupo; só o do item na mão aparece.
export function makeAxes() {
  const g = new THREE.Group();
  for (const id of MACHADOS) {
    const a = makeAxe(id);
    a.name = id;
    a.visible = id === 'machado_pedra';
    g.add(a);
  }
  g.userData.setVariant = (id) => g.children.forEach((c) => { c.visible = c.name === (MACHADOS.includes(id) ? id : 'machado_pedra'); });
  return g;
}
