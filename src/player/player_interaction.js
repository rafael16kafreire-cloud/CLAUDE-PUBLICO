// =============================================================
// INTERAÇÃO – o que o jogador está mirando e o botão "Interagir"
// Interagir: recuperar saco, colher (bagas, bananas, fibra), beber,
// dar comida para bicho desmaiado (domar), mandar domado seguir/ficar.
// Também mostra dicas do que dá para fazer com "Atacar"
// (árvore = madeira e palha, pedra = pedra e sílex...).
// =============================================================
import * as THREE from 'three';
import { BALANCE } from '../core/balance.js';
import { events, EV } from '../core/event_bus.js';
import { itemName } from '../items/items.js';
import { game } from '../core/game_manager.js';

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
    if (this.actions) this.actions.harvestCooldown = Math.max(0, (this.actions.harvestCooldown ?? 0) - dt);
    if (input.wasPressed('interact')) {
      const t = this._findTarget();
      // colher tem um tempinho entre uma e outra
      const wait = t?.kind === 'plant' && this.actions?.harvestCooldown > 0;
      if (t && t.key !== 'attack' && !wait) this._interact(t);
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

    // 1b) Bicho desmaiado (domar) ou domado (seguir/ficar)
    const cr = this._creatureTarget(camPos, f);
    if (cr) return cr;

    // 2) Água onde o jogador está ou na mira (distância até ela)
    let water = null;
    let waterD = Infinity;
    const here = this.world.waterAt(p.x, p.z);
    if (here && here.level > p.y + 0.15) {
      water = here;
      waterD = 0;
    } else {
      const camDist = camPos.distanceTo(p);
      for (let t = 0.3; t < camDist + WATER_REACH; t += 0.3) {
        const q = this._q.copy(camPos).addScaledVector(f, t);
        const ground = this.world.heightAt(q.x, q.z);
        const body = this.world.waterAt(q.x, q.z);
        if (body && q.y <= body.level + 0.05) {
          const d = Math.hypot(q.x - p.x, q.z - p.z);
          if (d <= WATER_REACH) {
            water = body;
            waterD = d;
          }
          break;
        }
        if (q.y < ground) break;
      }
    }

    // 3) Planta para colher (bagas, bananas, fibra) – se a água não
    //    estiver mais perto (na beira da água, beber ganha)
    const rec = this.actions.findHarvestable(f);
    // olhando para baixo, para a água: beber (não a planta do lado)
    const waterWins = water && (waterD <= Math.hypot(rec?.x - p.x, rec?.z - p.z) || f.y < -0.33);
    if (rec && !waterWins) {
      const res = this.world.vegetation.resourceOf(rec);
      const first = Object.keys(res.colher)[0];
      const label = res.rotulo ?? (first === 'banana' ? 'Pegar bananas' : `Colher ${itemName(first)}`);
      return { kind: 'plant', rec, text: label };
    }
    if (water) return this._waterTarget(water);

    // 5) Dica do que sai batendo (árvore, pedra, tronco, carcaça)
    const corpse = this.world.creatures?.findCorpse(p, f, 3);
    if (corpse) return { kind: 'hint', key: 'attack', text: `Bater: carne e couro (${corpse.species.nome})` };
    const tool = this.actions.tool;
    const hit = this.world.vegetation.findTarget(p.x, p.z, f.x, f.z, tool.alcance);
    if (hit) {
      const res = this.world.vegetation.resourceOf(hit);
      if (res.so_machado && tool.tipo !== 'machado') return { kind: 'hint', key: 'attack', text: `${res.nome}: precisa de machado` };
      const table = res[tool.tipo] ?? res.mao;
      const names = Object.keys(table).slice(0, 2).map(itemName).join(' e ');
      return { kind: 'hint', key: 'attack', text: `${res.nome}: ${names}` };
    }
    return null;
  }

  _creatureTarget(camPos, f) {
    const cm = this.world.creatures;
    if (!cm) return null;
    const p = this.player.position;
    const mine = (o) => o.alive && !o.rider && (o.knockedOut || (o.tamed && o.owner === this.player));
    let c = cm.findAimed(camPos, f, 14);
    if (this.player.riding) return null;
    if (!c || !mine(c)) {
      // sem mira certinha: o desmaiado/domado mais perto na sua frente
      c = null;
      let bd = REACH;
      const fl = Math.hypot(f.x, f.z) || 1;
      for (const o of cm.list) {
        if (!mine(o)) continue;
        const q = o.closestBodyPoint(p.x, p.z);
        const d = Math.hypot(q.x - p.x, q.z - p.z);
        const dot = d < 0.6 ? 1 : ((q.x - p.x) * f.x + (q.z - p.z) * f.z) / (d * fl);
        if (d < bd && dot > 0.2) {
          bd = d;
          c = o;
        }
      }
      if (!c) return null;
    }
    const pt = c.closestBodyPoint(p.x, p.z);
    if (Math.hypot(pt.x - p.x, pt.z - p.z) > REACH + 1) return null;
    if (c.knockedOut && !c.tamed) {
      if (!c.species.pode_domar) return { kind: 'hint', key: 'attack', text: `${c.species.nome} desmaiado (não dá para domar)` };
      const pct = Math.floor((c.tameProgress ?? 0) * 100);
      const fav = c.species.comida_preferida;
      const plate = Object.values(c.tameFood ?? {}).reduce((a, n) => a + n, 0);
      // pouco torpor e tem baga-escura: dar baga-escura primeiro
      if (c.torpor < c.stats.torpor * 0.4 && this.inv.count('baga_escura') > 0) {
        return { kind: 'tame-sleep', c, text: `Dar Baga-Escura (mais sono) · domando ${pct}%` };
      }
      const food = this._tameFoodFor(c);
      if (!food) return { kind: 'hint', key: 'interact', text: `Domando ${pct}% · precisa de ${itemName(fav)}${plate ? ` (comendo: ${plate})` : ''}` };
      return { kind: 'tame-feed', c, food, text: `Dar ${itemName(food)} · domando ${pct}%${plate ? ` (no prato: ${plate})` : ''}` };
    }
    if (c.tamed && c.owner === this.player) {
      const ride = c.species.pode_montar && !c.flies && !c.isBaby ? (game.isTouch ? ' · botão Montar' : ' · F: montar') : '';
      return { kind: 'tame-order', c, text: `${c.name ?? c.species.nome}: ${c.follow ? 'mandar ficar' : 'mandar seguir'}${ride}` };
    }
    return null;
  }

  // Comida que o jogador tem para dar: a preferida; senão outra do mesmo tipo.
  _tameFoodFor(c) {
    const fav = c.species.comida_preferida;
    if (this.inv.count(fav) > 0) return fav;
    const carn = c.species.dieta === 'carnivoro';
    const alt = carn ? ['carne_assada'] : ['baga_mejo', 'fruta_rubra', 'fruta_azul', 'banana'];
    return alt.find((id) => this.inv.count(id) > 0) ?? null;
  }

  _waterTarget(body) {
    return { kind: 'water', body, text: body.fresh ? 'Beber água' : 'Água do mar (salgada)' };
  }

  _interact(target) {
    if (!target) return;
    if (target.kind === 'tame-feed') {
      // põe no prato o que falta para domar (ele come aos poucos)
      const c = target.c;
      const left = Math.max(1, Math.ceil(((1 - (c.tameProgress ?? 0)) * c.tameNeed) / c.foodValue(target.food)));
      const plate = c.tameFood[target.food] ?? 0;
      const n = Math.min(this.inv.count(target.food), Math.max(1, left - plate));
      this.inv.remove(target.food, n);
      c.feed(target.food, n);
      events.emit(EV.MESSAGE, { text: `Deu ${n} ${itemName(target.food)} para ${c.species.nome}`, kind: 'info' });
      this._timer = 0;
      return;
    }
    if (target.kind === 'tame-sleep') {
      const c = target.c;
      this.inv.remove('baga_escura', 1);
      c.torpor = Math.min(c.stats.torpor, c.torpor + c.stats.torpor * BALANCE.domar.baga_escura_torpor);
      events.emit(EV.MESSAGE, { text: `${c.species.nome} dormiu mais um pouco`, kind: 'info' });
      this._timer = 0;
      return;
    }
    if (target.kind === 'tame-order') {
      const c = target.c;
      c.follow = !c.follow;
      c.target = null;
      c._setState('parado');
      c.idleFor = c.follow ? 0.5 : 1e9;
      if (!c.follow) c.home.set(c.pos.x, c.pos.z);
      events.emit(EV.MESSAGE, { text: `${c.name ?? c.species.nome}: ${c.follow ? 'seguindo você' : 'esperando aqui'}`, kind: 'info' });
      this._timer = 0;
      return;
    }
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
      const st = this.player.stats;
      const gole = BALANCE.sobrevivencia.gole_agua;
      // só bebe se faltar boa parte de um gole
      const got = st.max.water - st.water >= gole * BALANCE.sobrevivencia.satisfeito ? st.drink(gole) : 0;
      if (got < 0.5) {
        events.emit(EV.MESSAGE, { text: 'Você não está com sede.', kind: 'info' });
      } else {
        events.emit(EV.MESSAGE, { text: `+${Math.round(got)} Sede`, kind: 'gain' });
        events.emit(EV.WATER_DRUNK, { fresh: true, amount: got });
      }
      return;
    }
    if (target.kind === 'object' && target.obj.use) {
      if (target.obj.use({ player: this.player, inventory: this.inv })) events.emit(EV.STRUCTURE_USED, { structure: target.obj });
      this._timer = 0;
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
