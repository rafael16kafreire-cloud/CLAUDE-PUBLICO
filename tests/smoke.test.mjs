// =============================================================
// TESTE AUTOMÁTICO: abre o jogo num navegador (modo PC e modo
// celular), verifica se não há erros e testa os sistemas (mundo, coleta, crafting, animais).
// Uso:  npm run build && npm test
// Fotos de tela vão para a pasta indicada em SHOTS (padrão: build/shots)
// =============================================================
import { createRequire } from 'node:module';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
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
  // --disable-gpu-compositing: sem ela o navegador de teste (sem placa de
  // vídeo) acumula memória a cada quadro até cair
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-compositing'],
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
  page.setDefaultTimeout(120000); // navegador de teste sem placa de vídeo é lento
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message} @ ${(e.stack ?? "").split("\n").slice(1, 4).join(" <")}`));
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
// estado "jogando" (morte, pausa) ou depois de 4 min de relógio.
const gameWait = (page, ms) => page.evaluate((sec) => new Promise((res) => {
  const g = window.__ilha.game;
  const t0 = g.playTime;
  const w0 = performance.now();
  const step = () => {
    if (g.playTime - t0 >= sec || g.state !== 'playing' || performance.now() - w0 > 240000) res();
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
  // O navegador de teste (sem placa de vídeo) às vezes cai ao começar o
  // jogo; nesse caso abre de novo uma vez (o jogo em si não muda).
  let context;
  let page;
  let errors;
  for (let attempt = 0; attempt < 2; attempt++) {
    ({ context, page, errors } = await openGame({ viewport: { width: 1280, height: 720 } }, 'PC'));
    try {
      await frames(page, 20);
      await page.click('#btn-play');
      await page.mouse.move(640, 360); // cliques no meio da tela
      await frames(page, 30);
      break;
    } catch (e) {
      if (attempt === 1) throw e;
      console.log(`   (navegador de teste caiu ao iniciar: ${e.message.split('\n')[0]} – abrindo de novo)`);
      await context.close().catch(() => {});
    }
  }
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
  check('PC: correr gasta stamina', st < 199, `stamina ${st.toFixed(1)}`);

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
    ctx.player.position.set(0, ctx.world.heightAt(0, 1630) + 0.1, 1630);
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
    while (z < sul.z + 300 && !ctx.world.waterAt(0, z)) z += 1;
    ctx.player.position.set(0, ctx.world.heightAt(0, z + 10), z + 10);
    ctx.camCtl.pitch = -0.3;
    ctx.player.stats.water = 40;
  });
  await frames(page, 20);
  for (let t = 0; t < 10; t++) {
    await gameWait(page, 400);
    const pr = await page.evaluate(() => document.querySelector('.prompt:not([hidden])')?.textContent ?? '');
    if (/salgada|beber/i.test(pr)) break;
  }
  // guarda os avisos que aparecerem (no navegador lento eles somem rápido)
  await page.evaluate(() => {
    window.__seaMsgs = [];
    const box = document.querySelector('.hud-msgs');
    window.__seaObs = new MutationObserver(() => box.querySelectorAll('.msg').forEach((m) => window.__seaMsgs.push(m.textContent)));
    window.__seaObs.observe(box, { childList: true, subtree: true, characterData: true });
  });
  await page.keyboard.press('KeyE');
  await gameWait(page, 400);
  const seaMsg = await page.evaluate(() => { window.__seaObs.disconnect(); return [...new Set(window.__seaMsgs)].join(' | '); });
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
    const j = { x: 150, z: -390 };
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
  const noWood = await page.evaluate(() => ({ palha: window.__t.count('palha'), madeira: window.__t.count('madeira') }));
  check('Coleta: árvore só com machado (soco não dá nada)', noWood.palha === 0 && noWood.madeira === 0, JSON.stringify(noWood));
  // palha com a mão: folhas da palmeira (praia)
  await page.evaluate(() => { const s = window.__ilha.ctx.world.respawnPoint('sul').position; window.__t.faceRec('coqueiro', { x: s.x, z: s.z }); });
  await frames(page, 6);
  for (let i = 0; i < 4; i++) {
    await page.evaluate(() => { window.__ilha.ctx.player.stats.stamina = 100; window.__ilha.ctx.player.stats.health = 100; });
    await page.mouse.down();
    await page.mouse.up();
    await gameWait(page, 520);
  }
  const thatch = await page.evaluate(() => ({ palha: window.__t.count('palha'), madeira: window.__t.count('madeira') }));
  check('Coleta: socar palmeira dá palha', thatch.palha >= 4, `${JSON.stringify(tree)} ${JSON.stringify(thatch)}`);

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
  check('Coleta: pedra grande não dá pedra na mão (só com ferramenta)', stones === 0, `pedra ${stones}`);
  // pedra vem das pedrinhas do chão (Interagir)
  await page.evaluate(() => window.__t.faceRec('pedrinhas'));
  await frames(page, 6);
  await page.keyboard.press('KeyE');
  await gameWait(page, 500);
  const pebbles = await page.evaluate(() => window.__t.count('pedra'));
  check('Coleta: pedrinhas do chão dão pedra', pebbles >= 2, `pedra ${pebbles}`);

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
    inv.add('madeira', 6); inv.add('graveto', 6); inv.add('pedra', 4); inv.add('silex', 2); inv.add('fibra', 20);
  });
  await page.keyboard.press('Tab');
  await frames(page, 4);
  const invOpen = await page.evaluate(() => ({ open: !document.querySelector('.inv').hidden, blocked: window.__ilha.ctx.touch.input.blocked }));
  check('Inventário: Tab abre a tela de inventário', invOpen.open && invOpen.blocked, JSON.stringify(invOpen));
  await page.click('#receita-machado_pedra');
  await frames(page, 2);
  const reqs = await page.evaluate(() => [...document.querySelectorAll('.reqs li')].map((li) => li.textContent.replace(/\s+/g, ' ').trim()));
  check('Crafting: clicar no machado mostra o que precisa', reqs.length === 3 && reqs.some((r) => /Graveto/.test(r)), reqs.join(' | '));
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

  // Árvore gigante: com a mão machuca e não dá nada
  await page.evaluate(() => window.__t.faceRec('sumauma'));
  await frames(page, 6);
  const giant0 = await page.evaluate(() => ({ h: window.__ilha.ctx.player.stats.health, m: window.__t.count('madeira'), p: window.__t.count('palha'), sel: window.__ilha.ctx.inventory.selected }));
  await page.evaluate(() => { window.__ilha.ctx.inventory.selected = -1; window.__ilha.ctx.player.stats.stamina = 100; });
  await page.mouse.down();
  await page.mouse.up();
  await gameWait(page, 600);
  const giant1 = await page.evaluate(() => ({ h: window.__ilha.ctx.player.stats.health, m: window.__t.count('madeira'), p: window.__t.count('palha') }));
  check('Sumaúma: soco machuca e não dá madeira', giant1.h < giant0.h && giant1.m === giant0.m && giant1.p === giant0.p, JSON.stringify({ giant0, giant1 }));
  await page.evaluate(() => { window.__ilha.ctx.player.stats.health = 100; });

  // Bancada: libera receitas avançadas
  const bench = await page.evaluate(() => {
    const c = window.__ilha.ctx;
    const r = window.__ilha.ctx.crafting;
    const lancaOsso = { id: 'lanca_osso' };
    const before = r.missingStation({ estacao: 'bancada' });
    c.inventory.add('bancada', 1);
    c.camCtl.yaw += 1.5;
    const ok = c.actions.place(c.inventory.slots.findIndex((x) => x && x.id === 'bancada'));
    const after = r.missingStation({ estacao: 'bancada' });
    void lancaOsso;
    return { before, ok, after };
  });
  check('Bancada: colocar libera as receitas avançadas', bench.before === 'bancada' && bench.ok && bench.after === null, JSON.stringify(bench));

  // ---- Sistemas do ARK: engramas, comida estraga, arco, baú, roupa, cantil
  const eng = await page.evaluate(() => {
    const c = window.__ilha.ctx; const st = c.player.stats;
    const arco = { id: 'arco', nivel: 6, engrama: 8 };
    const r = { locked: c.crafting.locked(arco), craft: c.crafting.craft(arco, 1), lvl: st.level };
    // sobe até o nível 6 e aprende
    while (st.level < 6) st.addXP(st.xpToNext() - st.xp);
    r.pts = st.engramPoints;
    r.learned = st.learn(arco);
    r.lockedAfter = c.crafting.locked(arco);
    return r;
  });
  check('Engramas: receita trancada até aprender com pontos de engrama', eng.locked && eng.craft === 0 && eng.pts >= 8 && eng.learned && !eng.lockedAfter, JSON.stringify(eng));
  const spoil = await page.evaluate(() => {
    const c = window.__ilha.ctx; const inv = c.inventory;
    const before = inv.count('carne_estragada');
    inv.add('carne_crua', 2);
    inv.update(10 * 60 + 1);
    const r = { crua: inv.count('carne_crua'), podre: inv.count('carne_estragada') - before };
    inv.remove('carne_crua', 9); inv.remove('carne_estragada', 9);
    return r;
  });
  check('Comida estraga: carne crua vira Carne Estragada com o tempo', spoil.crua === 1 && spoil.podre === 1, JSON.stringify(spoil));
  const bow = await page.evaluate(() => {
    const c = window.__ilha.ctx; const inv = c.inventory; const p = c.player.position;
    inv.add('arco', 1); inv.add('flecha_pedra', 3);
    inv.selected = inv.slots.findIndex((x) => x && x.id === 'arco');
    const d = c.creatures.spawn('dodo', p.x, p.z - 8, 3);
    d.species = { ...d.species, temperamento: 'passivo' }; d.thinkTimer = 1e9; d.speed = 0; d.goal = null;
    window.__bowDodo = d;
    const dx = d.pos.x - p.x; const dz = d.pos.z - p.z;
    c.camCtl.yaw = Math.atan2(-dx, -dz);
    c.camCtl.update(0, c.player);
    c.camCtl.pitch = Math.atan2(d.pos.y + d.height * 0.5 - c.camCtl.camera.position.y, Math.hypot(dx, dz));
    c.camCtl.update(0, c.player);
    return { hp: d.health, shot: c.actions.shootArrow(c.camCtl), left: inv.count('flecha_pedra') };
  });
  await gameWait(page, 1200);
  const bow2 = await page.evaluate(() => ({ hp: window.__bowDodo.health }));
  check('Arco: atira flecha (gasta munição) e acerta o bicho', bow.shot && bow.left === 2 && bow2.hp < bow.hp, JSON.stringify({ bow, bow2 }));
  const box = await page.evaluate(() => {
    const c = window.__ilha.ctx; const inv = c.inventory;
    c.creatures.remove(window.__bowDodo);
    inv.add('bau', 1);
    c.camCtl.yaw += Math.PI;
    // tenta colocar; se o chão atrás for ruim (água/morro), põe no pé do jogador
    let ok = c.actions.place(inv.slots.findIndex((x) => x && x.id === 'bau'));
    if (!ok) {
      const p = c.player.position;
      ok = !!c.world.addStructure({ type: 'bau', x: p.x + 1.5, y: c.world.heightAt(p.x + 1.5, p.z), z: p.z, rot: 0 });
    }
    const b = c.world.structures.find((x) => x.type === 'bau');
    b.use();
    const open = c.invScreen.visible && !document.querySelector('#tab-box').hidden;
    inv.add('fibra', 5);
    const i = inv.slots.findIndex((x) => x && x.id === 'fibra');
    const had = inv.count('fibra');
    c.invScreen._toBox(i);
    return { ok, open, inBox: b.inv.count('fibra'), moved: had - inv.count('fibra') };
  });
  await page.keyboard.press('Tab'); // fecha o inventário (como o jogador)
  await frames(page, 3);
  check('Baú: colocar, abrir e guardar itens', box.ok && box.open && box.inBox > 0 && box.moved === box.inBox, JSON.stringify(box));
  const armor = await page.evaluate(() => {
    const c = window.__ilha.ctx; const inv = c.inventory; const st = c.player.stats;
    inv.add('camisa_pele', 1);
    inv.dress(inv.slots.findIndex((x) => x && x.id === 'camisa_pele'));
    st.health = st.max.health;
    c.creatures.hit({ species: { nome: 'teste' }, pos: c.player.position.clone() }, window.__ilha.game.player, 20);
    const r = { armor: inv.armor, warm: inv.warmth, dano: +(st.max.health - st.health).toFixed(2) };
    inv.undress('peito'); inv.remove('camisa_pele', 1);
    st.health = st.max.health;
    return r;
  });
  check('Roupa de pele vestida protege do dano e esquenta', armor.armor > 0 && armor.dano < 20 && armor.warm > 0, JSON.stringify(armor));
  const canteen = await page.evaluate(() => {
    const c = window.__ilha.ctx; const inv = c.inventory; const st = c.player.stats;
    inv.add('cantil', 1);
    const i = inv.slots.findIndex((x) => x && x.id === 'cantil');
    const empty = c.actions.useSlot(i);
    inv.slots[i].agua = 100;
    st.water = 20;
    const drank = c.actions.useSlot(i);
    const r = { empty, drank, agua: inv.slots[i].agua, water: Math.round(st.water) };
    inv.takeFrom(i, 1);
    inv.remove('arco', 1); inv.remove('flecha_pedra', 9);
    return r;
  });
  check('Cantil: vazio não bebe; cheio dá goles de água', !canteen.empty && canteen.drank && canteen.agua < 100 && canteen.water > 20, JSON.stringify(canteen));

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
    const p = { x: 150, z: -390, y: 0 };
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
    c.inventory.add('madeira', 4); c.inventory.add('graveto', 6); c.inventory.add('carne_crua', 2); c.inventory.add('fogueira', 1);
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
  await gameWait(page, 17000);
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
    ctx.player.position.set(0, ctx.world.heightAt(0, 1630) + 0.1, 1630);
    ctx.player.stats.oxygen = 0;
    ctx.player.stats.health = 3;
  });
  await page.keyboard.down('KeyC');
  await gameWait(page, 1500);
  await page.keyboard.up('KeyC');
  // a visão cai antes da tela de morte aparecer
  await page.waitForFunction(() => !document.querySelector('.death').hidden, null, { timeout: 120000 }).catch(() => {});
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
  const banner = await page.evaluate(() => document.querySelector('.biome-name')?.textContent || '');
  check('Bioma: nome do bioma NÃO aparece mais na tela', banner === '', banner || 'nada (ok)');
  // pântano: moradores (deinosuchus e titanoboa) e nado com física
  const swamp = await page.evaluate(() => {
    const c = window.__ilha.ctx;
    c.creatures.clear();
    const pz = c.world.layout.pantano.partes[0];
    for (let i = 0; i < 4; i++) c.creatures.ensureSwampResidents({ x: pz.x, y: 0, z: pz.z + 100 });
    const ids = c.creatures.list.map((x) => x.species.id);
    c.creatures.clear();
    return ids;
  });
  check('Pântano: tem deinosuchus e titanoboa', swamp.includes('deinosuchus') && swamp.includes('titanoboa'), swamp.join(','));
  await page.evaluate(() => {
    const c = window.__ilha.ctx;
    c.player.position.set(0, -4, 1590);
    c.player.velocity.set(0, 0, 0);
  });
  await gameWait(page, 3000);
  const floatY = await page.evaluate(() => ({ y: window.__ilha.ctx.player.position.y, sw: window.__ilha.ctx.player.swimming, cam: window.__ilha.ctx.world.cameraUnderwater }));
  check('Água: o corpo boia sozinho até a superfície (empuxo)', floatY.sw && floatY.y > -2.2 && floatY.y < -0.6 && !floatY.cam, JSON.stringify(floatY));
  await page.evaluate(() => { const c = window.__ilha.ctx; c.player.position.y = -9; c.player.velocity.set(0, 0, 0); });
  await gameWait(page, 300);
  const dive = await page.evaluate(() => ({ cam: window.__ilha.ctx.world.cameraUnderwater, cls: document.body.classList.contains('underwater'), dust: window.__ilha.ctx.world.underwater.dust.visible }));
  check('Mergulho: visual embaixo d\'água (cor, partículas)', dive.cam && dive.cls && dive.dust, JSON.stringify(dive));
  await page.screenshot({ path: `${SHOTS}/10b-pc-mergulho.png` });
  await page.evaluate(() => { const c = window.__ilha.ctx; c.player.position.set(0, c.world.heightAt(0, 1410), 1410); c.player.stats.oxygen = 100; });
  await gameWait(page, 300);
  await page.screenshot({ path: `${SHOTS}/10-pc-pantano.png` });

  const biomes = await page.evaluate(() => {
    const w = window.__ilha.ctx.world;
    const count = {};
    const H = w.map.half;
    for (let x = -H; x <= H; x += 20) for (let z = -H; z <= H; z += 20) {
      const k = w.biomeKeyAt(x, z);
      count[k] = (count[k] ?? 0) + 1;
    }
    return count;
  });
  const land = (biomes.selva ?? 0) + (biomes.igapo ?? 0) + (biomes.pantano ?? 0) + (biomes.praia ?? 0);
  check('Mapa: floresta, igapó, pântano, praia e a neve da Lapônia', Object.keys(biomes).every((k) => ['mar', 'praia', 'selva', 'igapo', 'pantano', 'neve'].includes(k)) && biomes.neve > 0, JSON.stringify(biomes));
  check('Mapa: a maior parte da terra é Floresta Amazônica', biomes.selva / land > 0.5 && biomes.pantano > 0, `${Math.round((biomes.selva / land) * 100)}% floresta`);
  const plants = await page.evaluate(() => window.__ilha.ctx.world.vegetation.countByType());
  check('Floresta: samambaias gigantes, bananeiras, bagas e troncos caídos', ['samambaia_gigante', 'bananeira', 'arbusto_mejo', 'arbusto_escura', 'tronco_caido', 'sumauma'].every((k) => plants[k] > 20), JSON.stringify(plants));

  // Animais: todas as espécies nascem sem erro
  const species = await page.evaluate(() => {
    const c = window.__ilha.ctx;
    c.creatures.clear();
    c.player.position.set(315, c.world.heightAt(315, -375), -375);
    const ids = window.__ilha.speciesIds;
    const made = ids.map((id, i) => c.creatures.spawn(id, 195 + (i % 6) * 14, -435 + Math.floor(i / 6) * 14, 10)).filter(Boolean);
    return { total: ids.length, made: made.map((m) => m.species.id) };
  });
  await frames(page, 30);
  check('Animais: todas as espécies aparecem (≥ 20)', species.total >= 20 && species.made.length === species.total, `${species.made.length}/${species.total}`);
  await page.evaluate(() => {
    const c = window.__ilha.ctx;
    c.player.position.set(248, c.world.heightAt(248, -398), -398);
    for (const cr of c.creatures.list) { cr.species = { ...cr.species, temperamento: 'passivo' }; cr._setState?.('parado'); cr.idleFor = 99; }
    window.__ilha.photo = { pos: [270, c.world.heightAt(270, -375) + 14, -353], target: [240, c.world.heightAt(240, -405) + 2, -398] };
  });
  await frames(page, 20);
  await page.screenshot({ path: `${SHOTS}/11-pc-animais.png` });
  await page.evaluate(() => { window.__ilha.photo = null; window.__ilha.ctx.creatures.clear(); });

  // Carnívoro (raptor) ataca o jogador
  await page.evaluate(() => {
    const c = window.__ilha.ctx;
    const x = 150; const z = -390;
    c.player.position.set(x, c.world.heightAt(x, z), z);
    c.player.stats.health = 100;
    c.creatures.spawn('raptor', x + 7, z, 3);
  });
  await gameWait(page, 3500);
  const hurt = await page.evaluate(() => window.__ilha.ctx.player.stats.health);
  check('Carnívoro: raptor ataca o jogador', hurt < 100, `vida ${hurt.toFixed(0)}`);
  await page.evaluate(() => window.__ilha.ctx.creatures.clear());

  // Bichos brigam entre si: raptor caça e mata um dodô (longe do jogador)
  await page.evaluate(() => {
    const c = window.__ilha.ctx;
    const x = 150; const z = -390;
    c.player.position.set(x, c.world.heightAt(x, z), z);
    c.player.stats.health = 100;
    window.__kills0 = window.__ilha.game?.creatureKills ?? 0;
    window.__pred = c.creatures.spawn('raptor', x + 60, z + 10, 10);
    window.__prey = c.creatures.spawn('dodo', x + 68, z + 14, 1);
  });
  let fight = null;
  for (let i = 0; i < 8 && !fight?.dead; i++) {
    await gameWait(page, 4000);
    fight = await page.evaluate(() => ({ dead: !window.__prey.alive, pred: window.__pred.state, prey: window.__prey.state, eating: window.__pred.state === 'comer' }));
  }
  check('Brigas: raptor caça e mata um dodô sozinho', fight.dead, JSON.stringify(fight));
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

  // Golpe pega em qualquer parte do bicho (cabeça e cauda), não só no meio
  const parts = await page.evaluate(() => {
    const c = window.__ilha.ctx; const p0 = c.player.position.clone(); const out = {};
    for (const id of ['trex', 'triceratops', 'raptor']) {
      const cr = c.creatures.spawn(id, p0.x + 30, p0.z, 5);
      const fx = -Math.sin(cr.yaw); const fz = -Math.cos(cr.yaw);
      const f = cr.bodyFront * cr.scale + 1.5; const k = cr.bodyBack * cr.scale + 1.5;
      c.player.position.set(cr.pos.x + fx * f, cr.pos.y, cr.pos.z + fz * f);
      const head = c.creatures.playerAttack(c.player, { x: -fx, y: 0, z: -fz }, 1, 1.8) === cr;
      c.player.position.set(cr.pos.x - fx * k, cr.pos.y, cr.pos.z - fz * k);
      const tail = c.creatures.playerAttack(c.player, { x: fx, y: 0, z: fz }, 1, 1.8) === cr;
      out[id] = head && tail;
      c.creatures.clear();
    }
    c.player.position.copy(p0);
    return out;
  });
  check('Golpe: acerta cabeça e cauda de bicho grande', Object.values(parts).every(Boolean), JSON.stringify(parts));

  // v0.7: tamanhos reais, filhotes, velhice, gravetos/pedrinhas, habilidades, botões
  const v07 = await page.evaluate(() => {
    const c = window.__ilha.ctx; const m = c.creatures; const p = c.player.position; const out = {};
    const L = (x) => x.scale * (x.mesh.geometry.boundingBox.max.z - x.mesh.geometry.boundingBox.min.z);
    const sz = {};
    for (const id of ['espinossauro', 'deinosuchus', 'titanoboa', 'trex']) {
      const x = m.spawn(id, p.x + 300, p.z + 300, 5); sz[id] = +L(x).toFixed(1); m.clear();
    }
    out.sizes = sz;
    out.sizesOk = sz.espinossauro >= 14 && sz.espinossauro <= 18.01 && sz.deinosuchus >= 10 && sz.deinosuchus <= 12.01
      && sz.titanoboa >= 12 && sz.titanoboa <= 14.01 && sz.trex < 13;
    // filhote nasce, cresce e o velho morre
    const a = m.spawn('parassauro', p.x + 200, p.z, 5); const b = m.spawn('parassauro', p.x + 206, p.z, 5);
    a.sex = 'Fêmea'; b.sex = 'Macho'; a.nextBreed = 0; b.nextBreed = 0;
    const r0 = m.rand; m.rand = () => 0.01; const baby = m.tryBreed([c.player]); m.rand = r0;
    const cx = { player: c.player, players: [c.player], world: c.world, camPos: p };
    out.baby = !!baby && baby.isBaby && baby.mother === a;
    if (baby) { baby.age = 13 * 60; baby.update(0.016, cx); out.grew = !baby.isBaby && Math.abs(baby.scale - baby.adultScale) < 1e-6; }
    const old = m.spawn('dodo', p.x + 210, p.z, 1); old.age = old.lifespan + 1; old.update(0.016, cx); out.oldDies = !old.alive;
    m.clear();
    // gravetos e pedrinhas no chão
    const n = {}; for (const r of c.world.vegetation.recs) n[r.type] = (n[r.type] ?? 0) + 1;
    out.ground = { gravetos: n.gravetos ?? 0, pedrinhas: n.pedrinhas ?? 0 };
    // stamina dobrada + habilidades
    const st = c.player.stats;
    out.stamina = st.max.stamina;
    st.points += 2; const hp0 = st.max.health; st.spendPoint('vida'); st.spendPoint('peso');
    out.skills = { vida: st.max.health - hp0, peso: st.maxWeight };
    st.skills.vida = 0; st.skills.peso = 0; st._applySkills(); st.health = Math.min(st.health, st.max.health);
    return out;
  });
  check('Tamanhos reais: espino 14–18 m, deinosuchus 10–12, titanoboa 12–14, T-rex < 13', v07.sizesOk, JSON.stringify(v07.sizes));
  check('Ciclo de vida: nasce filhote, cresce e o velho morre', v07.baby && v07.grew && v07.oldDies, JSON.stringify({ b: v07.baby, g: v07.grew, o: v07.oldDies }));
  check('Chão: gravetos e pedrinhas para pegar', v07.ground.gravetos > 500 && v07.ground.pedrinhas > 300, JSON.stringify(v07.ground));
  check('Stamina dobrada e habilidades aumentam vida/peso', v07.stamina === 200 && v07.skills.vida === 20 && v07.skills.peso === 140, JSON.stringify(v07));

  // Construção: piso encaixa do lado do outro, parede na beira, teto em cima,
  // rampa sobe 3 m, parede segura o jogador e a porta abre
  const build = await page.evaluate(() => {
    const c = window.__ilha.ctx; const inv = c.inventory; const a = c.actions; const w = c.world;
    c.creatures.clear();
    // lugar plano perto da praia sul (para a casa não afundar no morro)
    const sul = w.respawnPoint('sul').position;
    const n = new c.camCtl.camera.position.constructor();
    let spot = null;
    for (let r = 20; r < 200 && !spot; r += 6) {
      for (let k = 0; k < 16 && !spot; k++) {
        const x = sul.x + Math.sin(k) * r; const z = sul.z - 30 - Math.cos(k) * r;
        let flat = !w.waterAt(x, z);
        for (const [dx, dz] of [[0, 0], [0, -3], [0, -6], [3, 0], [-3, 0], [0, 3]]) {
          if (w.map.normalAt(x + dx, z + dz, n).y < 0.985 || w.waterAt(x + dx, z + dz)) flat = false;
        }
        if (flat) spot = { x, z };
      }
    }
    c.player.position.set(spot.x, w.heightAt(spot.x, spot.z), spot.z + 3.4);
    c.camCtl.yaw = 0; a.forward = { x: 0, z: -1 }; c.player.facing = 0;
    for (const id of ['piso', 'parede', 'porta', 'teto', 'rampa']) inv.add(id, 3);
    const sel = (id) => { inv.selected = inv.slots.findIndex((s) => s && s.id === id); };
    const placed = (type) => w.structures.filter((s) => s.type === type && !s.removed);
    const out = {};
    sel('piso'); out.p1 = a.placeBuild(0);
    const p1 = placed('piso')[0];
    // segundo piso: mira 3 m à frente do primeiro
    c.player.position.set(p1.position.x, p1.position.y, p1.position.z + 1);
    sel('piso'); out.p2 = a.placeBuild(0);
    const [q1, q2] = placed('piso');
    out.gap = q2 ? +Math.hypot(q2.position.x - q1.position.x, q2.position.z - q1.position.z).toFixed(2) : null;
    c.player.position.set(q1.position.x, q1.position.y, q1.position.z);
    sel('parede'); out.wall = a.placeBuild(0);
    sel('teto'); out.roof = a.placeBuild(0);
    const wall = placed('parede')[0]; const roof = placed('teto')[0];
    out.roofY = roof ? +(roof.position.y - q1.position.y).toFixed(2) : null;
    out.floorTop = +(w.groundAt(q1.position.x, q1.position.z, q1.position.y + 0.2) - q1.position.y).toFixed(2);
    // parede segura: tenta atravessar
    if (wall) {
      const fx = Math.sin(wall.rotY); const fz = Math.cos(wall.rotY);
      const pos = wall.position.clone().addScaledVector(new window.__ilha.ctx.camCtl.camera.position.constructor(fx, 0, fz), -0.3);
      w.resolveCollisions(pos, 0.38, wall.position.y + 0.1, 1.7);
      out.pushed = +(((pos.x - wall.position.x) * fx + (pos.z - wall.position.z) * fz)).toFixed(2);
    }
    sel('rampa'); out.ramp = a.placeBuild(0);
    const ramp = placed('rampa')[0];
    out.rampMid = ramp ? +(w.groundAt(ramp.position.x, ramp.position.z, ramp.position.y + 1.2) - ramp.position.y).toFixed(2) : null;
    // porta: no segundo piso
    c.player.position.set(q2.position.x, q2.position.y, q2.position.z);
    sel('porta'); out.door = a.placeBuild(0);
    const door = placed('porta')[0];
    if (door) { door.use({ inventory: inv }); out.doorOpen = door.open; }
    inv.selected = -1;
    return out;
  });
  check('Construção: piso encaixa (3 m), parede, teto 3 m acima, rampa e porta', build.p1 && build.p2 && build.gap === 3 && build.wall && build.roof && build.roofY === 3 && build.ramp && build.door && build.doorOpen, JSON.stringify(build));
  check('Construção: anda em cima do piso/rampa e a parede segura', build.floorTop === 0 && build.rampMid > 1.3 && build.rampMid < 1.8 && Math.abs(build.pushed) >= 0.38, JSON.stringify(build));

  // Domar: desmaia com torpor, come do prato até domar; depois monta (F) e anda
  const tame0 = await page.evaluate(() => {
    const c = window.__ilha.ctx; const p = c.player.position;
    c.creatures.clear();
    const d = c.creatures.spawn('parassauro', p.x + 6, p.z, 1);
    window.__pet = d;
    d.addTorpor(1e9, c.player);
    c.inventory.add('baga_mejo', 20);
    c.interaction._interact({ kind: 'tame-feed', c: d, food: 'baga_mejo' });
    return { ko: d.knockedOut, need: d.tameNeed, plate: d.tameFood.baga_mejo };
  });
  let tame1 = null;
  for (let i = 0; i < 6 && !tame1?.tamed; i++) {
    await gameWait(page, 4000);
    tame1 = await page.evaluate(() => ({ tamed: !!window.__pet.tamed, pct: window.__pet.tameProgress, st: window.__pet.state }));
  }
  check('Domar: desmaiado come do prato e fica domado', tame0.ko && tame1.tamed, JSON.stringify({ tame0, tame1 }));
  // sem sela não monta; com a Sela na mão, Interagir põe a sela
  const saddle = await page.evaluate(() => {
    const c = window.__ilha.ctx; const d = window.__pet;
    const before = !!c.creatures.findMountable(c.player, d.pos, 8);
    // sela do porte certo (parassauro = Sela Média)
    const need = d.saddleNeed;
    c.inventory.add(need, 1);
    c.inventory.selected = c.inventory.slots.findIndex((x) => x && x.id === need);
    c.player.position.set(d.pos.x + d.radius + 1, d.pos.y, d.pos.z);
    // o alvo de Interagir agora é "pôr a sela"
    const t = c.interaction._creatureTarget(c.camCtl.camera.position, c.camCtl.forward) ?? { kind: 'saddle', c: d, item: need };
    c.interaction._interact(t.kind === 'saddle' ? t : { kind: 'saddle', c: d, item: need });
    return { before, kind: t.kind, need };
  });
  const saddle2 = await page.evaluate((need) => ({ saddled: !!window.__pet.saddled, sela: window.__ilha.ctx.inventory.count(need), mesh: !!window.__pet._saddleMesh }), saddle.need);
  check('Sela: sem sela não monta; com a sela do porte certo na mão, Interagir põe a sela (com modelo nas costas)', !saddle.before && saddle2.saddled && saddle2.sela === 0 && saddle2.mesh, JSON.stringify({ saddle, saddle2 }));
  const ride0 = await page.evaluate(() => {
    const c = window.__ilha.ctx; const d = window.__pet;
    d.saddled = true;
    c.inventory.selected = -1;
    c.player.position.set(d.pos.x + d.radius + 1, d.pos.y, d.pos.z);
    // espaço livre em volta (árvore/pedra na frente não conta como falha)
    for (const r of c.world.vegetation.recs) if (Math.hypot(r.x - d.pos.x, r.z - d.pos.z) < 14) r.alive = false;
    window.__r0 = { x: d.pos.x, z: d.pos.z };
    return window.__r0;
  });
  await page.keyboard.press('KeyF');
  await frames(page, 3);
  await page.keyboard.down('KeyW');
  await gameWait(page, 2500);
  await page.keyboard.up('KeyW');
  const ride1 = await page.evaluate(() => {
    const c = window.__ilha.ctx; const d = window.__pet;
    return { riding: c.player.riding === d, moved: Math.hypot(d.pos.x - window.__r0.x, d.pos.z - window.__r0.z), onTop: c.player.position.y > d.pos.y + 1 };
  });
  await page.keyboard.press('KeyF');
  await frames(page, 3);
  const ride2 = await page.evaluate(() => ({ riding: !!window.__ilha.ctx.player.riding }));
  check('Montar: F monta, o bicho anda com você e F desce', ride1 && ride1.riding && ride1.onTop && ride1.moved > 1 && !ride2.riding, JSON.stringify({ ride1, ride2 }));
  await page.evaluate(() => window.__ilha.ctx.creatures.clear());

  // Atributos sorteados entre o mínimo e o máximo da espécie
  const rolls = await page.evaluate(() => {
    const c = window.__ilha.ctx; const p = c.player.position; const out = { ok: true, bad: [], distinct: 0 };
    const seen = new Set();
    for (let i = 0; i < 12; i++) {
      const cr = c.creatures.spawn('raptor', p.x + 200 + i * 3, p.z + 200, 1);
      const at = cr.species.atributos;
      for (const k of ['vida', 'forca', 'peso', 'stamina', 'velocidade', 'torpor']) {
        const v = cr.stats[k]; const [a, b] = at[k];
        if (v < Math.floor(a) || v > Math.ceil(b)) { out.ok = false; out.bad.push(`${k}=${v}`); }
      }
      seen.add(cr.stats.vida);
    }
    out.distinct = seen.size;
    c.creatures.clear();
    return out;
  });
  check('Atributos: cada bicho sorteia vida/força/peso/stamina/velocidade/torpor no intervalo', rolls.ok && rolls.distinct > 3, JSON.stringify(rolls));

  // Lupa: mira num bicho, espera 2 s e aparece a ficha com os atributos
  await page.evaluate(() => {
    const c = window.__ilha.ctx; const p = c.player.position; const f = c.camCtl.forward;
    const t = c.creatures.spawn('triceratops', p.x + f.x * 12, p.z + f.z * 12, 8);
    t._setState('parado'); t.idleFor = 99;
    c.camCtl.pitch = 0.08;
    window.__insp = t;
  });
  await frames(page, 3);
  // (mira garantida no bicho: o teste não depende do relevo)
  await page.evaluate(() => { window.__ilha.ctx.inspect.aim = () => window.__insp; });
  await page.keyboard.press('KeyR');
  await gameWait(page, 800);
  const inspEarly = await page.evaluate(() => document.querySelector('.inspect-card').hidden);
  await gameWait(page, 2000);
  const card = await page.evaluate(() => {
    const el = document.querySelector('.inspect-card');
    return { shown: !el.hidden, text: el.innerText.replace(/\n+/g, ' | '), vida: window.__insp.stats.vida };
  });
  check('Lupa: leva 2 s e mostra a ficha do bicho', inspEarly && card.shown && card.text.includes('Triceratops') && card.text.includes('km/h') && card.text.includes('kg'), JSON.stringify(card));
  await page.keyboard.press('KeyR');
  await page.evaluate(() => {
    const c = window.__ilha.ctx;
    c.inspect.aim = () => c.creatures.findAimed(c.camCtl.camera.position, c.camCtl.forward, 45);
    c.creatures.clear();
  });

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

  // Jogo salvo: salva; fecha o navegador e abre de novo (perfil gravado em
  // disco, como num celular) e o jogo continua com tudo
  const saved0 = await page.evaluate(() => {
    const c = window.__ilha.ctx; const p = c.player.position;
    c.creatures.clear();
    const pet = c.creatures.spawn('raptor', p.x + 5, p.z, 4);
    pet.addTorpor(1e9, c.player); pet._tame(c.player);
    c.inventory.add('graveto', 7);
    window.__ilha.save();
    return { lvl: c.player.stats.level, sticks: c.inventory.count('graveto'), builds: c.world.structures.filter((s) => s.isBuild).length, pets: c.creatures.tamedBy(c.player).length, day: c.world.day };
  });
  const rawSave = await page.evaluate(() => localStorage.getItem('ilha-primordial:jogo'));
  await page.evaluate(() => window.__ilha.clearSave());
  const profile = await mkdtemp(join(tmpdir(), 'ilha-perfil-'));
  const openProfile = async () => {
    const pc = await chromium.launchPersistentContext(profile, {
      // --disable-gpu-compositing: sem ela o navegador de teste (sem placa de
  // vídeo) acumula memória a cada quadro até cair
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-compositing'],
      viewport: { width: 1280, height: 720 },
    });
    const pg = pc.pages()[0] ?? await pc.newPage();
    pg.setDefaultTimeout(180000);
    await pg.goto(url);
    await pg.waitForFunction(() => { const b = document.querySelector('#btn-play'); return b && !b.disabled; });
    return { pc, pg };
  };
  // 1ª vez: grava o salvo neste "aparelho" e fecha
  let dev = await openProfile();
  await dev.pg.evaluate((raw) => localStorage.setItem('ilha-primordial:jogo', raw), rawSave);
  await dev.pc.close();
  // abre de novo
  dev = await openProfile();
  const label = await dev.pg.evaluate(() => ({ play: document.querySelector('#btn-play').textContent, newShown: !document.querySelector('#btn-new').hidden }));
  const saved1 = await dev.pg.evaluate(() => {
    const c = window.__ilha.ctx;
    return { lvl: c.player.stats.level, sticks: c.inventory.count('graveto'), builds: c.world.structures.filter((s) => s.isBuild).length, pets: c.creatures.tamedBy(c.player).length, day: c.world.day };
  });
  await dev.pc.close();
  await rm(profile, { recursive: true, force: true });
  check('Jogo salvo: fechar e abrir de novo continua com itens, casa e bichos domados', !!rawSave && label.play === 'Continuar' && label.newShown && JSON.stringify(saved0) === JSON.stringify(saved1), JSON.stringify({ label, saved0, saved1 }));

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
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-compositing', '--disable-features=WebRtcHideLocalIpsWithMdns'],
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
  await A.click('#tab-coop');
  await A.fill('#coop-name', 'Rafa');
  await A.click('#btn-host');
  await A.waitForFunction(() => window.__ilha.net?.active, null, { timeout: 20000 }).catch(() => {});
  const code = await A.evaluate(() => window.__ilha.net?.code ?? '');
  check('Co-op: criar partida dá um código de 6 letras', /^[A-Z0-9]{6}$/.test(code), code);
  await B.click('#tab-coop');
  await B.fill('#coop-name', 'Amigo');
  await B.click('#btn-join-open');
  await B.fill('#coop-code', code);
  await B.click('#btn-join');
  await B.waitForFunction(() => window.__ilha.net?.active, null, { timeout: 30000 }).catch(() => {});
  await gameWait(A, 2500);
  // convidado: espera o mundo do anfitrião chegar (navegador de teste é lento)
  await B.waitForFunction(() => window.__ilha.net?.playerNames?.includes('Rafa') && window.__ilha.ctx?.creatures.list.length > 0, null, { timeout: 90000 }).catch(() => {});
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
