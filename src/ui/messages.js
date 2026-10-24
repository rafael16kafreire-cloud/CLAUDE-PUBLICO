// =============================================================
// AVISOS LATERAIS ("+12 Sede", "Água salgada não mata a sede!")
// Qualquer sistema pode avisar com:
//   events.emit(EV.MESSAGE, { text: '...', kind: 'gain' | 'warn' | 'info' })
// =============================================================
import { events, EV } from '../core/event_bus.js';

const MAX_ITEMS = 5;
const LIFETIME_MS = 2800;

export class Messages {
  constructor(root) {
    this.el = document.createElement('div');
    this.el.className = 'hud-msgs';
    this.el.setAttribute('aria-live', 'polite');
    root.appendChild(this.el);
    events.on(EV.MESSAGE, (m) => m && this.push(m.text, m.kind));
  }

  push(text, kind = 'info') {
    // Mesmo aviso repetido em seguida: mostra "×2" em vez de empilhar.
    const last = this.el.lastElementChild;
    if (last && last.dataset.text === text && !last.classList.contains('out')) {
      const count = Number(last.dataset.count || 1) + 1;
      last.dataset.count = String(count);
      last.textContent = `${text}  ×${count}`;
      this._schedule(last);
      return;
    }
    const item = document.createElement('div');
    item.className = `msg msg-${kind}`;
    item.dataset.text = text;
    item.textContent = text;
    this.el.appendChild(item);
    while (this.el.children.length > MAX_ITEMS) this.el.firstElementChild.remove();
    this._schedule(item);
  }

  _schedule(item) {
    clearTimeout(item._t1);
    clearTimeout(item._t2);
    item._t1 = setTimeout(() => item.classList.add('out'), LIFETIME_MS);
    item._t2 = setTimeout(() => item.remove(), LIFETIME_MS + 400);
  }
}
