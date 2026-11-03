// =============================================================
// IMPOSTORES – "fotos" das árvores para desenhar de longe
// No começo do jogo cada tipo de árvore é fotografado de lado
// (com fundo transparente). Longe do jogador, a árvore vira um
// retângulo com essa foto que sempre olha para a câmera:
// 2 triângulos no lugar de centenas.
// =============================================================
import * as THREE from 'three';
import { SUN_DIR } from './sky.js';

export function renderImpostor(renderer, geometry, map = null) {
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  const w = Math.max(box.max.x - box.min.x, box.max.z - box.min.z) * 1.04;
  const h = (box.max.y - box.min.y) * 1.04;
  const cx = (box.max.x + box.min.x) / 2;
  const cz = (box.max.z + box.min.z) / 2;
  const cy = (box.max.y + box.min.y) / 2;

  const texH = 256;
  const texW = Math.max(64, Math.min(256, 2 ** Math.round(Math.log2((texH * w) / h))));
  const rt = new THREE.WebGLRenderTarget(texW, texH, {
    generateMipmaps: true,
    minFilter: THREE.LinearMipmapLinearFilter,
    magFilter: THREE.LinearFilter,
  });

  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#dbeee6', '#4a4a2c', 1.3));
  const sun = new THREE.DirectionalLight('#fff0d0', 2.4);
  sun.position.copy(SUN_DIR).setZ(Math.abs(SUN_DIR.z) + 0.6).multiplyScalar(100);
  scene.add(sun);
  const mesh = new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, map, alphaTest: map ? 0.42 : 0 }));
  mesh.position.set(-cx, 0, -cz);
  scene.add(mesh);

  const cam = new THREE.OrthographicCamera(-w / 2, w / 2, h / 2, -h / 2, 0.1, 200);
  cam.position.set(0, cy, 80);
  cam.lookAt(0, cy, 0);

  const prevTarget = renderer.getRenderTarget();
  const prevColor = renderer.getClearColor(new THREE.Color());
  const prevAlpha = renderer.getClearAlpha();
  const prevShadow = renderer.shadowMap.enabled;
  renderer.shadowMap.enabled = false;
  // fundo verde-escuro transparente: as bordas não ficam pretas
  renderer.setClearColor('#2a4220', 0);
  renderer.setRenderTarget(rt);
  renderer.clear(true, true, true);
  renderer.render(scene, cam);
  renderer.setRenderTarget(prevTarget);
  renderer.setClearColor(prevColor, prevAlpha);
  renderer.shadowMap.enabled = prevShadow;
  mesh.material.dispose();

  // Retângulo com a base no chão
  const quad = new THREE.PlaneGeometry(w, h);
  quad.translate(0, cy, 0);
  return { texture: rt.texture, geometry: quad, target: rt };
}
