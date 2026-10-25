// =============================================================
// CÉU, SOL, LUZ E NEBLINA
// - Céu: cúpula com degradê, nuvens e brilho do sol (materials.js).
// - Sol: luz direcional; a sombra cobre só a área perto do jogador.
// - Neblina úmida da floresta: vai escondendo o que está longe
//   (fica realista e o celular desenha menos).
// - Dia e noite: setTime(t) com t de 0 a 1 (0,25 = nascer do sol,
//   0,5 = meio-dia, 0,75 = pôr do sol). À noite a lua ilumina azulado.
// =============================================================
import * as THREE from 'three';
import { makeSkyMaterial, sharedDay } from './materials.js';

const HORIZON = new THREE.Color('#aebfb6'); // neblina úmida
const ZENITH = new THREE.Color('#4d8cc4');
const UNDERWATER = new THREE.Color('#2a4b3c');

// Direção da luz principal (sol de dia, lua à noite). É o MESMO vetor
// usado pela água e pelo céu: mudar aqui muda tudo junto.
export const SUN_DIR = new THREE.Vector3(0.45, 0.8, 0.35).normalize();

// Noite = antes de NIGHT_END ou depois de NIGHT_START (fração do ciclo).
export const NIGHT_START = 0.79;
export const NIGHT_END = 0.22;

// Cores do céu ao longo do dia: [t, horizonte, zênite, cor da luz,
// força da luz, céu do hemisfério, força do hemisfério, nuvens]
const KEYS = [
  [0.0, '#141c27', '#070c16', '#8ea6d8', 0.45, '#5a6e98', 0.42, 0.22],
  [0.2, '#1c2430', '#0a1220', '#8ea6d8', 0.45, '#5a6e98', 0.42, 0.25],
  [0.26, '#d79a72', '#4f6a96', '#ffb27a', 1.2, '#c7b4a0', 0.8, 0.85],
  [0.34, '#b9c7bc', '#4d8cc4', '#fff0d0', 2.3, '#dbeee6', 1.15, 1.0],
  [0.5, '#aebfb6', '#4d8cc4', '#fff0d0', 2.6, '#dbeee6', 1.25, 1.0],
  [0.68, '#b9c4b4', '#5288bd', '#ffe6c0', 2.3, '#dbe8de', 1.15, 1.0],
  [0.75, '#e08a5a', '#4a5f8c', '#ff9a5a', 1.1, '#c8a890', 0.8, 0.85],
  [0.8, '#1c2430', '#0a1220', '#8ea6d8', 0.45, '#5a6e98', 0.42, 0.25],
  [1.0, '#141c27', '#070c16', '#8ea6d8', 0.45, '#5a6e98', 0.42, 0.22],
].map(([t, h, z, sc, si, hs, hi, cl]) => ({ t, h: new THREE.Color(h), z: new THREE.Color(z), sc: new THREE.Color(sc), si, hs: new THREE.Color(hs), hi, cl }));

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
    this.time = 0.35;
    this.daylight = 1;
    this._horizon = HORIZON.clone();
  }

  // Hora do dia (0 a 1). Atualiza sol/lua, cores do céu, luz e neblina.
  setTime(t) {
    t = ((t % 1) + 1) % 1;
    this.time = t;
    let i = 0;
    while (i < KEYS.length - 2 && KEYS[i + 1].t <= t) i++;
    const a = KEYS[i];
    const b = KEYS[i + 1];
    const f = Math.min(1, Math.max(0, (t - a.t) / Math.max(1e-6, b.t - a.t)));
    const L = (x, y) => x + (y - x) * f;
    this._horizon.copy(a.h).lerp(b.h, f);
    const u = this.dome.material.uniforms;
    u.uHorizon.value.copy(this._horizon);
    u.uZenith.value.copy(a.z).lerp(b.z, f);
    u.uCloud.value = L(a.cl, b.cl);
    this.sun.color.copy(a.sc).lerp(b.sc, f);
    this.sun.intensity = L(a.si, b.si);
    this.hemi.color.copy(a.hs).lerp(b.hs, f);
    this.hemi.intensity = L(a.hi, b.hi);
    // sol gira em volta da ilha; à noite a luz vem da lua (oposta)
    const ang = (t - 0.25) * Math.PI * 2;
    const sun = new THREE.Vector3(Math.cos(ang) * 0.85, Math.sin(ang), 0.35).normalize();
    const up = sun.y > -0.05 ? sun : sun.clone().negate();
    if (up.y < 0.15) up.y = 0.15;
    SUN_DIR.copy(up).normalize();
    this.sunDir.copy(SUN_DIR);
    u.uSunColor.value.copy(this.sun.color).multiplyScalar(sun.y > -0.05 ? 1 : 0.35);
    this.daylight = Math.min(1, Math.max(0.18, (this.sun.intensity - 0.45) / 2.15 * 0.82 + 0.18));
    sharedDay.value = this.daylight;
    if (!this.underwater) {
      this.scene.fog.color.copy(this._horizon);
      // Lapônia: ar frio e limpo, neblina azulada (cold = 0..1, vem do mundo)
      if (this.cold > 0) {
        this._coldTint = this._coldTint ?? new THREE.Color();
        this._coldTint.setRGB(0.72, 0.8, 0.88).multiplyScalar(0.25 + this.daylight * 0.85);
        this.scene.fog.color.lerp(this._coldTint, this.cold * 0.7);
      }
      // morros da mata: neblina clara e úmida (mist = 0..1, vem do mundo)
      if (this.mist > 0.01) {
        this._mistTint = this._mistTint ?? new THREE.Color();
        this._mistTint.setRGB(0.8, 0.84, 0.82).multiplyScalar(0.2 + this.daylight * 0.85);
        this.scene.fog.color.lerp(this._mistTint, this.mist * 0.5);
      }
      this.scene.background.copy(this.scene.fog.color);
    }
  }

  get isNight() {
    return this.time < NIGHT_END || this.time > NIGHT_START;
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

  // info = { color, density } da água onde mergulhou (mar ou pântano)
  setUnderwater(on, info = null) {
    if (on === this.underwater && (!on || info === this._uwInfo)) return;
    this.underwater = on;
    this._uwInfo = info;
    const fog = this.scene.fog;
    if (on) {
      const c = new THREE.Color(info?.color ?? UNDERWATER).multiplyScalar(0.35 + 0.65 * this.daylight);
      fog.color.copy(c);
      fog.density = info?.density ?? 0.12;
      this.scene.background.copy(c);
    } else {
      fog.color.copy(this._horizon);
      this.scene.background.copy(this._horizon);
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
