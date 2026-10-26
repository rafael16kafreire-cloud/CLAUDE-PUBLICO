// =============================================================
// CONSTRUÇÃO – peças que se encaixam numa grade de 3 m
// Materiais (como no ARK): palha < madeira < pedra < metal. Cada peça
// tem vida; bichos que caçam você e esbarram numa peça mordem até
// quebrar. Pedra só quebra com bicho grande (8 m ou mais); metal só
// com gigante (14 m ou mais).
//  - pilar:  coluna; vai no canto de um piso ou no chão.
//  - janela: parede com janela (encaixa como parede).
//  - telhado: teto inclinado (encaixa como teto, cai para o lado que olha).
//  - cerca:  muro baixo (1,3 m) na beira do piso ou solto no chão.
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

export const BASES = ['piso', 'parede', 'porta', 'teto', 'rampa', 'pilar', 'janela', 'telhado', 'cerca'];
const FENCE_H = 1.3;
// vida de cada material (peça inteira); pilar e cerca têm menos
export const TIERS = {
  palha: { nome: 'Palha', vida: 250, pecas: ['piso', 'parede', 'porta', 'teto'] },
  madeira: { nome: 'Madeira', vida: 900 },
  pedra: { nome: 'Pedra', vida: 3000, quebra_m: 8, resiste: 0.5 },
  metal: { nome: 'Metal', vida: 8000, quebra_m: 14, resiste: 0.15 },
};
const VIDA_PECA = { pilar: 0.6, cerca: 0.5, teto: 0.8, telhado: 0.8 };
// id do item/peça: madeira = só o nome (piso, parede...); os outros
// levam o material no fim (piso_pedra, parede_metal...)
export const pieceId = (base, tier) => (tier === 'madeira' ? base : `${base}_${tier}`);
export function parsePiece(id) {
  const [base, tier = 'madeira'] = id.split('_');
  return BASES.includes(base) && TIERS[tier] ? { base, tier } : null;
}
export const PIECES = [];
for (const t of Object.keys(TIERS)) for (const b of TIERS[t].pecas ?? BASES) PIECES.push(pieceId(b, t));

const WOOD = new THREE.MeshLambertMaterial({ color: '#8a6438' });
const WOOD_DARK = new THREE.MeshLambertMaterial({ color: '#5e4226' });
const THATCH = new THREE.MeshLambertMaterial({ color: '#a08848' });
const THATCH_DARK = new THREE.MeshLambertMaterial({ color: '#7a6430' });
const STONE = new THREE.MeshLambertMaterial({ color: '#8f8b82' });
const STONE_DARK = new THREE.MeshLambertMaterial({ color: '#5e5a54' });
const METAL = new THREE.MeshLambertMaterial({ color: '#8c939c' });
const METAL_DARK = new THREE.MeshLambertMaterial({ color: '#4c5258' });
// [principal, detalhe, teto]
const MATS = {
  palha: [THATCH, THATCH_DARK, THATCH],
  madeira: [WOOD, WOOD_DARK, THATCH],
  pedra: [STONE, STONE_DARK, STONE],
  metal: [METAL, METAL_DARK, METAL],
};
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
  const { base, tier } = parsePiece(type);
  const [MAIN, DARK, ROOF] = MATS[tier];
  const M = (m) => ghostMat ?? m;
  const add = (...ms) => ms.forEach((m) => root.add(m));
  // linhas de detalhe na frente de uma parede (tábuas, pedras, chapas)
  const wallLines = (w, h, x0 = 0, y0 = 0) => {
    if (ghostMat) return;
    if (tier === 'pedra') {
      for (let r = 0; r < Math.round(h / 0.5); r++) {
        add(box(w, 0.03, T + 0.02, x0, y0 + (r + 1) * 0.5, 0, DARK));
        for (let k = (r % 2) * 0.5; k < w; k += 1) add(box(0.03, 0.5, T + 0.02, x0 - w / 2 + k, y0 + r * 0.5 + 0.25, 0, DARK));
      }
    } else if (tier === 'metal') {
      for (const y of [h * 0.33, h * 0.66]) add(box(w, 0.05, T + 0.03, x0, y0 + y, 0, DARK));
      for (const x of [-w / 2 + 0.1, w / 2 - 0.1]) add(box(0.06, h, T + 0.03, x0 + x, y0 + h / 2, 0, DARK));
    } else {
      for (let k = 1; k < Math.round(h / 0.75); k++) add(box(w, 0.03, T + 0.02, x0, y0 + k * 0.75, 0, DARK));
    }
  };
  if (base === 'piso') {
    add(box(CELL, 0.35, CELL, 0, -0.175, 0, M(MAIN)));
    // tábuas / lajes
    if (!ghostMat) for (let i = -1; i <= 1; i++) add(box(0.04, 0.01, CELL - 0.05, i * 1.0, 0.005, 0, DARK));
    // pilares (seguram o piso em morro)
    for (const [x, z] of [[-1.3, -1.3], [1.3, -1.3], [-1.3, 1.3], [1.3, 1.3]]) add(box(0.28, 2.4, 0.28, x, -1.4, z, M(DARK)));
  } else if (base === 'parede') {
    add(box(CELL, WALL_H, T, 0, WALL_H / 2, 0, M(MAIN)));
    wallLines(CELL, WALL_H);
  } else if (base === 'porta') {
    add(box(1.0, WALL_H, T, -1.0, WALL_H / 2, 0, M(MAIN)));
    add(box(1.0, WALL_H, T, 1.0, WALL_H / 2, 0, M(MAIN)));
    add(box(1.0, 0.7, T, 0, WALL_H - 0.35, 0, M(MAIN)));
  } else if (base === 'janela') {
    // vão da janela: x -0,6..0,6, y 1,0..2,2
    add(box(CELL, 1.0, T, 0, 0.5, 0, M(MAIN)));
    add(box(CELL, WALL_H - 2.2, T, 0, (2.2 + WALL_H) / 2, 0, M(MAIN)));
    add(box(0.9, 1.2, T, -1.05, 1.6, 0, M(MAIN)));
    add(box(0.9, 1.2, T, 1.05, 1.6, 0, M(MAIN)));
    if (!ghostMat) add(box(1.3, 0.06, T + 0.12, 0, 1.0, 0, DARK), box(0.05, 1.2, 0.05, 0, 1.6, 0, DARK));
  } else if (base === 'cerca') {
    if (tier === 'madeira' || tier === 'palha') {
      for (const x of [-1.4, 0, 1.4]) add(box(0.14, FENCE_H, 0.14, x, FENCE_H / 2, 0, M(DARK)));
      for (const y of [0.45, 1.05]) add(box(CELL, 0.12, 0.06, 0, y, 0, M(MAIN)));
    } else {
      add(box(CELL, FENCE_H, T + 0.1, 0, FENCE_H / 2, 0, M(MAIN)));
      wallLines(CELL, FENCE_H);
    }
  } else if (base === 'pilar') {
    add(box(0.38, WALL_H, 0.38, 0, WALL_H / 2, 0, M(MAIN)));
    if (!ghostMat) add(box(0.46, 0.12, 0.46, 0, WALL_H - 0.06, 0, DARK), box(0.46, 0.12, 0.46, 0, 0.06, 0, DARK));
  } else if (base === 'teto') {
    add(box(CELL, T, CELL, 0, -T / 2, 0, M(ROOF)));
    if (!ghostMat) for (let i = -1; i <= 1; i++) add(box(0.06, 0.06, CELL, i * 1.0, -T - 0.03, 0, DARK));
  } else if (base === 'rampa' || base === 'telhado') {
    // prancha inclinada: sobe de z = +1.5 (y 0) até z = -1.5 (y 3)
    // (telhado: mais baixo, 1,5 m, e passa um pouco da beira)
    const rise = base === 'telhado' ? WALL_H / 2 : WALL_H;
    const len = Math.hypot(CELL, rise) + (base === 'telhado' ? 0.5 : 0);
    const plank = box(base === 'telhado' ? CELL + 0.2 : CELL - 0.2, base === 'telhado' ? T : 0.18, len, 0, rise / 2, 0, M(base === 'telhado' ? ROOF : MAIN));
    plank.rotation.x = Math.atan2(rise, CELL);
    add(plank);
    if (!ghostMat) for (let i = 0; i < 7; i++) {
      const st = box(CELL - 0.3, 0.06, 0.08, 0, 0, 0, DARK);
      const k = (i + 0.5) / 7;
      st.position.set(0, k * rise + (base === 'telhado' ? 0.12 : 0.11), HALF - k * CELL);
      add(st);
    }
  }
}

// ------------------------------------------------------------
export class BuildPiece extends Structure {
  constructor(world, type, position, rotY, id) {
    super(world, type, position, rotY, id);
    this.isBuild = true;
    this.open = false;
    const { base, tier } = parsePiece(type);
    this.base = base;
    this.tier = tier;
    this.maxHp = Math.round(TIERS[tier].vida * (VIDA_PECA[base] ?? 1));
    this.hp = this.maxHp;
    buildMesh(type, this.root);
    if (base === 'porta') {
      // folha da porta presa na dobradiça (lado esquerdo do vão)
      this.hinge = new THREE.Group();
      this.hinge.position.set(-0.5, 0, 0);
      this.hinge.add(box(1.0, 2.3, 0.08, 0.5, 1.15, 0, MATS[tier][1]));
      this.root.add(this.hinge);
    }
    this.wallH = base === 'cerca' ? FENCE_H : WALL_H;
    const up = { parede: 1.2, porta: 1.2, janela: 1.2, rampa: 1.5, telhado: 0.8, pilar: 1.4, cerca: 0.8 }[base] ?? 0.3;
    this.interactPoint = position.clone().add(new THREE.Vector3(0, up, 0));
    this.interactRadius = base === 'piso' || base === 'teto' || base === 'telhado' ? 1.4 : base === 'pilar' ? 0.8 : 1.6;
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
    const b = this.base;
    if (b === 'pilar') {
      const l = this.local(x, z);
      return Math.abs(l.x) < 0.25 && Math.abs(l.z) < 0.25 ? this.position.y + WALL_H : null;
    }
    if (b !== 'piso' && b !== 'teto' && b !== 'rampa' && b !== 'telhado') return null;
    const l = this.local(x, z);
    if (Math.abs(l.x) > HALF || Math.abs(l.z) > HALF) return null;
    if (b === 'rampa') return this.position.y + ((HALF - l.z) / CELL) * WALL_H + 0.1;
    if (b === 'telhado') return this.position.y + ((HALF - l.z) / CELL) * (WALL_H / 2) + 0.15;
    return this.position.y;
  }

  // Empurra um círculo (jogador/bicho) para fora das paredes.
  // Devolve true se empurrou.
  collide(pos, radius, feetY, height = 1.7) {
    const b = this.base;
    if (b !== 'parede' && b !== 'porta' && b !== 'janela' && b !== 'cerca' && b !== 'pilar') return false;
    if (feetY > this.position.y + this.wallH - 0.1 || feetY + height < this.position.y) return false;
    const boxes = b === 'porta' ? [[-1.0, 0.5], [1.0, 0.5]] : b === 'pilar' ? [[0, 0.19]] : [[0, HALF]];
    if (b === 'porta' && !this.open) boxes.push([0, 0.5]);
    const hd = b === 'pilar' ? 0.19 : T / 2;
    let pushed = false;
    for (const [cx, hw] of boxes) {
      const l = this.local(pos.x, pos.z);
      const qx = Math.max(-hw, Math.min(hw, l.x - cx));
      const qz = Math.max(-hd, Math.min(hd, l.z));
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
        nz = (l.z >= 0 ? 1 : -1) * (radius + hd - Math.abs(l.z));
      }
      const c = Math.cos(this.rotY);
      const s = Math.sin(this.rotY);
      pos.x += nx * c + nz * s;
      pos.z += -nx * s + nz * c;
      pushed = true;
    }
    return pushed;
  }

  // Bicho mordendo a peça. Pedra/metal só quebram com bicho grande.
  // Devolve o dano feito (0 = não consegue).
  damage(amount, attacker = null) {
    const T0 = TIERS[this.tier];
    if (T0.quebra_m) {
      const size = attacker ? (attacker.bodyFront + attacker.bodyBack) * attacker.scale : 0;
      if (size < T0.quebra_m) return 0;
      amount *= T0.resiste;
    }
    this.hp -= amount;
    this.changed = true;
    const fx = this.position.clone().add(new THREE.Vector3(0, Math.min(1.5, this.wallH / 2), 0));
    this.world.effects?.burst(fx, this.tier === 'pedra' || this.tier === 'metal' ? 'pedra' : 'madeira', 6, 2.5);
    if (this.hp <= 0) {
      this.world.removeStructure(this);
      events.emit(EV.MESSAGE, { text: `${pieceName(this.type)} foi quebrado${attacker?.species ? ` por ${attacker.species.nome}` : ''}!`, kind: 'warn' });
    }
    return amount;
  }

  promptText() {
    if (this.base === 'porta') return this.open ? 'Fechar porta' : 'Abrir porta';
    const hurt = this.hp < this.maxHp ? ` · vida ${Math.ceil(this.hp)}/${this.maxHp}` : '';
    return `Desmontar ${pieceName(this.type)} (devolve metade)${hurt}`;
  }

  use({ inventory }) {
    if (this.base === 'porta') {
      this.open = !this.open;
      this.hinge.rotation.y = this.open ? -Math.PI / 2 : 0;
      this.changed = true;
      return true;
    }
    // desmontar: devolve metade dos materiais
    const rec = this.world.recipeFor?.(this.type);
    if (rec) for (const [id, n] of Object.entries(rec.ingredientes)) inventory.add(id, Math.floor(n / 2));
    this.world.removeStructure(this);
    events.emit(EV.MESSAGE, { text: `${pieceName(this.type)} desmontado.`, kind: 'info' });
    return false;
  }

  toJSON() {
    return { ...super.toJSON(), open: this.open, hp: Math.round(this.hp) };
  }

  // co-op: porta aberta/fechada por outro jogador
  applyState(m) {
    if (typeof m.hp === 'number') this.hp = m.hp;
    if (this.base === 'porta' && typeof m.open === 'boolean' && m.open !== this.open) {
      this.open = m.open;
      this.hinge.rotation.y = this.open ? -Math.PI / 2 : 0;
    }
  }
}

const NAMES = { piso: 'Piso', parede: 'Parede', porta: 'Porta', teto: 'Teto', rampa: 'Rampa', pilar: 'Pilar', janela: 'Janela', telhado: 'Telhado', cerca: 'Cerca' };
export function pieceName(type) {
  const p = parsePiece(type);
  return p ? `${NAMES[p.base]}${p.tier === 'madeira' ? '' : ` de ${TIERS[p.tier].nome}`}` : type;
}

// ------------------------------------------------------------
// Onde a peça vai ficar (encaixe). Devolve { ok, x, y, z, rot, why }.
// aim = ponto para onde o jogador mira (no chão, ~3 m na frente).
// ------------------------------------------------------------
export function snapPiece(world, type, player, aim, yaw) {
  const base = parsePiece(type)?.base ?? type;
  const pieces = world.structures.filter((s) => s.isBuild && !s.removed);
  const near = (s, r) => Math.hypot(s.position.x - aim.x, s.position.z - aim.z) < r;
  const occupied = (bases, x, y, z, r = 0.4) => pieces.some((s) => bases.includes(s.base)
    && Math.hypot(s.position.x - x, s.position.z - z) < r && Math.abs(s.position.y - y) < 0.5);
  const dirs = (rot) => [0, 1, 2, 3].map((k) => {
    const a = rot + (k * Math.PI) / 2;
    return { dx: Math.sin(a), dz: Math.cos(a), rot: a };
  });
  // gira para o lado que o jogador olha (alinhado à grade da peça)
  const facing = (rot0) => {
    let rot = rot0;
    let bestDot = -2;
    for (const d of dirs(rot0)) {
      const dot = -d.dx * Math.sin(yaw) - d.dz * Math.cos(yaw);
      if (dot > bestDot) {
        bestDot = dot;
        rot = d.rot + Math.PI;
      }
    }
    return rot;
  };
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
  const free = () => checkGround(world, { x: aim.x, y: 0, z: aim.z, rot: Math.round(yaw / (Math.PI / 12)) * (Math.PI / 12) }, false, true);
  const floors = pieces.filter((s) => (s.base === 'piso' || s.base === 'teto') && near(s, 9));
  const WALLS = ['parede', 'porta', 'janela', 'cerca'];
  const ROOFS = ['teto', 'telhado'];

  if (base === 'piso') {
    const cands = [];
    for (const p of floors.filter((s) => s.base === 'piso')) {
      for (const d of dirs(p.rotY)) {
        const x = p.position.x + d.dx * CELL;
        const z = p.position.z + d.dz * CELL;
        if (!occupied(['piso'], x, p.position.y, z, 1)) cands.push({ x, y: p.position.y, z, rot: p.rotY });
      }
    }
    const best = pick(cands);
    if (best && Math.hypot(best.x - aim.x, best.z - aim.z) < 2.6) return checkGround(world, best, true);
    // primeiro piso: livre, onde mira (gira junto com a câmera, de 15 em 15°)
    const rot = Math.round(yaw / (Math.PI / 12)) * (Math.PI / 12);
    return checkGround(world, { x: aim.x, y: 0, z: aim.z, rot }, false);
  }

  if (base === 'teto' || base === 'telhado') {
    const cands = [];
    for (const p of floors) {
      if (p.base === 'piso') {
        const y = p.position.y + WALL_H;
        if (!occupied(ROOFS, p.position.x, y, p.position.z)) cands.push({ x: p.position.x, y, z: p.position.z, rot: p.rotY });
      } else {
        for (const d of dirs(p.rotY)) {
          const x = p.position.x + d.dx * CELL;
          const z = p.position.z + d.dz * CELL;
          if (!occupied(ROOFS, x, p.position.y, z, 1)) cands.push({ x, y: p.position.y, z, rot: p.rotY });
        }
      }
    }
    // em cima de pilares: o pilar é o canto do teto
    for (const p of pieces.filter((s) => s.base === 'pilar' && near(s, 9))) {
      const y = p.position.y + WALL_H;
      for (const d of dirs(p.rotY + Math.PI / 4)) {
        const x = p.position.x + d.dx * HALF * Math.SQRT2;
        const z = p.position.z + d.dz * HALF * Math.SQRT2;
        if (!occupied(ROOFS, x, y, z, 1)) cands.push({ x, y, z, rot: p.rotY });
      }
    }
    const best = pick(cands);
    if (!best) return { ok: false, why: 'Coloque o teto em cima de um piso ou de pilares.' };
    if (base === 'telhado') best.rot = facing(best.rot);
    return { ok: true, ...best };
  }

  if (base === 'parede' || base === 'porta' || base === 'janela' || base === 'cerca') {
    const cands = [];
    for (const p of floors) {
      for (const d of dirs(p.rotY)) {
        const x = p.position.x + d.dx * HALF;
        const z = p.position.z + d.dz * HALF;
        if (!occupied(WALLS, x, p.position.y, z)) cands.push({ x, y: p.position.y, z, rot: d.rot });
      }
    }
    if (base === 'cerca') {
      // cerca solta no chão: emenda na ponta de outra cerca
      for (const c of pieces.filter((s) => s.base === 'cerca' && near(s, 9))) {
        for (const k of [-1, 1]) {
          const x = c.position.x + Math.cos(c.rotY) * CELL * k;
          const z = c.position.z - Math.sin(c.rotY) * CELL * k;
          if (!occupied(WALLS, x, c.position.y, z, 1)) cands.push({ x, y: world.heightAt(x, z), z, rot: c.rotY, ground: true });
        }
      }
    }
    const best = pick(cands);
    if (base === 'cerca' && (!best || Math.hypot(best.x - aim.x, best.z - aim.z) > 2.6)) return free();
    if (!best) return { ok: false, why: 'Paredes encaixam na beira de um piso.' };
    return best.ground ? checkGround(world, best, true, true) : { ok: true, ...best };
  }

  if (base === 'pilar') {
    const cands = [];
    for (const p of floors.filter((s) => s.base === 'piso')) {
      for (const d of dirs(p.rotY + Math.PI / 4)) {
        const x = p.position.x + d.dx * (HALF - 0.2) * Math.SQRT2;
        const z = p.position.z + d.dz * (HALF - 0.2) * Math.SQRT2;
        if (!occupied(['pilar'], x, p.position.y, z)) cands.push({ x, y: p.position.y, z, rot: p.rotY });
      }
    }
    const best = pick(cands);
    if (best && Math.hypot(best.x - aim.x, best.z - aim.z) < 2) return { ok: true, ...best };
    return free();
  }

  if (base === 'rampa') {
    const cands = [];
    for (const p of floors) {
      if (occupied(['rampa'], p.position.x, p.position.y, p.position.z)) continue;
      // sobe para o lado que o jogador está olhando (alinhado à grade)
      cands.push({ x: p.position.x, y: p.position.y, z: p.position.z, rot: facing(p.rotY) });
    }
    const best = pick(cands);
    if (!best) return { ok: false, why: 'A rampa vai em cima de um piso.' };
    return { ok: true, ...best };
  }
  return { ok: false, why: '' };
}

// Piso no chão: altura pelo canto mais alto; não pode ser íngreme demais nem na água.
// small = peça fina (pilar, cerca): olha só o chão embaixo dela.
function checkGround(world, c, snapped, small = false) {
  const hs = [];
  const pts = small ? [[0, 0], [-0.3, 0], [0.3, 0]] : [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 0]];
  for (const [sx, sz] of pts) {
    const a = c.rot;
    const lx = sx * HALF;
    const lz = sz * HALF;
    const x = c.x + lx * Math.cos(a) + lz * Math.sin(a);
    const z = c.z - lx * Math.sin(a) + lz * Math.cos(a);
    hs.push(world.heightAt(x, z));
    if (world.waterAt(x, z) && world.waterAt(x, z).level > world.heightAt(x, z) + 0.6) return { ok: false, ...c, y: hs[0], why: 'Não dá para construir na água funda.' };
  }
  const top = Math.max(...hs) + (small ? 0 : 0.15);
  const low = Math.min(...hs);
  if (!snapped || small) c.y = small ? low : top;
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
    this.groups = {}; // criados na primeira vez que a peça aparece
    this.current = null;
  }

  _group(type) {
    if (!this.groups[type]) {
      const okG = new THREE.Group();
      buildMesh(type, okG, GHOST_OK);
      const badG = new THREE.Group();
      buildMesh(type, badG, GHOST_BAD);
      for (const g of [okG, badG]) {
        g.visible = false;
        g.traverse((o) => { o.castShadow = false; o.renderOrder = 3; });
        this.scene.add(g);
      }
      this.groups[type] = { ok: okG, bad: badG };
    }
    return this.groups[type];
  }

  show(type, place) {
    this.hide();
    if (!type || !place || place.x === undefined || !parsePiece(type)) return;
    const g = this._group(type)[place.ok ? 'ok' : 'bad'];
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
