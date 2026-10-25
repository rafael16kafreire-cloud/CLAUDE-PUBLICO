// =============================================================
// TELA INICIAL – título, botão Jogar e resumo dos controles.
// Atrás dela, a câmera sobrevoa a ilha de verdade.
// (Menu completo com Novo Jogo/Continuar/Opções/Créditos: Fase 12.)
// =============================================================

export class StartScreen {
  constructor(root, { onPlay, onHost, onJoin, onNewGame, playerName = '' }) {
    const el = document.createElement('div');
    el.className = 'overlay start';
    el.innerHTML = `
      <div class="start-panel">
        <p class="eyebrow">Protótipo · v0.9.0 · sobreviver, domar e construir</p>
        <h1 class="title">Ilha<br>Primordial</h1>
        <p class="tagline">Você acordou na beira da mata sem nada. Pegue madeira, crie ferramentas e sobreviva aos predadores da floresta.</p>
        <button type="button" class="btn btn-primary btn-play" id="btn-play" disabled>Gerando a ilha…</button>
        <button type="button" class="btn btn-small btn-new" id="btn-new" hidden>Novo jogo (apaga o salvo)</button>
        <div class="coop-box">
          <label class="coop-name">Seu nome <input id="coop-name" maxlength="16" autocomplete="off" placeholder="Jogador"></label>
          <div class="coop-row">
            <button type="button" class="btn" id="btn-host" disabled>Criar partida co-op</button>
            <button type="button" class="btn" id="btn-join-open" disabled>Entrar com código</button>
          </div>
          <div class="coop-row" id="coop-join" hidden>
            <input id="coop-code" maxlength="6" autocomplete="off" placeholder="CÓDIGO" inputmode="text" autocapitalize="characters">
            <button type="button" class="btn btn-primary" id="btn-join">Entrar</button>
          </div>
          <p class="coop-status" id="coop-status">Co-op: até 4 jogadores pela internet.</p>
        </div>
        <p class="rotate-hint">Vire o celular na horizontal para jogar melhor.</p>
        <p class="credits">Modelo do espinossauro: “Spinosaurus” por TheAquaticSpinosaurid (Sketchfab), CC-BY 4.0 — adaptado.</p>
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
    this.newButton = el.querySelector('#btn-new');
    this.newButton.addEventListener('click', () => {
      // eslint-disable-next-line no-alert
      if (window.confirm('Começar um jogo novo? O jogo salvo (casa, bichos domados, itens) será apagado.')) onNewGame?.();
    });
    const $ = (id) => el.querySelector(`#${id}`);
    this.nameInput = $('coop-name');
    this.nameInput.value = playerName;
    this.status = $('coop-status');
    this.coopButtons = [$('btn-host'), $('btn-join-open'), $('btn-join')];
    $('btn-host').addEventListener('click', () => onHost?.(this.playerName));
    $('btn-join-open').addEventListener('click', () => {
      $('coop-join').hidden = false;
      $('coop-code').focus();
    });
    const doJoin = () => onJoin?.($('coop-code').value, this.playerName);
    $('btn-join').addEventListener('click', doJoin);
    $('coop-code').addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') doJoin();
    });
    this.nameInput.addEventListener('keydown', (e) => e.stopPropagation());
    $('coop-code').addEventListener('input', (e) => {
      e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    });
  }

  get playerName() {
    return this.nameInput.value.trim().slice(0, 16) || 'Jogador';
  }

  setStatus(text, kind = '') {
    this.status.textContent = text;
    this.status.dataset.kind = kind;
  }

  setCoopBusy(busy) {
    for (const b of this.coopButtons) b.disabled = busy;
    this.button.disabled = busy;
  }

  setLoading(text) {
    this.button.disabled = true;
    this.button.textContent = text;
  }

  setReady(label = 'Jogar sozinho', canStartNew = false) {
    this.button.disabled = false;
    this.button.textContent = label;
    this.newButton.hidden = !canStartNew;
    for (const b of this.coopButtons) b.disabled = false;
  }

  show() {
    this.el.hidden = false;
  }

  hide() {
    this.el.hidden = true;
  }
}
