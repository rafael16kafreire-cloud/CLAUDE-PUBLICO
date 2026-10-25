// =============================================================
// INSPECIONAR BICHO (lupa)
// Aperta a lupa (ou R) mirando num bicho: leva 2 s olhando e
// aparece a ficha no canto da tela com os atributos dele:
// vida, força, peso que carrega, stamina, velocidade e torpor.
// Cada bicho sorteia esses números entre o mínimo e o máximo da
// espécie (criaturas.json → atributos), então dois raptores podem
// ser bem diferentes.
// Ícones brancos, fundo azul-marinho. Desenhos nossos (SVG).
// =============================================================
import { BALANCE } from '../core/balance.js';
import { events, EV } from '../core/event_bus.js';
import { ICONS } from './icons.js';

const svg = (body) => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">${body}</svg>`;

export const STAT_ICONS = {
  vida: ICONS.health,
  forca: svg('<path d="M3.5 19.5c0-3.2 1.2-5.6 3.2-7.4l1.9-6.2C9 4.6 10.1 3.8 11.4 3.8h2c1 0 1.6 1 1.2 1.9l-1.3 2.9 1.6.9c.9-1.2 2.4-1.8 4-1.4 2.1.6 3.2 2.8 2.7 5-.8 3.6-4 6.4-7.9 6.4H5z"/>'),
  peso: svg('<path d="M8.4 7.4a3.6 3.6 0 0 1 7.2 0h-2.1a1.5 1.5 0 0 0-3 0z"/><path d="M5.6 8.2h12.8l2.7 12.6H2.9z"/><text x="12" y="18" font-size="6.6" font-weight="700" text-anchor="middle" font-family="sans-serif" fill="#0e1c33">kg</text>'),
  stamina: ICONS.stamina,
  velocidade: svg('<path d="M10 22c-2.3 0-3.7-1.9-3.5-4.4.2-2.6 1.1-4.4 1.1-6.7 0-2.3 1.5-3.8 3.5-3.5 2 .3 3 2.1 2.7 4.4-.3 2.7-1.1 3.7-1 5.8.2 2.5-.6 4.4-2.8 4.4z"/><circle cx="8.8" cy="4.6" r="1.6"/><circle cx="12" cy="3.4" r="1.35"/><circle cx="14.7" cy="4.3" r="1.15"/><circle cx="16.6" cy="6.2" r="1"/><circle cx="17.6" cy="8.7" r="0.9"/>'),
  torpor: svg('<path d="M2.5 11.5h7.3v1.9l-4.6 5.4h4.6v1.9H2.5v-1.9l4.6-5.4H2.5z"/><path d="M11.5 5.5h5.6v1.5l-3.4 4.1h3.4v1.5h-5.6v-1.5l3.4-4.1h-3.4z"/><path d="M18.3 2h3.6v1.1l-2.1 2.6h2.1v1.1h-3.6V5.7l2.1-2.6h-2.1z"/>'),
  lupa: svg('<circle cx="10" cy="10" r="6.2" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M14.6 14.6 21 21" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>'),
  fechar: svg('<path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>'),
};

const LABEL = {
  vida: 'Vida', forca: 'Força', peso: 'Peso que carrega',
  stamina: 'Stamina', velocidade: 'Velocidade', torpor: 'Torpor',
};

const TEMPER = { agressivo: 'Agressivo', passivo: 'Pacífico', medroso: 'Medroso', territorial: 'Territorial' };

export class InspectPanel {
  // aim() → criatura na mira (ou null)
  constructor(root, aim) {
    this.aim = aim;
    this.target = null;   // bicho mostrado na ficha
    this.pending = null;  // bicho sendo inspecionado (carregando)
    this.progress = 0;
    this._lost = 0;
    this._timer = 0;

    const el = document.createElement('div');
    el.className = 'inspect';
    el.innerHTML = `
      <div class="inspect-loading" data-ref="loading" hidden>
        <span class="ico">${STAT_ICONS.lupa}</span>
        <div class="inspect-ring"><i data-ref="ring"></i></div>
      </div>
      <div class="inspect-card" data-ref="card" hidden>
        <button type="button" class="inspect-close" data-ref="close" aria-label="Fechar">${STAT_ICONS.fechar}</button>
        <div class="inspect-head">
          <div class="inspect-name" data-ref="name"></div>
          <div class="inspect-tags" data-ref="tags"></div>
        </div>
        <div class="inspect-grid">
          ${['vida', 'forca', 'peso', 'stamina', 'velocidade', 'torpor'].map((k) => `
            <div class="inspect-stat" title="${LABEL[k]}">
              <span class="ico">${STAT_ICONS[k]}</span><b data-ref="s-${k}"></b>
            </div>`).join('')}
        </div>
        <div class="inspect-bar bar-vida" title="Vida"><i data-ref="b-vida"></i><span data-ref="t-vida"></span></div>
        <div class="inspect-bar bar-stamina" title="Stamina"><i data-ref="b-stamina"></i><span data-ref="t-stamina"></span></div>
        <div class="inspect-bar bar-torpor" title="Torpor"><i data-ref="b-torpor"></i><span data-ref="t-torpor"></span></div>
      </div>
    `;
    root.appendChild(el);
    this.el = el;
    this.refs = {};
    el.querySelectorAll('[data-ref]').forEach((n) => { this.refs[n.dataset.ref] = n; });
    this.refs.close.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.refs.close.addEventListener('click', (e) => {
      e.stopPropagation();
      this.close();
    });
  }

  get open() {
    return !!this.target;
  }

  // Lupa apertada.
  toggle() {
    if (this.target || this.pending) {
      this.close();
      return;
    }
    const c = this.aim();
    if (!c || !c.stats) {
      events.emit(EV.MESSAGE, { text: 'Mire num bicho para inspecionar', kind: 'info' });
      return;
    }
    this.pending = c;
    this.progress = 0;
    this._lost = 0;
    this.refs.loading.hidden = false;
  }

  close() {
    this.target = null;
    this.pending = null;
    this.refs.card.hidden = true;
    this.refs.loading.hidden = true;
  }

  update(dt) {
    if (this.pending) {
      // precisa continuar olhando para o bicho (perde a mira por pouco tempo, tudo bem)
      const aimed = this.aim();
      this._lost = aimed === this.pending ? 0 : this._lost + dt;
      if (this._lost > 0.5 || !this.pending.stats) {
        this.close();
        events.emit(EV.MESSAGE, { text: 'Perdeu o bicho de vista', kind: 'info' });
        return;
      }
      this.progress += dt / BALANCE.criaturas.inspecionar_seg;
      this.refs.ring.style.transform = `scaleX(${Math.min(1, this.progress).toFixed(3)})`;
      if (this.progress >= 1) {
        this.target = this.pending;
        this.pending = null;
        this.refs.loading.hidden = true;
        this._fill(true);
        this.refs.card.hidden = false;
      }
      return;
    }
    if (!this.target) return;
    // sumiu do mundo (longe demais / carcaça apodreceu)
    if (!this.target.mesh?.parent) {
      this.close();
      return;
    }
    this._timer -= dt;
    if (this._timer <= 0) {
      this._timer = 0.25;
      this._fill(false);
    }
  }

  _fill(all) {
    const c = this.target;
    const s = c.stats;
    const r = this.refs;
    if (all) {
      r.name.textContent = `${c.species.nome} · Nv ${c.level}`;
      const len = c.species.comprimento_m ? ` · ${(c.scale * (c.mesh.geometry.boundingBox.max.z - c.mesh.geometry.boundingBox.min.z)).toFixed(1)} m` : '';
      r.tags.textContent = `${c.sex}${c.isBaby ? ' · Filhote' : ''} · Selvagem · ${TEMPER[c.species.temperamento] ?? ''}${len}`;
      r['s-vida'].textContent = fmt(s.vida);
      r['s-forca'].textContent = `${s.forca}%`;
      r['s-peso'].textContent = `${fmt(s.peso)} kg`;
      r['s-stamina'].textContent = fmt(s.stamina);
      r['s-velocidade'].textContent = `${(c.species.vel_correr * c.speedMul * 3.6).toFixed(0)} km/h`;
      r['s-torpor'].textContent = fmt(s.torpor);
    }
    const bar = (k, v, max) => {
      r[`b-${k}`].style.transform = `scaleX(${Math.max(0, Math.min(1, v / max)).toFixed(3)})`;
      r[`t-${k}`].textContent = `${fmt(Math.ceil(v))} / ${fmt(max)}`;
    };
    bar('vida', c.alive ? c.health : 0, c.maxHealth);
    bar('stamina', c.stamina ?? s.stamina, s.stamina);
    bar('torpor', c.torpor ?? 0, s.torpor);
    r.card.classList.toggle('dead', !c.alive);
  }
}

function fmt(n) {
  return Math.round(n).toLocaleString('pt-BR');
}
