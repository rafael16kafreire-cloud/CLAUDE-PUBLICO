// =============================================================
// INVENTÁRIO – espaços (slots) com pilhas de itens e peso.
// Os 8 primeiros espaços são a BARRA RÁPIDA (embaixo na tela).
// Cada espaço: { id, qty, dur, spoil, agua }
//   dur = durabilidade de ferramentas e roupas
//   spoil = segundos até a próxima unidade de comida estragar
//   agua = água dentro do cantil
// =============================================================
import { events, EV } from '../core/event_bus.js';
import { ITEMS } from '../items/items.js';

export const HOTBAR = 8;
// Partes do corpo onde se veste roupa/armadura
export const EQUIP_SLOTS = ['cabeca', 'peito', 'maos', 'pernas', 'pes'];

export class Inventory {
  constructor(size = 38) {
    this.slots = new Array(size).fill(null);
    this.selected = -1; // espaço da barra rápida em uso (-1 = mãos vazias)
    this.equip = Object.fromEntries(EQUIP_SLOTS.map((k) => [k, null])); // roupa vestida
  }

  // Veste a roupa do espaço i (a que estava vestida volta para a mochila).
  dress(i) {
    const s = this.slots[i];
    const eq = s && ITEMS[s.id]?.equipamento;
    if (!eq) return false;
    const old = this.equip[eq.slot];
    this.slots[i] = old;
    this.equip[eq.slot] = s;
    if (this.selected === i) this.selected = -1;
    this._changed();
    return true;
  }

  // Tira a roupa da parte do corpo (vai para a mochila).
  undress(part) {
    const s = this.equip[part];
    if (!s) return false;
    const free = this.slots.findIndex((x, k) => !x && k >= HOTBAR);
    const k = free >= 0 ? free : this.slots.findIndex((x) => !x);
    if (k < 0) return false;
    this.slots[k] = s;
    this.equip[part] = null;
    this._changed();
    return true;
  }

  // Pontos de armadura somados da roupa vestida (como no ARK).
  get armorPoints() {
    let a = 0;
    for (const s of Object.values(this.equip)) if (s) a += ITEMS[s.id].equipamento.armadura ?? 0;
    return a;
  }

  // Quanto do dano a roupa tira (0..1). Fórmula do ARK:
  // armadura / (armadura + 100). Ex.: 100 de armadura = metade do dano.
  get armor() {
    const a = this.armorPoints;
    return a / (a + 100);
  }

  get warmth() {
    let t = 0;
    for (const s of Object.values(this.equip)) if (s) t += ITEMS[s.id].equipamento.frio ?? 0;
    return t;
  }

  // Cada golpe levado gasta um pouco das roupas; a que zera rasga.
  wearArmor(amount = 1) {
    let torn = null;
    for (const [k, s] of Object.entries(this.equip)) {
      if (!s) continue;
      s.dur = (s.dur ?? ITEMS[s.id].equipamento.durabilidade) - amount;
      if (s.dur <= 0) {
        torn = ITEMS[s.id].nome;
        this.equip[k] = null;
      }
    }
    if (torn) this._changed();
    return torn;
  }

  _changed() {
    events.emit(EV.INVENTORY_CHANGED, { inventory: this });
  }

  get size() {
    return this.slots.length;
  }

  count(id) {
    let n = 0;
    for (const s of this.slots) if (s && s.id === id) n += s.qty;
    return n;
  }

  weight() {
    let w = 0;
    for (const s of this.slots) if (s) w += (ITEMS[s.id]?.peso ?? 0) * s.qty;
    return w;
  }

  // Coloca itens. Ferramentas vão primeiro para a barra rápida.
  // Devolve quantos couberam.
  add(id, qty, extra = {}) {
    const def = ITEMS[id];
    if (!def || qty <= 0) return 0;
    const max = def.pilha ?? 100;
    let left = qty;
    // completa pilhas existentes
    if (max > 1) {
      for (const s of this.slots) {
        if (left <= 0) break;
        if (s && s.id === id && s.qty < max) {
          const k = Math.min(max - s.qty, left);
          s.qty += k;
          left -= k;
        }
      }
    }
    // espaços vazios (ferramentas e comida preferem a barra rápida)
    const preferHotbar = ['ferramenta', 'comida', 'consumivel', 'estrutura'].includes(def.tipo);
    const order = [...this.slots.keys()];
    if (!preferHotbar) order.push(...order.splice(0, HOTBAR));
    for (const i of order) {
      if (left <= 0) break;
      if (this.slots[i]) continue;
      const k = Math.min(max, left);
      this.slots[i] = { id, qty: k };
      if (def.ferramenta) this.slots[i].dur = extra.dur ?? def.ferramenta.durabilidade;
      if (def.equipamento) this.slots[i].dur = extra.dur ?? def.equipamento.durabilidade;
      if (def.comida?.estraga_min) this.slots[i].spoil = extra.spoil ?? def.comida.estraga_min * 60;
      if (def.cantil) this.slots[i].agua = extra.agua ?? 0;
      left -= k;
    }
    if (qty - left > 0) this._changed();
    return qty - left;
  }

  // Tira itens (de qualquer espaço). Devolve quantos tirou.
  remove(id, qty) {
    let left = qty;
    for (let i = this.slots.length - 1; i >= 0 && left > 0; i--) {
      const s = this.slots[i];
      if (!s || s.id !== id) continue;
      const k = Math.min(s.qty, left);
      s.qty -= k;
      left -= k;
      if (s.qty <= 0) this.slots[i] = null;
    }
    if (qty - left > 0) this._changed();
    return qty - left;
  }

  // Comida estraga: a cada "estraga_min" minutos uma unidade da pilha
  // estraga (carne vira Carne Estragada). mult < 1 = mais devagar (baú).
  update(dt, mult = 1) {
    let changed = false;
    for (let i = 0; i < this.slots.length; i++) {
      const s = this.slots[i];
      const min = s && ITEMS[s.id]?.comida?.estraga_min;
      if (!min) continue;
      s.spoil = (s.spoil ?? min * 60) - dt * mult;
      if (s.spoil > 0) continue;
      s.spoil += min * 60;
      s.qty -= 1;
      changed = true;
      const rotten = s.id.startsWith('carne_') ? 'carne_estragada' : null;
      if (s.qty <= 0) {
        this.slots[i] = rotten ? { id: rotten, qty: 1 } : null;
        if (!rotten && this.selected === i) this.selected = -1;
      } else if (rotten && this.add(rotten, 1) < 1) {
        // sem espaço: some
      }
      if (rotten) events.emit(EV.ITEM_SPOILED, { id: s.id });
    }
    if (changed) this._changed();
  }

  takeFrom(i, qty = 1) {
    const s = this.slots[i];
    if (!s) return 0;
    const k = Math.min(s.qty, qty);
    s.qty -= k;
    if (s.qty <= 0) this.slots[i] = null;
    this._changed();
    return k;
  }

  // Arrasta de um espaço para outro: junta pilhas iguais ou troca.
  move(from, to) {
    if (from === to) return;
    const a = this.slots[from];
    const b = this.slots[to];
    if (!a) return;
    const max = ITEMS[a.id]?.pilha ?? 100;
    if (b && b.id === a.id && max > 1) {
      const k = Math.min(max - b.qty, a.qty);
      b.qty += k;
      a.qty -= k;
      if (a.qty <= 0) this.slots[from] = null;
    } else {
      this.slots[from] = b;
      this.slots[to] = a;
    }
    if (this.selected === from) this.selected = to;
    else if (this.selected === to) this.selected = from;
    this._changed();
  }

  // Divide a pilha ao meio num espaço vazio.
  split(i) {
    const s = this.slots[i];
    if (!s || s.qty < 2) return false;
    const empty = this.slots.findIndex((x, k) => !x && k >= HOTBAR);
    const target = empty >= 0 ? empty : this.slots.findIndex((x) => !x);
    if (target < 0) return false;
    const half = Math.floor(s.qty / 2);
    s.qty -= half;
    this.slots[target] = { id: s.id, qty: half };
    this._changed();
    return true;
  }

  // Tira a pilha inteira do espaço (para largar no chão).
  takeSlot(i) {
    const s = this.slots[i];
    this.slots[i] = null;
    if (this.selected === i) this.selected = -1;
    this._changed();
    return s;
  }

  // Organiza por tipo de item (recursos, comida, ferramentas...).
  sort() {
    const ORDER = { ferramenta: 0, consumivel: 1, comida: 2, recurso: 3 };
    const bag = this.slots.slice(HOTBAR).filter(Boolean);
    // junta pilhas iguais
    const merged = [];
    for (const s of bag) {
      const max = ITEMS[s.id]?.pilha ?? 100;
      const same = merged.find((m) => m.id === s.id && m.qty < max && max > 1);
      if (same) {
        const k = Math.min(max - same.qty, s.qty);
        same.qty += k;
        if (s.qty - k > 0) merged.push({ ...s, qty: s.qty - k });
      } else merged.push({ ...s });
    }
    merged.sort((a, b) => (ORDER[ITEMS[a.id]?.tipo] ?? 9) - (ORDER[ITEMS[b.id]?.tipo] ?? 9) || ITEMS[a.id].nome.localeCompare(ITEMS[b.id].nome));
    for (let i = HOTBAR; i < this.slots.length; i++) this.slots[i] = merged[i - HOTBAR] ?? null;
    this._changed();
  }

  // Tudo o que tem (para o saco de morte).
  takeAll() {
    const all = [...this.slots.filter(Boolean), ...Object.values(this.equip).filter(Boolean)];
    this.slots.fill(null);
    for (const k of EQUIP_SLOTS) this.equip[k] = null;
    this.selected = -1;
    this._changed();
    return all;
  }

  get equipped() {
    return this.selected >= 0 ? this.slots[this.selected] : null;
  }

  // Gasta durabilidade da ferramenta em uso; quebra se zerar.
  wear(amount = 1) {
    const s = this.equipped;
    if (!s || s.dur === undefined) return null;
    s.dur -= amount;
    if (s.dur <= 0) {
      const name = ITEMS[s.id].nome;
      this.slots[this.selected] = null;
      this.selected = -1;
      this._changed();
      return name; // quebrou
    }
    this._changed();
    return null;
  }

  toJSON() {
    return { slots: this.slots, selected: this.selected, equip: this.equip };
  }

  fromJSON(d) {
    if (!d?.slots) return;
    this.slots = d.slots.slice(0, this.slots.length).concat(new Array(Math.max(0, this.slots.length - d.slots.length)).fill(null));
    this.selected = d.selected ?? -1;
    for (const k of EQUIP_SLOTS) this.equip[k] = d.equip?.[k] ?? null;
    this._changed();
  }
}
