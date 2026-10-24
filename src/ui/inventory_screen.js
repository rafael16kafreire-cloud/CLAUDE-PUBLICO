// =============================================================
// TELA DE INVENTÁRIO E CRAFTING (botão Inventário / Tab)
// Esquerda: barra rápida + mochila (arraste para mover; toque para
// ver o item). Direita: "Criar" – toque no que quer criar e veja o
// que precisa (verde = tem, vermelho = falta).
// =============================================================
import { events, EV } from '../core/event_bus.js';
import { BALANCE } from '../core/balance.js';
import { ITEMS, itemIcon, itemName } from '../items/items.js';
import { HOTBAR } from '../inventory/inventory.js';
import { RECIPES } from '../crafting/crafting.js';

const TYPE_LABEL = { recurso: 'Recurso', comida: 'Comida', ferramenta: 'Ferramenta', consumivel: 'Cura' };

export class InventoryScreen {
  constructor(root, { inventory, crafting, actions, onDrop, onClose }) {
    this.inv = inventory;
    this.crafting = crafting;
    this.actions = actions;
    this.onDrop = onDrop;
    this.onClose = onClose;
    this.selSlot = -1;
    this.selRecipe = RECIPES[0];

    const el = document.createElement('div');
    el.className = 'overlay inv';
    el.hidden = true;
    el.innerHTML = `
      <div class="inv-panel" role="dialog" aria-label="Inventário">
        <section class="inv-left">
          <header class="inv-head">
            <h2>Inventário</h2>
            <span class="inv-weight" data-ref="weight"></span>
            <button type="button" class="btn btn-small" id="inv-sort">Organizar</button>
          </header>
          <p class="inv-label">Barra rápida</p>
          <div class="inv-grid inv-hot" data-ref="hot"></div>
          <p class="inv-label">Mochila</p>
          <div class="inv-grid" data-ref="bag"></div>
        </section>
        <section class="inv-right">
          <div class="inv-tabs">
            <button type="button" class="tab" data-tab="craft">Criar</button>
            <button type="button" class="tab" data-tab="item">Item</button>
            <button type="button" class="btn btn-small inv-close" id="inv-close" aria-label="Fechar">Fechar</button>
          </div>
          <div class="tab-body" data-tab-body="craft">
            <div class="recipe-grid" data-ref="recipes"></div>
            <div class="recipe-detail" data-ref="rdetail"></div>
            <div class="craft-queue" data-ref="queue"></div>
          </div>
          <div class="tab-body" data-tab-body="item" hidden>
            <div class="item-detail" data-ref="idetail"></div>
          </div>
        </section>
      </div>
      <div class="drag-ghost" data-ref="ghost" hidden></div>
    `;
    root.appendChild(el);
    this.el = el;
    this.refs = {};
    el.querySelectorAll('[data-ref]').forEach((n) => { this.refs[n.dataset.ref] = n; });

    // espaços
    this.slotEls = [];
    for (let i = 0; i < inventory.size; i++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'inv-slot';
      b.dataset.i = String(i);
      b.innerHTML = '<span class="is-icon"></span><b class="is-qty"></b><i class="is-dur"></i>';
      (i < HOTBAR ? this.refs.hot : this.refs.bag).appendChild(b);
      this.slotEls.push(b);
      this._setupDrag(b, i);
    }

    // receitas
    for (const r of RECIPES) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'recipe';
      b.dataset.id = r.id;
      b.id = `receita-${r.id}`;
      b.innerHTML = `${itemIcon(r.resultado)}<span>${itemName(r.resultado)}</span>`;
      b.addEventListener('click', () => {
        this.selRecipe = r;
        this.refresh();
      });
      this.refs.recipes.appendChild(b);
    }

    el.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => this.showTab(t.dataset.tab)));
    el.querySelector('#inv-close').addEventListener('click', () => this.onClose());
    el.querySelector('#inv-sort').addEventListener('click', () => this.inv.sort());
    el.addEventListener('pointerdown', (e) => e.stopPropagation());

    events.on(EV.INVENTORY_CHANGED, () => this.visible && this.refresh());
    events.on(EV.CRAFT_QUEUE, () => this.visible && this.refresh());
    this.showTab('craft');
  }

  get visible() {
    return !this.el.hidden;
  }

  show() {
    this.el.hidden = false;
    this.refresh();
  }

  hide() {
    this.el.hidden = true;
  }

  showTab(tab) {
    this.tab = tab;
    this.el.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === tab));
    this.el.querySelectorAll('[data-tab-body]').forEach((b) => { b.hidden = b.dataset.tabBody !== tab; });
  }

  // ---------------------------------------------------------
  refresh() {
    const inv = this.inv;
    const w = inv.weight();
    const max = BALANCE.jogador.peso_max;
    this.refs.weight.textContent = `${w.toFixed(1)} / ${max} kg`;
    this.refs.weight.classList.toggle('over', w > max);

    inv.slots.forEach((s, i) => {
      const b = this.slotEls[i];
      b.classList.toggle('empty', !s);
      b.classList.toggle('selected', i === this.selSlot);
      b.classList.toggle('equipped', i === inv.selected);
      b.querySelector('.is-icon').innerHTML = s ? itemIcon(s.id) : '';
      b.querySelector('.is-qty').textContent = s && s.qty > 1 ? String(s.qty) : '';
      const dur = b.querySelector('.is-dur');
      const f = s && ITEMS[s.id]?.ferramenta;
      dur.hidden = !f;
      if (f) dur.style.transform = `scaleX(${Math.max(0, s.dur / f.durabilidade).toFixed(3)})`;
      b.title = s ? `${ITEMS[s.id].nome} ×${s.qty}` : '';
    });

    // receitas: destaca as que dá para criar
    for (const b of this.refs.recipes.children) {
      const r = RECIPES.find((x) => x.id === b.dataset.id);
      b.classList.toggle('can', this.crafting.maxTimes(r) > 0);
      b.classList.toggle('selected', r === this.selRecipe);
    }
    this._renderRecipe();
    this._renderQueue();
    this._renderItem();
  }

  _renderRecipe() {
    const r = this.selRecipe;
    const d = this.refs.rdetail;
    if (!r) {
      d.innerHTML = '';
      return;
    }
    const def = ITEMS[r.resultado];
    const reqs = this.crafting.requirements(r);
    const can = this.crafting.maxTimes(r);
    d.innerHTML = `
      <div class="rd-head">${itemIcon(r.resultado)}<div><h3>${def.nome}</h3><p>${def.descricao}</p></div></div>
      <p class="inv-label">Precisa de</p>
      <ul class="reqs">${reqs.map((q) => `
        <li class="${q.have >= q.need ? 'ok' : 'miss'}">${itemIcon(q.id)}<span>${itemName(q.id)}</span><b>${q.have} / ${q.need}</b></li>`).join('')}
      </ul>
      <div class="rd-actions">
        <button type="button" class="btn btn-primary" id="craft-1" ${can < 1 ? 'disabled' : ''}>Criar</button>
        <button type="button" class="btn" id="craft-5" ${can < 2 ? 'disabled' : ''}>Criar ${Math.min(5, Math.max(2, can))}</button>
        <span class="rd-time">${r.tempo}s cada</span>
      </div>`;
    d.querySelector('#craft-1').addEventListener('click', () => this.crafting.craft(r, 1));
    d.querySelector('#craft-5').addEventListener('click', () => this.crafting.craft(r, Math.min(5, can)));
  }

  _renderQueue() {
    const q = this.crafting.queue;
    const el = this.refs.queue;
    if (!q.length) {
      el.innerHTML = '';
      return;
    }
    el.innerHTML = `<p class="inv-label">Criando (${q.length})</p>
      <div class="cq-row">${itemIcon(q[0].recipe.resultado)}<div class="cq-bar"><i style="transform:scaleX(${this.crafting.progress.toFixed(3)})"></i></div></div>`;
  }

  // atualiza só a barrinha da fila (chamado todo quadro com a tela aberta)
  tick() {
    const bar = this.refs.queue.querySelector('.cq-bar i');
    if (bar) bar.style.transform = `scaleX(${this.crafting.progress.toFixed(3)})`;
  }

  _renderItem() {
    const d = this.refs.idetail;
    const i = this.selSlot;
    const s = i >= 0 ? this.inv.slots[i] : null;
    if (!s) {
      d.innerHTML = '<p class="muted">Toque num item do inventário para ver o que dá para fazer com ele. Arraste para mover.</p>';
      return;
    }
    const def = ITEMS[s.id];
    const c = def.comida;
    const f = def.ferramenta;
    const facts = [];
    facts.push(`${TYPE_LABEL[def.tipo] ?? def.tipo} · ${(def.peso * s.qty).toFixed(1)} kg`);
    if (c) facts.push(Object.entries({ fome: 'Fome', sede: 'Sede', vida: 'Vida', stamina: 'Stamina' })
      .filter(([k]) => c[k]).map(([k, n]) => `${n} ${c[k] > 0 ? '+' : ''}${c[k]}`).join(' · '));
    if (f) facts.push(`Dano ${f.dano} · Durabilidade ${Math.max(0, Math.round(s.dur))}/${f.durabilidade}`);
    d.innerHTML = `
      <div class="rd-head">${itemIcon(s.id)}<div><h3>${def.nome} ${s.qty > 1 ? `×${s.qty}` : ''}</h3><p>${def.descricao}</p></div></div>
      <p class="facts">${facts.join('<br>')}</p>
      <div class="rd-actions">
        ${c ? '<button type="button" class="btn btn-primary" id="it-use">' + (def.tipo === 'consumivel' ? 'Usar' : 'Comer') + '</button>' : ''}
        ${f ? `<button type="button" class="btn btn-primary" id="it-equip">${this.inv.selected === i ? 'Guardar' : 'Usar na mão'}</button>` : ''}
        ${i >= HOTBAR ? '<button type="button" class="btn" id="it-hot">Pôr na barra</button>' : ''}
        ${s.qty > 1 ? '<button type="button" class="btn" id="it-split">Dividir</button>' : ''}
        <button type="button" class="btn" id="it-drop">Largar</button>
      </div>`;
    d.querySelector('#it-use')?.addEventListener('click', () => this.actions.useSlot(i));
    d.querySelector('#it-equip')?.addEventListener('click', () => {
      let slot = i;
      if (slot >= HOTBAR) {
        const free = this.inv.slots.findIndex((x, k) => k < HOTBAR && !x);
        if (free < 0) return;
        this.inv.move(slot, free);
        slot = free;
      }
      this.inv.selected = this.inv.selected === slot ? -1 : slot;
      this.selSlot = slot;
      events.emit(EV.INVENTORY_CHANGED, { inventory: this.inv });
    });
    d.querySelector('#it-hot')?.addEventListener('click', () => {
      const free = this.inv.slots.findIndex((x, k) => k < HOTBAR && !x);
      this.inv.move(i, free >= 0 ? free : HOTBAR - 1);
      this.selSlot = free >= 0 ? free : HOTBAR - 1;
      this.refresh();
    });
    d.querySelector('#it-split')?.addEventListener('click', () => this.inv.split(i));
    d.querySelector('#it-drop')?.addEventListener('click', () => {
      const stack = this.inv.takeSlot(i);
      if (stack) this.onDrop(stack);
      this.selSlot = -1;
      this.refresh();
    });
  }

  // ---------------------------------------------------------
  // Arrastar e soltar (mouse e dedo)
  // ---------------------------------------------------------
  _setupDrag(b, i) {
    let start = null;
    let dragging = false;
    const ghost = this.refs.ghost;
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      start = { x: e.clientX, y: e.clientY, id: e.pointerId };
      dragging = false;
      try { b.setPointerCapture(e.pointerId); } catch { /* ok */ }
    });
    b.addEventListener('pointermove', (e) => {
      if (!start || e.pointerId !== start.id) return;
      if (!dragging && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 8 && this.inv.slots[i]) {
        dragging = true;
        ghost.innerHTML = itemIcon(this.inv.slots[i].id);
        ghost.hidden = false;
      }
      if (dragging) {
        ghost.style.left = `${e.clientX}px`;
        ghost.style.top = `${e.clientY}px`;
      }
    });
    const end = (e) => {
      if (!start || e.pointerId !== start.id) return;
      if (dragging) {
        ghost.hidden = true;
        const hitEl = document.elementFromPoint(e.clientX, e.clientY);
        const over = hitEl?.closest('.inv-slot');
        if (over) this.inv.move(i, Number(over.dataset.i));
        else if (!hitEl?.closest('.inv-panel')) {
          // soltou fora: larga no chão
          const stack = this.inv.takeSlot(i);
          if (stack) this.onDrop(stack);
        }
      } else {
        this.selSlot = i;
        this.showTab('item');
        this.refresh();
      }
      start = null;
      dragging = false;
    };
    b.addEventListener('pointerup', end);
    b.addEventListener('pointercancel', () => {
      start = null;
      dragging = false;
      ghost.hidden = true;
    });
  }
}
