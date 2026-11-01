// =============================================================
// CÉU, SOL, LUZ E NEBLINA
// - Céu: cúpula com degradê, nuvens e brilho do sol (materials.js).
// - Sol: luz direcional; a sombra cobre só a área perto do jogador.
// - Neblina úmida da floresta: vai escondendo o que está longe
//   (fica realista e o celular desenha menos).
// - Dia e noite: setTime(t) com t de 0 a 1 (0,25 = nascer do sol,
//   0,5 = meio-dia, 0,75 = pôr do sol). À noite a lua ilumina azulado.
// =============================================================
import * as THREE from 'three';
import { makeSkyMaterial, sharedDay } from './materials.js';
import { PALETA, mistura } from '../core/paleta.js';

// =============================================================
// >>> AJUSTE DE LUZ E CÉU (estilo low-poly / Valheim) <<<
// Todas as cores daqui saem da paleta (core/paleta.js), misturadas.
// - HORIZONTE/ZÊNITE: degradê do céu (o horizonte também é a cor da névoa).
// - Sol: baixo (no máximo ~35° no meio-dia) e dourado -> sombras compridas.
// - Luz ambiente (hemisfério): FRIA (azul-acinzentada) para contrastar com o sol quente.
// - Névoa exponencial: perto limpa, longe esconde o horizonte e o fim da visão.
// =============================================================
const M = (a, b, t) => mistura(a, b, t);
const HORIZON = M('neve', 'agua', 0.32); // horizonte: branco-azulado (também é a cor da névoa)
const ZENITH = M('agua', 'pedraClara', 0.18); // alto do céu: azul-aço
const UNDERWATER = M('agua', 'ceuNoite', 0.45);

// Névoa com começo: perto fica limpo, a névoa entra no meio do caminho e fecha no fim da
// visão (esconde o corte do mundo). Vale para tudo que usa neblina exp2 (densidade = 2/visão).
//   COMEÇO = 0,25 / densidade (12% da visão)   FORÇA = 3,2 (quanto fecha no fim)
THREE.ShaderChunk.fog_fragment = THREE.ShaderChunk.fog_fragment.replace(
  'float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );',
  'float fogT = max( vFogDepth - 0.25 / fogDensity, 0.0 ) * fogDensity * 0.55;\n\t\tfloat fogFactor = 1.0 - exp( - 3.2 * pow( fogT, 2.2 ) );',
);

// Direção da luz principal (sol de dia, lua à noite). É o MESMO vetor
// usado pela água e pelo céu: mudar aqui muda tudo junto.
export const SUN_DIR = new THREE.Vector3(0.45, 0.5, 0.6).normalize();
// ALTURA DO SOL: SOL_ALTO = quanto ele sobe (0,42 com SOL_LADO 0,6 => ~35° no meio-dia)
const SOL_ALTO = 0.42;
const SOL_LADO = 0.6;

// Noite = antes de NIGHT_END ou depois de NIGHT_START (fração do ciclo).
export const NIGHT_START = 0.79;
export const NIGHT_END = 0.22;

// Cores do céu ao longo do dia: [t, horizonte, zênite, cor da luz,
// força da luz, céu do hemisfério (ambiente), força do hemisfério, nuvens]
// >>> AMBIENTE: a cor fria (azul-acinzentada) é escura, por isso a força passa de 1;
//     abaixe a força para sombras mais fechadas, suba para sombras mais claras.
const KEYS = [
  // noite: azul-escura de verdade, luar azulado fraco
  [0.0, M('ceuNoite', 'pedraEscura', 0.3), M('ceuNoite', 'terraEscura', 0.35), M('pedraClara', 'ceuNoite', 0.25), 0.5, M('ceuNoite', 'pedra', 0.45), 0.9, 0.18],
  [0.19, M('ceuNoite', 'pedraEscura', 0.3), M('ceuNoite', 'terraEscura', 0.35), M('pedraClara', 'ceuNoite', 0.25), 0.5, M('ceuNoite', 'pedra', 0.45), 0.9, 0.18],
  // amanhecer: horizonte alaranjado, sol laranja
  [0.26, M('solLaranja', 'ferrugem', 0.15), M('ceuNoite', 'pedra', 0.55), PALETA.solLaranja, 1.6, M('pedra', 'solLaranja', 0.3), 1.35, 0.9],
  [0.33, M('neve', 'solLaranja', 0.28), M('agua', 'pedraClara', 0.22), M('neve', 'solLaranja', 0.6), 3.0, M('pedraClara', 'agua', 0.45), 2.3, 1.0],
  // meio do dia: céu azul-acinzentado e sol dourado (baixo)
  [0.5, HORIZON, ZENITH, M('neve', 'solLaranja', 0.45), 3.4, M('pedraClara', 'agua', 0.4), 2.3, 1.0],
  [0.67, M('neve', 'solLaranja', 0.3), M('agua', 'pedraClara', 0.22), M('neve', 'solLaranja', 0.62), 3.0, M('pedraClara', 'agua', 0.45), 2.3, 1.0],
  // entardecer: avermelhado
  [0.75, M('ferrugem', 'solLaranja', 0.4), M('ceuNoite', 'ferrugem', 0.25), M('ferrugem', 'solLaranja', 0.55), 1.5, M('pedra', 'ferrugem', 0.3), 1.3, 0.9],
  [0.8, M('ceuNoite', 'pedraEscura', 0.3), M('ceuNoite', 'terraEscura', 0.35), M('pedraClara', 'ceuNoite', 0.25), 0.5, M('ceuNoite', 'pedra', 0.45), 0.9, 0.18],
  [1.0, M('ceuNoite', 'pedraEscura', 0.3), M('ceuNoite', 'terraEscura', 0.35), M('pedraClara', 'ceuNoite', 0.25), 0.5, M('ceuNoite', 'pedra', 0.45), 0.9, 0.18],
].map(([t, h, z, sc, si, hs, hi, cl]) => ({ t, h, z, sc, si, hs, hi, cl }));

export class Sky {
  constructor(scene) {
    this.scene = scene;
    this.sunDir = SUN_DIR.clone();
    this.viewDistance = 180;
    this.underwater = false;
    this.shadowRange = 40;

    // luz ambiente: céu frio em cima, chão de terra embaixo (cores trocadas por setTime)
    this.hemi = new THREE.HemisphereLight(M('pedraClara', 'agua', 0.4), PALETA.terraEscura.clone(), 1.0);
    scene.add(this.hemi);

    this.sun = new THREE.DirectionalLight(M('neve', 'solLaranja', 0.45), 2.6);
    this.sun.castShadow = true;
    this._setShadowRange(40);
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.04;
    scene.add(this.sun);
    scene.add(this.sun.target);

    scene.fog = new THREE.FogExp2(HORIZON.clone(), 0.01);
    scene.background = HORIZON.clone();

    this.dome = new THREE.Mesh(
      new THREE.SphereGeometry(1, 32, 16),
      makeSkyMaterial({ horizon: HORIZON.clone(), zenith: ZENITH.clone(), sunDir: SUN_DIR }),
    );
    this.dome.renderOrder = -2;
    this.dome.frustumCulled = false;
    this.dome.name = 'Ceu';
    scene.add(this.dome);
    this.time = 0.35;
    this.daylight = 1;
    this.night = 0;
    this.exposure = 1.15;
    this._horizon = HORIZON.clone();
  }

  // Hora do dia (0 a 1). Atualiza sol/lua, cores do céu, luz e neblina.
  setTime(t) {
    t = ((t % 1) + 1) % 1;
    this.time = t;
    let i = 0;
    while (i < KEYS.length - 2 && KEYS[i + 1].t <= t) i++;
    const a = KEYS[i];
    const b = KEYS[i + 1];
    const f = Math.min(1, Math.max(0, (t - a.t) / Math.max(1e-6, b.t - a.t)));
    const L = (x, y) => x + (y - x) * f;
    this._horizon.copy(a.h).lerp(b.h, f);
    const u = this.dome.material.uniforms;
    u.uHorizon.value.copy(this._horizon);
    u.uZenith.value.copy(a.z).lerp(b.z, f);
    u.uCloud.value = L(a.cl, b.cl);
    this.sun.color.copy(a.sc).lerp(b.sc, f);
    this.sun.intensity = L(a.si, b.si);
    this.hemi.color.copy(a.hs).lerp(b.hs, f);
    this.hemi.intensity = L(a.hi, b.hi);
    // sol gira em volta da ilha; à noite a luz vem da lua (oposta)
    const ang = (t - 0.25) * Math.PI * 2;
    // sol baixo: sobe só até ~35° (sombras compridas e luz dourada o dia todo)
    const sun = new THREE.Vector3(Math.cos(ang) * 0.85, Math.sin(ang) * SOL_ALTO, SOL_LADO).normalize();
    const up = sun.y > -0.05 ? sun : sun.clone().negate();
    if (up.y < 0.15) up.y = 0.15;
    SUN_DIR.copy(up).normalize();
    this.sunDir.copy(SUN_DIR);
    u.uSunColor.value.copy(this.sun.color).multiplyScalar(sun.y > -0.05 ? 1 : 0.35);
    this.daylight = Math.min(1, Math.max(0.3, (this.sun.intensity - 0.62) / 2.9 * 0.7 + 0.3));
    // 0 = dia, 1 = noite fechada (vale para o céu: estrelas e lua) e para o brilho do sol na tela
    this.night = Math.min(1, Math.max(0, 1 - (this.sun.intensity - 0.62) / 0.88));
    u.uNight.value = this.night;
    // o filme (exposição) sobe um pouco no sol forte e desce à noite
    this.exposure = 1.12 + 0.14 * Math.max(0, Math.min(1, (this.sun.intensity - 0.62) / 2.9)); // noite mais escura (antes 1,3)
    sharedDay.value = this.daylight;
    if (!this.underwater) {
      this.scene.fog.color.copy(this._horizon);
      // Lapônia: ar frio e limpo, neblina azulada (cold = 0..1, vem do mundo)
      if (this.cold > 0) {
        this._coldTint = this._coldTint ?? new THREE.Color();
        this._coldTint.copy(PALETA.neve).lerp(PALETA.agua, 0.3).multiplyScalar(0.25 + this.daylight * 0.85);
        this.scene.fog.color.lerp(this._coldTint, this.cold * 0.7);
        // céu dourado sobre a neve (Valheim): de dia o horizonte puxa para o ouro
        this._goldTint = this._goldTint ?? new THREE.Color();
        this._goldTint.copy(PALETA.neve).lerp(PALETA.solLaranja, 0.55).multiplyScalar(0.3 + this.daylight * 0.8);
        this.scene.fog.color.lerp(this._goldTint, this.cold * 0.5 * (1 - this.night));
      }
      // morros da mata: neblina clara e úmida (mist = 0..1, vem do mundo)
      if (this.mist > 0.01) {
        this._mistTint = this._mistTint ?? new THREE.Color();
        this._mistTint.copy(PALETA.pedraClara).lerp(PALETA.musgo, 0.3).multiplyScalar(0.2 + this.daylight * 0.85); // neblina esverdeada da mata
        this.scene.fog.color.lerp(this._mistTint, this.mist * 0.5);
      }
      this.scene.background.copy(this.scene.fog.color);
    }
  }

  get isNight() {
    return this.time < NIGHT_END || this.time > NIGHT_START;
  }

  _setShadowRange(r) {
    this.shadowRange = r;
    const cam = this.sun.shadow.camera;
    cam.left = -r;
    cam.right = r;
    cam.top = r;
    cam.bottom = -r;
    cam.near = 1;
    cam.far = 400;
    cam.updateProjectionMatrix();
  }

  // Neblina "exponencial": em view-distance quase nada se vê.
  setViewDistance(d) {
    this.viewDistance = d;
    if (!this.underwater) this.scene.fog.density = 2.0 / d;
  }

  setShadows(enabled, mapSize, range = 40) {
    this.sun.castShadow = enabled;
    this._setShadowRange(range);
    if (this.sun.shadow.mapSize.x !== mapSize) {
      this.sun.shadow.mapSize.set(mapSize, mapSize);
      if (this.sun.shadow.map) {
        this.sun.shadow.map.dispose();
        this.sun.shadow.map = null;
      }
    }
  }

  // info = { color, density } da água onde mergulhou (mar ou pântano)
  setUnderwater(on, info = null) {
    if (on === this.underwater && (!on || info === this._uwInfo)) return;
    this.underwater = on;
    this._uwInfo = info;
    const fog = this.scene.fog;
    if (on) {
      const c = new THREE.Color(info?.color ?? UNDERWATER).multiplyScalar(0.35 + 0.65 * this.daylight);
      fog.color.copy(c);
      fog.density = info?.density ?? 0.12;
      this.scene.background.copy(c);
    } else {
      fog.color.copy(this._horizon);
      this.scene.background.copy(this._horizon);
      this.setViewDistance(this.viewDistance);
    }
    this.dome.visible = !on;
  }

  update(camera, focus) {
    this.dome.position.copy(camera.position);
    this.dome.scale.setScalar(Math.min(camera.far * 0.9, 600));
    // A sombra acompanha o jogador, presa a uma grade (não "treme").
    const step = (this.shadowRange * 2) / this.sun.shadow.mapSize.x;
    const fx = Math.round(focus.x / step) * step;
    const fz = Math.round(focus.z / step) * step;
    this.sun.target.position.set(fx, focus.y, fz);
    this.sun.position.set(fx, focus.y, fz).addScaledVector(this.sunDir, 200);
  }
}
