// =============================================================
// EFEITOS – lascas de madeira, folhas, pó de pedra e respingos
// quando você bate em algo. Poucos pedacinhos reaproveitados
// (um desenho só), leve para o celular.
// - madeira: lascas compridas que giram, caem e quicam no chão
// - marcas de corte: "buracos" na casca da árvore onde você bateu
//   (madeira clara no meio, borda escura); somem com o tempo
// =============================================================
import * as THREE from 'three';

const MAX = 80;
const MAX_CHIPS = 60;
const MAX_GOUGES = 64;
const GOUGE_LIFE = 300; // segundos

// Ferida de corte (como no ARK): entalhe com madeira laranja em camadas,
// borda de casca rasgada e sombra no alto. Desenhada por código.
function woundTexture() {
  const W = 256;
  const H = 192;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  let seed = 1234567;
  const R = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const cx = W / 2;
  const cy = H / 2;
  const rx = W * 0.46;
  const ry = H * 0.44;
  const N = 30;
  const pts = [];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const rad = 1 + (R() - 0.5) * 0.3 + (i % 2 ? -0.07 : 0.06);
    pts.push([cx + Math.cos(a) * rx * rad, cy + Math.sin(a) * ry * rad]);
  }
  const poly = (k) => {
    ctx.beginPath();
    pts.forEach(([x, y], i) => {
      const px = cx + (x - cx) * k;
      const py = cy + (y - cy) * k;
      if (i) ctx.lineTo(px, py);
      else ctx.moveTo(px, py);
    });
    ctx.closePath();
  };
  poly(1);
  ctx.fillStyle = '#2f2016';
  ctx.fill();
  poly(0.94);
  ctx.fillStyle = '#6a4a2c';
  ctx.fill();
  poly(0.86);
  const g = ctx.createRadialGradient(cx, cy + 6, 6, cx, cy, rx * 0.9);
  g.addColorStop(0, '#f6c27f');
  g.addColorStop(0.55, '#d58f4a');
  g.addColorStop(1, '#9c5c2a');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  poly(0.86);
  ctx.clip();
  // anéis de crescimento (camadas de madeira)
  ctx.lineWidth = 2.4;
  for (const t of [0.8, 0.6, 0.42, 0.26]) {
    ctx.strokeStyle = 'rgba(112,58,22,0.5)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 10, rx * 0.86 * t, ry * 0.86 * t, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  // fibras claras
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 40; i++) {
    const x = cx + (R() - 0.5) * rx * 1.6;
    const y = cy + (R() - 0.5) * ry * 1.6;
    ctx.strokeStyle = `rgba(255,226,170,${0.15 + R() * 0.2})`;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 10 + R() * 22, y + (R() - 0.5) * 3);
    ctx.stroke();
  }
  // sombra no alto (a casca cobre) e luz embaixo
  const sh = ctx.createLinearGradient(0, 0, 0, H);
  sh.addColorStop(0, 'rgba(38,18,6,0.7)');
  sh.addColorStop(0.45, 'rgba(38,18,6,0)');
  sh.addColorStop(1, 'rgba(255,214,150,0.18)');
  ctx.fillStyle = sh;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export const FX_COLORS = {
  madeira: ['#7a5a3a', '#a07a4e', '#5a4028'],
  folha: ['#3f6a2c', '#5a8a36', '#2f5222'],
  pedra: ['#8a857b', '#6a665e', '#a29c90'],
  sangue: ['#7a1a14', '#a0261c', '#5a120e'],
  agua: ['#9fc8d0', '#d8ecef', '#7fb0bc'],
  fumaca: ['#b8b4ac', '#8e8a84', '#d4d0c8'],
  poeira: ['#a89a7c', '#8c7f64', '#c2b79c'],
  ouro: ['#ffd25a', '#ffe9a0', '#f0a830'],
  cristal: ['#c8f0ff', '#8ad0f0', '#f0faff'],
  obsidiana: ['#2a2034', '#4a3a5a', '#16101e'],
};
// lascas: casca escura de um lado, madeira clara do outro
const CHIP_COLORS = ['#c9a46e', '#b58b55', '#d8b884', '#8a6238', '#a77d4a'];

export class Effects {
  constructor(scene) {
    const geo = new THREE.TetrahedronGeometry(0.06, 0);
    this.mesh = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial(), MAX);
    this.mesh.frustumCulled = false;
    this.mesh.count = MAX;
    this.mesh.setColorAt(0, new THREE.Color());
    this.parts = [];
    for (let i = 0; i < MAX; i++) {
      this.parts.push({ life: 0, p: new THREE.Vector3(), v: new THREE.Vector3(), r: new THREE.Vector3(), s: 1 });
    }
    // lascas de madeira (finas e compridas)
    this.chips = new THREE.InstancedMesh(new THREE.BoxGeometry(0.035, 0.012, 0.13), new THREE.MeshLambertMaterial(), MAX_CHIPS);
    this.chips.frustumCulled = false;
    this.chips.setColorAt(0, new THREE.Color());
    this.chipParts = [];
    for (let i = 0; i < MAX_CHIPS; i++) {
      this.chipParts.push({ life: 0, p: new THREE.Vector3(), v: new THREE.Vector3(), r: new THREE.Vector3(), w: new THREE.Vector3(), s: 1, rest: false });
    }
    this._nextChip = 0;
    // feridas de corte: pedaço de cilindro curvo que abraça o tronco (largo e estreito)
    const wmat = new THREE.MeshLambertMaterial({ map: woundTexture(), alphaTest: 0.45, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
    const mk = (arc) => {
      const m = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 10, 1, true, -arc / 2, arc), wmat, MAX_GOUGES);
      m.frustumCulled = false;
      m.setColorAt(0, new THREE.Color(1, 1, 1));
      return m;
    };
    this.gouges = mk(1.3);   // troncos finos: ferida larga em volta
    this.gougesB = mk(0.7);  // troncos grossos: ferida mais estreita
    this.gougeList = [];
    this._nextGouge = 0;
    this._wounds = new Map(); // golpes seguidos na mesma árvore se juntam e crescem

    this._next = 0;
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler();
    this._s = new THREE.Vector3();
    this._c = new THREE.Color();
    this.groundAt = null; // (x, z) => altura do chão (o mundo liga)
    scene.add(this.mesh, this.chips, this.gouges, this.gougesB);
    this._hideAll();
  }

  _hideAll() {
    this._m.makeScale(0, 0, 0);
    for (let i = 0; i < MAX; i++) this.mesh.setMatrixAt(i, this._m);
    for (let i = 0; i < MAX_CHIPS; i++) this.chips.setMatrixAt(i, this._m);
    for (let i = 0; i < MAX_GOUGES; i++) {
      this.gouges.setMatrixAt(i, this._m);
      this.gougesB.setMatrixAt(i, this._m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.chips.instanceMatrix.needsUpdate = true;
    this.gouges.instanceMatrix.needsUpdate = true;
  }

  // Solta "count" pedacinhos no ponto, do tipo dado (madeira, folha...).
  burst(pos, kind = 'madeira', count = 8, power = 3) {
    if (kind === 'madeira') {
      this._woodChips(pos, count + 4, power);
      count = Math.ceil(count * 0.4); // + um pouco de serragem
    }
    const colors = FX_COLORS[kind] ?? FX_COLORS.madeira;
    for (let k = 0; k < count; k++) {
      const i = this._next;
      this._next = (this._next + 1) % MAX;
      const pt = this.parts[i];
      pt.life = 0.5 + Math.random() * 0.5;
      pt.p.copy(pos);
      pt.v.set((Math.random() - 0.5) * power, Math.random() * power * 0.9 + 1, (Math.random() - 0.5) * power);
      pt.r.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      pt.s = (kind === 'folha' ? 1.6 : kind === 'madeira' ? 0.5 : kind === 'poeira' ? 2.4 : 1) * (0.6 + Math.random() * 0.9);
      pt.gravity = kind === 'folha' ? 2.5 : kind === 'fumaca' ? -0.6 : kind === 'poeira' ? 1.2 : kind === 'ouro' ? -1.5 : 9.8;
      this.mesh.setColorAt(i, this._c.set(colors[k % colors.length]));
    }
    this.mesh.instanceColor.needsUpdate = true;
  }

  _woodChips(pos, count, power) {
    for (let k = 0; k < count; k++) {
      const i = this._nextChip;
      this._nextChip = (this._nextChip + 1) % MAX_CHIPS;
      const c = this.chipParts[i];
      c.life = 2.5 + Math.random() * 2;
      c.rest = false;
      c.p.copy(pos).add(this._s.set((Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.2));
      c.v.set((Math.random() - 0.5) * power * 1.1, Math.random() * power * 0.7 + 1.2, (Math.random() - 0.5) * power * 1.1);
      c.r.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      c.w.set((Math.random() - 0.5) * 22, (Math.random() - 0.5) * 22, (Math.random() - 0.5) * 22);
      c.s = 0.5 + Math.random() * 0.9;
      this.chips.setColorAt(i, this._c.set(CHIP_COLORS[(Math.random() * CHIP_COLORS.length) | 0]));
    }
    this.chips.instanceColor.needsUpdate = true;
  }

  // Ferida de corte na casca: no tronco (centro x,z e raio r), do lado de
  // quem bateu (from), na altura y. Golpes seguidos na mesma árvore caem no
  // mesmo lugar e a ferida vai crescendo.
  gouge(x, z, r, y, from) {
    const dx = from.x - x;
    const dz = from.z - z;
    const l = Math.hypot(dx, dz) || 1;
    const key = `${Math.round(x)}_${Math.round(z)}`;
    const now = performance.now() / 1000;
    const prev = this._wounds.get(key);
    let a;
    let wy;
    let n = 0;
    if (prev && now - prev.t < 150) {
      a = prev.a + (Math.random() - 0.5) * 0.22;
      wy = prev.y + (Math.random() - 0.5) * 0.16;
      n = prev.n + 1;
    } else {
      a = Math.atan2(dx / l, dz / l) + (Math.random() - 0.5) * 0.3;
      wy = y + (Math.random() - 0.5) * 0.2;
    }
    this._wounds.set(key, { a, y: wy, t: now, n });
    const grow = 1 + Math.min(n, 6) * 0.13;
    const rr = r * 1.03;
    const i = this._nextGouge;
    this._nextGouge = (this._nextGouge + 1) % MAX_GOUGES;
    const prevItem = this.gougeList[i];
    this.gougeList[i] = {
      life: GOUGE_LIFE,
      big: r > 0.55,
      p: new THREE.Vector3(x, wy, z),
      q: new THREE.Quaternion().setFromEuler(this._e.set(0, a, 0, 'YXZ')),
      s: new THREE.Vector3(rr, (0.3 + Math.random() * 0.1) * grow, rr),
      tint: 0.85 + Math.random() * 0.25,
      prevBig: prevItem?.big,
    };
    this._setGouge(i);
  }

  _setGouge(i) {
    const g = this.gougeList[i];
    const use = g?.big ? this.gougesB : this.gouges;
    const other = g?.big ? this.gouges : this.gougesB;
    if (!g || g.life <= 0) this._m.makeScale(0, 0, 0);
    else this._m.compose(g.p, g.q, this._s.copy(g.s).multiplyScalar(Math.min(1, g.life / 5)));
    use.setMatrixAt(i, this._m);
    use.instanceMatrix.needsUpdate = true;
    if (g && g.life > 0) {
      use.setColorAt(i, this._c.setScalar(g.tint));
      if (use.instanceColor) use.instanceColor.needsUpdate = true;
      // a vaga pode ter sido usada pela outra malha antes
      other.setMatrixAt(i, this._m.makeScale(0, 0, 0));
      other.instanceMatrix.needsUpdate = true;
    }
  }

  update(dt) {
    let any = false;
    for (let i = 0; i < MAX; i++) {
      const pt = this.parts[i];
      if (pt.life <= 0) continue;
      any = true;
      pt.life -= dt;
      pt.v.y -= pt.gravity * dt;
      pt.p.addScaledVector(pt.v, dt);
      pt.r.addScaledVector(pt.v, dt * 2);
      const s = pt.life > 0 ? pt.s * Math.min(1, pt.life * 3) : 0;
      this._q.setFromEuler(this._e.set(pt.r.x, pt.r.y, pt.r.z));
      this._m.compose(pt.p, this._q, this._s.setScalar(s));
      this.mesh.setMatrixAt(i, this._m);
    }
    if (any || this._dirty) {
      this.mesh.instanceMatrix.needsUpdate = true;
      this._dirty = any;
    }
    // lascas: caem, quicam e ficam deitadas no chão até sumir
    let anyChip = false;
    for (let i = 0; i < MAX_CHIPS; i++) {
      const c = this.chipParts[i];
      if (c.life <= 0) continue;
      anyChip = true;
      c.life -= dt;
      if (!c.rest) {
        c.v.y -= 9.8 * dt;
        c.v.multiplyScalar(1 - dt * 0.6); // ar freia as lascas
        c.p.addScaledVector(c.v, dt);
        c.r.addScaledVector(c.w, dt);
        const g = this.groundAt ? this.groundAt(c.p.x, c.p.z) + 0.01 : -Infinity;
        if (c.p.y < g) {
          c.p.y = g;
          if (Math.abs(c.v.y) < 1.2) {
            c.rest = true;
            c.r.x = 0;
            c.r.z = (Math.random() - 0.5) * 0.3;
          } else {
            c.v.set(c.v.x * 0.5, -c.v.y * 0.3, c.v.z * 0.5);
            c.w.multiplyScalar(0.5);
          }
        }
      }
      const s = c.life > 0 ? c.s * Math.min(1, c.life * 1.5) : 0;
      this._q.setFromEuler(this._e.set(c.r.x, c.r.y, c.r.z));
      this._m.compose(c.p, this._q, this._s.setScalar(s));
      this.chips.setMatrixAt(i, this._m);
    }
    if (anyChip || this._dirtyChip) {
      this.chips.instanceMatrix.needsUpdate = true;
      this._dirtyChip = anyChip;
    }
    // marcas de corte somem devagar
    this._gougeT = (this._gougeT ?? 0) - dt;
    if (this._gougeT <= 0) {
      this._gougeT = 1;
      for (let i = 0; i < this.gougeList.length; i++) {
        const g = this.gougeList[i];
        if (!g || g.life <= 0) continue;
        g.life -= 1;
        if (g.life < 5) this._setGouge(i);
      }
    }
  }
}
