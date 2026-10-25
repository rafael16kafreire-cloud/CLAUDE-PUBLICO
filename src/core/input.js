// =============================================================
// INPUT – junta teclado/mouse (PC) e controles de toque (celular)
// num lugar só. O resto do jogo só pergunta coisas como:
// "para onde quer andar?", "apertou pular?", "está segurando correr?"
//
// Ações: jump, run, interact, crouch, camera, debug, pause,
//        attack, inventory, build, mount
// =============================================================

const KEYMAP = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  Space: 'jump',
  ShiftLeft: 'run', ShiftRight: 'run',
  KeyE: 'interact',
  KeyC: 'crouch',
  KeyV: 'camera',
  F3: 'debug',
  Escape: 'pause',
  Tab: 'inventory',
  KeyB: 'build',
  KeyF: 'mount',
  KeyI: 'inventory',
  KeyR: 'inspect',
  KeyM: 'map',
  Digit1: 'slot1', Digit2: 'slot2', Digit3: 'slot3', Digit4: 'slot4',
  Digit5: 'slot5', Digit6: 'slot6', Digit7: 'slot7', Digit8: 'slot8',
};

// Ações que continuam valendo com uma tela aberta (inventário).
const ALWAYS = new Set(['inventory', 'pause', 'debug']);

// Teclas que o navegador usaria para outra coisa (rolar página etc.)
const PREVENT = new Set(['Space', 'Tab', 'F3', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

// Quanto a câmera gira por pixel de movimento (antes da sensibilidade).
export const MOUSE_LOOK_FACTOR = 0.0022;
export const TOUCH_LOOK_FACTOR = 0.0048;

class Input {
  constructor() {
    this.held = new Set();     // ações seguradas agora
    this.pressed = new Set();  // ações apertadas neste quadro
    this.stick = { x: 0, y: 0 }; // joystick virtual (-1..1)
    this.look = { x: 0, y: 0 };  // giro de câmera acumulado
    this.runToggle = false;      // botão "Correr" do celular (liga/desliga)
    this.pointerLocked = false;
    this.lastUnlockTime = 0;
    this._canvas = null;
    this._mouseDragging = false;
    this.blocked = false; // true com o inventário aberto (personagem parado)
  }

  attach(canvas) {
    this._canvas = canvas;

    window.addEventListener('keydown', (e) => {
      const action = KEYMAP[e.code];
      if (!action) return;
      if (PREVENT.has(e.code)) e.preventDefault();
      if (this.blocked && !ALWAYS.has(action)) return;
      if (!e.repeat) this.pressed.add(action);
      this.held.add(action);
    });

    window.addEventListener('keyup', (e) => {
      const action = KEYMAP[e.code];
      if (action) this.held.delete(action);
    });

    // Se a janela perde o foco, solta todas as teclas (evita "andar sozinho").
    window.addEventListener('blur', () => this.clear());

    // ----- Mouse (PC) -----
    canvas.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      if (this.pointerLocked) {
        this.tap('attack');
      } else {
        this._mouseDragging = true;
      }
    });
    window.addEventListener('mouseup', () => {
      this._mouseDragging = false;
    });
    window.addEventListener('mousemove', (e) => {
      // Com o mouse "travado" no jogo: movimento gira a câmera.
      // Sem trava (navegador não deixou): arrastar com o botão gira.
      if (this.pointerLocked || this._mouseDragging) {
        // Alguns navegadores mandam um "salto" enorme ao prender o
        // mouse ou ao clicar: ignora (senão a câmera gira sozinha).
        if (Math.abs(e.movementX) > 250 || Math.abs(e.movementY) > 250) return;
        this.addLook(e.movementX * MOUSE_LOOK_FACTOR, e.movementY * MOUSE_LOOK_FACTOR);
      }
    });

    document.addEventListener('pointerlockchange', () => {
      const locked = document.pointerLockElement === canvas;
      if (this.pointerLocked && !locked) this.lastUnlockTime = performance.now();
      this.pointerLocked = locked;
    });
  }

  // Tenta "prender" o mouse no jogo (PC). Se o navegador recusar,
  // o jogo continua com o modo de arrastar.
  requestPointerLock() {
    const c = this._canvas;
    if (!c || !c.requestPointerLock || this.pointerLocked) return;
    try {
      const result = c.requestPointerLock();
      if (result && typeof result.catch === 'function') result.catch(() => {});
    } catch {
      /* recusado: segue sem trava */
    }
  }

  exitPointerLock() {
    try {
      if (document.pointerLockElement) document.exitPointerLock();
    } catch {
      /* nada */
    }
  }

  // Usado pelos botões de toque.
  press(action) {
    if (this.blocked && !ALWAYS.has(action)) return;
    this.pressed.add(action);
    this.held.add(action);
  }

  release(action) {
    this.held.delete(action);
  }

  tap(action) {
    this.pressed.add(action);
  }

  addLook(dx, dy) {
    if (this.blocked) return;
    this.look.x += dx;
    this.look.y += dy;
  }

  consumeLook() {
    const out = { x: this.look.x, y: this.look.y };
    this.look.x = 0;
    this.look.y = 0;
    return out;
  }

  isHeld(action) {
    return this.held.has(action);
  }

  wasPressed(action) {
    return this.pressed.has(action);
  }

  // Direção de movimento: x = lado (direita +), y = frente (+).
  moveVector() {
    if (this.blocked) return { x: 0, y: 0 };
    let x = 0;
    let y = 0;
    if (this.held.has('up')) y += 1;
    if (this.held.has('down')) y -= 1;
    if (this.held.has('right')) x += 1;
    if (this.held.has('left')) x -= 1;
    if (x !== 0 || y !== 0) {
      const len = Math.hypot(x, y);
      return { x: x / len, y: y / len };
    }
    return { x: this.stick.x, y: this.stick.y };
  }

  // Chamado no fim de cada quadro.
  endFrame() {
    this.pressed.clear();
  }

  clear() {
    this.held.clear();
    this.pressed.clear();
    this.stick.x = 0;
    this.stick.y = 0;
    this._mouseDragging = false;
  }
}

export const input = new Input();
