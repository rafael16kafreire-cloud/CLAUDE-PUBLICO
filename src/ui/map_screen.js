// =============================================================
// MAPA DA ILHA – abre com M (PC) ou tocando no minimapa (celular).
// Mostra a ilha inteira, onde você está (seta), os pontos de
// renascer (prismas) e os nomes das regiões. Fecha com M, Esc,
// o X ou tocando fora do mapa.
// =============================================================
import { renderMapImage, worldToMapPercent } from './map_image.js';

export class MapScreen {
  constructor(root, world) {
    this.world = world;
    const el = document.createElement('div');
    el.className = 'overlay mapscreen';
    el.hidden = true;
    el.innerHTML = `
      <div class="mapscreen-panel">
        <div class="death-map-wrap mapscreen-wrap">
          <img class="death-map" alt="Mapa da ilha" data-ref="img">
          <div class="death-pins" data-ref="pins"></div>
          <span class="map-me" data-ref="me" aria-label="Você"></span>
        </div>
        <button type="button" class="btn btn-small mapscreen-close" aria-label="Fechar mapa">✕</button>
      </div>
    `;
    root.appendChild(el);
    this.el = el;
    this.refs = {};
    el.querySelectorAll('[data-ref]').forEach((n) => {
      this.refs[n.dataset.ref] = n;
    });
    el.querySelector('.mapscreen-close').addEventListener('click', () => this.hide());
    el.addEventListener('pointerdown', (e) => {
      if (e.target === el) this.hide();
    });
  }

  get visible() {
    return !this.el.hidden;
  }

  toggle(player, yaw) {
    if (this.visible) this.hide();
    else this.show(player, yaw);
  }

  show(player, yaw) {
    const w = this.world;
    if (!this.refs.img.src) this.refs.img.src = renderMapImage(w);
    const pins = this.refs.pins;
    pins.innerHTML = '';
    for (const r of w.layout.rotulos_mapa ?? []) {
      const p = worldToMapPercent(w, r.x, r.z);
      const label = document.createElement('span');
      label.className = 'map-label';
      label.textContent = r.nome;
      label.style.left = `${p.left}%`;
      label.style.top = `${p.top}%`;
      pins.appendChild(label);
    }
    for (const point of w.allRespawnPoints) {
      const p = worldToMapPercent(w, point.position.x, point.position.z);
      const s = document.createElement('span');
      s.className = point.bag ? 'map-pin map-pin-bag' : 'map-pin';
      s.style.left = `${p.left}%`;
      s.style.top = `${p.top}%`;
      s.innerHTML = '<svg class="pin-dot" viewBox="0 0 20 24" aria-hidden="true"><path class="pr-l" d="M10 1 2 8l8 15Z"/><path class="pr-r" d="M10 1l8 7-8 15Z"/><path class="pr-t" d="M10 1 2 8h16Z"/></svg><span class="pin-name"></span>';
      s.lastElementChild.textContent = point.name;
      pins.appendChild(s);
    }
    this.update(player, yaw);
    this.el.hidden = false;
  }

  // Seta do jogador (posição e para onde olha).
  update(player, yaw) {
    if (!player) return;
    const p = worldToMapPercent(this.world, player.position.x, player.position.z);
    const me = this.refs.me;
    me.style.left = `${p.left}%`;
    me.style.top = `${p.top}%`;
    const fx = -Math.sin(yaw);
    const fz = -Math.cos(yaw);
    me.style.transform = `translate(-50%, -50%) rotate(${Math.atan2(fx, -fz)}rad)`;
  }

  hide() {
    this.el.hidden = true;
  }
}
