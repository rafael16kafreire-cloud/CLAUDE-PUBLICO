// =============================================================
// TELA DE INVENTÁRIO E CRAFTING (botão Inventário / Tab)
// Esquerda: barra rápida + mochila (arraste para mover; toque para
// ver o item) e a barra de peso.
// Direita: "Criar" – categorias, cartões com o que cada receita
// pede (verde = tem, vermelho = falta), aviso de bancada, botões
// ×1 / ×5 / Máx e a fila (dá para cancelar).
// =============================================================
import { events, EV } from '../core/event_bus.js';
import { BALANCE } from '../core/balance.js';
import { ITEMS, itemIcon, itemName } from '../items/items.js';
import { HOTBAR, EQUIP_SLOTS } from '../inventory/inventory.js';

const EQUIP_NAME = { cabeca: 'Cabeça', peito: 'Peito', maos: 'Mãos', pernas: 'Pernas', pes: 'Pés' };
import { RECIPES, STATION_NAMES } from '../crafting/crafting.js';
import { ICONS } from './icons.js';
import { STAT_ICONS } from './inspect_panel.js';

// Habilidades (Inventário → Habilidades): gasta os pontos de nível.
const SKILLS = [
  { key: 'vida', nome: 'Saúde', icon: ICONS.health, cls: 'health' },
  { key: 'stamina', nome: 'Estamina', icon: ICONS.stamina, cls: 'stamina' },
  { key: 'folego', nome: 'Oxigênio', icon: ICONS.oxygen, cls: 'oxygen' },
  { key: 'fome', nome: 'Comida', icon: ICONS.food, cls: 'food' },
  { key: 'sede', nome: 'Água', icon: ICONS.water, cls: 'water' },
  { key: 'peso', nome: 'Peso', icon: STAT_ICONS.peso, cls: 'weight', unit: ' kg' },
  { key: 'forca', nome: 'Dano de combate', icon: STAT_ICONS.forca, cls: 'melee', unit: '%' },
  { key: 'velocidade', nome: 'Velocidade de movimento', icon: STAT_ICONS.velocidade, cls: 'speed', unit: '%' },
  { key: 'fortitude', nome: 'Fortaleza', icon: STAT_ICONS.fortitude, cls: 'fort', unit: ' °C' },
];

// valor atual de cada barra do corpo (ficha "Você")
const CUR = {
  vida: (st) => st.health,
  stamina: (st) => st.stamina,
  fome: (st) => st.food,
  sede: (st) => st.water,
  folego: (st) => st.oxygen,
  peso: (st, inv) => inv.weight(),
};

const CATS = ['Tudo', 'Aprender', 'Ferramentas', 'Armas', 'Roupas', 'Estruturas', 'Construção', 'Cura'];
const STATION_NAME = STATION_NAMES;
const TYPE_LABEL = { recurso: 'Recurso', comida: 'Comida', ferramenta: 'Ferramenta', consumivel: 'Uso', estrutura: 'Estrutura', equipamento: 'Roupa', municao: 'Munição' };

export class InventoryScreen {
  constructor(root, { inventory, crafting, actions, stats, onDrop, onClose, world, tamedCount }) {
    this.youWorld = world;
    this.youTamed = tamedCount;
    this.inv = inventory;
    this.stats = stats;
    this.crafting = crafting;
    this.actions = actions;
    this.onDrop = onDrop;
    this.onClose = onClose;
    this.selSlot = -1;
    this.selRecipe = RECIPES[0];
    this.cat = 'Tudo';

    const el = document.createElement('div');
    el.className = 'overlay inv';
    el.hidden = true;
    el.innerHTML = `
      <div class="inv-panel" role="dialog" aria-label="Inventário">
        <section class="inv-left">
          <header class="inv-head">
            <h2>Inventário</h2>
            <div class="inv-wbar" title="Peso"><i data-ref="wfill"></i><span class="inv-weight" data-ref="weight"></span></div>
            <button type="button" class="btn btn-small" id="inv-sort">Organizar</button>
          </header>
          <p class="inv-label">Roupa vestida <span class="armor-info" data-ref="armor"></span></p>
          <div class="inv-grid inv-equip" data-ref="equip">${EQUIP_SLOTS.map((k) => `<button type="button" class="inv-slot eq-slot" data-part="${k}" title="${EQUIP_NAME[k]}"><span class="is-icon"></span><span class="eq-name">${EQUIP_NAME[k]}</span><i class="is-dur"></i></button>`).join('')}</div>
          <p class="inv-label">Barra rápida</p>
          <div class="inv-grid inv-hot" data-ref="hot"></div>
          <p class="inv-label">Mochila</p>
          <div class="inv-grid" data-ref="bag"></div>
        </section>
        <section class="inv-right">
          <div class="inv-tabs">
            <button type="button" class="tab" data-tab="craft">Fabricação</button>
            <button type="button" class="tab" data-tab="item">Item</button>
            <button type="button" class="tab" data-tab="skills" id="tab-skills">Você<b class="tab-dot" data-ref="sdot" hidden></b></button>
            <button type="button" class="tab" data-tab="engrams" id="tab-engrams">Engramas</button>
            <button type="button" class="tab" data-tab="box" id="tab-box" hidden>Baú</button>
            <button type="button" class="btn btn-small inv-close" id="inv-close" aria-label="Fechar">Fechar</button>
          </div>
          <div class="tab-body" data-tab-body="craft">
            <div class="craft-top">
              <div class="cat-row" data-ref="cats">${CATS.map((c) => `<button type="button" class="cat" data-cat="${c}">${c}</button>`).join('')}</div>
              <span class="station" data-ref="station"></span>
              <span class="engram-pts" data-ref="epts"></span>
            </div>
            <div class="recipe-grid" data-ref="recipes"></div>
            <div class="recipe-detail" data-ref="rdetail"></div>
            <div class="craft-queue" data-ref="queue"></div>
          </div>
          <div class="tab-body" data-tab-body="item" hidden>
            <div class="item-detail" data-ref="idetail"></div>
          </div>
          <div class="tab-body" data-tab-body="box" hidden>
            <p class="muted box-help">Toque num item da mochila para guardar; toque num item do baú para pegar.</p>
            <div class="rd-actions"><button type="button" class="btn btn-small" id="box-all">Guardar tudo da mochila</button><button type="button" class="btn btn-small" id="box-take">Pegar tudo</button></div>
            <div class="inv-grid box-grid" data-ref="box"></div>
          </div>
          <div class="tab-body" data-tab-body="engrams" hidden>
            <div class="eg-grid" data-ref="egrid"></div>
            <div class="eg-foot">
              <span class="eg-pts">PONTOS DISPONÍVEIS: <b data-ref="egpts">0</b></span>
              <span class="eg-next" data-ref="egnext"></span>
              <div class="eg-detail" data-ref="egdetail"></div>
            </div>
          </div>
          <div class="tab-body" data-tab-body="skills" hidden>
            <div class="you-info" data-ref="youinfo"></div>
            <p class="skill-points you-xp"><span data-ref="youxp"></span><span>PONTOS: <b data-ref="spoints">0</b></span></p>
            <div class="skill-list">
              ${SKILLS.map((s) => `
                <div class="skill-row skill-${s.cls}">
                  <span class="ico">${s.icon}</span>
                  <span class="sk-name">${s.nome}</span>
                  <span class="sk-lvl" data-ref="sl-${s.key}"></span>
                  <b class="sk-val" data-ref="sv-${s.key}"></b>
                  <button type="button" class="sk-plus" id="skill-${s.key}" data-skill="${s.key}" aria-label="Melhorar ${s.nome}">+</button>
                </div>`).join('')}
            </div>
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
      b.innerHTML = `<span class="rc-icon">${itemIcon(r.resultado)}</span>
        <span class="rc-body"><span class="rc-name">${itemName(r.resultado)}</span>
        <span class="rc-ings">${Object.entries(r.ingredientes).map(([id, n]) => `<span class="rc-ing" data-ing="${id}" data-need="${n}">${itemIcon(id)}<b>${n}</b></span>`).join('')}</span></span>
        <span class="rc-badge"></span>`;
      b.addEventListener('click', () => {
        this.selRecipe = r;
        this.refresh();
      });
      this.refs.recipes.appendChild(b);
    }

    el.querySelectorAll('.cat').forEach((c) => c.addEventListener('click', () => {
      this.cat = c.dataset.cat;
      this.refresh();
    }));
    el.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => this.showTab(t.dataset.tab)));
    el.querySelector('#inv-close').addEventListener('click', () => this.onClose());
    el.querySelectorAll('.sk-plus').forEach((b) => b.addEventListener('click', () => {
      if (this.stats?.spendPoint(b.dataset.skill)) this.refresh();
    }));
    events.on(EV.LEVEL_UP, () => this.visible && this.refresh());
    events.on(EV.SKILLS_CHANGED, () => this.visible && this.refresh());
    el.querySelector('#inv-sort').addEventListener('click', () => this.inv.sort());
    // tocar na roupa vestida: tira (volta para a mochila)
    el.querySelectorAll('.eq-slot').forEach((b) => b.addEventListener('click', () => {
      this.inv.undress(b.dataset.part);
      this.refresh();
    }));
    // baú: guardar/pegar tudo
    el.querySelector('#box-all').addEventListener('click', () => {
      for (let i = HOTBAR; i < this.inv.size; i++) this._toBox(i);
      this.refresh();
    });
    el.querySelector('#box-take').addEventListener('click', () => {
      if (!this.box) return;
      for (let i = 0; i < this.box.inv.size; i++) this._fromBox(i);
      this.refresh();
    });
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
    this.box = null;
    this.el.querySelector('#tab-box').hidden = true;
    if (this.tab === 'box') this.showTab('craft');
  }

  // Abre junto com um baú (aba Baú)
  openBox(box) {
    this.box = box;
    this.el.querySelector('#tab-box').hidden = false;
    this.show();
    this.showTab('box');
    this.refresh();
  }

  // move a pilha inteira da mochila para o baú
  _toBox(i) {
    const s = this.inv.slots[i];
    if (!this.box || !s) return;
    const moved = this.box.inv.add(s.id, s.qty, s);
    if (moved > 0) {
      if (this.inv.selected === i && moved >= s.qty) this.inv.selected = -1;
      this.inv.takeFrom(i, moved);
    }
  }

  // e do baú para a mochila
  _fromBox(i) {
    const s = this.box?.inv.slots[i];
    if (!s) return;
    const moved = this.inv.add(s.id, s.qty, s);
    if (moved > 0) this.box.inv.takeFrom(i, moved);
  }

  _renderBox() {
    const g = this.refs.box;
    if (!this.box) {
      g.innerHTML = '';
      return;
    }
    const slots = this.box.inv.slots;
    if (g.children.length !== slots.length) {
      g.innerHTML = '';
      slots.forEach((_, i) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'inv-slot';
        b.innerHTML = '<span class="is-icon"></span><b class="is-qty"></b>';
        b.addEventListener('click', () => {
          this._fromBox(i);
          this.refresh();
        });
        g.appendChild(b);
      });
    }
    slots.forEach((s, i) => {
      const b = g.children[i];
      b.classList.toggle('empty', !s);
      b.querySelector('.is-icon').innerHTML = s ? itemIcon(s.id) : '';
      b.querySelector('.is-qty').textContent = s && s.qty > 1 ? String(s.qty) : '';
      b.title = s ? `${ITEMS[s.id].nome} ×${s.qty}` : '';
    });
  }

  showTab(tab) {
    this.tab = tab;
    if (tab === 'engrams') this._renderEngrams();
    this.el.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === tab));
    this.el.querySelectorAll('[data-tab-body]').forEach((b) => { b.hidden = b.dataset.tabBody !== tab; });
  }

  _refreshSkills() {
    const st = this.stats;
    if (!st) return;
    this.refs.spoints.textContent = String(st.points);
    this.refs.sdot.hidden = st.points <= 0;
    this.refs.sdot.textContent = String(st.points);
    for (const s of SKILLS) {
      // como no ARK: atual/máximo nas barras do corpo
      const cur = CUR[s.key]?.(st, this.inv);
      this.refs[`sv-${s.key}`].textContent = cur !== undefined
        ? `${cur.toFixed(1)}/${st.skillValue(s.key).toFixed(1)}`
        : `${Math.round(st.skillValue(s.key))}${s.unit ?? ''}`;
      this.refs[`sl-${s.key}`].textContent = st.skills[s.key] ? `+${st.skills[s.key]}` : '';
    }
    this.el.querySelectorAll('.sk-plus').forEach((b) => { b.disabled = st.points <= 0; });
    // ficha "Você" (nível, dia, hora, temperatura, proteção...)
    const w = this.youWorld?.();
    const mins = w ? Math.floor(w.time * 24 * 60) : 0;
    const hora = `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
    const temp = st.temperature ?? 0;
    const rows = [
      ['NÍVEL', st.level],
      ['DIA', w?.day ?? 1],
      ['HORA', hora],
      ['TEMP', `${Math.round(temp)} °C`],
      ['BICHOS DOMADOS', this.youTamed?.() ?? 0],
      ['PROTEÇÃO', `${Math.round(Math.min(BALANCE.armadura.max_reducao, this.inv.armor) * 100)}%`],
      ['HIPOTÉRMICO', (st.skillValue('fortitude') + this.inv.warmth).toFixed(1)],
    ];
    this.refs.youinfo.innerHTML = `<p class="you-name">Humano · Sobrevivente</p>${rows.map(([k, v]) => `<div><span>${k}:</span><b>${v}</b></div>`).join('')}`;
    this.refs.youxp.textContent = `XP: ${Math.floor(st.xp)}/${st.xpToNext()}`;
  }

  // ---------- Engramas: grade por nível (como no ARK) ----------
  _renderEngrams() {
    const st = this.stats;
    if (!st) return;
    this.refs.egpts.textContent = String(st.engramPoints);
    // quanto o próximo nível rende de pontos de engrama (tabela do ARK)
    this.refs.egnext.textContent = st.level >= BALANCE.nivel.max
      ? 'Nível máximo'
      : `Ao chegar no nível ${st.level + 1}: +${st.engramsForLevel(st.level + 1)} pontos`;
    const g = this.refs.egrid;
    if (!g.children.length) {
      const byLevel = new Map();
      for (const r of RECIPES) {
        if (r.engrama_id && RECIPES.find((o) => o.id === r.engrama_id && o !== r)) continue; // mesma receita, outro material
        const lv = r.nivel ?? 1;
        if (!byLevel.has(lv)) byLevel.set(lv, []);
        byLevel.get(lv).push(r);
      }
      for (const lv of [...byLevel.keys()].sort((a, b) => a - b)) {
        const row = document.createElement('div');
        row.className = 'eg-row';
        row.innerHTML = `<span class="eg-lvl">${lv}</span><div class="eg-tiles"></div>`;
        const tiles = row.lastElementChild;
        for (const r of byLevel.get(lv)) {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'eg-tile';
          b.dataset.id = r.id;
          // nível mínimo ao lado de cada engrama (e o custo em pontos, como no ARK)
          b.innerHTML = `<span class="eg-lv">Nv ${r.nivel ?? 1}</span><span class="eg-cost">${r.engrama ? `✦${r.engrama}` : 'grátis'}</span><span class="eg-icon">${itemIcon(r.resultado)}</span><span class="eg-name">${itemName(r.resultado)}</span>`;
          b.addEventListener('click', () => {
            this.selEngram = r;
            this._renderEngrams();
          });
          tiles.appendChild(b);
        }
        g.appendChild(row);
      }
    }
    for (const b of g.querySelectorAll('.eg-tile')) {
      const r = RECIPES.find((x) => x.id === b.dataset.id);
      const known = st.knows(r);
      const block = st.learnBlock(r);
      b.classList.toggle('known', known);
      b.classList.toggle('learnable', !known && !block);
      b.classList.toggle('dark', !known && st.level < (r.nivel ?? 1));
      b.classList.toggle('selected', r === this.selEngram);
    }
    const r = this.selEngram;
    const d = this.refs.egdetail;
    if (!r) {
      d.innerHTML = '<span class="muted">Toque num engrama para ver e aprender.</span>';
      return;
    }
    const block = st.learnBlock(r);
    d.innerHTML = `<b>${itemName(r.resultado)}</b> · nível ${r.nivel ?? 1} · ${r.engrama ? `${r.engrama} pts` : 'grátis'}
      ${st.knows(r) ? '<span class="eg-ok">✓ aprendido</span>' : `<button type="button" class="btn btn-small btn-primary" id="eg-learn" ${block ? 'disabled' : ''}>${block ? `Aprender (${block})` : 'Aprender'}</button>`}`;
    d.querySelector('#eg-learn')?.addEventListener('click', () => {
      if (st.learn(r)) {
        events.emit(EV.MESSAGE, { text: `Aprendeu: ${itemName(r.resultado)}`, kind: 'gain' });
        this.refresh();
      }
    });
  }

  // ---------------------------------------------------------
  refresh() {
    const inv = this.inv;
    const w = inv.weight();
    const max = this.stats?.maxWeight ?? BALANCE.jogador.peso_max;
    this._refreshSkills();
    this.refs.weight.textContent = `${w.toFixed(1)} / ${max} kg`;
    this.refs.weight.classList.toggle('over', w > max);
    this.refs.wfill.style.transform = `scaleX(${Math.min(1, w / max).toFixed(3)})`;
    this.refs.wfill.parentElement.classList.toggle('over', w > max);

    // roupa vestida
    for (const b of this.refs.equip.children) {
      const s = inv.equip[b.dataset.part];
      b.classList.toggle('empty', !s);
      b.querySelector('.is-icon').innerHTML = s ? itemIcon(s.id) : '';
      const dur = b.querySelector('.is-dur');
      dur.hidden = !s;
      if (s) dur.style.transform = `scaleX(${Math.max(0, (s.dur ?? 1) / ITEMS[s.id].equipamento.durabilidade).toFixed(3)})`;
    }
    this.refs.armor.textContent = `· proteção ${Math.round(Math.min(BALANCE.armadura.max_reducao, inv.armor) * 100)}% · calor +${inv.warmth}°`;
    inv.slots.forEach((s, i) => {
      const b = this.slotEls[i];
      b.classList.toggle('empty', !s);
      b.classList.toggle('selected', i === this.selSlot);
      b.classList.toggle('equipped', i === inv.selected);
      b.querySelector('.is-icon').innerHTML = s ? itemIcon(s.id) : '';
      b.querySelector('.is-qty').textContent = s && s.qty > 1 ? String(s.qty) : '';
      const dur = b.querySelector('.is-dur');
      const f = s && (ITEMS[s.id]?.ferramenta ?? ITEMS[s.id]?.equipamento);
      const sp = s && ITEMS[s.id]?.comida?.estraga_min;
      const cn = s && ITEMS[s.id]?.cantil;
      dur.hidden = !f && !sp && !cn;
      dur.classList.toggle('fresh', !!sp);
      dur.classList.toggle('water', !!cn);
      if (f) dur.style.transform = `scaleX(${Math.max(0, s.dur / f.durabilidade).toFixed(3)})`;
      else if (sp) dur.style.transform = `scaleX(${Math.max(0, (s.spoil ?? sp * 60) / (sp * 60)).toFixed(3)})`;
      else if (cn) dur.style.transform = `scaleX(${Math.max(0, (s.agua ?? 0) / cn.capacidade).toFixed(3)})`;
      b.title = s ? `${ITEMS[s.id].nome} ×${s.qty}` : '';
    });

    // categorias e estação por perto
    this.el.querySelectorAll('.cat').forEach((c) => c.classList.toggle('active', c.dataset.cat === this.cat));
    const near = this.crafting.stationsNear();
    this.refs.station.textContent = near.length ? `✓ Perto: ${near.map((k) => STATION_NAME[k] ?? k).join(', ')}` : 'Sem bancada por perto';
    this.refs.station.classList.toggle('ok', near.length > 0);
    const st0 = this.stats;
    this.refs.epts.textContent = st0 ? `Engramas: ${st0.engramPoints} pts` : '';
    this.refs.epts.classList.toggle('has', !!st0 && st0.engramPoints > 0);
    // receitas: o que dá para criar, o que falta e o que precisa de bancada
    for (const b of this.refs.recipes.children) {
      const r = RECIPES.find((x) => x.id === b.dataset.id);
      const n = this.crafting.maxTimes(r);
      const st = this.crafting.missingStation(r);
      const unknown = this.crafting.locked(r);
      const learnable = unknown && !this.stats.learnBlock(r);
      b.hidden = this.cat === 'Aprender' ? !unknown : this.cat !== 'Tudo' && r.categoria !== this.cat;
      b.classList.toggle('can', n > 0 && !st && !unknown);
      b.classList.toggle('locked', !!st || unknown);
      b.classList.toggle('engram', unknown);
      b.classList.toggle('learnable', learnable);
      b.classList.toggle('selected', r === this.selRecipe);
      const badge = b.querySelector('.rc-badge');
      badge.textContent = unknown ? (learnable ? `✦ ${r.engrama} pts` : `Nv ${r.nivel}`) : st ? `🔒 ${STATION_NAME[st] ?? st}` : n > 0 ? `×${n}` : '';
      for (const ing of b.querySelectorAll('.rc-ing')) {
        ing.classList.toggle('miss', inv.count(ing.dataset.ing) < Number(ing.dataset.need));
      }
    }
    this._renderRecipe();
    this._renderQueue();
    this._renderItem();
    this._renderBox();
    if (this.tab === 'engrams') this._renderEngrams();
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
    const st = this.crafting.missingStation(r);
    const unknown = this.crafting.locked(r);
    const can = st || unknown ? 0 : this.crafting.maxTimes(r);
    const f = def.ferramenta;
    const c = def.comida;
    const stats = [];
    if (f) stats.push(`Dano ${f.dano}`, `Durabilidade ${f.durabilidade}`, ...(f.rende > 1 ? [`Rende +${Math.round((f.rende - 1) * 100)}%`] : []));
    if (c?.vida) stats.push(`Vida +${c.vida}`);
    if (c?.fome) stats.push(`Fome +${c.fome}`);
    stats.push(`${(def.peso ?? 0).toFixed(1)} kg`);
    d.innerHTML = `
      <div class="rd-head">${itemIcon(r.resultado)}<div><h3>${def.nome}${r.quantidade > 1 ? ` ×${r.quantidade}` : ''}</h3><p>${def.descricao}</p>
        <p class="rd-stats">${stats.map((x) => `<span>${x}</span>`).join('')}</p></div></div>
      ${unknown ? `<div class="rd-engram"><p>✦ Engrama não aprendido · nível ${r.nivel} · ${r.engrama} pontos (você tem ${this.stats.engramPoints})</p>
        <button type="button" class="btn btn-primary" id="learn" ${this.stats.learnBlock(r) ? 'disabled' : ''}>${this.stats.learnBlock(r) ? `Aprender (${this.stats.learnBlock(r)})` : `Aprender por ${r.engrama} pontos`}</button></div>` : ''}
      ${st ? `<p class="rd-station">🔒 Precisa estar perto de: ${STATION_NAME[st] ?? st}.</p>` : ''}
      <p class="inv-label">Precisa de</p>
      <ul class="reqs">${reqs.map((q) => `
        <li class="${q.have >= q.need ? 'ok' : 'miss'}">${itemIcon(q.id)}<span>${itemName(q.id)}</span>
          <i class="req-bar"><i style="transform:scaleX(${Math.min(1, q.have / q.need).toFixed(3)})"></i></i><b>${q.have} / ${q.need}</b></li>`).join('')}
      </ul>
      <div class="rd-actions">
        <button type="button" class="btn btn-primary" id="craft-1" ${can < 1 ? 'disabled' : ''}>Criar</button>
        <button type="button" class="btn" id="craft-5" ${can < 2 ? 'disabled' : ''}>×${Math.min(5, Math.max(2, can))}</button>
        <button type="button" class="btn" id="craft-max" ${can < 2 ? 'disabled' : ''}>Máx (${can})</button>
        <span class="rd-time">⏱ ${r.tempo}s cada</span>
      </div>`;
    d.querySelector('#learn')?.addEventListener('click', () => {
      if (this.stats.learn(r)) {
        events.emit(EV.MESSAGE, { text: `Aprendeu: ${def.nome}`, kind: 'gain' });
        this.refresh();
      }
    });
    d.querySelector('#craft-1').addEventListener('click', () => this.crafting.craft(r, 1));
    d.querySelector('#craft-5').addEventListener('click', () => this.crafting.craft(r, Math.min(5, can)));
    d.querySelector('#craft-max').addEventListener('click', () => this.crafting.craft(r, Math.min(20, can)));
  }

  _renderQueue() {
    const q = this.crafting.queue;
    const el = this.refs.queue;
    if (!q.length) {
      el.innerHTML = '';
      return;
    }
    el.innerHTML = `<p class="inv-label">Fila (${q.length})</p>
      <div class="cq-list">${q.slice(0, 6).map((it, k) => `
        <div class="cq-row">${itemIcon(it.recipe.resultado)}<span class="cq-name">${itemName(it.recipe.resultado)}</span>
          ${k === 0 ? `<div class="cq-bar"><i style="transform:scaleX(${this.crafting.progress.toFixed(3)})"></i></div>` : '<div class="cq-wait">esperando</div>'}
          <button type="button" class="cq-x" data-k="${k}" aria-label="Cancelar">✕</button></div>`).join('')}
        ${q.length > 6 ? `<p class="muted">+${q.length - 6}…</p>` : ''}</div>`;
    el.querySelectorAll('.cq-x').forEach((b) => b.addEventListener('click', () => this.crafting.cancel(Number(b.dataset.k))));
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
    if (def.equipamento) facts.push(`Proteção ${def.equipamento.armadura}% · Calor +${def.equipamento.frio}° · Durabilidade ${Math.round(s.dur ?? def.equipamento.durabilidade)}/${def.equipamento.durabilidade}`);
    if (def.municao) facts.push(`Dano ${def.municao.dano}${def.municao.torpor ? ` · Sono (torpor) ${def.municao.torpor}` : ''}`);
    if (def.cantil) facts.push(`Água ${Math.round(s.agua ?? 0)} / ${def.cantil.capacidade}`);
    if (c?.estraga_min) {
      const left = Math.max(0, s.spoil ?? c.estraga_min * 60);
      facts.push(`Estraga 1 em ${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')} (a cada ${c.estraga_min} min)`);
    }
    d.innerHTML = `
      <div class="rd-head">${itemIcon(s.id)}<div><h3>${def.nome} ${s.qty > 1 ? `×${s.qty}` : ''}</h3><p>${def.descricao}</p></div></div>
      <p class="facts">${facts.join('<br>')}</p>
      <div class="rd-actions">
        ${c ? '<button type="button" class="btn btn-primary" id="it-use">' + (def.tipo === 'consumivel' ? 'Usar' : 'Comer') + '</button>' : ''}
        ${def.cantil ? `<button type="button" class="btn btn-primary" id="it-use" ${(s.agua ?? 0) < 1 ? 'disabled' : ''}>Beber (${Math.round(s.agua ?? 0)}/${def.cantil.capacidade})</button>` : ''}
        ${def.equipamento ? '<button type="button" class="btn btn-primary" id="it-wear">Vestir</button>' : ''}
        ${def.colocavel ? '<button type="button" class="btn btn-primary" id="it-place">Colocar no chão</button>' : ''}
        ${f ? `<button type="button" class="btn btn-primary" id="it-equip">${this.inv.selected === i ? 'Guardar' : 'Usar na mão'}</button>` : ''}
        ${f?.projetil && (f.municoes ?? [1, 2]).length > 1 ? `<button type="button" class="btn" id="it-ammo">Trocar munição (${this.actions.arrowType ? itemName(this.actions.arrowType) : 'sem flechas'})</button>` : ''}
        ${i >= HOTBAR ? '<button type="button" class="btn" id="it-hot">Pôr na barra</button>' : ''}
        ${s.qty > 1 ? '<button type="button" class="btn" id="it-split">Dividir</button>' : ''}
        <button type="button" class="btn" id="it-drop">Largar</button>
      </div>`;
    d.querySelector('#it-use')?.addEventListener('click', () => this.actions.useSlot(i));
    d.querySelector('#it-wear')?.addEventListener('click', () => {
      this.inv.dress(i);
      this.selSlot = -1;
      this.refresh();
    });
    d.querySelector('#it-ammo')?.addEventListener('click', () => {
      this.actions.cycleArrow();
      this.refresh();
    });
    d.querySelector('#it-place')?.addEventListener('click', () => {
      if (this.actions.place(i)) this.onClose();
    });
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
      } else if (this.box && this.tab === 'box') {
        // baú aberto: tocar guarda a pilha
        this._toBox(i);
        this.refresh();
      } else {
        // toque duplo no mesmo item (como no ARK): mochila -> barra rápida; barra rápida -> mochila
        const now = performance.now();
        const dbl = this._lastTap && this._lastTap.i === i && now - this._lastTap.t < 380 && this.inv.slots[i];
        this._lastTap = dbl ? null : { i, t: now };
        if (dbl) {
          const inHot = i < HOTBAR;
          const target = this.inv.slots.findIndex((x, k) => !x && (inHot ? k >= HOTBAR : k < HOTBAR));
          const to = target >= 0 ? target : (inHot ? -1 : HOTBAR - 1);
          if (to >= 0) {
            this.inv.move(i, to);
            this.selSlot = to;
          }
          this.refresh();
        } else {
          this.selSlot = i;
          this.showTab('item');
          this.refresh();
        }
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
