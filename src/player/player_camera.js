// =============================================================
// CÂMERA – terceira pessoa (atrás do ombro) ou primeira pessoa.
// Em terceira pessoa a câmera se aproxima sozinha quando o chão
// fica no caminho (não atravessa morros).
// =============================================================
import * as THREE from 'three';
import { clamp } from '../core/math.js';

const THIRD_DISTANCE = 4.6;
const CROUCH_DISTANCE = 3.6;
const SHOULDER = 0.45;

export class PlayerCamera {
  constructor(camera, world) {
    this.camera = camera;
    this.world = world;
    this.camera.rotation.order = 'YXZ';
    this.yaw = 0;
    this.pitch = -0.12;
    this.mode = 'terceira';
    this._dist = THIRD_DISTANCE;
    this._target = new THREE.Vector3();
    this._forward = new THREE.Vector3();
    this._right = new THREE.Vector3();
    this._p = new THREE.Vector3();
  }

  setMode(mode) {
    this.mode = mode === 'primeira' ? 'primeira' : 'terceira';
  }

  toggle() {
    this.setMode(this.mode === 'primeira' ? 'terceira' : 'primeira');
    return this.mode;
  }

  // Direção para onde a câmera olha (usada para mirar/interagir).
  get forward() {
    return this._forward;
  }

  // 1º passo do quadro: gira a câmera com o mouse/dedo
  // (antes do jogador andar, para o movimento usar a direção nova).
  applyLook(look, sensitivity, player) {
    this.yaw -= look.x * sensitivity;
    this.pitch -= look.y * sensitivity;
    const firstPerson = this.mode === 'primeira' && !player.dead;
    this.pitch = clamp(this.pitch, firstPerson ? -1.5 : -1.25, firstPerson ? 1.45 : 1.1);
    player.firstPerson = firstPerson;
  }

  // 2º passo: posiciona a câmera onde o jogador está agora.
  update(dt, player) {
    const firstPerson = player.firstPerson;
    const cp = Math.cos(this.pitch);
    this._forward.set(-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp);
    this._right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    this.camera.rotation.set(this.pitch, this.yaw, 0);

    const t = this._target.copy(player.position);
    t.y += player.eyeHeight - 0.05;
    if (player.dead) t.y = player.position.y + 0.6;

    if (firstPerson) {
      this.camera.position.copy(t);
      return;
    }

    // Terceira pessoa: um pouco acima e ao lado do ombro.
    t.addScaledVector(this._right, SHOULDER);
    const wanted = player.crouching ? CROUCH_DISTANCE : THIRD_DISTANCE;

    // Procura o chão entre o jogador e a câmera.
    let allowed = wanted;
    for (let d = 0.6; d <= wanted; d += 0.3) {
      const p = this._p.copy(t).addScaledVector(this._forward, -d);
      if (p.y < this.world.heightAt(p.x, p.z) + 0.35) {
        allowed = Math.max(0.5, d - 0.4);
        break;
      }
    }
    // Aproxima na hora; afasta devagar (evita "pulos" da câmera).
    this._dist = allowed < this._dist ? allowed : this._dist + (allowed - this._dist) * Math.min(1, dt * 4);

    this.camera.position.copy(t).addScaledVector(this._forward, -this._dist);
    const floor = this.world.heightAt(this.camera.position.x, this.camera.position.z) + 0.25;
    if (this.camera.position.y < floor) this.camera.position.y = floor;
  }
}
