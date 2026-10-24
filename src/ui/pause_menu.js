// =============================================================
// MENU DE PAUSA com opções rápidas
// (O menu completo de opções chega na Fase 12; aqui já estão as
// que importam para testar no celular.)
// =============================================================
import { settings, QUALITY_PRESETS } from '../core/settings.js';

export class PauseMenu {
  constructor(root, { onResume, onQuitToMenu, onCloseApp, species = [], onSpawnTest }) {
    const el = document.createElement('div');
    el.className = 'overlay pause';
    el.hidden = true;
    el.innerHTML = `
      <div class="panel pause-panel" role="dialog" aria-labelledby="pause-title">
        <div class="pause-head">
          <h2 id="pause-title">Pausado</h2>
          <button type="button" class="btn btn-primary" id="pause-resume">Continuar</button>
        </div>
        <form class="opts" id="pause-opts" autocomplete="off">
          <label for="opt-quality">Qualidade gráfica</label>
          <select id="opt-quality">
            <option value="baixa">Baixa (mais leve)</option>
            <option value="media">Média</option>
            <option value="alta">Alta</option>
          </select>

          <label for="opt-view">Distância de visão <output id="opt-view-out"></output></label>
          <input type="range" id="opt-view" min="120" max="400" step="10">

          <label for="opt-sens">Sensibilidade da câmera <output id="opt-sens-out"></output></label>
          <input type="range" id="opt-sens" min="0.3" max="2.5" step="0.1">

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

          <label for="opt-camera">Câmera</label>
          <select id="opt-camera">
            <option value="terceira">Terceira pessoa</option>
            <option value="primeira">Primeira pessoa</option>
          </select>

          <label for="opt-debug">Mostrar FPS e desempenho</label>
          <input type="checkbox" id="opt-debug">
        </form>
        <div class="pause-test">
          <label for="opt-spawn">Teste: chamar dinossauro</label>
          <div class="pause-test-row">
            <select id="opt-spawn">
              ${species.map((sp) => `<option value="${sp.id}">${sp.nome}</option>`).join('')}
            </select>
            <button type="button" class="btn" id="pause-spawn">Criar perto de mim</button>
          </div>
        </div>
        <div class="pause-foot">
          <button type="button" class="btn" id="pause-menu">Voltar à tela inicial</button>
          <button type="button" class="btn" id="pause-close" hidden>Fechar o app</button>
        </div>
      </div>
    `;
    root.appendChild(el);
    this.el = el;
    const $ = (id) => el.querySelector(`#${id}`);

    this.fields = {
      quality: $('opt-quality'),
      view: $('opt-view'),
      sens: $('opt-sens'),
      opacity: $('opt-opacity'),
      size: $('opt-size'),
      touch: $('opt-touch'),
      camera: $('opt-camera'),
      debug: $('opt-debug'),
    };
    this.outs = {
      view: $('opt-view-out'),
      sens: $('opt-sens-out'),
      opacity: $('opt-opacity-out'),
      size: $('opt-size-out'),
    };

    $('pause-opts').addEventListener('submit', (e) => e.preventDefault());
    $('pause-spawn').addEventListener('click', () => onSpawnTest?.($('opt-spawn').value));
    $('pause-resume').addEventListener('click', () => onResume());
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
  }

  // Copia as opções atuais para os campos.
  refresh() {
    const v = settings.values;
    const f = this.fields;
    f.quality.value = v.quality;
    f.view.value = String(v.viewDistance);
    f.sens.value = String(v.sensitivity);
    f.opacity.value = String(v.buttonOpacity);
    f.size.value = String(v.buttonSize);
    f.touch.value = v.touchControls;
    f.camera.value = v.cameraMode;
    f.debug.checked = !!v.showDebug;
    this.outs.view.textContent = `${v.viewDistance} m`;
    this.outs.sens.textContent = Number(v.sensitivity).toFixed(1);
    this.outs.opacity.textContent = `${Math.round(v.buttonOpacity * 100)}%`;
    this.outs.size.textContent = `${Math.round(v.buttonSize * 100)}%`;
  }

  show() {
    this.refresh();
    this.el.hidden = false;
  }

  hide() {
    this.el.hidden = true;
  }

  get visible() {
    return !this.el.hidden;
  }
}
