// =============================================================
// TELA DE CARREGAMENTO (aparece ao clicar em Entrar, enquanto a ilha é gerada)
// Tudo é animado só com CSS (anel girando, ondas e barra), porque o JavaScript
// fica ocupado gerando a ilha e não consegue mexer na tela nesse tempo.
// =============================================================
const TIPS = [
  'Bata nas árvores para pegar palha e madeira.',
  'Abaixado, os predadores te veem menos.',
  'Água doce: o pântano e os córregos da mata.',
  'Metal e cristal saem das rochas da Serra Rochosa.',
  'Domar: derrube o bicho e dê a comida que ele gosta.',
  'Construa uma fogueira antes de a noite chegar.',
];

export class LoadingScreen {
  constructor(root) {
    const el = document.createElement('div');
    el.className = 'loading-screen';
    el.hidden = true;
    el.innerHTML = `
      <div class="ld-center">
        <svg class="ld-anel" viewBox="0 0 120 120" aria-hidden="true">
          <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(127,227,255,0.18)" stroke-width="4"/>
          <circle class="ld-arco" cx="60" cy="60" r="52" fill="none" stroke="#7fe3ff" stroke-width="4" stroke-linecap="round" stroke-dasharray="70 257"/>
        </svg>
        <div class="ld-titulo">Gerando a ilha…</div>
        <div class="ld-etapas" aria-hidden="true">
          <span>Erguendo as montanhas</span><span>Plantando a floresta</span><span>Enchendo o mar e o pântano</span><span>Soltando os dinossauros</span>
        </div>
        <div class="ld-barra" aria-hidden="true"><i></i></div>
        <div class="ld-ondas" aria-hidden="true"><svg viewBox="0 0 660 24"><path d="M0 12 q15 -10 30 0 t30 0 q15 -10 30 0 t30 0 q15 -10 30 0 t30 0 q15 -10 30 0 t30 0 q15 -10 30 0 t30 0 q15 -10 30 0 t30 0 q15 -10 30 0 t30 0 q15 -10 30 0 t30 0 q15 -10 30 0 t30 0 q15 -10 30 0 t30 0 q15 -10 30 0 t30 0" fill="none" stroke="#3f9393" stroke-width="3" stroke-linecap="round"/></svg></div>
        <p class="ld-dica"></p>
      </div>`;
    root.appendChild(el);
    this.el = el;
    this.tip = el.querySelector('.ld-dica');
  }

  show() {
    this.tip.textContent = `Dica: ${TIPS[Math.floor(Math.random() * TIPS.length)]}`;
    this.el.hidden = false;
    this.el.classList.remove('sai');
  }

  // some com um fade rápido
  hide() {
    this.el.classList.add('sai');
    setTimeout(() => { this.el.hidden = true; }, 350);
  }
}
