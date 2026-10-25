// =============================================================
// ESTRUTURAS COLOCADAS PELO JOGADOR
// - Fogueira: acende com madeira; acesa assa a carne crua do
//   inventário de quem está perto, esquenta e ilumina a noite.
// - Saco de dormir: vira ponto de renascer no mapa e deixa dormir
//   até de manhã (se não houver perigo por perto).
// Cada uma tem: promptText() (dica na tela), use() (botão Interagir),
// update(dt) e toJSON() (para o co-op e para salvar).
// =============================================================
import * as THREE from 'three';
import { BALANCE } from '../core/balance.js';
import { events, EV } from '../core/event_bus.js';

const STONE_MAT = new THREE.MeshLambertMaterial({ color: '#7d7a72' });
const LOG_MAT = new THREE.MeshLambertMaterial({ color: '#5a3e26' });
const ASH_MAT = new THREE.MeshLambertMaterial({ color: '#2e2a26' });
const FLAME_MAT = new THREE.MeshBasicMaterial({ color: '#ff9a30', transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
const FLAME_CORE = new THREE.MeshBasicMaterial({ color: '#ffe27a', transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
const BAG_MAT = new THREE.MeshLambertMaterial({ color: '#6a7a4a' });
const PILLOW_MAT = new THREE.MeshLambertMaterial({ color: '#c8b88a' });

let nextId = 1;
function mmss(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export class Structure {
  constructor(world, type, position, rotY, id) {
    this.world = world;
    this.type = type;
    this.id = id ?? `${type}-${Date.now().toString(36)}-${nextId++}`;
    this.position = position.clone();
    this.rotY = rotY;
    this.removed = false;
    this.interactRange = 3.2;
    this.interactRadius = 1.3;
    this.root = new THREE.Group();
    this.root.position.copy(position);
    this.root.rotation.y = rotY;
    world.scene.add(this.root);
    this.interactPoint = position.clone().add(new THREE.Vector3(0, 0.4, 0));
  }

  remove() {
    if (this.removed) return;
    this.removed = true;
    this.world.scene.remove(this.root);
  }

  toJSON() {
    const p = this.position;
    return { id: this.id, type: this.type, x: p.x, y: p.y, z: p.z, rot: this.rotY };
  }
}

// ------------------------------------------------------------
export class Campfire extends Structure {
  constructor(world, position, rotY, id) {
    super(world, 'fogueira', position, rotY, id);
    this.fuel = 0;            // segundos de fogo restantes
    this._cook = 0;
    this._t = Math.random() * 10;
    // pedras em roda
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      const st = new THREE.Mesh(new THREE.DodecahedronGeometry(0.16 + (i % 3) * 0.03, 0), STONE_MAT);
      st.position.set(Math.cos(a) * 0.55, 0.08, Math.sin(a) * 0.55);
      st.rotation.set(i, i * 2, 0);
      st.scale.y = 0.7;
      st.castShadow = true;
      this.root.add(st);
    }
    const ash = new THREE.Mesh(new THREE.CircleGeometry(0.45, 10), ASH_MAT);
    ash.rotation.x = -Math.PI / 2;
    ash.position.y = 0.02;
    this.root.add(ash);
    // lenha cruzada
    for (let i = 0; i < 4; i++) {
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.75, 6), LOG_MAT);
      log.rotation.z = Math.PI / 2 - 0.45;
      log.rotation.y = (i / 4) * Math.PI * 2;
      log.position.y = 0.16;
      this.root.add(log);
    }
    // chamas
    this.flames = new THREE.Group();
    for (let i = 0; i < 5; i++) {
      const f = new THREE.Mesh(new THREE.ConeGeometry(0.16 - i * 0.015, 0.7, 6, 1, true), i === 0 ? FLAME_CORE : FLAME_MAT);
      const a = (i / 5) * Math.PI * 2;
      f.position.set(i ? Math.cos(a) * 0.12 : 0, 0.42, i ? Math.sin(a) * 0.12 : 0);
      f.userData.base = f.position.y;
      this.flames.add(f);
    }
    this.flames.visible = false;
    this.root.add(this.flames);
  }

  get lit() {
    return this.fuel > 0;
  }

  promptText() {
    const F = BALANCE.fogueira;
    if (!this.lit) return `Acender fogueira (${F.madeira_por_acender} madeira)`;
    return `Fogueira acesa ${mmss(this.fuel)} · pôr lenha (${F.madeira_por_acender} madeira)`;
  }

  use({ inventory }) {
    const F = BALANCE.fogueira;
    // lenha: madeira, ou o dobro de gravetos
    const sticks = F.madeira_por_acender * 2;
    if (inventory.count('madeira') >= F.madeira_por_acender) inventory.remove('madeira', F.madeira_por_acender);
    else if (inventory.count('graveto') >= sticks) inventory.remove('graveto', sticks);
    else {
      events.emit(EV.MESSAGE, { text: `Precisa de ${F.madeira_por_acender} madeira ou ${sticks} gravetos.`, kind: 'warn' });
      return false;
    }
    const was = this.lit;
    this.fuel += F.minutos_por_lenha * 60;
    events.emit(EV.MESSAGE, { text: was ? 'Mais lenha na fogueira.' : 'Fogueira acesa! Fique perto para assar carne.', kind: 'info' });
    this.changed = true;
    return true;
  }

  // Calor perto da fogueira acesa.
  warmthAt(pos) {
    if (!this.lit) return 0;
    const d = Math.hypot(pos.x - this.position.x, pos.z - this.position.z);
    const R = BALANCE.fogueira.raio_m * 2;
    return d < R ? BALANCE.fogueira.calor_c * (1 - d / R) : 0;
  }

  update(dt) {
    this._t += dt;
    if (this.fuel > 0) {
      this.fuel = Math.max(0, this.fuel - dt);
      if (this.fuel === 0) this.changed = true;
    }
    this.flames.visible = this.lit;
    if (this.lit) {
      this.flames.children.forEach((f, i) => {
        const k = 0.8 + Math.sin(this._t * (9 + i * 2.3) + i) * 0.15 + Math.sin(this._t * 23 + i * 5) * 0.08;
        f.scale.set(1, k, 1);
        f.position.y = f.userData.base * k;
      });
      this._cookNearby(dt);
    }
  }

  // Assa a carne crua de quem está perto (jogador deste aparelho).
  _cookNearby(dt) {
    const p = this.world.localPlayer;
    const inv = this.world.localInventory;
    if (!p || !inv || p.dead) return;
    const d = Math.hypot(p.position.x - this.position.x, p.position.z - this.position.z);
    if (d > BALANCE.fogueira.raio_m || inv.count('carne_crua') <= 0) {
      this._cook = 0;
      return;
    }
    this._cook += dt;
    if (this._cook >= BALANCE.fogueira.segundos_por_carne) {
      this._cook = 0;
      inv.remove('carne_crua', 1);
      const added = inv.add('carne_assada', 1);
      if (added) {
        events.emit(EV.ITEM_GAINED, { id: 'carne_assada', amount: 1 });
        events.emit(EV.COOKED, { id: 'carne_assada' });
      }
    }
  }

  // Fração de luz (0..1) para a luz da fogueira, piscando.
  get flicker() {
    if (!this.lit) return 0;
    return 0.85 + Math.sin(this._t * 13) * 0.08 + Math.sin(this._t * 31) * 0.05;
  }

  toJSON() {
    return { ...super.toJSON(), fuel: Math.round(this.fuel) };
  }

  applyState(d) {
    if (typeof d.fuel === 'number') this.fuel = d.fuel;
  }
}

// ------------------------------------------------------------
export class SleepingBag extends Structure {
  constructor(world, position, rotY, id, owner = '') {
    super(world, 'saco_dormir', position, rotY, id);
    this.owner = owner;
    const bag = new THREE.Mesh(new THREE.CapsuleGeometry(0.38, 1.3, 4, 10), BAG_MAT);
    bag.rotation.x = Math.PI / 2;
    bag.scale.set(1, 1, 0.38);
    bag.position.y = 0.14;
    bag.castShadow = true;
    const pillow = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.4, 4, 8), PILLOW_MAT);
    pillow.rotation.z = Math.PI / 2;
    pillow.position.set(0, 0.2, -0.82);
    pillow.scale.set(1, 1, 0.6);
    this.root.add(bag, pillow);
    this.name = 'Saco de dormir';
  }

  get respawnPoint() {
    return { id: this.id, name: this.name, position: this.position.clone().add(new THREE.Vector3(0.9, 0, 0)), yaw: this.rotY, bag: true };
  }

  promptText() {
    return this.world.sky.isNight ? 'Dormir até de manhã' : 'Saco de dormir (dá para dormir à noite)';
  }

  use() {
    const w = this.world;
    if (!w.sky.isNight) {
      events.emit(EV.MESSAGE, { text: 'Só dá para dormir à noite.', kind: 'info' });
      return false;
    }
    if (w.multiplayer && !w.multiplayer.isHost) {
      events.emit(EV.MESSAGE, { text: 'No co-op, só quem criou a partida pode passar a noite dormindo.', kind: 'info' });
      return false;
    }
    const danger = w.creatures?.list.some((c) => c.alive && c.species.temperamento === 'agressivo'
      && Math.hypot(c.pos.x - this.position.x, c.pos.z - this.position.z) < 30);
    if (danger) {
      events.emit(EV.MESSAGE, { text: 'Não dá para dormir com predador por perto!', kind: 'warn' });
      return false;
    }
    w.skipToMorning();
    return true;
  }

  toJSON() {
    return { ...super.toJSON(), owner: this.owner };
  }
}

// ------------------------------------------------------------
// Bancada de trabalho: perto dela liberam receitas melhores.
// Interagir abre direto a tela de crafting.
// ------------------------------------------------------------
const PLANK_MAT = new THREE.MeshLambertMaterial({ color: '#8a6438' });
const PLANK_DARK = new THREE.MeshLambertMaterial({ color: '#5e4226' });
const TOOL_MAT = new THREE.MeshLambertMaterial({ color: '#6c6e74' });

export class Workbench extends Structure {
  constructor(world, position, rotY, id) {
    super(world, 'bancada', position, rotY, id);
    this.interactRadius = 1.6;
    this.interactPoint = position.clone().add(new THREE.Vector3(0, 0.9, 0));
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.12, 0.9), PLANK_MAT);
    top.position.y = 0.92;
    top.castShadow = true;
    this.root.add(top);
    // tábuas do tampo
    for (let i = -2; i <= 2; i++) {
      const line = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.005, 0.88), PLANK_DARK);
      line.position.set(i * 0.38, 0.985, 0);
      this.root.add(line);
    }
    for (const [x, z] of [[-0.85, -0.36], [0.85, -0.36], [-0.85, 0.36], [0.85, 0.36]]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.9, 0.12), PLANK_DARK);
      leg.position.set(x, 0.45, z);
      leg.castShadow = true;
      this.root.add(leg);
    }
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.06, 0.7), PLANK_MAT);
    shelf.position.y = 0.3;
    this.root.add(shelf);
    // pedra de amolar, toras e uma ferramenta em cima
    const whet = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.06, 12), TOOL_MAT);
    whet.rotation.x = Math.PI / 2;
    whet.position.set(0.55, 1.15, 0.05);
    const hammer = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.05), PLANK_DARK);
    hammer.position.set(-0.4, 1.0, 0.15);
    hammer.rotation.y = 0.4;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.09, 0.16), TOOL_MAT);
    head.position.set(-0.18, 1.02, 0.25);
    head.rotation.y = 0.4;
    const logs = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.8, 8), PLANK_DARK);
    logs.rotation.z = Math.PI / 2;
    logs.position.set(0, 0.42, 0.1);
    this.root.add(whet, hammer, head, logs);
  }

  promptText() {
    return 'Usar bancada (criar)';
  }

  use() {
    events.emit(EV.OPEN_CRAFTING, { station: this });
    return false;
  }
}

export function createStructure(world, d) {
  if (d.type === 'bancada') return new Workbench(world, new THREE.Vector3(d.x, d.y, d.z), d.rot, d.id);
  const pos = new THREE.Vector3(d.x, d.y, d.z);
  if (d.type === 'fogueira') {
    const s = new Campfire(world, pos, d.rot, d.id);
    if (d.fuel) s.fuel = d.fuel;
    return s;
  }
  if (d.type === 'saco_dormir') return new SleepingBag(world, pos, d.rot, d.id, d.owner);
  return null;
}

