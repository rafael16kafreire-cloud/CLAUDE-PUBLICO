// =============================================================
// PONTOS DE RENASCER (zonas na tela de morte)
// Para cada ponto de data/world/ilha.json, o jogo "caminha" do mar em
// direção ao centro até achar areia seca. Cada ponto vira 3 zonas
// ("Zona Sul 1, 2, 3") com a posição variando um pouco, como no ARK.
// (Saco de dormir/cama entram como pontos extras.)
// =============================================================
import * as THREE from 'three';

// do mar para dentro até o chão ficar acima da água
function beachPoint(map, dx, dz) {
  let r = map.half - 10;
  while (r > 0 && map.heightAt(dx * r, dz * r) < 0.9) r -= 2;
  r -= 10; // um pouco mais para dentro da praia
  return { x: dx * r, z: dz * r };
}

// ângulos (rad) que afastam as zonas 2 e 3 da zona 1 (praias) e
// deslocamentos (m) para os pontos fixos
const ROT = [0, -0.1, 0.1];
const SHIFT = [0, -80, 80];

export function findRespawnPoints(map, layout) {
  const list = [];
  const count = {}; // quantas zonas de cada nome (Sul 1, Sul 2...)
  for (const p of layout.pontos_renascer) {
    for (let k = 0; k < 3; k++) {
      let x;
      let z;
      let yaw;
      if (p.pos) {
        // ponto com lugar certo (pos = [x, z]): olha para o centro da ilha
        const [px, pz] = p.pos;
        const len = Math.hypot(px, pz) || 1;
        x = px + (-pz / len) * SHIFT[k];
        z = pz + (px / len) * SHIFT[k];
        if (k > 0 && map.heightAt(x, z) < 1.5) continue; // caiu no mar: sem essa variante
        yaw = Math.atan2(x, z);
      } else {
        const len = Math.hypot(p.direcao[0], p.direcao[1]) || 1;
        const a = Math.atan2(p.direcao[0] / len, p.direcao[1] / len) + ROT[k];
        const dx = Math.sin(a);
        const dz = Math.cos(a);
        ({ x, z } = beachPoint(map, dx, dz));
        yaw = Math.atan2(dx, dz); // começa olhando para o centro da ilha
      }
      const zona = p.zona ?? p.nome;
      count[zona] = (count[zona] ?? 0) + 1;
      list.push({
        id: k === 0 ? p.id : `${p.id}_${k + 1}`,
        name: `Zona ${zona} ${count[zona]} (${p.dificuldade ?? 'Médio'})`,
        zone: zona,
        zoneN: count[zona],
        difficulty: p.dificuldade ?? 'Médio',
        position: new THREE.Vector3(x, map.heightAt(x, z), z),
        yaw,
      });
    }
  }
  return list;
}
