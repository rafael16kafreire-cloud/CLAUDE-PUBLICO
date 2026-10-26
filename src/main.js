// =============================================================
// ILHA PRIMORDIAL – ponto de partida do jogo
// Cria o desenho 3D (renderer), o mundo, o jogador e as telas, e
// roda o "loop": a cada quadro atualiza tudo e desenha.
// =============================================================
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { events, EV } from './core/event_bus.js';
import { game, STATE } from './core/game_manager.js';
import { settings, QUALITY_PRESETS, hdTextures } from './core/settings.js';
import { input } from './core/input.js';
import { World } from './world/world.js';
import { Player } from './player/player.js';
import { PlayerCamera } from './player/player_camera.js';
import { PlayerInteraction } from './player/player_interaction.js';
import { Hud } from './ui/hud.js';
import { InspectPanel } from './ui/inspect_panel.js';
import { BuildGhost } from './world/building.js';
import { saddleFor } from './creatures/saddle.js';
import { itemName } from './items/items.js';
import { DamageNumbers } from './ui/damage_numbers.js';
import { loadGame, saveGame, clearSave, saveSlot, useSlot } from './core/save.js';
import { Messages } from './ui/messages.js';
import { TouchControls } from './ui/touch_controls.js';
import { DeathScreen } from './ui/death_screen.js';
import { Minimap } from './ui/minimap.js';
import { MapScreen } from './ui/map_screen.js';
import { DebugOverlay } from './ui/debug_overlay.js';
import { PauseMenu } from './ui/pause_menu.js';
import { StartScreen } from './ui/start_screen.js';
import { PlayerHands } from './player/player_hands.js';
import { CreatureManager, SPECIES } from './creatures/creature_manager.js';
import { Inventory } from './inventory/inventory.js';
import { Crafting } from './crafting/crafting.js';
import { PlayerActions } from './player/player_actions.js';
import { Hotbar } from './ui/hotbar.js';
import { InventoryScreen } from './ui/inventory_screen.js';
import { Multiplayer } from './net/multiplayer.js';
import { sound } from './audio/audio.js';

// Ponte com o app Android (existe só dentro do APK).
const androidApp = typeof window !== 'undefined' ? window.IlhaAndroid : undefined;

function detectTouch() {
  const mode = settings.get('touchControls');
  if (mode === 'sempre') return true;
  if (mode === 'nunca') return false;
  const coarse = window.matchMedia?.('(pointer: coarse)').matches;
  return !!coarse || (navigator.maxTouchPoints ?? 0) > 0;
}

// Mensagens para recursos que chegam nas próximas fases.
const COMING_SOON = {
  build: 'Construir: crie Piso, Parede, Porta, Teto ou Rampa (Inventário → Criar → Construção), selecione na barra e Atacar para colocar.',
};

function boot(hotData = {}) {
  const app = document.getElementById('app');

  // ---------- Renderer (desenho 3D) ----------
  const canvas = document.createElement('canvas');
  canvas.id = 'game';
  app.appendChild(canvas);
  // qualidade alta: bordas lisas (antialias) e sombra suave
  const high = hdTextures();
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: high,               // baixa/média: mais leve no celular
    powerPreference: 'high-performance',
  });
  renderer.info.autoReset = false; // zerado a cada quadro (veja o fim do loop)
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = high ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
  // Cores mais naturais (luz forte não "estoura").
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(72, 1, 0.08, 300);
  scene.add(camera); // as mãos em 1ª pessoa ficam presas na câmera
  game.renderer = renderer;
  game.camera = camera;

  // camada "embaixo d'água" (entre o 3D e os botões)
  const uwOverlay = document.createElement('div');
  uwOverlay.className = 'uw-overlay';
  app.appendChild(uwOverlay);

  const ui = document.createElement('div');
  ui.id = 'ui';
  app.appendChild(ui);

  input.attach(canvas);
  game.isTouch = detectTouch();
  document.body.classList.toggle('is-touch', game.isTouch);

  let ctx = null; // tudo do jogo, criado depois de gerar a ilha

  const start = new StartScreen(ui, {
    onPlay: () => play(),
    onLoadSlot: (n) => loadSlotAndRestart(n),
    onHost: (name) => hostCoop(name),
    onJoin: (code, name) => joinCoop(code, name),
    onNewGame: () => {
      clearSave();
      location.reload();
    },
    playerName: settings.get('playerName') || '',
  });
  start.setLoading('Gerando a ilha…');

  // SMAA: suaviza as bordas serrilhadas depois de desenhar a cena
  // (opção "Suavizar bordas"; desligado = desenha direto, mais leve)
  let composer = null;
  function setupSMAA() {
    const on = settings.get('smaa') !== false;
    if (!on) {
      composer?.dispose();
      composer = null;
      return;
    }
    if (!composer) {
      composer = new EffectComposer(renderer);
      composer.addPass(new RenderPass(scene, camera));
      composer.addPass(new SMAAPass(window.innerWidth, window.innerHeight));
      composer.addPass(new OutputPass());
    }
    composer.setPixelRatio(renderer.getPixelRatio());
    composer.setSize(window.innerWidth, window.innerHeight);
  }

  let baseFov = 70;
  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    composer?.setPixelRatio(renderer.getPixelRatio());
    composer?.setSize(w, h);
    camera.aspect = w / h;
    baseFov = w < h ? 82 : 70; // celular em pé: campo de visão maior
    camera.fov = baseFov;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  // ---------- Opções ----------
  function applySettings() {
    const q = settings.quality;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.pixelRatio));
    setupSMAA();
    resize();
    game.isTouch = detectTouch();
    document.body.classList.toggle('is-touch', game.isTouch);
    if (!ctx) return;
    ctx.world.setQuality(q);
    const vd = settings.get('viewDistance');
    ctx.world.setViewDistance(vd);
    camera.far = vd + 40;
    camera.updateProjectionMatrix();
    const inGame = [STATE.PLAYING, STATE.PAUSED, STATE.DEAD].includes(game.state);
    ctx.touch.setVisible((game.isTouch && inGame && !ctx.invScreen.visible) || ctx.touch.editing);
    ctx.touch.applySettings(settings.get('buttonOpacity'), settings.get('buttonSize'));
    if (!ctx.touch.editing) ctx.touch.applyLayout(settings.get('buttonLayout'));
    ctx.debug.setVisible(settings.get('showDebug'));
    ctx.camCtl.setMode(settings.get('cameraMode'));
  }
  events.on(EV.SETTINGS_CHANGED, applySettings);
  // texturas HD (qualidade alta) só trocam ao abrir o jogo de novo
  events.on(EV.SETTINGS_CHANGED, ({ key, value }) => {
    if (key !== 'quality' || !ctx) return;
    events.emit(EV.MESSAGE, { text: `Texturas em alta resolução ${value === 'alta' ? 'ligam' : 'desligam'} quando você abrir o jogo de novo.`, kind: 'info' });
  });

  // ---------- Criar o mundo (depois que a tela de carregando aparece) ----------
  function buildGame() {
    const world = new World(scene, renderer);
    const player = new Player(world, scene);
    const spawn = world.respawnPoint('sul');
    player.spawnAt(spawn);
    const camCtl = new PlayerCamera(camera, world);
    camCtl.yaw = spawn.yaw;
    // Inventário, coleta e crafting
    const inventory = new Inventory();
    const crafting = new Crafting(inventory, player.stats);
    // bancada, pilão ou forja a até 6 m liberam as receitas delas
    const STATIONS = ['bancada', 'pilao', 'forja'];
    crafting.stationsNear = () => world.structures
      .filter((st) => !st.removed && STATIONS.includes(st.type) && st.position.distanceTo(player.position) < 6)
      .map((st) => st.type);
    const actions = new PlayerActions(player, world, inventory);
    player.actions = actions;
    actions.forward = camCtl.forward;
    world.localPlayer = player;
    world.localInventory = inventory;
    const interaction = new PlayerInteraction(player, world, camCtl, actions, inventory);
    const hud = new Hud(ui, player, (action) => onCornerButton(action));
    const buildGhost = new BuildGhost(scene);
    const inspect = new InspectPanel(hud.el, () => creatures.findAimed(camera.position, camCtl.forward, 45));
    const messages = new Messages(ui);
    const touch = new TouchControls(ui, input);
    const death = new DeathScreen(ui, world);
    const minimap = new Minimap(hud.el, world);
    const mapScreen = new MapScreen(ui, world);
    // celular: tocar no minimapa abre o mapa
    minimap.el.addEventListener('click', () => mapScreen.toggle(player, camCtl.yaw));
    const debug = new DebugOverlay(ui, renderer);
    const creatures = new CreatureManager(world, scene);
    world.creatures = creatures;
    const hands = new PlayerHands(camera);
    player.onGather = () => hands.gather();
    player.onImpact = (k = 0.7) => camCtl.shake(k);
    player.onPunch = (kind) => {
      hands.swing(kind);
      camCtl.shake(kind === 'pistola' ? 0.9 : 0.3);
      if (kind !== 'arco' && kind !== 'pistola') {
        sound.play('esforco');
        sound.play('golpe');
      }
      ctx?.net.noteSwing();
    };
    const hotbar = new Hotbar(ui, inventory, (i) => actions.pressHotbar(i));
    const damageNumbers = new DamageNumbers(ui);
    const invScreen = new InventoryScreen(ui, {
      inventory,
      crafting,
      actions,
      stats: player.stats,
      onDrop: (stack) => dropStack(stack),
      onClose: () => closeInventory(),
    });
    const pause = new PauseMenu(ui, {
      onResume: () => resume(),
      onQuitToMenu: () => toMenu(),
      onCloseApp: androidApp?.exit ? () => androidApp.exit() : null,
      onSaveSlot: (n) => {
        const ok = saveSlot(n, gameSnapshot());
        events.emit(EV.MESSAGE, { text: ok ? `Jogo salvo no Espaço ${n}.` : 'Não deu para salvar (sem espaço no aparelho).', kind: ok ? 'gain' : 'warn' });
      },
      onLoadSlot: (n) => loadSlotAndRestart(n),
      // ajustar botões: esconde o menu, arrasta, Travar salva e volta ao menu
      onAdjustButtons: () => {
        ctx.pause.hide();
        ctx.touch.startEdit((layout) => {
          settings.set('buttonLayout', layout);
          ctx.pause.show();
        });
      },
      onLeaveCoop: () => {
        ctx.net.leave();
        ctx.pause.setCoop(null);
      },
    });
    game.world = world;
    game.player = player;
    ctx = {
      world, player, camCtl, interaction, hud, minimap, mapScreen, inspect, buildGhost, messages, touch, death, debug, pause, creatures, hands, damageNumbers,
      inventory, crafting, actions, hotbar, invScreen,
    };
    ctx.net = new Multiplayer({ world, player, creatures, inventory, actions, camCtl });

    // Jogo salvo no aparelho (se não veio de uma atualização da página)
    if (!hotData.player) {
      const saved = loadGame();
      if (saved) hotData = saved;
    }
    // Voltando de uma atualização da página (ou jogo salvo): restaura
    // posição, barras, itens, construções e bichos domados.
    if (hotData.player) {
      player.fromJSON(hotData.player);
      if (typeof hotData.yaw === 'number') camCtl.yaw = hotData.yaw;
      inventory.fromJSON(hotData.inventory);
      if (hotData.world) {
        world.time = hotData.world.time ?? world.time;
        world.day = hotData.world.day ?? world.day;
        for (const st of hotData.world.structures ?? []) world.addStructure(st);
      }
      for (const t of hotData.tamed ?? []) restoreTamed(t);
    }

    hud.setVisible(false);
    hotbar.setVisible(false);
    applySettings();
    // Prepara (compila) os gráficos agora, na tela de carregamento,
    // para o jogo não "engasgar" na primeira vez que vê cada coisa.
    try {
      renderer.compile(scene, camera);
    } catch (err) {
      console.warn('[Ilha] compile', err);
    }
    start.setReady(hotData.player ? 'Continuar' : 'Jogar', !!hotData.player);
    // veio de "Carregar" um espaço: entra direto no jogo
    try {
      if (sessionStorage.getItem('ilha-primordial:auto-continuar')) {
        sessionStorage.removeItem('ilha-primordial:auto-continuar');
        setTimeout(() => play(), 50);
      }
    } catch { /* ok */ }
    game.setState(STATE.MENU);
    console.info(`[Ilha] ilha gerada em ${world.generationMs} ms`, world.vegetation.countByType());
  }

  // ---------- Mudanças de estado ----------
  // ---------- Co-op ----------
  function coopError(err) {
    const t = err?.type;
    const msg = t === 'peer-unavailable' ? 'Partida não encontrada. Confira o código.'
      : t === 'full' ? 'Essa partida já tem 4 jogadores.'
        : t === 'timeout' ? 'Demorou demais para conectar. Tente de novo.'
          : t === 'network' || t === 'server-error' || t === 'socket-error' ? 'Sem conexão com a internet (ou servidor fora do ar).'
            : 'Não deu para conectar. Tente de novo.';
    start.setStatus(msg, 'erro');
    start.setCoopBusy(false);
  }

  function hostCoop(name) {
    if (!ctx) return;
    sound.unlock();
    settings.set('playerName', name);
    ctx.player.name = name;
    start.setCoopBusy(true);
    start.setStatus('Criando partida…');
    ctx.net.host(name).then((code) => {
      start.setStatus(`Partida criada: ${code}`, 'ok');
      play();
      events.emit(EV.MESSAGE, { text: `Código da partida: ${code} — passe para seus amigos (botão ❚❚ mostra de novo).`, kind: 'gain' });
    }).catch(coopError);
  }

  function joinCoop(code, name) {
    if (!ctx) return;
    sound.unlock();
    code = (code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (code.length !== 6) {
      start.setStatus('O código tem 6 letras/números.', 'erro');
      return;
    }
    settings.set('playerName', name);
    ctx.player.name = name;
    start.setCoopBusy(true);
    start.setStatus('Conectando…');
    ctx.net.join(code, name).then(() => {
      const sp = ctx.net.welcomeSpawn;
      if (sp) {
        ctx.player.position.set(sp.x, ctx.world.heightAt(sp.x, sp.z), sp.z);
        ctx.camCtl.yaw = sp.yaw;
      }
      start.setStatus('Conectado!', 'ok');
      play();
    }).catch(coopError);
  }

  events.on(EV.NET, () => {
    if (!ctx) return;
    const n = ctx.net;
    ctx.hud.setCoop(n.active ? n.code : null, n.playerCount);
  });

  function play() {
    if (!ctx) return;
    sound.unlock();
    sound.setPaused(false);
    start.hide();
    ctx.hud.setVisible(true);
    ctx.hotbar.setVisible(true);
    ctx.touch.setVisible(game.isTouch);
    game.setState(STATE.PLAYING);
    requestFullscreenLandscape();
    if (!game.isTouch) input.requestPointerLock();
    if (game.playTime < 1) {
      events.emit(EV.MESSAGE, { text: 'Bata nas árvores para pegar palha e madeira. Abaixado (agachar) os predadores te veem menos.', kind: 'info' });
      events.emit(EV.MESSAGE, { text: 'Água doce: o pântano fica no meio da ilha.', kind: 'info' });
      // Já começa com alguns animais por perto.
      if (!ctx.creatures.netClient) {
        for (let i = 0; i < 8; i++) ctx.creatures.trySpawnNear(ctx.player.position, 45, 110);
        for (let i = 0; i < 3; i++) ctx.creatures.trySpawnNear(ctx.player.position, 20, 60, true);
      }
    }
  }

  // Teste (menu de pausa): cria o dinossauro escolhido na frente do jogador.
  // Carregar um espaço: vira o salvo principal e o jogo recomeça dele.
  function loadSlotAndRestart(n) {
    if (!useSlot(n)) return;
    sessionStorage.setItem('ilha-primordial:auto-continuar', '1');
    window.location.reload();
  }

  function spawnInFront(id) {
    const sp = SPECIES[id];
    const f = ctx.camCtl.forward;
    const len = Math.hypot(f.x, f.z) || 1;
    const dist = 10 + sp.raio * 4;
    let x = ctx.player.position.x + (f.x / len) * dist;
    let z = ctx.player.position.z + (f.z / len) * dist;
    const c = ctx.creatures.spawn(id, x, z, 10);
    if (c && sp.temperamento !== 'passivo') {
      // fica parado olhando para o jogador alguns segundos
      c._setState('parado');
      c.idleFor = 6;
    }
    events.emit(EV.MESSAGE, { text: `${sp.nome} criado na sua frente.`, kind: 'info' });
    resume();
  }

  // ---------- Inventário ----------
  function openInventory() {
    if (game.state !== STATE.PLAYING || ctx.player.dead || ctx.invScreen.visible) return;
    input.clear();
    input.blocked = true;
    ctx.invScreen.show();
    ctx.touch.setVisible(false);
    document.body.classList.add('inv-open');
    input.exitPointerLock();
  }

  function closeInventory() {
    if (!ctx.invScreen.visible) return;
    ctx.invScreen.hide();
    input.blocked = false;
    input.clear();
    document.body.classList.remove('inv-open');
    ctx.touch.setVisible(game.isTouch && game.state === STATE.PLAYING);
    if (!game.isTouch && game.state === STATE.PLAYING) input.requestPointerLock();
  }

  // Largar itens: vira uma bolsa no chão na frente do jogador.
  function dropStack(stack) {
    const p = ctx.player.position;
    const f = ctx.camCtl.forward;
    const len = Math.hypot(f.x, f.z) || 1;
    const x = p.x + (f.x / len) * 1.4;
    const z = p.z + (f.z / len) * 1.4;
    const pos = new THREE.Vector3(x, Math.max(ctx.world.heightAt(x, z), p.y - 1.5), z);
    const body = ctx.world.waterAt(x, z);
    if (body) pos.y = Math.max(pos.y, body.level - 0.3);
    ctx.world.spawnDeathBag(pos, [stack], 'bolsa');
  }

  function pauseGame() {
    if (game.state !== STATE.PLAYING) return;
    autosave();
    closeInventory();
    game.setState(STATE.PAUSED);
    input.clear();
    input.exitPointerLock();
    ctx.pause.setCoop(ctx.net.active ? ctx.net.code : null, ctx.net.playerNames);
    ctx.pause.show();
    if (!ctx.net.active) sound.setPaused(true);
  }

  function resume() {
    if (game.state !== STATE.PAUSED) return;
    sound.setPaused(false);
    ctx.pause.hide();
    game.setState(STATE.PLAYING);
    if (!game.isTouch) input.requestPointerLock();
  }

  function toMenu() {
    if (ctx.net.active) ctx.net.leave();
    ctx.pause.hide();
    ctx.hud.setVisible(false);
    ctx.hotbar.setVisible(false);
    ctx.touch.setVisible(false);
    start.setReady('Continuar');
    start.show();
    game.setState(STATE.MENU);
  }

  // ---------- Jogo salvo ----------
  function tamedJSON(c) {
    return {
      id: c.species.id, level: c.level, seed: c.statSeed, sex: c.sex, x: +c.pos.x.toFixed(2), z: +c.pos.z.toFixed(2),
      yaw: +c.yaw.toFixed(2), follow: !!c.follow, growth: +c.growth.toFixed(3), age: Math.round(c.age),
      hp: Math.round(c.health), name: c.name ?? null, adult: +c.adultScale.toFixed(4), saddled: !!c.saddled,
      saddle: c.saddleKind ?? null, imprint: c.imprint ?? 0, st: c.inherited ? c.stats : null, mut: c.mutations ?? 0,
      gestation: c.gestation > 0 ? Math.round(c.gestation) : 0, unborn: c.unborn ?? null,
    };
  }

  function restoreTamed(t) {
    const c = ctx.creatures.spawn(t.id, t.x, t.z, t.level);
    if (!c) return;
    c.rollStats(t.seed);
    c.sex = t.sex ?? c.sex;
    c.imprint = t.imprint ?? 0;
    c.mutations = t.mut ?? 0;
    if (t.st) c.applyStats(t.st);
    if (t.gestation > 0) {
      c.gestation = t.gestation;
      c.unborn = t.unborn;
    }
    if (t.adult) c.adultScale = t.adult;
    c.age = t.age ?? 0;
    c.setGrowth(t.growth ?? 1);
    c.health = Math.min(c.maxHealth, t.hp ?? c.maxHealth);
    c.yaw = t.yaw ?? 0;
    c.tamed = true;
    c.owner = ctx.player;
    c.follow = t.follow;
    c.name = t.name ?? c.species.nome;
    c.home.set(c.pos.x, c.pos.z);
    if (t.saddled) c.setSaddle(t.saddle ?? saddleFor(c));
    c._setState('parado');
    c.idleFor = c.follow ? 0.5 : 1e9;
  }

  function gameSnapshot() {
    return {
      player: ctx.player.toJSON(),
      yaw: ctx.camCtl.yaw,
      inventory: ctx.inventory.toJSON(),
      world: { time: ctx.world.time, day: ctx.world.day, structures: ctx.world.structures.filter((st) => !st.removed).map((st) => st.toJSON()) },
      tamed: ctx.creatures.tamedBy(ctx.player).map(tamedJSON),
    };
  }

  // Salva (não no co-op como convidado: o mundo é do anfitrião).
  function autosave() {
    if (!ctx || game.state === STATE.MENU || game.playTime < 2 || ctx.creatures.netClient) return;
    saveGame(gameSnapshot());
  }
  setInterval(autosave, 30000);
  document.addEventListener('visibilitychange', () => document.hidden && autosave());
  window.addEventListener('pagehide', autosave);

  // Montar / descer do bicho domado mais perto.
  function toggleMount() {
    const p = ctx.player;
    if (p.riding) {
      p.dismount();
      return;
    }
    const c = ctx.creatures.findMountable(p, p.position, 5);
    if (c) p.mount(c);
    else if (ctx.creatures.tamedBy(p).length) {
      const near = ctx.creatures.tamedBy(p).find((o) => o.species.pode_montar && !o.flies && Math.hypot(o.pos.x - p.position.x, o.pos.z - p.position.z) - o.radius < 5);
      events.emit(EV.MESSAGE, {
        text: near && !near.saddled ? `Precisa de ${itemName(near.saddleNeed)}: crie no Inventário, segure na mão e use Interagir no bicho.` : 'Chegue perto de um bicho domado que dá para montar.',
        kind: 'info',
      });
    }
  }

  function onCornerButton(action) {
    if (action === 'pause') {
      if (game.state === STATE.PLAYING) pauseGame();
      else resume();
      return;
    }
    if (action === 'inspect') {
      if (game.state === STATE.PLAYING) ctx.inspect.toggle();
      return;
    }
    if (action === 'inventory') {
      if (ctx.invScreen.visible) closeInventory();
      else openInventory();
      return;
    }
    input.tap(action);
  }

  // Tela cheia + horizontal no celular (se o navegador deixar).
  function requestFullscreenLandscape() {
    if (!game.isTouch || androidApp) return;
    try {
      const el = document.documentElement;
      const p = el.requestFullscreen?.({ navigationUI: 'hide' });
      if (p && p.then) {
        p.then(() => screen.orientation?.lock?.('landscape').catch(() => {})).catch(() => {});
      }
    } catch {
      /* sem tela cheia: segue normal */
    }
  }

  events.on(EV.PLAYER_DIED, ({ cause, position }) => {
    closeInventory();
    game.setState(STATE.DEAD);
    // Tudo o que tinha vai para o saco de morte.
    ctx.crafting.cancelAll();
    ctx.world.spawnDeathBag(position, ctx.inventory.takeAll());
    input.exitPointerLock();
    input.runToggle = false;
    // primeiro o jogador cai (animação); depois aparece a tela de morte
    ctx.deathPending = { cause, position, t: 1.6 };
  });

  events.on(EV.RESPAWN_REQUESTED, ({ pointId }) => {
    ctx.deathPending = null;
    const point = ctx.world.respawnPoint(pointId);
    ctx.player.respawn(point);
    ctx.camCtl.yaw = point.yaw;
    ctx.camCtl.pitch = -0.12;
    ctx.death.hide();
    // Predadores esquecem o jogador que renasceu.
    for (const c of ctx.creatures.list) if (c.target === ctx.player) c.target = null;
    game.setState(STATE.PLAYING);
    if (!game.isTouch) input.requestPointerLock();
    events.emit(EV.MESSAGE, { text: `Você renasceu na ${point.name}.`, kind: 'info' });
    events.emit(EV.PLAYER_RESPAWNED, { pointId });
  });

  // Mouse solto com Esc no PC = pausa.
  document.addEventListener('pointerlockchange', () => {
    if (!document.pointerLockElement && game.state === STATE.PLAYING && !game.isTouch && !ctx?.invScreen.visible) pauseGame();
  });

  // App em segundo plano / aba escondida = pausa.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pauseGame();
  });

  // Botão "voltar" do Android: pausa / continua.
  window.__ilhaBack = () => {
    if (ctx?.invScreen.visible) closeInventory();
    else if (game.state === STATE.PLAYING) pauseGame();
    else if (game.state === STATE.PAUSED) resume();
  };

  // ---------- Ações globais (teclas/botões que não são do jogador) ----------
  function handleActions() {
    if (input.wasPressed('pause')) {
      // Evita pausar/despausar duas vezes quando o Esc também solta o mouse.
      const justUnlocked = performance.now() - input.lastUnlockTime < 300;
      if (ctx.mapScreen.visible) ctx.mapScreen.hide();
      else if (ctx.invScreen.visible) closeInventory();
      else if (game.state === STATE.PLAYING) pauseGame();
      else if (game.state === STATE.PAUSED && !justUnlocked) resume();
    }
    if (input.wasPressed('debug')) settings.set('showDebug', !settings.get('showDebug'));
    if (game.state !== STATE.PLAYING) return;
    if (input.wasPressed('inventory')) {
      if (ctx.invScreen.visible) closeInventory();
      else openInventory();
    }
    if (input.wasPressed('inspect')) ctx.inspect.toggle();
    if (input.wasPressed('map')) ctx.mapScreen.toggle(ctx.player, ctx.camCtl.yaw);
    if (input.wasPressed('ammo')) ctx.actions.cycleArrow(); // Q: troca a flecha do arco
    if (ctx.mapScreen.visible) ctx.mapScreen.update(ctx.player, ctx.camCtl.yaw);
    if (input.wasPressed('camera')) settings.set('cameraMode', ctx.camCtl.mode === 'primeira' ? 'terceira' : 'primeira');
    for (let i = 0; i < 8; i++) if (input.wasPressed(`slot${i + 1}`)) ctx.actions.pressHotbar(i);
    if (input.wasPressed('build')) events.emit(EV.MESSAGE, { text: COMING_SOON.build, kind: 'info' });
    if (input.wasPressed('mount')) toggleMount();
  }

  // ---------- Qualidade automática ----------
  // Se o aparelho ficar lento (menos de 22 quadros por segundo por
  // alguns segundos), baixa um nível de qualidade e avisa.
  const perf = { time: 0, frames: 0, warmup: 6 };
  function autoQuality(dt) {
    if (!settings.get('autoQuality') || game.state !== STATE.PLAYING) return;
    if (perf.warmup > 0) {
      perf.warmup -= dt;
      return;
    }
    perf.time += dt;
    perf.frames += 1;
    if (perf.time < 4) return;
    const fps = perf.frames / perf.time;
    perf.time = 0;
    perf.frames = 0;
    if (fps >= 22) return;
    const order = ['alta', 'media', 'baixa'];
    const i = order.indexOf(settings.get('quality'));
    if (i < 0 || i >= order.length - 1) return;
    const next = order[i + 1];
    settings.set('quality', next);
    settings.set('viewDistance', QUALITY_PRESETS[next].viewDistance);
    perf.warmup = 4;
    events.emit(EV.MESSAGE, {
      text: `Jogo lento (${Math.round(fps)} FPS): qualidade ajustada para ${next === 'baixa' ? 'Baixa' : 'Média'}. Dá para mudar no menu de pausa.`,
      kind: 'warn',
    });
  }

  // Interagir com a bancada abre o crafting.
  events.on(EV.OPEN_STORAGE, ({ box }) => {
    openInventory();
    ctx.invScreen.openBox(box);
  });
  events.on(EV.OPEN_CRAFTING, () => {
    openInventory();
    ctx.invScreen.showTab('craft');
  });

  // ---------- Sons: eventos do jogo ----------
  let lastPickup = 0;
  events.on(EV.ITEM_GAINED, () => {
    const now = performance.now();
    if (now - lastPickup > 120) sound.play('pegar');
    lastPickup = now;
  });
  events.on(EV.CRAFTED, () => sound.play('criar'));
  events.on(EV.ATE, () => sound.play('comer'));
  events.on(EV.WATER_DRUNK, () => sound.play('beber'));
  events.on(EV.PLAYER_HURT, () => sound.play('dor'));
  events.on(EV.PLAYER_DIED, () => sound.play('morte'));
  events.on(EV.LEVEL_UP, ({ level }) => {
    sound.play('nivel');
    // brilho dourado subindo em volta do jogador
    if (ctx) {
      const p0 = ctx.player.position;
      for (let i = 0; i < 3; i++) ctx.world.effects.burst(new THREE.Vector3(p0.x, p0.y + 0.4 + i * 0.5, p0.z), 'ouro', 10, 2.2);
      document.body.classList.remove('level-flash');
      void document.body.offsetWidth;
      document.body.classList.add('level-flash');
    }
    const ep = ctx?.player.stats.engramsForLevel(level) ?? 0;
    events.emit(EV.MESSAGE, { text: `Nível ${level}! +1 habilidade e +${ep} pontos de engrama (Inventário → Criar → Aprender)`, kind: 'gain' });
  });
  events.on(EV.PLACED, ({ structure }) => {
    sound.play('colocar', structure.position);
    // poeirinha ao assentar a peça
    ctx?.world.effects.burst(structure.position.clone().setY(structure.position.y + 0.2), 'poeira', 8, 2);
  });
  events.on(EV.STRUCTURE_USED, ({ structure }) => structure.type === 'fogueira' && sound.play('acender', structure.position));
  events.on(EV.SETTINGS_CHANGED, ({ key, value }) => {
    if (key === 'volume') sound.setVolume(value);
    if (key === 'music') sound.setMusicVolume(value);
  });
  sound.setVolume(settings.get('volume'));
  sound.setMusicVolume(settings.get('music'));
  // qualquer toque destrava o som (regra dos navegadores)
  window.addEventListener('pointerdown', () => sound.unlock(), { passive: true });
  window.addEventListener('keydown', () => sound.unlock());

  // Passos, pulo, queda e mergulho do jogador deste aparelho.
  const steps = { dist: 0, lastPos: null, ground: true, swim: false, vy: 0 };
  function updateFootsteps() {
    const p = ctx.player;
    if (!steps.lastPos) steps.lastPos = p.position.clone();
    const moved = Math.hypot(p.position.x - steps.lastPos.x, p.position.z - steps.lastPos.z);
    steps.lastPos.copy(p.position);
    if (p.dead || moved > 3) return; // teleporte: ignora
    if (p.onGround && !p.swimming) {
      steps.dist += moved;
      const stride = p.running ? 2.1 : p.crouching ? 1.1 : 1.6;
      if (steps.dist > stride) {
        steps.dist = 0;
        const b = ctx.world.biomeKeyAt(p.position.x, p.position.z);
        const wet = ctx.world.waterAt(p.position.x, p.position.z);
        sound.play('passo', null, { surface: wet ? 'agua' : b === 'praia' ? 'areia' : b === 'neve' ? 'neve' : 'mato', volume: p.crouching ? 0.4 : p.running ? 1.2 : 0.8 });
      }
    }
    if (steps.ground && !p.onGround && p.velocity.y > 2 && !p.swimming) sound.play('pulo');
    if (!steps.ground && p.onGround && steps.vy < -6) sound.play('queda');
    if (!steps.swim && p.swimming) sound.play('splash', p.position);
    steps.ground = p.onGround;
    steps.swim = p.swimming;
    steps.vy = p.velocity.y;
  }

  // ---------- Loop principal ----------
  let last = performance.now();
  let menuAngle = 0;
  let pausedSkip = 0;
  let targetTimer = 0;

  function frame(now) {
    requestAnimationFrame(frame);
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.1) dt = 0.1; // celular travou? não deixa o jogo "pular"
    if (dt <= 0) return;
    if (!ctx) return;

    handleActions();
    autoQuality(dt);
    const { world, player, camCtl, interaction, hud, minimap, inspect, buildGhost, touch, debug, creatures, hands, damageNumbers, crafting, invScreen, actions } = ctx;
    const look = input.consumeLook();
    const sens = settings.get('sensitivity');

    switch (game.state) {
      case STATE.PLAYING:
        game.playTime += dt;
        camCtl.applyLook(look, sens, player);
        player.update(dt, input, camCtl);
        camCtl.update(dt, player);
        interaction.update(dt, input);
        creatures.update(dt, player, camera);
        crafting.update(dt);
        ctx.inventory.update(dt);
        if (invScreen.visible) invScreen.tick();
        break;
      case STATE.DEAD:
        if (ctx.deathPending) {
          ctx.deathPending.t -= dt;
          if (ctx.deathPending.t <= 0) {
            ctx.death.show(ctx.deathPending.cause, ctx.deathPending.position);
            ctx.deathPending = null;
          }
        }
        camCtl.applyLook(look, sens, player);
        player.update(dt, input, camCtl);
        camCtl.update(dt, player);
        creatures.update(dt, player, camera);
        break;
      case STATE.PAUSED:
        // No co-op o mundo não para (os outros continuam jogando).
        if (ctx.net.active) {
          player.update(dt, input, camCtl);
          camCtl.update(dt, player);
          creatures.update(dt, player, camera);
          crafting.update(dt);
        }
        break;
      case STATE.MENU: {
        // Sobrevoo lento da ilha atrás da tela inicial
        // (perto o bastante para a neblina não esconder tudo).
        menuAngle += dt * 0.035;
        const mx = 60 + Math.sin(menuAngle) * 150;
        const mz = 40 + Math.cos(menuAngle) * 150;
        camera.position.set(mx, Math.max(55, world.heightAt(mx, mz) + 30), mz);
        camera.lookAt(60 - Math.sin(menuAngle) * 40, 18, 40 - Math.cos(menuAngle) * 40);
        break;
      }
      default:
        break;
    }

    if (game.state !== STATE.MENU) ctx.net.update(dt);

    // Pausado: desenha só de vez em quando (economiza bateria).
    if (game.state === STATE.PAUSED && !ctx.net.active) {
      pausedSkip = (pausedSkip + 1) % 6;
      if (pausedSkip !== 0) {
        input.endFrame();
        return;
      }
    }

    const focus = game.state === STATE.MENU ? camera.position : player.position;
    world.update(dt, camera, focus);
    if (game.state !== STATE.MENU) {
      hud.update(dt);
      minimap.update(dt, player, camCtl.yaw);
      inspect.update(dt);
      // fantasma da peça de construção na mão
      const pl = game.state === STATE.PLAYING && !player.dead && !player.riding ? actions.buildPlacement(camCtl.yaw) : null;
      if (pl) buildGhost.show(pl.type, pl);
      else buildGhost.hide();
      touch.updateStates(player);
      // Criatura na mira: nome, nível e vida.
      targetTimer -= dt;
      if (targetTimer <= 0) {
        targetTimer = 0.15;
        hud.setTarget(game.state === STATE.PLAYING ? creatures.findAimed(camera.position, camCtl.forward, 45) : null);
      }
    }
    // Modo foto (só para testes automáticos): câmera fixa.
    const photo = window.__ilha?.photo;
    if (photo) {
      camera.position.set(...photo.pos);
      camera.lookAt(...photo.target);
    }
    // ---------- Sons ----------
    if (game.state !== STATE.MENU) {
      sound.update(dt, camera, world, player.position);
      sound.setUnderwater(world.cameraUnderwater);
      document.body.classList.toggle('underwater', !!world.cameraUnderwater);
      document.body.classList.toggle('underwater-swamp', !!world.cameraUnderwater && world.waterAt(camera.position.x, camera.position.z)?.id === 'pantano');
      updateFootsteps(dt);
    }

    const toolKind = actions.tool.tipo;
    // luz da tocha na mão (mais forte à noite)
    const torchOn = toolKind === 'tocha' && game.state === STATE.PLAYING && !player.dead;
    if (torchOn) {
      world.torchLight.position.copy(camera.position).addScaledVector(camCtl.forward, 0.8).add(new THREE.Vector3(0, 0.3, 0));
      world.torchLight.intensity = (1.5 + (1 - world.sky.daylight) * 9) * (0.9 + Math.sin(now * 0.017) * 0.06);
    } else {
      world.torchLight.intensity = 0;
    }
    if (hands.toolKind !== toolKind) hands.setTool(toolKind);
    damageNumbers.update(dt, camera);
    hands.update(dt, {
      visible: !photo && game.state === STATE.PLAYING && camCtl.mode === 'primeira' && !player.dead,
      speed: Math.hypot(player.velocity.x, player.velocity.z),
      swimming: player.swimming,
      running: player.running,
      onGround: player.onGround,
    });
    // embaixo d'água a visão balança devagar; na superfície, as ondas
    // inclinam um pouco a cabeça
    let wob = 0;
    if (world.cameraUnderwater) wob = Math.sin(now * 0.0011) * 0.02;
    else if (player.swimming) wob = Math.sin(now * 0.0016) * 0.018;
    camera.rotation.z += wob;
    // com SMAA são várias passadas: conta os triângulos de todas
    renderer.info.reset();
    // luneta: vista 4x mais perto (só com ela na mão)
    const p0 = player;
    if (p0?.zoom && p0.actions?.tool.tipo !== 'luneta') p0.zoom = false;
    const wantFov = p0?.zoom ? baseFov / 4 : baseFov;
    if (Math.abs(camera.fov - wantFov) > 0.05) {
      camera.fov += (wantFov - camera.fov) * Math.min(1, dt * 10);
      camera.updateProjectionMatrix();
    }
    if (composer) composer.render(dt);
    else renderer.render(scene, camera);
    camera.rotation.z -= wob;
    debug.frame(dt);
    input.endFrame();
  }

  // Dá tempo da tela "Gerando a ilha…" aparecer antes do trabalho pesado.
  setTimeout(() => {
    try {
      buildGame();
    } catch (err) {
      console.error(err);
      start.setLoading('Erro ao gerar a ilha');
    }
    requestAnimationFrame(frame);
  }, 50);

  // Acesso para testes automáticos e depuração.
  window.__ilha = {
    photo: null,
    game,
    settings,
    speciesIds: Object.keys(SPECIES),
    get ctx() { return ctx; },
    get net() { return ctx?.net; },
    sound,
    snapshot: () => (ctx ? gameSnapshot() : {}),
    save: () => autosave(),
    clearSave,
  };
}

// ---------- Início ----------
// Dentro do visualizador do Claude a página pode ser atualizada sem
// perder o jogo: guardamos posição e barras e restauramos depois.
const hot = typeof window !== 'undefined' ? window.claude?.hot : undefined;
try {
  if (hot && typeof hot.snapshot === 'function') hot.snapshot(() => window.__ilha?.snapshot?.() ?? {});
} catch {
  /* sem suporte: tudo bem */
}
const startGame = (data) => boot(data && typeof data === 'object' ? data : {});
if (hot && typeof hot.ready === 'function') hot.ready(startGame);
else startGame(hot?.data ?? {});
