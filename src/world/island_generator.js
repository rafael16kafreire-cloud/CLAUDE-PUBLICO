// =============================================================
// GERADOR DO MAPA
// Formato da Finlândia (contorno em ilha.json). Floresta (morros,
// grotas e mata fechada) com pântano/lagos no sul, igapó em volta,
// praia na costa e, no norte, a Lapônia: montanhas gigantes com
// neve e rocha (relevo tirado do modelo "Snow alps").
// Tudo vem de uma "semente": a mesma semente gera sempre a mesma
// ilha (importante para o save nas próximas fases).
// =============================================================
import * as THREE from 'three';
import { createNoise2D, fbm } from '../core/noise.js';
import { clamp, lerp, smoothstep } from '../core/math.js';
import { ALPES_N, ALPES_ALTURAS, ALPES_NEVE } from './textures/alpes.js';

// relevo e máscara de neve dos Alpes (0..1), lidos uma vez
function decodeAlps() {
  const bin = atob(ALPES_ALTURAS);
  const h = new Float32Array(ALPES_N * ALPES_N);
  for (let i = 0; i < h.length; i++) h[i] = (bin.charCodeAt(i * 2) | (bin.charCodeAt(i * 2 + 1) << 8)) / 65535;
  const sb = atob(ALPES_NEVE);
  const s = new Float32Array(ALPES_N * ALPES_N);
  for (let i = 0; i < s.length; i++) s[i] = sb.charCodeAt(i) / 255;
  return { h, s };
}

// amostra com repetição espelhada (sem emendas) e interpolação
function sampleMirror(arr, u, v) {
  const n = ALPES_N;
  const m = (t) => {
    const f = ((t % 2) + 2) % 2;
    return (f > 1 ? 2 - f : f) * (n - 1);
  };
  const x = m(u);
  const y = m(v);
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(n - 1, x0 + 1);
  const y1 = Math.min(n - 1, y0 + 1);
  const fx = x - x0;
  const fy = y - y0;
  const a = arr[y0 * n + x0] * (1 - fx) + arr[y0 * n + x1] * fx;
  const b = arr[y1 * n + x0] * (1 - fx) + arr[y1 * n + x1] * fx;
  return a * (1 - fy) + b * fy;
}

// até onde dá para nadar: a borda do terreno menos esta folga (m)
const BALANCE_MAR = 40;

export const BIOME = {
  SEA: 0,
  BEACH: 1,
  JUNGLE: 2,  // Floresta Amazônica
  IGAPO: 3,   // floresta alagada na beira do pântano
  SWAMP: 4,
  SNOW: 5,    // Lapônia: neve, rocha, pinheiros
};

// Chave de cada bioma no arquivo data/world/ilha.json
export const BIOME_KEYS = ['mar', 'praia', 'selva', 'igapo', 'pantano', 'neve'];

const C = (hex) => new THREE.Color(hex);
const COLORS = {
  sand: C('#c9b384'),
  wetSand: C('#9c8a62'),
  seaShallow: C('#a99a6e'),
  seaDeep: C('#3d5b55'),
  soil: C('#4a3a27'),
  litter: C('#6b4f31'),
  moss: C('#3d5427'),
  darkSoil: C('#2f2a1d'),
  mud: C('#3b3725'),
  swampMoss: C('#455327'),
  igapo: C('#3a3f25'),
  rock: C('#5f6164'),
  rockDark: C('#3e3f42'),
  tundra: C('#6f6a5c'),
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

    // Pântano: união de vários círculos com o mesmo nível de água.
    const p = layout.pantano;
    this.swamp = { level: p.nivel_agua_m, parts: p.partes };
    // Retângulo que contém o pântano (a água só existe dentro dele).
    let x0 = Infinity; let x1 = -Infinity; let z0 = Infinity; let z1 = -Infinity;
    for (const c of p.partes) {
      x0 = Math.min(x0, c.x - c.raio_m); x1 = Math.max(x1, c.x + c.raio_m);
      z0 = Math.min(z0, c.z - c.raio_m); z1 = Math.max(z1, c.z + c.raio_m);
    }
    const m = 45;
    this.swamp.rect = { x0: x0 - m, x1: x1 + m, z0: z0 - m, z1: z1 + m };

    this.nCoast = createNoise2D(seed + 1);
    this.nHill = createNoise2D(seed + 2);
    this.nRidge = createNoise2D(seed + 3);
    this.nWet = createNoise2D(seed + 4);
    this.nForest = createNoise2D(seed + 5);
    this.nDetail = createNoise2D(seed + 6);
    this.nRegion = createNoise2D(seed + 7);
    this.nRock = createNoise2D(seed + 8);

    // contorno da Finlândia em metros do jogo
    const pr = layout.projecao;
    this.poly = layout.contorno.map(([lon, lat]) => [(lon - pr.lon0) * pr.m_por_grau_lon, -(lat - pr.lat0) * pr.m_por_grau_lat]);
    this.lap = layout.laponia;
    this.alps = decodeAlps();

    const n = this.verts * this.verts;
    this.heights = new Float32Array(n);
    this.coast = new Float32Array(n);
    this.biomes = new Uint8Array(n);
    this.colors = new Float32Array(n * 3);
    this.snow = new Float32Array(n); // 0 = sem neve, 1 = neve (Lapônia)

    this._generate();
  }

  // ----------------------------------------------------------
  // Distância até a costa (positivo = em terra), pelo contorno da Finlândia.
  coastDistance(x, z) {
    const P = this.poly;
    let inside = false;
    let best = Infinity;
    for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
      const [xi, zi] = P[i];
      const [xj, zj] = P[j];
      if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
      const ex = xj - xi;
      const ez = zj - zi;
      const t = clamp(((x - xi) * ex + (z - zi) * ez) / (ex * ex + ez * ez || 1), 0, 1);
      const d = (x - xi - ex * t) ** 2 + (z - zi - ez * t) ** 2;
      if (d < best) best = d;
    }
    const wobble = fbm(this.nCoast, x * 0.0045, z * 0.0045, 4) * this.L.variacao_costa_m;
    return (inside ? Math.sqrt(best) : -Math.sqrt(best)) + wobble;
  }

  // Lapônia: 0 = sul, 1 = neve. Borda irregular.
  snowRegion(x, z) {
    const zs = this.lap.inicio_z + fbm(this.nRegion, x * 0.004 + 9, 3.1, 3) * 45;
    return smoothstep(zs + 50, zs - 50, z);
  }

  // Montanhas gigantes: relevo dos Alpes, mais detalhes de rocha.
  mountainHeight(x, z, coastD) {
    const L = this.lap;
    const zm = L.montanhas_z + fbm(this.nRegion, x * 0.003 - 4, 7.7, 3) * 60;
    const m = smoothstep(zm + 70, zm - 90, z) * smoothstep(10, 110, coastD);
    if (m <= 0) return 0;
    const u = x / L.periodo_m + 0.37;
    const v = z / L.periodo_m + 0.11;
    const a = sampleMirror(this.alps.h, u, v);
    // picos altos e afiados; vales continuam baixos
    let h = Math.pow(a, 1.35) * L.altura_max_m;
    // rocha quebrada (não fica "lisa"): cristas finas + calombos
    const ridge = 1 - Math.abs(fbm(this.nRock, x * 0.028, z * 0.028, 3));
    h += (Math.pow(ridge, 3) * 9 + fbm(this.nRock, x * 0.11 + 30, z * 0.11, 2) * 1.6) * smoothstep(0.08, 0.35, a);
    // degraus de rocha (saliências) nas encostas: a montanha não fica lisa
    const step = 7 + fbm(this.nRock, x * 0.01, z * 0.01, 2) * 3;
    const q = h / step;
    const terr = (Math.floor(q) + smoothstep(0.55, 1, q - Math.floor(q))) * step;
    h = lerp(h, terr, 0.55 * smoothstep(0.12, 0.4, a));
    return h * m;
  }

  // "Quanto dentro do pântano": > 0 dentro, < 0 fora (com borda irregular).
  swampField(x, z) {
    let s = -Infinity;
    for (const c of this.swamp.parts) s = Math.max(s, 1 - Math.hypot(x - c.x, z - c.z) / c.raio_m);
    return s + fbm(this.nRegion, x * 0.008, z * 0.008, 3) * 0.14;
  }

  swampMask(x, z) {
    return smoothstep(0.0, 0.3, this.swampField(x, z));
  }

  // Metros até a borda do retângulo do pântano (positivo = dentro).
  _rectInside(x, z) {
    const r = this.swamp.rect;
    return Math.min(x - r.x0, r.x1 - x, z - r.z0, r.z1 - z);
  }

  // Densidade da mata (0 a 1): quase sempre fechada, com algumas clareiras.
  forestDensity(x, z) {
    return clamp(0.8 + fbm(this.nForest, x * 0.006 + 40, z * 0.006 - 20, 3) * 0.7, 0.15, 1);
  }

  // ----------------------------------------------------------
  rawHeight(x, z, coastD) {
    const L = this.L;
    const d = coastD;
    let h;
    if (d <= 0) {
      h = -Math.min(L.profundidade_mar_m, -d * 0.16);
      h += this.nDetail(x * 0.02, z * 0.02) * 0.6 * smoothstep(0, 40, -d);
    } else {
      const praia = L.altura_praia_m * smoothstep(0, L.largura_praia_m, d);
      const planicie = (L.altura_planicie_m - L.altura_praia_m) *
        smoothstep(L.largura_praia_m * 0.6, L.largura_praia_m + 110, d);
      const inland = smoothstep(L.largura_praia_m, L.largura_praia_m + 140, d);
      // morros + grotas (vales estreitos)
      const colinas = fbm(this.nHill, x * 0.0065, z * 0.0065, 4) * L.altura_colinas_m;
      const ridge = 1 - Math.abs(fbm(this.nRidge, x * 0.009, z * 0.009, 3));
      const grotas = -Math.pow(ridge, 4) * 7;
      h = praia + planicie + (colinas + grotas) * inland;
      h += this.mountainHeight(x, z, d);
    }
    return this._applySwamp(x, z, h);
  }

  // Pântano: chão baixo e encharcado, com poças e ilhotas; borda
  // levantada para a água não "vazar" para fora.
  _applySwamp(x, z, h) {
    const s = this.swamp;
    const inRect = this._rectInside(x, z);
    if (inRect < -30) return h;
    let out = h;
    // perto da borda do retângulo: chão sempre acima da água
    const edge = smoothstep(32, 6, inRect);
    out = lerp(out, Math.max(out, s.level + 0.7), edge);
    const S = this.swampField(x, z);
    // borda (igapó): chão um pouco acima da água
    const rim = smoothstep(-0.35, -0.02, S) * (1 - smoothstep(-0.02, 0.12, S));
    out = lerp(out, Math.min(out, s.level + 1.2 + Math.max(0, -S) * 18), rim * 0.85);
    // dentro: lama na altura da água, com poças e ilhotas
    const wet = s.level + fbm(this.nWet, x * 0.022, z * 0.022, 3) * 2.0 - 0.35;
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
        const biome = this._classify(x, z, h, this.coast[idx]);
        this.biomes[idx] = biome;
        if (biome === BIOME.SNOW) this.snow[idx] = this._snowAmount(x, z, h, normalY);
        this._colorFor(c, biome, x, z, h, normalY);
        this.colors[idx * 3] = c.r;
        this.colors[idx * 3 + 1] = c.g;
        this.colors[idx * 3 + 2] = c.b;
      }
    }
  }

  _classify(x, z, h, coastD) {
    if (h < 0.2) return BIOME.SEA;
    if (this.snowRegion(x, z) > 0.5) return BIOME.SNOW;
    if (h < 2.6 && coastD < this.L.largura_praia_m * 1.7) return BIOME.BEACH;
    const S = this.swampField(x, z);
    if (S > 0.08) return BIOME.SWAMP;
    if (S > -0.3 && h < this.swamp.level + 4) return BIOME.IGAPO;
    return BIOME.JUNGLE;
  }

  // Quanto de neve cobre o chão: pouca nas paredes íngremes (rocha
  // exposta), a máscara dos Alpes risca a neve nas encostas.
  _snowAmount(x, z, h, normalY) {
    const L = this.lap;
    const mask = sampleMirror(this.alps.s, x / L.periodo_m + 0.37, z / L.periodo_m + 0.11);
    // paredão íngreme = rocha; no alto neva mais (só os paredões ficam de fora).
    // A máscara dos Alpes risca a neve (rochas aparecendo em listras).
    const high = smoothstep(30, 150, h);
    const thr = 0.7 - 0.22 * high + (1 - mask) * 0.12 + fbm(this.nDetail, x * 0.04, z * 0.04, 2) * 0.08;
    return clamp((normalY - thr) * 7 + 0.5, 0, 1);
  }

  _colorFor(out, biome, x, z, h, normalY) {
    const n1 = this.nDetail(x * 0.05, z * 0.05);
    const n2 = this.nDetail(x * 0.013 + 50, z * 0.013);
    switch (biome) {
      case BIOME.SEA:
        out.copy(COLORS.seaShallow).lerp(COLORS.seaDeep, smoothstep(0, 14, -h));
        break;
      case BIOME.BEACH:
        out.copy(COLORS.wetSand).lerp(COLORS.sand, smoothstep(0.2, 1.4, h));
        break;
      case BIOME.JUNGLE:
        // terra, folhas secas e musgo misturados
        out.copy(COLORS.soil).lerp(COLORS.litter, clamp(n2 * 0.9 + 0.45, 0, 1));
        out.lerp(COLORS.moss, clamp(n1 * 0.8 + 0.25, 0, 0.8));
        out.lerp(COLORS.darkSoil, smoothstep(0.85, 0.6, normalY) * 0.6);
        break;
      case BIOME.IGAPO:
        out.copy(COLORS.igapo).lerp(COLORS.litter, clamp(n2 * 0.6 + 0.2, 0, 0.6));
        break;
      case BIOME.SNOW:
        // rocha (a neve é pintada por cima no shader do terreno)
        out.copy(COLORS.rock).lerp(COLORS.rockDark, clamp(n2 * 0.8 + 0.4, 0, 1));
        // camadas de rocha (estratos) nos paredões
        out.multiplyScalar(0.82 + 0.3 * (0.5 + 0.5 * Math.sin(h * 0.55 + n1 * 3)));
        out.lerp(COLORS.tundra, smoothstep(30, 8, h) * 0.6);
        break;
      case BIOME.SWAMP:
        out.copy(COLORS.swampMoss).lerp(COLORS.mud, smoothstep(this.swamp.level + 0.8, this.swamp.level, h));
        break;
      default:
        out.copy(COLORS.soil);
    }
    out.multiplyScalar(1 + n1 * 0.06);
  }

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

  // Dentro da área do mapa (com folga de margin metros)?
  inside(x, z, margin = 0) {
    const lim = this.half - BALANCE_MAR - margin;
    return Math.abs(x) < lim && Math.abs(z) < lim;
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

  // Textura com as alturas (a água usa para saber a profundidade).
  heightTexture() {
    if (this._hTex) return this._hTex;
    const n = this.verts;
    const data = new Uint16Array(n * n);
    for (let i = 0; i < n * n; i++) data[i] = THREE.DataUtils.toHalfFloat(this.heights[i]);
    const tex = new THREE.DataTexture(data, n, n, THREE.RedFormat, THREE.HalfFloatType);
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.needsUpdate = true;
    this._hTex = tex;
    return tex;
  }
}
