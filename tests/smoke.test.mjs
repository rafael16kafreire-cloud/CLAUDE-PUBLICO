// =============================================================
// TESTE AUTOMÁTICO: abre o jogo num navegador (modo PC e modo
// celular), verifica se não há erros e testa os sistemas da Fase 1.
// Uso:  npm run build && npm test
// Fotos de tela vão para a pasta indicada em SHOTS (padrão: build/shots)
// =============================================================
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const SHOTS = process.env.SHOTS || 'build/shots';
await mkdir(SHOTS, { recursive: true });
const url = pathToFileURL(resolve('dist/ilha-primordial.html')).href;

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'OK  ' : 'FALHOU'}  ${name}${detail ? '  — ' + detail : ''}`);
}

const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});

async function openGame(contextOptions, label) {
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/fonts\.(googleapis|gstatic)/.test(m.text())) errors.push(`console: ${m.text()}`);
    if (m.type() === 'info' || m.type() === 'log') console.log(`   [${label}] ${m.text()}`);
  });
  page.on('requestfailed', () => {}); // fontes offline: ignorar
  await page.goto(url);
  await page.waitForFunction(() => {
    const b = document.querySelector('#btn-play');
    return b && !b.disabled;
  }, null, { timeout: 60000 });
  return { context, page, errors };
}

const frames = (page, n = 30) => page.evaluate((count) => new Promise((res) => {
  let i = 0;
  const step = () => (++i >= count ? res() : requestAnimationFrame(step));
  requestAnimationFrame(step);
}), n);

// ---------------------------------------------------------------
// PC
// ---------------------------------------------------------------
{
  const { context, page, errors } = await openGame({ viewport: { width: 1280, height: 720 } }, 'PC');
  await frames(page, 20);
  await page.screenshot({ path: `${SHOTS}/01-pc-tela-inicial.png` });

  await page.click('#btn-play');
  await frames(page, 30);
  const state = await page.evaluate(() => window.__ilha.game.state);
  check('PC: botão Jogar inicia o jogo', state === 'playing', state);

  const p0 = await page.evaluate(() => {
    const p = window.__ilha.ctx.player.position;
    return { x: p.x, y: p.y, z: p.z };
  });
  check('PC: jogador nasce na Praia Sul', p0.z > 300 && p0.y > 0.5 && p0.y < 4, JSON.stringify(p0));
  const camMode = await page.evaluate(() => window.__ilha.ctx.camCtl.mode);
  check('Câmera começa em primeira pessoa', camMode === 'primeira', camMode);
  // sem dinossauros atrapalhando os testes de movimento
  await page.evaluate(() => {
    const c = window.__ilha.ctx.creatures;
    c.enabled = false;
    c.clear();
  });
  await page.screenshot({ path: `${SHOTS}/02-pc-praia-sul.png` });

  // Andar para frente (W) por 1,5 s
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(1500);
  await page.keyboard.up('KeyW');
  const p1 = await page.evaluate(() => window.__ilha.ctx.player.position.z);
  check('PC: W anda para frente (norte)', p1 < p0.z - 2, `z ${p0.z.toFixed(1)} -> ${p1.toFixed(1)}`);

  // Correr gasta stamina
  await page.keyboard.down('KeyW');
  await page.keyboard.down('ShiftLeft');
  await page.waitForTimeout(1500);
  const st = await page.evaluate(() => window.__ilha.ctx.player.stats.stamina);
  await page.keyboard.up('ShiftLeft');
  await page.keyboard.up('KeyW');
  check('PC: correr gasta stamina', st < 99, `stamina ${st.toFixed(1)}`);

  // Pular
  const yBefore = await page.evaluate(() => window.__ilha.ctx.player.position.y);
  await page.keyboard.down('Space');
  await page.waitForTimeout(180);
  const yJump = await page.evaluate(() => window.__ilha.ctx.player.position.y);
  await page.keyboard.up('Space');
  check('PC: espaço pula', yJump > yBefore + 0.3, `${yBefore.toFixed(2)} -> ${yJump.toFixed(2)}`);
  await page.waitForTimeout(800);

  // Agachar (C)
  await page.keyboard.press('KeyC');
  await frames(page, 3);
  const crouch = await page.evaluate(() => window.__ilha.ctx.player.crouching);
  await page.keyboard.press('KeyC');
  check('PC: C agacha', crouch === true);

  // Teleporta para a beira do lago e bebe água doce
  await page.evaluate(() => {
    const { ctx } = window.__ilha;
    const lake = ctx.world.map.lake;
    const p = ctx.player;
    // anda do centro do lago para fora até achar chão seco
    let r = lake.radius * 0.4;
    while (r < lake.diskRadius + 20 && ctx.world.waterAt(lake.x + r, lake.z)) r += 1;
    p.position.set(lake.x + r + 1, ctx.world.heightAt(lake.x + r + 1, lake.z), lake.z);
    ctx.camCtl.yaw = Math.PI / 2; // olhando para oeste (para o lago)
    ctx.camCtl.pitch = -0.5;
    p.stats.water = 40;
  });
  await frames(page, 20);
  await page.waitForTimeout(250);
  const prompt = await page.evaluate(() => {
    const el = document.querySelector('.prompt');
    return el && !el.hidden ? el.textContent : null;
  });
  check('Lago: aparece "Beber água" na beira', !!prompt && prompt.includes('Beber'), prompt ?? 'sem dica');
  await page.screenshot({ path: `${SHOTS}/03-pc-beira-do-lago.png` });
  await page.keyboard.press('KeyE');
  await frames(page, 5);
  const water = await page.evaluate(() => window.__ilha.ctx.player.stats.water);
  check('Lago: E bebe e recupera sede', water > 45, `sede ${water.toFixed(1)}`);

  // Nadar no meio do lago
  await page.evaluate(() => {
    const { ctx } = window.__ilha;
    const lake = ctx.world.map.lake;
    ctx.player.position.set(lake.x, lake.level - 1.5, lake.z);
  });
  await frames(page, 30);
  const swim = await page.evaluate(() => ({
    swimming: window.__ilha.ctx.player.swimming,
    y: window.__ilha.ctx.player.position.y,
    level: window.__ilha.ctx.world.map.lake.level,
  }));
  check('Lago: no fundo, o jogador nada e boia', swim.swimming && swim.y > swim.level - 2.2, JSON.stringify(swim));
  await page.screenshot({ path: `${SHOTS}/04-pc-nadando-lago.png` });

  // Embaixo d'água: fôlego cai
  await page.evaluate(() => {
    const { ctx } = window.__ilha;
    const lake = ctx.world.map.lake;
    ctx.player.position.set(lake.x, ctx.world.heightAt(lake.x, lake.z) + 0.1, lake.z);
    ctx.camCtl.pitch = -0.2;
  });
  await page.keyboard.down('KeyC'); // segurar C = descer
  await page.waitForTimeout(1500);
  const under = await page.evaluate(() => ({
    head: window.__ilha.ctx.player.headUnderwater,
    oxygen: window.__ilha.ctx.player.stats.oxygen,
    shown: !document.querySelector('.stat-oxygen').hidden,
  }));
  await page.screenshot({ path: `${SHOTS}/05-pc-embaixo-dagua.png` });
  await page.keyboard.up('KeyC');
  check('Água: embaixo d\'água o fôlego cai e aparece no HUD', under.head && under.oxygen < 99.95 && under.shown, JSON.stringify(under));

  // Mar: água salgada não mata a sede
  await page.evaluate(() => {
    const { ctx } = window.__ilha;
    const sul = ctx.world.respawnPoint('sul').position;
    let z = sul.z;
    while (z < 700 && !ctx.world.waterAt(0, z)) z += 1;
    ctx.player.position.set(0, ctx.world.heightAt(0, z + 6), z + 6);
    ctx.player.stats.water = 40;
  });
  await frames(page, 20);
  await page.waitForTimeout(250);
  await page.keyboard.press('KeyE');
  await frames(page, 5);
  const seaMsg = await page.evaluate(() => [...document.querySelectorAll('.msg')].map((m) => m.textContent).join(' | '));
  const water2 = await page.evaluate(() => window.__ilha.ctx.player.stats.water);
  check('Mar: água salgada não mata a sede', water2 <= 40.01 && /salgada/i.test(seaMsg), seaMsg);

  // Overlay de debug (F3)
  await page.keyboard.press('F3');
  await frames(page, 40);
  const dbg = await page.evaluate(() => {
    const el = document.querySelector('.debug');
    return el && !el.hidden ? el.textContent : null;
  });
  check('F3 mostra FPS, criaturas e memória', !!dbg && /FPS/.test(dbg) && /Criaturas/.test(dbg) && /Memória/.test(dbg), dbg?.split('\n')[0]);

  // Pior caso de desempenho: Floresta Amazônica + 15 dinossauros
  await page.evaluate(() => {
    const { ctx } = window.__ilha;
    const j = ctx.world.layout.selva;
    ctx.player.position.set(j.x, ctx.world.heightAt(j.x, j.z), j.z);
    ctx.camCtl.yaw = Math.PI * 0.75;
    ctx.camCtl.pitch = -0.05;
    const ids = ['raptor', 'raptor', 'raptor', 'trex', 'parassauro', 'parassauro', 'braquiossauro', 'titanoboa', 'pterodactilo', 'dodo', 'dodo', 'paquicefalossauro', 'parassauro', 'raptor', 'dodo'];
    ids.forEach((id, i) => {
      const a = (i / ids.length) * Math.PI * 2;
      const cr = ctx.creatures.spawn(id, j.x + Math.sin(a) * 40, j.z + Math.cos(a) * 40, 5);
      cr.species = { ...cr.species, temperamento: 'passivo' };
    });
  });
  await frames(page, 40);
  await page.screenshot({ path: `${SHOTS}/06-pc-selva-debug.png` });
  const info = await page.evaluate(() => {
    const i = window.__ilha.game.renderer.info.render;
    return { calls: i.calls, tris: i.triangles, criaturas: window.__ilha.game.activeCreatures };
  });
  console.log('   Selva + criaturas: draw calls', info.calls, 'triângulos', info.tris);
  check('Desempenho: menos de 260 desenhos por quadro (selva + 15 dinos)', info.calls < 260, JSON.stringify(info));
  await page.evaluate(() => window.__ilha.ctx.creatures.clear());

  // Montanha
  await page.evaluate(() => {
    const { ctx } = window.__ilha;
    const m = ctx.world.layout.montanha;
    ctx.player.position.set(m.x + 120, ctx.world.heightAt(m.x + 120, m.z + 140), m.z + 140);
    ctx.camCtl.yaw = Math.atan2(120, 140);
    ctx.camCtl.pitch = 0.15;
  });
  await frames(page, 40);
  await page.screenshot({ path: `${SHOTS}/07-pc-montanha.png` });

  // Morte por afogamento + tela de morte + saco de morte
  await page.evaluate(() => {
    const { ctx } = window.__ilha;
    const lake = ctx.world.map.lake;
    ctx.player.position.set(lake.x, ctx.world.heightAt(lake.x, lake.z) + 0.1, lake.z);
    ctx.player.stats.oxygen = 0;
    ctx.player.stats.health = 3;
  });
  await page.keyboard.down('KeyC');
  await page.waitForTimeout(1500);
  await page.keyboard.up('KeyC');
  const dead = await page.evaluate(() => ({
    state: window.__ilha.game.state,
    screen: !document.querySelector('.death').hidden,
    cause: document.querySelector('.death-cause')?.textContent,
    bags: window.__ilha.ctx.world.deathBags.length,
  }));
  check('Morte: afogado mostra tela de morte e cria saco de morte', dead.state === 'dead' && dead.screen && dead.bags === 1, JSON.stringify(dead));
  await page.screenshot({ path: `${SHOTS}/08-pc-tela-de-morte.png` });

  const pins = await page.evaluate(() => document.querySelectorAll('.map-pin').length);
  check('Morte: mapa mostra os pontos de renascer', pins >= 5, `${pins} pontos`);
  await page.screenshot({ path: `${SHOTS}/08b-pc-mapa-renascer.png` });
  await page.click('#respawn-leste');
  await page.click('#respawn-confirm');
  await frames(page, 20);
  const resp = await page.evaluate(() => ({
    state: window.__ilha.game.state,
    x: window.__ilha.ctx.player.position.x,
    health: window.__ilha.ctx.player.stats.health,
  }));
  check('Renascer na Praia Leste', resp.state === 'playing' && resp.x > 300 && resp.health === 100, JSON.stringify(resp));

  // Fome zerada tira vida; vida regenera com fome e sede > 50%
  const hunger = await page.evaluate(() => {
    const s = window.__ilha.ctx.player.stats;
    s.food = 0; s.health = 50;
    s.update(2, { running: false, swimming: false, moving: false, headUnderwater: false, ambientTemp: 25 });
    const afterStarving = s.health;
    s.food = 80; s.water = 80;
    s.update(2, { running: false, swimming: false, moving: false, headUnderwater: false, ambientTemp: 25 });
    return { afterStarving, afterRegen: s.health };
  });
  check('Fome zerada tira vida e vida regenera acima de 50%', hunger.afterStarving < 50 && hunger.afterRegen > hunger.afterStarving, JSON.stringify(hunger));

  // Fome e sede: duração de acordo com o balanceamento
  const rates = await page.evaluate(() => {
    const s = window.__ilha.ctx.player.stats;
    s.food = 100; s.water = 100;
    s.update(60, { running: false, swimming: false, moving: false, headUnderwater: false, ambientTemp: 25 });
    const f1 = 100 - s.food; const w1 = 100 - s.water;
    s.food = 100; s.water = 100;
    s.update(60, { running: true, swimming: false, moving: true, headUnderwater: false, ambientTemp: 25 });
    return { foodPerMin: f1, waterPerMin: w1, foodRunning: 100 - s.food };
  });
  check('Fome cheia dura ~25 min e sede ~18 min; correr acelera', Math.abs(rates.foodPerMin - 4) < 0.01 && Math.abs(rates.waterPerMin - 100 / 18) < 0.01 && rates.foodRunning > rates.foodPerMin * 1.9, JSON.stringify(rates));

  // Biomas: entrar no deserto mostra o nome na tela
  await page.evaluate(() => {
    const c = window.__ilha.ctx;
    const d = c.world.layout.deserto;
    c.player.position.set(d.x, c.world.heightAt(d.x, d.z), d.z);
    c.player.stats.water = 100; c.player.stats.food = 100;
  });
  await page.waitForTimeout(2600);
  const banner = await page.evaluate(() => {
    const b = document.querySelector('.biome-banner');
    return b && !b.hidden ? b.textContent.trim().replace(/\s+/g, ' ') : null;
  });
  check('Bioma: entrar no deserto mostra "Deserto"', !!banner && banner.includes('Deserto'), banner ?? 'nada');
  await page.screenshot({ path: `${SHOTS}/09a-pc-deserto.png` });

  const biomes = await page.evaluate(() => {
    const w = window.__ilha.ctx.world;
    const found = new Set();
    for (let x = -460; x <= 460; x += 20) for (let z = -460; z <= 460; z += 20) found.add(w.biomeKeyAt(x, z));
    const s = w.layout.pantano;
    let swampFresh = false;
    for (let a = 0; a < 6.3 && !swampFresh; a += 0.2) for (let r = 5; r < s.raio_m * 0.6; r += 5) {
      const b = w.waterAt(s.x + Math.sin(a) * r, s.z + Math.cos(a) * r);
      if (b && b.id === 'pantano' && b.fresh) { swampFresh = true; break; }
    }
    return { list: [...found], swampFresh };
  });
  const needed = ['praia', 'selva', 'deserto', 'pantano', 'campina', 'floresta', 'montanha'];
  check('Biomas: praia, Floresta Amazônica, deserto e pântano existem', needed.every((k) => biomes.list.includes(k)), biomes.list.join(','));
  check('Pântano tem água doce (dá para beber)', biomes.swampFresh);

  // Dinossauros: as 10 espécies nascem sem erro
  const species = await page.evaluate(() => {
    const c = window.__ilha.ctx;
    const p = c.player.position;
    const ids = ['dodo', 'parassauro', 'paquicefalossauro', 'braquiossauro', 'raptor', 'trex', 'titanoboa', 'deinosuchus', 'pterodactilo', 'quetzalcoatlus'];
    const made = ids.map((id, i) => c.creatures.spawn(id, p.x + 60 + i * 12, p.z + 60, 10)).filter(Boolean);
    return made.map((m) => m.species.nome);
  });
  await frames(page, 30);
  check('Dinossauros: as 10 espécies aparecem', species.length === 10, species.join(', '));
  await page.evaluate(() => window.__ilha.ctx.creatures.clear());

  // Raptor ataca o jogador
  await page.evaluate(() => {
    const c = window.__ilha.ctx;
    const z = c.world.layout.campina;
    c.player.position.set(z.x, c.world.heightAt(z.x, z.z), z.z);
    c.player.stats.health = 100;
    c.creatures.spawn('raptor', z.x + 7, z.z, 3);
  });
  await page.waitForTimeout(3500);
  const hurt = await page.evaluate(() => window.__ilha.ctx.player.stats.health);
  check('Raptor ataca o jogador', hurt < 100, `vida ${hurt.toFixed(0)}`);
  await page.evaluate(() => window.__ilha.ctx.creatures.clear());

  // Soco mata um dodô e dá XP
  const xp0 = await page.evaluate(() => {
    const c = window.__ilha.ctx;
    c.player.stats.health = 100;
    c.player.stats.stamina = 100;
    const f = c.camCtl.forward;
    const p = c.player.position;
    const d = c.creatures.spawn('dodo', p.x + f.x * 1.6, p.z + f.z * 1.6, 1);
    d.speed = 0; d._setState('parado'); d.idleFor = 99;
    window.__dodo = d;
    return c.player.stats.xp + c.player.stats.level * 1000;
  });
  for (let i = 0; i < 8; i++) {
    await page.evaluate(() => {
      const c = window.__ilha.ctx; const d = window.__dodo; const p = c.player.position;
      // mantém o dodô na frente para o teste
      const f = c.camCtl.forward; d.pos.x = p.x + f.x * 1.6; d.pos.z = p.z + f.z * 1.6;
      c.player.stats.stamina = 100;
    });
    await page.mouse.down();
    await page.mouse.up();
    await page.waitForTimeout(550);
  }
  const punch = await page.evaluate(() => ({ alive: window.__dodo.alive, xp: window.__ilha.ctx.player.stats.xp + window.__ilha.ctx.player.stats.level * 1000 }));
  check('Soco: mata um dodô e ganha XP', !punch.alive && punch.xp > xp0, JSON.stringify(punch));

  // Mira numa criatura mostra nome, nível e vida
  await page.evaluate(() => {
    const c = window.__ilha.ctx;
    const p = c.player.position;
    const f = c.camCtl.forward;
    const t = c.creatures.spawn('paquicefalossauro', p.x + f.x * 9, p.z + f.z * 9, 7);
    t.species = { ...t.species, temperamento: 'passivo' };
    t._setState('parado'); t.idleFor = 99;
    c.camCtl.pitch = -0.02;
  });
  await page.waitForTimeout(600);
  const target = await page.evaluate(() => {
    const t = document.querySelector('.target');
    return t && !t.hidden ? t.textContent.replace(/\s+/g, ' ').trim() : null;
  });
  check('Mira: mostra nome e nível da criatura', !!target && /Paquicefalossauro/.test(target) && /Nv 7/.test(target), target ?? 'nada');
  await page.screenshot({ path: `${SHOTS}/09b-pc-mira-criatura.png` });
  await page.evaluate(() => window.__ilha.ctx.creatures.clear());

  // Pausa com Esc (com o mouse preso no jogo, cliques vão para o 3D)
  await page.keyboard.press('Escape');
  await frames(page, 6);
  const paused = await page.evaluate(() => window.__ilha.game.state);
  await page.screenshot({ path: `${SHOTS}/09-pc-pausa.png` });
  await page.click('#pause-resume');
  check('Pausa e continuar', paused === 'paused', paused);

  check('PC: sem erros no console', errors.length === 0, errors.slice(0, 3).join(' / '));
  await context.close();
}

// ---------------------------------------------------------------
// CELULAR (Android médio, deitado)
// ---------------------------------------------------------------
{
  const { context, page, errors } = await openGame({
    viewport: { width: 800, height: 360 },
    deviceScaleFactor: 2.5,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 6a) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36',
  }, 'Celular');
  await frames(page, 10);
  await page.screenshot({ path: `${SHOTS}/10-cel-tela-inicial.png` });
  await page.tap('#btn-play');
  await frames(page, 30);
  const touchVisible = await page.evaluate(() => !document.querySelector('.tc').hidden);
  check('Celular: controles de toque aparecem', touchVisible);

  // Joystick: arrastar para cima = andar para frente
  const z0 = await page.evaluate(() => window.__ilha.ctx.player.position.z);
  const cdp = await context.newCDPSession(page);
  const touch = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
  await touch('touchStart', [{ x: 120, y: 280, id: 1 }]);
  for (let i = 1; i <= 6; i++) {
    await touch('touchMove', [{ x: 120, y: 280 - i * 10, id: 1 }]);
    await page.waitForTimeout(30);
  }
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${SHOTS}/11-cel-andando-joystick.png` });
  await touch('touchEnd', []);
  const z1 = await page.evaluate(() => window.__ilha.ctx.player.position.z);
  check('Celular: joystick anda para frente', z1 < z0 - 2, `z ${z0.toFixed(1)} -> ${z1.toFixed(1)}`);

  // Arrastar o lado direito gira a câmera
  const yaw0 = await page.evaluate(() => window.__ilha.ctx.camCtl.yaw);
  await touch('touchStart', [{ x: 480, y: 160, id: 2 }]);
  for (let i = 1; i <= 8; i++) {
    await touch('touchMove', [{ x: 480 + i * 12, y: 160, id: 2 }]);
    await page.waitForTimeout(20);
  }
  await touch('touchEnd', []);
  await frames(page, 3);
  const yaw1 = await page.evaluate(() => window.__ilha.ctx.camCtl.yaw);
  check('Celular: arrastar à direita gira a câmera', Math.abs(yaw1 - yaw0) > 0.2, `${yaw0.toFixed(2)} -> ${yaw1.toFixed(2)}`);

  // Botão Correr (liga/desliga) e Pular
  await page.tap('.b-run');
  await frames(page, 2);
  const runOn = await page.evaluate(() => window.__ilha.ctx.touch.input.runToggle);
  await page.tap('.b-run');
  check('Celular: botão Correr liga/desliga', runOn === true);

  const yb = await page.evaluate(() => window.__ilha.ctx.player.position.y);
  await page.tap('.b-jump');
  await page.waitForTimeout(150);
  const yj = await page.evaluate(() => window.__ilha.ctx.player.position.y);
  check('Celular: botão Pular', yj > yb + 0.2, `${yb.toFixed(2)} -> ${yj.toFixed(2)}`);

  // Na beira do lago, o botão Interagir bebe
  await page.evaluate(() => {
    const { ctx } = window.__ilha;
    const lake = ctx.world.map.lake;
    let r = lake.radius * 0.4;
    while (r < lake.diskRadius + 20 && ctx.world.waterAt(lake.x - r, lake.z)) r += 1;
    ctx.player.position.set(lake.x - r - 0.8, ctx.world.heightAt(lake.x - r - 0.8, lake.z), lake.z);
    ctx.camCtl.yaw = -Math.PI / 2; // olhando para leste (para o lago)
    ctx.camCtl.pitch = -0.35;
    ctx.player.stats.water = 30;
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SHOTS}/12-cel-lago.png` });
  await page.tap('.b-interact');
  await frames(page, 5);
  const w = await page.evaluate(() => window.__ilha.ctx.player.stats.water);
  check('Celular: Interagir bebe no lago', w > 35, `sede ${w.toFixed(1)}`);

  // Opções: opacidade e tamanho dos botões
  await page.tap('.corner-btn[data-action="pause"]');
  await frames(page, 6);
  await page.screenshot({ path: `${SHOTS}/13-cel-pausa-opcoes.png` });
  await page.evaluate(() => {
    const s = window.__ilha.settings;
    s.set('buttonOpacity', 0.4);
    s.set('buttonSize', 1.2);
  });
  const opa = await page.evaluate(() => getComputedStyle(document.querySelector('.tc')).getPropertyValue('--tc-opacity').trim());
  check('Opções: opacidade dos botões muda', opa === '0.4', opa);
  await page.tap('#pause-resume');
  await frames(page, 10);
  await page.evaluate(() => {
    const s = window.__ilha.settings;
    s.set('buttonOpacity', 0.7);
    s.set('buttonSize', 1.0);
  });

  // Celular em pé (retrato)
  await page.evaluate(() => document.fullscreenElement && document.exitFullscreen());
  await page.waitForTimeout(300);
  await page.setViewportSize({ width: 360, height: 760 });
  await frames(page, 20);
  await page.screenshot({ path: `${SHOTS}/14-cel-em-pe.png` });

  check('Celular: sem erros no console', errors.length === 0, errors.slice(0, 3).join(' / '));
  await context.close();
}

// ---------------------------------------------------------------
// APP ANDROID (simulado): ponte "IlhaAndroid" e botão voltar
// ---------------------------------------------------------------
{
  const context = await browser.newContext({
    viewport: { width: 800, height: 360 }, isMobile: true, hasTouch: true,
  });
  await context.addInitScript(() => {
    window.IlhaAndroid = { exit() { window.__fechou = true; } };
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(url);
  await page.waitForFunction(() => !document.querySelector('#btn-play').disabled, null, { timeout: 60000 });
  await page.tap('#btn-play');
  await frames(page, 10);
  await page.evaluate(() => window.__ilhaBack());
  await frames(page, 6);
  const st = await page.evaluate(() => ({
    state: window.__ilha.game.state,
    closeVisible: !document.querySelector('#pause-close').hidden,
  }));
  check('Android: botão voltar pausa e mostra "Fechar o app"', st.state === 'paused' && st.closeVisible, JSON.stringify(st));
  await page.evaluate(() => window.__ilhaBack());
  await frames(page, 3);
  const st2 = await page.evaluate(() => window.__ilha.game.state);
  check('Android: voltar de novo continua o jogo', st2 === 'playing', st2);
  await page.evaluate(() => window.__ilhaBack());
  await page.tap('#pause-close');
  const closed = await page.evaluate(() => !!window.__fechou);
  check('Android: "Fechar o app" chama o app', closed);
  check('Android: sem erros', errors.length === 0, errors.join(' / '));
  await context.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} testes passaram.`);
process.exit(failed.length ? 1 : 0);
