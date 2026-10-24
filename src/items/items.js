// =============================================================
// ITENS – lista de itens (data/items/itens.json) e os desenhos
// (ícones) de cada um, feitos com formas simples em SVG.
// =============================================================
import data from '../data/items/itens.json';

export const ITEMS = Object.fromEntries(data.itens.map((it) => [it.id, it]));

export function item(id) {
  return ITEMS[id];
}

export function itemName(id) {
  return ITEMS[id]?.nome ?? id;
}

// ---------------------------------------------------------
// Ícones (SVG 48x48)
// ---------------------------------------------------------
const SHAPES = {
  tora: (a, b) => `
    <rect x="6" y="17" width="34" height="15" rx="7" fill="${a}"/>
    <path d="M10 21h22M12 27h20" stroke="${b}" stroke-width="1.6" stroke-linecap="round" opacity=".6"/>
    <ellipse cx="38" cy="24.5" rx="5" ry="7.5" fill="${b}"/>
    <ellipse cx="38" cy="24.5" rx="2.6" ry="4" fill="none" stroke="${a}" stroke-width="1.3"/>`,
  palha: (a, b) => `
    ${[10, 15, 20, 25, 30, 35].map((x, i) => `<path d="M${x} 40 L${x + (i % 2 ? 4 : -3)} 8" stroke="${a}" stroke-width="3" stroke-linecap="round"/>`).join('')}
    <rect x="9" y="24" width="30" height="5" rx="2" fill="${b}"/>`,
  pedra: (a, b) => `
    <path d="M8 33 L13 17 L26 11 L39 18 L41 32 L30 39 L15 39 Z" fill="${a}"/>
    <path d="M13 17 L26 11 L39 18 L28 22 Z" fill="${b}" opacity=".35"/>
    <path d="M26 22 L30 39" stroke="${b}" stroke-width="1.5" opacity=".5"/>`,
  silex: (a, b) => `
    <path d="M24 5 L36 22 L29 43 L16 38 L12 20 Z" fill="${a}"/>
    <path d="M24 5 L29 22 L29 43" fill="none" stroke="${b}" stroke-width="2"/>
    <path d="M12 20 L29 22" stroke="${b}" stroke-width="1.5"/>`,
  fibra: (a, b) => `
    ${[0, 1, 2, 3, 4].map((i) => `<path d="M${10 + i * 6} 42 C ${4 + i * 7} 30, ${18 + i * 5} 20, ${12 + i * 6} 6" fill="none" stroke="${i % 2 ? b : a}" stroke-width="2.6" stroke-linecap="round"/>`).join('')}`,
  couro: (a, b) => `
    <path d="M12 8 C18 12 30 12 36 8 L40 18 C36 22 38 30 41 38 L30 41 C26 37 22 37 18 41 L7 38 C10 30 12 22 8 18 Z" fill="${a}"/>
    <path d="M14 16 C20 19 28 19 34 16" stroke="${b}" stroke-width="1.5" fill="none" opacity=".6"/>`,
  osso: (a, b) => `
    <path d="M14 34 L34 14" stroke="${a}" stroke-width="7" stroke-linecap="round"/>
    <circle cx="11" cy="33" r="4.5" fill="${a}"/><circle cx="15" cy="37" r="4.5" fill="${a}"/>
    <circle cx="33" cy="11" r="4.5" fill="${a}"/><circle cx="37" cy="15" r="4.5" fill="${a}"/>
    <path d="M18 30 L30 18" stroke="${b}" stroke-width="1.4" opacity=".6"/>`,
  carne: (a, b) => `
    <path d="M8 26 C8 12 26 8 34 14 C42 20 40 34 28 38 C18 41 8 36 8 26 Z" fill="${a}"/>
    <path d="M14 26 C16 18 26 15 31 19" stroke="#e7a59c" stroke-width="2.4" fill="none"/>
    <circle cx="30" cy="27" r="4" fill="${b}"/>`,
  baga: (a, b) => `
    <path d="M24 6 C24 12 22 14 20 16" stroke="#4a6a2a" stroke-width="2" fill="none"/>
    <path d="M24 6 C28 8 32 8 34 6" stroke="#4a6a2a" stroke-width="3" fill="none" stroke-linecap="round"/>
    ${[[18, 22], [29, 21], [23, 31], [14, 32], [33, 31], [24, 40]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="6" fill="${a}"/><circle cx="${x - 2}" cy="${y - 2}" r="1.8" fill="#fff" opacity=".35"/>`).join('')}
    <circle cx="23" cy="31" r="6" fill="${b}" opacity=".35"/>`,
  fruta: (a, b) => `
    <circle cx="24" cy="27" r="14" fill="${a}"/>
    <circle cx="19" cy="22" r="4" fill="#fff" opacity=".25"/>
    <path d="M24 13 C24 9 25 7 27 5" stroke="#5a4028" stroke-width="2" fill="none"/>
    <path d="M26 9 C32 4 38 7 36 11 C32 12 28 11 26 9 Z" fill="${b}"/>`,
  banana: (a, b) => `
    <path d="M10 14 C10 32 22 42 40 36 C36 34 34 32 34 30 C22 32 16 24 16 12 Z" fill="${a}"/>
    <path d="M14 18 C16 28 22 33 32 33" stroke="#fff" stroke-width="1.5" fill="none" opacity=".35"/>
    <path d="M10 14 L13 9 L17 12" fill="${b}"/>`,
  bandagem: (a, b) => `
    <rect x="8" y="14" width="32" height="20" rx="4" fill="${a}"/>
    <path d="M14 14 V34 M34 14 V34" stroke="#cfc8b0" stroke-width="1.5"/>
    <rect x="21" y="18" width="6" height="12" fill="${b}"/><rect x="18" y="21" width="12" height="6" fill="${b}"/>`,
  pote: (a, b) => `
    <path d="M13 18 H35 L33 38 Q24 42 15 38 Z" fill="${b}"/>
    <ellipse cx="24" cy="18" rx="11" ry="4" fill="${a}"/>
    <path d="M17 26 Q24 29 31 26" stroke="#00000040" stroke-width="2" fill="none"/>`,
  machado: (a, b) => `
    <path d="M15 42 L31 10" stroke="${a}" stroke-width="4.5" stroke-linecap="round"/>
    <path d="M27 8 C34 4 42 8 42 16 C38 16 34 17 31 20 Z" fill="${b}"/>
    <path d="M27 14 L33 17" stroke="#5a4a38" stroke-width="3"/>`,
  picareta: (a, b) => `
    <path d="M14 42 L30 14" stroke="${a}" stroke-width="4.5" stroke-linecap="round"/>
    <path d="M10 14 C18 6 32 4 42 10 C34 10 26 12 30 16 C24 14 18 14 10 14 Z" fill="${b}"/>
    <path d="M28 12 L32 15" stroke="#5a4a38" stroke-width="3"/>`,
  lanca: (a, b) => `
    <path d="M9 40 L33 14" stroke="${a}" stroke-width="3.5" stroke-linecap="round"/>
    <path d="M31 9 L41 5 L37 16 L32 18 L30 14 Z" fill="${b}"/>
    <path d="M28 18 L33 21" stroke="#6a8a3a" stroke-width="3"/>`,
  clava: (a, b) => `
    <path d="M12 42 L26 20" stroke="${a}" stroke-width="5" stroke-linecap="round"/>
    <path d="M22 22 C20 12 28 4 36 8 C42 12 40 22 30 26 Z" fill="${b}"/>
    <circle cx="33" cy="12" r="2" fill="#2e2216"/><circle cx="29" cy="19" r="1.8" fill="#2e2216"/>`,
};

const iconCache = {};
export function itemIcon(id) {
  if (iconCache[id]) return iconCache[id];
  const it = ITEMS[id];
  const ic = it?.icone ?? { forma: 'pedra', cor: '#888', cor2: '#555' };
  const draw = SHAPES[ic.forma] ?? SHAPES.pedra;
  iconCache[id] = `<svg viewBox="0 0 48 48" aria-hidden="true">${draw(ic.cor, ic.cor2 ?? ic.cor)}</svg>`;
  return iconCache[id];
}
