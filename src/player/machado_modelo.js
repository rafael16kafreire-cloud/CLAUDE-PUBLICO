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
    g.fillStyle = '#6c7078';
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
    g.fillStyle = '#b79c64';
    g.fillRect(0, 0, N, N);
    for (let i = -N; i < N * 2; i += 5) {
      g.strokeStyle = `rgba(${95 + r() * 40},${72 + r() * 30},${36 + r() * 20},0.6)`;
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(i, 0);
      g.lineTo(i + N * 0.6, N);
      g.stroke();
      g.strokeStyle = 'rgba(230,208,150,0.4)';
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(i + 2, 0);
      g.lineTo(i + 2 + N * 0.6, N);
      g.stroke();
    }
  }, [6, 1]);
  mats = {
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

// Lâmina de sílex lascado: perfil de machado, com fio fino na frente e faces facetadas.
function lamina(yc) {
  const sh = new THREE.Shape();
  // perfil visto de lado: x = frente(-)/trás(+), y = para cima
  sh.moveTo(0.05, -0.045);
  sh.lineTo(0.055, 0.0);
  sh.lineTo(0.05, 0.05);
  sh.lineTo(-0.01, 0.062);
  sh.lineTo(-0.085, 0.092);
  sh.lineTo(-0.118, 0.05);
  sh.lineTo(-0.128, 0.0);
  sh.lineTo(-0.115, -0.055);
  sh.lineTo(-0.075, -0.09);
  sh.lineTo(-0.005, -0.06);
  sh.closePath();
  const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.034, bevelEnabled: true, bevelThickness: 0.014, bevelSize: 0.012, bevelSegments: 2, curveSegments: 1 });
  geo.translate(0, 0, -0.017); // centra a espessura
  geo.rotateY(Math.PI / 2); // espessura passa para o eixo X; frente fica em -Z
  geo.translate(0, yc, 0);
  // afina para o fio: quanto mais à frente (z negativo), mais fina a lâmina
  const p = geo.attributes.position;
  const r = rng(21);
  for (let i = 0; i < p.count; i++) {
    const z = p.getZ(i);
    const k = THREE.MathUtils.clamp((-z - 0.01) / 0.11, 0, 1);
    p.setX(i, p.getX(i) * (1 - 0.86 * k * k));
  }
  const ni = geo.toNonIndexed(); // faces separadas: cada lasca com sua luz
  const q = ni.attributes.position;
  const jit = new Map();
  for (let i = 0; i < q.count; i++) { // lascas: empurra cada ponto um pouquinho (igual para pontos iguais)
    const key = `${q.getX(i).toFixed(4)},${q.getY(i).toFixed(4)},${q.getZ(i).toFixed(4)}`;
    if (!jit.has(key)) jit.set(key, [(r() - 0.5) * 0.007, (r() - 0.5) * 0.007, (r() - 0.5) * 0.007]);
    const j = jit.get(key);
    q.setXYZ(i, q.getX(i) + j[0], q.getY(i) + j[1], q.getZ(i) + j[2]);
  }
  ni.computeVertexNormals();
  // UV por posição (a textura de pedra não estica)
  const uv = new Float32Array(q.count * 2);
  for (let i = 0; i < q.count; i++) {
    uv[i * 2] = q.getZ(i) * 5 + q.getX(i) * 3;
    uv[i * 2 + 1] = q.getY(i) * 5;
  }
  ni.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return ni;
}

// Voltas de fibra: hélice em volta do cabo + duas voltas cruzadas pela cabeça.
function amarracao(y0, y1) {
  const g = new THREE.Group();
  const M = materiais();
  const pts = [];
  const voltas = 8;
  for (let i = 0; i <= voltas * 14; i++) {
    const t = i / (voltas * 14);
    const a = t * voltas * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a) * 0.0285, y0 + (y1 - y0) * t, Math.sin(a) * 0.0285));
  }
  g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 140, 0.0056, 5, false), M.fibra));
  for (const s of [-1, 1]) { // cruzadas passando pelos dois lados da lâmina
    const c = [];
    for (let i = 0; i <= 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      c.push(new THREE.Vector3(Math.cos(a) * 0.04 * (0.6 + 0.4 * Math.abs(Math.sin(a))), (y0 + y1) / 2 + s * 0.016 + Math.sin(a * 2) * 0.012, Math.sin(a) * 0.05));
    }
    g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(c, true), 48, 0.0048, 5, true), M.fibra));
  }
  return g;
}

export function makeAxe() {
  const M = materiais();
  const g = new THREE.Group();
  g.name = 'MachadoPedra';
  const altura = 0.64;
  const topo = 0.47;
  const haste = new THREE.Mesh(cabo(altura, topo), M.madeira);
  const head = new THREE.Mesh(lamina(topo - 0.02), M.pedra);
  g.add(haste, head, amarracao(topo - 0.075, topo + 0.035).translateY(0));
  g.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  return g;
}
