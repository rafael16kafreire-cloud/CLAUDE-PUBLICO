// =============================================================
// RODA DE ASSOVIOS (como no ARK Mobile): comandos rápidos para os
// bichos domados. Abre com T (PC) ou com o botão de apito (celular).
//   Siga-me / Parar  – Todos (até 60 m) ou Um (o que está na mira)
//   Agressivo / Neutro / Passivo – muda a agressividade de todos
//   Ataque meu alvo – todos atacam o bicho que você está mirando
// =============================================================
import { events, EV } from '../core/event_bus.js';
import { CSTATE } from '../creatures/creature.js';
import { sound } from '../audio/audio.js';

const RANGE = 60; // m: até onde os bichos escutam o assovio

const ITEMS = [
  { id: 'follow_all', label: 'Assovio Siga-me (Todos)' },
  { id: 'follow_one', label: 'Assovio Siga-me (Um)' },
  { id: 'stop_all', label: 'Assovio Parar (Todos)' },
  { id: 'stop_one', label: 'Assovio Parar (Um)' },
  { id: 'agressivo', label: 'Assovio Agressivo' },
  { id: 'attack', label: 'Assovio Ataque Meu Alvo' },
  { id: 'neutro', label: 'Assovio Neutro' },
  { id: 'passivo', label: 'Assovio Passivo' },
];

export class WhistleWheel {
  constructor(root, { creatures, player, camCtl, onClose }) {
    this.creatures = creatures;
    this.player = player;
    this.camCtl = camCtl;
    this.onClose = onClose;
    const el = document.createElement('div');
    el.className = 'overlay wheel';
    el.hidden = true;
    const n = ITEMS.length;
    el.innerHTML = `
      <div class="wheel-ring" role="menu" aria-label="Assovios">
        ${ITEMS.map((it, i) => {
          // começa no topo e vai no sentido do relógio
          const a = (i / n) * Math.PI * 2 - Math.PI / 2 + Math.PI / n;
          const x = 50 + Math.cos(a) * 36;
          const y = 50 + Math.sin(a) * 36;
          return `<button type="button" class="wheel-item" data-w="${it.id}" style="left:${x.toFixed(1)}%;top:${y.toFixed(1)}%">${it.label}</button>`;
        }).join('')}
        <div class="wheel-hole"></div>
        ${ITEMS.map((_, i) => `<i class="wheel-line" style="transform:rotate(${(i / n) * 360}deg)"></i>`).join('')}
      </div>`;
    root.appendChild(el);
    this.el = el;
    el.addEventListener('pointerdown', (e) => e.stopPropagation());
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-w]');
      if (b) this.run(b.dataset.w);
      this.close();
    });
  }

  get visible() {
    return !this.el.hidden;
  }

  open() {
    this.el.hidden = false;
  }

  close() {
    if (this.el.hidden) return;
    this.el.hidden = true;
    this.onClose?.();
  }

  // Bichos domados do jogador que escutam (perto)
  _near() {
    const p = this.player.position;
    return this.creatures.tamedBy(this.player).filter((c) => !c.rider && Math.hypot(c.pos.x - p.x, c.pos.z - p.z) < RANGE);
  }

  _aimed() {
    const cam = this.camCtl;
    return this.creatures.findAimed(cam.camera.position, cam.forward, RANGE);
  }

  run(id) {
    const msg = (text) => events.emit(EV.MESSAGE, { text, kind: 'info' });
    const near = this._near();
    const aimed = this._aimed();
    const mine = aimed && aimed.tamed && aimed.owner === this.player ? aimed : null;
    sound.play('clique');
    const setFollow = (list, on) => {
      for (const c of list) {
        c.follow = on;
        c.target = null;
        c._setState(CSTATE.IDLE);
        c.idleFor = on ? 0.5 : (c.wander ? 3 : 1e9);
        if (!on) c.home.set(c.pos.x, c.pos.z);
      }
      return list.length;
    };
    switch (id) {
      case 'follow_all':
        msg(`Siga-me: ${setFollow(near, true)} bicho(s)`);
        break;
      case 'follow_one':
        if (mine) msg(`${mine.name ?? mine.species.nome}: seguindo você`), setFollow([mine], true);
        else msg('Mire num bicho seu para usar este assovio.');
        break;
      case 'stop_all':
        msg(`Parar: ${setFollow(near, false)} bicho(s)`);
        break;
      case 'stop_one':
        if (mine) msg(`${mine.name ?? mine.species.nome}: esperando aqui`), setFollow([mine], false);
        else msg('Mire num bicho seu para usar este assovio.');
        break;
      case 'agressivo':
      case 'neutro':
      case 'passivo':
        for (const c of near) {
          c.aggression = id;
          if (id === 'passivo') c.target = null;
        }
        msg(`${near.length} bicho(s) agora ${id === 'agressivo' ? 'agressivos' : id === 'neutro' ? 'neutros' : 'passivos'}`);
        break;
      case 'attack':
        if (!aimed || aimed.tamed || !aimed.alive) {
          msg('Mire num bicho selvagem para mandar atacar.');
          break;
        }
        for (const c of near) if (c.damage > 0) c._chase(aimed);
        msg(`Atacar ${aimed.species.nome}!`);
        break;
      default:
        break;
    }
  }
}
