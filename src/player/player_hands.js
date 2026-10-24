// =============================================================
// MÃOS EM PRIMEIRA PESSOA
// Braços presos à câmera: respiram parados, balançam ao andar,
// dão soco, machadada/picaretada (de cima para baixo) e estocada
// de lança. A ferramenta em uso aparece na mão direita.
// =============================================================
import * as THREE from 'three';

const SKIN = new THREE.MeshLambertMaterial({ color: '#c99a6e' });
const SLEEVE = new THREE.MeshLambertMaterial({ color: '#a85f31' });
const WOOD = new THREE.MeshLambertMaterial({ color: '#7a5a3a' });
const STONE = new THREE.MeshLambertMaterial({ color: '#8a8a90' });
const FLINT = new THREE.MeshLambertMaterial({ color: '#4c505a' });
const ROPE = new THREE.MeshLambertMaterial({ color: '#a89058' });

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
  g.userData.fist = fist;
  g.scale.setScalar(0.72);
  g.position.set(0.24 * side, -0.25, -0.34);
  g.rotation.set(0.12, -0.18 * side, 0.15 * side);
  return g;
}

// Ferramentas (cabo para cima saindo do punho)
function makeTool(kind) {
  const g = new THREE.Group();
  const handle = (len, r = 0.02) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.1, len, 6), WOOD);
    m.position.y = len / 2 - 0.08;
    return m;
  };
  if (kind === 'machado') {
    g.add(handle(0.55));
    const head = new THREE.Mesh(new THREE.DodecahedronGeometry(0.07, 0), STONE);
    head.scale.set(0.5, 1, 1.6);
    head.position.set(0, 0.42, -0.06);
    const tie = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.012, 4, 8), ROPE);
    tie.rotation.x = Math.PI / 2;
    tie.position.y = 0.42;
    g.add(head, tie);
  } else if (kind === 'picareta') {
    g.add(handle(0.55));
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.36, 5), FLINT);
    head.rotation.x = Math.PI / 2;
    head.position.set(0, 0.44, -0.08);
    const back = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.18, 5), FLINT);
    back.rotation.x = -Math.PI / 2;
    back.position.set(0, 0.44, 0.1);
    g.add(head, back);
  } else if (kind === 'lanca') {
    g.add(handle(1.3, 0.016));
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.16, 4), FLINT);
    tip.position.y = 1.2;
    g.add(tip);
  } else if (kind === 'clava') {
    g.add(handle(0.42, 0.025));
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), WOOD);
    head.scale.set(1, 1.6, 1);
    head.position.y = 0.36;
    g.add(head);
  }
  return g;
}

export class PlayerHands {
  constructor(camera) {
    this.root = new THREE.Group();
    this.right = arm(1);
    this.left = arm(-1);
    this.root.add(this.right, this.left);
    this.tools = {};
    for (const k of ['machado', 'picareta', 'lanca', 'clava']) {
      const t = makeTool(k);
      t.visible = false;
      t.position.z = -0.26;
      t.rotation.x = -1.2; // inclinado para frente
      this.right.add(t);
      this.tools[k] = t;
    }
    this.root.traverse((o) => {
      if (o.isMesh) {
        o.renderOrder = 10;
        o.frustumCulled = false;
      }
    });
    camera.add(this.root);
    this.restR = this.right.position.clone();
    this.restL = this.left.position.clone();
    this.restRotR = this.right.rotation.clone();
    this._swing = 0;
    this._kind = 'mao';
    this._side = 1;
    this._bob = 0;
    this._t = 0;
    this._land = 0;
    this._wasGround = true;
    this.toolKind = 'mao';
  }

  setTool(kind) {
    this.toolKind = kind ?? 'mao';
    for (const [k, t] of Object.entries(this.tools)) t.visible = k === this.toolKind;
  }

  // Golpe: tipo da ferramenta muda a animação.
  swing(kind = this.toolKind) {
    this._swing = 1;
    this._kind = kind;
    if (kind === 'mao') this._side = -this._side; // soco alterna as mãos
  }

  update(dt, { visible, speed, swimming, running, onGround }) {
    this.root.visible = visible;
    if (!visible) return;
    this._t += dt;
    // aterrissagem: as mãos "afundam"
    if (onGround && !this._wasGround) this._land = 1;
    this._wasGround = onGround;
    this._land = Math.max(0, this._land - dt * 4);

    const moving = speed > 0.3;
    this._bob += dt * (moving ? 2 + speed * 1.2 : 0);
    const amp = moving ? Math.min(running ? 0.045 : 0.025, speed * 0.005) : 0;
    const breathe = Math.sin(this._t * 1.6) * 0.004;
    const by = Math.sin(this._bob * 2) * amp + breathe - this._land * 0.05;
    const bx = Math.cos(this._bob) * amp;

    this.right.position.set(this.restR.x + bx, this.restR.y + by, this.restR.z);
    this.left.position.set(this.restL.x + bx, this.restL.y + by, this.restL.z);
    this.right.rotation.copy(this.restRotR);
    const holding = this.toolKind !== 'mao';
    // segurando ferramenta: mão esquerda mais para baixo
    if (holding) this.left.position.y -= 0.08;
    if (running && !holding) {
      // braços bombeando na corrida
      const r = Math.sin(this._bob) * 0.06;
      this.right.position.z += r;
      this.left.position.z -= r;
    }
    if (swimming) {
      const s = Math.sin(this._bob * 1.5) * 0.1;
      this.right.position.x += s;
      this.left.position.x -= s;
      this.right.position.y -= 0.05;
      this.left.position.y -= 0.05;
    }

    if (this._swing > 0) {
      this._swing = Math.max(0, this._swing - dt * (this._kind === 'mao' ? 3.5 : 2.3));
      const t = 1 - this._swing;
      if (this._kind === 'mao') {
        const k = Math.sin(t * Math.PI);
        const hand = this._side > 0 ? this.right : this.left;
        hand.position.z -= k * 0.28;
        hand.position.x -= k * 0.1 * this._side;
        hand.position.y += k * 0.06;
      } else if (this._kind === 'lanca') {
        const k = Math.sin(t * Math.PI);
        this.right.position.z -= k * 0.35;
        this.right.position.x -= k * 0.08;
      } else {
        // levanta (0..0.35) e desce com força (0.35..0.6), volta
        const up = t < 0.35 ? t / 0.35 : t < 0.6 ? 1 - (t - 0.35) / 0.25 * 1.6 : -0.6 * (1 - (t - 0.6) / 0.4);
        this.right.rotation.x = this.restRotR.x + up * 1.1;
        this.right.position.y += up * 0.08;
        this.right.position.z -= Math.max(0, -up) * 0.15;
      }
    }
  }
}
