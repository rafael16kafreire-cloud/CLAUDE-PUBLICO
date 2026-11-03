// =============================================================
// OVERLAY DE DEBUG (liga/desliga com F3 ou o botão "FPS")
// Mostra FPS, criaturas ativas, memória e quanto o celular está
// desenhando por quadro — útil para achar o que está pesado.
// =============================================================
import { game } from '../core/game_manager.js';
import { BALANCE } from '../core/balance.js';

export class DebugOverlay {
  constructor(root, renderer) {
    this.renderer = renderer;
    this.el = document.createElement('pre');
    this.el.className = 'debug';
    this.el.hidden = true;
    root.appendChild(this.el);
    this._frames = 0;
    this._acc = 0;
    this._worst = 0;
    this.fps = 0;
  }

  setVisible(v) {
    this.el.hidden = !v;
  }

  get visible() {
    return !this.el.hidden;
  }

  // Chamado depois de desenhar cada quadro.
  frame(dt) {
    this._frames += 1;
    this._acc += dt;
    this._worst = Math.max(this._worst, dt);
    if (this._acc < 0.5) return;
    this.fps = this._frames / this._acc;
    const avgMs = (this._acc / this._frames) * 1000;
    const worstMs = this._worst * 1000;
    this._frames = 0;
    this._acc = 0;
    this._worst = 0;
    if (this.el.hidden) return;

    const info = this.renderer.info;
    const mem = performance.memory
      ? `${Math.round(performance.memory.usedJSHeapSize / 1048576)} MB`
      : 'n/d neste navegador';
    const p = game.player?.position;
    const world = game.world;
    const lines = [
      `FPS ${this.fps.toFixed(0)}   ${avgMs.toFixed(1)} ms (pior ${worstMs.toFixed(0)} ms)`,
      `Criaturas ativas: ${game.activeCreatures} / ${BALANCE.desempenho.criaturas_max_ativas}`,
      `Memória JS: ${mem}`,
      `Desenhos: ${info.render.calls}   Triângulos: ${(info.render.triangles / 1000).toFixed(0)} mil`,
      `Resolução: ${this.renderer.domElement.width}x${this.renderer.domElement.height}`,
    ];
    if (p && world) {
      lines.push(`Posição: ${p.x.toFixed(0)}, ${p.z.toFixed(0)}  altitude ${p.y.toFixed(1)} m`);
      lines.push(`Bioma: ${world.biomeNameAt(p.x, p.z)}`);
    }
    this.el.textContent = lines.join('\n');
  }
}
