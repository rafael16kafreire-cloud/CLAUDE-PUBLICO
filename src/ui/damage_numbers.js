// =============================================================
// NÚMEROS DE DANO – quando você acerta um bicho, o dano sobe
// flutuando de onde acertou e some (como no ARK).
// Poucos <div> reaproveitados; posição projetada pela câmera.
// =============================================================
import * as THREE from 'three';
import { events, EV } from '../core/event_bus.js';

const MAX = 12;
const LIFE = 0.9;

export class DamageNumbers {
  constructor(root) {
    this.el = document.createElement('div');
    this.el.className = 'dmg-layer';
    root.appendChild(this.el);
    this.items = [];
    for (let i = 0; i < MAX; i++) {
      const d = document.createElement('div');
      d.className = 'dmg-num';
      d.hidden = true;
      this.el.appendChild(d);
      this.items.push({ d, t: 0, pos: new THREE.Vector3(), dx: 0 });
    }
    this._next = 0;
    this._v = new THREE.Vector3();
    events.on(EV.DAMAGE_NUMBER, ({ pos, amount, kind }) => this.add(pos, amount, kind));
  }

  add(pos, amount, kind = '') {
    const it = this.items[this._next];
    this._next = (this._next + 1) % MAX;
    it.t = LIFE;
    it.pos.copy(pos);
    it.dx = (Math.random() - 0.5) * 0.8;
    it.d.textContent = Math.max(1, Math.round(amount));
    it.d.dataset.kind = kind;
    it.d.hidden = false;
  }

  update(dt, camera) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    for (const it of this.items) {
      if (it.t <= 0) continue;
      it.t -= dt;
      if (it.t <= 0) {
        it.d.hidden = true;
        continue;
      }
      const k = 1 - it.t / LIFE;
      this._v.copy(it.pos);
      this._v.y += k * 1.2;
      this._v.x += it.dx * k;
      this._v.project(camera);
      if (this._v.z > 1) {
        it.d.hidden = true;
        continue;
      }
      it.d.style.transform = `translate(${((this._v.x + 1) / 2) * w}px, ${((1 - this._v.y) / 2) * h}px) translate(-50%, -50%) scale(${1 + (1 - k) * 0.3})`;
      it.d.style.opacity = String(Math.min(1, it.t / (LIFE * 0.4)));
    }
  }
}
