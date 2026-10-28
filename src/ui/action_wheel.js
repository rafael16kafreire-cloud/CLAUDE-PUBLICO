// =============================================================
// RODA DE AÇÕES (como no ARK Mobile): abre com um arrasto a partir da borda
// ESQUERDA da tela. Atalhos para o que não tem botão na tela:
// agachar, interagir, montar/desmontar, inventário, construir, mapa,
// recarregar e pausar. Cada item aperta a ação do jogo correspondente.
// (A roda de assovios, dos bichos, abre pela borda DIREITA.)
// =============================================================
import { sound } from '../audio/audio.js';

const ITEMS = [
  { id: 'crouch', label: 'Agachar' },
  { id: 'interact', label: 'Interagir' },
  { id: 'inventory', label: 'Inventário' },
  { id: 'build', label: 'Construir' },
  { id: 'map', label: 'Mapa' },
  { id: 'ammo', label: 'Recarregar' },
  { id: 'pause', label: 'Pausar' },
];

export class ActionWheel {
  constructor(root, { onAction, onClose }) {
    this.onAction = onAction;
    this.onClose = onClose;
    const el = document.createElement('div');
    el.className = 'overlay wheel';
    el.hidden = true;
    const n = ITEMS.length;
    el.innerHTML = `
      <div class="wheel-ring" role="menu" aria-label="Ações">
        ${ITEMS.map((it, i) => {
          // começa no topo e vai no sentido do relógio
          const a = (i / n) * Math.PI * 2 - Math.PI / 2 + Math.PI / n;
          const x = 50 + Math.cos(a) * 36;
          const y = 50 + Math.sin(a) * 36;
          return `<button type="button" class="wheel-item" data-w="${it.id}" style="left:${x.toFixed(1)}%;top:${y.toFixed(1)}%">${it.label}</button>`;
        }).join('')}
        <div class="wheel-hole"></div>
        ${ITEMS.map((_, i) => `<i class="wheel-line" style="transform:rotate(${(i / n) * 360}deg)"></i>`).join('')}
      </div>`;
    root.appendChild(el);
    this.el = el;
    el.addEventListener('pointerdown', (e) => e.stopPropagation());
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-w]');
      this.close();
      if (b) {
        sound.play('clique');
        // depois de fechar a roda (devolve o controle ao jogo), aperta a ação
        setTimeout(() => this.onAction?.(b.dataset.w), 60);
      }
    });
  }

  get visible() {
    return !this.el.hidden;
  }

  open() {
    this.el.hidden = false;
  }

  close() {
    if (this.el.hidden) return;
    this.el.hidden = true;
    this.onClose?.();
  }
}
