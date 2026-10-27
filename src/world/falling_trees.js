// =============================================================
// ÁRVORE CAINDO – física de uma árvore derrubada.
// A árvore vira uma haste presa na base: o peso a faz tombar para o lado
// contrário de quem cortou, cada vez mais rápido (como um pêndulo invertido).
// Ao tocar o chão (o terreno é testado ao longo do tronco, então em morro ela
// bate no ponto certo) ela quica, solta folhas, lascas e poeira, balança a mata
// em volta e fica deitada um tempo antes de afundar e sumir.
// Em qualidade alta tem mais folhas e poeira.
// =============================================================
import * as THREE from 'three';
import { shakeAt } from './materials.js';
import { sound } from '../audio/audio.js';

const G = 9.8;
const REST_SEC = 16;   // tempo deitada
const SINK_SEC = 3;    // tempo afundando

export class FallingTrees {
  constructor(scene, vegetation, effects, map) {
    this.scene = scene;
    this.veg = vegetation;
    this.effects = effects;
    this.map = map;
    this.list = [];
    this.detail = 1;        // 1 = normal, 2 = alta qualidade (mais detalhes)
    this._axis = new THREE.Vector3();
    this._q = new THREE.Quaternion();
    this._p = new THREE.Vector3();
  }

  setDetail(d) {
    this.detail = d;
  }

  // rec: o registro da árvore (x, y, z, scale, rot); from: onde está quem cortou
  spawn(rec, from) {
    const ts = this.veg.types[rec.type];
    const hi = ts?.meshes.hi;
    if (!hi) return null;
    const geo = hi.geometry;
    if (!geo.boundingBox) geo.computeBoundingBox();
    const H = Math.max(2.5, geo.boundingBox.max.y * rec.scale);
    const group = new THREE.Group();
    group.position.set(rec.x, rec.y, rec.z);
    const mesh = new THREE.Mesh(geo, hi.material);
    mesh.rotation.y = rec.rot;
    mesh.scale.setScalar(rec.scale);
    mesh.castShadow = true;
    mesh.frustumCulled = false;
    group.add(mesh);
    this.scene.add(group);

    // cai para o lado contrário de quem cortou (sem ninguém por perto: para qualquer lado)
    let dx = from ? rec.x - from.x : Math.random() - 0.5;
    let dz = from ? rec.z - from.z : Math.random() - 0.5;
    const l = Math.hypot(dx, dz) || 1;
    dx /= l;
    dz /= l;
    const t = {
      group, rec, H, dir: new THREE.Vector2(dx, dz),
      theta: 0.05, omega: 0.28 + Math.random() * 0.1,
      phase: 'fall', t: 0, bounces: 0, hit: false,
    };
    // eixo horizontal perpendicular à queda: Y x dir
    t.axis = new THREE.Vector3(dz, 0, -dx).normalize();
    this.list.push(t);
    sound.play('madeira', new THREE.Vector3(rec.x, rec.y + 1.5, rec.z), { volume: 0.9 });
    shakeAt(rec.x, rec.z, 2.2);
    return t;
  }

  // Algum ponto do tronco abaixo do chão? Devolve o ponto de impacto ou null.
  _groundHit(t) {
    const s = Math.sin(t.theta);
    const c = Math.cos(t.theta);
    for (const f of [0.3, 0.55, 0.8, 1.0]) {
      const d = t.H * f;
      const x = t.rec.x + t.dir.x * d * s;
      const z = t.rec.z + t.dir.y * d * s;
      const y = t.rec.y + d * c;
      if (y < this.map.heightAt(x, z) + 0.3 && f > 0.25) return this._p.set(x, y, z);
    }
    return null;
  }

  _impact(t, p, strong) {
    const fx = this.effects;
    const k = this.detail;
    const n = strong ? 1 : 0.4;
    if (fx) {
      fx.burst(p.clone(), 'folha', Math.round(22 * k * n), 4.2);
      fx.burst(p.clone().setY(p.y + 0.3), 'poeira', Math.round(10 * k * n), 2.8);
      fx.burst(p.clone(), 'madeira', Math.round(6 * k * n), 3.2);
    }
    sound.play(strong ? 'pedra' : 'madeira', p.clone(), { volume: strong ? 1 : 0.6 });
    if (strong) shakeAt(p.x, p.z, 3);
  }

  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const t = this.list[i];
      const g = t.group;
      if (t.phase === 'fall' || t.phase === 'bounce') {
        const steps = Math.max(1, Math.ceil(dt / 0.016));
        const h = dt / steps;
        for (let k = 0; k < steps; k++) {
          // pêndulo invertido: a haste acelera quanto mais inclinada
          t.omega += (1.5 * G / t.H) * Math.sin(t.theta) * h;
          t.theta += t.omega * h;
          const p = this._groundHit(t);
          if (p) {
            // volta até antes de entrar no chão e quica
            t.theta -= t.omega * h;
            t.bounces++;
            this._impact(t, p, t.bounces === 1);
            t.omega = -Math.abs(t.omega) * (t.bounces === 1 ? 0.26 : 0.18);
            t.phase = 'bounce';
            if (t.bounces >= 3 || Math.abs(t.omega) < 0.12) {
              t.phase = 'rest';
              t.t = 0;
              t.omega = 0;
            }
            break;
          }
          if (t.theta < 0.02) {
            // quicou e voltou demais: segue para baixo de novo
            t.theta = 0.02;
            t.omega = Math.abs(t.omega);
          }
        }
        this._q.setFromAxisAngle(t.axis, t.theta);
        g.quaternion.copy(this._q);
      } else if (t.phase === 'rest') {
        t.t += dt;
        if (t.t > REST_SEC) {
          t.phase = 'sink';
          t.t = 0;
        }
      } else if (t.phase === 'sink') {
        t.t += dt;
        const f = Math.min(1, t.t / SINK_SEC);
        g.position.y = t.rec.y - f * 1.6;
        if (f >= 1) {
          this.scene.remove(g);
          this.list.splice(i, 1);
        }
      }
    }
  }
}
