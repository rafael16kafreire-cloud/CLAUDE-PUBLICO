// =============================================================
// ANIMAÇÕES DO PRÓPRIO MODELO (clipes)
// Alguns bichos vieram com animação feita pelo autor (andar, voar,
// rugir, dar o bote...). O conversor (tools/models/bichos_animados.sh)
// guarda o giro de cada osso em cada quadro; aqui o jogo toca esses
// quadros nos ossos, misturando com a animação feita por código.
//
// Papéis de clipe que o jogo usa:
//   andar  – no chão andando/correndo (velocidade pelo tamanho do passo)
//   parado – parado em pé
//   voar   – voando
//   rugido – uma vez, quando começa a caçar
//   ataque – uma vez, a cada golpe
// =============================================================
import * as THREE from 'three';

const ONCE = new Set(['rugido', 'ataque']);
const FADE = 4; // velocidade da mistura (1/s)

function bytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// Dados do arquivo (base64) -> arrays prontos (uma vez por espécie).
export function parseClips(raw) {
  if (!raw) return null;
  const out = {};
  for (const [role, c] of Object.entries(raw)) {
    const giro = {};
    for (const [b, s] of Object.entries(c.giro)) {
      const u8 = bytes(s);
      const q = new Int16Array(u8.buffer, u8.byteOffset, u8.byteLength / 2);
      giro[b] = Float32Array.from(q, (v) => v / 32767);
    }
    const pos = {};
    for (const [b, s] of Object.entries(c.pos)) {
      const u8 = bytes(s);
      pos[b] = new Float32Array(u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength));
    }
    out[role] = {
      fps: c.fps, frames: c.quadros, loop: c.loop !== false && !ONCE.has(role),
      duration: c.quadros / c.fps, stride: c.passo, cycles: c.ciclos ?? 1, giro, pos,
    };
  }
  return out;
}

const qa = new THREE.Quaternion();
const qb = new THREE.Quaternion();
const va = new THREE.Vector3();
const vb = new THREE.Vector3();

// Põe o quadro do tempo t (segundos) nos ossos, com peso w (0..1).
function apply(clip, t, bones, w) {
  let f = t * clip.fps;
  const n = clip.frames;
  let i0;
  let i1;
  if (clip.loop) {
    f = ((f % n) + n) % n;
    i0 = Math.floor(f);
    i1 = (i0 + 1) % n;
  } else {
    f = Math.min(Math.max(f, 0), n - 1);
    i0 = Math.floor(f);
    i1 = Math.min(n - 1, i0 + 1);
  }
  const a = f - i0;
  for (const name in clip.giro) {
    const b = bones[name];
    if (!b) continue;
    const q = clip.giro[name];
    qa.fromArray(q, i0 * 4);
    qb.fromArray(q, i1 * 4);
    qa.slerp(qb, a);
    if (w >= 0.999) b.quaternion.copy(qa);
    else b.quaternion.slerp(qa, w);
  }
  for (const name in clip.pos) {
    const b = bones[name];
    if (!b) continue;
    const p = clip.pos[name];
    va.fromArray(p, i0 * 3);
    vb.fromArray(p, i1 * 3);
    va.lerp(vb, a);
    b.position.lerp(va, w);
  }
}

// Um tocador por bicho: escolhe o clipe pelo que o bicho está fazendo e
// faz a troca suave entre clipe e animação por código.
export class ClipPlayer {
  constructor(clips, bones) {
    this.clips = clips;
    this.bones = bones;
    this.loose = Object.values(bones).filter((b) => /^o\d+$/.test(b.name));
    this.role = null; // clipe contínuo pedido
    this.t = 0;
    this.cur = null; // clipe que está nos ossos
    this.curT = 0;
    this.w = 0;
    this.once = null; // clipe de uma vez tocando (rugido/ataque)
    this.onceT = 0;
  }

  has(role) {
    return !!this.clips[role];
  }

  // Toca um clipe de uma vez (se o bicho tiver).
  play(role) {
    if (!this.clips[role]) return;
    this.once = role;
    this.onceT = 0;
  }

  // want = papel de clipe contínuo que serve agora (ou null);
  // rate = quantos segundos de clipe por segundo de jogo.
  // Devolve true se o clipe está mexendo nos ossos.
  update(dt, want, rate = 1) {
    if (this.once) {
      this.onceT += dt;
      if (this.onceT >= this.clips[this.once].duration) this.once = null;
    }
    const cont = want && this.clips[want] ? want : null;
    if (cont !== this.role) {
      this.role = cont;
      this.t = 0;
    }
    if (cont) this.t += dt * (this.clips[cont].loop ? rate : 1);
    if (this.once) {
      this.cur = this.once;
      this.curT = this.onceT;
    } else if (cont) {
      this.cur = cont;
      this.curT = this.t;
    } // senão: fica no último quadro enquanto some
    const on = !!(this.once || cont);
    this.w += ((on ? 1 : 0) - this.w) * Math.min(1, dt * FADE);
    if (!on && this.w < 0.02) this.w = 0;
    return this.w > 0;
  }

  // Antes da animação por código: ossos sem nome voltam ao descanso
  // (senão ficam presos no último quadro do clipe).
  reset() {
    for (const b of this.loose) {
      b.quaternion.identity();
      b.position.copy(b.userData.rest);
    }
  }

  // Depois da animação por código: mistura o clipe por cima.
  apply() {
    if (this.w <= 0 || !this.cur) return;
    apply(this.clips[this.cur], this.curT, this.bones, Math.min(1, this.w));
  }
}
