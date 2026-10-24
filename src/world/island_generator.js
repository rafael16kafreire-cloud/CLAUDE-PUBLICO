// =============================================================
// GERADOR DA ILHA
// Cria o relevo (altura de cada ponto), os biomas e as cores do
// chão. Tudo vem de uma "semente": a mesma semente gera sempre a
// mesma ilha (importante para o save nas próximas fases).
//
// Biomas: Praia, Campina, Floresta, Floresta Amazônica, Deserto,
//         Pântano, Montanha, Pico Nevado, Lago, Mar.
// =============================================================
import * as THREE from 'three';
import { createNoise2D, fbm } from '../core/noise.js';
import { clamp, lerp, smoothstep } from '../core/math.js';

export const BIOME = {
  SEA: 0,
  BEACH: 1,
  MEADOW: 2,    // campina
  FOREST: 3,    // floresta
  JUNGLE: 4,    // floresta amazônica
  DESERT: 5,
  SWAMP: 6,
  MOUNTAIN: 7,
  SNOW: 8,
  LAKE: 9,
};

// Chave de cada bioma no arquivo data/world/ilha.json
export const BIOME_KEYS = ['mar', 'praia', 'campina', 'floresta', 'selva', 'deserto', 'pantano', 'montanha', 'neve', 'lago'];

// Cores do chão (tons naturais, sem saturação exagerada).
const C = (hex) => new THREE.Color(hex);
const COLORS = {
  sand: C('#d6c293'),
  wetSand: C('#ad9a6c'),
  seaShallow: C('#b3a274'),
  seaDeep: C('#3d5b55'),
  meadow: C('#7f9a47'),
  meadowDry: C('#9fa25a'),
  forest: C('#55703a'),
  forestDark: C('#425c2e'),
  jungle: C('#3a5a26'),
  jungleMud: C('#4f4630'),
  desert: C('#d4a466'),
  desertDark: C('#b9844d'),
  swampMud: C('#4a4630'),
  swampMoss: C('#566a32'),
  rock: C('#878177'),
  darkRock: C('#5f5b54'),
  snow: C('#eef1f4'),
  lakeBed: C('#5b6a48'),
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

    // Lago e pântano: o "disco" de água é um pouco maior que a área
    // molhada; o terreno na borda do disco é levantado para esconder
    // a borda da água.
    const lago = layout.lago;
    this.lake = {
      x: lago.x, z: lago.z, radius: lago.raio_m, level: lago.nivel_agua_m,
      depth: lago.profundidade_m, diskRadius: lago.raio_m + 14,
    };
    const p = layout.pantano;
    this.swamp = { x: p.x, z: p.z, radius: p.raio_m, level: p.nivel_agua_m, diskRadius: p.raio_m };

    this.nCoast = createNoise2D(seed + 1);
    this.nHill = createNoise2D(seed + 2);
    this.nRidge = createNoise2D(seed + 3);
    this.nLake = createNoise2D(seed + 4);
    this.nForest = createNoise2D(seed + 5);
    this.nDetail = createNoise2D(seed + 6);
    this.nRegion = createNoise2D(seed + 7);
    this.nDune = createNoise2D(seed + 8);

    const n = this.verts * this.verts;
    this.heights = new Float32Array(n);
    this.coast = new Float32Array(n);
    this.biomes = new Uint8Array(n);
    this.colors = new Float32Array(n * 3);

    this._generate();
  }

  // ----------------------------------------------------------
  // Máscaras (0 a 1): "quanto" de cada região há num ponto
  // ----------------------------------------------------------
  coastDistance(x, z) {
    const dist = Math.hypot(x * 0.94, z * 1.06);
    const wobble = fbm(this.nCoast, x * 0.0032, z * 0.0032, 4) * this.L.variacao_costa_m;
    return this.L.raio_ilha_m + wobble - dist;
  }

  // Região com borda irregular (não um círculo perfeito).
  _region(r, x, z) {
    const wobble = fbm(this.nRegion, x * 0.006 + r.x * 0.01, z * 0.006 + r.z * 0.01, 3) * r.raio_m * 0.25;
    return smoothstep(r.raio_m, r.raio_m * 0.5, Math.hypot(x - r.x, z - r.z) + wobble);
  }

  mountainMask(x, z) {
    const m = this.L.montanha;
    return smoothstep(m.raio_m, 0, Math.hypot(x - m.x, z - m.z));
  }

  desertMask(x, z) { return this._region(this.L.deserto, x, z); }
  jungleMask(x, z) { return this._region(this.L.selva, x, z); }
  meadowMask(x, z) { return this._region(this.L.campina, x, z); }
  swampMask(x, z) {
    const s = this.swamp;
    return smoothstep(s.radius, s.radius * 0.55, Math.hypot(x - s.x, z - s.z));
  }

  // Densidade de árvores na floresta comum (0 a 1).
  forestDensity(x, z, h) {
    let f = 0.55 + fbm(this.nForest, x * 0.005 + 40, z * 0.005 - 20, 3) * 1.1;
    f -= smoothstep(45, 80, h) * 0.6;
    return clamp(f, 0, 1);
  }

  // ----------------------------------------------------------
  // Altura de um ponto
  // ----------------------------------------------------------
  rawHeight(x, z, coastD) {
    const L = this.L;
    const d = coastD;
    const desert = this.desertMask(x, z);
    const jungle = this.jungleMask(x, z);
    let h;
    if (d <= 0) {
      h = -Math.min(L.profundidade_mar_m, -d * 0.16);
      h += this.nDetail(x * 0.02, z * 0.02) * 0.6 * smoothstep(0, 40, -d);
    } else {
      const praia = L.altura_praia_m * smoothstep(0, L.largura_praia_m, d);
      const planicie = (L.altura_planicie_m - L.altura_praia_m) *
        smoothstep(L.largura_praia_m * 0.7, L.largura_praia_m + 130, d);
      const inland = smoothstep(L.largura_praia_m, L.largura_praia_m + 160, d);
      const flat = 1 - 0.7 * this.meadowMask(x, z);
      let colinas = fbm(this.nHill, x * 0.0075, z * 0.0075, 4) * L.altura_colinas_m * inland * flat;
      colinas *= 1 + jungle * 0.4;
      // Deserto: no lugar de colinas, dunas com cristas.
      const duneRidge = 1 - Math.abs(fbm(this.nDune, x * 0.012, z * 0.02, 3));
      const dunas = duneRidge * duneRidge * L.deserto.altura_dunas_m * inland - 3 * inland;
      h = praia + planicie + lerp(colinas, dunas, desert);
    }

    // Montanha ao norte (com cristas)
    const mm = this.mountainMask(x, z);
    if (mm > 0) {
      const fade = smoothstep(-20, 110, d);
      const ridge = 1 - Math.abs(fbm(this.nRidge, x * 0.011, z * 0.011, 4));
      h += (Math.pow(mm, 1.7) * L.montanha.altura_m + ridge * ridge * 22 * mm) * fade;
    }

    h = this._applySwamp(x, z, h);
    return this._applyLake(x, z, h);
  }

  // Lago: cava a bacia e levanta a borda.
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

  // Pântano: chão baixo e encharcado, cheio de poças e ilhotas.
  _applySwamp(x, z, h) {
    const s = this.swamp;
    const ds = Math.hypot(x - s.x, z - s.z);
    if (ds > s.diskRadius + 24) return h;
    const rim = smoothstep(s.diskRadius + 24, s.diskRadius - 4, ds);
    let out = lerp(h, Math.max(h, s.level + 0.8), rim);
    const wet = s.level + fbm(this.nLake, x * 0.025 + 7, z * 0.025, 3) * 1.6 - 0.15;
    out = lerp(out, wet, this.swampMask(x, z));
    return out;
  }

  // ----------------------------------------------------------
  _generate() {
    const v = this.verts;
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
    const c = new THREE.Color();
    for (let j = 0; j < v; j++) {
      const z = j * this.cell - this.half;
      for (let i = 0; i < v; i++) {
        const x = i * this.cell - this.half;
        const idx = j * v + i;
        const h = this.heights[idx];
        const dx = (this.heights[j * v + Math.min(v - 1, i + 1)] - this.heights[j * v + Math.max(0, i - 1)]) / (2 * this.cell);
        const dz = (this.heights[Math.min(v - 1, j + 1) * v + i] - this.heights[Math.max(0, j - 1) * v + i]) / (2 * this.cell);
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
    if (this.swampMask(x, z) > 0.35) return BIOME.SWAMP;
    if (h < 2.8 && coastD < L.largura_praia_m * 1.6) return BIOME.BEACH;
    const snowLine = L.neve_acima_m + this.nDetail(x * 0.03, z * 0.03) * 8;
    if (h > snowLine) return BIOME.SNOW;
    if (h > L.rocha_acima_m || (normalY < 0.72 && this.desertMask(x, z) < 0.5)) return BIOME.MOUNTAIN;
    if (this.desertMask(x, z) > 0.5) return BIOME.DESERT;
    if (this.jungleMask(x, z) > 0.45) return BIOME.JUNGLE;
    if (this.meadowMask(x, z) > 0.45) return BIOME.MEADOW;
    if (this.forestDensity(x, z, h) > 0.4) return BIOME.FOREST;
    return BIOME.MEADOW;
  }

  _colorFor(out, biome, x, z, h, normalY) {
    const n1 = this.nDetail(x * 0.06, z * 0.06);
    const n2 = this.nDetail(x * 0.013 + 50, z * 0.013);
    const v = 1 + n1 * 0.06;
    switch (biome) {
      case BIOME.SEA:
        out.copy(COLORS.seaShallow).lerp(COLORS.seaDeep, smoothstep(0, 14, -h));
        break;
      case BIOME.BEACH:
        out.copy(COLORS.wetSand).lerp(COLORS.sand, smoothstep(0.2, 1.4, h));
        break;
      case BIOME.MEADOW:
        out.copy(COLORS.meadow).lerp(COLORS.meadowDry, clamp(n2 * 0.8 + 0.3, 0, 1));
        break;
      case BIOME.FOREST:
        out.copy(COLORS.forest).lerp(COLORS.forestDark, clamp(n2 + 0.5, 0, 1));
        break;
      case BIOME.JUNGLE:
        out.copy(COLORS.jungle).lerp(COLORS.jungleMud, clamp(n2 * 0.9 - 0.1, 0, 0.6));
        break;
      case BIOME.DESERT:
        out.copy(COLORS.desert).lerp(COLORS.desertDark, clamp(0.5 - n2 * 0.7, 0, 1) * smoothstep(0.98, 0.8, normalY + 0.1));
        break;
      case BIOME.SWAMP:
        out.copy(COLORS.swampMoss).lerp(COLORS.swampMud, smoothstep(this.swamp.level + 0.8, this.swamp.level, h));
        break;
      case BIOME.MOUNTAIN:
        out.copy(COLORS.rock).lerp(COLORS.darkRock, smoothstep(0.8, 0.55, normalY));
        break;
      case BIOME.SNOW:
        out.copy(COLORS.snow);
        break;
      case BIOME.LAKE:
        out.copy(COLORS.lakeBed);
        break;
      default:
        out.copy(COLORS.meadow);
    }
    out.multiplyScalar(v);
  }

  // ----------------------------------------------------------
  // Consultas
  // ----------------------------------------------------------
  heightAt(x, z) {
    const gx = (x + this.half) / this.cell;
    const gz = (z + this.half) / this.cell;
    if (gx < 0 || gz < 0 || gx >= this.cells || gz >= this.cells) return -this.L.profundidade_mar_m;
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
    if (fx + fz <= 1) return h00 + (h10 - h00) * fx + (h01 - h00) * fz;
    return h11 + (h01 - h11) * (1 - fx) + (h10 - h11) * (1 - fz);
  }

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

  biomeKeyAt(x, z) {
    return BIOME_KEYS[this.biomeAt(x, z)];
  }
}
