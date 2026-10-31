// =============================================================
// BRAÇO EM PRIMEIRA PESSOA (só o direito, o mesmo do boneco/skin)
// Preso à câmera: respiram parados, balançam ao andar,
// dão soco, machadada/picaretada (de cima para baixo) e estocada
// de lança. A ferramenta em uso aparece na mão direita.
// =============================================================
import * as THREE from 'three';
import { pixelTexture } from './pixel_tex.js';
import { settings } from '../core/settings.js';

const WOOD = new THREE.MeshLambertMaterial({ color: '#7a5a3a' });
const STONE = new THREE.MeshLambertMaterial({ color: '#8a8a90' });
const FLINT = new THREE.MeshLambertMaterial({ color: '#4c505a' });
const ROPE = new THREE.MeshLambertMaterial({ color: '#a89058' });

// Braço direito em primeira pessoa, simples como o do Minecraft: um bloco comprido na cor da
// pele do personagem. A ponta da frente é a mão (onde as ferramentas encaixam).
// Textura de pele em pixels (com pontinhos de cor, sardas e borda mais escura em cada
// face) + sombra suave pintada nos vértices: o ombro (perto da câmera) fica mais escuro, a
// mão mais clara, e a parte de baixo escurece. Assim o bloco tem volume e não vira uma
// mancha chapada.
function skinTexture() {
  const N = 16;
  const c = document.createElement('canvas');
  c.width = N;
  c.height = N;
  const g = c.getContext('2d');
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const k = 0.965 + rnd() * 0.07; // pixel um pouco mais claro/escuro
      let r = 226 * k;
      let gg = 178 * k;
      let b = 150 * k;
      if (rnd() < 0.02) { r *= 0.9; gg *= 0.85; b *= 0.83; } // sarda bem leve
      // borda da face um pouco mais escura (marca os cantos do bloco)
      const edge = x === 0 || y === 0 || x === N - 1 || y === N - 1;
      if (edge) { r *= 0.95; gg *= 0.94; b *= 0.93; }
      g.fillStyle = `rgb(${r | 0},${gg | 0},${b | 0})`;
      g.fillRect(x, y, 1, 1);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  return t;
}

function armGeometry() {
  const geo = new THREE.BoxGeometry(0.15, 0.15, 0.38, 2, 2, 6);
  const pos = geo.getAttribute('position');
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const t = THREE.MathUtils.clamp(0.5 - z / 0.38, 0, 1); // 0 = ombro (perto da câmera), 1 = mão
    let k = 0.72 + 0.34 * t; // ombro um pouco escuro -> mão clara
    k *= 1 - 0.18 * THREE.MathUtils.smoothstep(-y, 0.0, 0.075); // barriga do braço escurece
    k *= 1 - 0.08 * THREE.MathUtils.smoothstep(Math.abs(x), 0.02, 0.075); // lados mais escuros que o meio
    k *= 0.9 + 0.1 * THREE.MathUtils.smoothstep(t, 0.78, 0.9); // punho um pouco mais claro (nós dos dedos)
    col[i * 3] = k;
    col[i * 3 + 1] = k * 0.985;
    col[i * 3 + 2] = k * 0.98;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}

let BRACO_FP = null;
function skinArm() {
  if (!BRACO_FP) BRACO_FP = new THREE.MeshLambertMaterial({ map: skinTexture(), vertexColors: true, emissive: '#3a2a24' });
  const g = new THREE.Group();
  const hand = new THREE.Group();
  hand.position.z = -0.26;
  const arm = new THREE.Mesh(armGeometry(), BRACO_FP);
  arm.position.z = 0.0; // a ponta da frente fica na altura da mão
  hand.add(arm);
  // dedos: um bloco menor na ponta, com uma divisória (dá cara de mão fechada)
  const fgeo = new THREE.BoxGeometry(0.15, 0.06, 0.07);
  fgeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(fgeo.getAttribute('position').count * 3).fill(0.92), 3));
  const fingers = new THREE.Mesh(fgeo, BRACO_FP);
  fingers.position.set(0, -0.045, -0.2);
  hand.add(fingers);
  g.add(hand);
  g.userData.fist = hand;
  g.scale.setScalar(1.25);
  g.position.set(0.24, -0.25, -0.3);
  g.rotation.set(0.32, 0.2, 0.05);
  return g;
}

// Braço quadradinho (blocos com "pixels"): manga azul, antebraço e punho de pele
function blockyArm() {
  const tex = pixelTexture();
  const m = (hex) => new THREE.MeshLambertMaterial({ color: hex, map: tex, emissive: '#2a1d16' });
  const g = new THREE.Group();
  const hand = new THREE.Group();
  hand.position.z = -0.26;
  const part = (w, h, d, mat, z) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    b.position.z = z;
    hand.add(b);
  };
  const skin = m('#d4a174');
  part(0.085, 0.085, 0.34, skin, 0.1); // antebraço
  part(0.1, 0.1, 0.3, m('#3a83b5'), 0.4); // manga
  part(0.095, 0.095, 0.1, skin, -0.1); // punho
  g.add(hand);
  g.userData.fist = hand;
  g.scale.setScalar(1.25);
  g.position.set(0.24, -0.25, -0.3);
  g.rotation.set(0.32, 0.2, 0.05);
  return g;
}

// Ferramentas (cabo para cima saindo do punho)
export function makeTool(kind) {
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

// Curva do golpe: puxa o braço para trás (0..0.2), ataca acelerando (0.2..0.4) e volta macio.
const eo3 = (u) => 1 - (1 - u) ** 3;
const ei3 = (u) => u * u * u;
const eio = (u) => (u < 0.5 ? 2 * u * u : 1 - 2 * (1 - u) * (1 - u));
function swingCurve(t) {
  if (t < 0.2) return -0.22 * eo3(t / 0.2);
  if (t < 0.4) return -0.22 + 1.22 * ei3((t - 0.2) / 0.2);
  return 1 - eio((t - 0.4) / 0.6);
}

export class PlayerHands {
  constructor(camera) {
    this.root = new THREE.Group();
    // Só o braço direito aparece (o esquerdo fica fora da tela).
    this.right = settings.get('personagem') === 'realista' ? skinArm() : blockyArm();
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
    if ((kind ?? 'mao') !== this.toolKind) this._equip = 1; // a ferramenta sobe de baixo ao trocar
    this.toolKind = kind ?? 'mao';
    for (const [k, t] of Object.entries(this.tools)) t.visible = k === this.toolKind;
  }

  // Golpe: tipo da ferramenta muda a animação.
  swing(kind = this.toolKind) {
    this._swing = 1;
    this._kind = kind;
    this._side = 1; // um braço só
  }

  // Beber: a mão desce, pega a água em concha e leva até a boca.
  drink() {
    this._drink = 1;
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
    if (gem) gem.material.color.setRGB(0.05 + 0.04 * Math.sin(this._t * 2.2), 0.75 + 0.2 * Math.sin(this._t * 2.2), 0.3 + 0.1 * Math.sin(this._t * 2.2));
    const fl = this.tools.tocha?.userData.flame;
    if (fl && this.toolKind === 'tocha') fl.scale.set(1, 0.85 + Math.sin(this._t * 17) * 0.12 + Math.sin(this._t * 41) * 0.06, 1);
    // aterrissagem: as mãos "afundam"
    if (onGround && !this._wasGround) this._land = 1;
    this._wasGround = onGround;
    this._land = Math.max(0, this._land - dt * 4);
    this._air = (this._air ?? 0) + ((onGround ? 0 : 1) - (this._air ?? 0)) * Math.min(1, dt * 8); // no ar: braço sobe
    this._equip = Math.max(0, (this._equip ?? 0) - dt * 3.2);
    this._run = (this._run ?? 0) + ((running && speed > 3 && onGround ? 1 : 0) - (this._run ?? 0)) * Math.min(1, dt * 6);

    const moving = speed > 0.3;
    this._bob += dt * (moving ? 2 + speed * 1.2 : 0);
    const amp = moving ? Math.min(running ? 0.09 : 0.05, speed * 0.01) : 0;
    const breathe = Math.sin(this._t * 1.6) * 0.004;
    const by = Math.sin(this._bob * 2) * amp + breathe - this._land * 0.05;
    const bx = Math.cos(this._bob) * amp;

    this.right.position.set(this.restR.x + bx, this.restR.y + by, this.restR.z);
    this.left.position.set(this.restL.x + bx, this.restL.y + by, this.restL.z);
    this.right.rotation.copy(this.restRotR);
    // balanço do braço ao andar e respiração parado
    this.right.rotation.z += bx * 1.6 + Math.sin(this._t * 1.4) * 0.012;
    this.right.rotation.x += by * 1.4;
    const holding = this.toolKind !== 'mao';
    // segurando ferramenta: mão esquerda mais para baixo
    if (holding) this.left.position.y -= 0.08;
    if (running && !holding) {
      // braços bombeando na corrida
      const r = Math.sin(this._bob) * 0.06;
      this.right.position.z += r;
      this.left.position.z -= r;
    }
    // correndo: braço mais baixo e inclinado para dentro; no ar: sobe e abre; troca de item: sobe de baixo
    this.right.position.y += -0.03 * this._run + this._air * 0.07 - Math.sin(this._equip * Math.PI * 0.5) * 0.35;
    this.right.position.z += -0.04 * this._run;
    this.right.rotation.x += this._run * 0.18 - this._air * 0.25 + this._equip * 0.9;
    this.right.rotation.z -= this._run * 0.1;
    this.left.position.y -= this._air * 0.0;
    if (swimming) {
      const s = Math.sin(this._bob * 1.5) * 0.1;
      this.right.position.x += s;
      this.left.position.x -= s;
      this.right.position.y -= 0.05;
      this.left.position.y -= 0.05;
    }

    if (this._drink > 0) {
      this._drink = Math.max(0, this._drink - dt * 1.3);
      const t = 1 - this._drink;
      // 0..0.4 desce até a água; 0.4..0.75 sobe em concha até a boca; 0.75..1 volta
      const down = t < 0.4 ? Math.sin((t / 0.4) * Math.PI * 0.5) : t < 0.75 ? 1 - (t - 0.4) / 0.35 : 0;
      const up = t < 0.4 ? 0 : t < 0.75 ? Math.sin(((t - 0.4) / 0.35) * Math.PI * 0.5) : 1 - (t - 0.75) / 0.25;
      this.right.position.y += -down * 0.2 + up * 0.14;
      this.right.position.z += -down * 0.1 + up * 0.08;
      this.right.position.x -= up * 0.1;
      this.right.rotation.x = this.restRotR.x - down * 0.8 + up * 0.9;
      this.right.rotation.z += up * 0.5;
      this.left.position.y += -down * 0.1 + up * 0.1;
      this.left.position.x += up * 0.1;
    }
    if (this._gather > 0) {
      this._gather = Math.max(0, this._gather - dt * 1.8);
      const t = 1 - this._gather;
      // desce e vai para frente (0..0.5), fecha a mão e puxa de volta (0.5..1)
      const reach = Math.sin(Math.min(1, t / 0.5) * Math.PI * 0.5) * (t < 0.5 ? 1 : 1 - (t - 0.5) / 0.5);
      this.right.position.z -= reach * 0.3; // pegar: o braço vai para frente e volta
      this.right.rotation.x = this.restRotR.x - reach * 0.05;
    }
    if (this._swing > 0) {
      this._swing = Math.max(0, this._swing - dt * (this._kind === 'mao' ? 3.1 : 2.2));
      const t = 1 - this._swing;
      if (this._kind === 'mao') {
        // soco: prepara (puxa para trás), acerta rápido e volta macio
        const k = swingCurve(t);
        const hand = this._side > 0 ? this.right : this.left;
        hand.position.z -= k * 0.26; // soco: o braço vai para frente e volta (sem subir nem descer)
        hand.position.x -= k * 0.03 * this._side;
        hand.rotation.x = this.restRotR.x - k * 0.1;
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
        const k = swingCurve(t);
        this.right.position.z -= k * 0.35;
        this.right.position.x -= k * 0.08;
      } else {
        // recua (0..0.35) e vai para frente com força (0.35..0.6), volta: só para trás e para frente, sem levantar
        const up = t < 0.35 ? t / 0.35 : t < 0.6 ? 1 - (t - 0.35) / 0.25 * 1.6 : -0.6 * (1 - (t - 0.6) / 0.4);
        this.right.position.z += up * 0.1 - Math.max(0, -up) * 0.22;
        this.right.rotation.x = this.restRotR.x + up * 0.05;
      }
    }
  }
}
