// =============================================================
// HUD – painel na tela durante o jogo
// Nível/XP, Vida, Stamina, Fome, Sede, Fôlego (só embaixo d'água),
// Temperatura, mira, dica de interação e botões do canto.
// Atualiza 10x por segundo (mexer no HTML todo quadro gasta bateria).
// =============================================================
import { events, EV } from '../core/event_bus.js';
import { game } from '../core/game_manager.js';
import { BALANCE } from '../core/balance.js';
import { ICONS } from './icons.js';

const BARS = [
  { key: 'health', label: 'Vida', max: 'health' },
  { key: 'stamina', label: 'Stamina', max: 'stamina' },
  { key: 'food', label: 'Fome', max: 'food' },
  { key: 'water', label: 'Sede', max: 'water' },
  { key: 'oxygen', label: 'Fôlego', max: 'oxygen' },
];

function tempState(t) {
  const T = BALANCE.temperatura;
  if (t < 4) return { cls: 'freezing', text: 'Congelando' };
  if (t < T.frio_abaixo_c) return { cls: 'cold', text: 'Frio' };
  if (t < 18) return { cls: 'cool', text: 'Fresco' };
  if (t <= T.calor_acima_c) return { cls: 'ok', text: 'Agradável' };
  if (t <= 40) return { cls: 'hot', text: 'Quente' };
  return { cls: 'scorching', text: 'Escaldante' };
}

export class Hud {
  constructor(root, player, onButton) {
    this.player = player;
    this._timer = 0;

    const el = document.createElement('div');
    el.className = 'hud';
    el.innerHTML = `
      <div class="hud-status">
        <div class="hud-level">
          <span class="lvl-badge">Nv <span data-ref="lvl">1</span></span>
          <div class="xp-track"><i data-ref="xpfill"></i></div>
          <span class="xp-text" data-ref="xptext">0 / 60</span>
        </div>
        ${BARS.map((b) => `
          <div class="stat stat-${b.key}" data-stat="${b.key}" ${b.key === 'oxygen' ? 'hidden' : ''}>
            <span class="ico" title="${b.label}">${ICONS[b.key]}</span>
            <span class="label">${b.label}</span>
            <div class="track"><i class="fill"></i></div>
            <b class="num">100</b>
          </div>`).join('')}
        <div class="hud-temp" data-ref="temp">
          <span class="ico">${ICONS.temperature}</span>
          <b data-ref="tempval">26°C</b>
          <em data-ref="temptext">Agradável</em>
        </div>
      </div>

      <div class="hud-corner">
        <button type="button" class="corner-btn touch-only" data-action="inventory">Inventário</button>
        <button type="button" class="corner-btn touch-only" data-action="build">Construir</button>
        <button type="button" class="corner-btn touch-only" data-action="mount">Montar</button>
        <button type="button" class="corner-btn" data-action="camera" data-ref="cambtn">3ª pessoa</button>
        <button type="button" class="corner-btn" data-action="debug">FPS</button>
        <button type="button" class="corner-btn icon-btn" data-action="pause" aria-label="Pausar">${ICONS.pause}</button>
      </div>

      <div class="crosshair" aria-hidden="true"></div>
      <div class="prompt" data-ref="prompt" hidden></div>
    `;
    root.appendChild(el);
    this.el = el;

    this.refs = {};
    el.querySelectorAll('[data-ref]').forEach((n) => {
      this.refs[n.dataset.ref] = n;
    });
    this.rows = {};
    el.querySelectorAll('[data-stat]').forEach((row) => {
      this.rows[row.dataset.stat] = {
        row,
        fill: row.querySelector('.fill'),
        num: row.querySelector('.num'),
        last: -1,
      };
    });

    // Botões do canto (funcionam com toque e com mouse).
    el.querySelectorAll('.corner-btn').forEach((btn) => {
      btn.addEventListener('pointerdown', (e) => e.stopPropagation());
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        onButton(btn.dataset.action);
      });
    });

    events.on(EV.INTERACT_PROMPT, (p) => this._showPrompt(p?.text ?? null));
  }

  setCameraLabel(mode) {
    this.refs.cambtn.textContent = mode === 'primeira' ? '1ª pessoa' : '3ª pessoa';
  }

  setVisible(v) {
    this.el.hidden = !v;
  }

  _showPrompt(text) {
    const p = this.refs.prompt;
    if (!text) {
      p.hidden = true;
      return;
    }
    const key = game.isTouch ? '<span class="key key-touch">Interagir</span>' : '<span class="key">E</span>';
    p.innerHTML = `${key}<span></span>`;
    p.lastElementChild.textContent = text;
    p.hidden = false;
  }

  update(dt) {
    this._timer -= dt;
    if (this._timer > 0) return;
    this._timer = 0.1;

    const st = this.player.stats;
    for (const b of BARS) {
      const r = this.rows[b.key];
      const value = st[b.key];
      const max = st.max[b.max];
      const shown = Math.ceil(value);
      if (b.key === 'oxygen') {
        // Fôlego só aparece embaixo d'água ou enquanto recupera.
        r.row.hidden = !(this.player.headUnderwater || value < max - 0.5);
      }
      if (shown !== r.last) {
        r.last = shown;
        r.num.textContent = String(shown);
      }
      const ratio = Math.max(0, Math.min(1, value / max));
      r.fill.style.transform = `scaleX(${ratio.toFixed(3)})`;
      r.row.classList.toggle('low', ratio < 0.2);
    }

    // Nível e XP
    this.refs.lvl.textContent = String(st.level);
    const need = st.xpToNext();
    this.refs.xptext.textContent = `${Math.floor(st.xp)} / ${need}`;
    this.refs.xpfill.style.transform = `scaleX(${Math.min(1, st.xp / need).toFixed(3)})`;

    // Temperatura
    const t = st.temperature;
    const state = tempState(t);
    this.refs.tempval.textContent = `${Math.round(t)}°C`;
    this.refs.temptext.textContent = state.text;
    this.refs.temp.className = `hud-temp temp-${state.cls}`;
  }
}
