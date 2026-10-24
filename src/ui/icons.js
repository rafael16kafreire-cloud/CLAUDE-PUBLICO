// Ícones originais desenhados com formas simples (SVG).
// Usam "currentColor": a cor vem do CSS de cada barra.
const svg = (body) => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">${body}</svg>`;

export const ICONS = {
  health: svg('<path d="M12 20.5S3.6 15.6 2.6 10.2C1.9 6.6 4.2 4 7.1 4c2.1 0 3.6 1.2 4.9 3 1.3-1.8 2.8-3 4.9-3 2.9 0 5.2 2.6 4.5 6.2-1 5.4-9.4 10.3-9.4 10.3z"/>'),
  stamina: svg('<path d="M13.6 2 4.5 13.4h6.1L9.2 22l10.3-12.6h-6.3z"/>'),
  food: svg('<path d="M14.8 2.8a6.2 6.2 0 0 0-5.6 8.6l-3.6 3.6a2.4 2.4 0 1 0-1.7 4.1 2.4 2.4 0 1 0 4.1-1.7l3.6-3.6a6.2 6.2 0 1 0 3.2-11z"/>'),
  water: svg('<path d="M12 2.4S5 10.3 5 14.8a7 7 0 0 0 14 0C19 10.3 12 2.4 12 2.4z"/>'),
  oxygen: svg('<circle cx="8" cy="15" r="4.4"/><circle cx="16.5" cy="9" r="3.2"/><circle cx="17" cy="17.5" r="2"/><circle cx="9.5" cy="5.5" r="1.8"/>'),
  temperature: svg('<path d="M9.6 4.2a2.4 2.4 0 0 1 4.8 0v8.9a4.9 4.9 0 1 1-4.8 0z" fill="none" stroke="currentColor" stroke-width="1.8"/><circle class="mercury" cx="12" cy="17.2" r="2.6"/><rect class="mercury" x="11" y="8" width="2" height="9"/>'),
  pause: svg('<rect x="6" y="4.5" width="4" height="15" rx="1"/><rect x="14" y="4.5" width="4" height="15" rx="1"/>'),
};
