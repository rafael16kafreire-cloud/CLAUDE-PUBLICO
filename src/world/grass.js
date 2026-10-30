// =============================================================
// MATO DO CHÃO – capim, plantinhas de folha larga e brotos de
// samambaia balançando com o vento.
// Só existe num raio em volta do jogador: quando ele anda, o mato
// é "replantado" à frente. Assim o chão inteiro parece coberto sem
// pesar no celular.
// =============================================================
import * as THREE from 'three';
import { BIOME } from './island_generator.js';
import { addWind } from './materials.js';
import { makeBroadPlant, makeSprout, makeFlowerTuft, makeMiniPlant, makeLowTuft, makeGramaCartao } from './props.js';
import ATLAS from './imported/grama_atlas.js';

const CELL = 1.25;

// Quanto de cada planta por bioma (0 a 1).
const BY_BIOME = {
  [BIOME.JUNGLE]: { capim: 0.5, folha: 0.22, broto: 0.16, flor: 0.03, tint: [0.9, 1.0, 0.82], relva: 0.5, relvaK: 0.7, mini: 1 }, // chão da mata forrado de mato verde (como a Floresta Negra)
  [BIOME.IGAPO]: { capim: 0.55, folha: 0.15, broto: 0.12, flor: 0.02, tint: [0.92, 0.98, 0.78], mini: 0.8 },
  [BIOME.SWAMP]: { capim: 0.55, folha: 0.05, broto: 0.04, flor: 0.0, tint: [1.0, 0.95, 0.7] },
  [BIOME.BEACH]: { capim: 0.08, folha: 0.0, broto: 0.0, flor: 0.01, tint: [1.15, 1.1, 0.8] },
  [BIOME.HIGHLAND]: { capim: 0.2, folha: 0.0, broto: 0.03, flor: 0.02, tint: [0.95, 0.95, 0.8] },
  // pastagem: o chão é coberto pela relva baixinha (abaixo); capim alto só de vez em quando, e mais baixo
  [BIOME.PLAINS]: { capim: 0.22, folha: 0.02, broto: 0.01, flor: 0.11, tint: [0.78, 0.94, 0.66], hscale: 1.1, relva: true, mini: 0.3 },
};

// cores das flores (laranja do ARK, amarelo e branco-creme)
const FLOWER_COLORS = [[1.0, 0.52, 0.12], [1.0, 0.8, 0.2], [0.98, 0.92, 0.8], [0.9, 0.3, 0.2], [1.0, 0.86, 0.1], [0.55, 0.5, 0.95], [0.95, 0.95, 1.0]];

function cellHash(ix, iz, s = 0) {
  const h = Math.sin(ix * 127.1 + iz * 311.7 + s * 74.7) * 43758.5453;
  return h - Math.floor(h);
}

export class Grass {
  constructor(map, water, scene) {
    this.map = map;
    this.water = water;
    this.radius = 28;
    this.density = 1;
    const material = addWind(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }), 0.25, 0.05, 1);
    // lâmina de um lado só desenhada dos dois lados: a luz não pode virar de cabeça para baixo atrás dela
    const prevCompile = material.onBeforeCompile;
    material.onBeforeCompile = (shader, renderer) => {
      prevCompile?.(shader, renderer);
      shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_begin>', THREE.ShaderChunk.normal_fragment_begin.replace('gl_FrontFacing ? 1.0 : - 1.0', '1.0'));
    };
    const prevKey = material.customProgramCacheKey;
    material.customProgramCacheKey = () => `${prevKey ? prevKey() : ''}-mato1`;
    // grama cheia: figura de tufo recortada pela transparência (dois retângulos em X por tufo)
    const atlasTex = new THREE.TextureLoader().load(ATLAS.png);
    atlasTex.colorSpace = THREE.SRGBColorSpace;
    atlasTex.anisotropy = 2;
    const matGrama = addWind(new THREE.MeshLambertMaterial({ map: atlasTex, alphaTest: 0.45, side: THREE.DoubleSide }), 0.25, 0.05, 1);
    const prevG = matGrama.onBeforeCompile;
    matGrama.onBeforeCompile = (shader, renderer) => {
      prevG?.(shader, renderer);
      shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_begin>', THREE.ShaderChunk.normal_fragment_begin.replace('gl_FrontFacing ? 1.0 : - 1.0', '1.0'));
    };
    const prevGKey = matGrama.customProgramCacheKey;
    matGrama.customProgramCacheKey = () => `${prevGKey ? prevGKey() : ''}-grama2`;
    this.kinds = {
      capim: this._mesh(makeGramaCartao(0, 1), matGrama, 5200, 'Capim'),
      capim2: this._mesh(makeGramaCartao(1, 1), matGrama, 4200, 'Capim 2'),
      folha: this._mesh(makeBroadPlant(), material, 2600, 'Folhagem'),
      broto: this._mesh(makeSprout(), material, 1800, 'Brotos'),
      flor: this._mesh(makeFlowerTuft(), material, 1500, 'Flores'),
      relva: this._mesh(makeGramaCartao(2, 1.12), matGrama, 5200, 'Relva'),
      relva2: this._mesh(makeGramaCartao(3, 0.98), matGrama, 4200, 'Relva 2'),
      longe: this._mesh(makeLowTuft(), material, 16000, 'Grama longe'),
      mini: this._mesh(makeMiniPlant(0), material, 7000, 'Plantinhas'),
      mini2: this._mesh(makeMiniPlant(1), material, 6000, 'Plantinhas 2'),
    };
    this.enabled = true;
    this.lowPoly = false;
    this._last = new THREE.Vector2(1e9, 1e9);
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._s = new THREE.Vector3();
    this._p = new THREE.Vector3();
    this._c = new THREE.Color();
    this._up = new THREE.Vector3(0, 1, 0);
    for (const m of Object.values(this.kinds)) scene.add(m);
  }

  _mesh(geo, mat, max, name) {
    const m = new THREE.InstancedMesh(geo, mat, max);
    m.name = name;
    m.receiveShadow = true;
    m.frustumCulled = false;
    m.count = 0;
    m.userData.max = max;
    m.setColorAt(0, new THREE.Color(1, 1, 1));
    return m;
  }

  setEnabled(on) {
    this.enabled = on;
    for (const m of Object.values(this.kinds)) m.visible = on;
    this._last.set(1e9, 1e9);
  }

  // Jogo lento: só a grama low poly (7 triângulos por tufo), sem cartões, relva nem plantinhas.
  setLowPoly(on) {
    if (this.lowPoly === on) return;
    this.lowPoly = on;
    this._last.set(1e9, 1e9);
  }

  setQuality(radius, density) {
    this.radius = radius;
    this.density = density;
    this._last.set(1e9, 1e9);
  }

  update(focus) {
    if (!this.enabled) return;
    if (this._last.distanceTo(new THREE.Vector2(focus.x, focus.z)) < 5) return;
    this._last.set(focus.x, focus.z);

    const R = this.radius;
    const x0 = Math.floor((focus.x - R) / CELL);
    const x1 = Math.floor((focus.x + R) / CELL);
    const z0 = Math.floor((focus.z - R) / CELL);
    const z1 = this.lowPoly ? z0 - 1 : Math.floor((focus.z + R) / CELL);
    const r2 = R * R;
    const n = { capim: 0, capim2: 0, folha: 0, broto: 0, flor: 0, relva: 0, relva2: 0, mini: 0, mini2: 0, longe: 0 };
    for (let iz = z0; iz <= z1; iz++) {
      for (let ix = x0; ix <= x1; ix++) {
        const x = (ix + cellHash(iz, ix, 1)) * CELL;
        const z = (iz + cellHash(ix, iz, 2)) * CELL;
        const dx = x - focus.x;
        const dz = z - focus.z;
        if (dx * dx + dz * dz > r2) continue;
        const cfg = BY_BIOME[this.map.biomeAt(x, z)];
        if (!cfg) continue;
        // sorteia o tipo de planta deste ponto
        const roll = cellHash(ix, iz, 3) / this.density;
        let kind = null;
        if (roll < cfg.folha) kind = 'folha';
        else if (roll < cfg.folha + cfg.broto) kind = 'broto';
        else if (roll < cfg.folha + cfg.broto + cfg.capim) kind = 'capim';
        else if (roll < cfg.folha + cfg.broto + cfg.capim + cfg.flor) kind = 'flor';
        if (!kind) continue;
        if (kind === 'capim' && cellHash(ix, iz, 9) < 0.45) kind = 'capim2'; // duas formas de tufo
        const mesh = this.kinds[kind];
        if (n[kind] >= mesh.userData.max) continue;
        const h = this.map.heightAt(x, z);
        if (h < 0.5) continue;
        const wb = this.water.bodyAt(x, z);
        if (wb && ((kind !== 'capim' && kind !== 'capim2' && kind !== 'flor') || wb.level - h > 0.25)) continue;
        const fade = 1 - Math.min(1, Math.max(0, (Math.sqrt(dx * dx + dz * dz) - R * 0.72) / (R * 0.28)));
        const sc = (0.7 + cellHash(ix, iz, 4) * 0.7) * (0.15 + 0.85 * fade);
        this._q.setFromAxisAngle(this._up, cellHash(ix, iz, 5) * 6.283);
        this._s.set(sc, sc * (0.8 + cellHash(ix, iz, 6) * 0.5) * (kind === 'capim' || kind === 'capim2' ? (cfg.hscale ?? 1) : 1), sc);
        this._p.set(x, h - 0.03, z);
        this._m.compose(this._p, this._q, this._s);
        mesh.setMatrixAt(n[kind], this._m);
        const v = 0.8 + cellHash(ix, iz, 7) * 0.35;
        if (kind === 'flor') {
          const fc = FLOWER_COLORS[Math.floor(cellHash(ix, iz, 8) * FLOWER_COLORS.length)];
          this._c.setRGB(fc[0], fc[1], fc[2]);
        } else {
          this._c.setRGB(cfg.tint[0] * v, cfg.tint[1] * v, cfg.tint[2] * v);
        }
        mesh.setColorAt(n[kind], this._c);
        n[kind]++;
      }
    }
    // Relva baixinha cobrindo o chão das pastagens: grade fina (cada ponto vira um tufo), só perto do jogador
    const rmesh = this.kinds.relva;
    const rmesh2 = this.kinds.relva2;
    const RC = 0.30 / Math.sqrt(Math.max(0.3, this.density)); // tufos quase encostados: sem falhas no chão // um tufo a cada ~27 cm: um encostando no outro
    // o raio nunca passa do que cabe no limite de tufos (senão a borda ficava falhada)
    const RR = Math.min(this.radius * 0.6, 11, Math.sqrt(((rmesh.userData.max + rmesh2.userData.max) * RC * RC) / Math.PI) * 0.95);
    const rx0 = Math.floor((focus.x - RR) / RC);
    const rx1 = Math.floor((focus.x + RR) / RC);
    const rz0 = Math.floor((focus.z - RR) / RC);
    const rz1 = this.lowPoly ? rz0 - 1 : Math.floor((focus.z + RR) / RC);
    const rr2 = RR * RR;
    for (let iz = rz0; iz <= rz1 && n.relva + n.relva2 < rmesh.userData.max + rmesh2.userData.max; iz++) {
      for (let ix = rx0; ix <= rx1; ix++) {
        const x = (ix + cellHash(iz, ix, 11)) * RC;
        const z = (iz + cellHash(ix, iz, 12)) * RC;
        const dx = x - focus.x;
        const dz = z - focus.z;
        if (dx * dx + dz * dz > rr2) continue;
        // quanto mais longe, menos tufos (e maiores): perto fica cheio, longe fica leve para a placa de vídeo
        const far = Math.min(1, Math.max(0, (Math.sqrt(dx * dx + dz * dz) / RR - 0.3) / 0.7));
        if (cellHash(ix, iz, 21) > 1 - 0.62 * far) continue;
        const rcfg = BY_BIOME[this.map.biomeAt(x, z)];
        if (!rcfg?.relva) continue;
        if (rcfg.relva < 1 && cellHash(ix, iz, 22) > rcfg.relva) continue;
        const rk = cellHash(ix, iz, 19) < 0.5 ? 'relva' : 'relva2';
        const rm = rk === 'relva' ? rmesh : rmesh2;
        if (n[rk] >= rm.userData.max) continue;
        const h = this.map.heightAt(x, z);
        if (h < 0.5 || this.water.bodyAt(x, z)) continue;
        const rfade = 1 - Math.min(1, Math.max(0, (Math.sqrt(dx * dx + dz * dz) - RR * 0.75) / (RR * 0.25)));
        const sc = (0.95 + cellHash(ix, iz, 14) * 0.45) * (0.12 + 0.88 * rfade) * (1 + 0.4 * far);
        this._q.setFromAxisAngle(this._up, cellHash(ix, iz, 15) * 6.283);
        this._s.set(sc, sc * (0.85 + cellHash(ix, iz, 16) * 0.35) * (rcfg.relvaK ?? 1), sc);
        this._p.set(x, h - 0.02, z);
        this._m.compose(this._p, this._q, this._s);
        rm.setMatrixAt(n[rk], this._m);
        const v = 0.78 + cellHash(ix, iz, 17) * 0.4;
        const gold = cellHash(ix, iz, 18);
        // manchas: a maioria verde viva, alguns tufos dourados (como nos campos de Valheim)
        const dry = gold > 0.78 ? 1.38 : gold > 0.6 ? 1.15 : 1;
        // verde mais fundo (como no Valheim), com manchas douradas
        this._c.setRGB(0.74 * v * dry, 0.9 * v, 0.62 * v / dry);
        rm.setColorAt(n[rk], this._c);
        n[rk]++;
      }
    }
    // Plantinhas miúdas cobrindo o chão (só enfeite, sem coleta): grade fina, só perto do jogador
    const MC = 0.38 / Math.sqrt(Math.max(0.3, this.density));
    const mmax = this.kinds.mini.userData.max + this.kinds.mini2.userData.max;
    const MR = Math.min(this.radius * 0.6, 10, Math.sqrt((mmax * MC * MC) / Math.PI) * 0.95);
    const mx0 = Math.floor((focus.x - MR) / MC);
    const mx1 = Math.floor((focus.x + MR) / MC);
    const mz0 = Math.floor((focus.z - MR) / MC);
    const mz1 = this.lowPoly ? mz0 - 1 : Math.floor((focus.z + MR) / MC);
    for (let iz = mz0; iz <= mz1 && n.mini + n.mini2 < mmax; iz++) {
      for (let ix = mx0; ix <= mx1; ix++) {
        const x = (ix + cellHash(iz, ix, 31)) * MC;
        const z = (iz + cellHash(ix, iz, 32)) * MC;
        const dx = x - focus.x;
        const dz = z - focus.z;
        const dd = Math.sqrt(dx * dx + dz * dz);
        if (dd > MR) continue;
        const far = Math.min(1, Math.max(0, (dd / MR - 0.3) / 0.7));
        if (cellHash(ix, iz, 33) > 1 - 0.5 * far) continue;
        const mcfg = BY_BIOME[this.map.biomeAt(x, z)];
        if (!mcfg?.mini || cellHash(ix, iz, 34) > mcfg.mini) continue;
        const mk = cellHash(ix, iz, 35) < 0.55 ? 'mini' : 'mini2';
        const mm = this.kinds[mk];
        if (n[mk] >= mm.userData.max) continue;
        const h = this.map.heightAt(x, z);
        if (h < 0.5 || this.water.bodyAt(x, z)) continue;
        const mfade = 1 - Math.min(1, Math.max(0, (dd - MR * 0.75) / (MR * 0.25)));
        const sc = (0.7 + cellHash(ix, iz, 36) * 0.9) * (0.15 + 0.85 * mfade) * (1 + 0.5 * far);
        this._q.setFromAxisAngle(this._up, cellHash(ix, iz, 37) * 6.283);
        this._s.set(sc, sc, sc);
        this._p.set(x, h - 0.01, z);
        this._m.compose(this._p, this._q, this._s);
        mm.setMatrixAt(n[mk], this._m);
        // verdes variados: musgo, verde vivo, amarelado e alguns avermelhados
        const t = cellHash(ix, iz, 38);
        const v = 0.75 + cellHash(ix, iz, 39) * 0.4;
        if (t < 0.18) this._c.setRGB(1.25 * v, 0.85 * v, 0.6 * v);
        else if (t < 0.4) this._c.setRGB(1.05 * v, 1.12 * v, 0.55 * v);
        else this._c.setRGB(0.8 * v, 1.0 * v, 0.7 * v);
        mm.setColorAt(n[mk], this._c);
        n[mk]++;
      }
    }
    // Grama low poly (7 triângulos por tufo). Normal: grade larga do fim da grama detalhada até longe.
    // Modo lento (lowPoly): é a única grama; perto do jogador os tufos ficam JUNTINHOS (grade fina, quase
    // encostando), e mais longe a grade abre.
    const lmesh = this.kinds.longe;
    const FR = Math.min(Math.max(this.radius * 2.6, 40), 75);
    const dens = Math.sqrt(Math.max(0.3, this.density));
    const rings = this.lowPoly
      ? [{ step: 0.5 / dens, r0: 0, r1: Math.min(15, FR), sc: 1.05 }, { step: 1.1 / dens, r0: Math.min(15, FR), r1: FR, sc: 1.2 }]
      : [{ step: 1.25 / dens, r0: this.radius * 0.55, r1: FR, sc: 1 }];
    for (const ring of rings) {
      const FC = ring.step;
      const fx0 = Math.floor((focus.x - ring.r1) / FC);
      const fx1 = Math.floor((focus.x + ring.r1) / FC);
      const fz0 = Math.floor((focus.z - ring.r1) / FC);
      const fz1 = Math.floor((focus.z + ring.r1) / FC);
      for (let iz = fz0; iz <= fz1 && n.longe < lmesh.userData.max; iz++) {
        for (let ix = fx0; ix <= fx1; ix++) {
          const x = (ix + cellHash(iz, ix, 41)) * FC;
          const z = (iz + cellHash(ix, iz, 42)) * FC;
          const dx = x - focus.x;
          const dz = z - focus.z;
          const dd = Math.sqrt(dx * dx + dz * dz);
          if (dd > ring.r1 || dd < ring.r0) continue;
          const fcfg = BY_BIOME[this.map.biomeAt(x, z)];
          if (!fcfg) continue;
          const pr = Math.min(1, fcfg.capim * 1.6 + (fcfg.relva ? 0.4 : 0) + fcfg.folha + (this.lowPoly ? 0.35 : 0));
          if (cellHash(ix, iz, 43) > pr || n.longe >= lmesh.userData.max) continue;
          const h = this.map.heightAt(x, z);
          if (h < 0.5 || this.water.bodyAt(x, z)) continue;
          const ffade = 1 - Math.min(1, Math.max(0, (dd - FR * 0.8) / (FR * 0.2)));
          const nin = this.lowPoly ? 1 : Math.min(1, (dd - ring.r0) / 4); // some suave perto da borda da grama detalhada
          const sc = (0.9 + cellHash(ix, iz, 44) * 0.6) * ring.sc * (0.2 + 0.8 * ffade) * (0.3 + 0.7 * nin) * (1 + dd / FR * 0.35);
          this._q.setFromAxisAngle(this._up, cellHash(ix, iz, 45) * 6.283);
          this._s.set(sc, sc * (0.8 + cellHash(ix, iz, 46) * 0.5) * (fcfg.hscale ?? 1), sc);
          this._p.set(x, h - 0.03, z);
          this._m.compose(this._p, this._q, this._s);
          lmesh.setMatrixAt(n.longe, this._m);
          const v = 0.75 + cellHash(ix, iz, 47) * 0.4;
          this._c.setRGB(fcfg.tint[0] * v, fcfg.tint[1] * v, fcfg.tint[2] * v);
          lmesh.setColorAt(n.longe, this._c);
          n.longe++;
        }
      }
    }
    for (const [k, mesh] of Object.entries(this.kinds)) {
      mesh.count = n[k];
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }
}
