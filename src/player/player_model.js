// =============================================================
// MODELO DO JOGADOR (placeholder com formas arredondadas)
// Tem animações simples feitas por código: andar, correr,
// nadar, agachar, golpe e cair morto.
// =============================================================
import * as THREE from 'three';
import { SKIN_PARTES, SKIN_TEXTURA } from './skin_data.js';
import { makeTool } from './player_hands.js';

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

function bytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

export function skinGeometry(part) {
  const q = new Uint16Array(bytes(part.pos));
  const [x0, y0, z0, x1, y1, z1] = part.box;
  const pos = new Float32Array(part.n * 3);
  for (let i = 0; i < part.n; i++) {
    pos[i * 3] = x0 + (q[i * 3] / 65535) * (x1 - x0);
    pos[i * 3 + 1] = y0 + (q[i * 3 + 1] / 65535) * (y1 - y0);
    pos[i * 3 + 2] = z0 + (q[i * 3 + 2] / 65535) * (z1 - z0);
  }
  let uv;
  if (part.uvf) uv = new Float32Array(bytes(part.uvf));
  else {
    const uq = new Uint16Array(bytes(part.uv));
    uv = new Float32Array(part.n * 2);
    for (let i = 0; i < part.n * 2; i++) uv[i] = uq[i] / 65535;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(new THREE.BufferAttribute(new Uint16Array(bytes(part.idx)), 1));
  if (part.nrm) {
    const nq = new Int8Array(bytes(part.nrm));
    const n = new Float32Array(part.n * 3);
    for (let i = 0; i < n.length; i++) n[i] = nq[i] / 127;
    g.setAttribute('normal', new THREE.BufferAttribute(n, 3));
  } else g.computeVertexNormals();
  if (part.col) {
    // cor por vértice (sombra nas dobras dos músculos, roupa, cabelo): 0..1,3
    const cq = new Uint8Array(bytes(part.col));
    const c = new Float32Array(part.n * 3);
    for (let i = 0; i < c.length; i++) c[i] = (cq[i] / 255) * 1.3;
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  }
  return g;
}

// Material da pele: textura do personagem (ou outra) e, se a peça tiver, cor por vértice.
export function skinMaterial(textura = SKIN_TEXTURA, vertexColors = false) {
  const tex = new THREE.TextureLoader().load(textura);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return new THREE.MeshLambertMaterial({ map: tex, vertexColors });
}

// Material com articulação: os vértices abaixo do cotovelo/joelho giram em torno dele (suave, sem emenda).
// uBend em radianos (positivo = dobra), jointY = altura da junta no pedaço, largura = zona de transição.
function bendMaterial(base, jointY, sign, uni) {
  const m = base.clone();
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uBend = uni;
    shader.vertexShader = shader.vertexShader
      .replace('void main() {', 'uniform float uBend;\nvoid main() {')
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
        float bw = smoothstep(${jointY.toFixed(3)} + 0.07, ${jointY.toFixed(3)} - 0.07, position.y);
        float ba = ${sign.toFixed(1)} * uBend * bw;
        float bc = cos(ba); float bs = sin(ba);
        objectNormal = vec3(objectNormal.x, bc * objectNormal.y - bs * objectNormal.z, bs * objectNormal.y + bc * objectNormal.z);`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        { vec3 q = transformed - vec3(0.0, ${jointY.toFixed(3)}, 0.0);
          transformed = vec3(q.x, bc * q.y - bs * q.z, bs * q.y + bc * q.z) + vec3(0.0, ${jointY.toFixed(3)}, 0.0); }`);
  };
  m.customProgramCacheKey = () => `junta${jointY.toFixed(3)}_${sign}`;
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
    this.toolKind = 'mao';
    this._applySkin();
  }

  // Skin (modelo enviado pelo jogador): troca as formas simples pelos
  // pedaços do modelo, cada um preso no seu ponto de giro.
  _applySkin() {
    this.body.traverse((o) => {
      if (o.isMesh) o.visible = false;
    });
    const mat = skinMaterial();
    // dobras: cotovelos e joelhos (um número por membro)
    this.bend = { armL: { value: 0 }, armR: { value: 0 }, legL: { value: 0 }, legR: { value: 0 } };
    const mats = {
      armL: bendMaterial(mat, -0.3, -1, this.bend.armL),
      armR: bendMaterial(mat, -0.3, -1, this.bend.armR),
      legL: bendMaterial(mat, -0.52, 1, this.bend.legL),
      legR: bendMaterial(mat, -0.52, 1, this.bend.legR),
    };
    const holders = { head: this.head, torso: this.body, armL: this.armL, armR: this.armR, legL: this.legL, legR: this.legR };
    for (const [name, part] of Object.entries(SKIN_PARTES)) {
      const holder = holders[name];
      if (name !== 'torso') holder.position.set(...part.pivot);
      const m = new THREE.Mesh(skinGeometry(part), mats[name] ?? mat);
      m.castShadow = true;
      holder.add(m);
    }
  }

  _limb(x, y, r, len, topMat, endMat) {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, 0);
    const upper = part(new THREE.CapsuleGeometry(r, len * 0.38, 4, 10), topMat, -len * 0.25);
    const lower = part(new THREE.CapsuleGeometry(r * 0.88, len * 0.36, 4, 10), endMat, -len * 0.7);
    pivot.add(upper, lower);
    return pivot;
  }

  // Ferramenta na mão direita (a mesma da primeira pessoa). kind: machado, picareta, lanca, clava, tocha, arco, pistola, luneta
  setTool(kind) {
    kind = kind ?? 'mao';
    if (kind === this.toolKind) return;
    this.toolKind = kind;
    if (this._toolMesh) {
      this.armR.remove(this._toolMesh);
      this._toolMesh = null;
    }
    if (kind === 'mao') return;
    const t = makeTool(kind);
    t.traverse((o) => {
      if (o.isMesh) o.castShadow = true;
    });
    // o cabo sai do punho, apontando para a frente e um pouco para cima (arco quase em pé)
    t.position.set(0, -0.6, -0.02);
    t.rotation.x = kind === 'arco' ? -0.2 : kind === 'pistola' || kind === 'luneta' ? -Math.PI / 2 : kind === 'lanca' ? -1.8 : -1.1;
    if (kind === 'arco') t.rotation.z = 0.35;
    t.scale.setScalar(1.25);
    this.armR.add(t);
    this._toolMesh = t;
  }

  // Golpe do botão Atacar: o movimento depende da ferramenta
  swing(kind = this.toolKind) {
    if (this._swing > 0 && this._swing > 0.5) return;
    this._swing = 1;
    this._swingKind = kind ?? 'mao';
  }

  // Coletar: abaixa e pega com a mão.
  gather() {
    this._gather = 1;
  }

  // state: { position, facing, speed, onGround, crouching, swimming, dead, visible, running }
  update(dt, s) {
    this.root.position.copy(s.position);
    this.root.rotation.y = s.facing;
    this.root.visible = s.visible;

    const b = this.body;
    // morte: o corpo tomba aos poucos
    this._deadT = s.dead ? (this._deadT ?? 0) + dt : 0;
    if (s.dead) {
      const k = Math.min(1, this._deadT / 0.9);
      const e = k * k;
      b.rotation.set(0, 0, (Math.PI / 2) * e);
      b.position.set(0.9 * e, 0.15 * e, 0);
      this._resetLimbs();
      this.armL.rotation.z = -0.6 * e;
      this.armR.rotation.z = 0.6 * e;
      return;
    }

    const k = (rate) => Math.min(1, dt * rate); // suavização: nada pula de uma pose para outra
    // Ritmo da caminhada proporcional à velocidade.
    const moving = s.speed > 0.3;
    this._phase += dt * (moving ? 2.2 + s.speed * 1.1 : 0);
    this._t = (this._t ?? 0) + dt;
    const ampT = moving ? Math.min(0.95, 0.25 + s.speed * 0.09) : 0;
    this._amp = (this._amp ?? 0) + (ampT - (this._amp ?? 0)) * k(10);
    const amp = this._amp;
    const sw = Math.sin(this._phase);
    const run = s.speed > 4.2 && s.onGround && !s.swimming ? 1 : 0;
    this._run = (this._run ?? 0) + (run - (this._run ?? 0)) * k(6);
    // pulo e aterrissagem
    this._air = (this._air ?? 0) + ((s.onGround ? 0 : 1) - (this._air ?? 0)) * k(10);
    if (s.onGround && this._wasAir) this._land = 1;
    this._wasAir = !s.onGround;
    this._land = Math.max(0, (this._land ?? 0) - dt * 4);
    const holding = !!this._toolMesh;
    const kind = this.toolKind ?? 'mao';
    const breathe = Math.sin(this._t * 1.7);

    let lx = 0, rx = 0, lz = -0.06, rz = 0.06, ry = 0, ly = 0;
    let elbL = 0.12, elbR = 0.12; // dobra dos cotovelos (radianos)
    let legL = 0, legR = 0, lean = 0, twist = 0, headX = 0, dip = 0;
    if (s.swimming) {
      // Corpo deitado, braçadas e pernadas.
      b.rotation.set(-1.15, 0, 0);
      b.position.set(0, 1.25, 0.35);
      this.armL.rotation.set(-2.6 + sw * 0.8, 0, -0.3);
      this.armR.rotation.set(-2.6 - sw * 0.8, 0, 0.3);
      this.legL.rotation.set(sw * 0.4, 0, 0);
      this.legR.rotation.set(-sw * 0.4, 0, 0);
      this.bend.legL.value = 0.35 + 0.25 * Math.max(0, sw);
      this.bend.legR.value = 0.35 + 0.25 * Math.max(0, -sw);
      this.bend.armL.value = this.bend.armR.value = 0.25;
    } else {
      legL = sw * amp;
      legR = -sw * amp;
      // braços contra as pernas; segurando ferramenta o braço direito fica à frente
      lx = -sw * amp * (0.8 + this._run * 0.3);
      rx = sw * amp * (0.8 + this._run * 0.3);
      // correndo: braços dobram para a frente (simulado: sobem um pouco) e o corpo inclina
      lean = this._run * 0.16 + (s.crouching ? 0.25 : 0);
      // balanço do corpo: sobe e desce a cada passo; respiração parado
      dip = Math.abs(sw) * 0.035 * (amp / 0.9) * (1 + this._run) - this._land * 0.08 + (moving ? 0 : breathe * 0.004);
      twist = sw * amp * 0.12; // ombros giram contra o quadril
      if (!moving) {
        lx = breathe * 0.025;
        rx = -breathe * 0.025;
        lz = -0.06 - breathe * 0.01;
        rz = 0.06 + breathe * 0.01;
      }
      // segurando ferramenta: braço direito dobrado na frente, mais parado
      if (holding) {
        const base = kind === 'arco' ? -1.35 : kind === 'pistola' || kind === 'luneta' ? -1.25 : -0.55;
        rx = base + rx * 0.25;
        elbR = kind === 'arco' ? 0.95 : kind === 'pistola' || kind === 'luneta' ? 0.35 : 0.6;
        if (kind === 'arco') { lx = -1.5 + lx * 0.2; elbL = 0.05; }
        if (kind === 'arco' || kind === 'pistola') twist = 0;
      }
      // no ar: pernas dobradas, braços abertos
      if (this._air > 0.01) {
        const a = this._air;
        legL = legL * (1 - a) - 0.4 * a;
        legR = legR * (1 - a) + 0.25 * a;
        lx = lx * (1 - a) - 0.7 * a;
        rx = (holding ? rx : rx * (1 - a)) - (holding ? 0.2 : 0.7) * a;
        lz -= 0.45 * a;
        rz += holding ? 0 : 0.45 * a;
      }
      // olha para onde a câmera olha (só um pouco)
      headX = Math.max(-0.5, Math.min(0.5, -(s.pitch ?? 0) * 0.6));
    }

    // golpe: curva por ferramenta
    if (this._swing > 0 && !s.swimming) {
      this._swing = Math.max(0, this._swing - dt * (this._swingKind === 'mao' ? 3.4 : this._swingKind === 'lanca' ? 2.4 : 2.7));
      const t = 1 - this._swing;
      const ease = (x) => x * x * (3 - 2 * x);
      const kk = this._swingKind;
      if (kk === 'machado' || kk === 'picareta' || kk === 'clava' || kk === 'tocha') {
        // levanta para trás (0..0.35), desce com força (0.35..0.55), volta (0.55..1)
        const up = t < 0.35 ? ease(t / 0.35) : t < 0.55 ? 1 - ease((t - 0.35) / 0.2) * 1.35 : -0.35 * (1 - ease((t - 0.55) / 0.45));
        rx = -1.25 - up * 1.55;
        elbR = 0.55 + Math.max(0, up) * 0.9 - Math.max(0, -up) * 0.4;
        rz = 0.06 + Math.max(0, up) * 0.2;
        lean += up < 0 ? -up * 0.4 : -up * 0.12;
        twist += up * 0.35;
        legL += 0.15 * Math.max(0, -up);
      } else if (kk === 'lanca') {
        // recua o braço (0..0.4) e estoca para a frente (0.4..0.6)
        const back = t < 0.4 ? ease(t / 0.4) : 0;
        const thrust = t < 0.4 ? 0 : t < 0.6 ? ease((t - 0.4) / 0.2) : 1 - ease((t - 0.6) / 0.4);
        rx = -1.2 + back * 0.5 - thrust * 0.4;
        elbR = 0.4 + back * 0.9 - thrust * 0.35;
        twist += back * 0.25 - thrust * 0.45;
        lean += thrust * 0.22;
        legL -= thrust * 0.3;
        legR += thrust * 0.3;
      } else if (kk === 'arco') {
        const r = Math.sin(t * Math.PI);
        rx += r * 0.2; // solta a corda: coice curto
      } else if (kk === 'pistola') {
        const r = Math.sin(Math.min(1, t * 2) * Math.PI) * (1 - t);
        rx += r * 0.45;
      } else {
        // soco: puxa o ombro para trás e solta o braço reto
        const k2 = t < 0.25 ? -0.35 * ease(t / 0.25) : t < 0.45 ? -0.35 + 1.35 * ease((t - 0.25) / 0.2) : 1 - ease((t - 0.45) / 0.55);
        rx = -1.55 * Math.max(0, k2) + 0.45 * Math.max(0, -k2);
        elbR = 0.15 + Math.max(0, -k2) * 1.3;
        twist += -0.35 * Math.max(0, k2) + 0.2 * Math.max(0, -k2);
        lean += 0.1 * Math.max(0, k2);
      }
    }

    if (!s.swimming) {
      const m = (a, v) => a.rotation.x += (v - a.rotation.x) * (this._swing > 0 ? 1 : k(18)); // golpe sem atraso, o resto macio
      this.legL.rotation.set(this.legL.rotation.x, 0, 0);
      this.legR.rotation.set(this.legR.rotation.x, 0, 0);
      m(this.legL, legL);
      m(this.legR, legR);
      this.armL.rotation.set(this.armL.rotation.x, 0, lz);
      this.armR.rotation.set(this.armR.rotation.x, ry, rz);
      m(this.armL, lx);
      m(this.armR, rx);
      // joelhos dobram quando a perna passa para a frente; cotovelos acompanham o balanço
      const cph = Math.cos(this._phase);
      const kn = (this._amp > 0.02 ? this._amp * (1.15 + this._run * 0.5) : 0) + 0.04;
      let kL = kn * Math.max(0, -cph) + 0.04;
      let kR = kn * Math.max(0, cph) + 0.04;
      if (s.crouching) { kL += 0.5; kR += 0.5; }
      if (this._air > 0.01) { kL += 0.6 * this._air; kR += 0.3 * this._air; }
      kL += this._land * 0.5; kR += this._land * 0.5;
      const swingL = Math.max(0, -lx) * 0.3 + this._run * 0.75 + (this._air > 0.01 ? 0.3 * this._air : 0);
      const swingR = holding || this._swing > 0 ? 0 : Math.max(0, -rx) * 0.3 + this._run * 0.75;
      const sm = (u, v) => (u.value += (v - u.value) * (this._swing > 0 ? 1 : k(16)));
      sm(this.bend.legL, kL);
      sm(this.bend.legR, kR);
      sm(this.bend.armL, elbL + swingL);
      sm(this.bend.armR, elbR + swingR);
      b.position.set(0, dip, 0);
      b.rotation.set(0, twist * 0.5, 0);
      b.rotation.x = -lean;
      b.rotation.order = 'YXZ';
      this.head.rotation.set(headX, -twist * 0.6, 0);
    }
    b.scale.y = !s.swimming && s.crouching ? 0.68 : 1;

    // Coletar: inclina o corpo e estica o braço para baixo.
    if (this._gather > 0) {
      this._gather = Math.max(0, this._gather - dt * 1.8);
      const g = Math.sin((1 - this._gather) * Math.PI);
      b.rotation.x -= 0.45 * g;
      this.armR.rotation.x = -1.1 * g;
    }
  }

  _resetLimbs() {
    for (const limb of [this.armL, this.armR, this.legL, this.legR]) limb.rotation.set(0, 0, 0);
  }
}
