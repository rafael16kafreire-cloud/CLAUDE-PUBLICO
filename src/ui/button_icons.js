// =============================================================
// ÍCONES DOS BOTÕES DE TOQUE (desenhados aqui, sem cor: brancos)
// pular ⬆, agachar (pessoa ajoelhada), interagir (um dedo tocando),
// atacar (espada), correr (pessoa correndo); nadando: subir/descer.
// =============================================================
const svg = (body, stroke = false) =>
  `<svg class="tc-ico" viewBox="0 0 24 24" aria-hidden="true" fill="${stroke ? 'none' : 'currentColor'}" stroke="${stroke ? 'currentColor' : 'none'}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

export const BUTTON_ICONS = {
  // seta para cima
  jump: svg('<path d="M12 2.8 20.6 12h-5.1v9h-7v-9H3.4Z"/>'),
  // seta para baixo (nadando: descer)
  down: svg('<path d="M12 21.2 3.4 12h5.1V3h7v9h5.1Z"/>'),
  // pessoa ajoelhada
  crouch: svg('<circle cx="11.5" cy="4" r="2.2" fill="currentColor" stroke="none"/><path d="M11.5 7.6 11 13.6M11.3 9.4l3.4 2.6M11 13.6h4.6v6M11 13.6l-1.5 6.2H5.5"/>', true),
  // um dedo tocando (com o "toque" em cima)
  interact: svg('<path d="M10.1 7.4a1.6 1.6 0 0 1 3.2 0v5.2h.4v-1.4a1.5 1.5 0 0 1 3 0v1.6h.4v-.8a1.5 1.5 0 0 1 3 0v4.4c0 3.4-2.5 5.9-5.8 5.9h-1.6c-1.9 0-3.3-.9-4.3-2.4l-2.6-4a1.4 1.4 0 0 1 2.2-1.7l2.1 2.3Z"/><path d="M7.4 5.6a5.1 5.1 0 0 1 8.6 0" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>'),
  // espada
  attack: svg('<path d="M20.8 2.2h1v2.6L11.4 15.2 8.8 12.6Z"/><path d="m5.6 12.6 5.8 5.8-1.5 1.5-5.8-5.8Z"/><path d="m7.6 17.4-3.4 3.4-1.5-1.5 3.4-3.4Z"/><circle cx="3" cy="21" r="1.4"/>'),
  // pessoa correndo
  run: svg('<circle cx="15.2" cy="3.9" r="2.2" fill="currentColor" stroke="none"/><path d="M13.6 7.4 10.6 13M13.6 7.4l3.6 2.8 2.4-1.2M13.6 7.4 9.6 8.4 7.4 11.2M10.6 13l3.6 3-.9 5.2M10.6 13l-3 4.2-3.8.3"/>', true),
};
