// =============================================================
// ATMOSFERA (estilo Valheim) – partículas leves e clima:
//   - fumaça e fagulhas nas fogueiras acesas perto do jogador
//   - vaga-lumes à noite (mata e campo), poeira brilhando no sol de dia
//   - folhas caindo na mata
//   - CLIMA: de vez em quando chove (gotas, céu mais escuro, som de chuva)
//     ou cai uma neblina densa. Na neve não chove (lá já neva: snowfall.js).
// Cada efeito é UM objeto de pontos (1 desenho por efeito). A maioria vive numa
// caixa em volta da câmera e "dá a volta" (sem criar/apagar nada); a fumaça e as
// fagulhas são poucas partículas recicladas.
// >>> AJUSTES: QTD (quantidade por qualidade), CLIMA (chance e duração), cores da paleta.
// =============================================================
import * as THREE from 'three';
import { PALETA, mistura } from '../core/paleta.js';
import { BIOME } from './island_generator.js';

// quantidade de partículas: [baixa, média, alta]
const QTD = { chuva: [700, 1600, 2600], vagalume: [30, 60, 90], poeira: [40, 90, 140], folha: [20, 45, 70] };
// clima: a cada CLIMA.decide segundos de jogo sorteia o próximo tempo
const CLIMA = { decide: 150, chuva: 0.25, neblina: 0.18, dura: [90, 240] };

const glsl = (c) => `vec3(${c.r.toFixed(4)}, ${c.g.toFixed(4)}, ${c.b.toFixed(4)})`;

// Campo de pontos numa caixa em volta da câmera (posição calculada no shader).
// tipo: 'chuva' (risco vertical), 'vagalume' (pisca), 'poeira' (flutua), 'folha' (cai balançando)
function campo(tipo, count, box, cor, opts = {}) {
  const seed = new Float32Array(count * 3);
  const extra = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    seed[i * 3] = Math.random() * box.x;
    seed[i * 3 + 1] = Math.random() * box.y;
    seed[i * 3 + 2] = Math.random() * box.z;
    extra[i] = Math.random();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(seed, 3));
  geo.setAttribute('aR', new THREE.BufferAttribute(extra, 1));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
  const mov = {
    // y cai rápido e um pouco inclinado pelo vento
    chuva: 's.y -= uTime * 19.0; s.x += uTime * 2.2;',
    // vaga-lume: voa devagar em volta do ponto
    vagalume: 's += vec3(sin(uTime * 0.7 + aR * 30.0), sin(uTime * 0.9 + aR * 17.0) * 0.4, cos(uTime * 0.6 + aR * 23.0)) * 1.2;',
    poeira: 's += vec3(sin(uTime * 0.21 + aR * 40.0), uTime * 0.05 + sin(uTime * 0.3 + aR * 9.0) * 0.3, cos(uTime * 0.17 + aR * 31.0)) * 0.8;',
    folha: 's.y -= uTime * (0.7 + aR * 0.5); s.x += sin(uTime * 1.3 + aR * 20.0) * 0.9 + uTime * 0.6; s.z += cos(uTime * 1.1 + aR * 11.0) * 0.6;',
  }[tipo];
  const brilho = {
    chuva: 'vA = 0.55;',
    vagalume: 'vA = smoothstep(0.55, 0.95, sin(uTime * (1.5 + aR * 2.0) + aR * 40.0));',
    poeira: 'vA = 0.35 + 0.35 * sin(uTime * 1.7 + aR * 50.0);',
    folha: 'vA = 1.0;',
  }[tipo];
  const forma = {
    // risco fino vertical
    chuva: 'float a = (1.0 - smoothstep(0.0, 0.09, abs(pc.x - 0.5))) * (1.0 - smoothstep(0.35, 0.5, abs(pc.y - 0.5)));',
    vagalume: 'float a = pow(max(0.0, 1.0 - length(pc - 0.5) * 2.0), 1.8);',
    poeira: 'float a = pow(max(0.0, 1.0 - length(pc - 0.5) * 2.0), 2.2);',
    // losango (folhinha)
    folha: 'float a = step(abs(pc.x - 0.5) + abs(pc.y - 0.5) * 1.6, 0.5);',
  }[tipo];
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    fog: false,
    blending: opts.aditivo ? THREE.AdditiveBlending : THREE.NormalBlending,
    uniforms: {
      uCam: { value: new THREE.Vector3() },
      uTime: { value: 0 },
      uAlpha: { value: 0 },
      uBox: { value: box },
      uScale: { value: 600 },
      uTam: { value: opts.tam ?? 1 },
      uYoff: { value: opts.yoff ?? 0.5 },
    },
    vertexShader: `
      uniform vec3 uCam; uniform float uTime; uniform vec3 uBox; uniform float uScale; uniform float uTam; uniform float uYoff;
      attribute float aR;
      varying float vA; varying float vR;
      void main() {
        vec3 s = position;
        ${mov}
        // dá a volta dentro da caixa centrada na câmera
        vec3 o = uCam - uBox * vec3(0.5, uYoff, 0.5);
        vec3 p = o + mod(s - o, uBox);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        ${brilho}
        vR = aR;
        // some perto da borda da caixa (sem "parede" de partículas)
        vec3 d = abs(p - uCam) / (uBox * 0.5);
        vA *= 1.0 - smoothstep(0.75, 1.0, max(d.x, d.z));
        gl_PointSize = uTam * uScale / max(1.0, -mv.z);
      }`,
    fragmentShader: `
      uniform float uAlpha;
      varying float vA; varying float vR;
      void main() {
        vec2 pc = gl_PointCoord;
        ${forma}
        vec3 c = ${glsl(cor)};
        ${tipo === 'folha' ? `c = mix(${glsl(PALETA.musgo)}, ${glsl(PALETA.capimSeco)}, step(0.6, vR)); c = mix(c, ${glsl(PALETA.marrom)}, step(0.85, vR));` : ''}
        float al = a * vA * uAlpha;
        if (al < 0.01) discard;
        gl_FragColor = vec4(c, al);
      }`,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  pts.renderOrder = 3;
  pts.visible = false;
  return pts;
}

// Fumaça e fagulhas: poucas partículas recicladas (posição/vida na CPU)
class Fogo {
  constructor(scene) {
    this.N = 90;
    this.p = new Float32Array(this.N * 3);
    this.v = new Float32Array(this.N * 3);
    this.vida = new Float32Array(this.N);
    this.max = new Float32Array(this.N).fill(1);
    this.tipo = new Uint8Array(this.N); // 0 fumaça, 1 fagulha
    this.alpha = new Float32Array(this.N);
    this.tam = new Float32Array(this.N);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.p, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aA', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aT', new THREE.BufferAttribute(this.tam, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aK', new THREE.BufferAttribute(this.tipo, 1).setUsage(THREE.DynamicDrawUsage));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    this.geo = geo;
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uScale: { value: 600 } },
      vertexShader: `
        uniform float uScale; attribute float aA; attribute float aT; attribute float aK;
        varying float vA; varying float vK;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          vA = aA; vK = aK;
          gl_PointSize = aT * uScale / max(1.0, -mv.z);
        }`,
      fragmentShader: `
        varying float vA; varying float vK;
        void main() {
          float r = length(gl_PointCoord - 0.5) * 2.0;
          if (r > 1.0 || vA < 0.01) discard;
          vec3 fumaca = ${glsl(mistura('pedraClara', 'pedra', 0.4))};
          vec3 fagulha = ${glsl(mistura('solLaranja', 'neve', 0.35))} * 1.6;
          float a = vK > 0.5 ? (1.0 - r) * vA : (1.0 - r * r) * vA * 0.55;
          gl_FragColor = vec4(vK > 0.5 ? fagulha : fumaca, a);
        }`,
    });
    this.pts = new THREE.Points(geo, mat);
    this.pts.frustumCulled = false;
    this.pts.renderOrder = 3;
    scene.add(this.pts);
    this._i = 0;
  }

  emitir(x, y, z, tipo) {
    const i = this._i;
    this._i = (this._i + 1) % this.N;
    const r = Math.random;
    this.p[i * 3] = x + (r() - 0.5) * 0.3;
    this.p[i * 3 + 1] = y;
    this.p[i * 3 + 2] = z + (r() - 0.5) * 0.3;
    if (tipo === 1) {
      this.v[i * 3] = (r() - 0.5) * 0.8;
      this.v[i * 3 + 1] = 2.2 + r() * 2;
      this.v[i * 3 + 2] = (r() - 0.5) * 0.8;
      this.max[i] = 0.6 + r() * 0.8;
    } else {
      this.v[i * 3] = (r() - 0.5) * 0.25 + 0.25;
      this.v[i * 3 + 1] = 0.7 + r() * 0.4;
      this.v[i * 3 + 2] = (r() - 0.5) * 0.25;
      this.max[i] = 3.5 + r() * 2.5;
    }
    this.vida[i] = this.max[i];
    this.tipo[i] = tipo;
  }

  update(dt, fogos, vento) {
    // cada fogueira acesa perto solta fumaça e fagulhas
    for (const f of fogos) {
      f._fumT = (f._fumT ?? 0) - dt;
      f._fagT = (f._fagT ?? 0) - dt;
      if (f._fumT <= 0) {
        f._fumT = 0.22;
        this.emitir(f.position.x, f.position.y + 0.8, f.position.z, 0);
      }
      if (f._fagT <= 0) {
        f._fagT = 0.12 + Math.random() * 0.3;
        this.emitir(f.position.x, f.position.y + 0.4, f.position.z, 1);
      }
    }
    let vivos = 0;
    for (let i = 0; i < this.N; i++) {
      if (this.vida[i] <= 0) {
        this.alpha[i] = 0;
        continue;
      }
      vivos++;
      this.vida[i] -= dt;
      const k = Math.max(0, this.vida[i] / this.max[i]); // 1 -> 0
      this.p[i * 3] += (this.v[i * 3] + vento * (1 - k)) * dt;
      this.p[i * 3 + 1] += this.v[i * 3 + 1] * dt;
      this.p[i * 3 + 2] += this.v[i * 3 + 2] * dt;
      if (this.tipo[i] === 1) {
        this.v[i * 3 + 1] -= 1.5 * dt; // fagulha perde força
        this.alpha[i] = k * (0.6 + 0.4 * Math.sin(this.vida[i] * 40)); // tremeluz
        this.tam[i] = 0.05;
      } else {
        this.alpha[i] = Math.min(1, (1 - k) * 4) * k; // aparece e some devagar
        this.tam[i] = 0.35 + (1 - k) * 1.3; // cresce subindo
      }
    }
    this.pts.visible = vivos > 0;
    if (vivos > 0) {
      for (const n of ['position', 'aA', 'aT', 'aK']) this.geo.getAttribute(n).needsUpdate = true;
    }
  }
}

export class Atmosfera {
  constructor(scene) {
    this.scene = scene;
    this.q = 1; // qualidade 0 baixa, 1 média, 2 alta
    this._montar(1);
    this.fogo = new Fogo(scene);
    this.t = 0;
    // clima: chuva e neblina vão de 0 a 1 (suave); alvo muda de tempos em tempos
    this.clima = { chuva: 0, neblina: 0, alvoChuva: 0, alvoNeblina: 0, prox: CLIMA.decide * 0.6, fim: 0 };
    this._ceu = new THREE.Color();
    this._cinza = mistura('pedra', 'pedraClara', 0.3);
    this._branca = mistura('neve', 'pedraClara', 0.45);
  }

  _montar(q) {
    for (const k of ['chuva', 'vagalume', 'poeira', 'folha']) {
      if (this[k]) {
        this.scene.remove(this[k]);
        this[k].geometry.dispose();
        this[k].material.dispose();
      }
    }
    this.q = q;
    this.chuva = campo('chuva', QTD.chuva[q], new THREE.Vector3(40, 28, 40), mistura('pedraClara', 'neve', 0.4), { tam: 0.55, yoff: 0.35 });
    this.vagalume = campo('vagalume', QTD.vagalume[q], new THREE.Vector3(46, 5, 46), mistura('folhaClara', 'solLaranja', 0.45).multiplyScalar(3.0), { aditivo: true, tam: 0.22, yoff: 0.75 });
    this.poeira = campo('poeira', QTD.poeira[q], new THREE.Vector3(16, 8, 16), mistura('solLaranja', 'neve', 0.6), { aditivo: true, tam: 0.05, yoff: 0.5 });
    this.folha = campo('folha', QTD.folha[q], new THREE.Vector3(30, 18, 30), PALETA.musgo, { tam: 0.12, yoff: 0.3 });
    for (const k of ['chuva', 'vagalume', 'poeira', 'folha']) this.scene.add(this[k]);
  }

  /** qualidade: 'baixa' | 'media' | 'alta' */
  setQualidade(nome) {
    const q = nome === 'baixa' ? 0 : nome === 'alta' ? 2 : 1;
    if (q !== this.q) this._montar(q);
  }

  /** Força a chuva/neblina (testes e comandos). v = 0..1; dur em segundos de jogo. */
  forcar(tipo, v = 1, dur = 180) {
    const c = this.clima;
    c.alvoChuva = tipo === 'chuva' ? v : 0;
    c.alvoNeblina = tipo === 'neblina' ? v : 0;
    c.fim = this.t + dur;
    c.prox = this.t + dur + CLIMA.decide;
  }

  // world: sky, map, structures; camera; underwater: câmera embaixo d'água
  update(dt, world, camera, underwater) {
    this.t += dt;
    const sky = world.sky;
    const cp = camera.position;
    const c = this.clima;
    // ---- clima: sorteia de tempos em tempos ----
    if (this.t > c.fim && (c.alvoChuva > 0 || c.alvoNeblina > 0)) {
      c.alvoChuva = 0;
      c.alvoNeblina = 0;
    }
    if (this.t > c.prox) {
      c.prox = this.t + CLIMA.decide;
      const r = Math.random();
      const dur = CLIMA.dura[0] + Math.random() * (CLIMA.dura[1] - CLIMA.dura[0]);
      if (r < CLIMA.chuva) this.forcar('chuva', 0.6 + Math.random() * 0.4, dur);
      else if (r < CLIMA.chuva + CLIMA.neblina) this.forcar('neblina', 0.6 + Math.random() * 0.4, dur);
    }
    const frio = sky.cold ?? 0;
    const alvoChuva = c.alvoChuva * (1 - frio); // na neve não chove (já neva)
    c.chuva += (alvoChuva - c.chuva) * Math.min(1, dt * 0.15);
    c.neblina += (c.alvoNeblina - c.neblina) * Math.min(1, dt * 0.12);

    // ---- chuva: escurece o céu e a luz, fecha um pouco a névoa ----
    const ch = c.chuva;
    if (ch > 0.01) {
      sky.sun.intensity *= 1 - 0.55 * ch;
      sky.hemi.intensity *= 1 - 0.2 * ch;
      const u = sky.dome.material.uniforms;
      u.uZenith.value.lerp(this._cinza, 0.65 * ch);
      u.uHorizon.value.lerp(this._cinza, 0.5 * ch);
      u.uCloud.value *= 1 - 0.3 * ch;
      if (!sky.underwater) {
        sky.scene.fog.color.lerp(this._cinza, 0.5 * ch);
        sky.scene.background.copy(sky.scene.fog.color);
      }
    }
    // névoa: chuva fecha um pouco; neblina densa fecha bastante
    this.fatorNevoa = 1 + 0.7 * ch + 4.5 * c.neblina;
    // neblina densa: cor mais branca/cinza (ar úmido)
    if (c.neblina > 0.01 && !sky.underwater) {
      sky.scene.fog.color.lerp(this._branca, 0.55 * c.neblina);
      sky.scene.background.copy(sky.scene.fog.color);
      sky.dome.material.uniforms.uHorizon.value.lerp(this._branca, 0.6 * c.neblina);
    }

    const scale = window.innerHeight * 0.9;
    const viva = (o, a) => {
      o.visible = a > 0.01 && !underwater;
      if (!o.visible) return;
      o.material.uniforms.uCam.value.copy(cp);
      o.material.uniforms.uTime.value = this.t;
      o.material.uniforms.uAlpha.value = a;
      o.material.uniforms.uScale.value = scale;
    };
    const bioma = world.map.biomeAt(cp.x, cp.z);
    const mata = bioma === BIOME.JUNGLE || bioma === BIOME.IGAPO ? 1 : bioma === BIOME.PLAINS ? 0.35 : 0;
    const noite = sky.night ?? 0;
    const dia = sky.daylight ?? 1;
    viva(this.chuva, ch);
    viva(this.vagalume, Math.max(0, noite - 0.4) / 0.6 * (mata > 0 ? 1 : 0.25) * (1 - ch) * (1 - frio));
    viva(this.poeira, Math.max(0, dia - 0.6) / 0.4 * 0.8 * (1 - ch) * (1 - c.neblina));
    viva(this.folha, mata * (1 - frio) * (1 - 0.5 * ch));

    // ---- fogueiras acesas perto: fumaça e fagulhas ----
    const fogos = [];
    for (const s of world.structures) {
      if (s.lit && Math.hypot(s.position.x - cp.x, s.position.z - cp.z) < 60) fogos.push(s);
    }
    this.fogo.pts.material.uniforms.uScale.value = scale;
    this.fogo.update(dt, ch > 0.7 ? [] : fogos, 0.5 + ch * 1.5);
  }
}
