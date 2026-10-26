// =============================================================
// MENU DE PAUSA (visual do ARK Mobile): RESUMIR, OPÇÕES, SALVAR JOGO
// e VOLTAR AO MENU PRINCIPAL. Opções em categorias (Áudio, Gráficos,
// Interface, Jogabilidade, Controles).
// =============================================================
import { settings, QUALITY_PRESETS } from '../core/settings.js';
import { listSlots, slotLabel } from '../core/save.js';

// Lista de controles (aba Controles)
const CONTROLS = [
  ['Andar', 'joystick à esquerda (celular) · WASD (PC)'],
  ['Olhar', 'arrastar o lado direito · mouse'],
  ['Pular / correr', 'botão seta · Espaço / Shift'],
  ['Atacar / coletar', 'botão espada · clique'],
  ['Usar / colher / beber', 'botão mão · E'],
  ['Inventário', 'botão mochila · Tab ou I'],
  ['Barra rápida', 'tocar no espaço · teclas 1 a 8'],
  ['Montar / descer', 'botão sela · F'],
  ['Assovios (bichos domados)', 'botão apito · T'],
  ['Trocar munição', 'Q'],
  ['Mapa', 'tocar no minimapa · M'],
  ['Inspecionar bicho', 'lupa · R'],
  ['Câmera / FPS / pausa', 'V / F3 / Esc'],
];

export class PauseMenu {
  constructor(root, { onResume, onQuitToMenu, onCloseApp, onSaveSlot, onLoadSlot, onLeaveCoop, onAdjustButtons }) {
    const el = document.createElement('div');
    el.className = 'overlay pause';
    el.hidden = true;
    el.innerHTML = `
      <!-- tela principal da pausa (como no ARK: botões grandes no meio) -->
      <div class="pause-main" data-view="main">
        <button type="button" class="ark-big" id="pause-resume">RESUMIR</button>
        <button type="button" class="ark-big" data-go="opts">OPÇÕES</button>
        <button type="button" class="ark-big" data-go="saves">SALVAR JOGO</button>
        <button type="button" class="ark-big" id="pause-menu">VOLTAR AO MENU PRINCIPAL</button>
        <button type="button" class="ark-big" id="pause-close" hidden>FECHAR O APP</button>
        <div class="pause-coop" id="pause-coop" hidden>
          <span>Código do co-op:</span> <b id="pause-code"></b> <span id="pause-players"></span>
          <button type="button" class="btn btn-small" id="pause-leave">Sair do co-op</button>
        </div>
      </div>

      <!-- opções: categorias à esquerda, conteúdo à direita -->
      <div class="ark-panel pause-opts-panel" data-view="opts" hidden role="dialog" aria-labelledby="pause-title">
        <div class="po-head">
          <h2 id="pause-title">OPÇÕES</h2>
          <button type="button" class="ark-square" data-go="main" aria-label="Voltar">↩</button>
          <button type="button" class="ark-square ark-x" data-go="main" aria-label="Fechar">✕</button>
        </div>
        <div class="po-body">
          <nav class="po-cats">
            <button type="button" class="po-cat" data-cat="audio">ÁUDIO</button>
            <button type="button" class="po-cat" data-cat="graficos">GRÁFICOS</button>
            <button type="button" class="po-cat" data-cat="interface">INTERFACE</button>
            <button type="button" class="po-cat" data-cat="jogo">JOGABILIDADE</button>
            <button type="button" class="po-cat" data-cat="controles">CONTROLES</button>
          </nav>
          <form class="opts po-content" id="pause-opts" autocomplete="off">
            <div class="po-page" data-page="audio">
              <h3>ÁUDIO</h3>
              <label for="opt-vol">Volume do som <output id="opt-vol-out"></output></label>
              <input type="range" id="opt-vol" min="0" max="1" step="0.05">
              <label for="opt-music">Música <output id="opt-music-out"></output></label>
              <input type="range" id="opt-music" min="0" max="1" step="0.05">
            </div>
            <div class="po-page" data-page="graficos">
              <h3>GRÁFICOS</h3>
              <label for="opt-quality">Qualidade gráfica</label>
              <select id="opt-quality">
                <option value="baixa">Baixa (mais leve)</option>
                <option value="media">Média</option>
                <option value="alta">Alta</option>
              </select>
              <label for="opt-view">Distância de visão <output id="opt-view-out"></output></label>
              <input type="range" id="opt-view" min="100" max="320" step="10">
              <label for="opt-smaa">Suavizar bordas (SMAA)</label>
              <input type="checkbox" id="opt-smaa">
              <label for="opt-auto">Baixar qualidade se ficar lento</label>
              <input type="checkbox" id="opt-auto">
              <label for="opt-debug">Mostrar FPS e desempenho</label>
              <input type="checkbox" id="opt-debug">
            </div>
            <div class="po-page" data-page="interface">
              <h3>INTERFACE</h3>
              <label for="opt-opacity">Opacidade dos botões <output id="opt-opacity-out"></output></label>
              <input type="range" id="opt-opacity" min="0.2" max="1" step="0.05">
              <label for="opt-size">Tamanho dos botões <output id="opt-size-out"></output></label>
              <input type="range" id="opt-size" min="0.7" max="1.4" step="0.05">
              <label for="opt-touch">Controles na tela</label>
              <select id="opt-touch">
                <option value="auto">Automático</option>
                <option value="sempre">Sempre mostrar</option>
                <option value="nunca">Nunca mostrar</option>
              </select>
              <button type="button" class="btn btn-small touch-only" id="pause-buttons">Ajustar posição dos botões</button>
            </div>
            <div class="po-page" data-page="jogo">
              <h3>JOGABILIDADE</h3>
              <label for="opt-camera">Câmera</label>
              <select id="opt-camera">
                <option value="terceira">Terceira pessoa</option>
                <option value="primeira">Primeira pessoa</option>
              </select>
              <label for="opt-sens">Sensibilidade da câmera <output id="opt-sens-out"></output></label>
              <input type="range" id="opt-sens" min="0.3" max="2.5" step="0.1">
            </div>
            <div class="po-page po-controls" data-page="controles">
              <h3>CONTROLES BÁSICOS</h3>
              ${CONTROLS.map(([k, d]) => `<div class="po-ctrl"><b>${k}</b><span>${d}</span></div>`).join('')}
            </div>
          </form>
        </div>
      </div>

      <!-- salvar / carregar -->
      <div class="ark-panel pause-saves-panel" data-view="saves" hidden>
        <div class="po-head">
          <h2>SALVAR JOGO</h2>
          <button type="button" class="ark-square ark-x" data-go="main" aria-label="Fechar">✕</button>
        </div>
        <div class="save-list" id="save-list"></div>
      </div>
    `;
    root.appendChild(el);
    this.el = el;
    const $ = (id) => el.querySelector(`#${id}`);

    this.fields = {
      quality: $('opt-quality'),
      view: $('opt-view'),
      vol: $('opt-vol'),
      music: $('opt-music'),
      sens: $('opt-sens'),
      opacity: $('opt-opacity'),
      size: $('opt-size'),
      touch: $('opt-touch'),
      camera: $('opt-camera'),
      debug: $('opt-debug'),
      smaa: $('opt-smaa'),
      auto: $('opt-auto'),
    };
    this.outs = {
      view: $('opt-view-out'),
      vol: $('opt-vol-out'),
      music: $('opt-music-out'),
      sens: $('opt-sens-out'),
      opacity: $('opt-opacity-out'),
      size: $('opt-size-out'),
    };

    $('pause-opts').addEventListener('submit', (e) => e.preventDefault());
    // trocar de tela (principal, opções, salvar) e de categoria
    el.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => this.go(b.dataset.go)));
    el.querySelectorAll('.po-cat').forEach((b) => b.addEventListener('click', () => this.cat(b.dataset.cat)));
    this.cat('audio');
    this.saveList = $('save-list');
    this.onSaveSlot = onSaveSlot;
    this.onLoadSlot = onLoadSlot;
    $('pause-resume').addEventListener('click', () => onResume());
    $('pause-buttons').addEventListener('click', () => onAdjustButtons?.());
    $('pause-leave').addEventListener('click', () => onLeaveCoop?.());
    this.coopEls = { box: $('pause-coop'), code: $('pause-code'), players: $('pause-players') };
    $('pause-menu').addEventListener('click', () => onQuitToMenu());
    const closeBtn = $('pause-close');
    if (onCloseApp) {
      closeBtn.hidden = false;
      closeBtn.addEventListener('click', () => onCloseApp());
    }

    const f = this.fields;
    f.quality.addEventListener('change', () => {
      settings.set('quality', f.quality.value);
      settings.set('viewDistance', QUALITY_PRESETS[f.quality.value].viewDistance);
      this.refresh();
    });
    f.view.addEventListener('input', () => {
      settings.set('viewDistance', Number(f.view.value));
      this.refresh();
    });
    f.music.addEventListener('input', () => {
      settings.set('music', Number(f.music.value));
      this.refresh();
    });
    f.vol.addEventListener('input', () => {
      settings.set('volume', Number(f.vol.value));
      this.refresh();
    });
    f.sens.addEventListener('input', () => {
      settings.set('sensitivity', Number(f.sens.value));
      this.refresh();
    });
    f.opacity.addEventListener('input', () => {
      settings.set('buttonOpacity', Number(f.opacity.value));
      this.refresh();
    });
    f.size.addEventListener('input', () => {
      settings.set('buttonSize', Number(f.size.value));
      this.refresh();
    });
    f.touch.addEventListener('change', () => settings.set('touchControls', f.touch.value));
    f.camera.addEventListener('change', () => settings.set('cameraMode', f.camera.value));
    f.debug.addEventListener('change', () => settings.set('showDebug', f.debug.checked));
    f.smaa.addEventListener('change', () => settings.set('smaa', f.smaa.checked));
    f.auto.addEventListener('change', () => settings.set('autoQuality', f.auto.checked));
  }

  // Copia as opções atuais para os campos.
  refresh() {
    const v = settings.values;
    const f = this.fields;
    f.quality.value = v.quality;
    f.view.value = String(v.viewDistance);
    f.sens.value = String(v.sensitivity);
    f.vol.value = String(v.volume ?? 0.8);
    f.music.value = String(v.music ?? 0.35);
    this.outs.music.textContent = `${Math.round((v.music ?? 0.35) * 100)}%`;
    this.outs.vol.textContent = `${Math.round((v.volume ?? 0.8) * 100)}%`;
    f.opacity.value = String(v.buttonOpacity);
    f.size.value = String(v.buttonSize);
    f.touch.value = v.touchControls;
    f.camera.value = v.cameraMode;
    f.debug.checked = !!v.showDebug;
    f.smaa.checked = v.smaa !== false;
    f.auto.checked = !!v.autoQuality;
    this.outs.view.textContent = `${v.viewDistance} m`;
    this.outs.sens.textContent = Number(v.sensitivity).toFixed(1);
    this.outs.opacity.textContent = `${Math.round(v.buttonOpacity * 100)}%`;
    this.outs.size.textContent = `${Math.round(v.buttonSize * 100)}%`;
  }

  setCoop(code, names = []) {
    this.coopEls.box.hidden = !code;
    if (!code) return;
    this.coopEls.code.textContent = code;
    this.coopEls.players.textContent = `(${names.join(', ')})`;
  }

  show() {
    this.refresh();
    this._renderSaves();
    this.go('main');
    this.el.hidden = false;
  }

  go(view) {
    for (const v of this.el.querySelectorAll('[data-view]')) v.hidden = v.dataset.view !== view;
    if (view === 'saves') this._renderSaves();
  }

  cat(name) {
    for (const b of this.el.querySelectorAll('.po-cat')) b.classList.toggle('on', b.dataset.cat === name);
    for (const p of this.el.querySelectorAll('.po-page')) p.hidden = p.dataset.page !== name;
  }

  // Espaços de salvar: Salvar aqui / Carregar
  _renderSaves() {
    const list = this.saveList;
    if (!list) return;
    list.innerHTML = listSlots().map((m) => `
      <div class="save-row">
        <span class="save-label">${slotLabel(m)}</span>
        <button type="button" class="btn btn-small" data-save="${m.n}">Salvar aqui</button>
        <button type="button" class="btn btn-small" data-load="${m.n}" ${m.empty ? 'disabled' : ''}>Carregar</button>
      </div>`).join('');
    list.querySelectorAll('[data-save]').forEach((b) => b.addEventListener('click', () => {
      const n = Number(b.dataset.save);
      const used = !listSlots()[n - 1].empty;
      // eslint-disable-next-line no-alert
      if (used && !window.confirm(`Salvar por cima do Espaço ${n}?`)) return;
      this.onSaveSlot?.(n);
      this._renderSaves();
    }));
    list.querySelectorAll('[data-load]').forEach((b) => b.addEventListener('click', () => {
      // eslint-disable-next-line no-alert
      if (window.confirm(`Carregar o Espaço ${b.dataset.load}? O que não foi salvo agora se perde.`)) this.onLoadSlot?.(Number(b.dataset.load));
    }));
  }

  hide() {
    this.el.hidden = true;
  }

  get visible() {
    return !this.el.hidden;
  }
}
