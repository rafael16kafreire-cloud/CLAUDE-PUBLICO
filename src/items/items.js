// =============================================================
// ITENS – lista de itens (data/items/itens.json) e os desenhos
// (ícones) de cada um, feitos com formas simples em SVG.
// =============================================================
import data from '../data/items/itens.json';
import PLACEHOLDER_ICONS from 'virtual:icones-provisorios';

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
  casaco: (a, b) => `
    <path d="M17 8 L24 12 L31 8 L41 14 L38 24 L34 22 L34 41 L14 41 L14 22 L10 24 L7 14 Z" fill="${a}"/>
    <path d="M17 8 L24 12 L31 8 L29 14 L24 16 L19 14 Z" fill="${b}"/>
    <path d="M24 16 V41" stroke="${b}" stroke-width="1.6" opacity=".7"/>`,
  piso: (a, b) => `
    <path d="M24 12 L44 22 L24 32 L4 22 Z" fill="${a}"/>
    <path d="M4 22 L24 32 L24 37 L4 27 Z M44 22 L24 32 L24 37 L44 27 Z" fill="${b}"/>
    <path d="M14 17 L34 27 M19 14.5 L39 24.5 M9 19.5 L29 29.5" stroke="${b}" stroke-width="1.2" opacity=".7"/>`,
  parede: (a, b) => `
    <rect x="8" y="9" width="32" height="30" rx="1.5" fill="${a}"/>
    <path d="M8 16.5h32M8 24h32M8 31.5h32" stroke="${b}" stroke-width="1.6"/>`,
  porta: (a, b) => `
    <rect x="8" y="9" width="32" height="30" rx="1.5" fill="${a}"/>
    <rect x="18" y="16" width="12" height="23" fill="${b}"/>
    <circle cx="27" cy="28" r="1.4" fill="${a}"/>`,
  teto: (a, b) => `
    <path d="M24 8 L44 24 L4 24 Z" fill="${a}"/>
    <path d="M10 24 L10 40 M38 24 L38 40" stroke="${b}" stroke-width="3"/>
    <path d="M14 19 L34 19 M18 15 L30 15" stroke="${b}" stroke-width="1.3" opacity=".6"/>`,
  rampa: (a, b) => `
    <path d="M6 40 L42 12 L42 40 Z" fill="${a}"/>
    <path d="M14 34 L18 37 M22 28 L26 31 M30 22 L34 25 M38 16 L41 18" stroke="${b}" stroke-width="2.2" stroke-linecap="round"/>`,
  graveto: (a, b) => `
    <path d="M7 38 L41 12" stroke="${a}" stroke-width="4.5" stroke-linecap="round"/>
    <path d="M10 30 L37 22" stroke="${b}" stroke-width="3.2" stroke-linecap="round"/>
    <path d="M26 24 L31 13 M18 33 L15 26" stroke="${a}" stroke-width="2.2" stroke-linecap="round"/>`,
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
  bancada: (a, b) => `
    <rect x="6" y="16" width="36" height="7" rx="2" fill="${a}"/>
    <rect x="9" y="23" width="5" height="18" fill="${a}"/><rect x="34" y="23" width="5" height="18" fill="${a}"/>
    <rect x="9" y="31" width="30" height="3" fill="${a}" opacity=".8"/>
    <path d="M14 14 L20 6 L24 9 L18 16 Z" fill="${b}"/>
    <rect x="27" y="10" width="10" height="6" rx="1.5" fill="${b}"/>`,
  fogueira: (a, b) => `
    <ellipse cx="24" cy="38" rx="17" ry="5" fill="${b}"/>
    <path d="M12 38 L36 30 M12 30 L36 38" stroke="#6a4a2a" stroke-width="4" stroke-linecap="round"/>
    <path d="M24 8 C30 16 34 22 30 30 C28 34 20 34 18 30 C14 22 20 18 24 8 Z" fill="${a}"/>
    <path d="M24 18 C27 23 28 26 26 30 C24 32 22 31 21 29 C20 25 22 22 24 18 Z" fill="#f8d860"/>`,
  saco: (a, b) => `
    <rect x="6" y="18" width="36" height="16" rx="8" fill="${a}"/>
    <rect x="30" y="16" width="12" height="20" rx="6" fill="${b}"/>
    <path d="M10 22 H28 M10 30 H28" stroke="#00000030" stroke-width="2"/>`,
  tocha: (a, b) => `
    <path d="M17 42 L28 18" stroke="${a}" stroke-width="5" stroke-linecap="round"/>
    <path d="M30 4 C36 10 38 16 33 21 C30 23 25 22 25 18 C24 13 28 10 30 4 Z" fill="${b}"/>
    <path d="M30 11 C32 14 32 17 30 19 C28 19 27 17 28 15 Z" fill="#f8e070"/>`,
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
  pilao: (a, b) => `
    <path d="M8 22 H40 L36 40 H12 Z" fill="${a}"/>
    <ellipse cx="24" cy="22" rx="16" ry="4.5" fill="${b}"/>
    <path d="M30 22 L40 6" stroke="${b}" stroke-width="5" stroke-linecap="round"/>
    <path d="M30 22 L40 6" stroke="${a}" stroke-width="2.4" stroke-linecap="round" opacity=".6"/>`,
  arco: (a, b) => `
    <path d="M14 6 C34 12 34 36 14 42" fill="none" stroke="${a}" stroke-width="4" stroke-linecap="round"/>
    <path d="M14 6 L14 42" stroke="${b}" stroke-width="1.4"/>
    <path d="M10 24 H38" stroke="#7a5a3a" stroke-width="2"/><path d="M38 24 L33 21 M38 24 L33 27" stroke="#8a8a90" stroke-width="2.2"/>`,
  flecha: (a, b) => `
    <path d="M8 40 L36 12" stroke="${a}" stroke-width="2.8" stroke-linecap="round"/>
    <path d="M36 12 L42 5 L40 14 Z M36 12 L42 5 L33 7 Z" fill="${b}"/>
    <path d="M8 40 L5 35 M8 40 L13 43 M12 36 L9 31 M12 36 L17 39" stroke="#e8e0c8" stroke-width="2"/>`,
  cantil: (a, b) => `
    <path d="M24 6 h4 v6 h-4 Z" fill="#5a4430"/>
    <path d="M14 18 C14 12 34 12 34 18 L36 36 C36 44 12 44 12 36 Z" fill="${a}"/>
    <path d="M15 30 C20 34 28 34 33 30 L34 36 C34 41 14 41 14 36 Z" fill="${b}" opacity=".85"/>
    <path d="M18 12 C14 8 34 8 30 12" fill="none" stroke="#5a4430" stroke-width="2"/>`,
  bau: (a, b) => `
    <rect x="6" y="18" width="36" height="22" rx="2" fill="${a}"/>
    <path d="M6 18 C6 9 42 9 42 18 Z" fill="${b}"/>
    <path d="M14 12 V40 M34 12 V40" stroke="#6a6e74" stroke-width="2.6"/>
    <rect x="21" y="18" width="6" height="7" rx="1" fill="#c8b070"/>`,
  forja: (a, b) => `
    <path d="M10 42 L12 18 C12 10 36 10 36 18 L38 42 Z" fill="${a}"/>
    <rect x="20" y="4" width="8" height="10" fill="#4a4642"/>
    <path d="M17 42 V32 C17 26 31 26 31 32 V42 Z" fill="#2e2a26"/>
    <path d="M24 40 C19 36 22 31 24 29 C26 32 29 35 24 40 Z" fill="${b}"/>`,
  lingote: (a, b) => `
    <path d="M6 32 L14 20 H40 L42 32 Z" fill="${a}"/>
    <path d="M6 32 H42 L40 38 H8 Z" fill="${b}"/>
    <path d="M14 20 L16 26 H38 L40 20" fill="none" stroke="#e8ecf2" stroke-width="1.4" opacity=".7"/>`,
  sela: (a, b) => `
    <path d="M6 24 C10 14 38 14 42 24 C38 30 10 30 6 24 Z" fill="${a}"/>
    <path d="M14 20 C16 12 22 12 24 18 C26 12 32 12 34 20" fill="${b}"/>
    <path d="M16 28 V40 M32 28 V40" stroke="#5a4430" stroke-width="2.4"/>
    <circle cx="16" cy="41" r="2.6" fill="none" stroke="#8a8a90" stroke-width="1.8"/><circle cx="32" cy="41" r="2.6" fill="none" stroke="#8a8a90" stroke-width="1.8"/>`,
  capuz: (a, b) => `
    <path d="M10 36 C8 14 40 14 38 36 L34 40 C32 30 16 30 14 40 Z" fill="${a}"/>
    <path d="M16 36 C18 28 30 28 32 36 C28 33 20 33 16 36 Z" fill="${b}"/>`,
  luvas: (a, b) => `
    <path d="M10 40 V22 C10 18 14 18 14 22 V14 C14 10 18 10 18 14 V12 C18 8 22 8 22 12 V22 L26 18 C28 16 31 19 29 22 L24 34 V40 Z" fill="${a}"/>
    <rect x="9" y="36" width="16" height="6" rx="1" fill="${b}"/>
    <path d="M26 40 V24 C26 20 30 20 30 24 V16 C30 12 34 12 34 16 V20 C34 16 38 16 38 20 V34 L36 40 Z" fill="${a}" opacity=".85"/>`,
  calca: (a, b) => `
    <path d="M12 6 H36 L38 42 H28 L24 18 L20 42 H10 Z" fill="${a}"/>
    <rect x="12" y="6" width="24" height="5" fill="${b}"/>`,
  botas: (a, b) => `
    <path d="M8 8 H20 V30 L30 32 C34 33 34 40 30 40 H8 Z" fill="${a}"/>
    <path d="M8 36 H32 V40 H8 Z" fill="${b}"/>
    <path d="M24 10 H34 V28 L42 30 C45 31 44 37 41 37 H34" fill="${a}" opacity=".7"/>`,

};

const iconCache = {};
export function itemIcon(id) {
  if (iconCache[id]) return iconCache[id];
  // ícone provisório (PNG da pasta assets/icons/placeholder_ark), se tiver
  if (PLACEHOLDER_ICONS[id]) {
    iconCache[id] = `<img class="item-png" src="${PLACEHOLDER_ICONS[id]}" alt="" draggable="false">`;
    return iconCache[id];
  }
  const it = ITEMS[id];
  const ic = it?.icone ?? { forma: 'pedra', cor: '#888', cor2: '#555' };
  const draw = SHAPES[ic.forma] ?? SHAPES.pedra;
  iconCache[id] = `<svg viewBox="0 0 48 48" aria-hidden="true">${draw(ic.cor, ic.cor2 ?? ic.cor)}</svg>`;
  return iconCache[id];
}
