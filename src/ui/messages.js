// =============================================================
// AVISOS LATERAIS ("+12 Sede", "Água salgada não mata a sede!")
// Qualquer sistema pode avisar com:
//   events.emit(EV.MESSAGE, { text: '...', kind: 'gain' | 'warn' | 'info' })
// =============================================================
import { events, EV } from '../core/event_bus.js';
import { itemIcon, itemName } from '../items/items.js';

const MAX_ITEMS = 5;
const LIFETIME_MS = 2800;

export class Messages {
  constructor(root) {
    this.el = document.createElement('div');
    this.el.className = 'hud-msgs';
    this.el.setAttribute('aria-live', 'polite');
    root.appendChild(this.el);
    events.on(EV.MESSAGE, (m) => m && this.push(m.text, m.kind));
    events.on(EV.ITEM_GAINED, ({ id, amount }) => this.pushItem(id, amount));
  }

  // "+3 Madeira" com ícone; somando se pegar o mesmo item seguido.
  pushItem(id, amount) {
    let item = [...this.el.children].find((c) => c.dataset.item === id && !c.classList.contains('out'));
    if (item) {
      item.dataset.amount = String(Number(item.dataset.amount) + amount);
      this.el.appendChild(item); // vai para o fim (mais recente)
    } else {
      item = document.createElement('div');
      item.className = 'msg msg-gain msg-item';
      item.dataset.item = id;
      item.dataset.amount = String(amount);
      item.innerHTML = `<span class="msg-icon">${itemIcon(id)}</span><span class="msg-text"></span>`;
      this.el.appendChild(item);
      while (this.el.children.length > MAX_ITEMS) this.el.firstElementChild.remove();
    }
    item.querySelector('.msg-text').textContent = `+${item.dataset.amount} ${itemName(id)}`;
    this._schedule(item);
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
