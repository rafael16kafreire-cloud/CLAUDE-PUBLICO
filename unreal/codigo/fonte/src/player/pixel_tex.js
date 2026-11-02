import * as THREE from 'three';

// textura de "pixels" (8x8) que dá cara de bloco: cada pixel clareia ou escurece um pouco
let PIXELS = null;
export function pixelTexture() {
  if (PIXELS) return PIXELS;
  const c = document.createElement('canvas');
  c.width = c.height = 8;
  const g = c.getContext('2d');
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const v = 214 + Math.floor(((Math.sin(x * 12.9 + y * 78.2) * 43758.5) % 1 + 1) % 1 * 41);
      g.fillStyle = `rgb(${v},${v},${v})`;
      g.fillRect(x, y, 1, 1);
    }
  }
  PIXELS = new THREE.CanvasTexture(c);
  PIXELS.magFilter = THREE.NearestFilter;
  PIXELS.minFilter = THREE.NearestFilter;
  PIXELS.colorSpace = THREE.SRGBColorSpace;
  return PIXELS;
}

