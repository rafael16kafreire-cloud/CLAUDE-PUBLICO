// =============================================================
// PALETA DO JOGO – 16 cores terrosas e dessaturadas (estilo low-poly
// inspirado em Valheim). TODA cor do mundo sai daqui: terreno, céu,
// luz, água, rochas, árvores, construções e bichos.
//
// >>> PARA AJUSTAR O VISUAL: mude os hex abaixo e rode `npm run build`.
//     Cada cor tem um nome; o resto do código pede pelo nome
//     (ex.: PALETA.musgo), nunca pelo número.
//
// Dicas:
// - Deixe as cores "sujas" (pouca saturação): é o que dá o clima.
// - O sol e o fogo usam o laranja quente; a sombra e a noite usam os
//   azuis frios. O contraste quente x frio é o que faz a cena "viver".
// =============================================================
import * as THREE from 'three';

export const PALETA_HEX = {
  // ---- verdes (mata, grama, folhas) ----
  musgoEscuro: '#3b4527', //  1 sombra da mata, agulhas de pinheiro, chão da floresta
  musgo: '#56653a', //        2 grama/folhas (cor principal do verde)
  folhaClara: '#7f8c4f', //   3 folhas ao sol, pasto
  capimSeco: '#9c9258', //    4 campo seco, palha, pontas da grama

  // ---- terras e madeiras ----
  terraEscura: '#3a3027', //  5 terra molhada, cascas escuras, frestas
  marrom: '#66503a', //       6 tronco, terra, couro
  madeira: '#977653', //      7 madeira clara (tábuas, cabos)
  areia: '#c2ad80', //        8 praia, trilhas

  // ---- pedras (cinza puxado para o azul) ----
  pedraEscura: '#454b54', //  9 rocha na sombra, basalto, paredões
  pedra: '#6c747e', //       10 rocha
  pedraClara: '#9ba2a7', //  11 rocha ao sol, cascalho
  neve: '#dde3e6', //        12 neve, nuvens

  // ---- água, céu e luz ----
  agua: '#46687e', //        13 mar, lagos e o azul do céu (azul-aço apagado)
  ceuNoite: '#1a2335', //    14 noite azul-escura, sombras frias
  solLaranja: '#e3a456', //  15 sol baixo, fogo, janelas acesas
  ferrugem: '#94482f', //    16 entardecer, brasa, sangue, telhas
};

/** As 16 cores como THREE.Color (já convertidas para o espaço linear de luz). Não altere os objetos: use .clone(). */
export const PALETA = Object.fromEntries(Object.entries(PALETA_HEX).map(([k, v]) => [k, new THREE.Color(v)]));

/** Mistura duas cores da paleta (t = 0 -> a, 1 -> b). Devolve uma cor nova. */
export function mistura(a, b, t) {
  return PALETA[a].clone().lerp(PALETA[b], t);
}

/** Hex de uma mistura (para quem pede string, ex.: '#rrggbb'). */
export function misturaHex(a, b, t) {
  return `#${mistura(a, b, t).getHexString()}`;
}
