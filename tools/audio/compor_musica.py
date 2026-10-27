#!/usr/bin/env python3
"""Compõe a música do jogo (sintetizada aqui, sem amostras de terceiros).

Gera assets/sons/musica_dia.mp3 e musica_noite.mp3 (o jogo toca em loop e troca
conforme a hora). Tudo é soma de ondas + ruído filtrado + reverb por convolução
(FFT circular, então o loop não tem emenda).

Uso: python3 tools/audio/compor_musica.py [pasta_de_saida]
Precisa de numpy e ffmpeg.
"""
import subprocess
import sys
import wave

import numpy as np

SR = 44100
OUT = sys.argv[1] if len(sys.argv) > 1 else 'assets/sons'


def hz(n):
    return 440.0 * 2 ** ((n - 69) / 12)


class Faixa:
    def __init__(self, bpm, bars, seed):
        self.bpm = bpm
        self.beat = 60.0 / bpm
        self.n = int(round(bars * 4 * self.beat * SR))
        self.rng = np.random.default_rng(seed)
        self.L = np.zeros(self.n)
        self.R = np.zeros(self.n)
        self.wetL = np.zeros(self.n)
        self.wetR = np.zeros(self.n)

    # coloca um sinal (com volta ao início se passar do fim => loop sem emenda)
    def put(self, t, sig, pan=0.0, wet=0.3, gain=1.0):
        i = int(t * SR) % self.n
        gl = np.cos((pan + 1) * np.pi / 4) * gain
        gr = np.sin((pan + 1) * np.pi / 4) * gain
        m = len(sig)
        idx = (i + np.arange(m)) % self.n
        np.add.at(self.L, idx, sig * gl)
        np.add.at(self.R, idx, sig * gr)
        if wet > 0:
            np.add.at(self.wetL, idx, sig * gl * wet)
            np.add.at(self.wetR, idx, sig * gr * wet)

    def reverb(self, seconds=3.2, mix=1.0):
        n = self.n
        t = np.arange(int(seconds * SR)) / SR
        out = []
        for ch in range(2):
            ir = self.rng.standard_normal(len(t)) * np.exp(-t * 3.2 / seconds * 2.2)
            # escurece a cauda (média móvel crescente ~ low-pass)
            k = np.cumsum(ir)
            ir = ir * 0.4 + (k - np.roll(k, 400)) / 400 * 0.6
            ir /= np.sqrt(np.sum(ir ** 2)) + 1e-9
            pad = np.zeros(n)
            pad[:len(ir)] = ir[:n]
            out.append(pad)
        w = [self.wetL, self.wetR]
        res = []
        for ch in range(2):
            res.append(np.fft.irfft(np.fft.rfft(w[ch]) * np.fft.rfft(out[ch]), n))
        self.L += res[0] * mix
        self.R += res[1] * mix

    def salvar(self, nome, alvo=-16.0):
        st = np.stack([self.L, self.R], 1)
        # compressor/limitador leve e normaliza por RMS
        st = np.tanh(st * 1.3)
        rms = np.sqrt(np.mean(st ** 2)) + 1e-9
        st *= 10 ** (alvo / 20) / rms
        st = np.clip(st, -0.97, 0.97)
        wav = f'/tmp/{nome}.wav'
        with wave.open(wav, 'wb') as w:
            w.setnchannels(2)
            w.setsampwidth(2)
            w.setframerate(SR)
            w.writeframes((st * 32767).astype('<i2').tobytes())
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', wav, '-c:a', 'libmp3lame',
                        '-b:a', '80k', '-ar', '32000', f'{OUT}/{nome}.mp3'], check=True)


# ----------------------------------------------------------------- instrumentos
def env(n, a, d):
    t = np.arange(n) / SR
    return np.minimum(t / max(a, 1e-4), 1) * np.exp(-t / d)


def pad(f, dur, rng, brilho=6):
    """Pad suave: serra afinada (soma de harmônicos que decaem) com swell lento."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    s = np.zeros(n)
    for det in (-0.004, 0.0, 0.004):
        ff = f * (1 + det)
        ph = rng.random() * 6.28
        for h in range(1, brilho + 1):
            s += np.sin(2 * np.pi * ff * h * t + ph * h) / h ** 1.6
    a = np.minimum(t / (dur * 0.4), 1) * np.minimum((dur - t) / (dur * 0.35), 1)
    return s * np.clip(a, 0, 1) * 0.06


def pluck(f, dur=2.2, dec=0.7):
    """Kalimba/marimba: poucos modos inarmônicos com decaimento rápido."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    s = (np.sin(2 * np.pi * f * t) * np.exp(-t / dec)
         + 0.35 * np.sin(2 * np.pi * f * 3.97 * t) * np.exp(-t / (dec * 0.18))
         + 0.12 * np.sin(2 * np.pi * f * 9.2 * t) * np.exp(-t / (dec * 0.06)))
    s *= np.minimum(t / 0.002, 1)
    return s * 0.16


def flauta(f, dur, rng, vib=5.2):
    """Flauta de madeira: seno + harmônicos fracos + sopro, com vibrato tardio."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    v = np.sin(2 * np.pi * vib * t) * 0.006 * np.minimum(t / 0.5, 1)
    ph = 2 * np.pi * np.cumsum(f * (1 + v)) / SR
    s = np.sin(ph) + 0.28 * np.sin(2 * ph) + 0.1 * np.sin(3 * ph)
    sopro = rng.standard_normal(n)
    # sopro filtrado em torno de 2*f (média móvel diferença)
    k = int(SR / (f * 2))
    c = np.cumsum(sopro)
    sopro = (c - np.roll(c, max(k, 2))) / max(k, 2) ** 0.5
    s = s + sopro * 0.05
    a = np.minimum(t / 0.09, 1) * np.minimum((dur - t) / 0.25, 1)
    return s * np.clip(a, 0, 1) * 0.15


def tambor(f0=95, dur=0.7, dec=0.18):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = f0 * (1 + 1.6 * np.exp(-t / 0.035))
    ph = 2 * np.pi * np.cumsum(f) / SR
    s = np.sin(ph) * np.exp(-t / dec)
    s += 0.25 * np.sin(2 * np.pi * f0 * 2.3 * t) * np.exp(-t / 0.05)
    s *= np.minimum(t / 0.001, 1)
    return s * 0.7


def chocalho(rng, dur=0.12):
    n = int(dur * SR)
    t = np.arange(n) / SR
    r = rng.standard_normal(n)
    r = np.convolve(r, np.ones(5) / 5, 'same')           # corta o chiado agudo
    r = r - np.convolve(r, np.ones(40) / 40, 'same')     # tira o grave: sobra a faixa do chocalho
    return r * np.exp(-t / 0.025) * np.minimum(t / 0.004, 1) * 0.35


def sino(f, dur=4.0, dec=1.4):
    n = int(dur * SR)
    t = np.arange(n) / SR
    s = np.zeros(n)
    for r, a in ((1, 1), (2.76, 0.5), (5.4, 0.25), (8.93, 0.1)):
        s += a * np.sin(2 * np.pi * f * r * t) * np.exp(-t / (dec / r ** 0.35))
    return s * np.minimum(t / 0.003, 1) * 0.07


# ----------------------------------------------------------------- composição
def dia():
    f = Faixa(bpm=88, bars=32, seed=7)
    B = f.beat
    bar = 4 * B
    # Lá menor / Fá / Dó / Sol, 8 compassos cada ciclo de 4 (repete)
    prog = [(57, [57, 60, 64, 67]), (53, [53, 57, 60, 64]), (48, [55, 60, 64, 67]), (55, [55, 59, 62, 66])]
    escala = [57, 60, 62, 64, 67, 69, 72, 74, 76]
    for b in range(32):
        raiz, acorde = prog[b % 4]
        t0 = b * bar
        # pads e baixo (sempre)
        for nota in acorde:
            f.put(t0 - 0.2, pad(hz(nota - 12), bar + 1.2, f.rng), pan=f.rng.uniform(-.6, .6), wet=0.5)
        f.put(t0, pluck(hz(raiz - 24), 3.0, 1.2) * 1.8, pan=0, wet=0.1)
        # arpejo de kalimba a partir do compasso 4
        if b >= 4:
            ordem = [0, 1, 2, 3, 2, 1, 2, 3]
            for i, k in enumerate(ordem):
                if f.rng.random() < 0.18:
                    continue
                nota = acorde[k] + (12 if k > 1 else 0)
                f.put(t0 + i * B / 2, pluck(hz(nota)), pan=-0.4 + 0.1 * k, wet=0.4, gain=0.8 if i % 2 else 1.0)
        # percussão: coração tribal a partir do compasso 8
        if b >= 8:
            for q in (0, 2.5):
                f.put(t0 + q * B, tambor(88), pan=-0.1, wet=0.2, gain=0.9)
            f.put(t0 + 1.75 * B, tambor(120, 0.4, 0.1), pan=0.15, wet=0.2, gain=0.5)
            f.put(t0 + 3.5 * B, tambor(105, 0.45, 0.12), pan=0.1, wet=0.2, gain=0.55)
        if b >= 12:
            for i in range(8):
                if i % 2 == 0 and b % 2 == 0:
                    continue
                f.put(t0 + i * B / 2 + (0.012 if i % 2 else 0), chocalho(f.rng), pan=0.5, wet=0.15,
                      gain=0.55 if i % 2 else 0.3)
        # flauta: frases esparsas em 12-24 e 28-31
        if 12 <= b < 24 or b >= 28:
            if b % 2 == 0:
                pos = f.rng.integers(0, 5)
                t = t0
                for _ in range(f.rng.integers(3, 6)):
                    nota = escala[int(np.clip(pos, 0, len(escala) - 1))]
                    dur = B * f.rng.choice([1, 1.5, 2])
                    f.put(t, flauta(hz(nota + 12), dur + 0.3, f.rng), pan=0.25, wet=0.65)
                    t += dur
                    pos += f.rng.choice([-2, -1, 1, 2])
        # sino raro
        if b % 8 == 3:
            f.put(t0 + 1.5 * B, sino(hz(81)), pan=-0.6, wet=0.8)
    f.reverb(3.4, 1.0)
    return f


def noite():
    f = Faixa(bpm=64, bars=24, seed=21)
    B = f.beat
    bar = 4 * B
    prog = [(45, [45, 52, 57, 60]), (50, [50, 53, 57, 62]), (52, [52, 55, 59, 64]), (45, [45, 52, 57, 60])]
    escala = [57, 60, 62, 64, 67, 69]
    # drone grave contínuo
    for nota in (33, 45):
        f.put(0, pad(hz(nota), f.n / SR - 0.1, f.rng, 4), pan=0, wet=0.4, gain=1.4)
    for b in range(24):
        raiz, acorde = prog[b % 4]
        t0 = b * bar
        for nota in acorde:
            f.put(t0 - 0.3, pad(hz(nota), bar + 1.5, f.rng, 4), pan=f.rng.uniform(-.7, .7), wet=0.7)
        # notas soltas de kalimba, bem espaçadas
        for i in range(8):
            if f.rng.random() < 0.7:
                continue
            nota = escala[f.rng.integers(0, len(escala))]
            f.put(t0 + i * B / 2, pluck(hz(nota), 3.0, 1.1), pan=f.rng.uniform(-.7, .7), wet=0.8, gain=0.8)
        # batimento grave distante
        if b >= 4 and b % 2 == 0:
            f.put(t0, tambor(70, 0.9, 0.3), pan=0, wet=0.6, gain=0.7)
            f.put(t0 + 0.75 * B, tambor(70, 0.9, 0.3), pan=0, wet=0.6, gain=0.4)
        if b % 6 == 2:
            f.put(t0 + B, sino(hz(76), 5.0, 2.0), pan=f.rng.uniform(-.7, .7), wet=0.9)
        if b in (8, 9, 16, 17):
            nota = escala[f.rng.integers(2, 5)]
            f.put(t0 + B, flauta(hz(nota), 3.2, f.rng, 4.6), pan=0.3, wet=0.85)
    f.reverb(4.5, 1.1)
    return f


if __name__ == '__main__':
    dia().salvar('musica_dia')
    noite().salvar('musica_noite')
    print('ok')
