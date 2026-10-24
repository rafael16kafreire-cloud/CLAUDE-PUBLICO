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
    return null;
  }

  update() {}
}
