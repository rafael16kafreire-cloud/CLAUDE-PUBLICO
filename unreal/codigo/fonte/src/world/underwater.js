// =============================================================
// EMBAIXO D'ÁGUA – o que muda quando a câmera mergulha
//  - partículas boiando (sujeirinhas/plâncton) em volta da câmera
//  - raios de sol entrando pela superfície (só no mar, água limpa)
//  - bolhas saindo da boca de tempos em tempos
// (A cor/neblina da água fica no céu: sky.setUnderwater.)
// Tudo leve: 1 desenho para as partículas, 1 para as bolhas,
// 1 para os raios.
// =============================================================
import * as THREE from 'three';

const N_DUST = 420;
const N_BUBBLES = 40;
const BOX = 26; // tamanho do "cubo" de partículas em volta da câmera

function dotTexture() {
  const c = document.createElement('canvas');
  c.width = 32;
  c.height = 32;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.4, 'rgba(255,255,255,0.5)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}

function bubbleTexture() {
  const c = document.createElement('canvas');
  c.width = 32;
  c.height = 32;
  const g = c.getContext('2d');
  g.strokeStyle = 'rgba(255,255,255,0.9)';
  g.lineWidth = 2.5;
  g.beginPath();
  g.arc(16, 16, 12, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.25)';
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.9)';
  g.beginPath();
  g.arc(11, 11, 3, 0, Math.PI * 2);
  g.fill();
  return new THREE.CanvasTexture(c);
}

function rayTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 256;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 256);
  grd.addColorStop(0, 'rgba(255,255,255,0.9)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 256);
  // bordas suaves
  const side = g.createLinearGradient(0, 0, 64, 0);
  side.addColorStop(0, 'rgba(0,0,0,1)');
  side.addColorStop(0.35, 'rgba(0,0,0,0)');
  side.addColorStop(0.65, 'rgba(0,0,0,0)');
  side.addColorStop(1, 'rgba(0,0,0,1)');
  g.globalCompositeOperation = 'destination-out';
  g.fillStyle = side;
  g.fillRect(0, 0, 64, 256);
  return new THREE.CanvasTexture(c);
}

export class Underwater {
  constructor(scene) {
    this.scene = scene;
    this.active = false;
    this._t = 0;
    this._bubbleT = 1;

    // partículas
    const pos = new Float32Array(N_DUST * 3);
    for (let i = 0; i < N_DUST; i++) {
      pos[i * 3] = (Math.random() - 0.5) * BOX;
      pos[i * 3 + 1] = (Math.random() - 0.5) * BOX;
      pos[i * 3 + 2] = (Math.random() - 0.5) * BOX;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.dustMat = new THREE.PointsMaterial({ map: dotTexture(), size: 0.09, transparent: true, opacity: 0.55, depthWrite: false, color: '#cfe8dc' });
    this.dust = new THREE.Points(g, this.dustMat);
    this.dust.frustumCulled = false;
    this.dust.visible = false;
    this.dust.renderOrder = 5;
    scene.add(this.dust);

    // bolhas
    this.bubbles = [];
    const bp = new Float32Array(N_BUBBLES * 3).fill(-9999);
    const bg = new THREE.BufferGeometry();
    bg.setAttribute('position', new THREE.BufferAttribute(bp, 3));
    this.bubbleMat = new THREE.PointsMaterial({ map: bubbleTexture(), size: 0.12, transparent: true, opacity: 0.8, depthWrite: false });
    this.bubblePts = new THREE.Points(bg, this.bubbleMat);
    this.bubblePts.frustumCulled = false;
    this.bubblePts.visible = false;
    this.bubblePts.renderOrder = 6;
    scene.add(this.bubblePts);

    // raios de sol (planos verticais que viram para a câmera)
    this.rays = new THREE.Group();
    const rayMat = new THREE.MeshBasicMaterial({
      map: rayTexture(), transparent: true, opacity: 0.16, depthWrite: false,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false, color: '#bfe9f0',
    });
    for (let i = 0; i < 9; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1.6 + Math.random() * 1.8, 18), rayMat);
      m.userData.off = new THREE.Vector3((Math.random() - 0.5) * 22, 0, (Math.random() - 0.5) * 22);
      m.userData.ph = Math.random() * 6;
      this.rays.add(m);
    }
    this.rays.visible = false;
    this.rays.renderOrder = 4;
    scene.add(this.rays);
    this.rayMat = rayMat;
  }

  // on: câmera está embaixo d'água; info = { color, rays }; level = superfície
  set(on, info, level) {
    this.active = on;
    this.dust.visible = on;
    this.bubblePts.visible = on;
    this.rays.visible = on && !!info?.rays;
    this.level = level;
    if (on && info) this.dustMat.color.set(info.rays ? '#d6f0ea' : '#a89a6a');
  }

  update(dt, camera, daylight) {
    if (!this.active) return;
    this._t += dt;
    const cp = camera.position;
    // partículas: andam devagar e "dão a volta" no cubo em volta da câmera
    const a = this.dust.geometry.attributes.position;
    const half = BOX / 2;
    for (let i = 0; i < N_DUST; i++) {
      let x = a.getX(i) + Math.sin(this._t * 0.3 + i) * 0.02 * dt;
      let y = a.getY(i) + 0.05 * dt;
      let z = a.getZ(i) + Math.cos(this._t * 0.25 + i * 1.3) * 0.02 * dt;
      // mantém relativo à câmera
      const rx = x - cp.x;
      const ry = y - cp.y;
      const rz = z - cp.z;
      if (rx > half) x -= BOX; else if (rx < -half) x += BOX;
      if (ry > half) y -= BOX; else if (ry < -half) y += BOX;
      if (rz > half) z -= BOX; else if (rz < -half) z += BOX;
      a.setXYZ(i, x, y, z);
    }
    a.needsUpdate = true;
    this.dustMat.opacity = 0.25 + 0.4 * daylight;

    // bolhas: de tempos em tempos sai um punhado da boca
    this._bubbleT -= dt;
    if (this._bubbleT <= 0) {
      this._bubbleT = 2 + Math.random() * 2.5;
      const fwd = new THREE.Vector3();
      camera.getWorldDirection(fwd);
      for (let k = 0; k < 4 + Math.floor(Math.random() * 5); k++) {
        if (this.bubbles.length >= N_BUBBLES) break;
        this.bubbles.push({
          p: cp.clone().addScaledVector(fwd, 0.45 + Math.random() * 0.2).add(new THREE.Vector3((Math.random() - 0.5) * 0.15, -0.15, (Math.random() - 0.5) * 0.15)),
          v: 0.6 + Math.random() * 0.8,
          ph: Math.random() * 6,
        });
      }
    }
    const b = this.bubblePts.geometry.attributes.position;
    this.bubbles = this.bubbles.filter((bb) => bb.p.y < (this.level ?? 1e9) - 0.05);
    for (let i = 0; i < N_BUBBLES; i++) {
      const bb = this.bubbles[i];
      if (!bb) {
        b.setXYZ(i, 0, -9999, 0);
        continue;
      }
      bb.p.y += bb.v * dt;
      bb.p.x += Math.sin(this._t * 6 + bb.ph) * 0.15 * dt;
      bb.p.z += Math.cos(this._t * 5 + bb.ph) * 0.15 * dt;
      b.setXYZ(i, bb.p.x, bb.p.y, bb.p.z);
    }
    b.needsUpdate = true;

    // raios: perto da câmera, descendo da superfície, balançando
    if (this.rays.visible) {
      this.rayMat.opacity = 0.05 + 0.16 * daylight;
      for (const m of this.rays.children) {
        const o = m.userData.off;
        m.position.set(cp.x + o.x, (this.level ?? cp.y) - 8.5, cp.z + o.z);
        m.rotation.y = Math.atan2(cp.x - m.position.x, cp.z - m.position.z);
        m.rotation.z = 0.25 + Math.sin(this._t * 0.4 + m.userData.ph) * 0.05;
        m.scale.x = 0.8 + Math.sin(this._t * 0.7 + m.userData.ph) * 0.3;
      }
    }
  }
}
