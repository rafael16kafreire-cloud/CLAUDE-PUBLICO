// =============================================================
// TELA INICIAL – título, botão Jogar e resumo dos controles.
// Atrás dela, a câmera sobrevoa a ilha de verdade.
// (Menu completo com Novo Jogo/Continuar/Opções/Créditos: Fase 12.)
// =============================================================

export class StartScreen {
  constructor(root, { onPlay }) {
    const el = document.createElement('div');
    el.className = 'overlay start';
    el.innerHTML = `
      <div class="start-panel">
        <p class="eyebrow">Protótipo · v0.3 · floresta, coleta e crafting</p>
        <h1 class="title">Ilha<br>Primordial</h1>
        <p class="tagline">Você acordou na beira da mata sem nada. Pegue madeira, crie ferramentas e sobreviva aos predadores da floresta.</p>
        <button type="button" class="btn btn-primary btn-play" id="btn-play" disabled>Gerando a ilha…</button>
        <p class="rotate-hint">Vire o celular na horizontal para jogar melhor.</p>
        <dl class="howto howto-touch">
          <dt>Andar</dt><dd>joystick à esquerda</dd>
          <dt>Olhar</dt><dd>arraste o lado direito</dd>
          <dt>Coletar</dt><dd>bata com Atacar (madeira, palha, pedra)</dd>
          <dt>Colher / beber</dt><dd>botão Interagir</dd>
          <dt>Criar</dt><dd>botão Inventário → aba Criar</dd>
        </dl>
        <dl class="howto howto-desktop">
          <dt>WASD</dt><dd>andar</dd>
          <dt>Mouse</dt><dd>olhar (clique para prender o mouse)</dd>
          <dt>Espaço / Shift</dt><dd>pular / correr</dd>
          <dt>C / E</dt><dd>agachar / interagir (colher, beber)</dd>
          <dt>Clique</dt><dd>bater (coleta e ataque)</dd>
          <dt>Tab / I · 1–8</dt><dd>inventário e crafting · barra rápida</dd>
          <dt>V / F3 / Esc</dt><dd>câmera / FPS / pausa</dd>
        </dl>
      </div>
    `;
    root.appendChild(el);
    this.el = el;
    this.button = el.querySelector('#btn-play');
    this.button.addEventListener('click', () => onPlay());
  }

  setLoading(text) {
    this.button.disabled = true;
    this.button.textContent = text;
  }

  setReady(label = 'Jogar') {
    this.button.disabled = false;
    this.button.textContent = label;
  }

  show() {
    this.el.hidden = false;
  }

  hide() {
    this.el.hidden = true;
  }
}
