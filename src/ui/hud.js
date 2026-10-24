// =============================================================
// HUD – painel na tela durante o jogo
// Compacto: ícone + barra + número para Vida, Stamina, Fome, Sede
// e Fôlego (só embaixo d'água); nível/XP e temperatura numa linha.
// Também mostra: nome do bioma ao entrar, criatura na mira
// (nome, nível, vida) e a tela avermelhada ao levar dano.
// Atualiza 10x por segundo (mexer no HTML todo quadro gasta bateria).
// =============================================================
import { events, EV } from '../core/event_bus.js';
import { game } from '../core/game_manager.js';
import { BALANCE } from '../core/balance.js';
import { ICONS } from './icons.js';

const BARS = [
  { key: 'health', label: 'Vida' },
  { key: 'stamina', label: 'Stamina' },
  { key: 'food', label: 'Fome' },
  { key: 'water', label: 'Sede' },
  { key: 'oxygen', label: 'Fôlego' },
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

const TEMPER = {
  agressivo: 'Agressivo',
  territorial: 'Territorial',
  medroso: 'Medroso',
  passivo: 'Pacífico',
};

export class Hud {
  constructor(root, player, onButton) {
    this.player = player;
    this._timer = 0;

    const el = document.createElement('div');
    el.className = 'hud';
    el.innerHTML = `
      <div class="hurt" data-ref="hurt"></div>
      <div class="hud-status">
        <div class="hud-top">
          <span class="lvl-badge" title="Nível">${'Nv'} <span data-ref="lvl">1</span></span>
          <div class="xp-track" title="Experiência"><i data-ref="xpfill"></i></div>
          <span class="hud-temp" data-ref="temp" title="Temperatura">
            <span class="ico">${ICONS.temperature}</span><b data-ref="tempval">26°</b>
          </span>
        </div>
        ${BARS.map((b) => `
          <div class="stat stat-${b.key}" data-stat="${b.key}" title="${b.label}" ${b.key === 'oxygen' ? 'hidden' : ''}>
            <span class="ico">${ICONS[b.key]}</span>
            <div class="track"><i class="fill"></i></div>
            <b class="num">100</b>
          </div>`).join('')}
      </div>

      <div class="hud-corner">
        <button type="button" class="corner-btn touch-only" data-action="inventory">Inventário</button>
        <button type="button" class="corner-btn touch-only" data-action="build">Construir</button>
        <button type="button" class="corner-btn touch-only" data-action="mount">Montar</button>
        <button type="button" class="corner-btn" data-action="camera" data-ref="cambtn">1ª pessoa</button>
        <button type="button" class="corner-btn" data-action="debug">FPS</button>
        <button type="button" class="corner-btn icon-btn" data-action="pause" aria-label="Pausar">${ICONS.pause}</button>
      </div>

      <div class="target" data-ref="target" hidden>
        <div class="target-name"><span data-ref="tname"></span><em data-ref="tlvl"></em></div>
        <div class="target-track"><i data-ref="tfill"></i></div>
        <div class="target-sub" data-ref="tsub"></div>
      </div>

      <div class="biome-banner" data-ref="biome" hidden>
        <p class="biome-name" data-ref="bname"></p>
        <p class="biome-desc" data-ref="bdesc"></p>
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

    el.querySelectorAll('.corner-btn').forEach((btn) => {
      btn.addEventListener('pointerdown', (e) => e.stopPropagation());
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        onButton(btn.dataset.action);
      });
    });

    events.on(EV.INTERACT_PROMPT, (p) => this._showPrompt(p?.text ?? null, p?.key));
    events.on(EV.BIOME_ENTERED, (b) => this.showBiome(b.name, b.description));
    events.on(EV.PLAYER_HURT, () => this._hurt());
  }

  setCameraLabel(mode) {
    this.refs.cambtn.textContent = mode === 'primeira' ? '1ª pessoa' : '3ª pessoa';
  }

  setVisible(v) {
    this.el.hidden = !v;
  }

  // Nome do bioma grande no topo, some sozinho.
  showBiome(name, desc) {
    const b = this.refs.biome;
    this.refs.bname.textContent = name;
    this.refs.bdesc.textContent = desc ?? '';
    b.hidden = false;
    b.classList.remove('show');
    void b.offsetWidth; // reinicia a animação
    b.classList.add('show');
    clearTimeout(this._biomeT);
    this._biomeT = setTimeout(() => { b.hidden = true; }, 4200);
  }

  _hurt() {
    const h = this.refs.hurt;
    h.classList.remove('on');
    void h.offsetWidth;
    h.classList.add('on');
  }

  // Criatura na mira: nome, nível e vida.
  setTarget(c) {
    const t = this.refs.target;
    if (!c) {
      t.hidden = true;
      this._target = null;
      return;
    }
    if (this._target !== c) {
      this._target = c;
      this.refs.tname.textContent = c.species.nome;
      this.refs.tlvl.textContent = `Nv ${c.level}`;
      t.dataset.temper = c.species.temperamento;
    }
    const ratio = Math.max(0, c.health / c.maxHealth);
    this.refs.tfill.style.transform = `scaleX(${ratio.toFixed(3)})`;
    this.refs.tsub.textContent = c.alive
      ? `${TEMPER[c.species.temperamento] ?? ''} · ${Math.ceil(c.health)}/${c.maxHealth}`
      : 'Abatido';
    t.hidden = false;
  }

  // keyKind: 'interact' (E / Interagir) ou 'attack' (clique / Atacar).
  _showPrompt(text, keyKind = 'interact') {
    const p = this.refs.prompt;
    if (!text) {
      p.hidden = true;
      return;
    }
    const attack = keyKind === 'attack';
    const key = game.isTouch
      ? `<span class="key key-touch">${attack ? 'Atacar' : 'Interagir'}</span>`
      : `<span class="key">${attack ? 'Clique' : 'E'}</span>`;
    p.classList.toggle('prompt-attack', attack);
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
      const max = st.max[b.key];
      const shown = Math.ceil(value);
      if (b.key === 'oxygen') {
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

    this.refs.lvl.textContent = String(st.level);
    const need = st.xpToNext();
    this.refs.xpfill.style.transform = `scaleX(${Math.min(1, st.xp / need).toFixed(3)})`;
    this.refs.xpfill.parentElement.title = `Experiência: ${Math.floor(st.xp)} / ${need}`;

    const t = st.temperature;
    const state = tempState(t);
    this.refs.tempval.textContent = `${Math.round(t)}°`;
    this.refs.temp.className = `hud-temp temp-${state.cls}`;
    this.refs.temp.title = `Temperatura: ${state.text}`;
  }
}
