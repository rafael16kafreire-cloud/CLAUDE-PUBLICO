// =============================================================
// CÉU, SOL, LUZ E NEBLINA
// - Céu: cúpula com degradê, nuvens e brilho do sol (materials.js).
// - Sol: luz direcional; a sombra cobre só a área perto do jogador.
// - Neblina úmida da floresta: vai escondendo o que está longe
//   (fica realista e o celular desenha menos).
// (Ciclo de dia/noite chega na Fase 4.)
// =============================================================
import * as THREE from 'three';
import { makeSkyMaterial } from './materials.js';

const HORIZON = new THREE.Color('#aebfb6'); // neblina úmida
const ZENITH = new THREE.Color('#4d8cc4');
const UNDERWATER = new THREE.Color('#2a4b3c');

// Direção do sol (usada também pela água e pelas "fotos" das árvores).
export const SUN_DIR = new THREE.Vector3(0.45, 0.8, 0.35).normalize();

export class Sky {
  constructor(scene) {
    this.scene = scene;
    this.sunDir = SUN_DIR.clone();
    this.viewDistance = 180;
    this.underwater = false;
    this.shadowRange = 40;

    this.hemi = new THREE.HemisphereLight('#dbeee6', '#4a4a2c', 1.25);
    scene.add(this.hemi);

    this.sun = new THREE.DirectionalLight('#fff0d0', 2.6);
    this.sun.castShadow = true;
    this._setShadowRange(40);
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.04;
    scene.add(this.sun);
    scene.add(this.sun.target);

    scene.fog = new THREE.FogExp2(HORIZON.clone(), 0.01);
    scene.background = HORIZON.clone();

    this.dome = new THREE.Mesh(
      new THREE.SphereGeometry(1, 32, 16),
      makeSkyMaterial({ horizon: HORIZON.clone(), zenith: ZENITH.clone(), sunDir: SUN_DIR }),
    );
    this.dome.renderOrder = -2;
    this.dome.frustumCulled = false;
    this.dome.name = 'Ceu';
    scene.add(this.dome);
  }

  _setShadowRange(r) {
    this.shadowRange = r;
    const cam = this.sun.shadow.camera;
    cam.left = -r;
    cam.right = r;
    cam.top = r;
    cam.bottom = -r;
    cam.near = 1;
    cam.far = 400;
    cam.updateProjectionMatrix();
  }

  // Neblina "exponencial": em view-distance quase nada se vê.
  setViewDistance(d) {
    this.viewDistance = d;
    if (!this.underwater) this.scene.fog.density = 2.0 / d;
  }

  setShadows(enabled, mapSize, range = 40) {
    this.sun.castShadow = enabled;
    this._setShadowRange(range);
    if (this.sun.shadow.mapSize.x !== mapSize) {
      this.sun.shadow.mapSize.set(mapSize, mapSize);
      if (this.sun.shadow.map) {
        this.sun.shadow.map.dispose();
        this.sun.shadow.map = null;
      }
    }
  }

  setUnderwater(on) {
    if (on === this.underwater) return;
    this.underwater = on;
    const fog = this.scene.fog;
    if (on) {
      fog.color.copy(UNDERWATER);
      fog.density = 0.12;
      this.scene.background.copy(UNDERWATER);
    } else {
      fog.color.copy(HORIZON);
      this.scene.background.copy(HORIZON);
      this.setViewDistance(this.viewDistance);
    }
    this.dome.visible = !on;
  }

  update(camera, focus) {
    this.dome.position.copy(camera.position);
    this.dome.scale.setScalar(Math.min(camera.far * 0.9, 600));
    // A sombra acompanha o jogador, presa a uma grade (não "treme").
    const step = (this.shadowRange * 2) / this.sun.shadow.mapSize.x;
    const fx = Math.round(focus.x / step) * step;
    const fz = Math.round(focus.z / step) * step;
    this.sun.target.position.set(fx, focus.y, fz);
    this.sun.position.set(fx, focus.y, fz).addScaledVector(this.sunDir, 200);
  }
}
