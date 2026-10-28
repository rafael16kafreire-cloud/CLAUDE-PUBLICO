// =============================================================
// BRAÇO EM PRIMEIRA PESSOA (só o direito, o mesmo do boneco/skin)
// Preso à câmera: respiram parados, balançam ao andar,
// dão soco, machadada/picaretada (de cima para baixo) e estocada
// de lança. A ferramenta em uso aparece na mão direita.
// =============================================================
import * as THREE from 'three';
import { FP_BRACO, FP_TEXTURA } from './skin_data.js';
import { skinGeometry, skinMaterial } from './player_model.js';

const WOOD = new THREE.MeshLambertMaterial({ color: '#7a5a3a' });
const STONE = new THREE.MeshLambertMaterial({ color: '#8a8a90' });
const FLINT = new THREE.MeshLambertMaterial({ color: '#4c505a' });
const ROPE = new THREE.MeshLambertMaterial({ color: '#a89058' });

// Braço direito em primeira pessoa (gerado em tools/models/personagem.py): ombro e bíceps
// perto da câmera, antebraço grosso com veias, punho fechado com os nós dos dedos e o polegar
// por cima, pulseira de couro com a gema verde. A origem do modelo é o centro do punho
// (onde as ferramentas encaixam); o antebraço vem para +z e o punho aponta para -z.
function skinArm() {
  const g = new THREE.Group();
  const hand = new THREE.Group();
  hand.position.z = -0.26;
  const arm = new THREE.Mesh(skinGeometry(FP_BRACO), skinMaterial(FP_TEXTURA, true));
  hand.add(arm);
  // gema verde da pulseira (brilha e pulsa devagar)
  const gem = new THREE.Mesh(
    new THREE.SphereGeometry(0.014, 12, 8),
    new THREE.MeshBasicMaterial({ color: '#3dff86' }),
  );
  gem.scale.set(1, 0.55, 1.25);
  gem.position.set(0, 0.0745, 0.22);
  hand.add(gem);
  g.userData.gem = gem;
  g.add(hand);
  g.userData.fist = hand;
  g.scale.setScalar(1.25);
  g.position.set(0.24, -0.25, -0.3);
  g.rotation.set(0.32, 0.2, 0.05);
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
  } else if (kind === 'tocha') {
    g.add(handle(0.5, 0.024));
    const wrap = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.032, 0.12, 7), ROPE);
    wrap.position.y = 0.42;
    const fl = new THREE.MeshBasicMaterial({ color: '#ffa040', transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending });
    const core = new THREE.MeshBasicMaterial({ color: '#ffe680', transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending });
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.32, 8, 1, true), fl);
    flame.position.y = 0.64;
    const inner = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.18, 6, 1, true), core);
    inner.position.y = 0.58;
    g.add(wrap, flame, inner);
    g.userData.flame = flame;
  } else if (kind === 'arco') {
    // arco curvo: a mão segura o meio; as pontas e a corda vêm para perto
    // de quem atira (arco em pé, um pouco inclinado)
    const R = 0.34;
    const half = Math.PI * 0.38;
    const arc = new THREE.TorusGeometry(R, 0.016, 5, 16, half * 2);
    arc.rotateZ(Math.PI - half);
    arc.translate(R, 0, 0); // meio do arco no punho
    arc.rotateY(-Math.PI / 2); // pontas para trás (+z)
    const bow = new THREE.Mesh(arc, WOOD);
    const tipZ = R * (1 - Math.cos(half));
    const tipY = R * Math.sin(half);
    const string = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, tipY * 2, 3), ROPE);
    string.position.z = tipZ;
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.1, 6), ROPE);
    g.add(bow, string, grip);
  } else if (kind === 'pistola') {
    // cabo na mão, cano apontando para frente
    const metal = new THREE.MeshLambertMaterial({ color: '#4a4e56' });
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.11, 0.05), WOOD);
    grip.rotation.x = 0.25;
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.05, 0.12), metal);
    body.position.set(0, 0.07, -0.03);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.16, 8).rotateX(Math.PI / 2), metal);
    barrel.position.set(0, 0.08, -0.15);
    g.add(grip, body, barrel);
  } else if (kind === 'luneta') {
    const brass = new THREE.MeshLambertMaterial({ color: '#b08a40' });
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.03, 0.3, 10).rotateX(Math.PI / 2), brass);
    tube.position.set(0, 0.04, -0.08);
    const wrap = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.08, 10).rotateX(Math.PI / 2), ROPE);
    wrap.position.set(0, 0.04, 0.02);
    g.add(tube, wrap);
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
    // Só o braço direito aparece (o esquerdo fica fora da tela).
    this.right = skinArm();
    this.left = new THREE.Group();
    this.root.add(this.right);
    this.tools = {};
    for (const k of ['machado', 'picareta', 'lanca', 'clava', 'tocha', 'arco', 'pistola', 'luneta']) {
      const t = makeTool(k);
      t.visible = false;
      t.position.z = -0.26;
      // inclinado para frente (arco quase em pé; pistola e luneta já apontam para frente)
      t.rotation.x = k === 'arco' ? -0.1 : k === 'pistola' || k === 'luneta' ? 0 : -1.2;
      if (k === 'arco') t.rotation.z = 0.35;
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
    this._side = 1; // um braço só
  }

  // Coletar: a mão desce, pega e volta.
  gather() {
    this._gather = 1;
  }

  update(dt, { visible, speed, swimming, running, onGround }) {
    this.root.visible = visible;
    if (!visible) return;
    this._t += dt;
    const gem = this.right.userData.gem;
    if (gem) gem.material.color.setRGB(0.16 + 0.1 * Math.sin(this._t * 2.2), 0.85 + 0.15 * Math.sin(this._t * 2.2), 0.42 + 0.1 * Math.sin(this._t * 2.2));
    const fl = this.tools.tocha?.userData.flame;
    if (fl && this.toolKind === 'tocha') fl.scale.set(1, 0.85 + Math.sin(this._t * 17) * 0.12 + Math.sin(this._t * 41) * 0.06, 1);
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

    if (this._gather > 0) {
      this._gather = Math.max(0, this._gather - dt * 1.8);
      const t = 1 - this._gather;
      // desce e vai para frente (0..0.5), fecha a mão e puxa de volta (0.5..1)
      const reach = Math.sin(Math.min(1, t / 0.5) * Math.PI * 0.5) * (t < 0.5 ? 1 : 1 - (t - 0.5) / 0.5);
      this.right.position.y -= reach * 0.22;
      this.right.position.z -= reach * 0.2;
      this.right.position.x -= reach * 0.05;
      this.right.rotation.x = this.restRotR.x - reach * 0.7;
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
      } else if (this._kind === 'arco') {
        // tiro: recua um pouco (coice da corda)
        const k = Math.sin(t * Math.PI);
        this.right.position.z += k * 0.08;
      } else if (this._kind === 'pistola') {
        // coice: sobe e volta
        const k = Math.sin(Math.min(1, t * 2) * Math.PI) * (1 - t);
        this.right.position.z += k * 0.12;
        this.right.rotation.x = this.restRotR.x + k * 0.5;
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
