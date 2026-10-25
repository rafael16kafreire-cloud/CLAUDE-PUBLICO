// =============================================================
// CONTROLES DE TOQUE (celular)
// - Joystick à esquerda: toque em qualquer lugar da metade esquerda
//   e arraste. A base aparece onde o dedo encostou.
// - Arrastar no resto da tela: gira a câmera.
// - Botões grandes à direita. Tamanho e opacidade vêm das Opções.
// Vários dedos ao mesmo tempo funcionam (cada dedo tem um id).
// - Ajustar botões (menu de pausa): arraste cada botão para onde
//   quiser e aperte Travar; a posição fica salva (em fração da tela,
//   então funciona em pé e deitado).
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
      <div class="tc-edit-bar" hidden>
        <span>Arraste os botões para onde quiser</span>
        <button type="button" class="btn btn-small" data-act="reset">Padrão</button>
        <button type="button" class="btn btn-small btn-primary" data-act="lock" id="tc-lock">Travar</button>
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

    this.editing = false;
    this.layout = null;
    this.editBar = el.querySelector('.tc-edit-bar');
    this.editBar.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.editBar.querySelector('[data-act="reset"]').addEventListener('click', () => this.applyLayout(null));
    this.editBar.querySelector('[data-act="lock"]').addEventListener('click', () => this.stopEdit());

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

  // Posições salvas ({ id: [x, y] } em fração da tela) ou null = padrão do CSS.
  applyLayout(layout) {
    this.layout = layout ? { ...layout } : null;
    for (const [id, b] of Object.entries(this.btn)) {
      const p = this.layout?.[id];
      b.classList.toggle('placed', !!p);
      b.style.left = p ? `${(p[0] * 100).toFixed(2)}%` : '';
      b.style.top = p ? `${(p[1] * 100).toFixed(2)}%` : '';
    }
  }

  // Modo de ajustar: arrastar move o botão em vez de apertar.
  startEdit(onDone) {
    this.editing = true;
    this._onEditDone = onDone;
    this.el.classList.add('tc-editing');
    this.editBar.hidden = false;
    this.setVisible(true);
  }

  stopEdit() {
    if (!this.editing) return;
    this.editing = false;
    this.el.classList.remove('tc-editing');
    this.editBar.hidden = true;
    this._onEditDone?.(this.layout);
  }

  _dragTo(id, b, x, y) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const r = b.offsetWidth / 2;
    const fx = Math.min(w - r, Math.max(r, x)) / w;
    const fy = Math.min(h - r, Math.max(r, y)) / h;
    this.applyLayout({ ...(this.layout ?? {}), [id]: [+fx.toFixed(4), +fy.toFixed(4)] });
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
        if (this.editing) {
          // ajustando: o dedo arrasta o botão
          b._drag = e.pointerId;
          if (!this.layout?.[id]) {
            // primeira vez: fixa todos onde estão agora
            const lay = { ...(this.layout ?? {}) };
            for (const [k, o] of Object.entries(this.btn)) {
              if (lay[k]) continue;
              const rc = o.getBoundingClientRect();
              lay[k] = [(rc.left + rc.width / 2) / window.innerWidth, (rc.top + rc.height / 2) / window.innerHeight];
            }
            this.applyLayout(lay);
          }
          return;
        }
        if (id === 'run') {
          this.input.runToggle = !this.input.runToggle; // liga/desliga
        } else {
          this.input.press(id);
        }
      });
      b.addEventListener('pointermove', (e) => {
        if (this.editing && b._drag === e.pointerId) this._dragTo(id, b, e.clientX, e.clientY);
      });
      const up = (e) => {
        e.stopPropagation();
        b.classList.remove('down');
        if (b._drag !== undefined) {
          b._drag = undefined;
          return;
        }
        if (id !== 'run') this.input.release(id);
      };
      b.addEventListener('pointerup', up);
      b.addEventListener('pointercancel', up);
      b.addEventListener('contextmenu', (e) => e.preventDefault());
    }
  }
}
