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
import { makeMiniPlant } from './props.js';
import { capim, samambaia } from './lowpoly_veg.js';
import { PALETA } from '../core/paleta.js';
import { REALISTA } from '../core/estilo_mundo.js';
import { makeHostaClump, matHosta } from './folhas_ark.js';

// normal de cada vértice puxada para cima (k = 0 normal da face, 1 = para cima)
function normaisParaCima(g, k) {
  const n = g.getAttribute('normal');
  for (let i = 0; i < n.count; i++) {
    const x = n.getX(i) * (1 - k);
    const y = n.getY(i) * (1 - k) + k;
    const z = n.getZ(i) * (1 - k);
    const l = Math.hypot(x, y, z) || 1;
    n.setXYZ(i, x / l, y / l, z / l);
  }
  return g;
}

const CELL = 1.25;

// Quanto de cada planta por bioma (0 a 1).
// Quanto de cada planta por bioma (0 a 1). ETAPA 2 (low-poly): bem menos grama que antes (tufos
// espaçados, chão aparecendo), sem o tapete de relva e sem as plantinhas miúdas.
// tint: multiplica a cor da paleta de cada lâmina (1 = cor da paleta).
const BY_BIOME = {
  // realista: o chão da mata é forrado de plantas de folha larga (como no ARK), com um pouco de capim
  [BIOME.JUNGLE]: REALISTA ? { capim: 0.22, folha: 0.55, broto: 0.0, flor: 0.0, tint: [0.95, 1.0, 0.95] } : { capim: 0.16, folha: 0.1, broto: 0.06, flor: 0.0, tint: [0.95, 1.0, 0.95] },
  [BIOME.IGAPO]: REALISTA ? { capim: 0.25, folha: 0.5, broto: 0.0, flor: 0.0, tint: [0.95, 0.98, 0.92] } : { capim: 0.2, folha: 0.08, broto: 0.06, flor: 0.0, tint: [0.95, 0.98, 0.92] },
  [BIOME.SWAMP]: { capim: 0.24, folha: 0.03, broto: 0.03, flor: 0.0, tint: [1.0, 0.98, 0.9] },
  [BIOME.BEACH]: { capim: 0.05, folha: 0.0, broto: 0.0, flor: 0.0, tint: [1.08, 1.02, 0.9] },
  // montanha (serra / cordilheira): sem capim, só neve e pedra
  [BIOME.PLAINS]: { capim: 0.2, folha: 0.0, broto: 0.02, flor: 0.04, tint: [1.0, 1.0, 1.0], hscale: 1.1 },
};

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
    const material = addWind(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }), 0.07, 0.02, 0); // só o vento, bem de leve: ninguém empurra o mato ao passar
    material.userData.suave = true;
    // lâmina de um lado só desenhada dos dois lados: a luz não pode virar de cabeça para baixo atrás dela
    const prevCompile = material.onBeforeCompile;
    material.onBeforeCompile = (shader, renderer) => {
      prevCompile?.(shader, renderer);
      shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_begin>', THREE.ShaderChunk.normal_fragment_begin.replace('gl_FrontFacing ? 1.0 : - 1.0', '1.0'));
    };
    const prevKey = material.customProgramCacheKey;
    material.customProgramCacheKey = () => `${prevKey ? prevKey() : ''}-mato1`;
    // ETAPA 2 (low-poly): tufos de lâminas de 1 triângulo, cor da paleta por lâmina (lowpoly_veg.js).
    // Normais puxadas para cima: o tufo acende como o chão (sem lâmina preta do lado da sombra).
    const tufo = (o) => normaisParaCima(capim({ larg: 0.045, ...o }), 0.72);
    this.kinds = {
      capim: this._mesh(tufo({ alt: 0.55, laminas: 6, seed: 101 }), material, 5200, 'Capim'),
      capim2: this._mesh(tufo({ alt: 0.75, laminas: 5, seed: 102, cores: ['folhaClara', 'capimSeco', 'musgo'] }), material, 4200, 'Capim 2'),
      folha: REALISTA
        ? this._mesh(makeHostaClump({ n: 10, tam: 0.24, seed: 103, baixo: true, espalha: 0.5 }), matHosta(), 6000, 'Folhagem')
        : this._mesh(normaisParaCima(samambaia({ tam: 0.45, seed: 103, folhas: 5 }), 0.6), material, 2600, 'Folhagem'),
      broto: this._mesh(tufo({ alt: 0.35, laminas: 4, seed: 104, cores: ['musgoEscuro', 'musgo'] }), material, 1800, 'Brotos'),
      flor: this._mesh(tufo({ alt: 0.45, laminas: 5, seed: 105, flor: PALETA.neve }), material, 1500, 'Flores'),
      relva: this._mesh(tufo({ alt: 0.25, laminas: 4, seed: 106 }), material, 5200, 'Relva'),
      relva2: this._mesh(tufo({ alt: 0.22, laminas: 4, seed: 107, cores: ['folhaClara', 'capimSeco'] }), material, 4200, 'Relva 2'),
      longe: this._mesh(tufo({ alt: 0.5, laminas: 4, seed: 108 }), material, 16000, 'Grama longe'),
      mini: this._mesh(makeMiniPlant(0), material, 7000, 'Plantinhas'),
      mini2: this._mesh(makeMiniPlant(1), material, 6000, 'Plantinhas 2'),
    };

    this.enabled = true;
    this.lowPoly = false;
    this._step = -1;
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

  // Reconstrói o mato em fatias: uma camada por quadro (a conta toda de uma vez dava um engasgo a cada poucos passos).
  update(focus) {
    if (!this.enabled) return;
    if (this._step >= 0 && this._step < 4) {
      const f = this._focus;
      const names = ['main', 'relva', 'mini', 'far'];
      this[`_layer_${names[this._step]}`](f);
      this._step++;
      return;
    }
    const moved = this._last.distanceTo(new THREE.Vector2(focus.x, focus.z));
    if (moved < (this.lowPoly ? 6 : 7)) return;
    this._last.set(focus.x, focus.z);
    this._focus = { x: focus.x, z: focus.z };
    this._step = 0;
  }

  // camada: main
  _layer_main(focus) {
    const n = { capim: 0, capim2: 0, folha: 0, broto: 0, flor: 0 };
    const R = this.radius;
    const x0 = Math.floor((focus.x - R) / CELL);
    const x1 = Math.floor((focus.x + R) / CELL);
    const z0 = Math.floor((focus.z - R) / CELL);
    const z1 = this.lowPoly ? z0 - 1 : Math.floor((focus.z + R) / CELL);
    const r2 = R * R;
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
        const v = 0.85 + cellHash(ix, iz, 7) * 0.25;
        // low-poly: a cor vem da lâmina (paleta); a instância só varia o brilho
        this._c.setRGB(cfg.tint[0] * v, cfg.tint[1] * v, cfg.tint[2] * v);
        mesh.setColorAt(n[kind], this._c);
        n[kind]++;
      }
    }
    for (const k of ['capim', 'capim2', 'folha', 'broto', 'flor']) {
      const mesh = this.kinds[k];
      mesh.count = n[k];
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }

  // camada: relva
  _layer_relva(focus) {
    const n = { relva: 0, relva2: 0 };
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
        this._c.setRGB(0.7 * v * dry, 0.86 * v, 0.48 * v / dry);
        rm.setColorAt(n[rk], this._c);
        n[rk]++;
      }
    }
    for (const k of ['relva', 'relva2']) {
      const mesh = this.kinds[k];
      mesh.count = n[k];
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }

  // camada: mini
  _layer_mini(focus) {
    const n = { mini: 0, mini2: 0 };
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
        if (!mcfg?.mini || cellHash(ix, iz, 34) > mcfg.mini * Math.min(1, this.density / 0.9)) continue; // aparelho fraco: menos plantinhas
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
    for (const k of ['mini', 'mini2']) {
      const mesh = this.kinds[k];
      mesh.count = n[k];
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }

  // camada: far
  _layer_far(focus) {
    const n = { longe: 0 };
    // Grama low poly (7 triângulos por tufo). Normal: grade larga do fim da grama detalhada até longe.
    // Modo lento (lowPoly): é a única grama; perto do jogador os tufos ficam JUNTINHOS (grade fina, quase
    // encostando), e mais longe a grade abre.
    const lmesh = this.kinds.longe;
    const FR = Math.min(Math.max(this.radius * 2.6, 40), 75);
    const dens = Math.sqrt(Math.max(0.3, this.density));
    const rings = this.lowPoly
      ? [{ step: 0.5 / dens, r0: 0, r1: Math.min(15, FR), sc: 1.05 }, { step: 1.1 / dens, r0: Math.min(15, FR), r1: FR, sc: 1.2 }]
      : [{ step: 1.7 / dens, r0: this.radius * 0.55, r1: FR, sc: 1 }]; // low-poly: tufos mais espaçados
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
    for (const k of ['longe']) {
      const mesh = this.kinds[k];
      mesh.count = n[k];
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }

}
