// =============================================================
// GERADOR DO MAPA
// Formato do The Island do ARK (contorno em ilha.json). Floresta (morros,
// grotas e mata fechada) com pântano no sudoeste, igapó em volta,
// praia na costa, o Vulcão perto do centro e, no noroeste, as montanhas
// nevadas: gigantes com neve e rocha (relevo tirado do modelo "Snow alps").
// Tudo vem de uma "semente": a mesma semente gera sempre a mesma
// ilha (importante para o save nas próximas fases).
// =============================================================
import * as THREE from 'three';
import { createNoise2D, fbm } from '../core/noise.js';
import { clamp, lerp, smoothstep, mulberry32 } from '../core/math.js';
import { ALPES_N, ALPES_ALTURAS } from './textures/alpes.js';
import { MONTANHA_N, MONTANHA_ALTURAS, MONTANHA_NEVE } from './textures/montanha.js';

// Relevos dos modelos (0..1), lidos uma vez:
//  - Great Mountain: a grande montanha da Lapônia (+ máscara de neve)
//  - Snow alps: colinas menores em volta
function decodeU16(b64, n) {
  const bin = atob(b64);
  const h = new Float32Array(n * n);
  for (let i = 0; i < h.length; i++) h[i] = (bin.charCodeAt(i * 2) | (bin.charCodeAt(i * 2 + 1) << 8)) / 65535;
  return h;
}
function decodeU8(b64, n) {
  const bin = atob(b64);
  const s = new Float32Array(n * n);
  for (let i = 0; i < s.length; i++) s[i] = bin.charCodeAt(i) / 255;
  return s;
}
function peakOf(h, n) {
  let best = 0;
  for (let i = 1; i < h.length; i++) if (h[i] > h[best]) best = i;
  return { u: (best % n) / (n - 1), v: Math.floor(best / n) / (n - 1) };
}

// amostra com repetição espelhada (sem emendas) e interpolação
function sampleMirror(arr, n, u, v) {
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
  HIGHLAND: 6, // Serra Rochosa: morros de pedra (metal, obsidiana, cristal)
  PLAINS: 7,   // Campos: planície aberta de capim (manadas)
};

// Chave de cada bioma no arquivo data/world/ilha.json
export const BIOME_KEYS = ['mar', 'praia', 'selva', 'igapo', 'pantano', 'neve', 'serra', 'campos'];

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
  serraRock: C('#7a7064'),
  serraDark: C('#4f4840'),
  serraGrass: C('#5e6a3a'),
  plainsGrass: C('#4a7428'),
  plainsDry: C('#76843a'),
  ash: C('#35302d'),
  ember: C('#6a2e1c'),
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

    // contorno da ilha em metros do jogo (+ ilhotas em volta)
    this.poly = layout.contorno.map(([lon, lat]) => this.project(lon, lat));
    this.islets = (layout.ilhotas ?? []).map((o) => {
      const [x, z] = this.project(o.lon, o.lat);
      return { x, z, r: o.raio * layout.projecao.m_por_unidade };
    });
    this.extra = layout.terras_extra ?? []; // terra nova (leste e sul), unida ao contorno
    this.lap = layout.laponia;
    this.volc = layout.vulcao;
    this.alpsH = decodeU16(ALPES_ALTURAS, ALPES_N);
    this.mtnH = decodeU16(MONTANHA_ALTURAS, MONTANHA_N);
    this.mtnS = decodeU8(MONTANHA_NEVE, MONTANHA_N);
    // o pico do modelo cai em pico_x / pico_z
    const gm = this.lap.grande_montanha;
    const pk = peakOf(this.mtnH, MONTANHA_N);
    this.mtnU0 = pk.u - gm.pico_x / gm.largura_m;
    this.mtnV0 = pk.v - gm.pico_z / gm.largura_m;

    const n = this.verts * this.verts;
    this.heights = new Float32Array(n);
    this.coast = new Float32Array(n);
    this.biomes = new Uint8Array(n);
    this.colors = new Float32Array(n * 3);
    this.snow = new Float32Array(n); // 0 = sem neve, 1 = neve (Lapônia)

    this._generate();
  }

  // ----------------------------------------------------------
  // [longitude, latitude] (0 a 100, como o mapa do ARK) -> [x, z] do jogo.
  project(lon, lat) {
    const pr = this.L.projecao;
    return [(lon - pr.lon0) * pr.m_por_unidade, (lat - pr.lat0) * pr.m_por_unidade];
  }

  // Distância até a costa (positivo = em terra), pelo contorno da ilha e das ilhotas.
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
    let d = inside ? Math.sqrt(best) : -Math.sqrt(best);
    for (const o of this.islets) d = Math.max(d, o.r - Math.hypot(x - o.x, z - o.z));
    for (const o of this.extra) d = Math.max(d, o.raio_m - Math.hypot(x - o.x, z - o.z));
    return d + wobble;
  }

  // Montanhas nevadas: 0 = fora, 1 = neve (círculo de laponia.regiao, borda irregular).
  snowRegion(x, z) {
    const R = this.lap.regiao;
    const d = Math.hypot(x - R.x, z - R.z) + fbm(this.nRegion, x * 0.004 + 9, z * 0.004 + 3.1, 3) * 70;
    return smoothstep(R.raio_m + 50, R.raio_m - 50, d);
  }

  // O Vulcão: 1 no topo, 0 fora do cone.
  volcanoWeight(x, z) {
    const V = this.volc;
    if (!V) return 0;
    const d = Math.hypot(x - V.x, z - V.z) + fbm(this.nRegion, x * 0.005 + 21, z * 0.005 - 7, 3) * 40;
    return smoothstep(V.raio_m, V.raio_m * 0.15, d);
  }

  // Altura do cone do Vulcão: encostas com ravinas e cratera no topo.
  volcanoHeight(x, z) {
    const V = this.volc;
    const w = this.volcanoWeight(x, z);
    if (w <= 0) return 0;
    const d = Math.hypot(x - V.x, z - V.z);
    // cone um pouco côncavo (sobe mais rápido perto do topo)
    let h = V.altura_m * Math.pow(w, 1.35);
    // ravinas de lava escorrendo pelas encostas
    const ang = Math.atan2(z - V.z, x - V.x);
    h *= 1 + 0.07 * Math.sin(ang * 9 + fbm(this.nRock, x * 0.01, z * 0.01, 2) * 4) * smoothstep(0.1, 0.5, w);
    // cratera
    const cr = V.cratera_raio_m;
    if (d < cr * 1.6) h -= V.cratera_fundo_m * smoothstep(cr * 1.6, cr * 0.5, d);
    return h;
  }

  // Quanto a Grande Montanha "manda" aqui (1 perto do pico, 0 longe).
  bigMountainWeight(x, z) {
    const gm = this.lap.grande_montanha;
    const d = Math.hypot(x - gm.pico_x, z - gm.pico_z) + fbm(this.nRegion, x * 0.003, z * 0.003, 3) * 90;
    return smoothstep(gm.raio_m, gm.raio_m * 0.4, d);
  }

  // Lapônia: a Grande Montanha (modelo Great Mountain) + colinas (Snow alps).
  mountainHeight(x, z, coastD) {
    const L = this.lap;
    const region = this.snowRegion(x, z);
    const coast = smoothstep(5, 220, coastD);
    // Grande Montanha
    const gm = L.grande_montanha;
    const wM = this.bigMountainWeight(x, z) * smoothstep(-10, 160, coastD);
    let h = 0;
    if (wM > 0) {
      const a = sampleMirror(this.mtnH, MONTANHA_N, (x - 0) / gm.largura_m + this.mtnU0, (z - 0) / gm.largura_m + this.mtnV0);
      h = a * gm.altura_m * wM;
    }
    // colinas em volta (mais baixas)
    if (region > 0) {
      const c = L.colinas;
      const a2 = sampleMirror(this.alpsH, ALPES_N, x / c.periodo_m + 0.3, z / c.periodo_m + 0.7);
      h += a2 * c.altura_m * region * coast * (1 - wM);
    }
    if (h <= 0.5) return h;
    // rocha quebrada (não fica "lisa"): calombos e degraus pequenos
    const rough = smoothstep(20, 80, h);
    h += fbm(this.nRock, x * 0.09 + 30, z * 0.09, 2) * 1.2 * rough;
    const step = 6 + fbm(this.nRock, x * 0.01, z * 0.01, 2) * 2;
    const q = h / step;
    const terr = (Math.floor(q) + smoothstep(0.25, 1, q - Math.floor(q))) * step;
    return lerp(h, terr, 0.18 * rough);
  }

  // Regiões dos biomas novos (círculos do ilha.json com borda irregular):
  // > 0 dentro, < 0 fora.
  _regionField(list, x, z, seedOff) {
    if (!list?.length) return -1;
    let s = -Infinity;
    for (const c of list) s = Math.max(s, 1 - Math.hypot(x - c.x, z - c.z) / c.raio_m);
    return s + fbm(this.nRegion, x * 0.006 + seedOff, z * 0.006 - seedOff, 3) * 0.22;
  }

  highlandField(x, z) {
    return this._regionField(this.L.serras, x, z, 31);
  }

  plainsField(x, z) {
    return this._regionField(this.L.campos, x, z, 77);
  }

  // Altura extra da Serra Rochosa: morros de pedra com cristas
  highlandHeight(x, z) {
    const f = this.highlandField(x, z);
    if (f <= 0) return 0;
    const k = smoothstep(0, 0.45, f);
    const ridge = 1 - Math.abs(fbm(this.nRidge, x * 0.012 + 5, z * 0.012 - 9, 4));
    const bumps = fbm(this.nRock, x * 0.03, z * 0.03, 3);
    const top = (this.L.serras.find((c) => Math.hypot(x - c.x, z - c.z) < c.raio_m * 1.3)?.altura_m) ?? 50;
    return k * (top * (0.35 + 0.65 * ridge * ridge) + bumps * 4);
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
      // Campos: planície mais lisa (menos morro)
      const pf = this.plainsField(x, z);
      if (pf > 0) h -= (colinas + grotas) * inland * smoothstep(0, 0.4, pf) * 0.6;
      h += this.highlandHeight(x, z) * inland;
      h += this.volcanoHeight(x, z) * inland;
      h += this.mountainHeight(x, z, d);
      h = this._plateaus(x, z, h);
    }
    return this._applySwamp(x, z, h);
  }

  // Está em cima (ou na borda) de um platô? (sem árvores nem pedras lá)
  onPlateau(x, z) {
    for (const p of this.lap.platos ?? []) if (Math.hypot(x - p.x, z - p.z) < p.raio_m * 1.25 + 15) return true;
    return false;
  }

  // Pedras gigantes de topo plano (laponia.platos): paredão de rocha em
  // volta e uma rampa de um lado para subir. O topo é plano para construir.
  _plateaus(x, z, h) {
    const list = this.lap.platos;
    if (!list) return h;
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      const dx = x - p.x;
      const dz = z - p.z;
      const far = p.raio_m + 90;
      if (dx * dx + dz * dz > far * far) continue;
      if (this._plateauTop === undefined) this._plateauTop = [];
      if (this._plateauTop[i] === undefined) {
        // topo = chão do centro (sem os platôs) + altura
        this._plateauTop[i] = -Infinity;
        this._plateauTop[i] = this.rawHeight(p.x, p.z, this.coastDistance(p.x, p.z)) + p.altura_m;
      }
      const top = this._plateauTop[i];
      if (top === -Infinity) continue;
      const r = Math.hypot(dx, dz);
      // borda irregular (pedra quebrada)
      const ang = Math.atan2(dz, dx);
      const R = p.raio_m * (1 + 0.12 * Math.sin(ang * 3 + i) + 0.07 * Math.sin(ang * 7 + i * 2));
      // topo: quase plano (calombos de 20 cm)
      const flat = top + fbm(this.nRock, x * 0.08, z * 0.08, 2) * 0.2;
      // paredão quase reto
      const cliff = flat - smoothstep(R, R + 9, r) * p.altura_m * 1.6;
      // rampa (10 m de largura, ~27°)
      const ra = ((p.rampa_graus ?? 0) * Math.PI) / 180;
      const along = dx * Math.cos(ra) + dz * Math.sin(ra);
      const side = Math.abs(-dx * Math.sin(ra) + dz * Math.cos(ra));
      let ramp = -Infinity;
      if (along > 0 && side < 5 + 3 * smoothstep(5, 0, along - R)) ramp = flat - Math.max(0, along - R * 0.85) * 0.5;
      h = Math.max(h, cliff, ramp);
    }
    return h;
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
    // Mar aberto longe da costa: a conta da costa (a mais cara) é feita numa grade grossa (a cada 100 m);
    // onde os 4 cantos estão bem dentro do mar, o fundo é o mesmo em todo lugar (a altura é a fórmula do mar
    // fundo, igual à de rawHeight para d < -175), então pula a conta fina.
    const GS = 100;
    const gn = Math.ceil(this.size / GS) + 2;
    const coarse = new Float32Array(gn * gn);
    for (let gj = 0; gj < gn; gj++) for (let gi = 0; gi < gn; gi++) coarse[gj * gn + gi] = this.coastDistance(gi * GS - this.half, gj * GS - this.half);
    for (let j = 0; j < v; j++) {
      const z = j * this.cell - this.half;
      const gj = Math.floor((z + this.half) / GS);
      for (let i = 0; i < v; i++) {
        const x = i * this.cell - this.half;
        const idx = j * v + i;
        const gi = Math.floor((x + this.half) / GS);
        const c0 = coarse[gj * gn + gi];
        const c1 = coarse[gj * gn + gi + 1];
        const c2 = coarse[(gj + 1) * gn + gi];
        const c3 = coarse[(gj + 1) * gn + gi + 1];
        if (Math.max(c0, c1, c2, c3) < -420) {
          const dd = (c0 + c1 + c2 + c3) / 4;
          this.coast[idx] = dd;
          this.heights[idx] = -this.L.profundidade_mar_m + this.nDetail(x * 0.02, z * 0.02) * 0.6;
          continue;
        }
        const d = this.coastDistance(x, z);
        this.coast[idx] = d;
        this.heights[idx] = this.rawHeight(x, z, d);
      }
    }
    this._carveStreams();
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

  // ----------------------------------------------------------
  // CÓRREGOS: nascem nos morros da mata e descem pelo caminho mais baixo
  // até o pântano, o mar ou uma baixada (vira um laguinho). O leito é
  // cavado no chão e a água desce em degraus (pequenas quedas).
  // Cada trecho guarda o seu nível de água: this.streams[].pts[].level
  _carveStreams() {
    const C = this.L.corregos;
    this.streams = [];
    if (!C) return;
    const rand = mulberry32(this.seed * 7 + 11);
    const v = this.verts;
    const H = this.heights;
    const hAt = (x, z) => {
      const i = clamp(Math.round((x + this.half) / this.cell), 0, v - 1);
      const j = clamp(Math.round((z + this.half) / this.cell), 0, v - 1);
      return H[j * v + i];
    };
    const halfW = C.largura_m / 2;
    let tries = 0;
    while (this.streams.length < C.quantidade && tries++ < C.quantidade * 120) {
      // nascente: morro da mata (longe do pântano, da costa e da neve)
      const x0 = (rand() - 0.5) * this.size * 0.8;
      const z0 = C.z_min + rand() * (C.z_max - C.z_min);
      const d0 = this.coastDistance(x0, z0);
      if (d0 < 150 || this.snowRegion(x0, z0) > 0.05 || this.swampField(x0, z0) > -0.25) continue;
      const h0 = hAt(x0, z0);
      if (h0 < C.altura_nascente_m) continue;
      // desce: passos de 5 m para onde o chão é mais baixo (com curvas)
      const pts = [{ x: x0, z: z0 }];
      let x = x0;
      let z = z0;
      let dir = rand() * Math.PI * 2;
      let flat = 0;
      let end = null;
      for (let s = 0; s < C.comprimento_max_m / 5; s++) {
        const here = hAt(x, z);
        let best = null;
        let bestH = Infinity;
        for (let k = -3; k <= 3; k++) {
          const a = dir + k * 0.35;
          const nx = x + Math.cos(a) * 5;
          const nz = z + Math.sin(a) * 5;
          // prefere seguir reto (curvas suaves) e descer
          const hh = hAt(nx, nz) + Math.abs(k) * 0.12 + (rand() - 0.5) * 0.15;
          if (hh < bestH) {
            bestH = hh;
            best = { x: nx, z: nz, a };
          }
        }
        if (!best) break;
        flat = bestH > here - 0.02 ? flat + 1 : 0;
        dir = best.a;
        x = best.x;
        z = best.z;
        pts.push({ x, z });
        if (this.coastDistance(x, z) < 25 || hAt(x, z) < 1) { end = 'mar'; break; }
        if (this.swampField(x, z) > -0.05) { end = 'pantano'; break; }
        if (flat > 8) { end = 'lago'; break; }
      }
      if (pts.length * 5 < C.comprimento_min_m) continue;
      // longe dos outros córregos
      if (this.streams.some((st) => st.pts.some((p) => Math.hypot(p.x - x0, p.z - z0) < 120))) continue;
      // nível da água: sempre descendo (leito "esculpido")
      let lvl = Infinity;
      for (const p of pts) {
        lvl = Math.min(lvl, hAt(p.x, p.z) - C.profundidade_m * 0.45);
        p.level = Math.max(lvl, 0.15);
      }
      // suaviza: média com os vizinhos, sem subir (a água só desce)
      for (let pass = 0; pass < 3; pass++) {
        for (let k = 1; k < pts.length - 1; k++) {
          const m = (pts[k - 1].level + pts[k].level + pts[k + 1].level) / 3;
          pts[k].level = Math.min(pts[k - 1].level, Math.max(m, pts[k + 1].level));
        }
      }
      this.streams.push({ pts, halfW, end });
    }
    // cava o leito: perto da linha do córrego o chão desce até o fundo
    for (const st of this.streams) {
      const R = halfW + C.margem_m;
      let minX = Infinity; let maxX = -Infinity; let minZ = Infinity; let maxZ = -Infinity;
      for (const p of st.pts) {
        minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
        minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z);
      }
      const i0 = Math.max(0, Math.floor((minX - R + this.half) / this.cell));
      const i1 = Math.min(v - 1, Math.ceil((maxX + R + this.half) / this.cell));
      const j0 = Math.max(0, Math.floor((minZ - R + this.half) / this.cell));
      const j1 = Math.min(v - 1, Math.ceil((maxZ + R + this.half) / this.cell));
      for (let j = j0; j <= j1; j++) {
        const zz = j * this.cell - this.half;
        for (let i = i0; i <= i1; i++) {
          const xx = i * this.cell - this.half;
          const q = this._nearestStreamPoint(st, xx, zz);
          if (q.d > R) continue;
          const idx = j * v + i;
          const bed = q.level - C.profundidade_m * 0.6;
          // a grade do chão tem 5 m: o leito precisa ter pelo menos uma
          // célula de largura para a água não aparecer fora dele
          const inner = Math.max(halfW, this.cell * 0.8);
          if (q.d < inner) {
            // leito: fundo liso, um pouco mais fundo no meio
            H[idx] = Math.min(H[idx], lerp(bed, q.level - 0.3, q.d / inner));
          } else {
            // margem: barranco suave que sempre fica acima da água (a água
            // não "flutua" sobre chão mais baixo) e emenda no terreno
            const bank = q.level + 0.4;
            const k = smoothstep(R + inner - halfW, inner, q.d);
            H[idx] = lerp(H[idx], Math.max(bank, Math.min(H[idx], bank + (q.d - inner) * 0.55)), k);
          }
        }
      }
    }
  }

  // Ponto do córrego mais perto de (x, z): distância e nível da água ali.
  _nearestStreamPoint(st, x, z) {
    let best = Infinity;
    let level = 0;
    const P = st.pts;
    for (let k = 0; k < P.length - 1; k++) {
      const a = P[k];
      const b = P[k + 1];
      const ex = b.x - a.x;
      const ez = b.z - a.z;
      const t = clamp(((x - a.x) * ex + (z - a.z) * ez) / (ex * ex + ez * ez || 1), 0, 1);
      const d = Math.hypot(x - a.x - ex * t, z - a.z - ez * t);
      if (d < best) {
        best = d;
        level = a.level + (b.level - a.level) * t; // água desce em rampa
      }
    }
    return { d: best, level };
  }

  _classify(x, z, h, coastD) {
    if (h < 0.2) return BIOME.SEA;
    if (this.snowRegion(x, z) > 0.5) return BIOME.SNOW;
    if (h < 2.6 && coastD < this.L.largura_praia_m * 1.7) return BIOME.BEACH;
    const S = this.swampField(x, z);
    if (S > 0.08) return BIOME.SWAMP;
    if (S > -0.3 && h < this.swamp.level + 4) return BIOME.IGAPO;
    if (this.volcanoWeight(x, z) > 0.12) return BIOME.HIGHLAND;
    if (this.highlandField(x, z) > 0.12) return BIOME.HIGHLAND;
    if (this.plainsField(x, z) > 0.05) return BIOME.PLAINS;
    return BIOME.JUNGLE;
  }

  // Quanto de neve cobre o chão: pouca nas paredes íngremes (rocha
  // exposta), a máscara dos Alpes risca a neve nas encostas.
  _snowAmount(x, z, h, normalY) {
    // paredão íngreme = rocha; no alto neva mais
    const high = smoothstep(30, 200, h);
    const thr = 0.6 - 0.2 * high + fbm(this.nDetail, x * 0.04, z * 0.04, 2) * 0.06;
    const bySlope = clamp((normalY - thr) * 7 + 0.5, 0, 1);
    // na Grande Montanha a neve/rocha vem da textura do próprio modelo
    const wM = this.bigMountainWeight(x, z);
    if (wM <= 0) return bySlope;
    const gm = this.lap.grande_montanha;
    const mask = sampleMirror(this.mtnS, MONTANHA_N, x / gm.largura_m + this.mtnU0, z / gm.largura_m + this.mtnV0);
    return lerp(bySlope, Math.min(bySlope + 0.3, mask), wM * 0.85);
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
      case BIOME.HIGHLAND:
        // pedra com capim nas partes planas e veios escuros nos paredões
        out.copy(COLORS.serraRock).lerp(COLORS.serraDark, clamp(n2 * 0.8 + 0.4, 0, 1));
        out.multiplyScalar(0.85 + 0.25 * (0.5 + 0.5 * Math.sin(h * 0.7 + n1 * 3)));
        out.lerp(COLORS.serraGrass, smoothstep(0.82, 0.95, normalY) * smoothstep(55, 25, h) * 0.75);
        // Vulcão: cinza escura e basalto, com veios avermelhados perto da cratera
        {
          const vw = this.volcanoWeight(x, z);
          if (vw > 0) {
            out.lerp(COLORS.ash, smoothstep(0.05, 0.4, vw) * 0.85);
            out.lerp(COLORS.ember, smoothstep(0.82, 1, vw) * (0.3 + 0.4 * (0.5 + 0.5 * n1)));
          }
        }
        break;
      case BIOME.PLAINS:
        out.copy(COLORS.plainsGrass).lerp(COLORS.plainsDry, clamp(n2 * 0.9 + 0.4, 0, 1));
        out.lerp(COLORS.soil, clamp(n1 * 0.6, 0, 0.35));
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
