// =============================================================
// CENTRAL DE EVENTOS (EventBus)
// Um sistema "avisa" que algo aconteceu (emit) e qualquer outro
// sistema interessado "escuta" (on). Assim as partes do jogo não
// precisam se conhecer diretamente.
// =============================================================

// Lista dos eventos usados no jogo (para consulta rápida).
export const EV = {
  STATE_CHANGED: 'state_changed',         // { from, to }  estado do jogo mudou
  PLAYER_DIED: 'player_died',             // { cause, position }
  RESPAWN_REQUESTED: 'respawn_requested', // { pointId }   jogador escolheu onde renascer
  PLAYER_RESPAWNED: 'player_respawned',   // { pointId }
  MESSAGE: 'message',                     // { text, kind } aviso lateral na tela
  INTERACT_PROMPT: 'interact_prompt',     // { text } ou null  "Beber água"
  WATER_DRUNK: 'water_drunk',             // { fresh, amount }
  XP_GAINED: 'xp_gained',                 // { amount }
  ITEM_SPOILED: 'item_spoiled',           // { id } (comida estragou)
  LEVEL_UP: 'level_up',                   // { level, points }
  DAMAGE_NUMBER: 'damage_number',         // { pos, amount, kind }  número de dano flutuando
  SKILLS_CHANGED: 'skills_changed',       // { key } ponto de habilidade gasto
  CREATURE_TAMED: 'creature_tamed',       // { creature }
  STRUCTURE_REMOVED: 'structure_removed', // { structure } (desmontada)
  SETTINGS_CHANGED: 'settings_changed',   // { key, value, settings }
  CAMERA_MODE: 'camera_mode',             // { mode }
  PLAYER_HURT: 'player_hurt',             // { amount, source }
  CREATURE_KILLED: 'creature_killed',     // { creature, byPlayer }
  BIOME_ENTERED: 'biome_entered',         // { key, name, description }
  INVENTORY_CHANGED: 'inventory_changed', // { inventory }
  CRAFT_QUEUE: 'craft_queue',             // { queue }
  ITEM_GAINED: 'item_gained',             // { id, amount }
  CRAFTED: 'crafted',                     // { id }  item ficou pronto
  STRUCTURE_USED: 'structure_used',       // { structure }  acendeu fogueira, dormiu...
  OPEN_STORAGE: 'open_storage',           // { box }  abriu um baú
  OPEN_CRAFTING: 'open_crafting',         // { station }  abriu a bancada
  PLACED: 'placed',                       // { type, structure }  fogueira, saco de dormir...
  ATE: 'ate',                             // { id }
  COOKED: 'cooked',                       // { id }
  DAWN: 'dawn',                           // { day }  amanheceu
  DUSK: 'dusk',                           // { day }  anoiteceu
  VEG_CONSUMED: 'veg_consumed',           // { rec, remote }  planta coletada (co-op)
  NET: 'net',                             // { status, ... }  co-op (conectado, saiu...)
};

class EventBus {
  constructor() {
    this._listeners = new Map();
  }

  // Escuta um evento. Devolve uma função que cancela a escuta.
  on(name, fn) {
    if (!this._listeners.has(name)) this._listeners.set(name, new Set());
    this._listeners.get(name).add(fn);
    return () => this.off(name, fn);
  }

  off(name, fn) {
    this._listeners.get(name)?.delete(fn);
  }

  // Avisa todo mundo que está escutando. Um erro num ouvinte não
  // derruba os outros.
  emit(name, payload) {
    const set = this._listeners.get(name);
    if (!set) return;
    for (const fn of [...set]) {
      try {
        fn(payload);
      } catch (err) {
        console.error(`[EventBus] erro no evento "${name}":`, err);
      }
    }
  }
}

export const events = new EventBus();
