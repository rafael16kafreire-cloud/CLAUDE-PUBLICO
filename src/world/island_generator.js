// =============================================================
// GERADOR DA ILHA
// Cria o relevo (altura de cada ponto), os biomas (praia, floresta,
// campo, montanha, neve, lago) e as cores do chão.
// Tudo vem de uma "semente": a mesma semente gera sempre a mesma
// ilha, o que é importante para o save funcionar nas próximas fases.
// =============================================================
import * as THREE from 'three';
import { createNoise2D, fbm } from '../core/noise.js';
import { clamp, lerp, smoothstep } from '../core/math.js';

export const BIOME = {
  SEA: 0,
  BEACH: 1,
  GRASS: 2,   // campina (grama comum)
  FIELD: 3,   // campo aberto
  FOREST: 4,
  ROCK: 5,    // montanha / encosta de pedra
  SNOW: 6,
  LAKE: 7,
};

export const BIOME_NAMES = ['Mar', 'Praia', 'Campina', 'Campo aberto', 'Floresta', 'Montanha', 'Neve', 'Lago'];

// Cores do chão de cada bioma (estilo low-poly, cores chapadas).
const COLORS = {
  sand: new THREE.Color('#e2cd8f'),
  wetSand: new THREE.Color('#c9b277'),
  seaShallow: new THREE.Color('#bfae7c'),
  seaDeep: new THREE.Color('#4f6f68'),
  grass: new THREE.Color('#77a847'),
  field: new THREE.Color('#a8bd57'),
  forest: new THREE.Color('#4a7a36'),
  rock: new THREE.Color('#8b867a'),
  darkRock: new THREE.Color('#6d6a62'),
  snow: new THREE.Color('#eef1f3'),
  lakeBed: new THREE.Color('#6f8660'),
};

export class IslandMap {
  constructor(layout, seed) {
    this.L = layout;
    this.seed = seed;
    this.size = layout.tamanho_terreno_m;
    this.cell = layout.tamanho_celula_m;
    this.cells = Math.round(this.size / this.cell);
    this.verts = this.cells + 1;
    this.half = this.size / 2;

    // Lago: o "disco" de água é um pouco maior que o lago em si;
    // o terreno em volta é levantado para esconder a borda.
    const lago = layout.lago;
    this.lake = {
      x: lago.x,
      z: lago.z,
      radius: lago.raio_m,
      level: lago.nivel_agua_m,
      depth: lago.profundidade_m,
      diskRadius: lago.raio_m + 14,
    };

    // Cada camada de ruído tem sua própria semente.
    this.nCoast = createNoise2D(seed + 1);
    this.nHill = createNoise2D(seed + 2);
    this.nRidge = createNoise2D(seed + 3);
    this.nLake = createNoise2D(seed + 4);
    this.nForest = createNoise2D(seed + 5);
    this.nDetail = createNoise2D(seed + 6);

    const n = this.verts * this.verts;
    this.heights = new Float32Array(n);
    this.coast = new Float32Array(n);   // distância até a costa (m)
    this.biomes = new Uint8Array(n);
    this.colors = new Float32Array(n * 3);

    this._generate();
  }

  // ----------------------------------------------------------
  // Máscaras (0 a 1) que dizem "quanto" de cada região há num ponto
  // ----------------------------------------------------------

  // Metros até a costa: positivo = terra, negativo = mar.
  coastDistance(x, z) {
    const dist = Math.hypot(x * 0.94, z * 1.06);
    const wobble = fbm(this.nCoast, x * 0.0032, z * 0.0032, 4) * this.L.variacao_costa_m;
    return this.L.raio_ilha_m + wobble - dist;
  }

  mountainMask(x, z) {
    const m = this.L.montanha;
    return smoothstep(m.raio_m, 0, Math.hypot(x - m.x, z - m.z));
  }

  fieldMask(x, z) {
    const c = this.L.campo;
    return smoothstep(c.raio_m, c.raio_m * 0.45, Math.hypot(x - c.x, z - c.z));
  }

  // Densidade da floresta (0 = sem árvores, 1 = mata fechada).
  forestDensity(x, z, h) {
    let f = 0.5 + fbm(this.nForest, x * 0.005 + 40, z * 0.005 - 20, 3) * 1.1;
    f += 0.3 * smoothstep(-120, 260, x);          // leste mais fechado
    f -= this.fieldMask(x, z) * 1.4;              // campo aberto quase sem árvores
    f -= smoothstep(45, 80, h) * 0.6;             // rareia subindo a montanha
    return clamp(f, 0, 1);
  }

  // ----------------------------------------------------------
  // Altura "ideal" de um ponto (antes de virar malha)
  // ----------------------------------------------------------
  rawHeight(x, z, coastD) {
    const L = this.L;
    const d = coastD;
    let h;
    if (d <= 0) {
      // Fundo do mar: desce suavemente até a profundidade máxima.
      h = -Math.min(L.profundidade_mar_m, -d * 0.16);
      h += this.nDetail(x * 0.02, z * 0.02) * 0.6 * smoothstep(0, 40, -d);
    } else {
      // Praia → planície → colinas
      const praia = L.altura_praia_m * smoothstep(0, L.largura_praia_m, d);
      const planicie = (L.altura_planicie_m - L.altura_praia_m) *
        smoothstep(L.largura_praia_m * 0.7, L.largura_praia_m + 130, d);
      const fm = this.fieldMask(x, z);
      const colinas = fbm(this.nHill, x * 0.0075, z * 0.0075, 4) * L.altura_colinas_m *
        smoothstep(L.largura_praia_m, L.largura_praia_m + 160, d) * (1 - 0.75 * fm);
      h = praia + planicie + colinas;
    }

    // Montanha ao norte (com cristas)
    const mm = this.mountainMask(x, z);
    if (mm > 0) {
      const fade = smoothstep(-20, 110, d);
      const ridge = 1 - Math.abs(fbm(this.nRidge, x * 0.011, z * 0.011, 4));
      h += (Math.pow(mm, 1.7) * L.montanha.altura_m + ridge * ridge * 22 * mm) * fade;
    }

    return this._applyLake(x, z, h);
  }

  // Cava a bacia do lago e levanta a borda para a água não "vazar".
  _applyLake(x, z, h) {
    const k = this.lake;
    const dl = Math.hypot(x - k.x, z - k.z);
    if (dl > k.diskRadius + 24) return h;
    const radius = k.radius + fbm(this.nLake, x * 0.03, z * 0.03, 2) * 8;
    const rim = smoothstep(k.diskRadius + 24, k.diskRadius, dl);
    let out = lerp(h, Math.max(h, k.level + 1.0), rim);
    const bowl = smoothstep(radius + 8, radius * 0.35, dl);
    out = lerp(out, k.level - k.depth, bowl);
    return out;
  }

  // ----------------------------------------------------------
  // Geração da grade
  // ----------------------------------------------------------
  _generate() {
    const v = this.verts;
    // 1) alturas
    for (let j = 0; j < v; j++) {
      const z = j * this.cell - this.half;
      for (let i = 0; i < v; i++) {
        const x = i * this.cell - this.half;
        const idx = j * v + i;
        const d = this.coastDistance(x, z);
        this.coast[idx] = d;
        this.heights[idx] = this.rawHeight(x, z, d);
      }
    }
    // 2) biomas e cores (precisa das alturas vizinhas para a inclinação)
    const c = new THREE.Color();
    for (let j = 0; j < v; j++) {
      const z = j * this.cell - this.half;
      for (let i = 0; i < v; i++) {
        const x = i * this.cell - this.half;
        const idx = j * v + i;
        const h = this.heights[idx];
        const hx0 = this.heights[j * v + Math.max(0, i - 1)];
        const hx1 = this.heights[j * v + Math.min(v - 1, i + 1)];
        const hz0 = this.heights[Math.max(0, j - 1) * v + i];
        const hz1 = this.heights[Math.min(v - 1, j + 1) * v + i];
        const dx = (hx1 - hx0) / (2 * this.cell);
        const dz = (hz1 - hz0) / (2 * this.cell);
        const normalY = 1 / Math.sqrt(dx * dx + dz * dz + 1);

        const biome = this._classify(x, z, h, normalY, this.coast[idx]);
        this.biomes[idx] = biome;
        this._colorFor(c, biome, x, z, h, normalY);
        this.colors[idx * 3] = c.r;
        this.colors[idx * 3 + 1] = c.g;
        this.colors[idx * 3 + 2] = c.b;
      }
    }
  }

  _classify(x, z, h, normalY, coastD) {
    const L = this.L;
    const k = this.lake;
    if (Math.hypot(x - k.x, z - k.z) < k.diskRadius && h < k.level + 0.3) return BIOME.LAKE;
    if (h < 0.2) return BIOME.SEA;
    if (h < 2.8 && coastD < L.largura_praia_m * 1.6) return BIOME.BEACH;
    const snowLine = L.neve_acima_m + this.nDetail(x * 0.03, z * 0.03) * 8;
    if (h > snowLine) return BIOME.SNOW;
    if (h > L.rocha_acima_m || normalY < 0.72) return BIOME.ROCK;
    if (this.fieldMask(x, z) > 0.5) return BIOME.FIELD;
    if (this.forestDensity(x, z, h) > 0.45) return BIOME.FOREST;
    return BIOME.GRASS;
  }

  _colorFor(out, biome, x, z, h, normalY) {
    const v = 1 + this.nDetail(x * 0.06, z * 0.06) * 0.07; // leve variação
    switch (biome) {
      case BIOME.SEA:
        out.copy(COLORS.seaShallow).lerp(COLORS.seaDeep, smoothstep(0, 14, -h));
        break;
      case BIOME.BEACH:
        out.copy(COLORS.wetSand).lerp(COLORS.sand, smoothstep(0.2, 1.4, h));
        break;
      case BIOME.FIELD:
        out.copy(COLORS.field);
        break;
      case BIOME.FOREST:
        out.copy(COLORS.forest);
        break;
      case BIOME.ROCK:
        out.copy(COLORS.rock).lerp(COLORS.darkRock, smoothstep(0.8, 0.55, normalY));
        break;
      case BIOME.SNOW:
        out.copy(COLORS.snow);
        break;
      case BIOME.LAKE:
        out.copy(COLORS.lakeBed);
        break;
      default:
        out.copy(COLORS.grass);
    }
    out.multiplyScalar(v);
  }

  // ----------------------------------------------------------
  // Consultas usadas pela física e pelos outros sistemas
  // ----------------------------------------------------------

  // Altura exata do chão em (x, z), igual à malha desenhada.
  heightAt(x, z) {
    const gx = (x + this.half) / this.cell;
    const gz = (z + this.half) / this.cell;
    if (gx < 0 || gz < 0 || gx >= this.cells || gz >= this.cells) {
      return -this.L.profundidade_mar_m;
    }
    const ix = Math.floor(gx);
    const iz = Math.floor(gz);
    const fx = gx - ix;
    const fz = gz - iz;
    const v = this.verts;
    const H = this.heights;
    const h00 = H[iz * v + ix];
    const h10 = H[iz * v + ix + 1];
    const h01 = H[(iz + 1) * v + ix];
    const h11 = H[(iz + 1) * v + ix + 1];
    // Cada quadrado da grade tem 2 triângulos (diagonal 01–10).
    if (fx + fz <= 1) return h00 + (h10 - h00) * fx + (h01 - h00) * fz;
    return h11 + (h01 - h11) * (1 - fx) + (h10 - h11) * (1 - fz);
  }

  // Direção "para cima" do chão (inclinação).
  normalAt(x, z, out = new THREE.Vector3()) {
    const e = 1.0;
    const dx = (this.heightAt(x + e, z) - this.heightAt(x - e, z)) / (2 * e);
    const dz = (this.heightAt(x, z + e) - this.heightAt(x, z - e)) / (2 * e);
    return out.set(-dx, 1, -dz).normalize();
  }

  biomeAt(x, z) {
    const i = Math.round((x + this.half) / this.cell);
    const j = Math.round((z + this.half) / this.cell);
    if (i < 0 || j < 0 || i >= this.verts || j >= this.verts) return BIOME.SEA;
    return this.biomes[j * this.verts + i];
  }
}
