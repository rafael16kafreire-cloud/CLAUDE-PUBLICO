// =============================================================
// ENTRADA NO JOGO: tela preta com a logo por um tempinho e depois o
// personagem "abre os olhos" (pálpebras abrindo, piscando, imagem
// embaçada ficando nítida). Sem barra de progresso.
// =============================================================
const LOGO_MS = 1900;     // logo na tela preta
const FADE_MS = 500;      // logo some
const OLHOS_MS = 3600;    // olhos abrindo

const CSS_ID = 'intro-css';

export function playIntro(root, { onStart, onDone }) {
  const el = document.createElement('div');
  el.className = 'intro';
  el.innerHTML = `
    <div class="intro-blur"></div>
    <div class="intro-logo">
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle cx="60" cy="60" r="52" fill="none" stroke="currentColor" stroke-width="2.5" opacity="0.8"/>
        <circle cx="60" cy="60" r="44" fill="none" stroke="currentColor" stroke-width="1" opacity="0.4"/>
        <path d="M38 24 L58 94" stroke="currentColor" stroke-width="7" stroke-linecap="round"/>
        <path d="M56 20 L74 98" stroke="currentColor" stroke-width="7" stroke-linecap="round"/>
        <path d="M76 24 L90 90" stroke="currentColor" stroke-width="7" stroke-linecap="round"/>
      </svg>
      <div class="intro-nome">ILHA PRIMORDIAL</div>
    </div>
    <div class="olho olho-cima"></div>
    <div class="olho olho-baixo"></div>`;
  root.appendChild(el);
  void el.offsetWidth; // aplica o estado inicial antes de animar
  el.classList.add('logo-in');
  setTimeout(() => el.classList.add('logo-out'), LOGO_MS);
  setTimeout(() => {
    el.classList.add('abrindo');
    onStart?.();
  }, LOGO_MS + FADE_MS);
  setTimeout(() => {
    el.remove();
    onDone?.();
  }, LOGO_MS + FADE_MS + OLHOS_MS + 100);
  return el;
}
