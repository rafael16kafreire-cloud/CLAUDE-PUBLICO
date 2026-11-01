// =============================================================
// OUTRO JOGADOR (co-op): boneco com o nome em cima, que segue as
// posições que chegam pela rede (suavizadas para não "pular").
// Também serve de alvo para os predadores no anfitrião.
// =============================================================
import * as THREE from 'three';
import { makePlayerModel } from '../player/make_model.js';
import { angleDelta } from '../core/math.js';

const TAG_COLORS = ['#ffd27a', '#8fd0ff', '#b9e27a', '#ff9fb0'];

function nameTag(text, color) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const g = c.getContext('2d');
  g.font = 'bold 30px "Barlow Semi Condensed", sans-serif';
  const w = Math.min(248, g.measureText(text).width + 24);
  g.fillStyle = 'rgba(10,14,12,0.6)';
  g.beginPath();
  g.roundRect((256 - w) / 2, 10, w, 44, 12);
  g.fill();
  g.fillStyle = color;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 128, 33);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true, fog: false }));
  sp.scale.set(1.6, 0.4, 1);
  sp.renderOrder = 20;
  return sp;
}

export class RemotePlayer {
  constructor(scene, peerId, name, colorIndex = 0) {
    this.scene = scene;
    this.peerId = peerId;
    this.name = name || 'Jogador';
    this.isRemote = true;
    this.position = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    this.facing = 0;
    this.dead = false;
    this.crouching = false;
    this.swimming = false;
    this.onGround = true;
    this.speed = 0;
    this._goal = null;
    this._goalYaw = 0;
    this.model = makePlayerModel();
    this.model.root.name = `Jogador-${this.name}`;
    scene.add(this.model.root);
    this.tag = nameTag(this.name, TAG_COLORS[colorIndex % TAG_COLORS.length]);
    scene.add(this.tag);
  }

  get alive() {
    return !this.dead;
  }

  // s = { x, y, z, f (direção), sp (velocidade), cr, sw, dead, sg (golpe) }
  applyState(s) {
    if (!this._goal) {
      this._goal = new THREE.Vector3(s.x, s.y, s.z);
      this.position.copy(this._goal);
    }
    this._goal.set(s.x, s.y, s.z);
    this._goalYaw = s.f;
    this.speed = s.sp ?? 0;
    this.crouching = !!s.cr;
    this.swimming = !!s.sw;
    this.dead = !!s.dead;
    if (s.sg) this.model.swing();
  }

  update(dt) {
    if (this._goal) {
      const k = Math.min(1, dt * 10);
      this.velocity.copy(this._goal).sub(this.position).multiplyScalar(1 / Math.max(dt, 1e-3) * k);
      this.position.lerp(this._goal, k);
      this.facing += angleDelta(this.facing, this._goalYaw) * Math.min(1, dt * 12);
    }
    this.model.update(dt, {
      position: this.position,
      facing: this.facing,
      speed: this.speed,
      onGround: !this.swimming,
      crouching: this.crouching,
      swimming: this.swimming,
      dead: this.dead,
      visible: true,
    });
    this.tag.position.copy(this.position).setY(this.position.y + (this.crouching ? 1.6 : 2.15));
  }

  remove() {
    this.scene.remove(this.model.root);
    this.scene.remove(this.tag);
  }
}
