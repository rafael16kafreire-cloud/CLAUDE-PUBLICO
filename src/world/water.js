// =============================================================
// ÁGUA – mar (salgado) e lago (doce)
// Cada "corpo d'água" sabe seu nível (altura da superfície) e se
// é doce. A física (nadar) e o "beber" perguntam aqui.
// =============================================================
import * as THREE from 'three';

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

    this.lake = new WaterBody({
      id: 'lago',
      name: 'Lago',
      fresh: true,
      level: k.level,
      center: { x: k.x, z: k.z },
      radius: k.diskRadius,
    });
    this.sea = new WaterBody({ id: 'mar', name: 'Mar', fresh: false, level: 0 });
    // O lago vem primeiro: ele tem prioridade sobre o mar.
    this.bodies = [this.lake, this.sea];

    // ----- Malhas -----
    // Mar: um plano grande e semitransparente.
    this.seaMaterial = new THREE.MeshLambertMaterial({
      color: '#2a7fae',
      transparent: true,
      opacity: 0.82,
      side: THREE.DoubleSide,
    });
    const seaMesh = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), this.seaMaterial);
    seaMesh.rotation.x = -Math.PI / 2;
    seaMesh.position.y = this.sea.level;
    seaMesh.name = 'Mar';
    scene.add(seaMesh);

    // Fundo escuro bem embaixo de tudo (para o mar não parecer vazio
    // além da borda do terreno).
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(6000, 6000),
      new THREE.MeshBasicMaterial({ color: '#1d3f48' }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -map.L.profundidade_mar_m - 1;
    floor.name = 'FundoDoMar';
    scene.add(floor);

    // Lago: um disco na altura do nível da água.
    this.lakeMaterial = new THREE.MeshLambertMaterial({
      color: '#3f9bb8',
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
    });
    const lakeMesh = new THREE.Mesh(new THREE.CircleGeometry(k.diskRadius, 48), this.lakeMaterial);
    lakeMesh.rotation.x = -Math.PI / 2;
    lakeMesh.position.set(k.x, k.level, k.z);
    lakeMesh.name = 'Lago';
    scene.add(lakeMesh);

    this.meshes = [seaMesh, lakeMesh];
    this._time = 0;
  }

  // Corpo d'água no ponto (x, z), ou null se o chão está seco.
  bodyAt(x, z) {
    const ground = this.map.heightAt(x, z);
    for (const b of this.bodies) {
      if (b.contains(x, z) && ground < b.level) return b;
    }
    return null;
  }

  update(dt) {
    // Leve "brilho" mudando com o tempo para a água não ficar parada.
    this._time += dt;
    const s = Math.sin(this._time * 0.8) * 0.03;
    this.seaMaterial.opacity = 0.82 + s;
    this.lakeMaterial.opacity = 0.85 + s;
  }
}
