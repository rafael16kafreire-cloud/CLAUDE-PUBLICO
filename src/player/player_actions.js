// =============================================================
// AÇÕES DO JOGADOR – bater, coletar, colher e comer
// - Bater (Atacar): acerta criatura > carcaça > planta/pedra na
//   frente. O que sai depende da ferramenta (recursos.json).
// - Colher (Interagir): bagas, bananas, fibra.
// - Comer/usar: itens de comida da barra rápida.
// =============================================================
import { BALANCE } from '../core/balance.js';
import { events, EV } from '../core/event_bus.js';
import { ITEMS, itemName } from '../items/items.js';
import { shakeAt } from '../world/materials.js';
import * as THREE from 'three';
import { sound } from '../audio/audio.js';

const FIST = { tipo: 'mao', dano: null, alcance: null, intervalo: null };
const INTERVAL = { mao: 0.45, machado: 0.6, picareta: 0.6, lanca: 0.7, clava: 0.62, tocha: 0.5 };

function rnd([a, b]) {
  return a + Math.floor(Math.random() * (b - a + 1));
}

export class PlayerActions {
  constructor(player, world, inventory) {
    this.player = player;
    this.world = world;
    this.inv = inventory;
  }

  // Ferramenta em uso (ou mãos vazias).
  get tool() {
    const s = this.inv.equipped;
    const f = s && ITEMS[s.id]?.ferramenta;
    const C = BALANCE.combate;
    if (!f) return { ...FIST, dano: C.soco_dano, alcance: C.soco_alcance_m, intervalo: C.soco_intervalo_seg };
    return { tipo: f.tipo, dano: f.dano, alcance: f.alcance, intervalo: INTERVAL[f.tipo] ?? 0.6, id: s.id, rende: f.rende ?? 1 };
  }

  // Item de comer/usar selecionado na barra?
  get selectedIsConsumable() {
    const s = this.inv.equipped;
    return !!(s && ITEMS[s.id]?.comida);
  }

  // Peso: até o máximo anda normal; acima anda devagar; muito acima, para.
  weightFactor() {
    const max = this.player.stats.maxWeight;
    const w = this.inv.weight();
    if (w <= max) return 1;
    if (w <= max * 1.5) return 0.45;
    return 0;
  }

  // ---------------------------------------------------------
  // Momento do golpe
  // ---------------------------------------------------------
  onSwingHit(forward) {
    const p = this.player;
    const t = this.tool;
    const creatures = this.world.creatures;
    // 1) criatura viva
    const hit = creatures?.playerAttack(p, forward, t.dano * p.stats.damageMul, t.alcance);
    if (hit) {
      this.world.effects.burst(hit.center(), 'sangue', 6, 2.5);
      sound.play('carne', hit.center());
      this._wear();
      return;
    }
    // 2) carcaça: tirar carne, couro e ossos
    const corpse = creatures?.findCorpse(p.position, forward, t.alcance + 0.5);
    if (corpse) {
      const got = creatures.harvestCorpse(corpse, t.tipo);
      this._give(got);
      this.world.effects.burst(corpse.center(), 'sangue', 5, 2);
      sound.play('carne', corpse.center());
      this._wear();
      return;
    }
    // 3) planta, tronco ou pedra
    const veg = this.world.vegetation;
    const rec = veg.findTarget(p.position.x, p.position.z, forward.x, forward.z, t.alcance);
    if (rec) this.harvest(rec, t.tipo);
  }

  // Coleta de uma planta/pedra com o modo dado (mao, machado, colher...).
  harvest(rec, mode) {
    const veg = this.world.vegetation;
    const res = veg.resourceOf(rec);
    if (!res) return false;
    // árvore gigante: só com machado; com a mão (ou outra coisa) machuca
    if (res.so_machado && mode !== 'machado' && mode !== 'colher') {
      if (mode === 'mao') {
        this.player.stats.damage(BALANCE.combate.dano_soco_arvore_gigante ?? 4, 'arvore');
        events.emit(EV.PLAYER_HURT, { amount: 4, source: 'árvore' });
      }
      events.emit(EV.MESSAGE, { text: `Ai! ${res.nome} é dura demais: precisa de um machado.`, kind: 'warn' });
      sound.play('madeira', new THREE.Vector3(rec.x, this.player.position.y + 1.2, rec.z), { volume: 0.6 });
      shakeAt(rec.x, rec.z, 0.4);
      return false;
    }
    const table = res[mode] ?? res.mao;
    if (!table) return false;
    const got = {};
    for (const [id, range] of Object.entries(table)) {
      let n = rnd(range);
      // ferramentas melhores rendem mais
      const tool = this.tool;
      if (tool.tipo === mode && tool.rende > 1) n = Math.round(n * tool.rende);
      if (n > 0) got[id] = n;
    }
    this._give(got);
    this.player.stats.addXP(res.xp ?? 1);
    veg.consume(rec);
    if (mode !== 'colher') this._wear();
    // efeito visual
    const kind = res.key === 'pedra' ? 'pedra' : ['arvore', 'arvore_gigante', 'tronco', 'palmeira'].includes(res.key) ? 'madeira' : 'folha';
    const fx = this.player.position.clone();
    fx.x += (rec.x - fx.x) * 0.8;
    fx.z += (rec.z - fx.z) * 0.8;
    fx.y = this.player.position.y + 1.2;
    this.world.effects.burst(fx, kind, kind === 'folha' ? 10 : 8, 2.6);
    sound.play(kind === 'folha' ? 'folhas' : kind, fx);
    if (kind === 'madeira') {
      this.world.effects.burst(fx.clone().setY(fx.y + 3), 'folha', 6, 1.5);
      shakeAt(rec.x, rec.z, 1);
    } else if (kind === 'folha') {
      shakeAt(rec.x, rec.z, 2);
    }
    return true;
  }

  // Colher (botão Interagir) a planta mais perto na frente.
  findHarvestable(forward) {
    const p = this.player.position;
    return this.world.vegetation.findTarget(p.x, p.z, forward.x, forward.z, 2.4, true);
  }

  colher(rec) {
    return this.harvest(rec, 'colher');
  }

  _give(got) {
    for (const [id, n] of Object.entries(got)) {
      const added = this.inv.add(id, n);
      if (added > 0) events.emit(EV.ITEM_GAINED, { id, amount: added });
      if (added < n) events.emit(EV.MESSAGE, { text: 'Inventário cheio!', kind: 'warn' });
    }
  }

  _wear() {
    const broke = this.inv.wear(1);
    if (broke) events.emit(EV.MESSAGE, { text: `${broke} quebrou!`, kind: 'warn' });
  }

  // ---------------------------------------------------------
  // Comer / usar
  // ---------------------------------------------------------
  useSlot(i) {
    const s = this.inv.slots[i];
    if (!s) return false;
    const def = ITEMS[s.id];
    const c = def?.comida;
    if (!c) return false;
    const st = this.player.stats;
    if (c.fome > 0 && st.food >= st.max.food - 0.5 && !c.vida && !c.sede) {
      events.emit(EV.MESSAGE, { text: 'Você está sem fome.', kind: 'info' });
      return false;
    }
    st.food = Math.min(st.max.food, st.food + (c.fome ?? 0));
    st.water = Math.min(st.max.water, st.water + (c.sede ?? 0));
    st.stamina = Math.max(0, Math.min(st.max.stamina, st.stamina + (c.stamina ?? 0)));
    if (c.vida > 0) st.health = Math.min(st.max.health, st.health + c.vida);
    if (c.vida < 0) st.damage(-c.vida, 'comida');
    this.inv.takeFrom(i, 1);
    events.emit(EV.ATE, { id: s.id });
    const verb = def.tipo === 'consumivel' ? 'Usou' : 'Comeu';
    events.emit(EV.MESSAGE, { text: `${verb}: ${itemName(s.id)}`, kind: 'info' });
    if (s.id === 'baga_escura') events.emit(EV.MESSAGE, { text: 'Você ficou sonolento…', kind: 'warn' });
    return true;
  }

  // Coloca uma estrutura (fogueira, saco de dormir) na frente do jogador.
  place(i) {
    const s = this.inv.slots[i];
    const type = s && ITEMS[s.id]?.colocavel;
    if (!type) return false;
    const p = this.player;
    const f = this.forward ?? { x: -Math.sin(p.facing), z: -Math.cos(p.facing) };
    const len = Math.hypot(f.x, f.z) || 1;
    const x = p.position.x + (f.x / len) * 2;
    const z = p.position.z + (f.z / len) * 2;
    const w = this.world;
    if (w.waterAt(x, z) || p.swimming) {
      events.emit(EV.MESSAGE, { text: 'Não dá para colocar na água.', kind: 'warn' });
      return false;
    }
    const n = w.map.normalAt(x, z, new THREE.Vector3());
    if (n.y < 0.8) {
      events.emit(EV.MESSAGE, { text: 'Chão muito inclinado aqui.', kind: 'warn' });
      return false;
    }
    const st = w.addStructure({ type, x, y: w.heightAt(x, z), z, rot: Math.atan2(f.x, f.z), owner: p.name ?? '' });
    if (!st) return false;
    this.inv.takeFrom(i, 1);
    events.emit(EV.MESSAGE, { text: `Pronto: ${ITEMS[s.id].nome} no chão.`, kind: 'gain' });
    events.emit(EV.PLACED, { type, structure: st });
    return true;
  }

  useSelected() {
    if (this.inv.selected < 0) return false;
    return this.useSlot(this.inv.selected);
  }

  // Toque num espaço da barra rápida: comida = come; ferramenta = equipa/guarda.
  pressHotbar(i) {
    const s = this.inv.slots[i];
    if (!s) {
      this.inv.selected = -1;
      events.emit(EV.INVENTORY_CHANGED, { inventory: this.inv });
      return;
    }
    if (ITEMS[s.id]?.comida) {
      this.useSlot(i);
      return;
    }
    if (ITEMS[s.id]?.colocavel) {
      this.place(i);
      return;
    }
    this.inv.selected = this.inv.selected === i ? -1 : i;
    events.emit(EV.INVENTORY_CHANGED, { inventory: this.inv });
  }
}
