// =============================================================
// TELA DE MORTE – mapa da ilha para escolher onde renascer.
// Toque num ponto verde do mapa e depois em "Renascer aqui".
// O X vermelho mostra onde você morreu (saco de morte).
// "Saco de dormir" entra como ponto no mapa na Fase 6.
// =============================================================
import { events, EV } from '../core/event_bus.js';
import { BALANCE } from '../core/balance.js';
import { renderMapImage, worldToMapPercent } from './map_image.js';

const CAUSES = {
  afogamento: 'Você se afogou.',
  sede: 'Você morreu de sede.',
  fome: 'Você morreu de fome.',
};

function causeText(cause) {
  if (cause?.startsWith('criatura:')) return `Morto por: ${cause.slice(9)}.`;
  if (cause === 'comida') return 'Você comeu algo que fez mal.';
  return CAUSES[cause] ?? 'Você morreu.';
}

export class DeathScreen {
  constructor(root, world) {
    this.world = world;
    this.selected = null;
    const el = document.createElement('div');
    el.className = 'overlay death';
    el.hidden = true;
    el.innerHTML = `
      <div class="panel death-panel" role="dialog" aria-labelledby="death-title">
        <div class="death-map-wrap">
          <img class="death-map" alt="Mapa da ilha" data-ref="img">
          <div class="death-pins" data-ref="pins"></div>
        </div>
        <div class="death-side">
          <h2 id="death-title" class="death-title">Você morreu</h2>
          <p class="death-cause" data-ref="cause"></p>
          <p class="death-note">Seus itens ficaram no saco de morte (X vermelho)
            por ${BALANCE.morte.saco_duracao_min} minutos.</p>
          <p class="eyebrow">Toque num ponto verde do mapa</p>
          <p class="death-selected" data-ref="sel">Nenhum ponto escolhido</p>
          <button type="button" class="btn btn-primary" id="respawn-confirm" disabled>Renascer aqui</button>
        </div>
      </div>
    `;
    root.appendChild(el);
    this.el = el;
    this.refs = {};
    el.querySelectorAll('[data-ref]').forEach((n) => {
      this.refs[n.dataset.ref] = n;
    });
    this.confirm = el.querySelector('#respawn-confirm');
    this.confirm.addEventListener('click', () => {
      if (this.selected) events.emit(EV.RESPAWN_REQUESTED, { pointId: this.selected });
    });
  }

  show(cause, deathPos) {
    const w = this.world;
    this.refs.cause.textContent = causeText(cause);
    if (!this.refs.img.src) this.refs.img.src = renderMapImage(w);
    const pins = this.refs.pins;
    pins.innerHTML = '';

    // nomes das regiões (data/world/ilha.json → rotulos_mapa)
    for (const r of w.layout.rotulos_mapa ?? []) {
      const p = worldToMapPercent(w, r.x, r.z);
      const label = document.createElement('span');
      label.className = 'map-label';
      label.textContent = r.nome;
      label.style.left = `${p.left}%`;
      label.style.top = `${p.top}%`;
      pins.appendChild(label);
    }

    // onde morreu
    if (deathPos) {
      const p = worldToMapPercent(w, deathPos.x, deathPos.z);
      const x = document.createElement('span');
      x.className = 'map-death';
      x.textContent = '✕';
      x.title = 'Você morreu aqui';
      x.style.left = `${p.left}%`;
      x.style.top = `${p.top}%`;
      pins.appendChild(x);
    }

    // pontos de renascer
    for (const point of w.respawnPoints) {
      const p = worldToMapPercent(w, point.position.x, point.position.z);
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'map-pin';
      b.id = `respawn-${point.id}`;
      b.style.left = `${p.left}%`;
      b.style.top = `${p.top}%`;
      b.setAttribute('aria-label', point.name);
      b.innerHTML = `<span class="pin-dot"></span><span class="pin-name"></span>`;
      b.lastElementChild.textContent = point.name;
      b.addEventListener('click', () => this._select(point, b));
      pins.appendChild(b);
    }

    this.selected = null;
    this.refs.sel.textContent = 'Nenhum ponto escolhido';
    this.confirm.disabled = true;
    this.el.hidden = false;
  }

  _select(point, btn) {
    this.selected = point.id;
    this.el.querySelectorAll('.map-pin').forEach((b) => b.classList.toggle('selected', b === btn));
    this.refs.sel.textContent = `Renascer em: ${point.name}`;
    this.confirm.disabled = false;
  }

  hide() {
    this.el.hidden = true;
  }
}
