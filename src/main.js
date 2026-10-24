// =============================================================
// ILHA PRIMORDIAL – ponto de partida do jogo
// Cria o desenho 3D (renderer), o mundo, o jogador e as telas, e
// roda o "loop": a cada quadro atualiza tudo e desenha.
// =============================================================
import * as THREE from 'three';
import { events, EV } from './core/event_bus.js';
import { game, STATE } from './core/game_manager.js';
import { settings } from './core/settings.js';
import { input } from './core/input.js';
import { World } from './world/world.js';
import { Player } from './player/player.js';
import { PlayerCamera } from './player/player_camera.js';
import { PlayerInteraction } from './player/player_interaction.js';
import { Hud } from './ui/hud.js';
import { Messages } from './ui/messages.js';
import { TouchControls } from './ui/touch_controls.js';
import { DeathScreen } from './ui/death_screen.js';
import { DebugOverlay } from './ui/debug_overlay.js';
import { PauseMenu } from './ui/pause_menu.js';
import { StartScreen } from './ui/start_screen.js';

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
  inventory: 'Inventário chega na Fase 2.',
  build: 'Construção chega na Fase 6.',
  mount: 'Montaria chega na Fase 9.',
  attack: 'Atacar e coletar chegam na Fase 2.',
};

function boot(hotData = {}) {
  const app = document.getElementById('app');

  // ---------- Renderer (desenho 3D) ----------
  const canvas = document.createElement('canvas');
  canvas.id = 'game';
  app.appendChild(canvas);
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,              // mais leve no celular
    powerPreference: 'high-performance',
  });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 300);
  game.renderer = renderer;
  game.camera = camera;

  const ui = document.createElement('div');
  ui.id = 'ui';
  app.appendChild(ui);

  input.attach(canvas);
  game.isTouch = detectTouch();
  document.body.classList.toggle('is-touch', game.isTouch);

  let ctx = null; // tudo do jogo, criado depois de gerar a ilha

  const start = new StartScreen(ui, { onPlay: () => play() });
  start.setLoading('Gerando a ilha…');

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w < h ? 82 : 70; // celular em pé: campo de visão maior
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  // ---------- Opções ----------
  function applySettings() {
    const q = settings.quality;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.pixelRatio));
    resize();
    game.isTouch = detectTouch();
    document.body.classList.toggle('is-touch', game.isTouch);
    if (!ctx) return;
    ctx.world.setShadows(q.shadows, q.shadowMap);
    const vd = settings.get('viewDistance');
    ctx.world.setViewDistance(vd);
    camera.far = vd + 40;
    camera.updateProjectionMatrix();
    const inGame = [STATE.PLAYING, STATE.PAUSED, STATE.DEAD].includes(game.state);
    ctx.touch.setVisible(game.isTouch && inGame);
    ctx.touch.applySettings(settings.get('buttonOpacity'), settings.get('buttonSize'));
    ctx.debug.setVisible(settings.get('showDebug'));
    ctx.camCtl.setMode(settings.get('cameraMode'));
    ctx.hud.setCameraLabel(ctx.camCtl.mode);
  }
  events.on(EV.SETTINGS_CHANGED, applySettings);

  // ---------- Criar o mundo (depois que a tela de carregando aparece) ----------
  function buildGame() {
    const world = new World(scene);
    const player = new Player(world, scene);
    const spawn = world.respawnPoint('sul');
    player.spawnAt(spawn);
    const camCtl = new PlayerCamera(camera, world);
    camCtl.yaw = spawn.yaw;
    const interaction = new PlayerInteraction(player, world, camCtl);
    const hud = new Hud(ui, player, (action) => onCornerButton(action));
    const messages = new Messages(ui);
    const touch = new TouchControls(ui, input);
    const death = new DeathScreen(ui, world);
    const debug = new DebugOverlay(ui, renderer);
    const pause = new PauseMenu(ui, {
      onResume: () => resume(),
      onQuitToMenu: () => toMenu(),
      onCloseApp: androidApp?.exit ? () => androidApp.exit() : null,
    });
    game.world = world;
    game.player = player;
    ctx = { world, player, camCtl, interaction, hud, messages, touch, death, debug, pause };

    // Voltando de uma atualização da página: restaura posição e barras.
    if (hotData.player) {
      player.fromJSON(hotData.player);
      if (typeof hotData.yaw === 'number') camCtl.yaw = hotData.yaw;
    }

    hud.setVisible(false);
    applySettings();
    start.setReady(hotData.player ? 'Continuar' : 'Jogar');
    game.setState(STATE.MENU);
    console.info(`[Ilha] ilha gerada em ${world.generationMs} ms`, world.vegetation.countByType());
  }

  // ---------- Mudanças de estado ----------
  function play() {
    if (!ctx) return;
    start.hide();
    ctx.hud.setVisible(true);
    ctx.touch.setVisible(game.isTouch);
    game.setState(STATE.PLAYING);
    requestFullscreenLandscape();
    if (!game.isTouch) input.requestPointerLock();
    if (game.playTime < 1) {
      events.emit(EV.MESSAGE, { text: 'Dica: o lago de água doce fica no meio da ilha.', kind: 'info' });
    }
  }

  function pauseGame() {
    if (game.state !== STATE.PLAYING) return;
    game.setState(STATE.PAUSED);
    input.clear();
    input.exitPointerLock();
    ctx.pause.show();
  }

  function resume() {
    if (game.state !== STATE.PAUSED) return;
    ctx.pause.hide();
    game.setState(STATE.PLAYING);
    if (!game.isTouch) input.requestPointerLock();
  }

  function toMenu() {
    ctx.pause.hide();
    ctx.hud.setVisible(false);
    ctx.touch.setVisible(false);
    start.setReady('Continuar');
    start.show();
    game.setState(STATE.MENU);
  }

  function onCornerButton(action) {
    if (action === 'pause') {
      if (game.state === STATE.PLAYING) pauseGame();
      else resume();
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
    game.setState(STATE.DEAD);
    ctx.world.spawnDeathBag(position);
    input.exitPointerLock();
    input.runToggle = false;
    ctx.death.show(cause);
  });

  events.on(EV.RESPAWN_REQUESTED, ({ pointId }) => {
    const point = ctx.world.respawnPoint(pointId);
    ctx.player.respawn(point);
    ctx.camCtl.yaw = point.yaw;
    ctx.camCtl.pitch = -0.12;
    ctx.death.hide();
    game.setState(STATE.PLAYING);
    if (!game.isTouch) input.requestPointerLock();
    events.emit(EV.MESSAGE, { text: `Você renasceu na ${point.name}.`, kind: 'info' });
    events.emit(EV.PLAYER_RESPAWNED, { pointId });
  });

  // Mouse solto com Esc no PC = pausa.
  document.addEventListener('pointerlockchange', () => {
    if (!document.pointerLockElement && game.state === STATE.PLAYING && !game.isTouch) pauseGame();
  });

  // App em segundo plano / aba escondida = pausa.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pauseGame();
  });

  // Botão "voltar" do Android: pausa / continua.
  window.__ilhaBack = () => {
    if (game.state === STATE.PLAYING) pauseGame();
    else if (game.state === STATE.PAUSED) resume();
  };

  // ---------- Ações globais (teclas/botões que não são do jogador) ----------
  let comingSoonShown = {};
  function handleActions() {
    if (input.wasPressed('pause')) {
      // Evita pausar/despausar duas vezes quando o Esc também solta o mouse.
      const justUnlocked = performance.now() - input.lastUnlockTime < 300;
      if (game.state === STATE.PLAYING) pauseGame();
      else if (game.state === STATE.PAUSED && !justUnlocked) resume();
    }
    if (input.wasPressed('debug')) settings.set('showDebug', !settings.get('showDebug'));
    if (game.state !== STATE.PLAYING) return;
    if (input.wasPressed('camera')) settings.set('cameraMode', ctx.camCtl.mode === 'primeira' ? 'terceira' : 'primeira');
    if (input.wasPressed('attack')) ctx.player.model.swing();
    for (const action of ['inventory', 'build', 'mount', 'attack']) {
      if (input.wasPressed(action) && (action !== 'attack' || !comingSoonShown.attack)) {
        comingSoonShown[action] = true;
        events.emit(EV.MESSAGE, { text: COMING_SOON[action], kind: 'info' });
      }
    }
  }

  // ---------- Loop principal ----------
  let last = performance.now();
  let menuAngle = 0;
  let pausedSkip = 0;

  function frame(now) {
    requestAnimationFrame(frame);
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.1) dt = 0.1; // celular travou? não deixa o jogo "pular"
    if (dt <= 0) return;
    if (!ctx) return;

    handleActions();
    const { world, player, camCtl, interaction, hud, touch, debug } = ctx;
    const look = input.consumeLook();
    const sens = settings.get('sensitivity');

    switch (game.state) {
      case STATE.PLAYING:
        game.playTime += dt;
        camCtl.applyLook(look, sens, player);
        player.update(dt, input, camCtl);
        camCtl.update(dt, player);
        interaction.update(dt, input);
        break;
      case STATE.DEAD:
        camCtl.applyLook(look, sens, player);
        player.update(dt, input, camCtl);
        camCtl.update(dt, player);
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

    // Pausado: desenha só de vez em quando (economiza bateria).
    if (game.state === STATE.PAUSED) {
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
      touch.updateStates(player);
    }
    renderer.render(scene, camera);
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
    game,
    settings,
    get ctx() { return ctx; },
    snapshot: () => (ctx ? { player: ctx.player.toJSON(), yaw: ctx.camCtl.yaw } : {}),
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
