// =============================================================
// MINIMAPA – quadradinho no canto de cima, à direita: mostra a volta
// do jogador (norte para cima) e uma seta para onde ele olha.
// Usa a mesma imagem do mapa da tela de morte (feita uma vez só).
// =============================================================
import { renderMapImage } from './map_image.js';

const VIEW_M = 420; // metros mostrados de lado a lado

export class Minimap {
  constructor(root, world) {
    this.world = world;
    const el = document.createElement('div');
    el.className = 'minimap';
    el.innerHTML = '<canvas></canvas><span class="minimap-n">N</span>';
    root.appendChild(el);
    this.el = el;
    this.canvas = el.querySelector('canvas');
    this.img = null;
    this._t = 0;
  }

  setVisible(v) {
    this.el.hidden = !v;
  }

  update(dt, player, yaw) {
    if (this.el.hidden) return;
    this._t -= dt;
    if (this._t > 0) return;
    this._t = 0.15;
    if (!this.img) {
      this.img = new Image();
      this.img.src = renderMapImage(this.world);
    }
    if (!this.img.complete || !this.img.naturalWidth) return;
    const cv = this.canvas;
    const size = Math.round(this.el.clientWidth * Math.min(2, window.devicePixelRatio || 1)) || 80;
    if (cv.width !== size) {
      cv.width = size;
      cv.height = size;
    }
    const g = cv.getContext('2d');
    const map = this.world.map;
    const ppm = this.img.naturalWidth / map.size; // pixels da imagem por metro
    const px = (player.position.x + map.half) * ppm;
    const pz = (player.position.z + map.half) * ppm;
    const half = (VIEW_M / 2) * ppm;
    g.fillStyle = '#163f55';
    g.fillRect(0, 0, size, size);
    g.drawImage(this.img, px - half, pz - half, half * 2, half * 2, 0, 0, size, size);
    // seta do jogador (para onde a câmera olha)
    const fx = -Math.sin(yaw);
    const fz = -Math.cos(yaw);
    const a = Math.atan2(fx, -fz);
    g.save();
    g.translate(size / 2, size / 2);
    g.rotate(a);
    const s = size / 11;
    g.beginPath();
    g.moveTo(0, -s);
    g.lineTo(s * 0.7, s * 0.8);
    g.lineTo(0, s * 0.35);
    g.lineTo(-s * 0.7, s * 0.8);
    g.closePath();
    g.fillStyle = '#ffffff';
    g.strokeStyle = 'rgba(0,0,0,0.7)';
    g.lineWidth = Math.max(1, size / 60);
    g.fill();
    g.stroke();
    g.restore();
  }
}
