// =============================================================
// ÁGUA – mar (salgado), lago e pântano (doces)
// Cada "corpo d'água" sabe seu nível (altura da superfície) e se
// é doce. A física (nadar) e o "beber" perguntam aqui.
// =============================================================
import * as THREE from 'three';
import { makeWaterMaterial } from './materials.js';
import { SUN_DIR } from './sky.js';

export class WaterBody {
  constructor({ id, name, fresh, level, center = null, radius = null }) {
    this.id = id;
    this.name = name;
    this.fresh = fresh;   // true = água doce (mata a sede)
    this.level = level;   // altura da superfície (m)
    this.center = center; // null = cobre tudo (mar)
    this.radius = radius;
  }

  contains(x, z) {
    if (!this.center) return true;
    const dx = x - this.center.x;
    const dz = z - this.center.z;
    return dx * dx + dz * dz <= this.radius * this.radius;
  }
}

export class WaterSystem {
  constructor(map, scene) {
    this.map = map;
    const k = map.lake;
    const s = map.swamp;

    this.lake = new WaterBody({
      id: 'lago', name: 'Lago', fresh: true, level: k.level,
      center: { x: k.x, z: k.z }, radius: k.diskRadius,
    });
    this.swamp = new WaterBody({
      id: 'pantano', name: 'Pântano', fresh: true, level: s.level,
      center: { x: s.x, z: s.z }, radius: s.diskRadius,
    });
    this.sea = new WaterBody({ id: 'mar', name: 'Mar', fresh: false, level: 0 });
    // Lago e pântano primeiro: têm prioridade sobre o mar.
    this.bodies = [this.lake, this.swamp, this.sea];

    // ----- Malhas -----
    const seaMat = makeWaterMaterial({ shallow: '#3f9cb4', deep: '#1c5f7c', opacity: 0.8, waveHeight: 0.18, sunDir: SUN_DIR });
    const seaMesh = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000, 60, 60), seaMat);
    seaMesh.rotation.x = -Math.PI / 2;
    seaMesh.position.y = this.sea.level;
    seaMesh.name = 'Mar';
    scene.add(seaMesh);

    // Fundo escuro bem embaixo de tudo (o mar não parece vazio além da ilha).
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(6000, 6000),
      new THREE.MeshBasicMaterial({ color: '#1d3f48' }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -map.L.profundidade_mar_m - 1;
    floor.name = 'FundoDoMar';
    scene.add(floor);

    const lakeMat = makeWaterMaterial({ shallow: '#4aa3b5', deep: '#246c80', opacity: 0.82, waveHeight: 0.04, sunDir: SUN_DIR });
    const lakeMesh = new THREE.Mesh(new THREE.CircleGeometry(k.diskRadius, 48), lakeMat);
    lakeMesh.rotation.x = -Math.PI / 2;
    lakeMesh.position.set(k.x, k.level, k.z);
    lakeMesh.name = 'Lago';
    scene.add(lakeMesh);

    // Pântano: água turva, esverdeada.
    const swampMat = makeWaterMaterial({ shallow: '#4f5d33', deep: '#33402a', opacity: 0.92, waveHeight: 0.02, sunDir: SUN_DIR, sky: '#7d8c6a', reflect: 0.35 });
    const swampMesh = new THREE.Mesh(new THREE.CircleGeometry(s.diskRadius, 64), swampMat);
    swampMesh.rotation.x = -Math.PI / 2;
    swampMesh.position.set(s.x, s.level, s.z);
    swampMesh.name = 'AguaPantano';
    scene.add(swampMesh);

    this.meshes = [seaMesh, lakeMesh, swampMesh];
  }

  // Corpo d'água no ponto (x, z), ou null se o chão está seco.
  bodyAt(x, z) {
    const ground = this.map.heightAt(x, z);
    for (const b of this.bodies) {
      if (b.contains(x, z) && ground < b.level) return b;
    }
    return null;
  }

  update() {
    // A animação das ondas usa o tempo compartilhado (materials.js).
  }
}
