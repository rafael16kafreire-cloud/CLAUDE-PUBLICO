// =============================================================
// MODELO DO JOGADOR (placeholder com formas arredondadas)
// Tem animações simples feitas por código: andar, correr,
// nadar, agachar, golpe e cair morto.
// =============================================================
import * as THREE from 'three';

const mat = (hex) => new THREE.MeshLambertMaterial({ color: hex });

const SKIN = mat('#c99a6e');
const SHIRT = mat('#a85f31');
const PANTS = mat('#4a4033');
const HAIR = mat('#33241a');
const DARK = mat('#1f1a16');
const BOOT = mat('#3b2e22');

function part(geometry, material, y = 0) {
  const m = new THREE.Mesh(geometry, material);
  m.position.y = y;
  m.castShadow = true;
  return m;
}

export class PlayerModel {
  constructor() {
    this.root = new THREE.Group();
    this.root.name = 'Jogador';
    // "body" gira para nadar/morrer; "root" segue a posição.
    this.body = new THREE.Group();
    this.root.add(this.body);

    // tronco (cápsula achatada) + quadril
    this.torso = part(new THREE.CapsuleGeometry(0.2, 0.36, 6, 14), SHIRT, 1.2);
    this.torso.scale.set(1.15, 1, 0.75);
    const hips = part(new THREE.CapsuleGeometry(0.17, 0.12, 4, 12), PANTS, 0.9);
    hips.scale.set(1.15, 1, 0.8);
    const neck = part(new THREE.CylinderGeometry(0.06, 0.07, 0.12, 10), SKIN, 1.52);

    // cabeça com cabelo, nariz e olhos
    this.head = new THREE.Group();
    this.head.position.y = 1.67;
    const skull = part(new THREE.SphereGeometry(0.135, 16, 12), SKIN);
    skull.scale.set(0.95, 1.08, 1);
    const hair = part(new THREE.SphereGeometry(0.142, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), HAIR, 0.02);
    hair.rotation.x = 0.25;
    const nose = part(new THREE.SphereGeometry(0.025, 8, 6), SKIN, -0.01);
    nose.position.z = -0.135;
    const eyeL = part(new THREE.SphereGeometry(0.016, 8, 6), DARK, 0.025);
    eyeL.position.set(-0.048, 0.025, -0.118);
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.048;
    this.head.add(skull, hair, nose, eyeL, eyeR);

    // braços e pernas giram a partir do ombro/quadril
    this.armL = this._limb(-0.27, 1.43, 0.055, 0.6, SHIRT, SKIN);
    this.armR = this._limb(0.27, 1.43, 0.055, 0.6, SHIRT, SKIN);
    this.legL = this._limb(-0.11, 0.86, 0.08, 0.82, PANTS, BOOT);
    this.legR = this._limb(0.11, 0.86, 0.08, 0.82, PANTS, BOOT);

    this.body.add(this.torso, hips, neck, this.head, this.armL, this.armR, this.legL, this.legR);

    this._phase = 0;
    this._swing = 0; // animação de golpe (0 = parado)
  }

  _limb(x, y, r, len, topMat, endMat) {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, 0);
    const upper = part(new THREE.CapsuleGeometry(r, len * 0.38, 4, 10), topMat, -len * 0.25);
    const lower = part(new THREE.CapsuleGeometry(r * 0.88, len * 0.36, 4, 10), endMat, -len * 0.7);
    pivot.add(upper, lower);
    return pivot;
  }

  swing() {
    if (this._swing <= 0) this._swing = 1;
  }

  // state: { position, facing, speed, onGround, crouching, swimming, dead, visible }
  update(dt, s) {
    this.root.position.copy(s.position);
    this.root.rotation.y = s.facing;
    this.root.visible = s.visible;

    const b = this.body;
    if (s.dead) {
      b.rotation.set(0, 0, Math.PI / 2);
      b.position.set(0.9, 0.15, 0);
      this._resetLimbs();
      return;
    }

    // Ritmo da caminhada proporcional à velocidade.
    const moving = s.speed > 0.3;
    this._phase += dt * (moving ? 2.2 + s.speed * 1.1 : 0);
    const amp = moving ? Math.min(0.9, 0.25 + s.speed * 0.09) : 0;
    const sw = Math.sin(this._phase);

    if (s.swimming) {
      // Corpo deitado, braçadas e pernadas.
      b.rotation.set(-1.15, 0, 0);
      b.position.set(0, 1.25, 0.35);
      this.armL.rotation.set(-2.6 + sw * 0.8, 0, -0.3);
      this.armR.rotation.set(-2.6 - sw * 0.8, 0, 0.3);
      this.legL.rotation.set(sw * 0.4, 0, 0);
      this.legR.rotation.set(-sw * 0.4, 0, 0);
    } else {
      b.rotation.set(0, 0, 0);
      b.position.set(0, 0, 0);
      b.rotation.x = s.crouching ? -0.25 : 0;
      this.legL.rotation.set(sw * amp, 0, 0);
      this.legR.rotation.set(-sw * amp, 0, 0);
      this.armL.rotation.set(-sw * amp * 0.8, 0, -0.06);
      this.armR.rotation.set(sw * amp * 0.8, 0, 0.06);
      if (!s.onGround) {
        // No ar: pernas um pouco dobradas.
        this.legL.rotation.x = -0.35;
        this.legR.rotation.x = 0.2;
      }
    }
    b.scale.y = !s.swimming && s.crouching ? 0.68 : 1;

    // Golpe com o braço direito (botão Atacar).
    if (this._swing > 0) {
      this._swing = Math.max(0, this._swing - dt * 3.2);
      const t = 1 - this._swing;
      this.armR.rotation.x = -2.4 * Math.sin(t * Math.PI);
    }
  }

  _resetLimbs() {
    for (const limb of [this.armL, this.armR, this.legL, this.legR]) limb.rotation.set(0, 0, 0);
  }
}
