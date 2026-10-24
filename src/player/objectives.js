// =============================================================
// OBJETIVOS – um caminho de sobrevivência para o começo do jogo
// (data/objectives/objetivos.json). Mostra o objetivo atual na tela;
// ao cumprir, ganha XP e passa para o próximo.
// =============================================================
import data from '../data/objectives/objetivos.json';
import { events, EV } from '../core/event_bus.js';

export const OBJECTIVES = data.objetivos;

export class Objectives {
  constructor(inventory, stats) {
    this.inv = inventory;
    this.stats = stats;
    this.index = 0;
    const done = (pred) => (payload) => {
      const o = this.current;
      if (o && pred(o, payload)) this._complete();
    };
    events.on(EV.INVENTORY_CHANGED, () => this.check());
    events.on(EV.CRAFTED, done((o, p) => o.tipo === 'criar' && o.item === p.id));
    events.on(EV.PLACED, done((o, p) => o.tipo === 'colocar' && o.estrutura === p.type));
    events.on(EV.ATE, done((o) => o.tipo === 'comer'));
    events.on(EV.COOKED, done((o) => o.tipo === 'assar'));
    events.on(EV.DAWN, done((o) => o.tipo === 'amanhecer'));
    events.on(EV.CREATURE_KILLED, done((o, p) => o.tipo === 'abater' && p.byPlayer
      && (!o.dieta || p.creature.species.dieta === o.dieta)));
  }

  get current() {
    return OBJECTIVES[this.index] ?? null;
  }

  // Progresso do objetivo atual (texto curto), ex.: "6/10".
  get progress() {
    const o = this.current;
    if (!o || o.tipo !== 'ter') return '';
    return Object.entries(o.itens).map(([id, n]) => `${Math.min(n, this.inv.count(id))}/${n}`).join(' · ');
  }

  check() {
    const o = this.current;
    if (o?.tipo === 'ter' && Object.entries(o.itens).every(([id, n]) => this.inv.count(id) >= n)) this._complete();
  }

  _complete() {
    const o = this.current;
    if (!o) return;
    this.index += 1;
    this.stats.addXP(o.xp ?? 10);
    events.emit(EV.MESSAGE, { text: `Objetivo cumprido! +${o.xp ?? 10} XP`, kind: 'gain' });
    events.emit(EV.OBJECTIVE, { objective: this.current, done: o });
    // o próximo pode já estar cumprido (ex.: já tinha os itens)
    queueMicrotask(() => this.check());
  }

  toJSON() {
    return { index: this.index };
  }

  fromJSON(d) {
    if (typeof d?.index === 'number') this.index = d.index;
    events.emit(EV.OBJECTIVE, { objective: this.current });
  }
}
