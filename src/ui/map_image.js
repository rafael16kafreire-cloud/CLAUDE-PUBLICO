// =============================================================
// IMAGEM DO MAPA – desenha a ilha vista de cima a partir do relevo
// (cores dos biomas + sombra dos morros + água). Feita uma vez só.
// Usada na tela de morte e, na Fase 11, no mapa do jogo.
// =============================================================
import * as THREE from 'three';

let cached = null;

export function renderMapImage(world) {
  if (cached) return cached;
  const map = world.map;
  const n = map.verts;
  const canvas = document.createElement('canvas');
  canvas.width = n;
  canvas.height = n;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(n, n);
  const c = new THREE.Color();
  const sea = new THREE.Color('#2a6f8e');
  const seaDeep = new THREE.Color('#163f55');
  const fresh = new THREE.Color('#3d8fa8');
  const swamp = new THREE.Color('#4f5e36');
  const snowCol = new THREE.Color('#c9d3da');
  const L = new THREE.Vector3(-0.6, 0.7, -0.4).normalize();
  const H = map.heights;

  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const idx = j * n + i;
      const x = i * map.cell - map.half;
      const z = j * map.cell - map.half;
      const h = H[idx];
      const water = world.water.bodyAt(x, z);
      if (water && water.id === 'mar') {
        c.copy(sea).lerp(seaDeep, Math.min(1, -h / 20));
      } else if (water) {
        c.copy(water.id === 'pantano' ? swamp : fresh);
      } else {
        c.setRGB(map.colors[idx * 3], map.colors[idx * 3 + 1], map.colors[idx * 3 + 2]);
        // neve da Lapônia (no jogo ela é pintada pelo shader)
        if (map.snow[idx] > 0) c.lerp(snowCol, map.snow[idx]);
        // sombra do relevo
        const hx = H[j * n + Math.min(n - 1, i + 1)] - H[j * n + Math.max(0, i - 1)];
        const hz = H[Math.min(n - 1, j + 1) * n + i] - H[Math.max(0, j - 1) * n + i];
        const nx = -hx / (2 * map.cell);
        const nz = -hz / (2 * map.cell);
        const len = Math.hypot(nx, 1, nz);
        const shade = Math.max(0.45, Math.min(1.35, 0.55 + ((nx * L.x + L.y + nz * L.z) / len) * 0.7));
        c.multiplyScalar(shade);
      }
      c.convertLinearToSRGB();
      const o = idx * 4;
      img.data[o] = Math.min(255, c.r * 255);
      img.data[o + 1] = Math.min(255, c.g * 255);
      img.data[o + 2] = Math.min(255, c.b * 255);
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  cached = canvas.toDataURL('image/png');
  return cached;
}

// Converte posição do mundo em porcentagem da imagem do mapa.
export function worldToMapPercent(world, x, z) {
  const size = world.map.size;
  return {
    left: ((x + world.map.half) / size) * 100,
    top: ((z + world.map.half) / size) * 100,
  };
}
