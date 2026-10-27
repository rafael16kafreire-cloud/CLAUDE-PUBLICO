// =============================================================
// ACORDAR NO MAPA: ao entrar no jogo a tela está preta e o personagem
// "abre os olhos" (pálpebras abrindo, piscando, imagem embaçada ficando
// nítida). A tela de carregamento é outra coisa (a normal, com o círculo girando).
// =============================================================
export const OLHOS_SEG = 3.6;

export function abrirOlhos(root, { onDone } = {}) {
  const el = document.createElement('div');
  el.className = 'intro abrindo';
  el.innerHTML = `
    <div class="intro-blur"></div>
    <div class="olho olho-cima"></div>
    <div class="olho olho-baixo"></div>`;
  root.appendChild(el);
  setTimeout(() => {
    el.remove();
    onDone?.();
  }, OLHOS_SEG * 1000 + 100);
  return el;
}
