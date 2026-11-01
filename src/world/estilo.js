// =============================================================
// ESTILO LOW-POLY (inspirado em Valheim)
// Liga a luz "facetada" (flatShading) em todo material do jogo:
// cada triângulo recebe uma luz só, sem degradê suave. Vale para
// terreno, árvores, pedras, bichos, construções e o personagem.
// Fica de fora: céu, água e efeitos (têm shader próprio), folhas
// recortadas (cartões com transparência) e quem marcar
// material.userData.suave = true.
// Roda de tempos em tempos (coisas novas entram na cena o tempo todo:
// bichos que nascem, peças construídas...). Cada material só é
// alterado uma vez.
// =============================================================

const feitos = new WeakSet();

/** Percorre a cena e liga flatShading nos materiais que ainda não têm. */
export function aplicarLowPoly(root) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      if (!m || feitos.has(m)) continue;
      feitos.add(m);
      if (m.isShaderMaterial || m.userData?.suave) continue;
      // cartões recortados (folhas com transparência): o verso ficaria preto com luz facetada
      if (m.alphaTest > 0 && m.map) continue;
      if (!(m.isMeshLambertMaterial || m.isMeshStandardMaterial || m.isMeshPhongMaterial || m.isMeshToonMaterial)) continue;
      if (!m.flatShading) {
        m.flatShading = true;
        m.needsUpdate = true;
      }
    }
  });
}
