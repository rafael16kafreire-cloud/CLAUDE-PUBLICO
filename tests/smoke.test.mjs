// =============================================================
// TESTE AUTOMÁTICO: abre o jogo num navegador (modo PC e modo
// celular), verifica se não há erros e testa os sistemas (mundo, coleta, crafting, animais).
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
  // Testes medem a qualidade padrão: sem baixar sozinho.
  await context.addInitScript(() => {
    try {
      localStorage.setItem('ilha-primordial:opcoes', JSON.stringify({ version: 3, autoQuality: false }));
    } catch { /* ok */ }
  });
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

// Espera passar X ms de TEMPO DE JOGO (o navegador de teste não tem
// placa de vídeo e pode desenhar bem devagar). Para se o jogo sair do
// estado "jogando" (morte, pausa) ou depois de 90 s de relógio.
const gameWait = (page, ms) => page.evaluate((sec) => new Promise((res) => {
  const g = window.__ilha.game;
  const t0 = g.playTime;
  const w0 = performance.now();
  const step = () => {
    if (g.playTime - t0 >= sec || g.state !== 'playing' || performance.now() - w0 > 90000) res();
    else requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}), ms / 1000);

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
  await page.mouse.move(640, 360); // cliques no meio da tela
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
  await gameWait(page, 1500);
  await page.keyboard.up('KeyW');
  const p1 = await page.evaluate(() => window.__ilha.ctx.player.position.z);
  check('PC: W anda para frente (norte)', p1 < p0.z - 2, `z ${p0.z.toFixed(1)} -> ${p1.toFixed(1)}`);

  // Correr gasta stamina
  await page.keyboard.down('KeyW');
  await page.keyboard.down('ShiftLeft');
  await gameWait(page, 1500);
  const st = await page.evaluate(() => window.__ilha.ctx.player.stats.stamina);
  await page.keyboard.up('ShiftLeft');
  await page.keyboard.up('KeyW');
  check('PC: correr gasta stamina', st < 99, `stamina ${st.toFixed(1)}`);

  // Pular
  const yBefore = await page.evaluate(() => window.__ilha.ctx.player.position.y);
  await page.keyboard.down('Space');
  await gameWait(page, 180);
  const yJump = await page.evaluate(() => window.__ilha.ctx.player.position.y);
  await page.keyboard.up('Space');
  check('PC: espaço pula', yJump > yBefore + 0.3, `${yBefore.toFixed(2)} -> ${yJump.toFixed(2)}`);
  await gameWait(page, 800);

  // Agachar (C)
  await page.keyboard.press('KeyC');
  await frames(page, 3);
  const crouch = await page.evaluate(() => window.__ilha.ctx.player.crouching);
  await page.keyboard.press('KeyC');
  check('PC: C agacha', crouch === true);

  // Ajudantes dentro da página
  await page.evaluate(() => {
    const T = (window.__t = {});
    const ctx = () => window.__ilha.ctx;
    // Ponto seco na beira do pântano, olhando para a água.
    T.swampShore = () => {
      const { world } = ctx();
      const p0 = world.layout.pantano.partes[0];
      for (let a = 0; a < Math.PI * 2; a += 0.15) {
        const dx = Math.sin(a);
        const dz = Math.cos(a);
        let r = 5;
        while (r < 260 && world.waterAt(p0.x + dx * r, p0.z + dz * r)) r += 0.5;
        if (r < 20 || r >= 260) continue;
        const x = p0.x + dx * (r + 1.2);
        const z = p0.z + dz * (r + 1.2);
        if (world.waterAt(x, z)) continue;
        return { x, z, yaw: Math.atan2(dx, dz) }; // olhando de volta para o centro
      }
      return null;
    };
    // Coloca o jogador na frente de uma planta do tipo pedido.
    T.faceRec = (type, near = { x: 0, z: -200 }) => {
      const c = ctx();
      const veg = c.world.vegetation;
      let best = null;
      let bd = Infinity;
      for (const r of veg.recs) {
        if (r.type !== type || !r.alive) continue;
        if (c.world.waterAt(r.x, r.z)) continue;
        const d = Math.hypot(r.x - near.x, r.z - near.z);
        if (d < bd) { bd = d; best = r; }
      }
      if (!best) return null;
      // tira as outras plantas de perto (o golpe acerta só a escolhida)
      for (const r of veg.recs) {
        if (r !== best && r.alive && Math.hypot(r.x - best.x, r.z - best.z) < 7) { r.alive = false; r._testHidden = true; }
      }
      const dist = (best.r ?? 0.3) + 0.9;
      const a = 0.7;
      const x = best.x + Math.sin(a) * dist;
      const z = best.z + Math.cos(a) * dist;
      c.player.position.set(x, c.world.heightAt(x, z), z);
      c.player.velocity.set(0, 0, 0);
      c.camCtl.yaw = Math.atan2(x - best.x, z - best.z); // olhando para a planta
      c.camCtl.pitch = -0.15;
      veg.update(0, window.__ilha.game.camera, 180, true);
      return { type: best.type, x: best.x, z: best.z };
    };
    T.count = (id) => ctx().inventory.count(id);
  });

  // Beira do pântano: beber água doce
  const shore = await page.evaluate(() => {
    const { ctx } = window.__ilha;
    const s = window.__t.swampShore();
    if (!s) return null;
    ctx.player.position.set(s.x, ctx.world.heightAt(s.x, s.z), s.z);
    ctx.camCtl.yaw = s.yaw;
    ctx.camCtl.pitch = -0.5;
    ctx.player.stats.water = 40;
    return s;
  });
  check('Pântano: existe beira seca perto da água', !!shore, JSON.stringify(shore));
  await frames(page, 20);
  await gameWait(page, 300);
  const prompt = await page.evaluate(() => {
    const el = document.querySelector('.prompt');
    return el && !el.hidden ? el.textContent : null;
  });
  check('Pântano: aparece "Beber água" na beira', !!prompt && prompt.includes('Beber'), prompt ?? 'sem dica');
  await page.screenshot({ path: `${SHOTS}/03-pc-beira-do-pantano.png` });
  await page.keyboard.press('KeyE');
  await frames(page, 5);
  const water = await page.evaluate(() => window.__ilha.ctx.player.stats.water);
  check('Pântano: E bebe água doce e recupera sede', water > 45, `sede ${water.toFixed(1)}`);

  // Nadar no pântano (parte mais funda)
  const swim = await page.evaluate(async () => {
    const { ctx } = window.__ilha;
    const w = ctx.world;
    let best = null;
    for (const p of w.layout.pantano.partes) {
      for (let x = p.x - p.raio_m; x < p.x + p.raio_m; x += 4) {
        for (let z = p.z - p.raio_m; z < p.z + p.raio_m; z += 4) {
          const b = w.waterAt(x, z);
          if (!b) continue;
          const d = b.level - w.heightAt(x, z);
          if (!best || d > best.d) best = { x, z, d, level: b.level };
        }
      }
    }
    ctx.player.position.set(best.x, best.level - 1.5, best.z);
    return best;
  });
  await frames(page, 30);
  const swimState = await page.evaluate(() => ({ swimming: window.__ilha.ctx.player.swimming, y: window.__ilha.ctx.player.position.y }));
  check('Pântano: na parte funda o jogador nada', swim.d > 1.4 && swimState.swimming, JSON.stringify({ fundo: swim.d.toFixed(2), ...swimState }));
  await page.screenshot({ path: `${SHOTS}/04-pc-nadando-pantano.png` });

  // Embaixo d'água (mar): fôlego cai
  await page.evaluate(() => {
    const { ctx } = window.__ilha;
    ctx.player.position.set(0, ctx.world.heightAt(0, 600) + 0.1, 600);
    ctx.camCtl.pitch = -0.2;
  });
  await page.keyboard.down('KeyC'); // segurar C = descer
  await gameWait(page, 1500);
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
    ctx.camCtl.pitch = -0.3;
    ctx.player.stats.water = 40;
  });
  await frames(page, 20);
  await gameWait(page, 250);
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

  // Pior caso de desempenho: mata fechada + 15 animais
  await page.evaluate(() => {
    const { ctx } = window.__ilha;
    const j = { x: -230, z: -200 };
    ctx.player.position.set(j.x, ctx.world.heightAt(j.x, j.z), j.z);
    ctx.camCtl.yaw = Math.PI * 0.75;
    ctx.camCtl.pitch = -0.05;
    const ids = ['raptor', 'raptor', 'raptor', 'trex', 'parassauro', 'parassauro', 'braquiossauro', 'titanoboa', 'pterodactilo', 'dodo', 'onca', 'paquicefalossauro', 'triceratops', 'aranha', 'dodo'];
    ids.forEach((id, i) => {
      const a = (i / ids.length) * Math.PI * 2;
      const cr = ctx.creatures.spawn(id, j.x + Math.sin(a) * 30, j.z + Math.cos(a) * 30, 5);
      if (cr) cr.species = { ...cr.species, temperamento: 'passivo' };
    });
  });
  await frames(page, 40);
  await page.screenshot({ path: `${SHOTS}/06-pc-selva-debug.png` });
  const info = await page.evaluate(() => {
    const i = window.__ilha.game.renderer.info.render;
    return { calls: i.calls, tris: i.triangles, criaturas: window.__ilha.game.activeCreatures };
  });
  console.log('   Selva + criaturas: draw calls', info.calls, 'triângulos', info.tris);
  check('Desempenho: menos de 200 desenhos por quadro (selva + 15 animais)', info.calls < 200, JSON.stringify(info));
  check('Desempenho: menos de 700 mil triângulos (qualidade média)', info.tris < 700000, `${info.tris}`);
  await page.evaluate(() => window.__ilha.ctx.creatures.clear());
  await page.keyboard.press('F3');

  // ---------- Coleta ----------
  // Soco numa árvore: palha (e às vezes madeira)
  const tree = await page.evaluate(() => window.__t.faceRec('arvore_dossel'));
  await frames(page, 10);
  await gameWait(page, 250);
  const treePrompt = await page.evaluate(() => document.querySelector('.prompt:not([hidden])')?.textContent ?? null);
  check('Coleta: mirar numa árvore mostra o que sai dela', !!treePrompt && /Árvore/.test(treePrompt), treePrompt ?? 'nada');
  await page.screenshot({ path: `${SHOTS}/07-pc-coleta-arvore.png` });
  for (let i = 0; i < 4; i++) {
    await page.evaluate(() => { window.__ilha.ctx.player.stats.stamina = 100; });
    await page.mouse.down();
    await page.mouse.up();
    await gameWait(page, 520);
  }
  const thatch = await page.evaluate(() => ({ palha: window.__t.count('palha'), madeira: window.__t.count('madeira') }));
  check('Coleta: socar árvore dá palha', thatch.palha >= 4, `${JSON.stringify(tree)} ${JSON.stringify(thatch)}`);

  // Pedra: soco dá pedra
  await page.evaluate(() => window.__t.faceRec('pedra_musgo'));
  await frames(page, 6);
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => { window.__ilha.ctx.player.stats.stamina = 100; });
    await page.mouse.down();
    await page.mouse.up();
    await gameWait(page, 520);
  }
  const stones = await page.evaluate(() => window.__t.count('pedra'));
  check('Coleta: socar pedra dá pedra', stones >= 2, `pedra ${stones}`);

  // Colher bagas (Interagir)
  await page.evaluate(() => window.__t.faceRec('arbusto_mejo'));
  await frames(page, 8);
  await gameWait(page, 250);
  const berryPrompt = await page.evaluate(() => document.querySelector('.prompt:not([hidden])')?.textContent ?? null);
  await page.screenshot({ path: `${SHOTS}/07b-pc-colher-bagas.png` });
  await page.keyboard.press('KeyE');
  await frames(page, 4);
  const mejo = await page.evaluate(() => window.__t.count('baga_mejo'));
  check('Colher: E pega Baga-Mejo do arbusto', mejo > 0 && /Colher/.test(berryPrompt ?? ''), `${berryPrompt} → ${mejo}`);

  // Bananeira
  await page.evaluate(() => window.__t.faceRec('bananeira'));
  await frames(page, 8);
  await gameWait(page, 250);
  await page.keyboard.press('KeyE');
  await frames(page, 4);
  const bananas = await page.evaluate(() => window.__t.count('banana'));
  check('Colher: E pega bananas da bananeira', bananas > 0, `banana ${bananas}`);
  await page.screenshot({ path: `${SHOTS}/07c-pc-bananeira.png` });

  // Comer banana pela barra rápida
  const eat = await page.evaluate(() => {
    const { ctx } = window.__ilha;
    ctx.player.stats.food = 40;
    const i = ctx.inventory.slots.findIndex((s) => s && s.id === 'banana');
    return i;
  });
  await page.keyboard.press(`Digit${eat + 1}`);
  await frames(page, 3);
  const fed = await page.evaluate(() => window.__ilha.ctx.player.stats.food);
  check('Comer: tecla da barra rápida come a banana', eat >= 0 && eat < 8 && fed > 50, `espaço ${eat + 1}, fome ${fed.toFixed(1)}`);

  // ---------- Crafting ----------
  await page.evaluate(() => {
    const inv = window.__ilha.ctx.inventory;
    inv.add('madeira', 6); inv.add('pedra', 4); inv.add('silex', 2); inv.add('fibra', 20);
  });
  await page.keyboard.press('Tab');
  await frames(page, 4);
  const invOpen = await page.evaluate(() => ({ open: !document.querySelector('.inv').hidden, blocked: window.__ilha.ctx.touch.input.blocked }));
  check('Inventário: Tab abre a tela de inventário', invOpen.open && invOpen.blocked, JSON.stringify(invOpen));
  await page.click('#receita-machado_pedra');
  await frames(page, 2);
  const reqs = await page.evaluate(() => [...document.querySelectorAll('.reqs li')].map((li) => li.textContent.replace(/\s+/g, ' ').trim()));
  check('Crafting: clicar no machado mostra o que precisa', reqs.length === 3 && reqs.some((r) => /Madeira/.test(r)), reqs.join(' | '));
  await page.screenshot({ path: `${SHOTS}/08-pc-crafting.png` });
  await page.click('#craft-1');
  await gameWait(page, 3600);
  const axe = await page.evaluate(() => window.__t.count('machado_pedra'));
  check('Crafting: criar Machado de Pedra', axe === 1, `machados ${axe}`);
  // Largar um item: vira bolsa no chão
  const bags0 = await page.evaluate(() => window.__ilha.ctx.world.deathBags.length);
  const fiberSlot = await page.evaluate(() => window.__ilha.ctx.inventory.slots.findIndex((s) => s && s.id === 'fibra'));
  await page.click(`.inv-slot[data-i="${fiberSlot}"]`);
  await page.click('#it-drop');
  const bags1 = await page.evaluate(() => window.__ilha.ctx.world.deathBags.length);
  check('Inventário: Largar cria uma bolsa no chão', bags1 === bags0 + 1, `${bags0} -> ${bags1}`);
  await page.keyboard.press('Tab');
  await frames(page, 3);
  const invClosed = await page.evaluate(() => document.querySelector('.inv').hidden && !window.__ilha.ctx.touch.input.blocked);
  check('Inventário: Tab fecha de novo', invClosed);

  // Machado na mão: muito mais madeira
  const axeSlot = await page.evaluate(() => window.__ilha.ctx.inventory.slots.findIndex((s) => s && s.id === 'machado_pedra'));
  await page.keyboard.press(`Digit${axeSlot + 1}`);
  await page.evaluate(() => window.__t.faceRec('arvore_dossel', { x: 100, z: -300 }));
  await frames(page, 6);
  const wood0 = await page.evaluate(() => window.__t.count('madeira'));
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => { window.__ilha.ctx.player.stats.stamina = 100; });
    await page.mouse.down();
    await page.mouse.up();
    await gameWait(page, 680);
  }
  const wood1 = await page.evaluate(() => ({ madeira: window.__t.count('madeira'), tool: window.__ilha.ctx.actions.tool.tipo, hands: window.__ilha.ctx.hands.toolKind }));
  await page.screenshot({ path: `${SHOTS}/08b-pc-machado.png` });
  check('Machado: na mão e rende madeira (≥ 4 por golpe)', wood1.tool === 'machado' && wood1.hands === 'machado' && wood1.madeira - wood0 >= 10, `${wood0} -> ${JSON.stringify(wood1)}`);
  // devolve as plantas escondidas pelo teste
  await page.evaluate(() => { for (const r of window.__ilha.ctx.world.vegetation.recs) if (r._testHidden) { r.alive = true; delete r._testHidden; } });

  // ---------- Sobrevivência ----------
  const arm = await page.evaluate(() => ({ parts: window.__ilha.ctx.hands.root.children.length, leftShown: !!window.__ilha.ctx.hands.left.parent }));
  check('Braço: só um braço na tela', arm.parts === 1 && !arm.leftShown, JSON.stringify(arm));
  const early = await page.evaluate(() => {
    const c = window.__ilha.ctx;
    c.creatures.clear();
    c.creatures.enabled = true;
    c.player.aliveTime = 0;
    const p = { x: -230, z: -200, y: 0 };
    for (let i = 0; i < 40; i++) c.creatures.trySpawnNear(p, 55, 130);
    const carn = c.creatures.list.filter((x) => x.species.temperamento === 'agressivo' && !x.species.ambiente);
    const out = { carn: carn.length, maxLvl: Math.max(0, ...carn.map((x) => x.level)) };
    c.creatures.clear();
    c.creatures.enabled = false;
    return out;
  });
  check('Começo tranquilo: poucos carnívoros e de nível baixo', early.carn <= 4 && early.maxLvl <= 6, JSON.stringify(early));
  const fire = await page.evaluate(() => {
    const c = window.__ilha.ctx;
    const sul = c.world.respawnPoint('sul').position;
    c.player.position.set(sul.x + 8, c.world.heightAt(sul.x + 8, sul.z - 3), sul.z - 3);
    c.inventory.add('madeira', 4); c.inventory.add('carne_crua', 2); c.inventory.add('fogueira', 1);
    const i = c.inventory.slots.findIndex((x) => x && x.id === 'fogueira');
    c.camCtl.yaw = 0;
    c.actions.place(i);
    const f = c.world.structures.find((x) => x.type === 'fogueira');
    return { placed: !!f, lit: f?.lit };
  });
  check('Fogueira: colocar no chão', fire.placed && fire.lit === false, JSON.stringify(fire));
  await page.evaluate(() => {
    const c = window.__ilha.ctx;
    const f = c.world.structures.find((x) => x.type === 'fogueira');
    const p = c.player.position;
    c.camCtl.yaw = Math.atan2(p.x - f.position.x, p.z - f.position.z);
    c.camCtl.pitch = -0.5;
  });
  await gameWait(page, 400);
  const firePrompt = await page.evaluate(() => document.querySelector('.prompt:not([hidden])')?.textContent ?? '');
  await page.keyboard.press('KeyE');
  await gameWait(page, 13500);
  const cooked = await page.evaluate(() => {
    const c = window.__ilha.ctx;
    const f = c.world.structures.find((x) => x.type === 'fogueira');
    return { lit: f.lit, assada: c.inventory.count('carne_assada'), crua: c.inventory.count('carne_crua'), temp: Math.round(c.player.stats.temperature) };
  });
  check('Fogueira: acende com E e assa a carne', /Acender/.test(firePrompt) && cooked.lit && cooked.assada === 2 && cooked.crua === 0, `${firePrompt} → ${JSON.stringify(cooked)}`);
  await page.screenshot({ path: `${SHOTS}/07d-pc-fogueira.png` });
  const night = await page.evaluate(() => {
    const w = window.__ilha.ctx.world;
    w.time = 0.95;
    return null;
  });
  await gameWait(page, 400);
  const nightInfo = await page.evaluate(() => {
    const w = window.__ilha.ctx.world;
    return { night: w.sky.isNight, sun: +w.sky.sun.intensity.toFixed(2), fire: +w.fireLight.intensity.toFixed(2), clock: document.querySelector('.hud-clock').textContent };
  });
  await page.screenshot({ path: `${SHOTS}/07e-pc-noite.png` });
  check('Noite: escurece, relógio mostra a lua e a fogueira ilumina', nightInfo.night && nightInfo.sun < 0.6 && nightInfo.fire > 2 && /☾/.test(nightInfo.clock), JSON.stringify(nightInfo));
  const sleep = await page.evaluate(() => {
    const c = window.__ilha.ctx;
    c.inventory.add('saco_dormir', 1);
    c.camCtl.yaw = Math.PI;
    c.actions.place(c.inventory.slots.findIndex((x) => x && x.id === 'saco_dormir'));
    const bag = c.world.structures.find((x) => x.type === 'saco_dormir');
    const day0 = c.world.day;
    const ok = bag.use({ player: c.player, inventory: c.inventory });
    return { ok, morning: c.world.time > 0.25 && c.world.time < 0.3, day: c.world.day - day0, points: c.world.allRespawnPoints.length };
  });
  check('Saco de dormir: dorme até de manhã e vira ponto de renascer', sleep.ok && sleep.morning && sleep.day === 1 && sleep.points >= 7, JSON.stringify(sleep));
  const cycle = await page.evaluate(() => {
    const w = window.__ilha.ctx.world;
    // simula 10 min de jogo e mede dia e noite
    w.time = 0.22;
    let dayS = 0;
    let nightS = 0;
    // avança só o relógio (sem desenhar), em passos de 0,5 s
    for (let i = 0; i < 1200; i++) {
      const night = w.sky.isNight;
      w.advanceTime(0.5);
      if (night) nightS += 0.5; else dayS += 0.5;
    }
    w.time = 0.35;
    return { dia_min: +(dayS / 60).toFixed(2), noite_min: +(nightS / 60).toFixed(2) };
  });
  check('Dia dura 7 min e noite 3 min', Math.abs(cycle.dia_min - 7) < 0.15 && Math.abs(cycle.noite_min - 3) < 0.15, JSON.stringify(cycle));
  const ui = await page.evaluate(() => ({
    corner: [...document.querySelectorAll('.hud-corner .corner-btn')].map((b) => b.textContent.trim()).filter(Boolean),
    objective: !!document.querySelector('.objective'),
    som: window.__ilha.sound?.ctx?.state ?? 'sem som',
  }));
  check('Tela: sem "1ª pessoa", "FPS" e sem objetivos', !ui.corner.some((t) => /pessoa|FPS/.test(t)) && !ui.objective, JSON.stringify(ui));
  check('Som: ligado depois de jogar', ui.som === 'running', ui.som);
  await page.evaluate(() => { const w = window.__ilha.ctx.world; for (const st of w.structures) st.remove(); w.time = 0.35; });

  // Morte por afogamento: itens vão para o saco de morte
  const before = await page.evaluate(() => window.__ilha.ctx.inventory.slots.filter(Boolean).length);
  await page.evaluate(() => {
    const { ctx } = window.__ilha;
    ctx.player.position.set(0, ctx.world.heightAt(0, 600) + 0.1, 600);
    ctx.player.stats.oxygen = 0;
    ctx.player.stats.health = 3;
  });
  await page.keyboard.down('KeyC');
  await gameWait(page, 1500);
  await page.keyboard.up('KeyC');
  const dead = await page.evaluate(() => {
    const w = window.__ilha.ctx.world;
    const bag = w.deathBags[w.deathBags.length - 1];
    return {
      state: window.__ilha.game.state,
      screen: !document.querySelector('.death').hidden,
      cause: document.querySelector('.death-cause')?.textContent,
      bagItems: bag ? bag.items.length : 0,
      invLeft: window.__ilha.ctx.inventory.slots.filter(Boolean).length,
    };
  });
  check('Morte: tela de morte e itens no saco de morte', dead.state === 'dead' && dead.screen && dead.bagItems === before && dead.invLeft === 0, JSON.stringify({ ...dead, before }));
  await page.screenshot({ path: `${SHOTS}/09-pc-tela-de-morte.png` });

  const pins = await page.evaluate(() => ({ pins: document.querySelectorAll('.map-pin').length, labels: [...document.querySelectorAll('.map-label')].map((l) => l.textContent) }));
  check('Morte: mapa mostra os pontos de renascer e o Pântano', pins.pins >= 6 && pins.labels.includes('Pântano'), JSON.stringify(pins));
  await page.click('#respawn-leste');
  await page.click('#respawn-confirm');
  await frames(page, 20);
  const resp = await page.evaluate(() => ({
    state: window.__ilha.game.state,
    x: window.__ilha.ctx.player.position.x,
    health: window.__ilha.ctx.player.stats.health,
  }));
  check('Renascer na Praia Leste', resp.state === 'playing' && resp.x > 300 && resp.health === 100, JSON.stringify(resp));

  // Recuperar o saco de morte (E)
  await page.evaluate(() => {
    const { ctx } = window.__ilha;
    const w = ctx.world;
    const bag = w.deathBags[w.deathBags.length - 1];
    const p = bag.interactPoint;
    ctx.player.position.set(p.x, p.y - 0.5, p.z + 1);
    ctx.camCtl.yaw = 0;
    ctx.camCtl.pitch = -0.4;
  });
  await frames(page, 10);
  await gameWait(page, 300);
  await page.keyboard.press('KeyE');
  await frames(page, 4);
  const back = await page.evaluate(() => window.__ilha.ctx.inventory.slots.filter(Boolean).length);
  check('Saco de morte: E recupera os itens', back === before, `${back} de ${before}`);

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

  // Biomas: entrar no pântano mostra o nome na tela
  await page.evaluate(() => {
    const c = window.__ilha.ctx;
    document.querySelector('.biome-name').textContent = '';
    const p0 = c.world.layout.pantano.partes[0];
    c.player.position.set(p0.x, c.world.heightAt(p0.x, p0.z), p0.z);
    c.player.stats.water = 100; c.player.stats.food = 100; c.player.stats.oxygen = 100;
    c.camCtl.yaw = 0; c.camCtl.pitch = 0;
  });
  await gameWait(page, 2600);
  // (o aviso some sozinho depois de 4 s; aqui lemos o último nome mostrado)
  const banner = await page.evaluate(() => document.querySelector('.biome-name')?.textContent || null);
  check('Bioma: entrar no pântano mostra "Pântano"', !!banner && banner.includes('Pântano'), banner ?? 'nada');
  await page.screenshot({ path: `${SHOTS}/10-pc-pantano.png` });

  const biomes = await page.evaluate(() => {
    const w = window.__ilha.ctx.world;
    const count = {};
    for (let x = -460; x <= 460; x += 10) for (let z = -460; z <= 460; z += 10) {
      const k = w.biomeKeyAt(x, z);
      count[k] = (count[k] ?? 0) + 1;
    }
    return count;
  });
  const land = (biomes.selva ?? 0) + (biomes.igapo ?? 0) + (biomes.pantano ?? 0) + (biomes.praia ?? 0);
  check('Mapa: só floresta, igapó, pântano e praia', Object.keys(biomes).every((k) => ['mar', 'praia', 'selva', 'igapo', 'pantano'].includes(k)), JSON.stringify(biomes));
  check('Mapa: a maior parte da terra é Floresta Amazônica', biomes.selva / land > 0.5 && biomes.pantano > 0, `${Math.round((biomes.selva / land) * 100)}% floresta`);
  const plants = await page.evaluate(() => window.__ilha.ctx.world.vegetation.countByType());
  check('Floresta: samambaias gigantes, bananeiras, bagas e troncos caídos', ['samambaia_gigante', 'bananeira', 'arbusto_mejo', 'arbusto_escura', 'tronco_caido', 'sumauma'].every((k) => plants[k] > 20), JSON.stringify(plants));

  // Animais: todas as espécies nascem sem erro
  const species = await page.evaluate(() => {
    const c = window.__ilha.ctx;
    c.creatures.clear();
    c.player.position.set(-120, c.world.heightAt(-120, -190), -190);
    const ids = window.__ilha.speciesIds;
    const made = ids.map((id, i) => c.creatures.spawn(id, -200 + (i % 6) * 14, -230 + Math.floor(i / 6) * 14, 10)).filter(Boolean);
    return { total: ids.length, made: made.map((m) => m.species.id) };
  });
  await frames(page, 30);
  check('Animais: todas as espécies aparecem (≥ 20)', species.total >= 20 && species.made.length === species.total, `${species.made.length}/${species.total}`);
  await page.evaluate(() => {
    const c = window.__ilha.ctx;
    c.player.position.set(-165, c.world.heightAt(-165, -205), -205);
    for (const cr of c.creatures.list) { cr.species = { ...cr.species, temperamento: 'passivo' }; cr._setState?.('parado'); cr.idleFor = 99; }
    window.__ilha.photo = { pos: [-150, c.world.heightAt(-150, -190) + 14, -175], target: [-170, c.world.heightAt(-170, -210) + 2, -205] };
  });
  await frames(page, 20);
  await page.screenshot({ path: `${SHOTS}/11-pc-animais.png` });
  await page.evaluate(() => { window.__ilha.photo = null; window.__ilha.ctx.creatures.clear(); });

  // Carnívoro (raptor) ataca o jogador
  await page.evaluate(() => {
    const c = window.__ilha.ctx;
    const x = -230; const z = -200;
    c.player.position.set(x, c.world.heightAt(x, z), z);
    c.player.stats.health = 100;
    c.creatures.spawn('raptor', x + 7, z, 3);
  });
  await gameWait(page, 3500);
  const hurt = await page.evaluate(() => window.__ilha.ctx.player.stats.health);
  check('Carnívoro: raptor ataca o jogador', hurt < 100, `vida ${hurt.toFixed(0)}`);
  await page.evaluate(() => window.__ilha.ctx.creatures.clear());

  // Herbívoro só revida se apanhar
  const herb = await page.evaluate(async () => {
    const c = window.__ilha.ctx;
    const p = c.player.position;
    c.player.stats.health = 100;
    const t = c.creatures.spawn('paquicefalossauro', p.x + 5, p.z, 4);
    window.__herb = t;
    return !!t;
  });
  await gameWait(page, 2500);
  const calm = await page.evaluate(() => ({ health: window.__ilha.ctx.player.stats.health, target: !!window.__herb.target }));
  await page.evaluate(() => {
    const c = window.__ilha.ctx;
    window.__herb.takeDamage(5, c.player);
  });
  await gameWait(page, 3000);
  const angry = await page.evaluate(() => ({ health: window.__ilha.ctx.player.stats.health, target: window.__herb.target === window.__ilha.ctx.player }));
  check('Herbívoro: fica calmo até apanhar, depois revida', herb && calm.health === 100 && !calm.target && (angry.target || angry.health < 100), JSON.stringify({ calm, angry }));
  await page.evaluate(() => window.__ilha.ctx.creatures.clear());

  // Soco mata um dodô e dá XP; carcaça dá carne
  const xp0 = await page.evaluate(() => {
    const c = window.__ilha.ctx;
    c.player.stats.health = 100;
    c.player.stats.stamina = 100;
    c.inventory.selected = -1;
    const f = c.camCtl.forward;
    const p = c.player.position;
    const d = c.creatures.spawn('dodo', p.x + f.x * 1.6, p.z + f.z * 1.6, 1);
    d.speed = 0; d._setState('parado'); d.idleFor = 99;
    window.__dodo = d;
    return c.player.stats.xp + c.player.stats.level * 1000;
  });
  for (let i = 0; i < 10; i++) {
    await page.evaluate(() => {
      const c = window.__ilha.ctx; const d = window.__dodo; const p = c.player.position;
      if (d.alive) { const f = c.camCtl.forward; d.pos.x = p.x + f.x * 1.6; d.pos.z = p.z + f.z * 1.6; }
      c.player.stats.stamina = 100;
    });
    await page.mouse.down();
    await page.mouse.up();
    await gameWait(page, 550);
  }
  const punch = await page.evaluate(() => ({ alive: window.__dodo.alive, xp: window.__ilha.ctx.player.stats.xp + window.__ilha.ctx.player.stats.level * 1000, carne: window.__t.count('carne_crua') }));
  check('Soco: mata um dodô, ganha XP e tira carne da carcaça', !punch.alive && punch.xp > xp0 && punch.carne > 0, JSON.stringify(punch));
  await page.evaluate(() => window.__ilha.ctx.creatures.clear());

  // Mira numa criatura mostra nome, nível e vida
  await page.evaluate(() => {
    const c = window.__ilha.ctx;
    const p = c.player.position;
    const f = c.camCtl.forward;
    const t = c.creatures.spawn('paquicefalossauro', p.x + f.x * 9, p.z + f.z * 9, 7);
    t._setState('parado'); t.idleFor = 99;
    window.__aim = t;
  });
  // mantém o animal parado na mira por alguns instantes
  for (let i = 0; i < 6; i++) {
    await page.evaluate(() => {
      const c = window.__ilha.ctx;
      const t = window.__aim;
      const p = c.player.position;
      const y = c.camCtl.yaw;
      t.pos.set(p.x - Math.sin(y) * 9, c.world.heightAt(p.x - Math.sin(y) * 9, p.z - Math.cos(y) * 9), p.z - Math.cos(y) * 9);
      const cc = t.center();
      c.camCtl.pitch = Math.atan2(cc.y - (p.y + 1.57), 9);
    });
    await gameWait(page, 150);
  }
  const target = await page.evaluate(() => {
    const t = document.querySelector('.target');
    return t && !t.hidden ? t.textContent.replace(/\s+/g, ' ').trim() : null;
  });
  check('Mira: mostra nome e nível da criatura', !!target && /Paquicefalossauro/.test(target) && /Nv 7/.test(target), target ?? 'nada');
  await page.screenshot({ path: `${SHOTS}/12-pc-mira-criatura.png` });
  await page.evaluate(() => window.__ilha.ctx.creatures.clear());

  // Pausa com Esc (com o mouse preso no jogo, cliques vão para o 3D)
  await page.keyboard.press('Escape');
  await frames(page, 6);
  const paused = await page.evaluate(() => window.__ilha.game.state);
  await page.screenshot({ path: `${SHOTS}/13-pc-pausa.png` });
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
  await page.screenshot({ path: `${SHOTS}/20-cel-tela-inicial.png` });
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
    await gameWait(page, 30);
  }
  await gameWait(page, 1200);
  await page.screenshot({ path: `${SHOTS}/21-cel-andando-joystick.png` });
  await touch('touchEnd', []);
  const z1 = await page.evaluate(() => window.__ilha.ctx.player.position.z);
  check('Celular: joystick anda para frente', z1 < z0 - 2, `z ${z0.toFixed(1)} -> ${z1.toFixed(1)}`);

  // Arrastar o lado direito gira a câmera
  const yaw0 = await page.evaluate(() => window.__ilha.ctx.camCtl.yaw);
  await touch('touchStart', [{ x: 480, y: 160, id: 2 }]);
  for (let i = 1; i <= 8; i++) {
    await touch('touchMove', [{ x: 480 + i * 12, y: 160, id: 2 }]);
    await gameWait(page, 20);
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
  await gameWait(page, 150);
  const yj = await page.evaluate(() => window.__ilha.ctx.player.position.y);
  check('Celular: botão Pular', yj > yb + 0.2, `${yb.toFixed(2)} -> ${yj.toFixed(2)}`);

  // Na beira do pântano, o botão Interagir bebe
  await page.evaluate(() => {
    const { ctx } = window.__ilha;
    const w = ctx.world;
    const p0 = w.layout.pantano.partes[0];
    for (let a = 0; a < Math.PI * 2; a += 0.15) {
      const dx = Math.sin(a); const dz = Math.cos(a);
      let r = 5;
      while (r < 260 && w.waterAt(p0.x + dx * r, p0.z + dz * r)) r += 0.5;
      if (r < 20 || r >= 260) continue;
      const x = p0.x + dx * (r + 1.0); const z = p0.z + dz * (r + 1.0);
      if (w.waterAt(x, z)) continue;
      ctx.player.position.set(x, w.heightAt(x, z), z);
      ctx.camCtl.yaw = Math.atan2(dx, dz);
      break;
    }
    ctx.camCtl.pitch = -0.45;
    ctx.player.stats.water = 30;
  });
  await gameWait(page, 400);
  await page.screenshot({ path: `${SHOTS}/22-cel-pantano.png` });
  await page.tap('.b-interact');
  await frames(page, 5);
  const w = await page.evaluate(() => window.__ilha.ctx.player.stats.water);
  check('Celular: Interagir bebe no pântano', w > 35, `sede ${w.toFixed(1)}`);

  // Barra rápida e inventário no celular
  await page.evaluate(() => {
    const inv = window.__ilha.ctx.inventory;
    inv.add('machado_pedra', 1); inv.add('banana', 3); inv.add('madeira', 30); inv.add('palha', 40);
  });
  await frames(page, 3);
  const hb = await page.evaluate(() => {
    const el = document.querySelector('.hotbar');
    const r = el.getBoundingClientRect();
    return { visible: !el.hidden, w: r.width, left: r.left, right: r.right };
  });
  check('Celular: barra rápida aparece e cabe na tela', hb.visible && hb.left >= 0 && hb.right <= 800, JSON.stringify(hb));
  const axeIdx = await page.evaluate(() => window.__ilha.ctx.inventory.slots.findIndex((s) => s && s.id === 'machado_pedra'));
  await page.tap(`.hb-slot[data-i="${axeIdx}"]`);
  await frames(page, 3);
  const equipped = await page.evaluate(() => window.__ilha.ctx.actions.tool.tipo);
  check('Celular: tocar no machado da barra põe na mão', equipped === 'machado', equipped);
  await page.screenshot({ path: `${SHOTS}/23-cel-barra-rapida.png` });
  await page.tap('.corner-btn[data-action="inventory"]');
  await frames(page, 4);
  const invM = await page.evaluate(() => ({ open: !document.querySelector('.inv').hidden, touch: !document.querySelector('.tc').hidden }));
  await page.screenshot({ path: `${SHOTS}/24-cel-inventario.png` });
  check('Celular: botão Inventário abre a tela (sem botões por cima)', invM.open && !invM.touch, JSON.stringify(invM));
  await page.tap('#receita-lanca');
  await frames(page, 2);
  await page.screenshot({ path: `${SHOTS}/25-cel-receita-lanca.png` });
  await page.tap('#inv-close');
  await frames(page, 4);
  const invC = await page.evaluate(() => ({ open: !document.querySelector('.inv').hidden, touch: !document.querySelector('.tc').hidden }));
  check('Celular: Fechar volta ao jogo', !invC.open && invC.touch, JSON.stringify(invC));

  // Opções: opacidade e tamanho dos botões
  await page.tap('.corner-btn[data-action="pause"]');
  await frames(page, 6);
  await page.screenshot({ path: `${SHOTS}/26-cel-pausa-opcoes.png` });
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
  await gameWait(page, 300);
  await page.setViewportSize({ width: 360, height: 760 });
  await frames(page, 20);
  await page.screenshot({ path: `${SHOTS}/27-cel-em-pe.png` });
  await page.tap('.corner-btn[data-action="inventory"]');
  await frames(page, 4);
  await page.screenshot({ path: `${SHOTS}/28-cel-em-pe-inventario.png` });
  await page.tap('#inv-close');

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
  await page.tap('.corner-btn[data-action="inventory"]');
  await frames(page, 3);
  await page.evaluate(() => window.__ilhaBack());
  await frames(page, 3);
  const invBack = await page.evaluate(() => ({ inv: !document.querySelector('.inv').hidden, state: window.__ilha.game.state }));
  check('Android: voltar fecha o inventário', !invBack.inv && invBack.state === 'playing', JSON.stringify(invBack));
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

// ---------------------------------------------------------------
// CO-OP: dois jogadores (servidor de conexão local, sem internet)
// ---------------------------------------------------------------
{
  const { PeerServer } = require('peer');
  const server = PeerServer({ port: 9123, path: '/', host: '127.0.0.1' });
  await new Promise((r) => setTimeout(r, 400));
  const coopBrowser = await chromium.launch({
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-features=WebRtcHideLocalIpsWithMdns'],
  });
  const curl = `${url}?servidor=127.0.0.1:9123`;
  const errors = [];
  const openP = async (label) => {
    const c = await coopBrowser.newContext({ viewport: { width: 800, height: 450 } });
    await c.addInitScript(() => localStorage.setItem('ilha-primordial:opcoes', JSON.stringify({ version: 3, autoQuality: false, quality: 'baixa' })));
    const pg = await c.newPage();
    pg.on('pageerror', (e) => errors.push(`${label}: ${e.message}`));
    await pg.goto(curl);
    await pg.waitForFunction(() => !document.querySelector('#btn-play').disabled, null, { timeout: 60000 });
    return pg;
  };
  const A = await openP('A');
  const B = await openP('B');
  await A.fill('#coop-name', 'Rafa');
  await A.click('#btn-host');
  await A.waitForFunction(() => window.__ilha.net?.active, null, { timeout: 20000 }).catch(() => {});
  const code = await A.evaluate(() => window.__ilha.net?.code ?? '');
  check('Co-op: criar partida dá um código de 6 letras', /^[A-Z0-9]{6}$/.test(code), code);
  await B.fill('#coop-name', 'Amigo');
  await B.click('#btn-join-open');
  await B.fill('#coop-code', code);
  await B.click('#btn-join');
  await B.waitForFunction(() => window.__ilha.net?.active, null, { timeout: 30000 }).catch(() => {});
  await gameWait(A, 2500);
  await gameWait(B, 1000);
  const ia = await A.evaluate(() => ({ names: window.__ilha.net.playerNames, badge: document.querySelector('.coop-badge').textContent }));
  const ib = await B.evaluate(() => ({ names: window.__ilha.net.playerNames, net: window.__ilha.ctx.creatures.list.filter((x) => x.netControlled).length, all: window.__ilha.ctx.creatures.list.length }));
  check('Co-op: os dois entram e se veem', ia.names.includes('Amigo') && ib.names.includes('Rafa') && /2 jogadores/.test(ia.badge), JSON.stringify({ ia, ib }));
  check('Co-op: animais do anfitrião aparecem no convidado', ib.net > 0 && ib.net === ib.all, JSON.stringify(ib));
  await B.evaluate(() => { window.__ilha.ctx.player.position.x += 6; });
  await gameWait(B, 800);
  await gameWait(A, 800);
  const seen = await A.evaluate(() => [...window.__ilha.net.remotes.values()][0].position.x);
  const bx = await B.evaluate(() => window.__ilha.ctx.player.position.x);
  check('Co-op: posição do amigo chega', Math.abs(seen - bx) < 1, `${seen.toFixed(2)} vs ${bx.toFixed(2)}`);
  await A.evaluate(() => { const c = window.__ilha.ctx; c.inventory.add('fogueira', 1); c.actions.place(c.inventory.slots.findIndex((x) => x && x.id === 'fogueira')); });
  await gameWait(A, 600);
  await gameWait(B, 600);
  const bst = await B.evaluate(() => window.__ilha.ctx.world.structures.map((x) => x.type));
  check('Co-op: fogueira colocada aparece para o amigo', bst.includes('fogueira'), bst.join(','));
  // convidado mata um dodô do anfitrião
  const nid = await A.evaluate(() => {
    const c = window.__ilha.ctx;
    c.creatures.enabled = false;
    const b = [...window.__ilha.net.remotes.values()][0];
    const d = c.creatures.spawn('dodo', b.position.x, b.position.z - 3, 1);
    d._setState('parado'); d.idleFor = 99;
    window.__dodo = d;
    return d.id;
  });
  await gameWait(A, 800);
  await gameWait(B, 800);
  const xp0 = await B.evaluate(() => window.__ilha.ctx.player.stats.xp + window.__ilha.ctx.player.stats.level * 1000);
  await B.evaluate((n) => { const c = window.__ilha.ctx; const d = c.creatures.byNid(n); for (let i = 0; i < 6; i++) d?.takeDamage(12, c.player); }, nid);
  await gameWait(B, 1200);
  await gameWait(A, 600);
  const kill = await A.evaluate(() => !window.__dodo.alive);
  const xp1 = await B.evaluate(() => window.__ilha.ctx.player.stats.xp + window.__ilha.ctx.player.stats.level * 1000);
  check('Co-op: convidado acerta animal do anfitrião e ganha XP', kill && xp1 > xp0, JSON.stringify({ kill, xp0, xp1 }));
  // raptor do anfitrião ataca o convidado
  await A.evaluate(() => { const c = window.__ilha.ctx; const b = [...window.__ilha.net.remotes.values()][0]; c.creatures.spawn('raptor', b.position.x + 6, b.position.z, 3); });
  const h0 = await B.evaluate(() => window.__ilha.ctx.player.stats.health);
  await gameWait(A, 4000);
  await gameWait(B, 600);
  const h1 = await B.evaluate(() => window.__ilha.ctx.player.stats.health);
  check('Co-op: predador do anfitrião ataca o convidado', h1 < h0, `${h0} -> ${h1.toFixed(0)}`);
  await B.screenshot({ path: `${SHOTS}/30-coop-convidado.png` });
  await A.screenshot({ path: `${SHOTS}/31-coop-anfitriao.png` });
  await A.evaluate(() => window.__ilha.net.leave());
  await gameWait(B, 1500);
  const after = await B.evaluate(() => ({ active: window.__ilha.net.active, client: window.__ilha.ctx.creatures.netClient, state: window.__ilha.game.state }));
  check('Co-op: anfitrião sai e o amigo continua sozinho', !after.active && !after.client && after.state === 'playing', JSON.stringify(after));
  check('Co-op: sem erros', errors.length === 0, errors.slice(0, 3).join(' / '));
  await coopBrowser.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} testes passaram.`);
process.exit(failed.length ? 1 : 0);
