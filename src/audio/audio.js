// =============================================================
// SONS – todos gerados por código (Web Audio), nada gravado de
// outros jogos. Leve para o celular: poucos "osciladores" por som.
//
//  - Ambiente: de dia vento, pássaros e insetos; à noite grilos,
//    sapos e corujas. Perto do pântano, mais sapos.
//  - Efeitos: passos, golpe no ar, madeira, pedra, folhas, carne,
//    pegar item, criar item, comer, beber, dor, morte, nível,
//    fogueira, água, cliques.
//  - Bichos: cada espécie tem uma "voz" (tamanho = mais grave;
//    carnívoro = rugido; herbívoro = mugido/buzina; pequeno = pio).
//    O som vem da direção do bicho e fica mais baixo de longe.
//
// Uso: import { sound } from '../audio/audio.js';
//      sound.play('madeira', posição)   sound.creature(c, 'rugido')
// =============================================================
import * as THREE from 'three';

const MAX_VOICES = 28;

// Voz de cada espécie: tipo, tom base (Hz) e duração base (s).
const VOICES = {
  dodo: { kind: 'ave', f: 520, d: 0.35 },
  arara: { kind: 'arara', f: 900, d: 0.4 },
  compsognato: { kind: 'pio', f: 1300, d: 0.25 },
  galimimo: { kind: 'ave', f: 420, d: 0.5 },
  capivara: { kind: 'assobio', f: 700, d: 0.3 },
  parassauro: { kind: 'buzina', f: 95, d: 1.6 },
  paquicefalossauro: { kind: 'mugido', f: 140, d: 0.9 },
  triceratops: { kind: 'mugido', f: 70, d: 1.2 },
  estegossauro: { kind: 'mugido', f: 80, d: 1.1 },
  anquilossauro: { kind: 'mugido', f: 75, d: 1.0 },
  braquiossauro: { kind: 'buzina', f: 45, d: 2.4 },
  dilofossauro: { kind: 'chiado', f: 420, d: 0.7 },
  raptor: { kind: 'grito', f: 360, d: 0.6 },
  onca: { kind: 'rosnado', f: 110, d: 0.9 },
  aranha: { kind: 'chiado', f: 900, d: 0.5 },
  carnotauro: { kind: 'rugido', f: 85, d: 1.4 },
  trex: { kind: 'rugido', f: 48, d: 2.2 },
  titanoboa: { kind: 'chiado', f: 260, d: 1.2 },
  deinosuchus: { kind: 'rosnado', f: 55, d: 1.3 },
  espinossauro: { kind: 'rugido', f: 60, d: 2.0 },
  piranha: { kind: 'nenhum', f: 0, d: 0 },
  pterodactilo: { kind: 'grito', f: 700, d: 0.5 },
  quetzalcoatlus: { kind: 'grito', f: 300, d: 0.9 },
  mamute: { kind: 'buzina', f: 120, d: 1.4 },
  argentavis: { kind: 'grito', f: 520, d: 0.7 },
  reidodo: { kind: 'rugido', f: 140, d: 1.2 },
};

class Sound {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.volume = 0.8;
    this.voices = 0;
    this._listenerPos = new THREE.Vector3();
    this._fwd = new THREE.Vector3();
    this._amb = { t: 0, bird: 2, insect: 1, frog: 3, owl: 8, cricket: 0 };
    this._fire = null;
    this._wind = null;
    this._muffled = false;
    this.musicVolume = 0.35;
    this._music = { next: 0, bar: 0, step: 0 };
  }

  // Precisa de um toque/clique do jogador para começar (regra dos navegadores).
  unlock() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        const c = this.ctx;
        this.master = c.createGain();
        this.master.gain.value = this.volume;
        // água / embaixo d'água: abafa tudo
        this.lowpass = c.createBiquadFilter();
        this.lowpass.type = 'lowpass';
        this.lowpass.frequency.value = 20000;
        this.lowpass.connect(this.master);
        this.master.connect(c.destination);
        this.out = this.lowpass;
        this.ambBus = c.createGain();
        this.ambBus.gain.value = 0.55;
        this.ambBus.connect(this.out);
        this.noise = this._makeNoise(2, 'white');
        this.brown = this._makeNoise(4, 'brown');
        this.musicBus = c.createGain();
        this.musicBus.gain.value = this.musicVolume;
        this.musicBus.connect(this.master);
        this._startWind();
        this._startFire();
        this._startCicadas();
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
    } catch (err) {
      console.warn('[som]', err);
      this.ctx = null;
    }
  }

  // Música (separada dos efeitos).
  setMusicVolume(v) {
    this.musicVolume = v;
    if (this.musicBus) this.musicBus.gain.setTargetAtTime(v, this.ctx.currentTime, 0.2);
  }

  setVolume(v) {
    this.volume = v;
    if (this.master) this.master.gain.setTargetAtTime(this.enabled ? v : 0, this.ctx.currentTime, 0.05);
  }

  // Pausado / app em segundo plano: abaixa tudo.
  setPaused(p) {
    if (!this.ctx) return;
    if (p) this.ctx.suspend?.();
    else this.ctx.resume?.();
  }

  setUnderwater(on) {
    if (!this.ctx || on === this._muffled) return;
    this._muffled = on;
    this.lowpass.frequency.setTargetAtTime(on ? 600 : 20000, this.ctx.currentTime, 0.08);
  }

  _makeNoise(seconds, color) {
    const c = this.ctx;
    const len = Math.floor(c.sampleRate * seconds);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (color === 'brown') {
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.5;
      } else d[i] = w;
    }
    return buf;
  }

  // ---------------------------------------------------------
  // Peças básicas
  // ---------------------------------------------------------
  get ready() {
    return !!this.ctx && this.ctx.state === 'running' && this.enabled;
  }

  // Saída com posição (som vem do lado certo e baixa com a distância).
  _dest(pos, gain = 1, ref = 4, max = 80) {
    const c = this.ctx;
    const g = c.createGain();
    g.gain.value = gain;
    if (!pos) {
      g.connect(this.out);
      return g;
    }
    const d = pos.distanceTo(this._listenerPos);
    if (d > max) return null;
    const p = c.createStereoPanner ? c.createStereoPanner() : null;
    // volume pela distância
    g.gain.value = gain * Math.min(1, ref / Math.max(ref, d)) * (1 - d / (max * 1.15));
    if (p) {
      const dx = pos.x - this._listenerPos.x;
      const dz = pos.z - this._listenerPos.z;
      // lado: produto vetorial entre a frente da câmera e a direção do som
      const side = (this._fwd.x * dz - this._fwd.z * dx) / (Math.hypot(dx, dz) || 1);
      p.pan.value = Math.max(-0.85, Math.min(0.85, side));
      g.connect(p);
      p.connect(this.out);
    } else {
      g.connect(this.out);
    }
    return g;
  }

  _voice(dur) {
    if (this.voices >= MAX_VOICES) return false;
    this.voices++;
    setTimeout(() => {
      this.voices--;
    }, (dur + 0.1) * 1000);
    return true;
  }

  // Envelope de volume: ataque rápido e queda.
  _env(param, t, peak, attack, decay, sustain = 0.0001) {
    param.cancelScheduledValues(t);
    param.setValueAtTime(0.0001, t);
    param.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
    param.exponentialRampToValueAtTime(Math.max(0.0001, sustain), t + attack + decay);
  }

  _osc(type, f, t, dur, out, peak = 0.3, attack = 0.005, glideTo = null) {
    const c = this.ctx;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, glideTo), t + dur);
    const g = c.createGain();
    this._env(g.gain, t, peak, attack, dur);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + attack + dur + 0.05);
    return o;
  }

  _noise(t, dur, out, { peak = 0.3, attack = 0.003, type = 'bandpass', f = 1000, q = 1, fTo = null, brown = false } = {}) {
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = brown ? this.brown : this.noise;
    src.loop = true;
    const filt = c.createBiquadFilter();
    filt.type = type;
    filt.frequency.setValueAtTime(f, t);
    if (fTo) filt.frequency.exponentialRampToValueAtTime(fTo, t + dur);
    filt.Q.value = q;
    const g = c.createGain();
    this._env(g.gain, t, peak, attack, dur);
    src.connect(filt).connect(g).connect(out);
    src.start(t, Math.random());
    src.stop(t + attack + dur + 0.05);
  }

  // ---------------------------------------------------------
  // Efeitos
  // ---------------------------------------------------------
  play(name, pos = null, opts = {}) {
    if (!this.ready) return;
    const c = this.ctx;
    const t = c.currentTime + 0.005;
    const v = opts.volume ?? 1;
    if (pos && pos.distanceTo(this._listenerPos) > 75) return;
    const R = (a, b) => a + Math.random() * (b - a);
    switch (name) {
      case 'passo': {
        if (!this._voice(0.2)) return;
        const out = this._dest(pos, 0.35 * v);
        const surf = opts.surface ?? 'mato';
        if (surf === 'agua') this._noise(t, 0.18, out, { f: R(500, 900), q: 0.8, peak: 0.5, type: 'lowpass' });
        else if (surf === 'areia') this._noise(t, 0.09, out, { f: R(2500, 3500), q: 0.6, peak: 0.35 });
        else {
          this._noise(t, 0.07, out, { f: R(700, 1100), q: 0.7, peak: 0.45, brown: true, type: 'lowpass' });
          this._noise(t + 0.01, 0.06, out, { f: R(3000, 5000), q: 1.5, peak: 0.08 });
        }
        break;
      }
      case 'golpe': { // golpe no ar
        if (!this._voice(0.25)) return;
        this._noise(t, 0.2, this._dest(null, 0.25 * v), { f: 400, fTo: 1800, q: 2, attack: 0.03, peak: 0.6 });
        break;
      }
      case 'madeira': {
        if (!this._voice(0.35)) return;
        const out = this._dest(pos, 0.7 * v);
        this._osc('triangle', R(150, 190), t, 0.18, out, 0.5, 0.002, 90);
        this._noise(t, 0.05, out, { f: 2200, q: 1.2, peak: 0.5 });
        this._noise(t + 0.02, 0.25, out, { f: 5000, q: 0.5, peak: 0.06 }); // folhas balançando
        break;
      }
      case 'pedra': {
        if (!this._voice(0.3)) return;
        const out = this._dest(pos, 0.6 * v);
        this._noise(t, 0.04, out, { f: 3500, q: 3, peak: 0.6 });
        this._osc('square', R(900, 1300), t, 0.06, out, 0.08, 0.001, 600);
        this._noise(t + 0.03, 0.12, out, { f: 1500, q: 0.8, peak: 0.15, brown: true, type: 'lowpass' });
        break;
      }
      case 'folhas': {
        if (!this._voice(0.4)) return;
        const out = this._dest(pos, 0.5 * v);
        for (let i = 0; i < 3; i++) this._noise(t + i * 0.06, 0.12, out, { f: R(3500, 6000), q: 0.7, peak: 0.25 });
        break;
      }
      case 'carne': {
        if (!this._voice(0.3)) return;
        const out = this._dest(pos, 0.7 * v);
        this._osc('sine', R(85, 110), t, 0.16, out, 0.6, 0.002, 50);
        this._noise(t, 0.08, out, { f: 600, q: 0.8, peak: 0.35, brown: true, type: 'lowpass' });
        break;
      }
      case 'pegar': {
        if (!this._voice(0.15)) return;
        const out = this._dest(null, 0.18 * v);
        this._osc('sine', 880, t, 0.08, out, 0.4, 0.004, 1320);
        break;
      }
      case 'criar': {
        if (!this._voice(0.6)) return;
        const out = this._dest(null, 0.22 * v);
        [660, 880, 1320].forEach((f, i) => this._osc('triangle', f, t + i * 0.08, 0.25, out, 0.35));
        break;
      }
      case 'comer': {
        if (!this._voice(0.5)) return;
        const out = this._dest(null, 0.4 * v);
        for (let i = 0; i < 4; i++) this._noise(t + i * 0.1, 0.05, out, { f: R(1500, 2800), q: 1, peak: 0.4 });
        break;
      }
      case 'beber': {
        if (!this._voice(0.5)) return;
        const out = this._dest(null, 0.35 * v);
        for (let i = 0; i < 3; i++) this._osc('sine', R(220, 300), t + i * 0.13, 0.1, out, 0.5, 0.01, R(120, 160));
        break;
      }
      case 'dor': {
        if (!this._voice(0.4)) return;
        const out = this._dest(null, 0.5 * v);
        this._osc('sine', 110, t, 0.25, out, 0.7, 0.003, 55);
        this._noise(t, 0.12, out, { f: 800, q: 0.7, peak: 0.3, brown: true, type: 'lowpass' });
        break;
      }
      case 'morte': {
        if (!this._voice(1.6)) return;
        const out = this._dest(null, 0.5 * v);
        this._osc('sawtooth', 180, t, 1.4, out, 0.15, 0.05, 50);
        this._osc('sine', 90, t, 1.5, out, 0.4, 0.05, 35);
        break;
      }
      case 'nivel': {
        if (!this._voice(0.9)) return;
        const out = this._dest(null, 0.22 * v);
        [523, 659, 784, 1047].forEach((f, i) => this._osc('triangle', f, t + i * 0.1, 0.35, out, 0.35));
        break;
      }
      case 'clique': {
        if (!this._voice(0.08)) return;
        this._osc('square', 1400, t, 0.03, this._dest(null, 0.06 * v), 0.4, 0.001);
        break;
      }
      case 'pulo': {
        if (!this._voice(0.2)) return;
        this._noise(t, 0.08, this._dest(null, 0.2 * v), { f: 900, q: 0.5, peak: 0.4, brown: true, type: 'lowpass' });
        break;
      }
      case 'queda': {
        if (!this._voice(0.25)) return;
        const out = this._dest(null, 0.4 * v);
        this._osc('sine', 70, t, 0.14, out, 0.6, 0.002, 40);
        this._noise(t, 0.1, out, { f: 700, q: 0.6, peak: 0.4, brown: true, type: 'lowpass' });
        break;
      }
      case 'splash': {
        if (!this._voice(0.6)) return;
        const out = this._dest(pos, 0.6 * v);
        this._noise(t, 0.5, out, { f: 2500, fTo: 500, q: 0.6, peak: 0.6, attack: 0.01 });
        break;
      }
      case 'acender': {
        if (!this._voice(0.8)) return;
        const out = this._dest(pos, 0.5 * v);
        this._noise(t, 0.7, out, { f: 300, fTo: 2500, q: 0.8, peak: 0.5, attack: 0.15, brown: true, type: 'lowpass' });
        break;
      }
      case 'colocar': {
        if (!this._voice(0.3)) return;
        const out = this._dest(pos, 0.5 * v);
        this._osc('sine', 120, t, 0.15, out, 0.5, 0.002, 70);
        this._noise(t, 0.1, out, { f: 1200, q: 0.6, peak: 0.25 });
        break;
      }
      default:
        break;
    }
  }

  // ---------------------------------------------------------
  // Vozes dos bichos. kind: 'chamado' (à toa), 'rugido' (viu você),
  // 'ataque' (bote/mordida), 'dor', 'morte'
  // ---------------------------------------------------------
  creature(c, kind) {
    if (!this.ready || !c) return;
    const v = VOICES[c.species.id];
    if (!v || v.kind === 'nenhum') return;
    const pos = c.pos;
    const big = Math.min(2.2, Math.max(0.6, c.scale ?? 1));
    const ref = 6 * big;
    const max = 45 + 60 * Math.min(1, v.d);
    if (pos.distanceTo(this._listenerPos) > max) return;
    const t = this.ctx.currentTime + 0.01;
    const R = (a, b) => a + Math.random() * (b - a);
    const pitchMul = { chamado: 1, rugido: 0.92, ataque: 1.15, dor: 1.35, morte: 0.8 }[kind] ?? 1;
    const durMul = { chamado: 0.8, rugido: 1.2, ataque: 0.45, dor: 0.45, morte: 1.5 }[kind] ?? 1;
    const f = v.f * pitchMul * R(0.92, 1.08) / Math.sqrt(big);
    const d = v.d * durMul;
    if (!this._voice(d + 0.2)) return;
    const out = this._dest(pos, (kind === 'chamado' ? 0.45 : 0.75), ref, max);
    if (!out) return;
    const c2 = this.ctx;
    if (kind === 'ataque' && v.kind !== 'ave' && v.kind !== 'pio') {
      // estalo de mandíbula
      this._noise(t + d * 0.6, 0.05, out, { f: 1800, q: 1, peak: 0.5 });
    }
    switch (v.kind) {
      case 'rugido':
      case 'rosnado': {
        // corpo do rugido: serra grave passando por "boca" (filtro)
        const o = c2.createOscillator();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(f * 1.25, t);
        o.frequency.exponentialRampToValueAtTime(f, t + d * 0.3);
        o.frequency.exponentialRampToValueAtTime(f * 0.7, t + d);
        const lfo = c2.createOscillator();
        lfo.frequency.value = v.kind === 'rosnado' ? 28 : 11;
        const lg = c2.createGain();
        lg.gain.value = f * 0.08;
        lfo.connect(lg).connect(o.frequency);
        const bp = c2.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.setValueAtTime(f * 6, t);
        bp.frequency.exponentialRampToValueAtTime(f * 3, t + d);
        bp.Q.value = 1.4;
        const g = c2.createGain();
        this._env(g.gain, t, 0.9, d * 0.15, d * 0.85);
        o.connect(bp).connect(g).connect(out);
        o.start(t);
        lfo.start(t);
        o.stop(t + d + 0.1);
        lfo.stop(t + d + 0.1);
        this._noise(t, d, out, { f: f * 8, q: 0.8, peak: 0.35, attack: d * 0.2, brown: true });
        this._osc('sine', f * 0.5, t, d, out, 0.5, d * 0.2, f * 0.35);
        break;
      }
      case 'mugido':
      case 'buzina': {
        const o = c2.createOscillator();
        o.type = v.kind === 'buzina' ? 'sawtooth' : 'triangle';
        o.frequency.setValueAtTime(f, t);
        o.frequency.linearRampToValueAtTime(f * 1.12, t + d * 0.4);
        o.frequency.linearRampToValueAtTime(f * 0.9, t + d);
        const lp = c2.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = f * (v.kind === 'buzina' ? 7 : 4);
        lp.Q.value = 4;
        const g = c2.createGain();
        this._env(g.gain, t, 0.7, d * 0.25, d * 0.75);
        o.connect(lp).connect(g).connect(out);
        o.start(t);
        o.stop(t + d + 0.1);
        if (v.kind === 'buzina') this._osc('sine', f * 2, t, d, out, 0.15, d * 0.3);
        break;
      }
      case 'grito': {
        this._osc('sawtooth', f * 1.6, t, d, out, 0.25, 0.02, f * 0.9);
        this._osc('square', f * 2.4, t, d * 0.8, out, 0.06, 0.02, f * 1.5);
        this._noise(t, d * 0.8, out, { f: f * 4, q: 3, peak: 0.25 });
        break;
      }
      case 'chiado': {
        this._noise(t, d, out, { f: f * 6, q: 0.7, peak: 0.6, attack: d * 0.15, type: 'highpass' });
        break;
      }
      case 'ave':
      case 'pio':
      case 'assobio': {
        const n = v.kind === 'ave' ? 2 : v.kind === 'pio' ? 3 : 1;
        for (let i = 0; i < n; i++) this._osc('sine', f * R(0.95, 1.2), t + i * d * 0.45, d * 0.35, out, 0.4, 0.01, f * R(0.6, 1.5));
        break;
      }
      case 'arara': {
        this._osc('sawtooth', f, t, d, out, 0.18, 0.01, f * 0.7);
        this._noise(t, d, out, { f: f * 2.2, q: 4, peak: 0.3 });
        break;
      }
      default:
        break;
    }
  }

  // ---------------------------------------------------------
  // Fundo (chamado todo quadro)
  // ---------------------------------------------------------
  _startWind() {
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = this.brown;
    src.loop = true;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 500;
    const g = c.createGain();
    g.gain.value = 0.15;
    src.connect(lp).connect(g).connect(this.ambBus);
    src.start();
    this._wind = { lp, g };
  }

  _startFire() {
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 900;
    bp.Q.value = 0.6;
    const g = c.createGain();
    g.gain.value = 0;
    src.connect(bp).connect(g).connect(this.out);
    src.start();
    this._fire = { g, bp };
  }

  // camera, world (hora do dia, fogueiras), focus (jogador)
  update(dt, camera, world, focus) {
    if (!this.ready) return;
    this._listenerPos.copy(camera.position);
    camera.getWorldDirection(this._fwd);
    const t = this.ctx.currentTime;
    const day = world.sky.daylight;
    const night = world.sky.isNight;
    const a = this._amb;
    a.t += dt;
    this._updateMusic(night);
    // cigarras: zumbido contínuo de dia, some à noite
    if (this._cicada) this._cicada.g.gain.setTargetAtTime(night ? 0 : 0.018 + 0.012 * Math.sin(a.t * 0.4), t, 1.5);

    // vento: sobe e desce devagar; mais forte no alto
    const alt = Math.max(0, camera.position.y - world.heightAt(camera.position.x, camera.position.z));
    const gust = 0.1 + 0.07 * Math.sin(a.t * 0.23) + 0.04 * Math.sin(a.t * 0.71) + Math.min(0.15, alt * 0.004);
    this._wind.g.gain.setTargetAtTime(gust, t, 0.5);
    this._wind.lp.frequency.setTargetAtTime(380 + gust * 1200, t, 0.5);

    // fogueira mais perto: estalos
    let fd = Infinity;
    for (const s of world.structures) if (s.lit) fd = Math.min(fd, s.position.distanceTo(focus));
    const fireVol = fd < 14 ? 0.12 * (1 - fd / 14) : 0;
    this._fire.g.gain.setTargetAtTime(fireVol * (0.7 + Math.random() * 0.6), t, 0.03);
    if (fireVol > 0 && Math.random() < dt * 9) this._crackle(fireVol);

    const swamp = world.biomeKeyAt(focus.x, focus.z);
    const wet = swamp === 'pantano' || swamp === 'igapo';
    // pássaros (dia)
    a.bird -= dt;
    if (a.bird <= 0) {
      a.bird = 1.2 + Math.random() * 3.5;
      if (!night) this._bird(day);
    }
    // insetos (zumbido distante, dia e noite)
    a.insect -= dt;
    if (a.insect <= 0) {
      a.insect = 2 + Math.random() * 4;
      this._insect();
    }
    // grilos (noite, contínuo em rajadas)
    a.cricket -= dt;
    if (a.cricket <= 0) {
      a.cricket = 0.35 + Math.random() * 0.5;
      if (night || day < 0.45) this._cricket();
    }
    // sapos (noite; no pântano também de dia)
    a.frog -= dt;
    if (a.frog <= 0) {
      a.frog = (wet ? 1 : 3) + Math.random() * 3;
      if (night || wet) this._frog();
    }
    // coruja (noite)
    a.owl -= dt;
    if (a.owl <= 0) {
      a.owl = 10 + Math.random() * 14;
      if (night) this._owl();
    }
  }

  _ambOut(pan, gain) {
    const c = this.ctx;
    const g = c.createGain();
    g.gain.value = gain;
    if (c.createStereoPanner) {
      const p = c.createStereoPanner();
      p.pan.value = pan;
      g.connect(p).connect(this.ambBus);
    } else g.connect(this.ambBus);
    return g;
  }

  _bird(day) {
    if (!this._voice(1.6)) return;
    const t = this.ctx.currentTime + 0.01;
    const out = this._ambOut(Math.random() * 1.6 - 0.8, 0.08 + Math.random() * 0.12 * day);
    const kind = Math.random();
    // tipos de pássaro da floresta (vozes inventadas, não gravadas)
    if (kind < 0.18) {
      // assobio longo que sobe e desce
      const f0 = 1400 + Math.random() * 900;
      this._osc('sine', f0, t, 0.45, out, 0.45, 0.04, f0 * 1.5);
      this._osc('sine', f0 * 1.5, t + 0.5, 0.5, out, 0.4, 0.04, f0 * 0.9);
      return;
    }
    if (kind < 0.32) {
      // trinado rápido
      const f0 = 2600 + Math.random() * 1500;
      for (let i = 0; i < 9; i++) this._osc('sine', f0 * (1 + (i % 2) * 0.12), t + i * 0.045, 0.035, out, 0.35, 0.003);
      return;
    }
    if (kind < 0.42) {
      // "piu-piu" de duas notas
      const f0 = 2000 + Math.random() * 800;
      this._osc('triangle', f0, t, 0.12, out, 0.4, 0.01, f0 * 1.05);
      this._osc('triangle', f0 * 0.8, t + 0.22, 0.18, out, 0.4, 0.01, f0 * 0.75);
      return;
    }
    if (kind < 0.5) {
      // grasnado de tucano/papagaio ao longe
      const f0 = 500 + Math.random() * 300;
      this._osc('sawtooth', f0, t, 0.18, out, 0.12, 0.01, f0 * 0.8);
      this._osc('sawtooth', f0 * 1.1, t + 0.25, 0.16, out, 0.1, 0.01, f0 * 0.85);
      return;
    }
    if (kind < 0.56) {
      // pica-pau batendo
      for (let i = 0; i < 6; i++) this._noise(t + i * 0.07, 0.015, out, { f: 1600, q: 3, peak: 0.6, attack: 0.001 });
      return;
    }
    const f = 1800 + Math.random() * 2500;
    const n = 2 + Math.floor(Math.random() * 4);
    const style = Math.random();
    for (let i = 0; i < n; i++) {
      const ti = t + i * (0.09 + Math.random() * 0.08);
      if (style < 0.5) this._osc('sine', f, ti, 0.07, out, 0.5, 0.005, f * 1.4);
      else this._osc('sine', f * 1.3, ti, 0.1, out, 0.4, 0.01, f * 0.8);
    }
  }

  _startCicadas() {
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 6200;
    bp.Q.value = 6;
    // pulsação rápida das cigarras
    const am = c.createGain();
    am.gain.value = 0.6;
    const lfo = c.createOscillator();
    lfo.frequency.value = 38;
    const lg = c.createGain();
    lg.gain.value = 0.4;
    lfo.connect(lg).connect(am.gain);
    const g = c.createGain();
    g.gain.value = 0;
    src.connect(bp).connect(am).connect(g).connect(this.ambBus);
    src.start();
    lfo.start();
    this._cicada = { g };
  }

  // ---------------------------------------------------------
  // Musiquinha de fundo: acordes calmos + notas de "marimba".
  // De noite fica mais lenta e mais escura. Tudo inventado aqui.
  // ---------------------------------------------------------
  _updateMusic(night) {
    if (!this.musicBus || this.musicVolume <= 0.001) return;
    const c = this.ctx;
    const M = this._music;
    const beat = night ? 0.95 : 0.75; // segundos por tempo
    if (M.next < c.currentTime) M.next = c.currentTime + 0.2;
    // agenda 1 compasso de cada vez, um pouco antes da hora
    if (M.next - c.currentTime > 1.2) return;
    const DAY = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]];      // Lá m, Fá, Dó, Sol
    const NIGHT = [[57, 60, 64], [50, 53, 57], [52, 55, 59], [57, 60, 64]];    // Lá m, Ré m, Mi m, Lá m
    const prog = night ? NIGHT : DAY;
    const chord = prog[M.bar % prog.length];
    const hz = (n) => 440 * Math.pow(2, (n - 69) / 12);
    const t0 = M.next;
    const barLen = beat * 4;
    // acorde (pad suave)
    for (const n of chord) {
      const o = c.createOscillator();
      o.type = 'triangle';
      o.frequency.value = hz(n - 12);
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = night ? 700 : 1100;
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(0.035, t0 + barLen * 0.35);
      g.gain.linearRampToValueAtTime(0.0001, t0 + barLen * 1.05);
      o.connect(lp).connect(g).connect(this.musicBus);
      o.start(t0);
      o.stop(t0 + barLen * 1.1);
    }
    // baixo
    const b = c.createOscillator();
    b.type = 'sine';
    b.frequency.value = hz(chord[0] - 24);
    const bg = c.createGain();
    this._env(bg.gain, t0, 0.09, 0.05, barLen * 0.9);
    b.connect(bg).connect(this.musicBus);
    b.start(t0);
    b.stop(t0 + barLen);
    // melodia esparsa (pentatônica de Lá menor)
    const scale = [57, 60, 62, 64, 67, 69, 72, 74, 76];
    for (let i = 0; i < 8; i++) {
      if (Math.random() < (night ? 0.72 : 0.55)) continue;
      const n = scale[Math.floor(Math.random() * scale.length)] + (night ? -12 : 0);
      const ti = t0 + i * (beat / 2);
      const o = c.createOscillator();
      o.type = 'sine';
      o.frequency.value = hz(n);
      const o2 = c.createOscillator();
      o2.type = 'sine';
      o2.frequency.value = hz(n) * 4; // brilho de marimba
      const g = c.createGain();
      this._env(g.gain, ti, 0.07, 0.005, 0.9);
      const g2 = c.createGain();
      this._env(g2.gain, ti, 0.015, 0.002, 0.15);
      o.connect(g).connect(this.musicBus);
      o2.connect(g2).connect(this.musicBus);
      o.start(ti);
      o2.start(ti);
      o.stop(ti + 1);
      o2.stop(ti + 0.2);
    }
    M.next = t0 + barLen;
    M.bar++;
  }

  _insect() {
    if (!this._voice(2)) return;
    const t = this.ctx.currentTime + 0.01;
    const out = this._ambOut(Math.random() * 1.4 - 0.7, 0.03);
    this._noise(t, 1.6, out, { f: 5500 + Math.random() * 2500, q: 8, peak: 0.5, attack: 0.4 });
  }

  _cricket() {
    if (!this._voice(0.3)) return;
    const t = this.ctx.currentTime + 0.01;
    const out = this._ambOut(Math.random() * 1.6 - 0.8, 0.035);
    const f = 4200 + Math.random() * 600;
    for (let i = 0; i < 3; i++) this._osc('sine', f, t + i * 0.045, 0.025, out, 0.5, 0.004);
  }

  _frog() {
    if (!this._voice(0.6)) return;
    const t = this.ctx.currentTime + 0.01;
    const out = this._ambOut(Math.random() * 1.6 - 0.8, 0.09);
    const f = 140 + Math.random() * 160;
    const n = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const o = this._osc('square', f, t + i * 0.18, 0.12, out, 0.25, 0.01, f * 0.75);
      void o;
    }
  }

  _owl() {
    if (!this._voice(1.4)) return;
    const t = this.ctx.currentTime + 0.01;
    const out = this._ambOut(Math.random() * 1.6 - 0.8, 0.1);
    this._osc('sine', 420, t, 0.35, out, 0.5, 0.06, 380);
    this._osc('sine', 400, t + 0.55, 0.5, out, 0.5, 0.06, 340);
  }

  _crackle(vol) {
    if (!this._voice(0.05)) return;
    const t = this.ctx.currentTime + 0.005;
    const g = this.ctx.createGain();
    g.gain.value = vol * 3;
    g.connect(this.out);
    this._noise(t, 0.015 + Math.random() * 0.02, g, { f: 2000 + Math.random() * 3000, q: 2, peak: 0.6, attack: 0.001 });
  }
}

export const sound = new Sound();
