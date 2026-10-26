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
  // mochila (inventário), martelo (construir), sela (montar), estrela (engramas)
  backpack: svg('<path d="M9 3.5h6a1 1 0 0 1 1 1V6h1.5A2.5 2.5 0 0 1 20 8.5V19a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8.5A2.5 2.5 0 0 1 6.5 6H8V4.5a1 1 0 0 1 1-1zm.8 1.6V6h4.4v-.9zM7 11.5v2h10v-2zm3 4v3h4v-3z"/>'),
  hammer: svg('<path d="M3.5 6.2 8.2 2l3.4 2.6 1.6-1.4 2.3 2.4-1.5 1.4L21 14l-2.6 2.6-7-6.9-1.5 1.5-2.4-2.3 1.4-1.6zm7 6.5 2.6 2.6-6.6 6.6a1.8 1.8 0 0 1-2.6-2.6z"/>'),
  saddle: svg('<path d="M3 11.5c2-4.5 16-4.5 18 0-.5 2-3 3-9 3s-8.5-1-9-3zm4-4c.6-2.4 3-3 5-1.2 2-1.8 4.4-1.2 5 1.2-2.6-.8-7.4-.8-10 0zM8 14.6h1.6V20H8zm6.4 0H16V20h-1.6z"/>'),
  engram: svg('<path d="M12 2.5 14.6 9H21l-5.2 4 2 6.5L12 15.6l-5.8 3.9 2-6.5L3 9h6.4z"/>'),
  pause: svg('<rect x="6" y="4.5" width="4" height="15" rx="1"/><rect x="14" y="4.5" width="4" height="15" rx="1"/>'),
};
