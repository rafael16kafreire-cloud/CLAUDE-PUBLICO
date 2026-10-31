// =============================================================
// MENU DO BICHO DOMADO (igual ao "menu de interação" do ARK Mobile)
// Abre com Interagir num bicho seu. Dá para:
//   - mudar o nome (lápis)
//   - seguir você ou ficar parado, distância ao seguir
//   - alcance de alvo e agressividade (passivo, neutro, agressivo)
//   - vagar por perto quando parado
//   - tirar a sela, montar
//   - soltar (deixa de ser seu), castrar (não cruza mais) e matar
// Soltar e matar pedem um segundo toque para confirmar.
// =============================================================
import { events, EV } from '../core/event_bus.js';
import { itemName } from '../items/items.js';
import { CSTATE } from '../creatures/creature.js';

const OPTS = {
  followDist: [['curto', 'Curta'], ['medio', 'Média'], ['longo', 'Longa']],
  targetRange: [['curto', 'Curto'], ['medio', 'Médio'], ['longo', 'Longo']],
  aggression: [['passivo', 'Passivo'], ['neutro', 'Neutro'], ['agressivo', 'Agressivo']],
};

const ICON = {
  pencil: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M16.6 3.4a2 2 0 0 1 2.8 0l1.2 1.2a2 2 0 0 1 0 2.8L9 19 4 20l1-5z"/></svg>',
  unclaim: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M6 18 18 6" stroke="currentColor" stroke-width="2.4"/></svg>',
  spay: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="6.5" cy="17.5" r="2.6"/><circle cx="17.5" cy="17.5" r="2.6"/><path d="M8.4 15.6 18 4M15.6 15.6 6 4"/></svg>',
  kill: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M12 3c-4 0-6.5 2.6-6.5 6 0 2 .9 3.4 2.2 4.2V16h8.6v-2.8c1.3-.8 2.2-2.2 2.2-4.2 0-3.4-2.5-6-6.5-6zM9.3 8.4a1.6 1.6 0 1 1 0 3.2 1.6 1.6 0 0 1 0-3.2zm5.4 0a1.6 1.6 0 1 1 0 3.2 1.6 1.6 0 0 1 0-3.2z"/><path d="M4 18.5 20 21M20 18.5 4 21" stroke="currentColor" stroke-width="1.8"/></svg>',
  mount: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M3 11.5c2-4.5 16-4.5 18 0-.5 2-3 3-9 3s-8.5-1-9-3zm4-4c.6-2.4 3-3 5-1.2 2-1.8 4.4-1.2 5 1.2-2.6-.8-7.4-.8-10 0zM8 14.6h1.6V20H8zm6.4 0H16V20h-1.6z"/></svg>',
};

export class CreatureMenu {
  constructor(root, { onClose, onMount, inventory }) {
    this.onClose = onClose;
    this.onMount = onMount;
    this.inv = inventory;
    this.c = null;
    const el = document.createElement('div');
    el.className = 'overlay cmenu';
    el.hidden = true;
    el.innerHTML = `
      <div class="ark-panel cmenu-panel" role="dialog" aria-label="Menu do bicho">
        <div class="cmenu-head">
          <h2 class="cmenu-title" data-ref="title"></h2>
          <input class="cmenu-name" data-ref="name" maxlength="18" hidden>
          <button type="button" class="ark-square" data-act="rename" aria-label="Mudar o nome">${ICON.pencil}</button>
        </div>
        <p class="cmenu-sub" data-ref="sub"></p>
        <div class="cmenu-rows">
          <div class="cmenu-row"><span>Seguir você:</span><button type="button" class="ark-choice" data-act="follow" data-ref="follow"></button></div>
          <div class="cmenu-row"><span>Distância ao seguir:</span><button type="button" class="ark-choice" data-opt="followDist"></button></div>
          <div class="cmenu-row"><span>Alcance de alvo:</span><button type="button" class="ark-choice" data-opt="targetRange"></button></div>
          <div class="cmenu-row"><span>Agressividade:</span><button type="button" class="ark-choice" data-opt="aggression"></button></div>
          <label class="cmenu-row cmenu-check"><span>Vagar por perto (parado)</span><input type="checkbox" data-ref="wander"><i></i></label>
          <div class="cmenu-row" data-ref="saddleRow"><span data-ref="saddleTxt">Sela:</span><button type="button" class="ark-choice" data-act="unsaddle">Tirar sela</button></div>
        </div>
        <div class="cmenu-actions">
          <button type="button" class="ark-action" data-act="mount" data-ref="mount">${ICON.mount}<span>Montar</span></button>
          <button type="button" class="ark-action" data-act="unclaim">${ICON.unclaim}<span>Soltar</span></button>
          <button type="button" class="ark-action" data-act="spay" data-ref="spay">${ICON.spay}<span>Castrar</span></button>
          <button type="button" class="ark-action danger" data-act="kill">${ICON.kill}<span>Matar</span></button>
        </div>
        <p class="cmenu-confirm" data-ref="confirm" hidden></p>
        <button type="button" class="ark-close" data-act="close" id="cmenu-close">FECHAR</button>
      </div>`;
    root.appendChild(el);
    this.el = el;
    this.refs = {};
    el.querySelectorAll('[data-ref]').forEach((n) => { this.refs[n.dataset.ref] = n; });
    el.addEventListener('pointerdown', (e) => e.stopPropagation());
    el.addEventListener('click', (e) => {
      if (e.target === el) this.close();
    });
    el.querySelectorAll('[data-opt]').forEach((b) => b.addEventListener('click', () => this._cycle(b.dataset.opt)));
    el.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', () => this._act(b.dataset.act)));
    this.refs.wander.addEventListener('change', () => {
      if (!this.c) return;
      this.c.wander = this.refs.wander.checked;
      if (!this.c.wander && !this.c.follow) this._stay();
    });
    const name = this.refs.name;
    name.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') this._saveName();
      if (e.key === 'Escape') this._render();
    });
    name.addEventListener('blur', () => this._saveName());
  }

  get visible() {
    return !this.el.hidden;
  }

  open(c) {
    this.c = c;
    this._confirm = null;
    this.el.hidden = false;
    this._render();
  }

  close() {
    if (this.el.hidden) return;
    this.el.hidden = true;
    this.c = null;
    this.onClose?.();
  }

  _label(opt, v) {
    return OPTS[opt].find(([k]) => k === v)?.[1] ?? '';
  }

  _render() {
    const c = this.c;
    if (!c) return;
    const R = this.refs;
    R.name.hidden = true;
    R.title.hidden = false;
    R.title.textContent = `${(c.name ?? c.species.nome).toUpperCase()} - NV ${c.level}`;
    const extras = [];
    extras.push(c.species.nome, c.sex);
    if (c.isBaby) extras.push(`filhote · impressão ${Math.round((c.imprint ?? 0) * 100)}%`);
    if (c.neutered) extras.push('castrado');
    extras.push(`vida ${Math.ceil(c.health)}/${c.maxHealth}`);
    R.sub.textContent = extras.join(' · ');
    R.follow.textContent = c.follow ? 'Seguindo' : 'Parado';
    for (const b of this.el.querySelectorAll('[data-opt]')) {
      const opt = b.dataset.opt;
      b.textContent = this._label(opt, c[opt] ?? (opt === 'aggression' ? 'neutro' : 'medio'));
    }
    R.wander.checked = !!c.wander;
    R.saddleRow.hidden = !c.saddled;
    R.saddleTxt.textContent = c.saddled ? `Sela: ${itemName(c.saddleKind ?? 'sela')}` : 'Sela:';
    const rideable = c.species.pode_montar && !c.flies && !c.isBaby;
    R.mount.hidden = !(rideable && c.saddled);
    R.spay.hidden = !!c.neutered;
    R.confirm.hidden = !this._confirm;
    R.confirm.textContent = this._confirm === 'kill' ? 'Toque em Matar de novo para confirmar.'
      : this._confirm === 'unclaim' ? 'Toque em Soltar de novo: ele volta a ser selvagem.' : '';
  }

  _cycle(opt) {
    const c = this.c;
    if (!c) return;
    const list = OPTS[opt];
    const cur = c[opt] ?? (opt === 'aggression' ? 'neutro' : 'medio');
    const i = list.findIndex(([k]) => k === cur);
    c[opt] = list[(i + 1) % list.length][0];
    if (opt === 'aggression' && c[opt] === 'passivo') c.target = null;
    this._render();
  }

  _stay() {
    const c = this.c;
    c.target = null;
    c._setState(CSTATE.IDLE);
    c.idleFor = c.wander ? 3 : 1e9;
    c.home.set(c.pos.x, c.pos.z);
  }

  _saveName() {
    const c = this.c;
    const R = this.refs;
    if (!c || R.name.hidden) return;
    const v = R.name.value.trim().slice(0, 18);
    if (v) c.name = v;
    this._render();
  }

  _act(act) {
    const c = this.c;
    if (act === 'close') {
      this.close();
      return;
    }
    if (!c) return;
    const msg = (text, kind = 'info') => events.emit(EV.MESSAGE, { text, kind });
    if (act !== 'kill' && act !== 'unclaim') this._confirm = null;
    switch (act) {
      case 'rename': {
        const R = this.refs;
        R.title.hidden = true;
        R.name.hidden = false;
        R.name.value = c.name ?? c.species.nome;
        R.name.focus();
        R.name.select();
        return;
      }
      case 'follow':
        c.follow = !c.follow;
        c.target = null;
        if (c.follow) {
          c._setState(CSTATE.IDLE);
          c.idleFor = 0.5;
        } else this._stay();
        msg(`${c.name ?? c.species.nome}: ${c.follow ? 'seguindo você' : 'esperando aqui'}`);
        break;
      case 'unsaddle': {
        const kind = c.saddleKind ?? 'sela';
        if (this.inv.add(kind, 1) < 1) {
          msg('Inventário cheio: não dá para tirar a sela.', 'warn');
          break;
        }
        c.setSaddle(null);
        msg(`${itemName(kind)} voltou para o inventário.`);
        break;
      }
      case 'mount':
        this.close();
        this.onMount?.(c);
        return;
      case 'spay':
        c.neutered = true;
        msg(`${c.name ?? c.species.nome} foi castrado: não vai mais cruzar.`);
        break;
      case 'unclaim':
        if (this._confirm !== 'unclaim') {
          this._confirm = 'unclaim';
          break;
        }
        if (c.saddled) {
          this.inv.add(c.saddleKind ?? 'sela', 1);
          c.setSaddle(null);
        }
        c.tamed = false;
        c.owner = null;
        c.follow = false;
        c.name = c.species.nome;
        c.home.set(c.pos.x, c.pos.z);
        c._setState(CSTATE.WANDER);
        msg(`${c.species.nome} voltou a ser selvagem.`);
        this.close();
        return;
      case 'kill':
        if (this._confirm !== 'kill') {
          this._confirm = 'kill';
          break;
        }
        c.takeDamage(c.health + 1, null);
        msg(`${c.name ?? c.species.nome} morreu.`, 'warn');
        this.close();
        return;
      default:
        break;
    }
    this._render();
  }
}
