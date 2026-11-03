// Escolhe o modelo do personagem pela opção "Personagem" (quadradinho ou realista).
import { PlayerModel } from './player_model.js';
import { BlockyModel } from './blocky_model.js';
import { settings } from '../core/settings.js';

export function makePlayerModel() {
  return settings.get('personagem') === 'realista' ? new PlayerModel() : new BlockyModel();
}
