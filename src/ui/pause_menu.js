// =============================================================
// MENU DE PAUSA (visual do ARK Mobile): RESUMIR, OPÇÕES, SALVAR JOGO
// e VOLTAR AO MENU PRINCIPAL. Opções em categorias (Áudio, Gráficos,
// Interface, Jogabilidade, Controles).
// =============================================================
import { settings, QUALITY_PRESETS } from '../core/settings.js';
import { listSlots, slotLabel } from '../core/save.js';

// Lista de controles (aba Controles): na ordem do ARK Mobile, gesto -> o que faz
const GESTURES = [
  ['Arrastar a partir da borda direita', 'Roda de ações (agachar, interagir, montar, inventário, construir, mapa, recarregar, pausar)'],
  ['Arrastar a partir da borda esquerda', 'Roda de assovios / bichos'],
  ['Deslizar para cima (lado esquerdo)', 'Pular'],
  ['Deslizar para baixo (lado esquerdo)', 'Trocar munição / recarregar'],
  ['Botão da câmera (canto de baixo, ao lado de agachar)', 'Troca entre primeira e terceira pessoa (como no Valheim)'],
  ['Tocar e segurar (lado esquerdo)', 'Andar (arrastar para a direção) · toque duplo e segurar: correr'],
  ['Tocar (lado direito)', 'Usar / coletar · atacar / atirar · ativar'],
  ['Tocar e segurar (lado direito)', 'Olhar ao redor (arrastando) · segurar parado: montar / descer (se estiver mirando um bicho)'],
  ['Toque duplo e segurar (lado direito)', 'Repetir coleta / ataque · armar o arco · atirar'],
  ['Toque duplo em item do inventário', 'Passar o item entre mochila e barra rápida · com baú aberto: transferir'],
];
const KEYS = [
  ['Andar / correr / pular', 'WASD · Shift · Espaço'],
  ['Atacar / usar', 'clique · E'],
  ['Inventário / mapa', 'Tab ou I · M'],
  ['Barra rápida', 'teclas 1 a 8'],
  ['Montar / assovios / munição', 'F · T · Q'],
  ['Inspecionar / câmera / pausa', 'R · V · Esc'],
  ['Visão: 1ª / 3ª pessoa · distância', 'V troca · roda do mouse aproxima e afasta (3ª pessoa)'],
];

export class PauseMenu {
  constructor(root, { onResume, onHelp, onQuitToMenu, onCloseApp, onSaveSlot, onLoadSlot, onLeaveCoop, onAdjustButtons }) {
    const el = document.createElement('div');
    el.className = 'overlay pause';
    el.hidden = true;
    el.innerHTML = `
      <!-- tela principal da pausa (como no ARK: botões grandes no meio) -->
      <div class="pause-main" data-view="main">
        <button type="button" class="ark-big" id="pause-resume">RESUMIR</button>
        <button type="button" class="ark-big" data-go="opts">OPÇÕES</button>
        <button type="button" class="ark-big" data-go="saves">SALVAR JOGO</button>
        <button type="button" class="ark-big" id="pause-help">AJUDA</button>
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
              <label for="opt-somleve">Som leve (menos estalos; vale ao reabrir o jogo)</label>
              <select id="opt-somleve">
                <option value="auto">Automático</option>
                <option value="sim">Ligado</option>
                <option value="nao">Desligado</option>
              </select>
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
              <label for="opt-bright">Brilho (gamma) <output id="opt-bright-out"></output></label>
              <input type="range" id="opt-bright" min="0.6" max="1.6" step="0.05">
              <label for="opt-view">Distância de visão <output id="opt-view-out"></output></label>
              <input type="range" id="opt-view" min="100" max="320" step="10">
              <label for="opt-smaa">Suavizar bordas (SMAA)</label>
              <input type="checkbox" id="opt-smaa">
              <label for="opt-char">Personagem (ao reabrir o jogo)</label>
              <select id="opt-char">
                <option value="quadradinho">Quadradinho</option>
                <option value="realista">Realista</option>
              </select>
              <label for="opt-lowpoly">Grama e árvores low poly</label>
              <select id="opt-lowpoly">
                <option value="auto">Automático (se ficar lento)</option>
                <option value="ligado">Sempre ligado</option>
                <option value="desligado">Desligado</option>
              </select>
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
              <label for="opt-scheme">Esquema de toque</label>
              <select id="opt-scheme">
                <option value="gestos">Gestos (como no ARK)</option>
                <option value="botoes">Botões na tela</option>
              </select>
              <label for="opt-flick">Pular arrastando o dedo para cima</label>
              <input type="checkbox" id="opt-flick">
              <button type="button" class="btn btn-small touch-only" id="pause-buttons">Ajustar posição dos botões (esquema Botões)</button>
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
              <h3>VISÃO (CÂMERA)</h3>
              <label for="opt-camera2">Visão</label>
              <select id="opt-camera2">
                <option value="terceira">Terceira pessoa (estilo Valheim)</option>
                <option value="primeira">Primeira pessoa</option>
              </select>
              <label for="opt-camdist">Distância da câmera (3ª pessoa) <output id="opt-camdist-out"></output></label>
              <input type="range" id="opt-camdist" min="0.55" max="2" step="0.05">
              <h3>CONTROLES BÁSICOS (GESTOS)</h3>
              ${GESTURES.map(([k, d]) => `<div class="po-ctrl"><b>${k}</b><span>${d}</span></div>`).join('')}
              <h3>TECLADO (PC)</h3>
              ${KEYS.map(([k, d]) => `<div class="po-ctrl"><b>${k}</b><span>${d}</span></div>`).join('')}
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
      bright: $('opt-bright'),
      vol: $('opt-vol'),
      music: $('opt-music'),
      somleve: $('opt-somleve'),
      sens: $('opt-sens'),
      opacity: $('opt-opacity'),
      size: $('opt-size'),
      touch: $('opt-touch'),
      scheme: $('opt-scheme'),
      flick: $('opt-flick'),
      camera: $('opt-camera'),
      camera2: $('opt-camera2'),
      camdist: $('opt-camdist'),
      debug: $('opt-debug'),
      smaa: $('opt-smaa'),
      auto: $('opt-auto'),
      lowpoly: $('opt-lowpoly'),
      char: $('opt-char'),
    };
    this.outs = {
      view: $('opt-view-out'),
      camdist: $('opt-camdist-out'),
      bright: $('opt-bright-out'),
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
    $('pause-help').addEventListener('click', () => onHelp?.());
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
    f.bright.addEventListener('input', () => {
      settings.set('brightness', Number(f.bright.value));
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
    f.somleve.addEventListener('change', () => settings.set('somLeve', f.somleve.value === 'sim' ? true : f.somleve.value === 'nao' ? false : null));
    f.flick.addEventListener('change', () => settings.set('flickJump', f.flick.checked));
    f.scheme.addEventListener('change', () => settings.set('touchScheme', f.scheme.value));
    f.camera.addEventListener('change', () => settings.set('cameraMode', f.camera.value));
    f.camera2.addEventListener('change', () => settings.set('cameraMode', f.camera2.value));
    f.camdist.addEventListener('input', () => settings.set('cameraDist', Number(f.camdist.value)));
    f.debug.addEventListener('change', () => settings.set('showDebug', f.debug.checked));
    f.smaa.addEventListener('change', () => settings.set('smaa', f.smaa.checked));
    f.char.addEventListener('change', () => settings.set('personagem', f.char.value));
    f.lowpoly.addEventListener('change', () => settings.set('lowPoly', f.lowpoly.value));
    f.auto.addEventListener('change', () => settings.set('autoQuality', f.auto.checked));
  }

  // Copia as opções atuais para os campos.
  refresh() {
    const v = settings.values;
    const f = this.fields;
    f.quality.value = v.quality;
    f.view.value = String(v.viewDistance);
    f.sens.value = String(v.sensitivity);
    f.bright.value = String(v.brightness ?? 1);
    this.outs.bright.textContent = `${Math.round((v.brightness ?? 1) * 100)}%`;
    f.vol.value = String(v.volume ?? 0.8);
    f.music.value = String(v.music ?? 0.35);
    this.outs.music.textContent = `${Math.round((v.music ?? 0.35) * 100)}%`;
    this.outs.vol.textContent = `${Math.round((v.volume ?? 0.8) * 100)}%`;
    f.opacity.value = String(v.buttonOpacity);
    f.size.value = String(v.buttonSize);
    f.touch.value = v.touchControls;
    f.scheme.value = v.touchScheme;
    f.flick.checked = v.flickJump !== false;
    f.somleve.value = v.somLeve === true ? 'sim' : v.somLeve === false ? 'nao' : 'auto';
    f.camera.value = v.cameraMode;
    f.camera2.value = v.cameraMode;
    f.camdist.value = String(v.cameraDist ?? 1);
    this.outs.camdist.textContent = `${Math.round((v.cameraDist ?? 1) * 100)}%`;
    f.debug.checked = !!v.showDebug;
    f.smaa.checked = v.smaa !== false;
    f.auto.checked = !!v.autoQuality;
    f.lowpoly.value = v.lowPoly ?? 'auto';
    f.char.value = v.personagem ?? 'quadradinho';
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
