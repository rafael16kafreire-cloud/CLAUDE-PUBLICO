// =============================================================
// PONTOS DE RENASCER (praias Sul, Leste e Oeste)
// Para cada direção definida em data/world/ilha.json, o jogo
// "caminha" do mar em direção ao centro até achar areia seca.
// (Saco de dormir/cama entram como pontos extras na Fase 6.)
// =============================================================
import * as THREE from 'three';

export function findRespawnPoints(map, layout) {
  return layout.pontos_renascer.map((p) => {
    // ponto com lugar certo (pos = [x, z]): olha para o centro da ilha
    if (p.pos) {
      const [x, z] = p.pos;
      return { id: p.id, name: p.nome, position: new THREE.Vector3(x, map.heightAt(x, z), z), yaw: Math.atan2(x, z) };
    }
    const len = Math.hypot(p.direcao[0], p.direcao[1]) || 1;
    const dx = p.direcao[0] / len;
    const dz = p.direcao[1] / len;

    // Do mar para dentro até o chão ficar acima da água.
    let r = map.half - 10;
    while (r > 0 && map.heightAt(dx * r, dz * r) < 0.9) r -= 2;
    r -= 10; // um pouco mais para dentro da praia

    const x = dx * r;
    const z = dz * r;
    return {
      id: p.id,
      name: p.nome,
      position: new THREE.Vector3(x, map.heightAt(x, z), z),
      // Começa olhando para o centro da ilha.
      yaw: Math.atan2(dx, dz),
    };
  });
}
