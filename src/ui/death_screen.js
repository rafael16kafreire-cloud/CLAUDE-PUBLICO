// =============================================================
// TELA DE MORTE – mostra a causa e deixa escolher onde renascer.
// "Saco de dormir" aparece desativado até existir um (Fase 6).
// =============================================================
import { events, EV } from '../core/event_bus.js';
import { BALANCE } from '../core/balance.js';

const CAUSES = {
  afogamento: 'Você se afogou.',
  sede: 'Você morreu de sede.',
  fome: 'Você morreu de fome.',
};

export class DeathScreen {
  constructor(root, world) {
    this.world = world;
    const el = document.createElement('div');
    el.className = 'overlay death';
    el.hidden = true;
    el.innerHTML = `
      <div class="panel death-panel" role="dialog" aria-labelledby="death-title">
        <h2 id="death-title" class="death-title">Você morreu</h2>
        <p class="death-cause" data-ref="cause"></p>
        <p class="death-note">Seus itens ficaram num saco de morte no local por
          ${BALANCE.morte.saco_duracao_min} minutos. Procure o feixe de luz.</p>
        <p class="eyebrow">Escolha onde renascer</p>
        <div class="respawn-grid" data-ref="grid"></div>
      </div>
    `;
    root.appendChild(el);
    this.el = el;
    this.cause = el.querySelector('[data-ref="cause"]');
    this.grid = el.querySelector('[data-ref="grid"]');
  }

  show(cause) {
    this.cause.textContent = CAUSES[cause] ?? 'Você morreu.';
    this.grid.innerHTML = '';
    for (const p of this.world.respawnPoints) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn';
      b.id = `respawn-${p.id}`;
      b.textContent = p.name;
      b.addEventListener('click', () => events.emit(EV.RESPAWN_REQUESTED, { pointId: p.id }));
      this.grid.appendChild(b);
    }
    // Saco de dormir: chega com a construção (Fase 6).
    const bed = document.createElement('button');
    bed.type = 'button';
    bed.className = 'btn';
    bed.id = 'respawn-bed';
    bed.disabled = true;
    bed.innerHTML = 'Saco de dormir <small>nenhum construído</small>';
    this.grid.appendChild(bed);
    this.el.hidden = false;
  }

  hide() {
    this.el.hidden = true;
  }
}
