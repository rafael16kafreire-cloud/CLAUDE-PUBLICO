// =============================================================
// CÉU, SOL, LUZ E NEBLINA
// - Céu: uma cúpula com degradê que acompanha a câmera.
// - Sol: luz direcional; a sombra cobre só a área perto do jogador
//   e tem resolução baixa (leve para celular).
// - Neblina: esconde o limite da distância de visão.
// (Ciclo de dia/noite chega na Fase 4.)
// =============================================================
import * as THREE from 'three';

const HORIZON = new THREE.Color('#c4dbe2');
const ZENITH = new THREE.Color('#4f93cf');
const UNDERWATER = new THREE.Color('#1f6680');

export class Sky {
  constructor(scene) {
    this.scene = scene;
    this.sunDir = new THREE.Vector3(0.45, 0.8, 0.35).normalize();
    this.viewDistance = 250;
    this.underwater = false;

    // Luz ambiente: céu azulado em cima, chão esverdeado embaixo.
    this.hemi = new THREE.HemisphereLight('#d7ecff', '#5f6d47', 1.35);
    scene.add(this.hemi);

    // Sol
    this.sun = new THREE.DirectionalLight('#fff1d2', 2.4);
    this.sun.castShadow = true;
    const cam = this.sun.shadow.camera;
    cam.left = -40;
    cam.right = 40;
    cam.top = 40;
    cam.bottom = -40;
    cam.near = 1;
    cam.far = 320;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.03;
    scene.add(this.sun);
    scene.add(this.sun.target);

    // Neblina
    scene.fog = new THREE.Fog(HORIZON.clone(), 80, 240);
    scene.background = HORIZON.clone();

    // Cúpula do céu (degradê por vértice)
    const domeGeom = new THREE.SphereGeometry(1, 24, 12);
    const pos = domeGeom.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      c.copy(HORIZON).lerp(ZENITH, Math.max(0, Math.min(1, y * 1.6)));
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    domeGeom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.dome = new THREE.Mesh(
      domeGeom,
      new THREE.MeshBasicMaterial({
        vertexColors: true,
        side: THREE.BackSide,
        fog: false,
        depthWrite: false,
        depthTest: false,
      }),
    );
    this.dome.renderOrder = -2;
    this.dome.frustumCulled = false;
    this.dome.name = 'Ceu';
    scene.add(this.dome);

    // Disco do sol
    this.sunDisc = new THREE.Mesh(
      new THREE.CircleGeometry(1, 20),
      new THREE.MeshBasicMaterial({ color: '#fff6d8', fog: false, depthWrite: false }),
    );
    this.sunDisc.renderOrder = -1;
    this.sunDisc.frustumCulled = false;
    scene.add(this.sunDisc);
  }

  setViewDistance(d) {
    this.viewDistance = d;
    if (!this.underwater) {
      this.scene.fog.near = d * 0.35;
      this.scene.fog.far = d * 0.95;
    }
  }

  setShadows(enabled, mapSize) {
    this.sun.castShadow = enabled;
    if (this.sun.shadow.mapSize.x !== mapSize) {
      this.sun.shadow.mapSize.set(mapSize, mapSize);
      if (this.sun.shadow.map) {
        this.sun.shadow.map.dispose();
        this.sun.shadow.map = null;
      }
    }
  }

  // Embaixo d'água: neblina azul e curta.
  setUnderwater(on) {
    if (on === this.underwater) return;
    this.underwater = on;
    const fog = this.scene.fog;
    if (on) {
      fog.color.copy(UNDERWATER);
      fog.near = 1;
      fog.far = 32;
      this.scene.background.copy(UNDERWATER);
    } else {
      fog.color.copy(HORIZON);
      this.scene.background.copy(HORIZON);
      this.setViewDistance(this.viewDistance);
    }
    this.dome.visible = !on;
    this.sunDisc.visible = !on;
  }

  // focus = posição do jogador (a sombra acompanha ele).
  update(camera, focus) {
    this.dome.position.copy(camera.position);
    this.dome.scale.setScalar(this.viewDistance * 0.98);

    this.sun.target.position.copy(focus);
    this.sun.position.copy(focus).addScaledVector(this.sunDir, 150);

    const r = this.viewDistance * 0.9;
    this.sunDisc.position.copy(camera.position).addScaledVector(this.sunDir, r);
    this.sunDisc.scale.setScalar(r * 0.045);
    this.sunDisc.lookAt(camera.position);
  }
}
