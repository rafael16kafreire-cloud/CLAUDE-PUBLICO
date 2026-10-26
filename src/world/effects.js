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
const MAX_GOUGES = 48;
const GOUGE_LIFE = 90; // segundos

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
    // marcas de corte na casca: disco com centro claro e borda escura
    const g = new THREE.CircleGeometry(1, 9);
    const col = new Float32Array(g.attributes.position.count * 3);
    const light = new THREE.Color('#d9b680');
    const dark = new THREE.Color('#2e1d0f');
    for (let i = 0; i < g.attributes.position.count; i++) (i === 0 ? light : dark).toArray(col, i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.gouges = new THREE.InstancedMesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -2 }), MAX_GOUGES);
    this.gouges.frustumCulled = false;
    this.gougeList = [];
    this._nextGouge = 0;

    this._next = 0;
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler();
    this._s = new THREE.Vector3();
    this._c = new THREE.Color();
    this.groundAt = null; // (x, z) => altura do chão (o mundo liga)
    scene.add(this.mesh, this.chips, this.gouges);
    this._hideAll();
  }

  _hideAll() {
    this._m.makeScale(0, 0, 0);
    for (let i = 0; i < MAX; i++) this.mesh.setMatrixAt(i, this._m);
    for (let i = 0; i < MAX_CHIPS; i++) this.chips.setMatrixAt(i, this._m);
    for (let i = 0; i < MAX_GOUGES; i++) this.gouges.setMatrixAt(i, this._m);
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

  // Marca de corte na casca: no tronco (centro x,z e raio r), do lado de
  // quem bateu (from), na altura y.
  gouge(x, z, r, y, from) {
    const dx = from.x - x;
    const dz = from.z - z;
    const l = Math.hypot(dx, dz) || 1;
    const nx = dx / l;
    const nz = dz / l;
    // um pouco para os lados, para as marcas não ficarem uma em cima da outra
    const a = Math.atan2(nx, nz) + (Math.random() - 0.5) * 0.5;
    const px = x + Math.sin(a) * r * 1.02;
    const pz = z + Math.cos(a) * r * 1.02;
    const i = this._nextGouge;
    this._nextGouge = (this._nextGouge + 1) % MAX_GOUGES;
    const s = 0.06 + Math.random() * 0.05;
    this.gougeList[i] = {
      life: GOUGE_LIFE,
      p: new THREE.Vector3(px, y + (Math.random() - 0.5) * 0.35, pz),
      q: new THREE.Quaternion().setFromEuler(this._e.set(0, a, (Math.random() - 0.5) * 0.6, 'YXZ')),
      s: new THREE.Vector3(s * 0.8, s * (1.3 + Math.random() * 0.6), 1),
    };
    this._setGouge(i);
  }

  _setGouge(i) {
    const g = this.gougeList[i];
    if (!g || g.life <= 0) this._m.makeScale(0, 0, 0);
    else this._m.compose(g.p, g.q, this._s.copy(g.s).multiplyScalar(Math.min(1, g.life / 5)));
    this.gouges.setMatrixAt(i, this._m);
    this.gouges.instanceMatrix.needsUpdate = true;
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
