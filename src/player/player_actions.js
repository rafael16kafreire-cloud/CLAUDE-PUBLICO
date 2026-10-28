// =============================================================
// AÇÕES DO JOGADOR – bater, coletar, colher e comer
// - Bater (Atacar): acerta criatura > carcaça > planta/pedra na
//   frente. O que sai depende da ferramenta (recursos.json).
// - Colher (Interagir): bagas, bananas, fibra.
// - Comer/usar: itens de comida da barra rápida.
// =============================================================
import { BALANCE } from '../core/balance.js';
import { events, EV } from '../core/event_bus.js';
import { ITEMS, itemName } from '../items/items.js';
import { shakeAt } from '../world/materials.js';
import * as THREE from 'three';
import { sound } from '../audio/audio.js';
import { snapPiece } from '../world/building.js';

const FIST = { tipo: 'mao', dano: null, alcance: null, intervalo: null };
const INTERVAL = { mao: 0.45, machado: 0.6, picareta: 0.6, lanca: 0.7, clava: 0.62, tocha: 0.5, arco: 0.9, pistola: 1.1 };
const ARROWS = ['flecha_pedra', 'flecha_tranq', 'flecha_obsidiana'];

function rnd([a, b]) {
  return a + Math.floor(Math.random() * (b - a + 1));
}

export class PlayerActions {
  constructor(player, world, inventory) {
    this.player = player;
    this.world = world;
    this.inv = inventory;
  }

  // Ferramenta em uso (ou mãos vazias).
  get tool() {
    const s = this.inv.equipped;
    const f = s && ITEMS[s.id]?.ferramenta;
    const C = BALANCE.combate;
    if (!f) return { ...FIST, dano: C.soco_dano, alcance: C.soco_alcance_m, intervalo: C.soco_intervalo_seg };
    return { tipo: f.tipo, dano: f.dano, alcance: f.projetil ? f.alcance : f.alcance * 0.75, intervalo: INTERVAL[f.tipo] ?? 0.6, id: s.id, rende: f.rende ?? 1, projetil: !!f.projetil };
  }

  // Munições que a arma na mão usa (arco: flechas; pistola: balas).
  get ammoList() {
    const s = this.inv.equipped;
    return ITEMS[s?.id]?.ferramenta?.municoes ?? ARROWS;
  }

  // Munição que a arma vai usar: a escolhida (se tiver) ou a que tiver.
  get arrowType() {
    const list = this.ammoList;
    if (this.ammo && list.includes(this.ammo) && this.inv.count(this.ammo) > 0) return this.ammo;
    return list.find((a) => this.inv.count(a) > 0) ?? null;
  }

  // Troca a munição (Flecha de Pedra, Tranquilizante, Obsidiana...).
  cycleArrow() {
    const have = this.ammoList.filter((a) => this.inv.count(a) > 0);
    if (!have.length) {
      events.emit(EV.MESSAGE, { text: `Sem munição. Crie ${itemName(this.ammoList[0])}.`, kind: 'warn' });
      return null;
    }
    const cur = this.arrowType;
    this.ammo = have[(have.indexOf(cur) + 1) % have.length];
    events.emit(EV.MESSAGE, { text: `${itemName(this.inv.equipped?.id ?? 'arco')}: ${itemName(this.ammo)} (${this.inv.count(this.ammo)})`, kind: 'info' });
    return this.ammo;
  }

  // Atira (flecha ou bala) para onde a câmera olha. Devolve false se não tiver munição.
  shootArrow(cam) {
    const type = this.arrowType;
    if (!type) {
      events.emit(EV.MESSAGE, { text: `Sem munição! Crie ${itemName(this.ammoList[0])} (Inventário → Criar).`, kind: 'warn' });
      return false;
    }
    this.inv.remove(type, 1);
    const origin = cam.camera.position.clone().addScaledVector(cam.forward, 0.6);
    origin.y -= 0.08;
    const dir = cam.forward.clone().normalize();
    this.world.projectiles.fire(origin, dir, ITEMS[type].municao, this.player, this.player.stats.damageMul);
    if (ITEMS[type].municao.bala) {
      sound.play('tiro');
      this.world.effects?.burst(origin.clone().addScaledVector(dir, 0.4), 'fumaca', 4, 1.2);
    } else sound.play('golpe');
    this._wear();
    return true;
  }

  // Item de comer/usar selecionado na barra?
  get selectedIsConsumable() {
    const s = this.inv.equipped;
    return !!(s && (ITEMS[s.id]?.comida || ITEMS[s.id]?.cantil));
  }

  // Peso: até o máximo anda normal; acima anda devagar; muito acima, para.
  // Quanto a carga atrapalha o andar (como no ARK): até metade da carga máxima não
  // pesa nada; daí até a carga máxima vai caindo de 100% para 75% da velocidade;
  // passou da carga máxima cai rápido até ~20% (a 150%) e acima disso não anda.
  weightFactor() {
    const r = this.inv.weight() / this.player.stats.maxWeight;
    if (r <= 0.5) return 1;
    if (r <= 1) return 1 - (r - 0.5) * 0.5;
    if (r <= 1.5) return 0.75 - (r - 1) * 1.1;
    return 0;
  }

  // Passou da carga máxima: não dá para correr.
  overloaded() {
    return this.inv.weight() > this.player.stats.maxWeight;
  }

  // ---------------------------------------------------------
  // Momento do golpe
  // ---------------------------------------------------------
  onSwingHit(forward) {
    const p = this.player;
    const t = this.tool;
    const creatures = this.world.creatures;
    // 1) criatura viva
    const hit = creatures?.playerAttack(p, forward, t.dano * p.stats.damageMul, t.alcance);
    if (hit) {
      p.onImpact?.(0.8);
      // soco e clava dão sono (torpor): dá para desmaiar e domar
      const T = BALANCE.domar.torpor_por_dano;
      hit.addTorpor?.(t.dano * p.stats.damageMul * (T[t.tipo] ?? T.outro), p);
      this.world.effects.burst(hit.center(), 'sangue', 6, 2.5);
      sound.play('carne', hit.center());
      this._wear();
      return;
    }
    // 2) carcaça: tirar carne, couro e ossos
    const corpse = creatures?.findCorpse(p.position, forward, t.alcance + 0.5);
    if (corpse) {
      p.onImpact?.(0.6);
      const got = creatures.harvestCorpse(corpse, t.tipo);
      this._give(got);
      this.world.effects.burst(corpse.center(), 'sangue', 5, 2);
      sound.play('carne', corpse.center());
      this._wear();
      return;
    }
    // 3) planta, tronco ou pedra
    const veg = this.world.vegetation;
    const rec = veg.findTarget(p.position.x, p.position.z, forward.x, forward.z, t.alcance, false, p.position.y);
    if (rec) {
      p.onImpact?.(0.6);
      this.harvest(rec, t.tipo);
    }
  }

  // Soco em árvore: tira uma fração da vida máxima, com um pouco de sangue na
  // mão, e afunda a casca no lugar do golpe.
  _punchHurt(frac, rec) {
    const hurt = this.player.stats.max.health * frac;
    this.player.stats.damage(hurt, 'arvore');
    events.emit(EV.PLAYER_HURT, { amount: hurt, source: 'árvore' });
    const pp = this.player.position;
    this.world.effects.burst(new THREE.Vector3(pp.x + (rec.x - pp.x) * 0.75, pp.y + 1.1, pp.z + (rec.z - pp.z) * 0.75), 'sangue', 5, 1.1);
    if (rec.r) this.world.effects.gouge(rec.x, rec.z, rec.r * 0.8, pp.y + 1.25, pp);
  }

  // Coleta de uma planta/pedra com o modo dado (mao, machado, colher...).
  harvest(rec, mode) {
    const veg = this.world.vegetation;
    const res = veg.resourceOf(rec);
    if (!res) return false;
    // árvore gigante: só com machado; com a mão (ou outra coisa) machuca
    if (res.so_machado && mode !== 'machado' && mode !== 'colher') {
      if (mode === 'mao') {
        this._punchHurt(BALANCE.combate.soco_arvore_dura_vida, rec);
      }
      events.emit(EV.MESSAGE, { text: `Ai! ${res.nome} é dura demais: precisa de um machado.`, kind: 'warn' });
      const pp = this.player.position;
      this.world.effects.burst(new THREE.Vector3(pp.x + (rec.x - pp.x) * 0.7, pp.y + 1.2, pp.z + (rec.z - pp.z) * 0.7), 'madeira', 3, 1.5);
      sound.play('madeira', new THREE.Vector3(rec.x, this.player.position.y + 1.2, rec.z), { volume: 0.6 });
      shakeAt(rec.x, rec.z, 0.4);
      return false;
    }
    // pedra grande: com a mão não sai nada (pedra vem das pedrinhas do chão)
    if (res.so_ferramenta && (mode === 'mao' || mode === 'colher')) {
      if (mode === 'mao') events.emit(EV.MESSAGE, { text: `${res.nome}: precisa de picareta ou machado. Pegue pedrinhas no chão.`, kind: 'warn' });
      sound.play('pedra', new THREE.Vector3(rec.x, this.player.position.y + 1, rec.z), { volume: 0.5 });
      return false;
    }
    // árvore fina: dá para socar e ganhar madeira e palha, mas machuca um pouco
    if (res.soco_dano && mode === 'mao') this._punchHurt(res.soco_dano, rec);
    const table = res[mode] ?? res.mao;
    if (!table) return false;
    const got = {};
    for (const [id, range] of Object.entries(table)) {
      let n = rnd(range);
      // ferramentas melhores rendem mais
      const tool = this.tool;
      if (tool.tipo === mode && tool.rende > 1) n = Math.round(n * tool.rende);
      if (n > 0) got[id] = n;
    }
    this._give(got);
    this.player.stats.addXP(res.xp ?? 1);
    veg.consume(rec);
    if (mode !== 'colher') this._wear();
    // coleta tem um tempinho até a próxima (e animação de pegar)
    const C = BALANCE.coleta;
    const wait = mode === 'colher' ? C.intervalo_colher_seg : C.intervalo_bater_seg;
    this.player._attackTimer = Math.max(this.player._attackTimer ?? 0, wait);
    this.harvestCooldown = wait;
    this.player.model?.gather?.();
    if (mode === 'colher') this.player.onGather?.();
    // efeito visual
    // efeito = tipo de pedacinho (recursos.json); rochas soltam pó de pedra
    const kind = res.efeito ?? (res.key === 'pedra' ? 'pedra' : ['arvore', 'arvore_mole', 'arvore_gigante', 'tronco', 'palmeira'].includes(res.key) ? 'madeira' : 'folha');
    const fx = this.player.position.clone();
    fx.x += (rec.x - fx.x) * 0.8;
    fx.z += (rec.z - fx.z) * 0.8;
    fx.y = this.player.position.y + 1.2;
    this.world.effects.burst(fx, kind, kind === 'folha' ? 10 : 8, 2.6);
    sound.play(kind === 'folha' ? 'folhas' : kind === 'madeira' ? 'madeira' : 'pedra', fx);
    if (kind === 'madeira') {
      this.world.effects.burst(fx.clone().setY(fx.y + 3), 'folha', 6, 1.5);
      // marca de corte na casca, do lado de quem bateu
      if (['arvore', 'arvore_mole', 'arvore_gigante', 'palmeira'].includes(res.key) && rec.r) {
        this.world.effects.gouge(rec.x, rec.z, rec.r * 0.8, this.player.position.y + 1.25, this.player.position);
      }
      shakeAt(rec.x, rec.z, 1);
    } else if (kind === 'folha') {
      shakeAt(rec.x, rec.z, 2);
    }
    return true;
  }

  // Colher (botão Interagir) a planta mais perto na frente.
  findHarvestable(forward) {
    const p = this.player.position;
    return this.world.vegetation.findTarget(p.x, p.z, forward.x, forward.z, 2.4, true, p.y);
  }

  colher(rec) {
    return this.harvest(rec, 'colher');
  }

  _give(got) {
    for (const [id, n] of Object.entries(got)) {
      const added = this.inv.add(id, n);
      if (added > 0) events.emit(EV.ITEM_GAINED, { id, amount: added });
      if (added < n) events.emit(EV.MESSAGE, { text: 'Inventário cheio!', kind: 'warn' });
    }
  }

  _wear() {
    const broke = this.inv.wear(1);
    if (broke) events.emit(EV.MESSAGE, { text: `${broke} quebrou!`, kind: 'warn' });
  }

  // ---------------------------------------------------------
  // Comer / usar
  // ---------------------------------------------------------
  useSlot(i) {
    const s = this.inv.slots[i];
    if (!s) return false;
    const def = ITEMS[s.id];
    // cantil: bebe um gole da água guardada
    if (def?.cantil) {
      const st = this.player.stats;
      if ((s.agua ?? 0) < 1) {
        events.emit(EV.MESSAGE, { text: 'Cantil vazio. Encha olhando para água doce (Interagir).', kind: 'warn' });
        return false;
      }
      const got = st.drink(Math.min(def.cantil.gole, s.agua));
      if (got < 0.5) {
        events.emit(EV.MESSAGE, { text: 'Você não está com sede.', kind: 'info' });
        return false;
      }
      s.agua -= got;
      sound.play('beber');
      events.emit(EV.MESSAGE, { text: `+${Math.round(got)} Sede (cantil: ${Math.round(s.agua)})`, kind: 'gain' });
      events.emit(EV.INVENTORY_CHANGED, { inventory: this.inv });
      return true;
    }
    const c = def?.comida;
    if (!c) return false;
    const st = this.player.stats;
    // fome cheia (100%): só come se a vida estiver baixa (abaixo de 80%)
    const S = BALANCE.sobrevivencia;
    const full = st.food >= st.max.food - 0.5;
    const hurt = st.health < st.max.health * S.vida_comer_cheio;
    const needWater = c.sede > 0 && st.max.water - st.water >= c.sede * S.satisfeito;
    if (c.fome > 0 && full && !hurt && !needWater) {
      events.emit(EV.MESSAGE, { text: 'Você está cheio: só come de novo com fome (ou com a vida abaixo de 80%).', kind: 'info' });
      return false;
    }
    st.food = Math.min(st.max.food, st.food + (c.fome ?? 0));
    st.water = Math.min(st.max.water, st.water + (c.sede ?? 0));
    st.stamina = Math.max(0, Math.min(st.max.stamina, st.stamina + (c.stamina ?? 0)));
    if (c.vida > 0) st.health = Math.min(st.max.health, st.health + c.vida);
    if (c.vida < 0) st.damage(-c.vida, 'comida');
    this.inv.takeFrom(i, 1);
    events.emit(EV.ATE, { id: s.id });
    const verb = def.tipo === 'consumivel' ? 'Usou' : 'Comeu';
    events.emit(EV.MESSAGE, { text: `${verb}: ${itemName(s.id)}`, kind: 'info' });
    if (s.id === 'baga_escura') events.emit(EV.MESSAGE, { text: 'Você ficou sonolento…', kind: 'warn' });
    return true;
  }

  // Coloca uma estrutura (fogueira, saco de dormir) na frente do jogador.
  place(i) {
    const s = this.inv.slots[i];
    const type = s && ITEMS[s.id]?.colocavel;
    if (!type) return false;
    const p = this.player;
    const f = this.forward ?? { x: -Math.sin(p.facing), z: -Math.cos(p.facing) };
    const len = Math.hypot(f.x, f.z) || 1;
    const x = p.position.x + (f.x / len) * 2;
    const z = p.position.z + (f.z / len) * 2;
    const w = this.world;
    if (w.waterAt(x, z) || p.swimming) {
      events.emit(EV.MESSAGE, { text: 'Não dá para colocar na água.', kind: 'warn' });
      return false;
    }
    const n = w.map.normalAt(x, z, new THREE.Vector3());
    if (n.y < 0.8) {
      events.emit(EV.MESSAGE, { text: 'Chão muito inclinado aqui.', kind: 'warn' });
      return false;
    }
    const st = w.addStructure({ type, x, y: w.heightAt(x, z), z, rot: Math.atan2(f.x, f.z), owner: p.name ?? '' });
    if (!st) return false;
    this.inv.takeFrom(i, 1);
    events.emit(EV.MESSAGE, { text: `Pronto: ${ITEMS[s.id].nome} no chão.`, kind: 'gain' });
    events.emit(EV.PLACED, { type, structure: st });
    return true;
  }

  // ---------------------------------------------------------
  // Construção
  // ---------------------------------------------------------
  get selectedPiece() {
    const s = this.inv.equipped;
    return (s && ITEMS[s.id]?.peca) || null;
  }

  // Onde a peça selecionada vai ficar agora (para o fantasma e para colocar).
  buildPlacement(camYaw) {
    const type = this.selectedPiece;
    if (!type) return null;
    const p = this.player;
    const f = this.forward ?? { x: -Math.sin(p.facing), z: -Math.cos(p.facing) };
    const len = Math.hypot(f.x, f.z) || 1;
    const dist = type.startsWith('piso') ? 3.4 : 2.6;
    const aim = { x: p.position.x + (f.x / len) * dist, z: p.position.z + (f.z / len) * dist };
    return { type, ...snapPiece(this.world, type, p, aim, camYaw ?? p.facing) };
  }

  placeBuild(camYaw) {
    const pl = this.buildPlacement(camYaw);
    if (!pl) return false;
    if (!pl.ok) {
      events.emit(EV.MESSAGE, { text: pl.why || 'Não dá para colocar aqui.', kind: 'warn' });
      return false;
    }
    const st = this.world.addStructure({ type: pl.type, x: pl.x, y: pl.y, z: pl.z, rot: pl.rot });
    if (!st) return false;
    this.inv.takeFrom(this.inv.selected, 1);
    events.emit(EV.PLACED, { type: pl.type, structure: st });
    return true;
  }

  useSelected() {
    if (this.inv.selected < 0) return false;
    return this.useSlot(this.inv.selected);
  }

  // Toque num espaço da barra rápida: comida = come; ferramenta = equipa/guarda.
  pressHotbar(i) {
    const s = this.inv.slots[i];
    if (!s) {
      this.inv.selected = -1;
      events.emit(EV.INVENTORY_CHANGED, { inventory: this.inv });
      return;
    }
    if (ITEMS[s.id]?.comida) {
      this.useSlot(i);
      return;
    }
    if (ITEMS[s.id]?.colocavel) {
      this.place(i);
      return;
    }
    // peça de construção: segura na mão (aparece o fantasma); Atacar coloca
    this.inv.selected = this.inv.selected === i ? -1 : i;
    events.emit(EV.INVENTORY_CHANGED, { inventory: this.inv });
  }
}
