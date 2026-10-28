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

// -------------------------------------------------------------
// MAPA DE RELEVO (tela de morte, como no ARK): só linhas de nível em
// azul-ciano sobre fundo escuro. A costa é a linha mais forte.
// -------------------------------------------------------------
let cachedContour = null;

export function renderContourImage(world, px = 1024) {
  if (cachedContour) return cachedContour;
  const map = world.map;
  const n = map.verts;
  // relevo suavizado: sem isso as colinas pequenas da mata viram "pontinhos" de linhas
  const H = blurHeights(map.heights, n, 3, 2);
  const canvas = document.createElement('canvas');
  canvas.width = px;
  canvas.height = px;
  const g = canvas.getContext('2d');
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const S = px / (n - 1); // pixels por célula
  const step = 2;
  const levels = [
    { h: 0.3, w: 2.4, a: 0.95, glow: true },
    { h: 40, w: 1.2, a: 0.55 },
    { h: 62, w: 1.3, a: 0.65 },
    { h: 90, w: 1.3, a: 0.7 },
    { h: 130, w: 1.4, a: 0.75 },
    { h: 180, w: 1.5, a: 0.8 },
    { h: 240, w: 1.6, a: 0.85 },
  ];
  for (const L of levels) {
    g.beginPath();
    const t = L.h;
    for (let j = 0; j < n - step; j += step) {
      for (let i = 0; i < n - step; i += step) {
        const a = H[j * n + i];
        const b = H[j * n + i + step];
        const c = H[(j + step) * n + i + step];
        const d = H[(j + step) * n + i];
        let code = 0;
        if (a > t) code |= 1;
        if (b > t) code |= 2;
        if (c > t) code |= 4;
        if (d > t) code |= 8;
        if (code === 0 || code === 15) continue;
        // pontos nas 4 bordas (interpolação linear): topo, direita, base, esquerda
        const x0 = i * S;
        const y0 = j * S;
        const w = step * S;
        const top = [x0 + w * ((t - a) / (b - a)), y0];
        const right = [x0 + w, y0 + w * ((t - b) / (c - b))];
        const bottom = [x0 + w * ((t - d) / (c - d)), y0 + w];
        const left = [x0, y0 + w * ((t - a) / (d - a))];
        const seg = (p, q) => { g.moveTo(p[0], p[1]); g.lineTo(q[0], q[1]); };
        switch (code) {
          case 1: case 14: seg(left, top); break;
          case 2: case 13: seg(top, right); break;
          case 3: case 12: seg(left, right); break;
          case 4: case 11: seg(right, bottom); break;
          case 5: seg(left, top); seg(right, bottom); break;
          case 6: case 9: seg(top, bottom); break;
          case 7: case 8: seg(left, bottom); break;
          case 10: seg(top, right); seg(left, bottom); break;
          default: break;
        }
      }
    }
    g.strokeStyle = `rgba(105, 222, 255, ${L.a})`;
    g.lineWidth = L.w * (px / 1024) * 1.2;
    if (L.glow) {
      g.shadowColor = 'rgba(80, 210, 255, 0.9)';
      g.shadowBlur = 6;
    } else {
      g.shadowBlur = 0;
    }
    g.stroke();
  }
  cachedContour = canvas.toDataURL('image/png');
  return cachedContour;
}

// média móvel (caixa) separável, 'passes' vezes, raio r (em células)
function blurHeights(src, n, r, passes) {
  let a = Float32Array.from(src);
  let b = new Float32Array(src.length);
  for (let p = 0; p < passes; p++) {
    for (let j = 0; j < n; j++) {
      let sum = 0;
      for (let i = -r; i <= r; i++) sum += a[j * n + Math.min(n - 1, Math.max(0, i))];
      for (let i = 0; i < n; i++) {
        b[j * n + i] = sum / (2 * r + 1);
        sum += a[j * n + Math.min(n - 1, i + r + 1)] - a[j * n + Math.max(0, i - r)];
      }
    }
    for (let i = 0; i < n; i++) {
      let sum = 0;
      for (let j = -r; j <= r; j++) sum += b[Math.min(n - 1, Math.max(0, j)) * n + i];
      for (let j = 0; j < n; j++) {
        a[j * n + i] = sum / (2 * r + 1);
        sum += b[Math.min(n - 1, j + r + 1) * n + i] - b[Math.max(0, j - r) * n + i];
      }
    }
  }
  return a;
}
