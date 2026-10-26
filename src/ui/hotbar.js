// =============================================================
// BARRA RÁPIDA – os 8 primeiros espaços do inventário, embaixo
// da tela. Toque: comida = come; ferramenta = pega/guarda.
// No PC: teclas 1 a 8.
// =============================================================
import { events, EV } from '../core/event_bus.js';
import { ITEMS, itemIcon } from '../items/items.js';
import { HOTBAR } from '../inventory/inventory.js';

export class Hotbar {
  constructor(root, inventory, onPress) {
    this.inv = inventory;
    const el = document.createElement('div');
    el.className = 'hotbar';
    el.innerHTML = Array.from({ length: HOTBAR }, (_, i) => `
      <button type="button" class="hb-slot" data-i="${i}" aria-label="Espaço ${i + 1}">
        <span class="hb-key">${i + 1}</span><span class="hb-icon"></span><b class="hb-qty"></b><i class="hb-dur"></i>
      </button>`).join('');
    root.appendChild(el);
    this.el = el;
    this.slots = [...el.querySelectorAll('.hb-slot')];
    for (const b of this.slots) {
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        onPress(Number(b.dataset.i));
      });
    }
    events.on(EV.INVENTORY_CHANGED, () => this.refresh());
    this.refresh();
  }

  setVisible(v) {
    this.el.hidden = !v;
  }

  refresh() {
    for (let i = 0; i < HOTBAR; i++) {
      const s = this.inv.slots[i];
      const b = this.slots[i];
      b.classList.toggle('selected', this.inv.selected === i);
      b.classList.toggle('empty', !s);
      b.querySelector('.hb-icon').innerHTML = s ? itemIcon(s.id) : '';
      b.querySelector('.hb-qty').textContent = s && s.qty > 1 ? String(s.qty) : '';
      const dur = b.querySelector('.hb-dur');
      // barrinha: durabilidade (ferramenta), frescor (comida) ou água (cantil)
      const def = s && ITEMS[s.id];
      const f = def?.ferramenta;
      const sp = def?.comida?.estraga_min;
      const cn = def?.cantil;
      dur.hidden = !f && !sp && !cn;
      dur.classList.toggle('fresh', !!sp);
      dur.classList.toggle('water', !!cn);
      if (f) dur.style.transform = `scaleX(${Math.max(0, s.dur / f.durabilidade).toFixed(3)})`;
      else if (sp) dur.style.transform = `scaleX(${Math.max(0, (s.spoil ?? sp * 60) / (sp * 60)).toFixed(3)})`;
      else if (cn) dur.style.transform = `scaleX(${Math.max(0, (s.agua ?? 0) / cn.capacidade).toFixed(3)})`;
      b.title = s ? ITEMS[s.id].nome : '';
    }
  }
}
