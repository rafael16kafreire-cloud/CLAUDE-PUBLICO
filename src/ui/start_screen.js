// =============================================================
// TELA INICIAL – título, botão Jogar e resumo dos controles.
// Atrás dela, a câmera sobrevoa a ilha de verdade.
// (Menu completo com Novo Jogo/Continuar/Opções/Créditos: Fase 12.)
// =============================================================
import { IMPORTED } from '../creatures/imported_model.js';
import criaturas from '../data/creatures/criaturas.json';
import { listSlots, slotLabel } from '../core/save.js';

const SPECIES = Object.fromEntries(criaturas.especies.map((e) => [e.id, e]));

// "Fulano (https://sketchfab.com/...)" -> "Fulano"
const authorName = (a = '') => a.replace(/\s*\(.*\)\s*$/, '');
const esc = (t = '') => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const PLANT_CREDITS = [
  ['Palmeira', 'Palm Tree Realistic', '00amza'],
  ['Tamareiras e plantas da praia', 'Date palm and vegetation', 'borsh_and'],
  ['Árvores folhosas e capim', 'Low Poly Tree Scene Free', 'Nicholas-3D'],
  ['Folhagem do chão da floresta', 'Grass', 'Epic_Tree_Store'],
  ['Árvore alta da mata', 'Agarwood', 'Valery.Li'],
  ['Arbustos de bagas', 'Bush with Berries', 'ivanmm1'],
  ['Troncos caídos', 'Mossy old tree log / Fallen Spruce Tree', 'autores no Sketchfab'],
];

// Créditos dos modelos 3D (licença CC-BY pede o nome do autor)
function creditsHtml() {
  const rows = Object.entries(IMPORTED).map(([id, d]) => {
    const c = d.credito ?? {};
    const lic = (c.licenca ?? '').split(' ')[0];
    return `<li><b>${esc(SPECIES[id]?.nome ?? id)}</b>: “${esc(c.titulo)}” por ${esc(authorName(c.autor))} (Sketchfab), ${esc(lic)} — adaptado.</li>`;
  });
  // plantas da praia e da floresta (também CC-BY 4.0)
  for (const [what, title, author] of PLANT_CREDITS) {
    rows.push(`<li><b>${esc(what)}</b>: “${esc(title)}” por ${esc(author)} (Sketchfab), CC-BY-4.0 — adaptado.</li>`);
  }
  rows.push('<li><b>Sons de passos, coleta e interface</b>: Kenney.nl (CC0).</li>');
  // bibliotecas de efeitos visuais (as licenças pedem manter o aviso)
  rows.push('<li><b>Motor 3D</b>: three.js (MIT), © os autores do three.js.</li>');
  rows.push('<li><b>Efeitos de imagem</b>: postprocessing, © Raoul van Rüschen (Zlib).</li>');
  rows.push('<li><b>Raios de sol</b>: three-good-godrays, © 2022 Casey Primozic, adaptado de goodGodRays de n8python (Zlib).</li>');
  rows.push('<li><b>Oclusão ambiental</b>: N8AO, de n8python (licença livre: CC0 no arquivo, ISC no npm).</li>');
  return `<div class="credits"><p>Modelos 3D e sons usados no jogo (licença pede o nome do autor):</p><ul>${rows.join('')}</ul></div>`;
}

// Dicas que vão passando embaixo do botão Jogar
const TIPS = [
  'Metal e cristal saem das rochas da Serra Rochosa: leve uma picareta.',
  'Mergulhe no mar raso: as conchas do fundo têm pérolas de sílica.',
  'Paredes de pedra só quebram com bicho grande; de metal, só com gigante.',
  'Macho e fêmea domados, parados perto um do outro, têm filhote.',
  'Ovo precisa de calor para chocar: uma fogueira perto ajuda no frio.',
  'Filhote domado pede carinho: cada cuidado deixa ele mais forte.',
  'Cada bicho usa a sela do seu porte: Pequena, Média ou Grande.',
  'Carne estraga: guarde no baú para durar mais.',
  'Ao subir de nível você ganha pontos para aprender receitas novas.',
  'A luneta deixa ver longe: segure e use Atacar para aproximar.',
];

export class StartScreen {
  constructor(root, { onPlay, onHost, onJoin, onNewGame, onLoadSlot, playerName = '' }) {
    const el = document.createElement('div');
    el.className = 'overlay start';
    el.innerHTML = `
      <div class="start-panel">
        <svg class="start-logo" viewBox="0 0 1280 560" role="img" aria-label="ISLA">
          <defs>
            <linearGradient id="lg-laranja" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f58a3e"/><stop offset="1" stop-color="#d23a1c"/></linearGradient>
            <linearGradient id="lg-fade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.45"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
            <mask id="lg-mask"><rect x="150" y="392" width="1000" height="120" fill="url(#lg-fade)"/></mask>
            <g id="lg-letras">
              <rect x="217" y="112" width="55" height="263" fill="#e8dcc2"/>
              <path d="M380 112H507V168H418L410 176V200L426 216H507L534 243V334L492 375H381L353 348V320H466L478 308V284L466 272H396L353 229V139Z" fill="#e8dcc2"/>
              <path d="M616 112H671V320H779V375H616Z" fill="#e8dcc2"/>
              <path d="M863 375L945 112H992L1074 375Z" fill="#e8dcc2"/>
              <path d="M926 375L967 247L1008 375Z" fill="url(#lg-laranja)"/>
              <path d="M960 112H975L967 130Z" fill="#f58a3e"/>
            </g>
          </defs>
          <use href="#lg-letras"/>
          <path d="M185 383 q15 -12 30 0 t30 0 q15 -12 30 0 t30 0 q15 -12 30 0 t30 0 q15 -12 30 0 t30 0 q15 -12 30 0 t30 0 q15 -12 30 0 t30 0 q15 -12 30 0 t30 0 q15 -12 30 0 t30 0 q15 -12 30 0 t30 0 q15 -12 30 0 t30 0 q15 -12 30 0 t30 0 q15 -12 30 0 t30 0 q15 -12 30 0 t30 0 q15 -12 30 0 t30 0 q15 -12 30 0 t30 0 q15 -12 30 0 t30 0 q15 -12 30 0 t30 0 q15 -12 30 0 t30 0 q15 -12 30 0 t30 0 q15 -12 30 0 t30 0 q15 -12 30 0 t30 0 q15 -12 30 0 t30 0 q15 -12 30 0 t30 0 q15 -12 30 0 t30 0 q15 -12 30 0 t30 0 q15 -12 30 0 t30 0 q15 -12 30 0 t30 0 q15 -12 30 0 t30 0 q15 -12 30 0 t30 0 q15 -12 30 0 t30 0 q15 -12 30 0 t30 0" fill="none" stroke="#3f9393" stroke-width="8" stroke-linecap="round"/>
          <g mask="url(#lg-mask)"><use href="#lg-letras" transform="translate(0 780) scale(1 -1)"/></g>
        </svg>
        <div class="logo-carga" aria-hidden="true"><svg viewBox="0 0 120 120"><circle class="logo-anel" cx="60" cy="60" r="52" fill="none" stroke="currentColor" stroke-width="3" stroke-dasharray="60 267" stroke-linecap="round"/></svg></div>
        <div class="start-menu">
          <button type="button" class="menu-item" id="btn-play" disabled>Gerando a ilha…</button>
          <nav class="menu-tabs" role="tablist">
            <button type="button" class="menu-tab" id="tab-coop" data-page="coop">Co-op</button>
            <button type="button" class="menu-tab" id="tab-ajuda" data-page="ajuda">Guia de sobrevivência</button>
            <button type="button" class="menu-tab" id="tab-creditos" data-page="creditos">Créditos</button>
          </nav>
        </div>
        <p class="eyebrow">v${typeof __VERSION__ !== 'undefined' ? __VERSION__ : ''}</p>
        <section class="menu-page" data-page="jogar">
        <button type="button" class="btn btn-small btn-new" id="btn-new" hidden>Novo jogo (apaga o salvo)</button>
        <details class="load-box" id="load-box" hidden><summary>Carregar jogo salvo</summary><div class="save-list" id="start-slots"></div></details>
        <p class="menu-tip" id="menu-tip"></p>
        </section>
        <section class="menu-page" data-page="coop" hidden>
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
        </section>
        <section class="menu-page" data-page="ajuda" hidden>
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
          <dt>Q</dt><dd>trocar munição (arco)</dd>
        </dl>
        </section>
        <section class="menu-page" data-page="creditos" hidden>${creditsHtml()}</section>
      </div>
    `;
    root.appendChild(el);
    this.el = el;
    // abas do menu (a página nova entra deslizando)
    const tabs = [...el.querySelectorAll('.menu-tab')];
    const pages = [...el.querySelectorAll('.menu-page')];
    for (const t of tabs) {
      t.addEventListener('click', () => {
        // clicar de novo no mesmo item volta para a página inicial (dica e jogos salvos)
        const ja = t.getAttribute('aria-selected') === 'true';
        for (const o of tabs) o.setAttribute('aria-selected', String(!ja && o === t));
        const alvo = ja ? 'jogar' : t.dataset.page;
        for (const pg of pages) pg.hidden = pg.dataset.page !== alvo;
      });
    }
    // dicas passando
    const tip = el.querySelector('#menu-tip');
    let k = Math.floor(Math.random() * TIPS.length);
    const nextTip = () => {
      tip.classList.remove('show');
      setTimeout(() => {
        tip.textContent = `Dica: ${TIPS[k++ % TIPS.length]}`;
        tip.classList.add('show');
      }, 250);
    };
    nextTip();
    this._tipTimer = setInterval(() => { if (!el.hidden) nextTip(); }, 6000);
    this.button = el.querySelector('#btn-play');
    this.button.addEventListener('click', () => onPlay());
    this.onLoadSlot = onLoadSlot;
    this._renderSlots();
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

  // Espaços salvos (Salvar no menu de pausa)
  _renderSlots() {
    const slots = listSlots();
    const box = this.el.querySelector('#load-box');
    box.hidden = slots.every((m) => m.empty);
    this.el.querySelector('#start-slots').innerHTML = slots.filter((m) => !m.empty).map((m) => `
      <div class="save-row"><span class="save-label">${slotLabel(m)}</span>
      <button type="button" class="btn btn-small" data-load="${m.n}">Carregar</button></div>`).join('');
    this.el.querySelectorAll('#start-slots [data-load]').forEach((b) => b.addEventListener('click', () => this.onLoadSlot?.(Number(b.dataset.load))));
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
    this.el.classList.add('carregando');
    const giro = document.createElement('span');
    giro.className = 'girando';
    this.button.replaceChildren(giro, document.createTextNode(text));
  }

  setReady(label = 'Jogar sozinho', canStartNew = false) {
    this._renderSlots();
    this.el.classList.remove('carregando');
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
