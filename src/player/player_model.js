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

const SPINE_Y = 1.0; // cintura: dali para cima o tronco gira e inclina

// Tronco articulado: acima da cintura os vértices giram junto com os braços e a cabeça (a "coluna"),
// com transição suave na cintura. uSpine = (giro, inclinar para a frente, inclinar de lado).
function spineMaterial(base, uni) {
  const m = base.clone();
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uSpine = uni;
    shader.vertexShader = shader.vertexShader
      .replace('void main() {', `uniform vec3 uSpine;
        vec3 spineRot(vec3 v, float w) {
          float a = uSpine.x * w, b = uSpine.y * w, c = uSpine.z * w;
          v = vec3(cos(c) * v.x - sin(c) * v.y, sin(c) * v.x + cos(c) * v.y, v.z);          // lado (Rz)
          v = vec3(v.x, cos(b) * v.y - sin(b) * v.z, sin(b) * v.y + cos(b) * v.z);          // frente (Rx)
          return vec3(cos(a) * v.x + sin(a) * v.z, v.y, -sin(a) * v.x + cos(a) * v.z);      // giro (Ry)
        }
        void main() {`)
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
        float sw8 = smoothstep(${(SPINE_Y - 0.1).toFixed(2)}, ${(SPINE_Y + 0.15).toFixed(2)}, position.y);
        objectNormal = spineRot(objectNormal, sw8);`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        transformed = spineRot(transformed - vec3(0.0, ${SPINE_Y.toFixed(2)}, 0.0), sw8) + vec3(0.0, ${SPINE_Y.toFixed(2)}, 0.0);`);
  };
  m.customProgramCacheKey = () => 'coluna1';
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
    this.spineUni = { value: new THREE.Vector3() };
    const mats = {
      torso: spineMaterial(mat, this.spineUni),
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
    // coluna: braços e cabeça giram juntos com o tronco a partir da cintura
    this.spine = new THREE.Group();
    this.spine.position.y = SPINE_Y;
    this.body.add(this.spine);
    for (const o of [this.head, this.armL, this.armR]) {
      this.spine.add(o);
      o.position.y -= SPINE_Y;
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
    if (this._swingKind === 'mao') this._pSide = -(this._pSide ?? -1); // soco: alterna direita e esquerda
  }

  // Coletar: abaixa e pega com a mão.
  gather() {
    this._gather = 1;
  }

  // state: { position, facing, speed, onGround, crouching, swimming, dead, visible, pitch }
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
      this.spine.rotation.set(0, 0, 0);
      this.spineUni.value.set(0, 0, 0);
      for (const u of Object.values(this.bend)) u.value = 0;
      this.armL.rotation.z = -0.6 * e;
      this.armR.rotation.z = 0.6 * e;
      return;
    }

    const k = (rate) => Math.min(1, dt * rate); // suavização: nada pula de uma pose para outra
    const ease = (x) => x * x * (3 - 2 * x);
    const clamp01 = (x) => Math.max(0, Math.min(1, x));
    // Ritmo da caminhada proporcional à velocidade.
    const moving = s.speed > 0.3;
    this._phase += dt * (moving ? 2.2 + s.speed * 1.1 : 0);
    this._t = (this._t ?? 0) + dt;
    const ampT = moving ? Math.min(0.95, 0.25 + s.speed * 0.09) : 0;
    this._amp = (this._amp ?? 0) + (ampT - (this._amp ?? 0)) * k(10);
    const amp = this._amp;
    const sw = Math.sin(this._phase);
    const cph = Math.cos(this._phase);
    const run = s.speed > 4.2 && s.onGround && !s.swimming ? 1 : 0;
    this._run = (this._run ?? 0) + (run - (this._run ?? 0)) * k(6);
    this._air = (this._air ?? 0) + ((s.onGround ? 0 : 1) - (this._air ?? 0)) * k(10);
    if (s.onGround && this._wasAir) this._land = 1;
    this._wasAir = !s.onGround;
    this._land = Math.max(0, (this._land ?? 0) - dt * 4);
    const holding = !!this._toolMesh;
    const kind = this.toolKind ?? 'mao';
    const breathe = Math.sin(this._t * 1.7);

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
      this.spine.rotation.set(0, 0, 0);
      this.spineUni.value.set(0, 0, 0);
      this.head.rotation.set(0.9, 0, 0);
      b.scale.y = 1;
      return;
    }

    // ---- alvos da pose (tudo em radianos) ----
    const P = {
      legL: sw * amp, legR: -sw * amp,
      axL: -sw * amp * (0.8 + this._run * 0.3), axR: sw * amp * (0.8 + this._run * 0.3),
      azL: -0.06, azR: 0.06, elbL: 0.12, elbR: 0.12,
      twist: sw * amp * (0.2 + this._run * 0.15), // ombros giram contra o quadril
      lean: this._run * 0.16 + (s.crouching ? 0.25 : 0), side: 0, pelvis: -sw * amp * 0.1,
      squat: s.crouching ? 0.35 : 0, dip: 0, kneeExtra: 0, headX: Math.max(-0.5, Math.min(0.5, -(s.pitch ?? 0) * 0.6)),
    };
    P.dip = Math.abs(sw) * 0.035 * (amp / 0.9) * (1 + this._run) - this._land * 0.08 + (moving ? 0 : breathe * 0.004);
    if (moving) {
      // braços dobrados no ritmo da corrida
      P.elbL = 0.15 + this._run * 0.95 + Math.max(0, -P.axL) * 0.25;
      P.elbR = 0.15 + this._run * 0.95 + Math.max(0, -P.axR) * 0.25;
    } else {
      P.axL = breathe * 0.025; P.axR = -breathe * 0.025;
      P.azL = -0.06 - breathe * 0.01; P.azR = 0.06 + breathe * 0.01;
      P.side = breathe * 0.01;
    }
    // joelhos: dobram quando a perna passa para a frente
    const kn = (amp > 0.02 ? amp * (1.15 + this._run * 0.5) : 0) + 0.04;
    P.kneeL = kn * Math.max(0, -cph) + 0.04;
    P.kneeR = kn * Math.max(0, cph) + 0.04;
    // segurando ferramenta: braço direito dobrado à frente, mais parado
    if (holding) {
      const base = kind === 'arco' ? -1.35 : kind === 'pistola' || kind === 'luneta' ? -1.25 : -0.55;
      P.axR = base + P.axR * 0.25;
      P.elbR = kind === 'arco' ? 0.95 : kind === 'pistola' || kind === 'luneta' ? 0.35 : 0.6;
      if (kind === 'arco') { P.axL = -1.5 + P.axL * 0.2; P.elbL = 0.05; P.twist = 0; P.lean = 0; }
      if (kind === 'pistola') P.twist = 0;
      if (kind === 'machado' || kind === 'picareta' || kind === 'lanca') { // segura com as duas mãos
        P.axL = P.axR + 0.15; P.azL = 0.22; P.azR = -0.12; P.elbL = P.elbR;
      }
    }
    // agachar: joelhos dobram e a bacia desce
    if (P.squat > 0) { P.kneeL += P.squat * 1.3; P.kneeR += P.squat * 1.3; P.legL -= P.squat * 0.7; P.legR -= P.squat * 0.7; P.dip -= P.squat * 0.2; }
    // no ar: pernas dobradas, braços abertos
    if (this._air > 0.01) {
      const a = this._air;
      P.legL = P.legL * (1 - a) - 0.45 * a;
      P.legR = P.legR * (1 - a) + 0.25 * a;
      P.kneeL += 0.9 * a; P.kneeR += 0.4 * a;
      P.axL = P.axL * (1 - a) - 0.7 * a;
      P.axR = (holding ? P.axR : P.axR * (1 - a)) - (holding ? 0.2 : 0.7) * a;
      P.azL -= 0.45 * a;
      P.azR += holding ? 0 : 0.45 * a;
      P.twist *= 1 - a;
    }
    // aterrissagem: amortece com os joelhos
    if (this._land > 0) {
      const l = ease(this._land);
      P.kneeL += 0.7 * l; P.kneeR += 0.7 * l; P.legL -= 0.35 * l; P.legR -= 0.35 * l; P.dip -= 0.12 * l; P.lean += 0.15 * l;
    }
    // coletar: abaixa, inclina e estica o braço
    if (this._gather > 0) {
      this._gather = Math.max(0, this._gather - dt * 1.8);
      const g = Math.sin((1 - this._gather) * Math.PI);
      P.squat = Math.max(P.squat, 0.6 * g);
      P.kneeL += 0.7 * g; P.kneeR += 0.7 * g; P.legL -= 0.35 * g; P.legR -= 0.35 * g; P.dip -= 0.14 * g;
      P.lean += 0.55 * g;
      P.axR = -1.3 * g + P.axR * (1 - g); P.elbR = 0.25;
    }

    // ---- golpes: corpo inteiro ----
    let hard = false; // golpe: sem suavização (acompanha a curva)
    if (this._swing > 0) {
      hard = true;
      this._swing = Math.max(0, this._swing - dt * (this._swingKind === 'mao' ? 3.4 : this._swingKind === 'lanca' ? 2.4 : 2.7));
      const t = 1 - this._swing;
      const kk = this._swingKind;
      if (kk === 'machado' || kk === 'picareta' || kk === 'clava' || kk === 'tocha') {
        // levanta para trás (0..0.35), desce com força (0.35..0.55), volta (0.55..1)
        const up = t < 0.35 ? ease(t / 0.35) : t < 0.55 ? 1 - ease((t - 0.35) / 0.2) * 1.35 : -0.35 * (1 - ease((t - 0.55) / 0.45));
        const hit = Math.max(0, -up); // 0..0.35 no impacto
        const heavy = kk === 'picareta' ? 1.15 : 1;
        P.axR = -1.25 - up * 1.65 * heavy;
        P.elbR = 0.5 + Math.max(0, up) * 1.0 - hit * 0.9;
        const two = kk === 'machado' || kk === 'picareta';
        if (two) { P.axL = P.axR + 0.1; P.elbL = P.elbR; P.azL = 0.22; P.azR = -0.12; }
        P.twist = -0.4 * Math.max(0, up) + 1.0 * hit; // ombro direito vai para trás e depois acompanha o golpe
        P.lean = -0.14 * Math.max(0, up) + 1.3 * hit;
        P.pelvis = 0.12 * Math.max(0, up) - 0.4 * hit;
        // pernas firmes no chão; joelhos dobram no impacto
        P.squat = 0.9 * hit;
        P.kneeL = 0.12 + 1.2 * hit; P.kneeR = 0.12 + 1.2 * hit;
        P.legL = -0.45 * hit; P.legR = 0.15 * Math.max(0, up) - 0.45 * hit;
        P.dip = -0.2 * hit * 1.0;
        P.headX = 0.25 * hit;
      } else if (kk === 'lanca') {
        const back = t < 0.4 ? ease(t / 0.4) : 1 - ease(clamp01((t - 0.4) / 0.2));
        const thrust = t < 0.4 ? 0 : t < 0.6 ? ease((t - 0.4) / 0.2) : 1 - ease((t - 0.6) / 0.4);
        P.axR = -1.2 + back * 0.5 - thrust * 0.45;
        P.axL = P.axR + 0.1; P.azL = 0.2; P.azR = -0.1;
        P.elbR = 0.4 + back * 1.0 - thrust * 0.4; P.elbL = P.elbR;
        P.twist = -0.55 * back + 0.75 * thrust;
        P.lean = -0.1 * back + 0.45 * thrust;
        P.pelvis = 0.2 * back - 0.3 * thrust;
        P.legL = 0.35 * back - 0.55 * thrust; P.legR = -0.3 * back + 0.35 * thrust; // passo à frente
        P.kneeL = 0.2 + 0.7 * thrust; P.kneeR = 0.2 + 0.2 * back;
        P.dip = -0.12 * thrust;
      } else if (kk === 'arco') {
        const r = Math.sin(t * Math.PI);
        P.axR += r * 0.25; P.elbR += r * 0.5;
        P.twist = 0.25 * r; // coice da corda
      } else if (kk === 'pistola') {
        const r = Math.sin(Math.min(1, t * 2) * Math.PI) * (1 - t);
        P.axR += r * 0.5; P.lean -= r * 0.1;
      } else {
        // soco: alterna os braços; o outro fica de guarda; o corpo gira e dá um passo
        const k2 = t < 0.25 ? -0.3 * ease(t / 0.25) : t < 0.45 ? -0.3 + 1.3 * ease((t - 0.25) / 0.2) : 1 - ease((t - 0.45) / 0.55);
        const ext = Math.max(0, k2);
        const wind = Math.max(0, -k2);
        const sd = this._pSide ?? 1; // 1 = direita, -1 = esquerda
        const pa = -1.6 * ext + 0.5 * wind;
        const pe = 0.12 + wind * 1.3 + (1 - ext) * 0.2;
        const guardAx = -1.1, guardElb = 1.5;
        if (sd > 0) { P.axR = pa; P.elbR = pe; P.axL = guardAx; P.elbL = guardElb; P.azL = 0.3; }
        else { P.axL = pa; P.elbL = pe; P.axR = guardAx; P.elbR = guardElb; P.azR = -0.3; }
        P.twist = sd * (-0.45 * wind + 0.7 * ext);
        P.lean = 0.28 * ext - 0.06 * wind;
        P.pelvis = -sd * 0.4 * ext;
        // passo: a perna oposta ao braço vai à frente
        if (sd > 0) { P.legL = -0.4 * ext; P.legR = 0.2 * ext; P.kneeL = 0.15 + 0.5 * ext; }
        else { P.legR = -0.4 * ext; P.legL = 0.2 * ext; P.kneeR = 0.15 + 0.5 * ext; }
        P.dip = -0.06 * ext;
      }
    }

    // ---- aplica (suave, menos no golpe) ----
    const rate = hard ? 60 : 14;
    const sm = (cur, v) => cur + (v - cur) * k(rate);
    const L = this._pose ?? (this._pose = { legL: 0, legR: 0, axL: 0, axR: 0, azL: -0.06, azR: 0.06, twist: 0, lean: 0, side: 0, pelvis: 0, dip: 0, headX: 0, kneeL: 0, kneeR: 0, elbL: 0, elbR: 0 });
    for (const key of Object.keys(L)) L[key] = sm(L[key], P[key]);
    this.legL.rotation.set(L.legL, 0, 0);
    this.legR.rotation.set(L.legR, 0, 0);
    this.armL.rotation.set(L.axL, 0, L.azL);
    this.armR.rotation.set(L.axR, 0, L.azR);
    this.bend.legL.value = L.kneeL;
    this.bend.legR.value = L.kneeR;
    this.bend.armL.value = L.elbL;
    this.bend.armR.value = L.elbR;
    b.position.set(0, L.dip, 0);
    b.rotation.set(0, L.pelvis, 0, 'YXZ');
    // coluna: gira, inclina e balança de lado (braços e cabeça seguem; o tronco entorta na cintura)
    this.spine.rotation.set(-L.lean, L.twist, L.side, 'YXZ');
    this.spineUni.value.set(L.twist, -L.lean, L.side);
    this.head.rotation.set(L.headX, -L.twist * 0.5, 0);
    b.scale.y = 1;
  }

  _resetLimbs() {
    for (const limb of [this.armL, this.armR, this.legL, this.legR]) limb.rotation.set(0, 0, 0);
  }
}
