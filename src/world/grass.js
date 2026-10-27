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
import { makeGrassTuft, makeBroadPlant, makeSprout, makeFlowerTuft } from './props.js';

const CELL = 1.25;

// Quanto de cada planta por bioma (0 a 1).
const BY_BIOME = {
  [BIOME.JUNGLE]: { capim: 0.5, folha: 0.22, broto: 0.16, flor: 0.03, tint: [0.9, 1.0, 0.82] },
  [BIOME.IGAPO]: { capim: 0.55, folha: 0.15, broto: 0.12, flor: 0.02, tint: [0.92, 0.98, 0.78] },
  [BIOME.SWAMP]: { capim: 0.55, folha: 0.05, broto: 0.04, flor: 0.0, tint: [1.0, 0.95, 0.7] },
  [BIOME.BEACH]: { capim: 0.08, folha: 0.0, broto: 0.0, flor: 0.01, tint: [1.15, 1.1, 0.8] },
  [BIOME.HIGHLAND]: { capim: 0.2, folha: 0.0, broto: 0.03, flor: 0.02, tint: [0.95, 0.95, 0.8] },
  [BIOME.PLAINS]: { capim: 0.8, folha: 0.03, broto: 0.02, flor: 0.05, tint: [1.1, 1.05, 0.7] },
};

// cores das flores (laranja do ARK, amarelo e branco-creme)
const FLOWER_COLORS = [[1.0, 0.52, 0.12], [1.0, 0.8, 0.2], [0.98, 0.92, 0.8], [0.9, 0.3, 0.2]];

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
    const material = addWind(new THREE.MeshLambertMaterial({ vertexColors: true }), 0.25, 0.05, 1);
    this.kinds = {
      capim: this._mesh(makeGrassTuft(), material, 9000, 'Capim'),
      folha: this._mesh(makeBroadPlant(), material, 2600, 'Folhagem'),
      broto: this._mesh(makeSprout(), material, 1800, 'Brotos'),
      flor: this._mesh(makeFlowerTuft(), material, 1500, 'Flores'),
    };
    this.enabled = true;
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
    const z1 = Math.floor((focus.z + R) / CELL);
    const r2 = R * R;
    const n = { capim: 0, folha: 0, broto: 0, flor: 0 };
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
        const mesh = this.kinds[kind];
        if (n[kind] >= mesh.userData.max) continue;
        const h = this.map.heightAt(x, z);
        if (h < 0.5) continue;
        const wb = this.water.bodyAt(x, z);
        if (wb && ((kind !== 'capim' && kind !== 'flor') || wb.level - h > 0.25)) continue;
        const sc = 0.7 + cellHash(ix, iz, 4) * 0.7;
        this._q.setFromAxisAngle(this._up, cellHash(ix, iz, 5) * 6.283);
        this._s.set(sc, sc * (0.8 + cellHash(ix, iz, 6) * 0.5), sc);
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
    for (const [k, mesh] of Object.entries(this.kinds)) {
      mesh.count = n[k];
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }
}
