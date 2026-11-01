// =============================================================
// TELA DE MORTE (como no ARK)
// 1) A visão fica vermelha e vai escurecendo até ficar preta.
// 2) Aparece o mapa de relevo com o X vermelho de onde você morreu.
// 3) Na lateral, a lista "Região de respawn": escolha uma zona e
//    toque em "Respawnar" (sem zona escolhida = local aleatório).
// =============================================================
import { events, EV } from '../core/event_bus.js';
import { renderContourImage, worldToMapPercent } from './map_image.js';

const CAUSES = {
  afogamento: 'Você se afogou.',
  sede: 'Você morreu de sede.',
  fome: 'Você morreu de fome.',
  arvore: 'Você se machucou socando uma árvore gigante.',
  frio: 'Você morreu congelado. Faça um Casaco de Pele e acenda fogueiras na neve.',
};

function causeText(cause) {
  if (cause?.startsWith('criatura:')) return `Morto por: ${cause.slice(9)}.`;
  if (cause === 'comida') return 'Você comeu algo que fez mal.';
  return CAUSES[cause] ?? 'Você morreu.';
}

const TICKS = [10, 20, 30, 40, 50, 60, 70, 80, 90];

export class DeathScreen {
  constructor(root, world) {
    this.world = world;
    this.selected = null;
    this.zones = [];

    // visão vermelha que escurece (antes do mapa)
    const fade = document.createElement('div');
    fade.className = 'death-fade';
    fade.hidden = true;
    root.appendChild(fade);
    this.fade = fade;

    const el = document.createElement('div');
    el.className = 'overlay death';
    el.hidden = true;
    el.innerHTML = `
      <div class="dz-time" data-ref="time"></div>
      <div class="dz-cause death-cause" data-ref="cause"></div>
      <div class="dz-left">
        <div class="dz-frame">
          <div class="dz-plot">
            <img class="death-map" alt="Mapa da ilha" data-ref="img">
            <div class="dz-ticks" data-ref="ticks"></div>
            <div class="death-pins" data-ref="pins"></div>
          </div>
        </div>
        <label class="dz-filter">FILTRAR:
          <input type="text" placeholder="Buscar" data-ref="filter" autocomplete="off">
        </label>
      </div>
      <div class="dz-side" role="dialog" aria-labelledby="death-title">
        <h2 id="death-title" class="death-title dz-title">REGIÃO DE RESPAWN</h2>
        <div class="dz-list" data-ref="list"></div>
        <button type="button" class="dz-btn" id="respawn-confirm" data-ref="confirm">RESPAWNAR (LOCAL ALEATÓRIO)</button>
      </div>
    `;
    root.appendChild(el);
    this.el = el;
    this.refs = {};
    el.querySelectorAll('[data-ref]').forEach((n) => {
      this.refs[n.dataset.ref] = n;
    });
    this.confirm = this.refs.confirm;
    this.confirm.addEventListener('click', () => {
      let id = this.selected;
      if (!id) {
        // local aleatório entre as zonas fáceis e médias
        const ok = this.zones.filter((z) => z.difficulty !== 'Difícil');
        const pool = ok.length ? ok : this.zones;
        id = pool[Math.floor(Math.random() * pool.length)]?.id;
      }
      if (id) events.emit(EV.RESPAWN_REQUESTED, { pointId: id });
    });
    this.refs.filter.addEventListener('input', () => this._applyFilter());

    // números dos eixos (10 a 90), como no mapa do ARK
    for (const t of TICKS) {
      const a = document.createElement('span');
      a.className = 'dz-tick dz-tick-y';
      a.textContent = String(t);
      a.style.top = `${t}%`;
      const b = document.createElement('span');
      b.className = 'dz-tick dz-tick-x';
      b.textContent = String(t);
      b.style.left = `${t}%`;
      this.refs.ticks.append(a, b);
    }
  }

  // visão vermelha que escurece (chamada quando o jogador morre)
  startFade() {
    this.fade.hidden = false;
    this.fade.classList.remove('run');
    void this.fade.offsetWidth; // reinicia a animação
    this.fade.classList.add('run');
  }

  _clockText() {
    const w = this.world;
    if (w?.time === undefined) return '';
    const mins = Math.floor(w.time * 24 * 60);
    const hh = String(Math.floor(mins / 60)).padStart(2, '0');
    const mm = String(mins % 60).padStart(2, '0');
    return `Dia: ${w.day}, Horário ${hh}:${mm}`;
  }

  show(cause, deathPos) {
    const w = this.world;
    this.refs.cause.textContent = causeText(cause);
    this.refs.time.textContent = this._clockText();
    if (!this.refs.img.src) this.refs.img.src = renderContourImage(w);
    const pins = this.refs.pins;
    pins.innerHTML = '';

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

    // zonas de renascer: lista na lateral + ponto no mapa
    this.zones = [...w.allRespawnPoints].sort((a, b) => {
      if (!!a.bag !== !!b.bag) return a.bag ? 1 : -1;
      return (a.zone ?? a.name).localeCompare(b.zone ?? b.name, 'pt') || (a.zoneN ?? 0) - (b.zoneN ?? 0);
    });
    const list = this.refs.list;
    list.innerHTML = '';
    for (const point of this.zones) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'zone-btn';
      b.id = `respawn-${point.id}`;
      b.dataset.id = point.id;
      b.textContent = point.name;
      b.addEventListener('click', () => this._select(point));
      list.appendChild(b);

      const p = worldToMapPercent(w, point.position.x, point.position.z);
      const d = document.createElement('button');
      d.type = 'button';
      d.className = point.bag ? 'map-pin map-pin-bag' : 'map-pin';
      d.dataset.id = point.id;
      d.style.left = `${p.left}%`;
      d.style.top = `${p.top}%`;
      d.setAttribute('aria-label', point.name);
      d.addEventListener('click', () => this._select(point));
      pins.appendChild(d);
    }

    this.selected = null;
    this.refs.filter.value = '';
    this._applyFilter();
    this._refreshButton();
    this.el.hidden = false;
    this.fade.classList.add('done');
  }

  _select(point) {
    this.selected = point.id;
    this.el.querySelectorAll('.zone-btn, .map-pin').forEach((b) => b.classList.toggle('selected', b.dataset.id === point.id));
    this._refreshButton();
  }

  _refreshButton() {
    const p = this.zones.find((z) => z.id === this.selected);
    this.confirm.textContent = p ? `RESPAWNAR (${p.name.toUpperCase()})` : 'RESPAWNAR (LOCAL ALEATÓRIO)';
  }

  _applyFilter() {
    const q = this.refs.filter.value.trim().toLowerCase();
    this.refs.list.querySelectorAll('.zone-btn').forEach((b) => {
      b.hidden = !!q && !b.textContent.toLowerCase().includes(q);
    });
  }

  hide() {
    this.el.hidden = true;
    this.fade.hidden = true;
    this.fade.classList.remove('run', 'done');
  }
}
