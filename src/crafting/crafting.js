// =============================================================
// CRAFTING – criar itens a partir das receitas
// (data/crafting/receitas.json). Os ingredientes saem na hora;
// o item fica pronto depois do tempo da receita (fila).
// =============================================================
import data from '../data/crafting/receitas.json';
import { events, EV } from '../core/event_bus.js';
import { itemName } from '../items/items.js';

export const RECIPES = data.receitas;

export class Crafting {
  constructor(inventory, stats) {
    this.inv = inventory;
    this.stats = stats;
    this.queue = []; // { recipe, time }
  }

  // Ingredientes de uma receita com quanto você tem.
  requirements(recipe, times = 1) {
    return Object.entries(recipe.ingredientes).map(([id, need]) => ({
      id,
      need: need * times,
      have: this.inv.count(id),
    }));
  }

  // Quantas vezes dá para criar com o que tem agora.
  maxTimes(recipe) {
    let n = Infinity;
    for (const [id, need] of Object.entries(recipe.ingredientes)) n = Math.min(n, Math.floor(this.inv.count(id) / need));
    return n;
  }

  craft(recipe, times = 1) {
    const n = Math.min(times, this.maxTimes(recipe));
    if (n <= 0) {
      events.emit(EV.MESSAGE, { text: 'Faltam materiais.', kind: 'warn' });
      return 0;
    }
    for (const [id, need] of Object.entries(recipe.ingredientes)) this.inv.remove(id, need * n);
    for (let i = 0; i < n; i++) this.queue.push({ recipe, time: recipe.tempo });
    events.emit(EV.CRAFT_QUEUE, { queue: this.queue });
    return n;
  }

  // Cancela a fila e devolve os ingredientes (ex.: ao morrer,
  // eles vão junto para o saco de morte).
  cancelAll() {
    for (const q of this.queue) {
      for (const [id, need] of Object.entries(q.recipe.ingredientes)) this.inv.add(id, need);
    }
    this.queue.length = 0;
    events.emit(EV.CRAFT_QUEUE, { queue: this.queue });
  }

  // Progresso do primeiro item da fila (0 a 1).
  get progress() {
    const q = this.queue[0];
    return q ? 1 - q.time / q.recipe.tempo : 0;
  }

  update(dt) {
    const q = this.queue[0];
    if (!q) return;
    q.time -= dt;
    if (q.time > 0) return;
    this.queue.shift();
    const r = q.recipe;
    const added = this.inv.add(r.resultado, r.quantidade);
    if (added < r.quantidade) {
      events.emit(EV.MESSAGE, { text: `Inventário cheio: ${itemName(r.resultado)} perdido.`, kind: 'warn' });
    } else {
      events.emit(EV.MESSAGE, { text: `Criado: ${itemName(r.resultado)}`, kind: 'gain', icon: r.resultado });
    }
    this.stats.addXP(r.xp ?? 1);
    if (added > 0) events.emit(EV.CRAFTED, { id: r.resultado });
    events.emit(EV.CRAFT_QUEUE, { queue: this.queue });
  }
}
