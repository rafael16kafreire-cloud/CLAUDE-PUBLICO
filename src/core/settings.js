// =============================================================
// SETTINGS – opções escolhidas pelo jogador
// Ficam salvas no próprio navegador (localStorage). Se o navegador
// não deixar salvar (aba anônima, por exemplo), o jogo funciona
// normalmente com os valores padrão.
// =============================================================
import { events, EV } from './event_bus.js';

const STORAGE_KEY = 'ilha-primordial:opcoes';
// Mude este número quando os padrões mudarem (atualiza opções antigas).
const SETTINGS_VERSION = 3;

// Predefinições de qualidade gráfica.
// lodHi/lodLo: até onde as plantas aparecem detalhadas / simples
// (depois disso viram "cartões" leves). grassRadius: raio do mato.
export const QUALITY_PRESETS = {
  baixa: {
    pixelRatio: 0.75, shadows: false, shadowMap: 512, shadowRange: 40, viewDistance: 130,
    lodHi: 22, lodLo: 55, grassRadius: 16, grassDensity: 0.55, creatures: 45, post: 'none',
  },
  media: {
    pixelRatio: 1.0, shadows: true, shadowMap: 2048, shadowRange: 48, viewDistance: 180,
    lodHi: 28, lodLo: 80, grassRadius: 26, grassDensity: 0.9, creatures: 45, post: 'grade',
  },
  alta: {
    pixelRatio: 2, shadows: true, shadowMap: 4096, shadowRange: 80, viewDistance: 320,
    lodHi: 120, lodLo: 240, grassRadius: 55, grassDensity: 1.6, creatures: 45, post: 'cinema',
  },
};

const DEFAULTS = {
  version: SETTINGS_VERSION,
  quality: 'media',        // baixa | media | alta
  viewDistance: 180,       // metros
  sensitivity: 1.0,        // velocidade da câmera
  buttonOpacity: 0.7,      // 0.2 a 1.0
  buttonSize: 1.0,         // 0.7 a 1.4
  showDebug: false,        // overlay de FPS
  smaa: true,              // suavizar bordas (SMAA)
  touchControls: 'auto',   // auto | sempre | nunca
  touchScheme: 'gestos',   // gestos (ARK Mobile) | botoes
  cameraMode: 'primeira',  // primeira | terceira
  autoQuality: true,       // baixa a qualidade sozinho se ficar lento
  playerName: '',          // nome no co-op
  brightness: 1.0,         // gamma/brilho da imagem (0.6 a 1.6); também muda a força do clarão do sol
  volume: 0.8,             // som (0 = mudo)
  music: 0.35,             // música de fundo (0 = sem música)
  buttonLayout: null,      // posição de cada botão de toque ({ id: [x, y] } em fração da tela) ou null = padrão
};

class Settings {
  constructor() {
    this.values = { ...DEFAULTS, ...this._load() };
  }

  get(key) {
    return this.values[key];
  }

  set(key, value) {
    if (this.values[key] === value) return;
    this.values[key] = value;
    this._save();
    events.emit(EV.SETTINGS_CHANGED, { key, value, settings: this.values });
  }

  get quality() {
    return QUALITY_PRESETS[this.values.quality] ?? QUALITY_PRESETS.media;
  }

  _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const saved = raw ? JSON.parse(raw) : {};
      // Opções de uma versão antiga: aplica os padrões novos
      // (ex.: câmera agora começa em primeira pessoa).
      if ((saved.version ?? 1) < SETTINGS_VERSION) {
        delete saved.cameraMode;
        delete saved.viewDistance;
        saved.version = SETTINGS_VERSION;
      }
      return saved;
    } catch {
      return {};
    }
  }

  _save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.values));
    } catch {
      /* sem armazenamento: segue sem salvar */
    }
  }
}

export const settings = new Settings();

// Texturas em alta resolução (2048 px) só na qualidade "alta": gastam
// bem mais memória de vídeo. Vale a partir do próximo carregamento.
export function hdTextures() {
  return settings.get('quality') === 'alta';
}
