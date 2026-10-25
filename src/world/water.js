// =============================================================
// ÁGUA – mar (salgado) e pântano (doce, dá para beber)
// Cada "corpo d'água" sabe seu nível (altura da superfície) e se
// é doce. A física (nadar) e o "beber" perguntam aqui.
// =============================================================
import * as THREE from 'three';
import { BALANCE } from '../core/balance.js';
import { makeWaterMaterial } from './materials.js';
import { SUN_DIR } from './sky.js';

export class WaterBody {
  constructor({ id, name, fresh, level, rect = null }) {
    this.id = id;
    this.name = name;
    this.fresh = fresh;   // true = água doce (mata a sede)
    this.level = level;   // altura da superfície (m)
    this.rect = rect;     // null = cobre tudo (mar)
  }

  contains(x, z) {
    const r = this.rect;
    if (!r) return true;
    return x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1;
  }
}

export class WaterSystem {
  constructor(map, scene) {
    this.map = map;
    const s = map.swamp;

    this.swamp = new WaterBody({ id: 'pantano', name: 'Pântano', fresh: true, level: s.level, rect: s.rect });
    this.sea = new WaterBody({ id: 'mar', name: 'Mar', fresh: false, level: 0 });
    this.bodies = [this.swamp, this.sea];
    this.sea.wave = BALANCE.agua.altura_onda_mar_m / 2;
    this.swamp.wave = BALANCE.agua.altura_onda_pantano_m / 2;
    // cor embaixo d'água: mar azul e mais limpo; pântano turvo
    this.sea.under = { color: '#1d5a66', density: 0.055, rays: true };
    this.swamp.under = { color: '#3a3a22', density: 0.28, rays: false };

    // ----- Mar -----
    const seaMat = makeWaterMaterial({
      shallow: '#4fb3b0', deep: '#13506d', sky: '#b9d3dc', sunDir: SUN_DIR, map, level: 0,
      opacityShallow: 0.25, opacityDeep: 0.9, deepAt: 7, waveHeight: BALANCE.agua.altura_onda_mar_m / 2, reflect: 0.6,
    });
    const seaMesh = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000, 80, 80), seaMat);
    seaMesh.rotation.x = -Math.PI / 2;
    seaMesh.name = 'Mar';
    seaMesh.renderOrder = 1;
    scene.add(seaMesh);

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), new THREE.MeshBasicMaterial({ color: '#1d3f48' }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -map.L.profundidade_mar_m - 1;
    floor.name = 'FundoDoMar';
    scene.add(floor);

    // ----- Pântano: água escura e parada, quase sem espuma -----
    const swampMat = makeWaterMaterial({
      shallow: '#5b5634', deep: '#1f2b1a', foam: '#b8b394', sky: '#8e9c86', sunDir: SUN_DIR, map, level: s.level,
      opacityShallow: 0.55, opacityDeep: 0.96, deepAt: 2.2, waveHeight: BALANCE.agua.altura_onda_pantano_m / 2, reflect: 0.45, foamAmount: 0.35,
    });
    const r = s.rect;
    const w = r.x1 - r.x0;
    const d = r.z1 - r.z0;
    const swampMesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d, 8, 8), swampMat);
    swampMesh.rotation.x = -Math.PI / 2;
    swampMesh.position.set((r.x0 + r.x1) / 2, s.level, (r.z0 + r.z1) / 2);
    swampMesh.name = 'AguaPantano';
    swampMesh.renderOrder = 1;
    scene.add(swampMesh);

    this.meshes = [seaMesh, swampMesh];
    this._buildStreams(map, scene);
  }

  // ----- Córregos: água doce e clara, descendo em degraus -----
  // Cada trecho (~5 m) é um "corpo d'água" com o seu nível; a malha é
  // uma fita que segue o córrego.
  _buildStreams(map, scene) {
    this.streamSegs = [];
    this.streamGrid = new Map();
    const streams = map.streams ?? [];
    if (!streams.length) return;
    const mat = makeWaterMaterial({
      shallow: '#5f9a86', deep: '#24504a', foam: '#e8efe6', sky: '#a9c6c0', sunDir: SUN_DIR, map, level: -1000,
      opacityShallow: 0.45, opacityDeep: 0.85, deepAt: 1.2, waveHeight: 0, reflect: 0.5, foamAmount: 0.6,
    });
    const pos = [];
    const idx = [];
    for (const st of streams) {
      const P = st.pts;
      const w = st.halfW + 1.5; // a fita entra um pouco no barranco
      for (let k = 0; k < P.length - 1; k++) {
        const a = P[k];
        const b = P[k + 1];
        const body = new WaterBody({ id: 'corrego', name: 'Córrego', fresh: true, level: a.level });
        body.wave = 0;
        body.under = { color: '#3d6a5e', density: 0.18, rays: false };
        body.seg = { ax: a.x, az: a.z, bx: b.x, bz: b.z, r: st.halfW };
        this.streamSegs.push(body);
        // grade de 20 m para achar o trecho rápido
        for (const p of [a, b]) {
          const key = `${Math.floor(p.x / 20)},${Math.floor(p.z / 20)}`;
          if (!this.streamGrid.has(key)) this.streamGrid.set(key, []);
          this.streamGrid.get(key).push(body);
        }
        // pedaço da fita (um pouco mais comprido para emendar nas curvas)
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const l = Math.hypot(dx, dz) || 1;
        const nx = -dz / l * w;
        const nz = dx / l * w;
        const ex = dx / l * 0.8;
        const ez = dz / l * 0.8;
        const y = a.level;
        const i0 = pos.length / 3;
        pos.push(a.x - ex + nx, y, a.z - ez + nz, a.x - ex - nx, y, a.z - ez - nz, b.x + ex + nx, y, b.z + ez + nz, b.x + ex - nx, y, b.z + ez - nz);
        idx.push(i0, i0 + 2, i0 + 1, i0 + 1, i0 + 2, i0 + 3);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, mat);
    mesh.name = 'Corregos';
    mesh.renderOrder = 1;
    mat.side = THREE.DoubleSide;
    scene.add(mesh);
    this.meshes.push(mesh);
  }

  _streamAt(x, z, ground) {
    const list = this.streamGrid?.get(`${Math.floor(x / 20)},${Math.floor(z / 20)}`);
    if (!list) return null;
    let best = null;
    let bestD = Infinity;
    for (const b of list) {
      const s = b.seg;
      const ex = s.bx - s.ax;
      const ez = s.bz - s.az;
      const t = Math.max(0, Math.min(1, ((x - s.ax) * ex + (z - s.az) * ez) / (ex * ex + ez * ez || 1)));
      const d = Math.hypot(x - s.ax - ex * t, z - s.az - ez * t);
      if (d < s.r + 1.5 && d < bestD && ground < b.level) {
        best = b;
        bestD = d;
      }
    }
    return best;
  }

  // Corpo d'água no ponto (x, z), ou null se o chão está seco.
  // Altura da onda aqui (mesma conta do desenho da água).
  waveAt(body, x, z, t) {
    if (!body || !body.wave) return 0;
    return (Math.sin(x * 0.09 + t * 1.1) + Math.cos(z * 0.08 + t * 0.85)) * body.wave;
  }

  bodyAt(x, z) {
    const ground = this.map.heightAt(x, z);
    for (const b of this.bodies) {
      if (b.contains(x, z) && ground < b.level) return b;
    }
    return this._streamAt(x, z, ground);
  }

  update() {}
}
