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
        <p class="eyebrow">Protótipo · Fase 1: mundo e jogador</p>
        <h1 class="title">Ilha<br>Primordial</h1>
        <p class="tagline">Você acordou numa praia sem nada. Ache água doce antes que a sede vença.</p>
        <button type="button" class="btn btn-primary btn-play" id="btn-play" disabled>Gerando a ilha…</button>
        <p class="rotate-hint">Vire o celular na horizontal para jogar melhor.</p>
        <dl class="howto howto-touch">
          <dt>Andar</dt><dd>joystick à esquerda</dd>
          <dt>Olhar</dt><dd>arraste o lado direito</dd>
          <dt>Beber</dt><dd>perto do lago, botão Interagir</dd>
        </dl>
        <dl class="howto howto-desktop">
          <dt>WASD</dt><dd>andar</dd>
          <dt>Mouse</dt><dd>olhar (clique para prender o mouse)</dd>
          <dt>Espaço / Shift</dt><dd>pular / correr</dd>
          <dt>C / E</dt><dd>agachar / interagir (beber)</dd>
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
