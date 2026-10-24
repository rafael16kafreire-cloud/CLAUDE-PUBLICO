// =============================================================
// CONTROLES DE TOQUE (celular)
// - Joystick à esquerda: toque em qualquer lugar da metade esquerda
//   e arraste. A base aparece onde o dedo encostou.
// - Arrastar no resto da tela: gira a câmera.
// - Botões grandes à direita. Tamanho e opacidade vêm das Opções.
// Vários dedos ao mesmo tempo funcionam (cada dedo tem um id).
// =============================================================
import { TOUCH_LOOK_FACTOR } from '../core/input.js';

const BUTTONS = [
  { id: 'jump', label: 'Pular', cls: 'b-jump' },
  { id: 'attack', label: 'Atacar', cls: 'b-attack' },
  { id: 'interact', label: 'Interagir', cls: 'b-interact' },
  { id: 'crouch', label: 'Agachar', cls: 'b-crouch' },
  { id: 'run', label: 'Correr', cls: 'b-run' },
];

const STICK_RADIUS = 58; // px (multiplicado pelo tamanho dos botões)

export class TouchControls {
  constructor(root, input) {
    this.input = input;
    this.scale = 1;

    const el = document.createElement('div');
    el.className = 'tc';
    el.innerHTML = `
      <div class="tc-look"></div>
      <div class="tc-stick-zone">
        <div class="tc-stick-base"><div class="tc-stick-knob"></div></div>
      </div>
      <div class="tc-buttons">
        ${BUTTONS.map((b) => `<button type="button" class="tc-btn ${b.cls}" data-id="${b.id}">${b.label}</button>`).join('')}
      </div>
    `;
    root.appendChild(el);
    this.el = el;
    this.base = el.querySelector('.tc-stick-base');
    this.knob = el.querySelector('.tc-stick-knob');
    this.btn = {};
    el.querySelectorAll('.tc-btn').forEach((b) => {
      this.btn[b.dataset.id] = b;
    });

    this._setupLook(el.querySelector('.tc-look'));
    this._setupStick(el.querySelector('.tc-stick-zone'));
    this._setupButtons();
  }

  setVisible(v) {
    this.el.hidden = !v;
    if (!v) this._resetStick();
  }

  applySettings(opacity, size) {
    this.scale = size;
    this.el.style.setProperty('--tc-opacity', String(opacity));
    this.el.style.setProperty('--tc-scale', String(size));
  }

  // Destaca os botões que estão "ligados" (correr, agachar).
  updateStates(player) {
    this.btn.run.classList.toggle('on', this.input.runToggle);
    this.btn.crouch.classList.toggle('on', player.crouching);
    this.btn.crouch.textContent = player.swimming ? 'Descer' : 'Agachar';
    this.btn.jump.textContent = player.swimming ? 'Subir' : 'Pular';
  }

  // ----- Câmera: arrastar o dedo -----
  _setupLook(zone) {
    let id = null;
    let lx = 0;
    let ly = 0;
    zone.addEventListener('pointerdown', (e) => {
      if (id !== null) return;
      id = e.pointerId;
      lx = e.clientX;
      ly = e.clientY;
      try { zone.setPointerCapture(id); } catch { /* ok */ }
    });
    zone.addEventListener('pointermove', (e) => {
      if (e.pointerId !== id) return;
      this.input.addLook((e.clientX - lx) * TOUCH_LOOK_FACTOR, (e.clientY - ly) * TOUCH_LOOK_FACTOR);
      lx = e.clientX;
      ly = e.clientY;
    });
    const end = (e) => {
      if (e.pointerId === id) id = null;
    };
    zone.addEventListener('pointerup', end);
    zone.addEventListener('pointercancel', end);
  }

  // ----- Joystick flutuante -----
  _setupStick(zone) {
    this._stickId = null;
    this._cx = 0;
    this._cy = 0;
    zone.addEventListener('pointerdown', (e) => {
      if (this._stickId !== null) return;
      e.preventDefault();
      this._stickId = e.pointerId;
      try { zone.setPointerCapture(e.pointerId); } catch { /* ok */ }
      const r = STICK_RADIUS * this.scale;
      // A base aparece onde o dedo encostou (sem sair da tela).
      this._cx = Math.max(r + 8, e.clientX);
      this._cy = Math.min(window.innerHeight - r - 8, e.clientY);
      const zr = zone.getBoundingClientRect();
      this.base.classList.add('active');
      this.base.style.left = `${this._cx - zr.left}px`;
      this.base.style.top = `${this._cy - zr.top}px`;
      this._moveKnob(e.clientX, e.clientY);
    });
    zone.addEventListener('pointermove', (e) => {
      if (e.pointerId === this._stickId) this._moveKnob(e.clientX, e.clientY);
    });
    const end = (e) => {
      if (e.pointerId === this._stickId) this._resetStick();
    };
    zone.addEventListener('pointerup', end);
    zone.addEventListener('pointercancel', end);
  }

  _moveKnob(x, y) {
    const r = STICK_RADIUS * this.scale;
    let dx = x - this._cx;
    let dy = y - this._cy;
    const len = Math.hypot(dx, dy);
    if (len > r) {
      dx = (dx / len) * r;
      dy = (dy / len) * r;
    }
    this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
    // Zona morta pequena para o personagem não andar sozinho.
    const nx = dx / r;
    const ny = dy / r;
    const mag = Math.hypot(nx, ny);
    if (mag < 0.12) {
      this.input.stick.x = 0;
      this.input.stick.y = 0;
    } else {
      this.input.stick.x = nx;
      this.input.stick.y = -ny; // para cima na tela = para frente
    }
  }

  _resetStick() {
    this._stickId = null;
    this.input.stick.x = 0;
    this.input.stick.y = 0;
    this.knob.style.transform = 'translate(0px, 0px)';
    this.base.classList.remove('active');
    this.base.style.left = '';
    this.base.style.top = '';
  }

  // ----- Botões -----
  _setupButtons() {
    for (const [id, b] of Object.entries(this.btn)) {
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        try { b.setPointerCapture(e.pointerId); } catch { /* ok */ }
        b.classList.add('down');
        if (id === 'run') {
          this.input.runToggle = !this.input.runToggle; // liga/desliga
        } else {
          this.input.press(id);
        }
      });
      const up = (e) => {
        e.stopPropagation();
        b.classList.remove('down');
        if (id !== 'run') this.input.release(id);
      };
      b.addEventListener('pointerup', up);
      b.addEventListener('pointercancel', up);
      b.addEventListener('contextmenu', (e) => e.preventDefault());
    }
  }
}
