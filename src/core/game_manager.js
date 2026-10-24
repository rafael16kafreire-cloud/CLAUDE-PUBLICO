// =============================================================
// GAME MANAGER – estado global do jogo
// Guarda "em que tela estamos" (carregando, menu, jogando, pausado,
// morto) e referências para as peças principais (mundo, jogador...).
// =============================================================
import { events, EV } from './event_bus.js';

export const STATE = {
  LOADING: 'loading',
  MENU: 'menu',
  PLAYING: 'playing',
  PAUSED: 'paused',
  DEAD: 'dead',
};

class GameManager {
  constructor() {
    this.state = STATE.LOADING;
    this.world = null;
    this.player = null;
    this.renderer = null;
    this.camera = null;
    this.isTouch = false;       // celular/tablet (controles na tela)
    this.difficulty = 'normal'; // usado a partir da Fase 12
    this.activeCreatures = 0;   // criaturas ativas perto do jogador (Fase 7)
    this.playTime = 0;          // segundos de jogo
  }

  setState(next) {
    if (next === this.state) return;
    const from = this.state;
    this.state = next;
    events.emit(EV.STATE_CHANGED, { from, to: next });
  }

  get playing() {
    return this.state === STATE.PLAYING;
  }
}

export const game = new GameManager();
