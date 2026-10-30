// =============================================================
// CÂMERA – terceira pessoa (atrás do ombro) ou primeira pessoa.
// Em terceira pessoa a câmera se aproxima sozinha quando o chão
// fica no caminho (não atravessa morros).
// =============================================================
import * as THREE from 'three';
import { clamp } from '../core/math.js';

const THIRD_DISTANCE = 2.3;
const CROUCH_DISTANCE = 1.9;
const SHOULDER = 0.22; // personagem um pouco à esquerda da mira, como no Valheim
const LIFT = 0.4; // câmera acima do ombro: o personagem fica na parte de baixo da tela e a mira, à frente dele

export class PlayerCamera {
  constructor(camera, world) {
    this.camera = camera;
    this.world = world;
    this.camera.rotation.order = 'YXZ';
    this.yaw = 0;
    this.pitch = -0.12;
    this.mode = 'terceira';
    this._dist = THIRD_DISTANCE;
    this.zoom = 1; // 3ª pessoa: multiplica a distância (roda do mouse / opção Distância da câmera)
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

  // Tremida da tela (0 a 1): golpe no ar ~0.3, acertou ~0.7.
  shake(amount) {
    this._shake = Math.max(this._shake ?? 0, amount);
  }

  // Acordar no chão: a câmera começa baixa, olhando para cima e meio torta, e levanta.
  acordar(seconds) {
    this._wakeT = seconds;
    this._wakeLen = seconds;
  }

  // 2º passo: posiciona a câmera onde o jogador está agora.
  update(dt, player) {
    this._update(dt, player);
    if (this._wakeT > 0) {
      this._wakeT = Math.max(0, this._wakeT - dt);
      const k = 1 - this._wakeT / this._wakeLen;
      const e = k * k * (3 - 2 * k);
      const rest = 1 - e;
      const floor = this.world.heightAt(this.camera.position.x, this.camera.position.z) + 0.2;
      this.camera.position.y = Math.max(floor, this.camera.position.y - rest * 1.0);
      this.camera.rotation.x += rest * 0.55;
      this.camera.rotation.z += rest * 0.3;
    }
  }

  _update(dt, player) {
    const firstPerson = player.firstPerson;
    const cp = Math.cos(this.pitch);
    this._forward.set(-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp);
    this._right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    this.camera.rotation.set(this.pitch, this.yaw, 0);
    // tremida (golpe): pequena e rápida
    if (this._shake > 0.001) {
      const k = this._shake;
      this.camera.rotation.x += (Math.random() - 0.5) * 0.03 * k;
      this.camera.rotation.y += (Math.random() - 0.5) * 0.03 * k;
      this.camera.rotation.z += (Math.random() - 0.5) * 0.02 * k;
      this._shake *= Math.exp(-dt * 14);
    }

    const t = this._target.copy(player.position);
    t.y += player.eyeHeight - 0.05;
    // morreu: a visão cai até o chão e tomba de lado
    this._deathT = player.dead ? (this._deathT ?? 0) + dt : 0;
    if (player.dead) {
      const k = Math.min(1, this._deathT / 1.1);
      const e = k * k * (3 - 2 * k);
      if (this.mode === 'primeira') {
        this.camera.position.set(player.position.x, player.position.y + (player.eyeHeight - 0.05) * (1 - e) + 0.3 * e, player.position.z);
        this.camera.rotation.set(this.pitch * (1 - e) - 0.15 * e, this.yaw, 1.25 * e);
        return;
      }
      t.y = player.position.y + 0.6;
    }

    if (firstPerson) {
      this.camera.position.copy(t);
      return;
    }

    // Terceira pessoa: um pouco acima e ao lado do ombro.
    t.addScaledVector(this._right, SHOULDER);
    // montado num bicho grande: câmera mais longe para ver o bicho todo
    const wanted = (player.riding ? THIRD_DISTANCE + player.riding.radius * 3.5 : player.crouching ? CROUCH_DISTANCE : THIRD_DISTANCE) * this.zoom;

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
    this.camera.position.y += LIFT * Math.min(1, this._dist / 2);
    const floor = this.world.heightAt(this.camera.position.x, this.camera.position.z) + 0.25;
    if (this.camera.position.y < floor) this.camera.position.y = floor;
  }
}
