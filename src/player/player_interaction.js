// =============================================================
// INTERAÇÃO – o que o jogador está mirando e o botão "Interagir"
// Fase 1: beber água (doce mata a sede, do mar não) e recuperar o
// saco de morte. Fase 2+: coletar, abrir baús, etc.
// =============================================================
import * as THREE from 'three';
import { BALANCE } from '../core/balance.js';
import { events, EV } from '../core/event_bus.js';

const REACH = 3.4;        // alcance para objetos (m)
const WATER_REACH = 4.5;  // alcance para beber (m)

export class PlayerInteraction {
  constructor(player, world, cameraCtl) {
    this.player = player;
    this.world = world;
    this.cameraCtl = cameraCtl;
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
    // Procurar alvo 10x por segundo é suficiente (economiza CPU).
    this._timer -= dt;
    if (this._timer <= 0) {
      this._timer = 0.1;
      this.target = this._findTarget();
      this._setPrompt(this.target ? this.target.text : null);
    }
    if (input.wasPressed('interact')) {
      this._interact(this._findTarget());
    }
  }

  _findTarget() {
    const p = this.player.position;
    const camPos = this.cameraCtl.camera.position;
    const f = this.cameraCtl.forward;

    // 1) Objetos (saco de morte...): perto e na mira, ou bem perto.
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

    // 2) Água onde o jogador está (com água pelo menos nas canelas).
    const here = this.world.waterAt(p.x, p.z);
    if (here && here.level > p.y + 0.15) return this._waterTarget(here);

    // 3) Água na mira.
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

    // 4) Ajuda no celular: água doce bem ao lado do jogador.
    for (const r of [1.4, 2.6]) {
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
        const body = this.world.waterAt(p.x + Math.sin(a) * r, p.z + Math.cos(a) * r);
        if (body && body.fresh && body.level > p.y - 1.2) return this._waterTarget(body);
      }
    }
    return null;
  }

  _waterTarget(body) {
    return {
      kind: 'water',
      body,
      text: body.fresh ? 'Beber água' : 'Água do mar (salgada)',
    };
  }

  _interact(target) {
    if (!target) return;
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
      const items = target.obj.interact(this.player);
      const n = Array.isArray(items) ? items.length : 0;
      events.emit(EV.MESSAGE, {
        text: n > 0 ? `Saco recuperado: ${n} itens` : 'Saco de morte recuperado (vazio por enquanto)',
        kind: 'gain',
      });
      this.target = null;
      this._setPrompt(null);
    }
  }

  _setPrompt(text) {
    if (text === this._lastPrompt) return;
    this._lastPrompt = text;
    events.emit(EV.INTERACT_PROMPT, text ? { text } : null);
  }
}
