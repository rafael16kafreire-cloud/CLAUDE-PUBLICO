// =============================================================
// SONS – gerados por código (Web Audio). Leve para o celular.
// - Eco de floresta (reverberação) em tudo: o som não fica "seco".
// - Vozes (bichos e jogador) com filtros de vogal (formantes) e um
//   pouco de distorção: soam como garganta, não como apito.
// - Golpes em madeira/pedra ressoam como o material (ressonadores).
// - Sons gravados (opcional): ponha arquivos em assets/sons/ com o
//   nome do som (ex.: passo_mato.mp3, madeira.ogg, bicho_trex.mp3,
//   bicho_trex_ataque.mp3; variações: madeira_1.mp3, madeira_2.mp3).
//   Se existir, o jogo toca o arquivo no lugar do som gerado.
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
import SONS_GRAVADOS from 'virtual:sons';

const MAX_VOICES = 32;

// Vogais (formantes em Hz) para vozes de bicho e de gente.
const VOWELS = {
  a: [[730, 7], [1090, 9], [2440, 11]],
  o: [[570, 7], [840, 9], [2410, 12]],
  u: [[300, 7], [870, 9], [2240, 12]],
  e: [[530, 7], [1840, 10], [2480, 12]],
  h: [[900, 2], [1800, 3], [3000, 4]], // sopro
};

// Voz de cada espécie: tipo, tom base (Hz) e duração base (s).
const VOICES = {
  dodo: { kind: 'ave', f: 520, d: 0.35 },
  compsognato: { kind: 'pio', f: 1300, d: 0.25 },
  galimimo: { kind: 'ave', f: 420, d: 0.5 },
  parassauro: { kind: 'buzina', f: 95, d: 1.6 },
  paquicefalossauro: { kind: 'mugido', f: 140, d: 0.9 },
  triceratops: { kind: 'mugido', f: 70, d: 1.2 },
  estegossauro: { kind: 'mugido', f: 80, d: 1.1 },
  anquilossauro: { kind: 'mugido', f: 75, d: 1.0 },
  braquiossauro: { kind: 'buzina', f: 45, d: 2.4 },
  dilofossauro: { kind: 'chiado', f: 420, d: 0.7 },
  raptor: { kind: 'grito', f: 360, d: 0.6 },
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
        // eco de floresta (reverberação gerada aqui)
        this.verb = c.createConvolver();
        this.verb.buffer = this._makeIR(2.6, 3.2);
        this.verbIn = c.createGain();
        this.verbIn.gain.value = 0.32;
        this.verbIn.connect(this.verb).connect(this.lowpass);
        const ambSend = c.createGain();
        ambSend.gain.value = 0.35;
        this.ambBus.connect(ambSend).connect(this.verbIn);
        this._loadSamples();
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

  // Resposta de sala "floresta": cauda longa, densa e escura, estéreo.
  _makeIR(seconds, decay) {
    const c = this.ctx;
    const len = Math.floor(c.sampleRate * seconds);
    const buf = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < len; i++) {
        const t = i / len;
        lp += (Math.random() * 2 - 1 - lp) * (0.35 - 0.25 * t); // escurece com o tempo
        d[i] = lp * Math.pow(1 - t, decay) * (i < c.sampleRate * 0.012 ? i / (c.sampleRate * 0.012) : 1);
      }
      // reflexões iniciais (troncos perto)
      for (const ms of [17, 29, 41, 63, 87]) d[Math.floor((ms + ch * 3) * c.sampleRate / 1000)] += 0.5 * (1 - ms / 120);
    }
    return buf;
  }

  // Curva de distorção suave (rosnado/garganta).
  _shaper(amount) {
    const c = this.ctx;
    const ws = c.createWaveShaper();
    const n = 1024;
    const curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1;
      curve[i] = Math.tanh(x * amount) / Math.tanh(amount);
    }
    ws.curve = curve;
    ws.oversample = '2x';
    return ws;
  }

  // Sons gravados (assets/sons): decodifica em segundo plano.
  _loadSamples() {
    this.samples = {};
    for (const [name, list] of Object.entries(SONS_GRAVADOS)) {
      for (const uri of list) {
        const bin = atob(uri.split(',')[1]);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        this.ctx.decodeAudioData(bytes.buffer).then((buf) => {
          (this.samples[name] ??= []).push(buf);
        }).catch(() => {});
      }
    }
  }

  // Toca um som gravado, se existir. Devolve true se tocou.
  _sample(name, pos, gain = 1, ref = 4, max = 80) {
    const list = this.samples?.[name];
    if (!list?.length) return false;
    const out = this._dest(pos, gain, ref, max);
    if (!out) return true;
    const src = this.ctx.createBufferSource();
    src.buffer = list[Math.floor(Math.random() * list.length)];
    src.playbackRate.value = 0.94 + Math.random() * 0.12; // nunca igual
    src.connect(out);
    src.start();
    return true;
  }

  // Voz com garganta: fonte (serra com tremor + sopro) -> distorção ->
  // filtros de vogal. contour = [[tempo 0..1, multiplicador do tom]].
  _throat(t, d, out, { f, vowel = 'a', shift = 1, contour = [[0, 1], [1, 0.8]], grit = 2, breath = 0.3, trem = 0, peak = 0.8, attack = 0.08, sub = 0 }) {
    const c = this.ctx;
    const src = c.createOscillator();
    src.type = 'sawtooth';
    for (const [k, m] of contour) {
      if (k === 0) src.frequency.setValueAtTime(f * m, t);
      else src.frequency.exponentialRampToValueAtTime(Math.max(20, f * m), t + d * k);
    }
    // tremor irregular (voz de bicho não é afinada)
    const j = c.createOscillator();
    j.type = 'triangle';
    j.frequency.value = 6 + Math.random() * 7;
    const jg = c.createGain();
    jg.gain.value = f * 0.05;
    j.connect(jg).connect(src.frequency);
    const mix = c.createGain();
    mix.gain.value = 1;
    src.connect(mix);
    if (breath > 0) {
      const n = c.createBufferSource();
      n.buffer = this.noise;
      n.loop = true;
      const ng = c.createGain();
      ng.gain.value = breath;
      n.connect(ng).connect(mix);
      n.start(t, Math.random());
      n.stop(t + d + 0.2);
    }
    const sh = this._shaper(grit);
    mix.connect(sh);
    const g = c.createGain();
    this._env(g.gain, t, peak, attack, d);
    if (trem > 0) {
      // rosnado: vibração rápida no volume
      const am = c.createOscillator();
      am.frequency.value = trem;
      const ag = c.createGain();
      ag.gain.value = peak * 0.45;
      am.connect(ag).connect(g.gain);
      am.start(t);
      am.stop(t + d + 0.2);
    }
    for (const [ff, q] of VOWELS[vowel]) {
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = ff * shift;
      bp.Q.value = q * 0.6;
      sh.connect(bp).connect(g);
    }
    g.connect(out);
    src.start(t);
    j.start(t);
    src.stop(t + d + 0.2);
    j.stop(t + d + 0.2);
    if (sub > 0) this._osc('sine', f * 0.5, t, d, out, sub, attack, f * 0.38); // peito (grave)
  }

  // Golpe que ressoa como o material: impulso -> ressonadores.
  _modal(t, out, modes, peak = 0.6) {
    const c = this.ctx;
    const n = c.createBufferSource();
    n.buffer = this.noise;
    const g = c.createGain();
    this._env(g.gain, t, peak, 0.001, 0.012);
    n.connect(g);
    for (const [f, q, a] of modes) {
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = f * (0.96 + Math.random() * 0.08);
      bp.Q.value = q;
      const mg = c.createGain();
      mg.gain.value = a * Math.sqrt(q) * 0.9; // filtro estreito perde volume: compensa
      g.connect(bp).connect(mg).connect(out);
    }
    n.start(t, Math.random());
    n.stop(t + 0.05);
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
    const send = c.createGain();
    if (!pos) {
      g.connect(this.out);
      send.gain.value = 0.12;
      g.connect(send).connect(this.verbIn);
      return g;
    }
    const d = pos.distanceTo(this._listenerPos);
    if (d > max) return null;
    // mais longe = mais eco (soa distante de verdade)
    send.gain.value = 0.18 + 0.6 * Math.min(1, d / 40);
    g.connect(send).connect(this.verbIn);
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
    // som gravado (assets/sons) no lugar do gerado
    const sampleName = name === 'passo' ? `passo_${opts.surface ?? 'mato'}` : name;
    if (this._sample(sampleName, pos, 0.7 * v) || (name === 'passo' && this._sample('passo', pos, 0.6 * v))) return;
    switch (name) {
      case 'passo': {
        if (!this._voice(0.3)) return;
        const out = this._dest(pos, 0.6 * v);
        const surf = opts.surface ?? 'mato';
        // calcanhar (batida grave) + ponta do pé, e o som do chão
        this._noise(t, 0.06, out, { f: R(180, 260), q: 0.8, peak: 1.3, brown: true, type: 'lowpass' });
        if (surf === 'agua') {
          this._noise(t, 0.22, out, { f: R(900, 1400), fTo: 350, q: 0.9, peak: 0.5 });
          for (let i = 0; i < 3; i++) this._osc('sine', R(500, 1100), t + 0.05 + i * R(0.03, 0.06), 0.04, out, 0.12, 0.003, R(1200, 1800)); // bolhas
        } else if (surf === 'areia') {
          this._noise(t + 0.02, 0.12, out, { f: R(2200, 3200), q: 0.5, peak: 0.28, attack: 0.02 });
        } else if (surf === 'neve') {
          // neve: "cranch" de grãos
          for (let i = 0; i < 6; i++) this._noise(t + i * R(0.012, 0.022), 0.02, out, { f: R(1800, 4200), q: 2, peak: 0.25, attack: 0.002 });
        } else {
          // mata: folhas secas e gravetos estalando
          this._noise(t + 0.03, 0.06, out, { f: R(700, 1000), q: 0.6, peak: 0.7, brown: true, type: 'lowpass' });
          for (let i = 0; i < 4; i++) this._noise(t + 0.02 + i * R(0.015, 0.035), 0.025, out, { f: R(3000, 6500), q: 1.2, peak: 0.3, attack: 0.002 });
          if (Math.random() < 0.15) this._modal(t + 0.04, out, [[R(1800, 2600), 18, 0.5]], 0.2); // graveto
        }
        break;
      }
      case 'esforco': { // "huss": expiração forte de quem bate (voz humana)
        if (!this._voice(0.2)) return;
        const out = this._dest(null, 0.32 * v);
        // "hhuh": sopro forte com um pouco de voz no fim
        this._throat(t, R(0.16, 0.22), out, { f: R(110, 140), vowel: 'h', contour: [[0, 1.1], [1, 0.8]], grit: 1.5, breath: 1.6, peak: 0.45, attack: 0.015 });
        this._throat(t + 0.03, 0.1, out, { f: R(115, 135), vowel: 'u', contour: [[0, 1], [1, 0.85]], grit: 1.2, breath: 0.4, peak: 0.12, attack: 0.02 });
        break;
      }
      case 'golpe': { // golpe no ar
        if (!this._voice(0.25)) return;
        this._noise(t, 0.2, this._dest(null, 0.25 * v), { f: 400, fTo: 1800, q: 2, attack: 0.03, peak: 0.6 });
        break;
      }
      case 'madeira': {
        if (!this._voice(0.35)) return;
        const out = this._dest(pos, 0.8 * v);
        // "toc" oco de tronco: modos de madeira + lasca + folhas
        this._modal(t, out, [[R(140, 190), 9, 1], [R(380, 460), 12, 0.6], [R(780, 900), 14, 0.35], [R(1500, 1900), 10, 0.2]], 0.9);
        this._noise(t, 0.04, out, { f: 2600, q: 1.2, peak: 0.35 });
        this._noise(t + 0.03, 0.4, out, { f: 5200, q: 0.5, peak: 0.05, attack: 0.05 }); // folhas balançando
        break;
      }
      case 'pedra': {
        if (!this._voice(0.3)) return;
        const out = this._dest(pos, 0.7 * v);
        // pedra: estalo seco com modos agudos e desarmônicos + cascalho
        this._modal(t, out, [[R(1100, 1400), 25, 0.7], [R(2700, 3300), 30, 0.45], [R(4300, 5200), 30, 0.3]], 0.9);
        this._noise(t + 0.02, 0.15, out, { f: 1400, q: 0.7, peak: 0.12, brown: true, type: 'lowpass' });
        for (let i = 0; i < 3; i++) this._noise(t + 0.05 + i * R(0.02, 0.05), 0.02, out, { f: R(3000, 6000), q: 2, peak: 0.1 }); // pedrinhas caindo
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
        // golpe na carne: baque surdo + "chap" molhado
        this._osc('sine', R(70, 95), t, 0.14, out, 0.7, 0.002, 45);
        this._noise(t, 0.09, out, { f: R(700, 1000), q: 1.5, peak: 0.45 });
        this._noise(t + 0.03, 0.12, out, { f: 2400, fTo: 900, q: 1, peak: 0.12 });
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
        // "ugh!" (voz de quem se machuca) + baque
        this._throat(t, R(0.18, 0.26), out, { f: R(140, 175), vowel: Math.random() < 0.5 ? 'a' : 'u', contour: [[0, 1.25], [0.3, 1], [1, 0.75]], grit: 2.5, breath: 0.5, peak: 0.6, attack: 0.01 });
        this._osc('sine', 90, t, 0.12, out, 0.4, 0.002, 50);
        break;
      }
      case 'morte': {
        if (!this._voice(1.6)) return;
        const out = this._dest(null, 0.5 * v);
        // gemido longo que cai + último suspiro
        this._throat(t, 1.1, out, { f: 150, vowel: 'a', contour: [[0, 1.15], [0.4, 1], [1, 0.6]], grit: 2, breath: 0.6, peak: 0.5, attack: 0.05 });
        this._throat(t + 1.2, 0.6, out, { f: 120, vowel: 'h', contour: [[0, 1], [1, 0.8]], grit: 1, breath: 1.5, peak: 0.25, attack: 0.1 });
        this._osc('sine', 60, t + 0.9, 0.5, out, 0.35, 0.01, 35); // corpo caindo
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
      case 'pisada': { // passo de gigante: baque grave
        if (!this._voice(0.5)) return;
        const out = this._dest(pos, 0.9 * v, 8, 160);
        this._osc('sine', 48, t, 0.35, out, 0.9, 0.004, 30);
        this._noise(t, 0.25, out, { f: 220, q: 0.6, peak: 0.35, brown: true, type: 'lowpass' });
        break;
      }
      case 'tiro': { // estampido da pistola: estalo forte + eco grave
        if (!this._voice(0.5)) return;
        const out = this._dest(pos, 0.9 * v);
        this._noise(t, 0.05, out, { f: 2400, q: 0.5, peak: 1, attack: 0.001 });
        this._noise(t + 0.01, 0.45, out, { f: 500, fTo: 120, q: 0.7, peak: 0.45, brown: true, type: 'lowpass' });
        this._osc('sine', 90, t, 0.18, out, 0.5, 0.002, 40);
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
    // som gravado (assets/sons): bicho_<espécie>_<tipo> ou bicho_<espécie>
    const sg = kind === 'chamado' ? 0.5 : 0.85;
    if (this._sample(`bicho_${c.species.id}_${kind}`, pos, sg, ref, max) || this._sample(`bicho_${c.species.id}`, pos, sg, ref, max)) return;
    const out = this._dest(pos, (kind === 'chamado' ? 0.45 : 0.75), ref, max);
    if (!out) return;
    if (kind === 'ataque' && v.kind !== 'ave' && v.kind !== 'pio') {
      // estalo de mandíbula
      this._noise(t + d * 0.6, 0.05, out, { f: 1800, q: 1, peak: 0.5 });
    }
    switch (v.kind) {
      case 'rugido':
      case 'rosnado': {
        // garganta grande: vogal "a/o" bem grave (formantes descem com o
        // tamanho), distorção forte, peito e um sopro áspero
        const shift = Math.max(0.28, 0.75 / Math.sqrt(big) * (v.f < 70 ? 0.55 : v.f < 100 ? 0.7 : 1));
        const rough = v.kind === 'rosnado';
        this._throat(t, d, out, {
          f, vowel: rough ? 'o' : 'a', shift,
          contour: kind === 'ataque' ? [[0, 1.3], [1, 0.9]] : [[0, 0.9], [0.25, 1.15], [0.7, 1], [1, 0.65]],
          grit: rough ? 6 : 4.5, breath: rough ? 0.9 : 0.6, trem: rough ? R(22, 32) : R(8, 13), peak: 0.85, attack: d * 0.12, sub: 0.5,
        });
        this._noise(t, d * 0.9, out, { f: f * 7, q: 0.9, peak: 0.25, attack: d * 0.2, brown: true });
        break;
      }
      case 'mugido':
      case 'buzina': {
        // mugido: vogal "u-o" que abre; buzina (crista de parassauro,
        // tromba do mamute): tubo longo, som mais limpo e cheio
        const horn = v.kind === 'buzina';
        this._throat(t, d, out, {
          f, vowel: horn ? 'o' : 'u', shift: Math.max(0.35, (horn ? 0.9 : 0.7) / Math.sqrt(big)),
          contour: [[0, 0.95], [0.35, 1.12], [1, 0.88]], grit: horn ? 1.6 : 2.5, breath: horn ? 0.15 : 0.35, trem: horn ? 0 : R(5, 8),
          peak: 0.75, attack: d * 0.22, sub: horn ? 0.25 : 0.4,
        });
        if (horn) this._osc('sine', f * 2, t, d, out, 0.12, d * 0.3); // harmônico do tubo
        break;
      }
      case 'grito': {
        // grito agudo e rasgado (raptor, pterossauros, aves grandes)
        this._throat(t, d, out, { f: f * 1.4, vowel: 'e', shift: 1.4, contour: [[0, 1.2], [0.2, 1.35], [1, 0.75]], grit: 5, breath: 0.5, trem: R(18, 26), peak: 0.6, attack: 0.02 });
        this._noise(t, d * 0.6, out, { f: f * 5, q: 2, peak: 0.12 });
        break;
      }
      case 'chiado': {
        // sibilo de cobra/lagarto: "sss" que pulsa + garganta grave por baixo
        this._noise(t, d, out, { f: R(4500, 6500), q: 1.2, peak: 0.5, attack: d * 0.15 });
        this._noise(t, d, out, { f: f * 6, q: 0.7, peak: 0.25, attack: d * 0.2, type: 'highpass' });
        if (big > 1) this._throat(t, d * 0.8, out, { f: f * 0.4, vowel: 'h', shift: 0.6, contour: [[0, 1], [1, 0.9]], grit: 3, breath: 1, trem: 18, peak: 0.25, attack: d * 0.2 });
        break;
      }
      case 'ave':
      case 'pio':
      case 'assobio': {
        const n = v.kind === 'ave' ? 2 : v.kind === 'pio' ? 3 : 1;
        for (let i = 0; i < n; i++) this._osc('sine', f * R(0.95, 1.2), t + i * d * 0.45, d * 0.35, out, 0.4, 0.01, f * R(0.6, 1.5));
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
    // música gravada (assets/sons/musica_dia.mp3 e musica_noite.mp3): toca em loop
    // e troca com um fade quando vira dia/noite. Sem os arquivos, usa a de baixo.
    const faixa = this.samples?.[night ? 'musica_noite' : 'musica_dia']?.[0];
    if (faixa) {
      this._tocarFaixa(night, faixa);
      return;
    }
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

  _tocarFaixa(night, buf) {
    const c = this.ctx;
    const cur = this._faixa;
    if (cur && cur.night === night) return;
    const FADE = 5;
    if (cur) {
      cur.g.gain.cancelScheduledValues(c.currentTime);
      cur.g.gain.setTargetAtTime(0.0001, c.currentTime, FADE / 3);
      try { cur.src.stop(c.currentTime + FADE * 1.5); } catch { /* já parou */ }
    }
    const src = c.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, c.currentTime);
    g.gain.linearRampToValueAtTime(1, c.currentTime + (cur ? FADE : 2));
    src.connect(g).connect(this.musicBus);
    src.start();
    this._faixa = { night, src, g };
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
