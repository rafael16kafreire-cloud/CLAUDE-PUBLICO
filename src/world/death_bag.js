// =============================================================
// SACO DE MORTE
// Fica onde o jogador morreu, com um feixe de luz visível de longe.
// Some depois de X minutos (balanceamento: morte.saco_duracao_min).
// Fase 1: o saco ainda vai vazio (o inventário chega na Fase 2).
// =============================================================
import * as THREE from 'three';
import { BALANCE } from '../core/balance.js';
import { vegGeometry, vegMaterial } from './veg_models.js';
import { CAIXA_ALTURA } from './textures/veg_caixa.js';
import { sound } from '../audio/audio.js';

// Caixa de itens largados (modelo feito no Blender), compartilhada por todas.
let crateGeo = null;
let crateMat = null;
const HALF = CAIXA_ALTURA / 2;     // metade da altura: a posição da caixa é o centro
const _e = new THREE.Euler();
const _qy = new THREE.Quaternion();

const SACK_MAT = new THREE.MeshLambertMaterial({ color: '#7a5a3a', flatShading: true });
const TIE_MAT = new THREE.MeshLambertMaterial({ color: '#d9c48f', flatShading: true });
const BEAM_MAT = new THREE.MeshBasicMaterial({
  color: '#ffd27a',
  transparent: true,
  opacity: 0.35,
  depthWrite: false,
  fog: false,
  blending: THREE.AdditiveBlending,
});

export class DeathBag {
  // opts (só para a caixa de itens largados): { velocity: Vector3, physics: { heightAt, waterAt } }
  constructor(scene, position, items = [], label = 'saco de morte', opts = {}) {
    this.scene = scene;
    this.crate = label === 'bolsa' && !!opts.physics;
    this.phys = opts.physics ?? null;
    this.items = items;
    this.label = label;
    this.timeLeft = BALANCE.morte.saco_duracao_min * 60;
    this.removed = false;
    this.interactRange = 3.2;
    this.interactRadius = 1.2;

    this.root = new THREE.Group();
    this.root.position.copy(position);
    this.root.name = 'SacoDeMorte';

    if (this.crate) {
      // caixa de madeira: cai da mão, quica, rola e assenta em pé; flutua na água
      if (!crateGeo) {
        crateGeo = vegGeometry('caixa_bl', CAIXA_ALTURA, 0);
        crateMat = vegMaterial('caixa_bl');
      }
      this.body = new THREE.Group();
      const mesh = new THREE.Mesh(crateGeo, crateMat);
      mesh.position.y = -HALF;
      mesh.castShadow = true;
      this.body.add(mesh);
      this.beam = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 7, 8, 1, true), BEAM_MAT);
      this.beam.position.y = 3.5 - HALF;
      this.root.add(this.body, this.beam);
      scene.add(this.root);
      this.vel = (opts.velocity ?? new THREE.Vector3()).clone();
      this.ang = new THREE.Vector3((Math.random() - 0.5) * 7, (Math.random() - 0.5) * 5, (Math.random() - 0.5) * 7);
      this.quat = new THREE.Quaternion().setFromEuler(_e.set(Math.random() * 0.6, Math.random() * 6.28, Math.random() * 0.6));
      this.body.quaternion.copy(this.quat);
      this.root.position.y += HALF;
      this.phase = 'fall';      // fall -> settle -> still
      this._calm = 0;
      this.interactPoint = this.root.position.clone().add(new THREE.Vector3(0, 0.3, 0));
      this._t = 0;
      return;
    }
    const sack = new THREE.Mesh(new THREE.IcosahedronGeometry(0.45, 0).scale(1, 0.85, 1), SACK_MAT);
    sack.position.y = 0.38;
    sack.castShadow = true;
    const tie = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 0.22, 6), TIE_MAT);
    tie.position.y = 0.8;
    this.beam = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 40, 8, 1, true), BEAM_MAT);
    this.beam.position.y = 20;
    this.root.add(sack, tie, this.beam);
    scene.add(this.root);

    this.interactPoint = position.clone().add(new THREE.Vector3(0, 0.5, 0));
    this._t = 0;
  }

  // Física da caixa: gravidade, quique no chão (terreno), atrito, giro, flutuar.
  _physics(dt) {
    if (this.phase === 'still') return;
    const pos = this.root.position;
    const n = Math.max(1, Math.ceil(dt / 0.02));
    const h = dt / n;
    for (let i = 0; i < n; i++) {
      const body = this.phys.waterAt(pos.x, pos.z);
      this.vel.y -= 9.8 * h;
      pos.addScaledVector(this.vel, h);
      // gira: integra a velocidade angular
      const w = this.ang.length();
      if (w > 1e-4) {
        _qy.setFromAxisAngle(this.ang.clone().multiplyScalar(1 / w), w * h);
        this.quat.premultiply(_qy).normalize();
      }
      const ground = this.phys.heightAt(pos.x, pos.z) + HALF;
      if (body && pos.y - HALF < body.level + 0.02) {
        // água: empuxo para cima, arrasto forte, balança devagar
        const depth = body.level + 0.02 - (pos.y - HALF);
        this.vel.y += depth * 48 * h;
        const drag = Math.max(0, 1 - 3.2 * h);
        this.vel.multiplyScalar(drag);
        this.ang.multiplyScalar(Math.max(0, 1 - 2.2 * h));
        // a água endireita a caixa devagar (fica de pé, balançando)
        _e.setFromQuaternion(this.quat, 'YXZ');
        _qy.setFromAxisAngle(new THREE.Vector3(0, 1, 0), _e.y);
        this.quat.slerp(_qy, Math.min(1, 3 * h));
        this._calm = 0;
      } else if (pos.y < ground) {
        pos.y = ground;
        const hit = -this.vel.y;
        if (hit > 0.9) {
          // quique: perde energia, atrito no chão e no giro
          this.vel.y = hit * 0.34;
          this.vel.x *= 0.62;
          this.vel.z *= 0.62;
          this.ang.multiplyScalar(0.55);
          if (hit > 1.4) sound.play('colocar', pos.clone(), { volume: Math.min(1, hit / 7) });
        } else {
          this.vel.y = 0;
          const f = Math.max(0, 1 - 5 * h);
          this.vel.x *= f;
          this.vel.z *= f;
          this.ang.multiplyScalar(Math.max(0, 1 - 4 * h));
        }
      }
    }
    // quando para de se mexer, desvira devagar até ficar em pé (mantendo a direção)
    const calm = this.vel.length() < 0.25 && this.ang.length() < 0.6 && !this.phys.waterAt(pos.x, pos.z);
    this._calm = calm ? this._calm + dt : 0;
    if (this._calm > 0.35) {
      this.phase = 'settle';
      _e.setFromQuaternion(this.quat, 'YXZ');
      _qy.setFromAxisAngle(new THREE.Vector3(0, 1, 0), _e.y);
      this.quat.slerp(_qy, Math.min(1, dt * 9));
      this.vel.set(0, 0, 0);
      this.ang.set(0, 0, 0);
      if (this.quat.angleTo(_qy) < 0.01) {
        this.quat.copy(_qy);
        this.phase = 'still';
        pos.y = this.phys.heightAt(pos.x, pos.z) + HALF;
      }
    } else if (this.phase === 'settle') {
      this.phase = 'fall';
    }
    this.body.quaternion.copy(this.quat);
    this.interactPoint.copy(pos).y += 0.3;
  }

  promptText() {
    const m = Math.floor(this.timeLeft / 60);
    const s = Math.floor(this.timeLeft % 60).toString().padStart(2, '0');
    const n = this.items.reduce((a, it) => a + it.qty, 0);
    return `Recuperar ${this.label}${n ? ` · ${n} itens` : ''} (${m}:${s})`;
  }

  // Devolve os itens e remove o saco.
  interact() {
    if (this.removed) return [];
    const items = this.items;
    this.remove();
    return items;
  }

  update(dt) {
    this.timeLeft -= dt;
    this._t += dt;
    if (this.crate) this._physics(Math.min(dt, 0.05));
    this.beam.material.opacity = 0.25 + Math.sin(this._t * 3) * 0.1;
    if (this.timeLeft <= 0) this.remove();
  }

  remove() {
    if (this.removed) return;
    this.removed = true;
    this.scene.remove(this.root);
  }
}
