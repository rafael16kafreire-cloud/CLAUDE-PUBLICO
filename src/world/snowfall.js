// =============================================================
// NEVE CAINDO na Lapônia (como no Valheim): ~1500 flocos num único objeto de pontos.
// Os flocos vivem numa caixa em volta da câmera e dão a volta (mod) em vez de nascer e
// morrer, então não há criação de objetos. A conta de posição é toda no shader.
// Só desenha quando o ar está frio (sky.cold); fora da neve o objeto fica escondido.
// =============================================================
import * as THREE from 'three';

const COUNT = 1500;
const BOX = new THREE.Vector3(44, 26, 44);

export class Snowfall {
  constructor(scene) {
    const seed = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
      seed[i * 3] = Math.random() * BOX.x;
      seed[i * 3 + 1] = Math.random() * BOX.y;
      seed[i * 3 + 2] = Math.random() * BOX.z;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(seed, 3));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6); // nunca recortado
    this.mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      fog: false,
      uniforms: {
        uCam: { value: new THREE.Vector3() },
        uTime: { value: 0 },
        uAlpha: { value: 0 },
        uBox: { value: BOX },
        uScale: { value: 600 },
        uTint: { value: new THREE.Color('#fff4e0') },
      },
      vertexShader: `
        uniform vec3 uCam; uniform float uTime; uniform vec3 uBox; uniform float uScale;
        varying float vA;
        void main() {
          vec3 s = position;
          float id = s.x * 1.7 + s.z * 2.3;
          vec3 p = s;
          p.y -= uTime * (1.5 + fract(id) * 1.4);                    // cai
          p.x += sin(uTime * 0.7 + id) * 0.9 + uTime * 0.8;          // balanço + vento
          p.z += cos(uTime * 0.6 + id * 1.3) * 0.9;
          p = mod(p - uCam, uBox) - uBox * 0.5;                      // dá a volta em torno da câmera
          vec4 mv = viewMatrix * vec4(p + uCam, 1.0);
          gl_Position = projectionMatrix * mv;
          float d = -mv.z;
          gl_PointSize = clamp((0.11 + fract(id * 3.1) * 0.09) * uScale / max(d, 0.5), 1.5, 14.0);
          vA = smoothstep(1.0, 4.0, d) * (1.0 - smoothstep(14.0, 22.0, d));
        }`,
      fragmentShader: `
        uniform vec3 uTint; uniform float uAlpha; varying float vA;
        void main() {
          float r = length(gl_PointCoord - 0.5) * 2.0;
          float a = (1.0 - smoothstep(0.35, 1.0, r)) * vA * uAlpha;
          if (a < 0.01) discard;
          gl_FragColor = vec4(uTint, a);
        }`,
    });
    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 8;
    this.points.visible = false;
    scene.add(this.points);
    this.t = 0;
  }

  // cold: 0..1 (sky.cold); night/daylight clareiam ou escurecem os flocos
  update(camera, dt, cold, daylight, underwater) {
    const k = underwater ? 0 : Math.max(0, (cold - 0.15) / 0.85);
    this.points.visible = k > 0.01;
    if (!this.points.visible) return;
    this.t += dt;
    const u = this.mat.uniforms;
    u.uTime.value = this.t;
    u.uCam.value.copy(camera.position);
    u.uAlpha.value = k * 0.9;
    u.uScale.value = 0.5 * (window.innerHeight || 600) / Math.tan((camera.fov * Math.PI) / 360);
    u.uTint.value.setRGB(1, 0.97, 0.9).multiplyScalar(0.35 + 0.65 * daylight);
  }
}
