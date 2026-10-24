// =============================================================
// MODELO DO JOGADOR (placeholder low-poly com caixas)
// Tem animações simples feitas por código: andar, correr,
// nadar, agachar, golpe e cair morto.
// =============================================================
import * as THREE from 'three';

const mat = (hex) => new THREE.MeshLambertMaterial({ color: hex, flatShading: true });

const SKIN = mat('#d6a274');
const SHIRT = mat('#c9703a');
const PANTS = mat('#4f4434');
const HAIR = mat('#3a281b');
const DARK = mat('#1f1a16');

function box(w, h, d, material, y = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
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

    this.torso = box(0.5, 0.66, 0.28, SHIRT, 1.16);
    this.head = box(0.32, 0.32, 0.3, SKIN, 1.66);
    const hair = box(0.34, 0.1, 0.32, HAIR, 0.17);
    this.head.add(hair);
    const eyeL = box(0.05, 0.05, 0.02, DARK, 0.02);
    eyeL.position.set(-0.07, 0.02, -0.155);
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.07;
    this.head.add(eyeL, eyeR);
    this.head.position.y = 1.66;

    // Braços e pernas giram a partir do ombro/quadril.
    this.armL = this._limb(-0.33, 1.44, 0.14, 0.6, SKIN, SHIRT);
    this.armR = this._limb(0.33, 1.44, 0.14, 0.6, SKIN, SHIRT);
    this.legL = this._limb(-0.13, 0.82, 0.19, 0.8, PANTS, PANTS);
    this.legR = this._limb(0.13, 0.82, 0.19, 0.8, PANTS, PANTS);

    this.body.add(this.torso, this.head, this.armL, this.armR, this.legL, this.legR);

    this._phase = 0;
    this._swing = 0; // animação de golpe (0 = parado)
  }

  _limb(x, y, w, len, endMat, topMat) {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, 0);
    const upper = box(w, len * 0.55, w, topMat, -len * 0.27);
    const lower = box(w * 0.92, len * 0.5, w * 0.92, endMat, -len * 0.75);
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
