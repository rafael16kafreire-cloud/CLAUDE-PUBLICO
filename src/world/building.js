// =============================================================
// CONSTRUÇÃO – peças de madeira que se encaixam numa grade de 3 m
//  - piso:   base da casa (3×3 m). O primeiro vai onde você mira;
//            os outros encaixam do lado de um piso que já existe.
//  - parede: encaixa na beira de um piso ou teto (3 m de altura).
//  - porta:  parede com porta que abre e fecha (Interagir).
//  - teto:   em cima de um piso (3 m acima) ou do lado de outro teto.
//            Dá para andar em cima (segundo andar).
//  - rampa:  em cima de um piso; sobe 3 m até o teto/segundo andar.
// Selecione a peça na barra rápida: aparece um "fantasma" verde onde
// ela vai ficar (vermelho = não dá). Atacar coloca. Interagir numa
// peça (menos a porta) desmonta e devolve metade do material.
// =============================================================
import * as THREE from 'three';
import { events, EV } from '../core/event_bus.js';
import { Structure } from './structures.js';

export const CELL = 3;      // tamanho da grade (m)
export const WALL_H = 3;    // altura da parede (m)
const HALF = CELL / 2;
const T = 0.2;              // espessura de parede/teto

export const PIECES = ['piso', 'parede', 'porta', 'teto', 'rampa'];

const WOOD = new THREE.MeshLambertMaterial({ color: '#8a6438' });
const WOOD_DARK = new THREE.MeshLambertMaterial({ color: '#5e4226' });
const THATCH = new THREE.MeshLambertMaterial({ color: '#a08848' });
const GHOST_OK = new THREE.MeshBasicMaterial({ color: '#7fe07a', transparent: true, opacity: 0.38, depthWrite: false });
const GHOST_BAD = new THREE.MeshBasicMaterial({ color: '#ff6a5a', transparent: true, opacity: 0.38, depthWrite: false });

function box(w, h, d, x, y, z, mat) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

// Malha de cada peça (no espaço local: x = largura, z = profundidade).
function buildMesh(type, root, ghostMat = null) {
  const M = (m) => ghostMat ?? m;
  const add = (...ms) => ms.forEach((m) => root.add(m));
  if (type === 'piso') {
    add(box(CELL, 0.35, CELL, 0, -0.175, 0, M(WOOD)));
    // tábuas
    if (!ghostMat) for (let i = -1; i <= 1; i++) add(box(0.04, 0.01, CELL - 0.05, i * 1.0, 0.005, 0, WOOD_DARK));
    // pilares (seguram o piso em morro)
    for (const [x, z] of [[-1.3, -1.3], [1.3, -1.3], [-1.3, 1.3], [1.3, 1.3]]) add(box(0.28, 2.4, 0.28, x, -1.4, z, M(WOOD_DARK)));
  } else if (type === 'parede') {
    add(box(CELL, WALL_H, T, 0, WALL_H / 2, 0, M(WOOD)));
    if (!ghostMat) for (const y of [0.75, 1.5, 2.25]) add(box(CELL, 0.03, T + 0.02, 0, y, 0, WOOD_DARK));
  } else if (type === 'porta') {
    add(box(1.0, WALL_H, T, -1.0, WALL_H / 2, 0, M(WOOD)));
    add(box(1.0, WALL_H, T, 1.0, WALL_H / 2, 0, M(WOOD)));
    add(box(1.0, 0.7, T, 0, WALL_H - 0.35, 0, M(WOOD)));
  } else if (type === 'teto') {
    add(box(CELL, T, CELL, 0, -T / 2, 0, M(THATCH)));
    if (!ghostMat) for (let i = -1; i <= 1; i++) add(box(0.06, 0.06, CELL, i * 1.0, -T - 0.03, 0, WOOD_DARK));
  } else if (type === 'rampa') {
    // prancha inclinada: sobe de z = +1.5 (y 0) até z = -1.5 (y 3)
    const len = Math.hypot(CELL, WALL_H);
    const plank = box(CELL - 0.2, 0.18, len, 0, WALL_H / 2, 0, M(WOOD));
    plank.rotation.x = Math.atan2(WALL_H, CELL);
    add(plank);
    if (!ghostMat) for (let i = 0; i < 7; i++) {
      const s = box(CELL - 0.3, 0.06, 0.08, 0, 0, 0, WOOD_DARK);
      const k = (i + 0.5) / 7;
      s.position.set(0, k * WALL_H + 0.11, HALF - k * CELL);
      add(s);
    }
  }
}

// ------------------------------------------------------------
export class BuildPiece extends Structure {
  constructor(world, type, position, rotY, id) {
    super(world, type, position, rotY, id);
    this.isBuild = true;
    this.open = false;
    buildMesh(type, this.root);
    if (type === 'porta') {
      // folha da porta presa na dobradiça (lado esquerdo do vão)
      this.hinge = new THREE.Group();
      this.hinge.position.set(-0.5, 0, 0);
      this.hinge.add(box(1.0, 2.3, 0.08, 0.5, 1.15, 0, WOOD_DARK));
      this.root.add(this.hinge);
    }
    const up = type === 'parede' || type === 'porta' ? 1.2 : type === 'rampa' ? 1.5 : 0.3;
    this.interactPoint = position.clone().add(new THREE.Vector3(0, up, 0));
    this.interactRadius = type === 'piso' || type === 'teto' ? 1.4 : 1.6;
    this.interactRange = 3.4;
  }

  // ponto (x, z) do mundo no espaço da peça
  local(x, z) {
    const dx = x - this.position.x;
    const dz = z - this.position.z;
    const c = Math.cos(this.rotY);
    const s = Math.sin(this.rotY);
    return { x: dx * c - dz * s, z: dx * s + dz * c };
  }

  // Altura do chão desta peça em (x, z), ou null (piso, teto e rampa).
  surfaceAt(x, z) {
    if (this.type !== 'piso' && this.type !== 'teto' && this.type !== 'rampa') return null;
    const l = this.local(x, z);
    if (Math.abs(l.x) > HALF || Math.abs(l.z) > HALF) return null;
    if (this.type === 'rampa') return this.position.y + ((HALF - l.z) / CELL) * WALL_H + 0.1;
    return this.position.y;
  }

  // Empurra um círculo (jogador/bicho) para fora das paredes.
  collide(pos, radius, feetY, height = 1.7) {
    if (this.type !== 'parede' && this.type !== 'porta') return;
    if (feetY > this.position.y + WALL_H - 0.1 || feetY + height < this.position.y) return;
    const boxes = this.type === 'parede' ? [[0, HALF]] : [[-1.0, 0.5], [1.0, 0.5]];
    if (this.type === 'porta' && !this.open) boxes.push([0, 0.5]);
    for (const [cx, hw] of boxes) {
      const l = this.local(pos.x, pos.z);
      const qx = Math.max(-hw, Math.min(hw, l.x - cx));
      const qz = Math.max(-T / 2, Math.min(T / 2, l.z));
      const dx = l.x - cx - qx;
      const dz = l.z - qz;
      const d = Math.hypot(dx, dz);
      if (d >= radius) continue;
      // empurra para fora no espaço local e volta para o mundo
      let nx;
      let nz;
      if (d > 1e-4) {
        nx = (dx / d) * (radius - d);
        nz = (dz / d) * (radius - d);
      } else {
        nx = 0;
        nz = (l.z >= 0 ? 1 : -1) * (radius + T / 2 - Math.abs(l.z));
      }
      const c = Math.cos(this.rotY);
      const s = Math.sin(this.rotY);
      pos.x += nx * c + nz * s;
      pos.z += -nx * s + nz * c;
    }
  }

  promptText() {
    if (this.type === 'porta') return this.open ? 'Fechar porta' : 'Abrir porta';
    return `Desmontar ${NAMES[this.type]} (devolve metade)`;
  }

  use({ inventory }) {
    if (this.type === 'porta') {
      this.open = !this.open;
      this.hinge.rotation.y = this.open ? -Math.PI / 2 : 0;
      this.changed = true;
      return true;
    }
    // desmontar: devolve metade dos materiais
    const rec = this.world.recipeFor?.(this.type);
    if (rec) for (const [id, n] of Object.entries(rec.ingredientes)) inventory.add(id, Math.floor(n / 2));
    this.world.removeStructure(this);
    events.emit(EV.MESSAGE, { text: `${NAMES[this.type]} desmontado.`, kind: 'info' });
    return false;
  }

  toJSON() {
    return { ...super.toJSON(), open: this.open };
  }

  // co-op: porta aberta/fechada por outro jogador
  applyState(m) {
    if (this.type === 'porta' && typeof m.open === 'boolean' && m.open !== this.open) {
      this.open = m.open;
      this.hinge.rotation.y = this.open ? -Math.PI / 2 : 0;
    }
  }
}

const NAMES = { piso: 'Piso', parede: 'Parede', porta: 'Porta', teto: 'Teto', rampa: 'Rampa' };

// ------------------------------------------------------------
// Onde a peça vai ficar (encaixe). Devolve { ok, x, y, z, rot, why }.
// aim = ponto para onde o jogador mira (no chão, ~3 m na frente).
// ------------------------------------------------------------
export function snapPiece(world, type, player, aim, yaw) {
  const pieces = world.structures.filter((s) => s.isBuild && !s.removed);
  const near = (s, r) => Math.hypot(s.position.x - aim.x, s.position.z - aim.z) < r;
  const occupied = (t, x, y, z, r = 0.4) => pieces.some((s) => (Array.isArray(t) ? t.includes(s.type) : s.type === t)
    && Math.hypot(s.position.x - x, s.position.z - z) < r && Math.abs(s.position.y - y) < 0.5);
  const dirs = (rot) => [0, 1, 2, 3].map((k) => {
    const a = rot + (k * Math.PI) / 2;
    return { dx: Math.sin(a), dz: Math.cos(a), rot: a };
  });
  const eye = player.position.y + 1.2;
  const pick = (cands) => {
    let best = null;
    let bd = Infinity;
    for (const c of cands) {
      const d = Math.hypot(c.x - aim.x, c.z - aim.z) + Math.abs(c.y - eye) * 0.35;
      if (d < bd) {
        bd = d;
        best = c;
      }
    }
    return best;
  };
  const floors = pieces.filter((s) => (s.type === 'piso' || s.type === 'teto') && near(s, 9));

  if (type === 'piso') {
    const cands = [];
    for (const p of floors.filter((s) => s.type === 'piso')) {
      for (const d of dirs(p.rotY)) {
        const x = p.position.x + d.dx * CELL;
        const z = p.position.z + d.dz * CELL;
        if (!occupied('piso', x, p.position.y, z, 1)) cands.push({ x, y: p.position.y, z, rot: p.rotY });
      }
    }
    const best = pick(cands);
    if (best && Math.hypot(best.x - aim.x, best.z - aim.z) < 2.6) return checkGround(world, best, true);
    // primeiro piso: livre, onde mira (gira junto com a câmera, de 15 em 15°)
    const rot = Math.round(yaw / (Math.PI / 12)) * (Math.PI / 12);
    return checkGround(world, { x: aim.x, y: 0, z: aim.z, rot }, false);
  }

  if (type === 'teto') {
    const cands = [];
    for (const p of floors) {
      if (p.type === 'piso') {
        const y = p.position.y + WALL_H;
        if (!occupied('teto', p.position.x, y, p.position.z)) cands.push({ x: p.position.x, y, z: p.position.z, rot: p.rotY });
      } else {
        for (const d of dirs(p.rotY)) {
          const x = p.position.x + d.dx * CELL;
          const z = p.position.z + d.dz * CELL;
          if (!occupied('teto', x, p.position.y, z, 1)) cands.push({ x, y: p.position.y, z, rot: p.rotY });
        }
      }
    }
    const best = pick(cands);
    if (!best) return { ok: false, why: 'Coloque o teto em cima de um piso.' };
    return { ok: true, ...best };
  }

  if (type === 'parede' || type === 'porta') {
    const cands = [];
    for (const p of floors) {
      for (const d of dirs(p.rotY)) {
        const x = p.position.x + d.dx * HALF;
        const z = p.position.z + d.dz * HALF;
        if (!occupied(['parede', 'porta'], x, p.position.y, z)) cands.push({ x, y: p.position.y, z, rot: d.rot });
      }
    }
    const best = pick(cands);
    if (!best) return { ok: false, why: 'Paredes encaixam na beira de um piso.' };
    return { ok: true, ...best };
  }

  if (type === 'rampa') {
    const cands = [];
    for (const p of floors) {
      if (occupied('rampa', p.position.x, p.position.y, p.position.z)) continue;
      // sobe para o lado que o jogador está olhando (alinhado à grade)
      let rot = p.rotY;
      let bestDot = -2;
      for (const d of dirs(p.rotY)) {
        const dot = -d.dx * Math.sin(yaw) - d.dz * Math.cos(yaw);
        if (dot > bestDot) {
          bestDot = dot;
          rot = d.rot + Math.PI;
        }
      }
      cands.push({ x: p.position.x, y: p.position.y, z: p.position.z, rot });
    }
    const best = pick(cands);
    if (!best) return { ok: false, why: 'A rampa vai em cima de um piso.' };
    return { ok: true, ...best };
  }
  return { ok: false, why: '' };
}

// Piso no chão: altura pelo canto mais alto; não pode ser íngreme demais nem na água.
function checkGround(world, c, snapped) {
  const hs = [];
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 0]]) {
    const a = c.rot;
    const lx = sx * HALF;
    const lz = sz * HALF;
    const x = c.x + lx * Math.cos(a) + lz * Math.sin(a);
    const z = c.z - lx * Math.sin(a) + lz * Math.cos(a);
    hs.push(world.heightAt(x, z));
    if (world.waterAt(x, z) && world.waterAt(x, z).level > world.heightAt(x, z) + 0.6) return { ok: false, ...c, y: hs[0], why: 'Não dá para construir na água funda.' };
  }
  const top = Math.max(...hs) + 0.15;
  const low = Math.min(...hs);
  if (!snapped) c.y = top;
  if (c.y - low > 2.6) return { ok: false, ...c, why: 'Chão muito inclinado aqui.' };
  if (c.y < top - 1.0) return { ok: false, ...c, why: 'O chão é mais alto aqui.' };
  return { ok: true, ...c };
}

// ------------------------------------------------------------
// Fantasma: mostra onde a peça vai ficar.
// ------------------------------------------------------------
export class BuildGhost {
  constructor(scene) {
    this.scene = scene;
    this.groups = {};
    for (const t of PIECES) {
      const okG = new THREE.Group();
      buildMesh(t, okG, GHOST_OK);
      const badG = new THREE.Group();
      buildMesh(t, badG, GHOST_BAD);
      for (const g of [okG, badG]) {
        g.visible = false;
        g.traverse((o) => { o.castShadow = false; o.renderOrder = 3; });
        scene.add(g);
      }
      this.groups[t] = { ok: okG, bad: badG };
    }
    this.current = null;
  }

  show(type, place) {
    this.hide();
    if (!type || !place || place.x === undefined) return;
    const g = this.groups[type][place.ok ? 'ok' : 'bad'];
    g.position.set(place.x, place.y, place.z);
    g.rotation.y = place.rot;
    g.visible = true;
    this.current = g;
  }

  hide() {
    if (this.current) this.current.visible = false;
    this.current = null;
  }
}
