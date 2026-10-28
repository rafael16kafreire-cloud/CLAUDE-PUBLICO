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
          return `<button type="button" class="wheel-item" data-w="${it.id}" style="left:${x.toFixed(1)}%;top:${y.toFixed(1)}%;--i:${i}">${it.label}</button>`;
        }).join('')}
        <div class="wheel-hole"></div>
        ${ITEMS.map((_, i) => `<i class="wheel-line" style="transform:rotate(${(i / n) * 360}deg)"></i>`).join('')}
      </div>`;
    root.appendChild(el);
    this.el = el;
    el.addEventListener('pointerdown', (e) => e.stopPropagation());
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-w]');
      if (b) b.classList.add('escolhido');
      this.close();
      if (b) {
        sound.play('clique');
        // depois de fechar a roda (devolve o controle ao jogo), aperta a ação
        setTimeout(() => this.onAction?.(b.dataset.w), 60);
      }
    });
  }

  get visible() {
    return !this.el.hidden && !this.el.classList.contains('fechando');
  }

  // Abre com animação (a roda cresce girando um pouco e os itens entram um por um) e fecha encolhendo.
  open() {
    clearTimeout(this._t);
    this.el.classList.remove('fechando');
    this.el.hidden = false;
    for (const b of this.el.querySelectorAll('.wheel-item')) b.classList.remove('escolhido');
    this.el.classList.add('abrindo');
    this._t = setTimeout(() => this.el.classList.remove('abrindo'), 480);
  }

  close() {
    if (this.el.hidden || this.el.classList.contains('fechando')) return;
    clearTimeout(this._t);
    this.el.classList.remove('abrindo');
    this.el.classList.add('fechando');
    this.onClose?.(); // o jogo já volta a responder; só a roda ainda está sumindo
    this._t = setTimeout(() => {
      this.el.hidden = true;
      this.el.classList.remove('fechando');
    }, 220);
  }
}
