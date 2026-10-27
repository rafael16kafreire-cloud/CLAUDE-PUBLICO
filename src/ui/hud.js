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
import { STAT_ICONS } from './inspect_panel.js';
import { BUTTON_ICONS } from './button_icons.js';

// Ordem do ARK Mobile (embaixo, no meio): stamina, vida, XP/nível, peso (e fôlego quando
// mergulha). Fome e sede aparecem ao lado só quando estão baixas (abaixo de 50%).
const BARS = [
  { key: 'stamina', label: 'Stamina' },
  { key: 'health', label: 'Vida' },
  { key: 'xp', label: 'Nível' },
  { key: 'weight', label: 'Peso' },
  { key: 'oxygen', label: 'Fôlego' },
  { key: 'food', label: 'Fome' },
  { key: 'water', label: 'Sede' },
];
// só aparecem quando baixos
const SHOW_WHEN_LOW = { food: 0.5, water: 0.5 };

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
        <div class="hud-clock" data-ref="clock" title="Hora do dia"></div>
      </div>

      <!-- status como no ARK Mobile: ícones que enchem de baixo para cima -->
      <div class="hud-gauges">
        ${BARS.map((b) => `
          <div class="stat stat-${b.key}" data-stat="${b.key}" title="${b.label}" ${b.key === 'oxygen' || SHOW_WHEN_LOW[b.key] ? 'hidden' : ''}>
            <div class="track"><i class="fill"></i></div>
            <span class="ico">${ICONS[b.key] ?? ''}</span>
            <b class="num">100</b>
          </div>`).join('')}
      </div>

      <p class="hud-levelup" data-ref="levelup" hidden>NOVO NÍVEL DISPONÍVEL! Acesse o inventário para aplicar!</p>

      <div class="hud-left touch-only">
        <button type="button" class="corner-btn ark-btn" data-action="inventory" aria-label="Inventário"><span class="ab-ico">${ICONS.backpack}</span><span class="ab-txt">Inventário</span></button>
        <button type="button" class="corner-btn ark-btn" data-action="build" aria-label="Construir"><span class="ab-ico">${ICONS.hammer}</span><span class="ab-txt">Construir</span></button>
        <button type="button" class="corner-btn ark-btn" data-action="mount" aria-label="Montar"><span class="ab-ico">${ICONS.saddle}</span><span class="ab-txt">Montar</span></button>
        <button type="button" class="corner-btn ark-btn" data-action="whistle" aria-label="Assovios"><span class="ab-ico">${ICONS.whistle}</span><span class="ab-txt">Assovio</span></button>
      </div>

      <div class="hud-corner">
        <button type="button" class="corner-btn icon-btn inspect-btn" data-action="inspect" aria-label="Inspecionar bicho" title="Inspecionar bicho (R)">${STAT_ICONS.lupa}</button>
        <button type="button" class="corner-btn icon-btn" data-action="pause" aria-label="Pausar">${ICONS.pause}</button>
      </div>

      <!-- criatura na mira, como os "medidores" do ARK Mobile -->
      <div class="target" data-ref="target" hidden>
        <div class="target-box">
          <div class="target-name"><span data-ref="tname"></span> - <em data-ref="tlvl"></em>: <b data-ref="thp"></b></div>
          <div class="target-line" data-ref="teff" hidden></div>
          <div class="target-line" data-ref="tsex"></div>
          <div class="target-track"><i data-ref="tfill"></i></div>
        </div>
        <div class="target-meter" data-ref="tmeter" hidden>
          <div class="tm-state" data-ref="tstate">Inconsciente</div>
          <div class="tm-label" data-ref="ttame"></div>
          <div class="tm-bar"><i data-ref="ttamefill"></i></div>
        </div>
        <div class="target-sub" data-ref="tsub"></div>
      </div>

      <div class="biome-banner" data-ref="biome" hidden>
        <p class="biome-name" data-ref="bname"></p>
        <p class="biome-desc" data-ref="bdesc"></p>
      </div>

      <div class="coop-badge" data-ref="coop" hidden></div>
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

    this.gaugesEl = el.querySelector('.hud-gauges');
    el.querySelectorAll('.corner-btn').forEach((btn) => {
      btn.addEventListener('pointerdown', (e) => e.stopPropagation());
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        onButton(btn.dataset.action);
      });
    });

    events.on(EV.INTERACT_PROMPT, (p) => this._showPrompt(p?.text ?? null, p?.key));
    // (nome do bioma na tela: desligado a pedido; o evento continua existindo)
    events.on(EV.PLAYER_HURT, () => this._hurt());
  }

  // Co-op: código e quantos jogadores (null = sozinho).
  setCoop(code, count) {
    const b = this.refs.coop;
    b.hidden = !code;
    if (code) b.innerHTML = `Co-op <b>${code}</b> · ${count} ${count === 1 ? 'jogador' : 'jogadores'}`;
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

  // Criatura na mira: "Nome - Nv 7: 120/150", gênero e, desmaiada,
  // a barra rosa "Inconsciente" com quanto já domou (como no ARK).
  setTarget(c) {
    const t = this.refs.target;
    if (!c) {
      t.hidden = true;
      this._target = null;
      return;
    }
    const R = this.refs;
    if (this._target !== c) {
      this._target = c;
      t.dataset.temper = c.species.temperamento;
    }
    R.tname.textContent = c.tamed && c.name && c.name !== c.species.nome ? `${c.name} (${c.species.nome})` : c.species.nome;
    R.tlvl.textContent = `Nv ${c.level}`;
    R.thp.textContent = c.alive ? `${Math.ceil(c.health)}/${c.maxHealth}` : 'Abatido';
    const ratio = Math.max(0, c.health / c.maxHealth);
    R.tfill.style.transform = `scaleX(${ratio.toFixed(3)})`;
    R.tsex.textContent = `Gênero: ${c.sex ?? '?'}${c.isBaby ? ' · Filhote' : ''}`;
    const taming = c.knockedOut && !c.tamed;
    R.tmeter.hidden = !taming;
    R.teff.hidden = !taming;
    if (taming) {
      const pct = (c.tameProgress ?? 0) * 100;
      const eff = c.tameEff ?? 1;
      R.teff.textContent = `Efetividade da doma: ${(eff * 100).toFixed(1)}% (+${Math.floor(c.level * BALANCE.domar.bonus_niveis * eff)} Nv)`;
      R.ttame.textContent = `Domando: ${pct.toFixed(1)}%`;
      R.ttamefill.style.transform = `scaleX(${Math.min(1, pct / 100).toFixed(3)})`;
    }
    const status = c.tamed ? 'Domado' : c.knockedOut ? 'Desmaiado' : (TEMPER[c.species.temperamento] ?? '');
    R.tsub.textContent = c.alive && !taming ? status : '';
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
      ? `<span class="key key-touch">${attack ? BUTTON_ICONS.attack : BUTTON_ICONS.interact}</span>`
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
    this.refs.levelup.hidden = !(st.points > 0);
    for (const b of BARS) {
      const r = this.rows[b.key];
      let value = st[b.key];
      let max = st.max[b.key];
      let shown = null;
      if (b.key === 'xp') {
        value = st.xp;
        max = st.xpToNext();
        shown = st.level;                      // o número é o nível
      } else if (b.key === 'weight') {
        const inv = this.player.actions?.inv;
        value = inv ? inv.weight() : 0;
        max = st.maxWeight;
        shown = Math.round(value);             // o número é a carga em kg
      }
      if (shown === null) shown = Math.ceil(value);
      if (b.key === 'oxygen') {
        r.row.hidden = !(this.player.headUnderwater || value < max - 0.5);
      }
      if (shown !== r.last) {
        r.last = shown;
        r.num.textContent = String(shown);
      }
      const ratio = Math.max(0, Math.min(1, value / max));
      if (SHOW_WHEN_LOW[b.key] !== undefined) r.row.hidden = ratio >= SHOW_WHEN_LOW[b.key];
      r.fill.style.transform = `scaleY(${Math.min(1, ratio).toFixed(3)})`;
      // vermelho: vida/stamina/comida/água/fôlego baixos, ou carga acima do máximo
      r.row.classList.toggle('low', b.key === 'weight' ? ratio > 1 : b.key === 'xp' ? false : ratio < 0.2);
    }

    this.refs.lvl.textContent = String(st.level);
    const need = st.xpToNext();
    this.refs.xpfill.style.transform = `scaleX(${Math.min(1, st.xp / need).toFixed(3)})`;
    this.refs.xpfill.parentElement.title = `Experiência: ${Math.floor(st.xp)} / ${need}`;

    // relógio do dia
    const w = this.player.world;
    if (w?.time !== undefined) {
      const mins = Math.floor(w.time * 24 * 60);
      const hh = String(Math.floor(mins / 60)).padStart(2, '0');
      const mm = String(Math.floor((mins % 60) / 10) * 10).padStart(2, '0');
      const night = w.sky.isNight;
      this.refs.clock.textContent = `${night ? '☾' : '☀'} Dia ${w.day} · ${hh}:${mm}`;
      this.refs.clock.classList.toggle('night', night);
    }

    const t = st.temperature;
    const state = tempState(t);
    this.refs.tempval.textContent = `${Math.round(t)}°`;
    this.refs.temp.className = `hud-temp temp-${state.cls}`;
    this.refs.temp.title = `Temperatura: ${state.text}`;
  }
}
