// =============================================================
// CO-OP ONLINE (até 4 jogadores)
//
// Como funciona (simples):
//  - Quem CRIA a partida é o "anfitrião". Ele recebe um código de
//    6 letras. Os amigos digitam o código e entram.
//  - Um servidor público e gratuito (PeerJS) só ajuda os celulares a
//    se acharem; depois a conversa é direta entre eles (WebRTC).
//  - O anfitrião manda nos animais e na hora do dia. Cada jogador
//    manda a própria posição; árvores coletadas, fogueiras e sacos
//    de dormir aparecem para todos.
//  - Se o anfitrião sair, quem ficou continua jogando sozinho.
//
// Mensagens (campo "t"):
//   hello  convidado -> anfitrião   { name }
//   welcome anfitrião -> convidado  { id, players, time, day, structures, spawn }
//   p      posição de um jogador    { id, x, y, z, f, sp, cr, sw, dead, sg }
//   join/leave                       { id, name }
//   c      criaturas (anfitrião)     { list }
//   hit    convidado bateu           { nid, dmg }
//   dmg    anfitrião -> convidado    { amount, source }
//   kill   anfitrião -> convidado    { xp, nome, dieta }
//   loot / loot-r                    carcaça: pedido / itens
//   veg    planta coletada           { rec }
//   st+    estrutura nova            { data }
//   st     estado de estrutura       { id, fuel }
//   time   hora do dia (anfitrião)   { time, day }
// =============================================================
import { Peer } from 'peerjs';
import { events, EV } from '../core/event_bus.js';
import { RemotePlayer } from './remote_player.js';

const PREFIX = 'ilhaprimordial-';
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem O/0, I/1
const MAX_PLAYERS = 4;

function makeCode() {
  let c = '';
  for (let i = 0; i < 6; i++) c += LETTERS[Math.floor(Math.random() * LETTERS.length)];
  return c;
}

// Servidor de conexão. Padrão: o público do PeerJS.
// Para testes: ?servidor=localhost:9000 na URL.
function serverOptions() {
  let custom = null;
  try {
    custom = new URLSearchParams(location.search).get('servidor') || localStorage.getItem('ilha-primordial:servidor');
  } catch {
    /* ok */
  }
  if (!custom) return { debug: 0 };
  const [host, port] = custom.split(':');
  return { host, port: Number(port) || 9000, path: '/', secure: false, debug: 0, config: { iceServers: [] } };
}

export class Multiplayer {
  constructor({ world, player, creatures, inventory, actions, camCtl }) {
    this.world = world;
    this.player = player;
    this.creatures = creatures;
    this.inventory = inventory;
    this.actions = actions;
    this.camCtl = camCtl;
    this.peer = null;
    this.isHost = false;
    this.active = false;
    this.code = '';
    this.name = 'Jogador';
    this.myId = '';
    this.conns = new Map();   // peerId -> DataConnection (anfitrião: todos; convidado: só o anfitrião)
    this.remotes = new Map(); // id -> RemotePlayer
    this.names = new Map();   // id -> nome
    this._sendT = 0;
    this._creT = 0;
    this._timeT = 0;
    this._swung = false;
    this._colors = 0;

    // eventos locais que os outros precisam saber
    events.on(EV.PLACED, ({ structure }) => this.active && this._broadcast({ t: 'st+', data: structure.toJSON() }));
    events.on(EV.STRUCTURE_USED, ({ structure }) => this.active && structure.type === 'fogueira'
      && this._broadcast({ t: 'st', id: structure.id, fuel: structure.fuel }));
    events.on(EV.VEG_CONSUMED, ({ rec, remote }) => this.active && !remote && this._broadcast({ t: 'veg', rec: rec.id }));
  }

  get playerCount() {
    return this.remotes.size + 1;
  }

  get playerNames() {
    return [this.name, ...[...this.remotes.values()].map((r) => r.name)];
  }

  // ---------------------------------------------------------
  // Criar partida (anfitrião)
  // ---------------------------------------------------------
  host(name) {
    this.name = name || 'Anfitrião';
    return new Promise((resolve, reject) => {
      const tryOpen = (attempt) => {
        const code = makeCode();
        const peer = new Peer(PREFIX + code, serverOptions());
        const fail = (err) => {
          peer.destroy();
          if (err?.type === 'unavailable-id' && attempt < 3) tryOpen(attempt + 1);
          else reject(err);
        };
        peer.once('error', fail);
        peer.once('open', (id) => {
          peer.off('error', fail);
          this.peer = peer;
          this.isHost = true;
          this.active = true;
          this.code = code;
          this.myId = id;
          this.world.multiplayer = this;
          this.creatures.net = this;
          peer.on('connection', (conn) => this._onIncoming(conn));
          peer.on('error', (err) => console.warn('[coop]', err?.type, err?.message));
          peer.on('disconnected', () => peer.reconnect?.());
          events.emit(EV.NET, { status: 'hosting', code });
          resolve(code);
        });
      };
      tryOpen(0);
    });
  }

  _onIncoming(conn) {
    conn.on('open', () => {
      if (this.conns.size + 1 >= MAX_PLAYERS) {
        conn.send({ t: 'full' });
        setTimeout(() => conn.close(), 300);
        return;
      }
      this.conns.set(conn.peer, conn);
    });
    conn.on('data', (m) => this._onData(conn, m));
    conn.on('close', () => this._dropPeer(conn.peer));
    conn.on('error', () => this._dropPeer(conn.peer));
  }

  // ---------------------------------------------------------
  // Entrar com código (convidado)
  // ---------------------------------------------------------
  join(code, name) {
    this.name = name || 'Convidado';
    code = (code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    return new Promise((resolve, reject) => {
      const peer = new Peer(serverOptions());
      let done = false;
      const fail = (err) => {
        if (done) return;
        done = true;
        peer.destroy();
        reject(err);
      };
      const timer = setTimeout(() => fail({ type: 'timeout' }), 20000);
      peer.once('error', fail);
      peer.once('open', (id) => {
        this.myId = id;
        const conn = peer.connect(PREFIX + code, { reliable: true, serialization: 'json' });
        conn.on('open', () => conn.send({ t: 'hello', name: this.name }));
        conn.on('data', (m) => {
          if (m.t === 'full') {
            clearTimeout(timer);
            fail({ type: 'full' });
            return;
          }
          if (m.t === 'welcome' && !done) {
            done = true;
            clearTimeout(timer);
            peer.off('error', fail);
            this.peer = peer;
            this.isHost = false;
            this.active = true;
            this.code = code;
            this.conns.set(conn.peer, conn);
            this.world.multiplayer = this;
            this.creatures.net = this;
            this.creatures.netClient = true;
            this.creatures.clear();
            this._applyWelcome(m);
            events.emit(EV.NET, { status: 'joined', code });
            resolve(m);
            return;
          }
          this._onData(conn, m);
        });
        conn.on('close', () => this._hostGone());
        conn.on('error', () => this._hostGone());
      });
    });
  }

  _applyWelcome(m) {
    const w = this.world;
    w.time = m.time;
    w.day = m.day;
    for (const st of m.structures ?? []) w.addStructure(st);
    for (const id of m.veg ?? []) {
      const rec = w.vegetation.recs[id];
      if (rec) w.vegetation.consumeAll?.(rec);
    }
    for (const p of m.players ?? []) this._addRemote(p.id, p.name);
    this.welcomeSpawn = m.spawn;
  }

  // ---------------------------------------------------------
  // Mensagens recebidas
  // ---------------------------------------------------------
  _onData(conn, m) {
    if (!m || typeof m !== 'object') return;
    const from = conn.peer;
    switch (m.t) {
      case 'hello': {
        if (!this.isHost) return;
        const name = String(m.name || 'Convidado').slice(0, 16);
        const others = [{ id: this.myId, name: this.name }, ...[...this.remotes.values()].map((r) => ({ id: r.peerId, name: r.name }))];
        const p = this.player.position;
        conn.send({
          t: 'welcome',
          id: from,
          players: others,
          time: this.world.time,
          day: this.world.day,
          structures: this.world.structures.map((s) => s.toJSON()),
          veg: this.world.vegetation.depleted.map((r) => r.id),
          spawn: { x: p.x + 2, y: p.y, z: p.z + 2, yaw: this.camCtl.yaw },
        });
        this._addRemote(from, name);
        this._broadcast({ t: 'join', id: from, name }, from);
        events.emit(EV.MESSAGE, { text: `${name} entrou na partida.`, kind: 'gain' });
        break;
      }
      case 'bye':
        if (!this.isHost) this._hostGone();
        break;
      case 'join':
        this._addRemote(m.id, m.name);
        events.emit(EV.MESSAGE, { text: `${m.name} entrou na partida.`, kind: 'gain' });
        break;
      case 'leave':
        this._removeRemote(m.id);
        break;
      case 'p': {
        const id = this.isHost ? from : m.id;
        if (id === this.myId) return;
        this.remotes.get(id)?.applyState(m);
        if (this.isHost) this._broadcast({ ...m, id: from }, from);
        break;
      }
      case 'c':
        if (!this.isHost) this.creatures.applySnapshot(m.list);
        break;
      case 'hit': {
        if (!this.isHost) return;
        const c = this.creatures.byNid(m.nid);
        const attacker = this.remotes.get(from);
        if (c && c.alive && attacker) c.takeDamage(Math.min(200, Number(m.dmg) || 0), attacker);
        break;
      }
      case 'dmg':
        if (!this.isHost && !this.player.dead) {
          this.player.stats.damage(m.amount, `criatura:${m.source}`);
          events.emit(EV.PLAYER_HURT, { amount: m.amount, source: m.source });
        }
        break;
      case 'kill':
        this.player.stats.addXP(m.xp);
        events.emit(EV.MESSAGE, { text: `${m.nome} abatido! +${m.xp} XP`, kind: 'gain' });
        events.emit(EV.CREATURE_KILLED, { creature: { species: { nome: m.nome, dieta: m.dieta } }, byPlayer: true });
        break;
      case 'loot': {
        if (!this.isHost) return;
        const c = this.creatures.byNid(m.nid);
        if (!c || c.alive || !c.lootLeft) return;
        const items = this.creatures.harvestCorpse(c, m.mode);
        conn.send({ t: 'loot-r', items });
        break;
      }
      case 'loot-r':
        this.actions._give(m.items ?? {});
        break;
      case 'veg': {
        const rec = this.world.vegetation.recs[m.rec];
        if (rec) this.world.vegetation.consume(rec, true);
        if (this.isHost) this._broadcast(m, from);
        break;
      }
      case 'st+':
        this.world.addStructure(m.data);
        if (this.isHost) this._broadcast(m, from);
        break;
      case 'st': {
        this.world.structureById(m.id)?.applyState?.(m);
        if (this.isHost) this._broadcast(m, from);
        break;
      }
      case 'time':
        if (!this.isHost) {
          // só corrige se estiver bem diferente (evita trancos)
          if (Math.abs(this.world.time - m.time) > 0.003 || this.world.day !== m.day) {
            this.world.time = m.time;
            this.world.day = m.day;
          }
        }
        break;
      default:
        break;
    }
  }

  _addRemote(id, name) {
    if (!id || id === this.myId || this.remotes.has(id)) return;
    const r = new RemotePlayer(this.world.scene, id, name, ++this._colors);
    this.remotes.set(id, r);
    this.names.set(id, name);
    this._syncRemoteList();
    events.emit(EV.NET, { status: 'players', count: this.playerCount });
  }

  _removeRemote(id) {
    const r = this.remotes.get(id);
    if (!r) return;
    r.remove();
    this.creatures.forgetTarget(r);
    this.remotes.delete(id);
    this._syncRemoteList();
    events.emit(EV.MESSAGE, { text: `${r.name} saiu da partida.`, kind: 'info' });
    events.emit(EV.NET, { status: 'players', count: this.playerCount });
  }

  _syncRemoteList() {
    this.creatures.remotePlayers = this.isHost ? [...this.remotes.values()] : [];
  }

  _dropPeer(id) {
    if (!this.conns.has(id)) return;
    this.conns.delete(id);
    if (this.isHost) {
      this._removeRemote(id);
      this._broadcast({ t: 'leave', id });
    }
  }

  _hostGone() {
    if (!this.active || this.isHost) return;
    events.emit(EV.MESSAGE, { text: 'Quem criou a partida saiu. Você continua jogando sozinho.', kind: 'warn' });
    this.leave(true);
  }

  // Sair do co-op (volta a jogar sozinho, no mesmo lugar).
  leave(silent = false) {
    if (!this.active) return;
    if (this.isHost) this._broadcast({ t: 'bye' });
    for (const c of this.conns.values()) {
      try {
        c.close();
      } catch {
        /* ok */
      }
    }
    this.conns.clear();
    for (const id of [...this.remotes.keys()]) {
      const r = this.remotes.get(id);
      r.remove();
      this.creatures.forgetTarget(r);
    }
    this.remotes.clear();
    this._syncRemoteList();
    if (!this.isHost) {
      this.creatures.netClient = false;
      this.creatures.clear();
    }
    this.creatures.net = null;
    this.world.multiplayer = null;
    try {
      this.peer?.destroy();
    } catch {
      /* ok */
    }
    this.peer = null;
    this.active = false;
    this.isHost = false;
    if (!silent) events.emit(EV.MESSAGE, { text: 'Você saiu do co-op.', kind: 'info' });
    events.emit(EV.NET, { status: 'offline' });
  }

  // ---------------------------------------------------------
  // Envio
  // ---------------------------------------------------------
  _broadcast(m, except) {
    for (const [id, c] of this.conns) {
      if (id === except || !c.open) continue;
      try {
        c.send(m);
      } catch {
        /* conexão caiu */
      }
    }
  }

  _toHost(m) {
    for (const c of this.conns.values()) if (c.open) c.send(m);
  }

  noteSwing() {
    this._swung = true;
  }

  sendHit(nid, dmg) {
    this._toHost({ t: 'hit', nid, dmg: Math.round(dmg) });
  }

  requestLoot(nid, mode) {
    this._toHost({ t: 'loot', nid, mode });
  }

  sendDamage(remote, amount, source) {
    const c = this.conns.get(remote.peerId);
    if (c?.open) c.send({ t: 'dmg', amount: Math.round(amount), source });
  }

  sendKill(remote, creature, xp) {
    const c = this.conns.get(remote.peerId);
    if (c?.open) c.send({ t: 'kill', xp, nome: creature.species.nome, dieta: creature.species.dieta });
  }

  // Chamado todo quadro.
  update(dt) {
    if (!this.active) return;
    for (const r of this.remotes.values()) r.update(dt);
    this._sendT -= dt;
    if (this._sendT <= 0) {
      this._sendT = 0.1; // 10x por segundo
      const p = this.player;
      const m = {
        t: 'p', id: this.myId,
        x: +p.position.x.toFixed(2), y: +p.position.y.toFixed(2), z: +p.position.z.toFixed(2),
        f: +this.camCtl.yaw.toFixed(3), sp: +Math.hypot(p.velocity.x, p.velocity.z).toFixed(2),
        cr: p.crouching ? 1 : 0, sw: p.swimming ? 1 : 0, dead: p.dead ? 1 : 0, sg: this._swung ? 1 : 0,
      };
      this._swung = false;
      if (this.isHost) this._broadcast(m);
      else this._toHost(m);
    }
    if (!this.isHost) return;
    // criaturas perto de cada convidado
    this._creT -= dt;
    if (this._creT <= 0) {
      this._creT = 0.15;
      for (const [id, c] of this.conns) {
        const r = this.remotes.get(id);
        if (!r || !c.open) continue;
        c.send({ t: 'c', list: this.creatures.snapshotNear(r.position) });
      }
    }
    this._timeT -= dt;
    if (this._timeT <= 0) {
      this._timeT = 3;
      this._broadcast({ t: 'time', time: this.world.time, day: this.world.day });
    }
  }
}
