// =============================================================
// INTERAÇÃO – o que o jogador está mirando e o botão "Interagir"
// Interagir: recuperar saco, colher (bagas, bananas, fibra), beber.
// Também mostra dicas do que dá para fazer com "Atacar"
// (árvore = madeira e palha, pedra = pedra e sílex...).
// =============================================================
import * as THREE from 'three';
import { BALANCE } from '../core/balance.js';
import { events, EV } from '../core/event_bus.js';
import { itemName } from '../items/items.js';

const REACH = 3.4;        // alcance para objetos (m)
const WATER_REACH = 4.5;  // alcance para beber (m)

export class PlayerInteraction {
  constructor(player, world, cameraCtl, actions, inventory) {
    this.player = player;
    this.world = world;
    this.cameraCtl = cameraCtl;
    this.actions = actions;
    this.inv = inventory;
    this.target = null;
    this._timer = 0;
    this._lastPrompt = undefined;
    this._v = new THREE.Vector3();
    this._q = new THREE.Vector3();
  }

  update(dt, input) {
    if (this.player.dead) {
      this._setPrompt(null);
      return;
    }
    this._timer -= dt;
    if (this._timer <= 0) {
      this._timer = 0.12;
      this.target = this._findTarget();
      this._setPrompt(this.target ? { text: this.target.text, key: this.target.key ?? 'interact' } : null);
    }
    if (input.wasPressed('interact')) {
      const t = this._findTarget();
      if (t && t.key !== 'attack') this._interact(t);
    }
  }

  _findTarget() {
    const p = this.player.position;
    const camPos = this.cameraCtl.camera.position;
    const f = this.cameraCtl.forward;

    // 1) Sacos (de morte ou de itens)
    let best = null;
    let bestD = Infinity;
    for (const obj of this.world.interactables) {
      const c = obj.interactPoint;
      const dp = c.distanceTo(p);
      if (dp > (obj.interactRange ?? REACH)) continue;
      const to = this._v.copy(c).sub(camPos);
      const along = to.dot(f);
      const perp2 = to.lengthSq() - along * along;
      const aimed = along > 0 && perp2 < (obj.interactRadius ?? 1) ** 2;
      if ((aimed || dp < 1.8) && dp < bestD) {
        best = obj;
        bestD = dp;
      }
    }
    if (best) return { kind: 'object', obj: best, text: best.promptText() };

    // 2) Planta para colher (bagas, bananas, fibra)
    const rec = this.actions.findHarvestable(f);
    if (rec) {
      const res = this.world.vegetation.resourceOf(rec);
      const first = Object.keys(res.colher)[0];
      const label = first === 'banana' ? 'Pegar bananas' : `Colher ${itemName(first)}`;
      return { kind: 'plant', rec, text: label };
    }

    // 3) Água onde o jogador está
    const here = this.world.waterAt(p.x, p.z);
    if (here && here.level > p.y + 0.15) return this._waterTarget(here);

    // 4) Água na mira
    const camDist = camPos.distanceTo(p);
    for (let t = 0.3; t < camDist + WATER_REACH; t += 0.3) {
      const q = this._q.copy(camPos).addScaledVector(f, t);
      const ground = this.world.heightAt(q.x, q.z);
      const body = this.world.waterAt(q.x, q.z);
      if (body && q.y <= body.level + 0.05) {
        if (Math.hypot(q.x - p.x, q.z - p.z) <= WATER_REACH) return this._waterTarget(body);
        break;
      }
      if (q.y < ground) break;
    }

    // 5) Dica do que sai batendo (árvore, pedra, tronco, carcaça)
    const corpse = this.world.creatures?.findCorpse(p, f, 3);
    if (corpse) return { kind: 'hint', key: 'attack', text: `Bater: carne e couro (${corpse.species.nome})` };
    const tool = this.actions.tool;
    const hit = this.world.vegetation.findTarget(p.x, p.z, f.x, f.z, tool.alcance);
    if (hit) {
      const res = this.world.vegetation.resourceOf(hit);
      const table = res[tool.tipo] ?? res.mao;
      const names = Object.keys(table).slice(0, 2).map(itemName).join(' e ');
      return { kind: 'hint', key: 'attack', text: `${res.nome}: ${names}` };
    }
    return null;
  }

  _waterTarget(body) {
    return { kind: 'water', body, text: body.fresh ? 'Beber água' : 'Água do mar (salgada)' };
  }

  _interact(target) {
    if (!target) return;
    if (target.kind === 'plant') {
      this.actions.colher(target.rec);
      this._timer = 0;
      return;
    }
    if (target.kind === 'water') {
      if (!target.body.fresh) {
        events.emit(EV.MESSAGE, { text: 'Água salgada não mata a sede!', kind: 'warn' });
        return;
      }
      const got = this.player.stats.drink(BALANCE.sobrevivencia.gole_agua);
      if (got < 0.5) {
        events.emit(EV.MESSAGE, { text: 'Você não está com sede.', kind: 'info' });
      } else {
        events.emit(EV.MESSAGE, { text: `+${Math.round(got)} Sede`, kind: 'gain' });
        events.emit(EV.WATER_DRUNK, { fresh: true, amount: got });
      }
      return;
    }
    if (target.kind === 'object') {
      const items = target.obj.interact(this.player) ?? [];
      let lost = 0;
      for (const s of items) {
        const added = this.inv.add(s.id, s.qty, { dur: s.dur });
        lost += s.qty - added;
      }
      const n = items.reduce((a, s) => a + s.qty, 0);
      events.emit(EV.MESSAGE, {
        text: n > 0 ? `Recuperou ${n} itens${lost ? ` (${lost} não couberam)` : ''}` : 'Saco recuperado (vazio)',
        kind: 'gain',
      });
      this.target = null;
      this._setPrompt(null);
    }
  }

  _setPrompt(p) {
    const key = p ? `${p.key}|${p.text}` : null;
    if (key === this._lastPrompt) return;
    this._lastPrompt = key;
    events.emit(EV.INTERACT_PROMPT, p);
  }
}
