// =============================================================
// MÃOS EM PRIMEIRA PESSOA
// Braços presos à câmera: balançam ao andar e dão o soco.
// =============================================================
import * as THREE from 'three';

const SKIN = new THREE.MeshLambertMaterial({ color: '#c99a6e' });
const SLEEVE = new THREE.MeshLambertMaterial({ color: '#a85f31' });

function arm(side) {
  const g = new THREE.Group();
  const sleeve = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.22, 4, 10), SLEEVE);
  sleeve.rotation.x = Math.PI / 2;
  sleeve.position.z = 0.1;
  const forearm = new THREE.Mesh(new THREE.CapsuleGeometry(0.042, 0.18, 4, 10), SKIN);
  forearm.rotation.x = Math.PI / 2;
  forearm.position.z = -0.12;
  const fist = new THREE.Mesh(new THREE.SphereGeometry(0.058, 12, 10), SKIN);
  fist.scale.set(1, 0.9, 1.15);
  fist.position.z = -0.26;
  g.add(sleeve, forearm, fist);
  g.scale.setScalar(0.72);
  g.position.set(0.24 * side, -0.25, -0.34);
  g.rotation.set(0.12, -0.18 * side, 0.15 * side);
  return g;
}

export class PlayerHands {
  constructor(camera) {
    this.root = new THREE.Group();
    this.right = arm(1);
    this.left = arm(-1);
    this.root.add(this.right, this.left);
    // desenhado por cima de tudo (não entra dentro de paredes/árvores)
    this.root.traverse((o) => {
      if (o.isMesh) {
        o.renderOrder = 10;
        o.frustumCulled = false;
      }
    });
    camera.add(this.root);
    this.restR = this.right.position.clone();
    this.restL = this.left.position.clone();
    this._punch = 0;
    this._side = 1;
    this._bob = 0;
  }

  punch() {
    this._punch = 1;
    this._side = -this._side; // alterna as mãos
  }

  update(dt, { visible, speed, swimming }) {
    this.root.visible = visible;
    if (!visible) return;
    this._bob += dt * (speed > 0.3 ? 2 + speed * 1.2 : 0.8);
    const bobAmp = speed > 0.3 ? Math.min(0.025, speed * 0.004) : 0.006;
    const by = Math.sin(this._bob * 2) * bobAmp;
    const bx = Math.cos(this._bob) * bobAmp;

    this.right.position.copy(this.restR).add(new THREE.Vector3(bx, by, 0));
    this.left.position.copy(this.restL).add(new THREE.Vector3(bx, by, 0));
    if (swimming) {
      const s = Math.sin(this._bob * 1.5) * 0.1;
      this.right.position.x += s;
      this.left.position.x -= s;
      this.right.position.y -= 0.05;
      this.left.position.y -= 0.05;
    }

    if (this._punch > 0) {
      this._punch = Math.max(0, this._punch - dt * 3.5);
      const t = 1 - this._punch;
      const k = Math.sin(t * Math.PI); // vai e volta
      const hand = this._side > 0 ? this.right : this.left;
      hand.position.z -= k * 0.28;
      hand.position.x -= k * 0.1 * this._side;
      hand.position.y += k * 0.06;
    }
  }
}
