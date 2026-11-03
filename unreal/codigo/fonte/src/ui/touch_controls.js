// =============================================================
// CONTROLES DE TOQUE (celular)
// - Joystick à esquerda: toque em qualquer lugar da metade esquerda
//   e arraste. A base aparece onde o dedo encostou.
// - Arrastar no resto da tela: gira a câmera.
// - Botões grandes à direita. Tamanho e opacidade vêm das Opções.
// Vários dedos ao mesmo tempo funcionam (cada dedo tem um id).
//
// ESQUEMA "GESTOS" (padrão, como no ARK Mobile):
//   Metade esquerda: tocar e arrastar = andar (joystick que nasce onde o dedo
//     encosta); tocar duas vezes e segurar = correr; arrastar rápido para cima = pular
//     (para baixo = recarregar).
//   Metade direita: arrastar = olhar em volta; tocar = usar/colher ou atacar; segurar sem
//     mexer = abrir o inventário (ou montar/desmontar se estiver mirando um bicho domado);
//     tocar duas vezes e segurar = repetir (colher/atacar sem parar).
//   Arrastar a partir da borda esquerda = roda de assovios; da borda direita = roda de ações.
// ESQUEMA "BOTÕES": os botões na tela (opção nas configurações).
// - Ajustar botões (menu de pausa): arraste cada botão para onde
//   quiser e aperte Travar; a posição fica salva (em fração da tela,
//   então funciona em pé e deitado).
// =============================================================
import { TOUCH_LOOK_FACTOR } from '../core/input.js';
import { BUTTON_ICONS } from './button_icons.js';

const BUTTONS = [
  { id: 'jump', label: 'Pular', cls: 'b-jump' },
  { id: 'attack', label: 'Atacar', cls: 'b-attack' },
  { id: 'interact', label: 'Interagir', cls: 'b-interact' },
  { id: 'crouch', label: 'Agachar', cls: 'b-crouch' },
  { id: 'run', label: 'Correr', cls: 'b-run' },
  { id: 'camera', label: 'Câmera (1ª / 3ª pessoa)', cls: 'b-camera', hidden: true }, // só aparece montado
];

const STICK_RADIUS = 58; // px (multiplicado pelo tamanho dos botões)

export class TouchControls {
  constructor(root, input) {
    this.input = input;
    this.scale = 1;

    const el = document.createElement('div');
    el.className = 'tc';
    el.innerHTML = `
      <div class="tc-gestos"></div>
      <div class="tc-look"></div>
      <div class="tc-stick-zone">
        <div class="tc-stick-base"><div class="tc-stick-knob"></div></div>
      </div>
      <div class="tc-buttons">
        ${BUTTONS.map((b) => `<button type="button" class="tc-btn ${b.cls}"${b.hidden ? ' hidden' : ''} data-id="${b.id}" aria-label="${b.label}" title="${b.label}">${BUTTON_ICONS[b.id]}</button>`).join('')}
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

    this.scheme = 'gestos';
    this.mountNear = null; // () => true se há um bicho domado montável por perto (o jogo preenche)
    this.flickJump = true; // pular com o gesto de arrastar para cima (opção nas Configurações)
    // tempos dos gestos em ms (padrão de dedo no celular; os testes automáticos alargam)
    this.timing = { flick: 280, double: 330, hold: 480, tap: 260, edge: 600, early: 45 };
    this.onEdge = null;   // (lado 'L' | 'R') chamado quando arrasta a partir da borda
    this._mounted = false;
    this._swimming = false;
    this._setupLook(el.querySelector('.tc-look'));
    this._setupStick(el.querySelector('.tc-stick-zone'));
    this._setupGestures(el.querySelector('.tc-gestos'));
    this._setupButtons();
    this.setScheme('gestos');
  }

  // 'gestos' (padrão) ou 'botoes'
  setScheme(scheme) {
    this.scheme = scheme === 'botoes' ? 'botoes' : 'gestos';
    this.el.classList.toggle('tc-esquema-gestos', this.scheme === 'gestos');
    document.body.classList.toggle('touch-botoes', this.scheme === 'botoes');
    this._resetStick();
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
    this.btn.camera.hidden = false; // botão para trocar 1ª / 3ª pessoa (sempre à mão, como no Valheim)
    this.btn.crouch.classList.toggle('on', player.crouching);
    // nadando: subir/descer (só troca o ícone quando muda)
    this._flyRide = !!player.riding?.flies; // montado num voador: segurar o dedo para cima sobe
    const sw = !!player.swimming || this._flyRide;
    this._swimming = !!player.swimming;
    this._mounted = !!player.riding;
    if (this._swimIcons !== sw) {
      this._swimIcons = sw;
      this.btn.crouch.innerHTML = sw ? BUTTON_ICONS.down : BUTTON_ICONS.crouch;
      this.btn.crouch.setAttribute('aria-label', sw ? 'Descer' : 'Agachar');
      this.btn.jump.setAttribute('aria-label', sw ? 'Subir' : 'Pular');
    }
  }

  // ----- Esquema de gestos (ARK Mobile) -----
  // Tocar na metade direita: usa/colhe se houver o que usar (aviso com a tecla "E"),
  // senão ataca. Segurar sem mexer: monta/desmonta (mirando bicho domado) ou abre o inventário.
  // Aperta e solta uma ação. Só solta depois de passar um quadro do jogo com ela apertada
  // (em quadros lentos, soltar cedo demais faria o jogo nem perceber o toque).
  _tap(action) {
    this.input.press(action);
    setTimeout(() => requestAnimationFrame(() => requestAnimationFrame(() => this.input.release(action))), 70);
  }

  _tapAction() {
    const pr = document.querySelector('.hud .prompt:not([hidden])');
    this._tap(pr && !pr.classList.contains('prompt-attack') ? 'interact' : 'attack');
  }

  // Um toque: só Interagir (colher, pegar, usar). Se o que está na mira é para bater, não faz nada.
  _tapInteract() {
    const pr = document.querySelector('.hud .prompt:not([hidden])');
    if (pr && !pr.classList.contains('prompt-attack')) this._tap('interact');
  }

  _holdAction() {
    const txt = document.querySelector('.hud .prompt:not([hidden])')?.textContent ?? '';
    navigator.vibrate?.(18);
    // segurar parado só monta/desmonta; não abre mais a mochila (abria sem querer)
    if (this._mounted || this.mountNear?.() || /Montar|montar/.test(txt)) this._tap('mount');
  }

  _setupGestures(layer) {
    const W = () => window.innerWidth;
    const P = new Map();      // dedo -> estado do gesto
    let lastTapL = 0;
    let lastTapR = 0;
    const EDGE = 40;          // px: o que conta como "borda da tela"
    const stickZone = this.el.querySelector('.tc-stick-zone');

    const start = (e) => {
      if (this.scheme !== 'gestos' || this.editing) return;
      e.preventDefault();
      try { layer.setPointerCapture(e.pointerId); } catch { /* ok */ }
      const now = e.timeStamp;
      const x = e.clientX;
      const y = e.clientY;
      const left = x < W() * 0.5;
      const st = {
        left, x0: x, y0: y, lx: x, ly: y, t0: now, moved: false, cancelled: false,
        edge: x < EDGE ? 'L' : x > W() - EDGE ? 'R' : null,
        jumped: false, downed: false, dbl: false, held: false, timer: null, holdAttack: false,
      };
      P.set(e.pointerId, st);
      if (left) {
        // joystick flutuante: a base nasce onde o dedo encostou
        if (this._stickId === null) {
          this._stickId = e.pointerId;
          const r = STICK_RADIUS * this.scale;
          this._cx = Math.max(r + 8, x);
          this._cy = Math.min(window.innerHeight - r - 8, y);
          const zr = stickZone.getBoundingClientRect();
          this.base.classList.add('active');
          this.base.style.left = `${this._cx - zr.left}px`;
          this.base.style.top = `${this._cy - zr.top}px`;
          this._moveKnob(x, y);
        }
        // tocar duas vezes e segurar = correr
        if (now - lastTapL < this.timing.double) {
          st.dbl = true;
          this.input.runToggle = true;
          this._autoFwd = true;       // dois toques e segurar: já corre para frente, sem arrastar
          this.input.stick.x = 0;
          this.input.stick.y = 1;
          navigator.vibrate?.(12);
        }
      } else if (now - lastTapR < this.timing.double) {
        // tocar duas vezes e segurar = repetir (colher/atacar sem parar)
        st.dbl = true;
        st.holdAttack = true;
        // dois toques e segurar: repete bater/colher (a ação certa para o que está na mira) até soltar o dedo
        this._tapAction();
        st.repeat = setInterval(() => this._tapAction(), 130);
      } else {
        // Um toque só NÃO ataca (evita bater sem querer): bater = tocar duas vezes (o 2º toque bate; segurando o 2º, repete).
        // Segurar parado: só monta / desce do bicho que você está mirando.
        st.timer = setTimeout(() => {
          if (!st.moved && !st.cancelled && P.has(e.pointerId)) {
            st.held = true;
            const txt = document.querySelector('.hud .prompt:not([hidden])')?.textContent ?? '';
            if (this._mounted || this.mountNear?.() || /Montar|montar/.test(txt)) this._holdAction();
          }
        }, this.timing.hold);
      }
    };

    const move = (e) => {
      const st = P.get(e.pointerId);
      if (!st || st.cancelled) return;
      const now = e.timeStamp;
      const x = e.clientX;
      const y = e.clientY;
      const dx = x - st.x0;
      const dy = y - st.y0;
      if (Math.hypot(dx, dy) > 10) {
        st.moved = true;
        clearTimeout(st.timer);
        clearTimeout(st.early);
      }
      // arrasto a partir da borda: abre a roda (esquerda: assovios; direita: ações)
      if (st.edge && now - st.t0 < this.timing.edge && ((st.edge === 'L' && dx > 48) || (st.edge === 'R' && dx < -48))) {
        st.cancelled = true;
        if (st.left) this._resetStick();
        navigator.vibrate?.(15);
        this.onEdge?.(st.edge);
        return;
      }
      if (st.left) {
        this._moveKnob(x, y);
        if (this.flickJump && !st.jumped && now - st.t0 < this.timing.flick * 0.65 && dy < -95 && Math.abs(dx) < -dy * 0.6) {
          st.jumped = true;
          st.lastJump = now;
          this._tap('jump');
        }
        // pular correndo: o dedo já está parado/esticado para frente, então vale um "peteleco"
        // para cima em qualquer momento (60 px em até 220 ms), com intervalo entre pulos
        const h = (st.hist ??= [{ t: st.t0, x: st.x0, y: st.y0 }]);
        h.push({ t: now, x, y });
        while (h.length > 1 && now - h[1].t > 220) h.shift(); // h[0] = onde o dedo estava ao começar a janela
        const dyw = y - h[0].y;
        // só vale se o dedo JÁ estava esticado para frente (correndo): sair do parado empurrando o analógico não pula
        const esticado = h[0].y < st.y0 - STICK_RADIUS * this.scale * 0.6;
        if (this.flickJump && esticado && dyw < -80 && Math.abs(x - h[0].x) < -dyw * 0.6 && now - (st.lastJump ?? -1e9) > 600) {
          st.lastJump = now;
          st.hist = [{ t: now, x, y }];
          this._tap('jump');
        }
        if (!st.downed && now - st.t0 < this.timing.flick && dy > 52 && Math.abs(dx) < dy * 0.75) {
          st.downed = true;
          this._tap('ammo');   // recarregar
        }
        // nadando: segurar o dedo para cima sobe
        if (this._swimming || this._flyRide) {
          if (dy < -40) this.input.press('jump');
          else this.input.release('jump');
        }
      } else {
        this.input.addLook((x - st.lx) * TOUCH_LOOK_FACTOR, (y - st.ly) * TOUCH_LOOK_FACTOR);
        st.lx = x;
        st.ly = y;
      }
    };

    const end = (e) => {
      const st = P.get(e.pointerId);
      if (!st) return;
      P.delete(e.pointerId);
      clearTimeout(st.timer);
      clearTimeout(st.early);
      const now = e.timeStamp;
      const quick = now - st.t0 < this.timing.tap && !st.moved && !st.cancelled;
      if (st.left) {
        if (this._stickId === e.pointerId) this._resetStick();
        if (st.dbl) this.input.runToggle = false;
        if (this._swimming || this._flyRide) this.input.release('jump');
        if (quick) lastTapL = now;
      } else {
        if (st.holdAttack) clearInterval(st.repeat);
        else if (quick && !st.held) {
          if (!st.fired) this._tapInteract(); // 1 toque: só usa/colhe (Interagir); bater precisa de 2 toques
          lastTapR = now;
        } else if (st.fired && !st.moved) lastTapR = now;
      }
    };
    layer.addEventListener('pointerdown', start);
    layer.addEventListener('pointermove', move);
    layer.addEventListener('pointerup', end);
    layer.addEventListener('pointercancel', end);
    layer.addEventListener('contextmenu', (e) => e.preventDefault());
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
    if (mag < 0.18 && this._autoFwd) {
      // correndo por toque duplo: sem arrastar, vai reto; arrastando, o dedo dirige
      this.input.stick.x = 0;
      this.input.stick.y = 1;
    } else if (mag < 0.05) {
      this.input.stick.x = 0;
      this.input.stick.y = 0;
    } else {
      // curva rápida: ~60% do arrasto já dá velocidade cheia (resposta imediata)
      const k = Math.min(1, mag * 1.7) / mag;
      this.input.stick.x = nx * k;
      this.input.stick.y = -ny * k; // para cima na tela = para frente
    }
  }

  _resetStick() {
    this._stickId = null;
    this._autoFwd = false;
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
