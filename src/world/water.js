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
    // duas malhas: perto da câmera bem dividida (ondas de verdade) e o
    // resto do mar simples; o shader corta cada uma no raio NEAR
    const NEAR = 300;
    const seaOpts = {
      shallow: '#3fb0aa', deep: '#0e4766', sky: '#a9c9d6', sunDir: SUN_DIR, map, level: 0,
      opacityShallow: 0.25, opacityDeep: 0.9, deepAt: 7, waveHeight: BALANCE.agua.altura_onda_mar_m / 2, reflect: 0.6,
    };
    this.NEAR = NEAR;
    const seaMesh = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000, 80, 80), makeWaterMaterial({ ...seaOpts, ring: [NEAR, 1e9] }));
    this.seaFar = seaMesh;
    seaMesh.rotation.x = -Math.PI / 2;
    seaMesh.name = 'Mar';
    seaMesh.renderOrder = 1;
    scene.add(seaMesh);
    this.seaNear = new THREE.Mesh(new THREE.PlaneGeometry(NEAR * 2 + 16, NEAR * 2 + 16, 120, 120), makeWaterMaterial({ ...seaOpts, ring: [0, NEAR] }));
    this.seaNear.rotation.x = -Math.PI / 2;
    this.seaNear.name = 'MarPerto';
    this.seaNear.renderOrder = 1;
    this.seaNear.frustumCulled = false;
    scene.add(this.seaNear);

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

    this.meshes = [seaMesh, this.seaNear, swampMesh];
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
      const w = st.halfW; // a fita encontra o barranco (o chão cobre a borda)
      for (let k = 0; k < P.length - 1; k++) {
        const a = P[k];
        const b = P[k + 1];
        const body = new WaterBody({ id: 'corrego', name: 'Córrego', fresh: true, level: (a.level + b.level) / 2 });
        body.wave = 0;
        body.under = { color: '#3d6a5e', density: 0.18, rays: false };
        body.seg = { ax: a.x, az: a.z, bx: b.x, bz: b.z, r: st.halfW };
        this.streamSegs.push(body);
        // grade de 20 m para achar o trecho rápido
        for (const p of [a, b, { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 }]) {
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
        // água em rampa: cada ponta na altura do seu ponto
        const ya = a.level;
        const yb = b.level;
        const i0 = pos.length / 3;
        pos.push(a.x - ex + nx, ya, a.z - ez + nz, a.x - ex - nx, ya, a.z - ez - nz, b.x + ex + nx, yb, b.z + ez + nz, b.x + ex - nx, yb, b.z + ez - nz);
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
    return (Math.sin(x * 0.09 + t * 1.1) + Math.cos(z * 0.08 + t * 0.85) + 0.45 * Math.sin((x + z) * 0.16 + t * 1.7)) * body.wave;
  }

  bodyAt(x, z) {
    const ground = this.map.heightAt(x, z);
    // o córrego vem antes do mar: perto da foz o leito desce abaixo do nível do
    // mar e o riacho aparecia como "água salgada" (a água do córrego fica acima do mar)
    const stream = this._streamAt(x, z, ground);
    if (stream) return stream;
    for (const b of this.bodies) {
      if (b.contains(x, z) && ground < b.level) return b;
    }
    return null;
  }

  // A malha de perto anda com a câmera (em passos da grade, sem tremer).
  // Longe do mar (no meio da ilha) a malha de perto some e a de longe
  // cobre tudo (economiza ~29 mil triângulos).
  update(camera) {
    if (!camera || !this.seaNear) return;
    const cp = camera.position;
    const step = (this.seaNear.geometry.parameters.width) / 120;
    this.seaNear.position.set(Math.round(cp.x / step) * step, 0, Math.round(cp.z / step) * step);
    this._seaT = (this._seaT ?? 0) - 1;
    if (this._seaT > 0) return;
    this._seaT = 20; // olha de novo a cada 20 quadros
    let sea = this.map.heightAt(cp.x, cp.z) < 0.5;
    for (let k = 0; k < 16 && !sea; k++) {
      const a = (k / 16) * Math.PI * 2;
      for (const r of [this.NEAR * 0.5, this.NEAR]) if (this.map.heightAt(cp.x + Math.cos(a) * r, cp.z + Math.sin(a) * r) < 0.5) sea = true;
    }
    this.seaNear.visible = sea;
    this.seaFar.material.uniforms.uRing.value.x = sea ? this.NEAR : 0;
  }
}
