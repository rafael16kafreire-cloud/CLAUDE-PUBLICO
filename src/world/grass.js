// =============================================================
// GRAMA – tufos de grama que balançam com o vento
// Só existe num raio pequeno em volta do jogador: quando ele anda,
// a grama é "replantada" à frente. Assim a ilha inteira parece
// gramada sem pesar no celular.
// =============================================================
import * as THREE from 'three';
import { BIOME } from './island_generator.js';
import { addWind } from './materials.js';
import { makeGrassTuft } from './props.js';

const RADIUS = 38;       // metros em volta do jogador
const CELL = 1.5;        // espaçamento da grade
const MAX = 3200;        // máximo de tufos

// Densidade e cor da grama por bioma.
const BY_BIOME = {
  [BIOME.MEADOW]: { density: 0.75, color: [1.0, 1.0, 0.95] },
  [BIOME.FOREST]: { density: 0.45, color: [0.82, 0.9, 0.78] },
  [BIOME.JUNGLE]: { density: 0.55, color: [0.7, 0.85, 0.65] },
  [BIOME.SWAMP]: { density: 0.35, color: [0.95, 0.9, 0.62] },
  [BIOME.BEACH]: { density: 0.04, color: [1.1, 1.05, 0.75] },
  [BIOME.DESERT]: { density: 0.015, color: [1.45, 1.2, 0.7] },
  [BIOME.MOUNTAIN]: { density: 0.12, color: [0.95, 0.95, 0.8] },
};

function cellHash(ix, iz) {
  const h = Math.sin(ix * 127.1 + iz * 311.7) * 43758.5453;
  return h - Math.floor(h);
}

export class Grass {
  constructor(map, water, scene) {
    this.map = map;
    this.water = water;
    const material = addWind(
      new THREE.MeshLambertMaterial({ vertexColors: true }),
      0.45,
    );
    this.mesh = new THREE.InstancedMesh(makeGrassTuft(), material, MAX);
    this.mesh.name = 'Grama';
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false; // sempre perto do jogador
    this.mesh.count = 0;
    scene.add(this.mesh);
    this.enabled = true;
    this._last = new THREE.Vector2(1e9, 1e9);
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._s = new THREE.Vector3();
    this._p = new THREE.Vector3();
    this._c = new THREE.Color();
    this._up = new THREE.Vector3(0, 1, 0);
  }

  setEnabled(on) {
    this.enabled = on;
    this.mesh.visible = on;
    if (on) this._last.set(1e9, 1e9);
  }

  update(focus) {
    if (!this.enabled) return;
    // Replanta só quando o jogador andou alguns metros.
    if (this._last.distanceTo(new THREE.Vector2(focus.x, focus.z)) < 6) return;
    this._last.set(focus.x, focus.z);

    const x0 = Math.floor((focus.x - RADIUS) / CELL);
    const x1 = Math.floor((focus.x + RADIUS) / CELL);
    const z0 = Math.floor((focus.z - RADIUS) / CELL);
    const z1 = Math.floor((focus.z + RADIUS) / CELL);
    const r2 = RADIUS * RADIUS;
    let n = 0;
    for (let iz = z0; iz <= z1 && n < MAX; iz++) {
      for (let ix = x0; ix <= x1 && n < MAX; ix++) {
        const hsh = cellHash(ix, iz);
        const x = (ix + cellHash(iz, ix) ) * CELL;
        const z = (iz + hsh) * CELL;
        const dx = x - focus.x;
        const dz = z - focus.z;
        if (dx * dx + dz * dz > r2) continue;
        const cfg = BY_BIOME[this.map.biomeAt(x, z)];
        if (!cfg || hsh > cfg.density) continue;
        const h = this.map.heightAt(x, z);
        if (h < 0.5 || this.water.bodyAt(x, z)) continue;
        const sc = 0.75 + cellHash(ix + 3, iz - 7) * 0.6;
        this._q.setFromAxisAngle(this._up, hsh * 40);
        this._s.set(sc, sc * (0.8 + cellHash(ix, iz + 9) * 0.6), sc);
        this._p.set(x, h - 0.03, z);
        this._m.compose(this._p, this._q, this._s);
        this.mesh.setMatrixAt(n, this._m);
        const v = 0.85 + cellHash(ix - 5, iz + 2) * 0.3;
        this._c.setRGB(cfg.color[0] * v, cfg.color[1] * v, cfg.color[2] * v);
        this.mesh.setColorAt(n, this._c);
        n++;
      }
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}
