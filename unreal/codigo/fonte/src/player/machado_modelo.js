// =============================================================
// OS TRÊS MACHADOS (modelos detalhados, na mão em 1ª pessoa e no personagem)
//  - machado_pedra : machado de pedra bruta: pedra tosca presa ao lado do cabo chato de madeira
//                    clara, com tiras largas de couro cru enroladas.
//  - machado_silex : machado de batalha negro (obsidiana): lâmina em meia-lua com fio serrilhado
//                    prateado, espigão no topo, asas atrás, encaixe esculpido e cabo enrolado
//                    com argolas de metal e ponteira.
//  - machado_metal : machado viking de barba: lâmina de aço com runas gravadas, cabo de madeira
//                    curvo e avermelhado, com alça de couro pendurada.
// Orientação: cabo ao longo de +Y (mão em y≈-0.08), fio da lâmina apontando para -Z.
// As texturas são desenhadas na hora e também usadas como relevo (bumpMap).
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

// madeira com veio ao longo do comprimento (base = cor média)
function madeiraTex(base, seed, rep = [1, 2]) {
  return canvasTex(256, (g, N) => {
    const r = rng(seed);
    g.fillStyle = base;
    g.fillRect(0, 0, N, N);
    for (let x = 0; x < N; x++) {
      const k = 0.78 + 0.3 * Math.sin(x * 0.55 + r() * 2) * 0.5 + r() * 0.18;
      g.fillStyle = `rgba(0,0,0,${(1 - k) * 0.9 + 0.04})`;
      g.fillRect(x, 0, 1 + (r() < 0.3 ? 1 : 0), N);
    }
    for (let i = 0; i < 110; i++) {
      g.strokeStyle = r() < 0.5 ? 'rgba(50,30,12,0.3)' : 'rgba(255,235,200,0.22)';
      g.lineWidth = 1;
      const x = r() * N;
      g.beginPath();
      g.moveTo(x, r() * N);
      g.bezierCurveTo(x + 4, r() * N, x - 4, r() * N, x + (r() - 0.5) * 6, r() * N);
      g.stroke();
    }
    for (let i = 0; i < 3; i++) {
      const x = r() * N;
      const y = r() * N;
      const gr = g.createRadialGradient(x, y, 1, x, y, 11);
      gr.addColorStop(0, 'rgba(40,24,10,0.85)');
      gr.addColorStop(1, 'rgba(40,24,10,0)');
      g.fillStyle = gr;
      g.fillRect(x - 12, y - 12, 24, 24);
    }
  }, rep);
}

let mats = null;
function materiais() {
  if (mats) return mats;
  const clara = madeiraTex('#c9a878', 4);
  const avermelhada = madeiraTex('#7d3b22', 8);
  const escura = madeiraTex('#4a3322', 12);
  // pedra bruta: bege com blocos de rocha cinza-escura, riscos e grão
  const pedra = canvasTex(256, (g, N) => {
    const r = rng(5);
    g.fillStyle = '#a69378';
    g.fillRect(0, 0, N, N);
    for (let i = 0; i < 26; i++) {
      const x = r() * N;
      const y = r() * N;
      const R = 18 + r() * 60;
      const gr = g.createRadialGradient(x, y, 0, x, y, R);
      const tom = r() < 0.55 ? '52,56,64' : '140,128,104';
      gr.addColorStop(0, `rgba(${tom},0.75)`);
      gr.addColorStop(1, `rgba(${tom},0)`);
      g.fillStyle = gr;
      g.fillRect(x - R, y - R, R * 2, R * 2);
    }
    for (let i = 0; i < 1800; i++) {
      const v = 60 + r() * 150;
      g.fillStyle = `rgba(${v},${v - 4},${v - 14},0.45)`;
      g.fillRect(r() * N, r() * N, 1 + r() * 2, 1 + r() * 2);
    }
    g.strokeStyle = 'rgba(30,30,34,0.3)';
    for (let i = 0; i < 12; i++) {
      g.lineWidth = 1 + r();
      g.beginPath();
      const x = r() * N;
      const y = r() * N;
      g.moveTo(x, y);
      g.lineTo(x + (r() - 0.5) * 80, y + (r() - 0.5) * 80);
      g.stroke();
    }
  }, [1, 1]);
  // couro cru em tiras: tom de caramelo com dobras e fibra
  const tira = canvasTex(128, (g, N) => {
    const r = rng(3);
    g.fillStyle = '#b3935f';
    g.fillRect(0, 0, N, N);
    for (let i = 0; i < 700; i++) {
      const v = r();
      g.fillStyle = v < 0.5 ? 'rgba(80,48,22,0.3)' : 'rgba(224,170,110,0.28)';
      g.fillRect(r() * N, r() * N, 1 + r() * 5, 1);
    }
  }, [3, 1]);
  const couroEscuro = canvasTex(128, (g, N) => {
    const r = rng(31);
    g.fillStyle = '#4a4444';
    g.fillRect(0, 0, N, N);
    for (let i = -N; i < N * 2; i += 6) { // cordão trançado
      g.strokeStyle = `rgba(${70 + r() * 30},${64 + r() * 24},${66 + r() * 24},0.6)`;
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(i, 0);
      g.lineTo(i + N * 0.5, N);
      g.stroke();
      g.strokeStyle = 'rgba(0,0,0,0.5)';
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(i + 3, 0);
      g.lineTo(i + 3 + N * 0.5, N);
      g.stroke();
    }
  }, [2, 6]);
  // aço de runas: prata polida com banda escura gravada (círculo de raios e glifos)
  const runas = canvasTex(512, (g, N) => {
    const r = rng(17);
    const gr = g.createLinearGradient(0, 0, N, N);
    gr.addColorStop(0, '#f4f6fa');
    gr.addColorStop(0.5, '#c6ccd6');
    gr.addColorStop(1, '#e8ebf0');
    g.fillStyle = gr;
    g.fillRect(0, 0, N, N);
    for (let i = 0; i < 400; i++) { // riscos de polimento
      g.strokeStyle = `rgba(${r() < 0.5 ? '70,76,86' : '255,255,255'},${0.05 + r() * 0.1})`;
      g.lineWidth = 1;
      const x = r() * N;
      const y = r() * N;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + 30 + r() * 90, y + (r() - 0.5) * 8);
      g.stroke();
    }
    // banda escura gravada (de baixo do dorso até perto do fio)
    g.fillStyle = 'rgba(34,38,46,0.92)';
    g.beginPath();
    g.moveTo(N * 0.1, N * 0.28);
    g.quadraticCurveTo(N * 0.5, N * 0.2, N * 0.95, N * 0.3);
    g.lineTo(N * 0.95, N * 0.7);
    g.quadraticCurveTo(N * 0.5, N * 0.6, N * 0.1, N * 0.74);
    g.closePath();
    g.fill();
    // bússola rúnica: círculo, 8 raios com forquilhas e bolinhas
    g.strokeStyle = 'rgba(214,220,230,0.95)';
    g.lineWidth = 3;
    const cx = N * 0.3;
    const cy = N * 0.5;
    g.beginPath();
    g.arc(cx, cy, 46, 0, 7);
    g.stroke();
    g.beginPath();
    g.arc(cx, cy, 8, 0, 7);
    g.stroke();
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      const dx = Math.cos(a);
      const dy = Math.sin(a);
      g.beginPath();
      g.moveTo(cx + dx * 8, cy + dy * 8);
      g.lineTo(cx + dx * 84, cy + dy * 84);
      g.stroke();
      for (const [d, sp] of [[56, 10], [72, 14]]) { // forquilhas
        g.beginPath();
        g.moveTo(cx + dx * d, cy + dy * d);
        g.lineTo(cx + dx * (d + 12) + -dy * sp, cy + dy * (d + 12) + dx * sp);
        g.moveTo(cx + dx * d, cy + dy * d);
        g.lineTo(cx + dx * (d + 12) + dy * sp, cy + dy * (d + 12) - dx * sp);
        g.stroke();
      }
      g.beginPath();
      g.arc(cx + dx * 92, cy + dy * 92, 4, 0, 7);
      g.stroke();
    }
    // faixa de glifos à direita
    for (let i = 0; i < 16; i++) {
      const x = N * 0.52 + i * 21;
      g.beginPath();
      g.moveTo(x, cy - 40);
      g.lineTo(x, cy + 40);
      g.moveTo(x, cy - 20 + r() * 10);
      g.lineTo(x + 10 + r() * 6, cy - 34 + r() * 10);
      g.moveTo(x, cy + r() * 14);
      g.lineTo(x - 10 - r() * 6, cy + 18 + r() * 10);
      g.stroke();
    }
  }, [1, 1]);
  // aço negro de batalha: ferro escuro martelado com veios e entalhes
  const negro = canvasTex(256, (g, N) => {
    const r = rng(23);
    g.fillStyle = '#555963';
    g.fillRect(0, 0, N, N);
    for (let i = 0; i < 220; i++) {
      const x = r() * N;
      const y = r() * N;
      const R = 3 + r() * 14;
      const gr = g.createRadialGradient(x, y, 0, x, y, R);
      const v = r() < 0.5 ? 0 : 160;
      gr.addColorStop(0, `rgba(${v},${v},${v + 6},0.16)`);
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr;
      g.fillRect(x - R, y - R, R * 2, R * 2);
    }
    for (let i = 0; i < 90; i++) {
      g.strokeStyle = `rgba(150,156,170,${0.06 + r() * 0.12})`;
      g.lineWidth = 1;
      const x = r() * N;
      const y = r() * N;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + 20 + r() * 40, y + (r() - 0.5) * 8);
      g.stroke();
    }
  }, [1, 1]);
  const std = (o) => new THREE.MeshStandardMaterial(o);
  mats = {
    madeiraClara: std({ map: clara, bumpMap: clara, bumpScale: 1.6, roughness: 0.9 }),
    madeiraVerm: std({ map: avermelhada, bumpMap: avermelhada, bumpScale: 1.2, roughness: 0.42, metalness: 0 }),
    madeiraEscura: std({ map: escura, bumpMap: escura, bumpScale: 1.2, roughness: 0.6 }),
    pedra: std({ map: pedra, bumpMap: pedra, bumpScale: 3.2, roughness: 0.92, flatShading: true }),
    tira: std({ map: tira, bumpMap: tira, bumpScale: 1.6, roughness: 0.85 }),
    cordao: std({ map: couroEscuro, bumpMap: couroEscuro, bumpScale: 1.8, roughness: 0.8 }),
    runas: std({ map: runas, roughness: 0.3, metalness: 0.3, emissive: '#2a2d34', emissiveIntensity: 0.6 }),
    aco: std({ color: '#b4bac4', roughness: 0.32, metalness: 0.6 }),
    negro: std({ map: negro, bumpMap: negro, bumpScale: 1.4, roughness: 0.4, metalness: 0.5, vertexColors: true, emissive: '#15161c', emissiveIntensity: 0.6 }),
    negroLiso: std({ color: '#4a4d58', roughness: 0.36, metalness: 0.6 }),
    prata: std({ color: '#c9ced8', roughness: 0.25, metalness: 0.65 }),
    couroAlca: std({ color: '#b46c3a', roughness: 0.75 }),
  };
  return mats;
}

// Cabo torneado e curvado (lathe). o = { y0, y1, r: (t)=>raio, curva, oval }
function caboLathe(o) {
  const pts = [];
  const n = 30;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push(new THREE.Vector2(o.r(t), o.y0 + (o.y1 - o.y0) * t));
  }
  const geo = new THREE.LatheGeometry(pts, 22);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const t = (p.getY(i) - o.y0) / (o.y1 - o.y0);
    p.setZ(i, p.getZ(i) * (o.oval ?? 1) - (o.curva ?? 0) * Math.sin(t * Math.PI * 0.9)); // curva para trás no meio
  }
  geo.computeVertexNormals();
  return geo;
}

// Extrusão de um perfil lateral (s = para a frente, y = altura) com espessura em X.
// O fio fica na frente: a espessura vai a ~10% perto da borda do fio (edge(y) = s do fio nessa altura).
function perfil(shape, { depth, bevel = 0.006, edge, kf = null, w = 0.05, corFio = null, base = [1, 1, 1] }) {
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments: 2, curveSegments: 10 });
  const p = geo.attributes.position;
  const col = new Float32Array(p.count * 3);
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const s = p.getX(i);
    const y = p.getY(i);
    const zd = p.getZ(i) - depth / 2;
    let k = 1;
    let d = 1;
    if (kf) {
      d = kf(s, y); // fator de espessura 0..1 (pontas finas)
      k = 0.12 + 0.88 * d;
    } else if (edge) {
      const dist = edge(y) - s; // distância até o fio (≥ 0 dentro da lâmina)
      d = THREE.MathUtils.clamp(dist / w, 0, 1);
      k = 0.1 + 0.9 * d * d * (3 - 2 * d);
    }
    p.setXYZ(i, zd * k, y, -s);
    uv[i * 2] = s;
    uv[i * 2 + 1] = y;
    const f = corFio ? 1 - THREE.MathUtils.smoothstep(d, 0, 0.5) : 0;
    const c = corFio ? [base[0] + (corFio[0] - base[0]) * f, base[1] + (corFio[1] - base[1]) * f, base[2] + (corFio[2] - base[2]) * f] : base;
    col.set(c, i * 3);
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  return geo;
}

// Fita/corda fechada ou aberta; a escala achata só a seção do tubo (a posição fica certa)
const tuboFita = (pts, fechado, raio, mat, esc = [1, 1, 1], y = 0) => {
  const cy = pts.reduce((a, p) => a + p.y, 0) / pts.length;
  pts.forEach((p) => { p.y -= cy; }); // centra em y=0, escala, e põe de volta
  const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, fechado), Math.max(24, pts.length * 3), raio, 5, fechado), mat);
  m.scale.set(...esc);
  m.position.y = cy + y;
  return m;
};

// ------------------------------------------------------------------
// 1) MACHADO DE PEDRA: pedra tosca ao lado do cabo chato, tiras largas de couro
// ------------------------------------------------------------------
function machadoPedra() {
  const M = materiais();
  const g = new THREE.Group();
  const topo = 0.5;
  // cabo: tábua chata de madeira clara, rústica, ponta de baixo em bico
  const larg = 0.044;
  const esp = 0.021;
  const box = new THREE.BoxGeometry(esp, 0.74, larg, 3, 22, 3);
  const bp = box.attributes.position;
  const r = rng(7);
  for (let i = 0; i < bp.count; i++) {
    let y = bp.getY(i);
    const t = (y + 0.37) / 0.74; // 0 embaixo, 1 em cima
    if (t < 0.18) { // ponta em bico
      const k = 0.35 + (t / 0.18) * 0.65;
      bp.setZ(i, bp.getZ(i) * k);
      bp.setX(i, bp.getX(i) * (0.55 + 0.45 * (t / 0.18)));
    }
    bp.setX(i, bp.getX(i) + (r() - 0.5) * 0.0022 + 0.003 * Math.sin(y * 9));
    bp.setZ(i, bp.getZ(i) + (r() - 0.5) * 0.0022 + 0.004 * Math.sin(y * 6 + 1));
    bp.setY(i, y + 0.37 - 0.1 - 0.0);
  }
  box.computeVertexNormals();
  const uvp = box.attributes.uv;
  for (let i = 0; i < uvp.count; i++) uvp.setXY(i, uvp.getX(i), uvp.getY(i) * 1.6);
  const cabo = new THREE.Mesh(box, M.madeiraClara);
  cabo.position.y = 0.0; // vai de y=-0.1 a y=0.64
  g.add(cabo);
  // pedra: bloco tosco, preso do lado da frente do topo do cabo
  const ico = new THREE.IcosahedronGeometry(0.06, 1);
  const ip = ico.attributes.position;
  const r2 = rng(13);
  const jit = new Map();
  for (let i = 0; i < ip.count; i++) {
    const key = `${ip.getX(i).toFixed(3)},${ip.getY(i).toFixed(3)},${ip.getZ(i).toFixed(3)}`;
    if (!jit.has(key)) jit.set(key, 0.82 + r2() * 0.36);
    const k = jit.get(key);
    // achata a espessura (x), alonga na frente (z negativo) e faz a frente mais fina (fio tosco)
    const z = ip.getZ(i);
    const thick = z < -0.02 ? 0.62 - Math.min(0.3, (-z - 0.02) * 4) : 0.85;
    ip.setXYZ(i, ip.getX(i) * k * thick, ip.getY(i) * k * 1.12, z * k * 1.35);
  }
  ico.computeVertexNormals();
  const pu = new Float32Array(ip.count * 2);
  for (let i = 0; i < ip.count; i++) { pu[i * 2] = ip.getZ(i) * 6 + ip.getX(i) * 3; pu[i * 2 + 1] = ip.getY(i) * 6; }
  ico.setAttribute('uv', new THREE.BufferAttribute(pu, 2));
  const pedra = new THREE.Mesh(ico.toNonIndexed(), M.pedra);
  pedra.geometry.computeVertexNormals();
  pedra.position.set(0.001, topo + 0.01, -0.058);
  pedra.scale.setScalar(1.25);
  pedra.rotation.set(0.12, 0.05, -0.1);
  g.add(pedra);
  // tiras largas de couro cru: voltas achatadas em volta do cabo e da raiz da pedra
  const yIni = topo - 0.115;
  for (let i = 0; i < 12; i++) {
    const y = yIni + i * 0.0092 + (i % 2) * 0.0015;
    const pts = [];
    for (let q = 0; q < 28; q++) {
      const a = (q / 28) * Math.PI * 2;
      // retângulo arredondado em volta do cabo + raiz da pedra
      const cz = -0.028;
      const rx = 0.022 + 0.002 * Math.sin(i);
      const rz = 0.052 + 0.004 * Math.cos(i * 1.7);
      pts.push(new THREE.Vector3(Math.sign(Math.cos(a)) * Math.abs(Math.cos(a)) ** 0.7 * rx, y + 0.002 * Math.sin(a * 2 + i), cz + Math.sign(Math.sin(a)) * Math.abs(Math.sin(a)) ** 0.7 * rz));
    }
    g.add(tuboFita(pts, true, 0.0052, M.tira, [1, 1.7, 1]));
    // (a escala em y só engrossa a fita; a altura já foi corrigida)
  }
  // pontas soltas
  const solta = new THREE.CatmullRomCurve3([new THREE.Vector3(0.022, yIni + 0.03, 0.02), new THREE.Vector3(0.036, yIni + 0.0, 0.034), new THREE.Vector3(0.03, yIni - 0.04, 0.04), new THREE.Vector3(0.034, yIni - 0.075, 0.03)]);
  const s1 = new THREE.Mesh(new THREE.TubeGeometry(solta, 14, 0.0032, 4, false), M.tira);
  s1.scale.set(1, 1, 1.8);
  g.add(s1);
  const solta2 = new THREE.CatmullRomCurve3([new THREE.Vector3(-0.022, yIni + 0.02, 0.03), new THREE.Vector3(-0.034, yIni - 0.015, 0.045), new THREE.Vector3(-0.028, yIni - 0.05, 0.052)]);
  g.add(new THREE.Mesh(new THREE.TubeGeometry(solta2, 12, 0.003, 4, false), M.tira));
  return g;
}

// ------------------------------------------------------------------
// 2) MACHADO DE METAL: machado viking de barba, runas gravadas, cabo curvo vermelho, alça de couro
// ------------------------------------------------------------------
function machadoMetal() {
  const M = materiais();
  const g = new THREE.Group();
  const topo = 0.54;
  // cabo: madeira avermelhada polida, curvo, mais grosso no topo e com o pé em leque
  const haste = new THREE.Mesh(
    caboLathe({
      y0: -0.1, y1: topo + 0.03, curva: 0.03, oval: 1.18,
      r: (t) => {
        let r = 0.019 + 0.012 * Math.exp(-(((t - 0.0) / 0.1) ** 2)) + 0.007 * Math.exp(-(((t - 0.93) / 0.12) ** 2)); // pé em leque e topo grosso
        r += 0.0025 * Math.sin(t * 5);
        if (t < 0.02) r *= 0.9 + t * 5;
        return r;
      },
    }),
    M.madeiraVerm,
  );
  g.add(haste);
  // lâmina: crescente com barba gancho (perfil lateral)
  const sh = new THREE.Shape();
  sh.moveTo(-0.045, 0.034);
  sh.lineTo(-0.045, -0.034);
  sh.quadraticCurveTo(0.0, -0.042, 0.035, -0.1); // curva côncava de baixo
  sh.lineTo(0.085, -0.15); // ponta da barba
  sh.quadraticCurveTo(0.15, 0.0, 0.135, 0.105); // fio, um pouco abaulado
  sh.lineTo(0.04, 0.052);
  sh.closePath();
  const edge = (y) => THREE.MathUtils.lerp(0.085, 0.135, THREE.MathUtils.clamp((y + 0.15) / 0.255, 0, 1)) + 0.02 * Math.sin(THREE.MathUtils.clamp((y + 0.15) / 0.255, 0, 1) * Math.PI);
  const geo = perfil(sh, { depth: 0.016, bevel: 0.005, edge, w: 0.06 });
  const lamina = new THREE.Mesh(geo, M.runas);
  lamina.position.y = topo - 0.02;
  lamina.scale.setScalar(1.3);
  g.add(lamina);
  // as runas ficam no meio da lâmina: UV recentrada
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.5 + (uv.getX(i) - 0.07) * 3.6, 0.5 + uv.getY(i) * 3.6);
  // olho de aço onde o cabo entra, com rebites
  const olho = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.088, 0.068), M.aco);
  olho.position.set(0, topo - 0.02, -0.002);
  g.add(olho);
  for (const sx of [-1, 1]) for (const dy of [-0.025, 0.025]) {
    const rb = new THREE.Mesh(new THREE.SphereGeometry(0.0065, 8, 6), M.prata);
    rb.position.set(sx * 0.0225, topo - 0.02 + dy, -0.02);
    g.add(rb);
  }
  // alça de couro: laço solto que sai do pé do cabo e pende para trás
  const alca = [];
  for (let i = 0; i <= 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    alca.push(new THREE.Vector3(0.0, -0.05 - 0.085 * (1 - Math.cos(a)) * 0.5 * 2 * 0.62, 0.03 + 0.05 * Math.sin(a) * 0.9 + 0.012));
  }
  g.add(tuboFita(alca, true, 0.0038, M.couroAlca, [3, 1, 1]));
  const nó = new THREE.Mesh(new THREE.TorusGeometry(0.0255, 0.004, 4, 14), M.couroAlca);
  nó.rotation.x = Math.PI / 2;
  nó.position.set(0, -0.045, 0);
  g.add(nó);
  return g;
}

// ------------------------------------------------------------------
// 3) MACHADO DE OBSIDIANA: machado de batalha negro (estilo Thor, sem ser o martelo)
// ------------------------------------------------------------------
function machadoObsidiana() {
  const M = materiais();
  const g = new THREE.Group();
  const topo = 0.58;
  // cabo enrolado em cordão negro, com argolas e ponteira
  const haste = new THREE.Mesh(
    caboLathe({ y0: -0.11, y1: topo + 0.02, r: (t) => 0.0215 + 0.002 * Math.sin(t * 40) * 0 + (t < 0.03 ? -0.004 : 0) }),
    M.cordao,
  );
  g.add(haste);
  for (const dy of [0.09, 0.22, 0.4]) { // argolas de metal
    const a = new THREE.Mesh(new THREE.TorusGeometry(0.0232, 0.0042, 5, 18), M.prata);
    a.rotation.x = Math.PI / 2;
    a.position.y = dy;
    g.add(a);
  }
  // ponteira: cone invertido com disco
  const disco = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.027, 0.014, 16), M.negroLiso);
  disco.position.y = -0.112;
  g.add(disco);
  const ponta = new THREE.Mesh(new THREE.ConeGeometry(0.026, 0.06, 12), M.negroLiso);
  ponta.rotation.x = Math.PI;
  ponta.position.y = -0.152;
  g.add(ponta);
  // lâmina em meia-lua: fio serrilhado prateado e ponta longa embaixo
  const sh = new THREE.Shape();
  const bez = (t, p0, p1, p2) => [(1 - t) * (1 - t) * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0], (1 - t) * (1 - t) * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1]];
  const toe = [0.215, 0.135];
  const horn = [0.15, -0.255];
  const ctl = [0.275, -0.04];
  sh.moveTo(0.035, 0.05);
  sh.quadraticCurveTo(0.12, 0.125, toe[0], toe[1]); // topo
  const N = 34;
  for (let i = 1; i <= N; i++) { // fio com serrilhado
    const t = i / N;
    const [x, y] = bez(t, toe, ctl, horn);
    const dx = 2 * (1 - t) * (ctl[0] - toe[0]) + 2 * t * (horn[0] - ctl[0]);
    const dy = 2 * (1 - t) * (ctl[1] - toe[1]) + 2 * t * (horn[1] - ctl[1]);
    const L = Math.hypot(dx, dy) || 1;
    const nx = dy / L;
    const ny = -dx / L;
    const dente = i % 2 ? 0.0075 : -0.0035;
    sh.lineTo(x + nx * dente, y + ny * dente);
  }
  sh.quadraticCurveTo(0.075, -0.115, 0.035, -0.055); // costas côncavas
  sh.closePath();
  const edge = (y) => {
    // s do fio nessa altura (curva de Bézier em função de y)
    const t = THREE.MathUtils.clamp((toe[1] - y) / (toe[1] - horn[1]), 0, 1);
    return bez(t, toe, ctl, horn)[0];
  };
  const geo = perfil(sh, { depth: 0.018, bevel: 0.0055, edge, w: 0.07, corFio: [2.4, 2.45, 2.6], base: [0.85, 0.88, 1.0] });
  const lamina = new THREE.Mesh(geo, M.negro);
  lamina.position.y = topo - 0.03;
  g.add(lamina);
  // sulco decorativo na lâmina (volutas): faixa lisa mais clara
  const volta = [];
  for (let i = 0; i <= 14; i++) {
    const t = i / 14;
    volta.push(new THREE.Vector3(0.012, topo - 0.03 + 0.04 - 0.1 * t, -(0.07 + 0.04 * Math.sin(t * Math.PI) - 0.0 * t)));
  }
  const vol = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(volta), 18, 0.0032, 4, false), M.prata);
  g.add(vol);
  // asas atrás (cruz de guarda): duas pontas, uma para cima e outra para baixo
  const asa = new THREE.Shape();
  asa.moveTo(-0.035, 0.052);
  asa.lineTo(-0.08, 0.068);
  asa.lineTo(-0.155, 0.135);
  asa.lineTo(-0.135, 0.06);
  asa.lineTo(-0.1, 0.032);
  asa.lineTo(-0.1, -0.032);
  asa.lineTo(-0.135, -0.06);
  asa.lineTo(-0.155, -0.135);
  asa.lineTo(-0.08, -0.068);
  asa.lineTo(-0.035, -0.052);
  asa.closePath();
  const ga = perfil(asa, { depth: 0.014, bevel: 0.004, base: [0.9, 0.92, 1.0] });
  const asaM = new THREE.Mesh(ga, M.negro);
  asaM.position.y = topo - 0.03;
  g.add(asaM);
  // encaixe esculpido (bloco central) com placas e colares
  const bloco = new THREE.Mesh(new THREE.BoxGeometry(0.056, 0.118, 0.086), M.negroLiso);
  bloco.position.set(0, topo - 0.03, 0);
  g.add(bloco);
  const placa = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.07, 0.05), M.prata);
  placa.position.set(0, topo - 0.03, 0);
  placa.scale.set(0.8, 0.8, 0.8);
  g.add(placa);
  for (const sx of [-1, 1]) {
    const rel = new THREE.Mesh(new THREE.TorusGeometry(0.014, 0.0028, 4, 12), M.negro);
    rel.position.set(sx * 0.0285, topo - 0.03, 0);
    rel.rotation.y = Math.PI / 2;
    g.add(rel);
  }
  const colarBaixo = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.025, 0.035, 16), M.negroLiso);
  colarBaixo.position.y = topo - 0.1;
  g.add(colarBaixo);
  const colarAnel = new THREE.Mesh(new THREE.TorusGeometry(0.027, 0.004, 5, 18), M.prata);
  colarAnel.rotation.x = Math.PI / 2;
  colarAnel.position.y = topo - 0.122;
  g.add(colarAnel);
  // espigão no topo
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.026, 0.03, 12), M.negroLiso);
  base.position.y = topo + 0.044;
  g.add(base);
  const anel2 = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.0035, 5, 14), M.prata);
  anel2.rotation.x = Math.PI / 2;
  anel2.position.y = topo + 0.062;
  g.add(anel2);
  const esp = new THREE.Mesh(new THREE.ConeGeometry(0.0185, 0.15, 8), M.negro);
  esp.geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(esp.geometry.attributes.position.count * 3).fill(0.75), 3));
  esp.position.y = topo + 0.138;
  g.add(esp);
  return g;
}

export { materiais, caboLathe, perfil, tuboFita, rng, canvasTex, madeiraTex };

export function makeAxe(variante = 'machado_pedra') {
  const g = variante === 'machado_silex' ? machadoObsidiana() : variante === 'machado_metal' ? machadoMetal() : machadoPedra();
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
