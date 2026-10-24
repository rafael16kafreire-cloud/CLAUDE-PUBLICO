// =============================================================
// EFEITOS – lascas de madeira, folhas, pó de pedra e respingos
// quando você bate em algo. Poucos pedacinhos reaproveitados
// (um desenho só), leve para o celular.
// =============================================================
import * as THREE from 'three';

const MAX = 80;

export const FX_COLORS = {
  madeira: ['#7a5a3a', '#a07a4e', '#5a4028'],
  folha: ['#3f6a2c', '#5a8a36', '#2f5222'],
  pedra: ['#8a857b', '#6a665e', '#a29c90'],
  sangue: ['#7a1a14', '#a0261c', '#5a120e'],
  agua: ['#9fc8d0', '#d8ecef', '#7fb0bc'],
};

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
    this._next = 0;
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler();
    this._s = new THREE.Vector3();
    this._c = new THREE.Color();
    scene.add(this.mesh);
    this._hideAll();
  }

  _hideAll() {
    this._m.makeScale(0, 0, 0);
    for (let i = 0; i < MAX; i++) this.mesh.setMatrixAt(i, this._m);
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  // Solta "count" pedacinhos no ponto, do tipo dado (madeira, folha...).
  burst(pos, kind = 'madeira', count = 8, power = 3) {
    const colors = FX_COLORS[kind] ?? FX_COLORS.madeira;
    for (let k = 0; k < count; k++) {
      const i = this._next;
      this._next = (this._next + 1) % MAX;
      const pt = this.parts[i];
      pt.life = 0.5 + Math.random() * 0.5;
      pt.p.copy(pos);
      pt.v.set((Math.random() - 0.5) * power, Math.random() * power * 0.9 + 1, (Math.random() - 0.5) * power);
      pt.r.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      pt.s = (kind === 'folha' ? 1.6 : 1) * (0.6 + Math.random() * 0.9);
      pt.gravity = kind === 'folha' ? 2.5 : 9.8;
      this.mesh.setColorAt(i, this._c.set(colors[k % colors.length]));
    }
    this.mesh.instanceColor.needsUpdate = true;
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
  }
}
