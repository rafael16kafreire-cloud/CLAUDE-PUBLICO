// =============================================================
// RAIOS DE SOL entre as árvores (como no Valheim): faixas de luz soltas no ar da mata,
// na direção do sol. São poucos retângulos (máx. 14) desenhados com mistura aditiva e
// recorte pela profundidade, então os troncos e o morro cortam o raio de verdade.
// Só aparecem de dia, com o sol baixo ou médio, e só na floresta. Custo: ~14 retângulos.
// =============================================================
import * as THREE from 'three';
import { BIOME } from './island_generator.js';

const MAX = 14;
const CELL = 24;
const hash = (a, b, s) => {
  const h = Math.sin(a * 127.1 + b * 311.7 + s * 74.7) * 43758.5453;
  return h - Math.floor(h);
};
const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export class LightShafts {
  constructor(scene, map, water) {
    this.map = map;
    this.water = water;
    this.enabled = true;
    const geo = new THREE.PlaneGeometry(1, 1);
    geo.translate(0, 0.5, 0); // a base do raio fica em y = 0
    this.mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      fog: false,
      uniforms: { uColor: { value: new THREE.Color('#ffe9b8') }, uAlpha: { value: 0 }, uTime: { value: 0 } },
      vertexShader: 'varying vec2 vUv; varying float vPhase; void main() { vUv = uv; vPhase = instanceMatrix[3].x * 0.37 + instanceMatrix[3].z * 0.23; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }',
      fragmentShader: `
        uniform vec3 uColor; uniform float uAlpha; uniform float uTime;
        varying vec2 vUv; varying float vPhase;
        void main() {
          float across = 1.0 - abs(vUv.x * 2.0 - 1.0);
          across = across * across * (3.0 - 2.0 * across);
          float along = smoothstep(0.0, 0.18, vUv.y) * (1.0 - smoothstep(0.5, 1.0, vUv.y));
          float shimmer = 0.78 + 0.22 * sin(uTime * 0.45 + vPhase * 6.0 + vUv.x * 9.0);
          gl_FragColor = vec4(uColor * across * along * shimmer, 1.0) * uAlpha;
        }`,
    });
    // um InstancedMesh é o mais barato: uma só chamada de desenho para todos os raios
    this.mesh = new THREE.InstancedMesh(geo, this.mat, MAX);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 2;
    this.mesh.count = 0;
    scene.add(this.mesh);
    this.slots = [];
    this._last = new THREE.Vector2(1e9, 1e9);
    this._m = new THREE.Matrix4();
    this._v = new THREE.Vector3();
    this._s = new THREE.Vector3();
    this._n = new THREE.Vector3();
    this._a = new THREE.Vector3();
    this._t = new THREE.Vector3();
    this._sd = new THREE.Vector3();
  }

  // escolhe onde ficam os raios (células fixas do mundo: ficam no mesmo lugar quando você anda)
  _pick(focus) {
    const R = 60;
    const x0 = Math.floor((focus.x - R) / CELL);
    const x1 = Math.floor((focus.x + R) / CELL);
    const z0 = Math.floor((focus.z - R) / CELL);
    const z1 = Math.floor((focus.z + R) / CELL);
    const found = [];
    for (let iz = z0; iz <= z1; iz++) {
      for (let ix = x0; ix <= x1; ix++) {
        if (hash(ix, iz, 1) > 0.34) continue;
        const x = (ix + hash(ix, iz, 2)) * CELL;
        const z = (iz + hash(ix, iz, 3)) * CELL;
        const b = this.map.biomeAt(x, z);
        if (b !== BIOME.JUNGLE && b !== BIOME.IGAPO && b !== BIOME.SWAMP) continue;
        const h = this.map.heightAt(x, z);
        if (h < 0.5 || this.water.bodyAt(x, z)) continue;
        const d = Math.hypot(x - focus.x, z - focus.z);
        if (d > R) continue;
        found.push({ x, y: h, z, d, w: 4 + hash(ix, iz, 4) * 6, ph: hash(ix, iz, 5) });
      }
    }
    found.sort((a, b) => a.d - b.d);
    this.slots = found.slice(0, MAX);
  }

  update(camera, sky, focus, active) {
    const show = this.enabled && active && !sky.underwater;
    const night = sky.night ?? 0;
    const elev = sky.sunDir.y;
    // dia, com o sol nem rente ao chão nem a pino
    const k = show ? (1 - smooth(0.2, 0.55, night)) * smooth(0.07, 0.25, elev) * (1 - smooth(0.78, 0.97, elev)) : 0;
    this.mat.uniforms.uAlpha.value = k * 0.8;
    this.mat.uniforms.uTime.value = performance.now() / 1000;
    if (k < 0.02) {
      this.mesh.visible = false;
      return;
    }
    this.mesh.visible = true;
    this.mat.uniforms.uColor.value.copy(sky.sun.color).lerp(new THREE.Color('#ffe2a0'), 0.45);
    if (this._last.distanceTo(new THREE.Vector2(focus.x, focus.z)) > 6 || !this.slots.length) {
      this._last.set(focus.x, focus.z);
      this._pick(focus);
    }
    const up = this._v.copy(sky.sunDir); // do chão para o sol
    const L = 36;
    let n = 0;
    for (const s of this.slots) {
      // o raio sai do chão e sobe em direção ao sol; a faixa gira em volta dele para encarar a câmera
      const axis = this._a.copy(up);
      this._t.set(camera.position.x - s.x, camera.position.y - s.y, camera.position.z - s.z);
      const side = this._sd.crossVectors(axis, this._t);
      if (side.lengthSq() < 1e-6) continue;
      side.normalize().multiplyScalar(s.w);
      const nrm = this._n.crossVectors(side, axis).normalize();
      this._m.makeBasis(side, axis.multiplyScalar(L), nrm);
      this._m.setPosition(s.x, s.y - 1.5, s.z);
      this.mesh.setMatrixAt(n, this._m);
      n++;
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    // some perto da câmera (um raio na cara tapa a vista): o brilho também cai com a distância pelo bloco abaixo
    this._fadeNear(camera);
  }

  _fadeNear(camera) {
    let near = 1e9;
    for (const s of this.slots) near = Math.min(near, Math.hypot(camera.position.x - s.x, camera.position.z - s.z));
    // se algum raio está a menos de 7 m, diminui o brilho geral (só pesa 1 conta por quadro)
    const f = smooth(6, 16, near);
    this.mat.uniforms.uAlpha.value *= 0.35 + 0.65 * f;
  }
}
