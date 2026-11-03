// Gera os .glb dos bichos e as imagens de prévia (uma por animação).
// Uso: node exportar.mjs [nome...]      (precisa do pacote "playwright")
// Opcional: THREE_DIR=/caminho/node_modules/three  para usar o three.js local em vez da CDN.
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const { chromium } = createRequire(import.meta.url)('playwright');
const here = dirname(fileURLToPath(import.meta.url));
const outModels = join(here, 'modelos'), outPrev = join(here, 'previas');
mkdirSync(outModels, { recursive: true }); mkdirSync(outPrev, { recursive: true });

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 800, height: 500 } });
page.setDefaultTimeout(600000);
page.on('pageerror', e => console.error('ERRO NA PÁGINA:', e.message));
page.on('console', m => { if (m.type() === 'error') console.error('console:', m.text()); });
if (process.env.THREE_DIR) {
  await page.route('https://cdn.jsdelivr.net/npm/three@0.160.0/**', route => {
    const rel = new URL(route.request().url()).pathname.replace('/npm/three@0.160.0/', '');
    const file = join(process.env.THREE_DIR, rel);
    if (!existsSync(file)) return route.fulfill({ status: 404 });
    route.fulfill({ body: readFileSync(file), contentType: 'text/javascript' });
  });
}
await page.goto(pathToFileURL(join(here, 'index.html')).href);
await page.waitForFunction(() => window.__ready === true);
await page.evaluate(() => { document.getElementById('painel').style.display = 'none'; window.__frozen = true; });

const names = process.argv.slice(2).length ? process.argv.slice(2) : await page.evaluate(() => window.__api.names);
for (const n of names) {
  const info = await page.evaluate(n => window.__api.info(n), n);
  writeFileSync(join(outModels, info.arquivo), Buffer.from(await page.evaluate(n => window.__api.export(n), n), 'base64'));
  console.log(`${info.arquivo}: ${info.tris} triângulos, ${info.ossos.length} ossos, animações: ${info.anims.map(a => a[0]).join(', ')}`);
  await page.evaluate(n => window.__api.show(n), n);
  for (const [anim, dur] of info.anims) {
    const t = { parado: 0.4, andar: 0.25, correr: 0.15, atacar: dur * 0.6, rugir: dur * 0.5, comer: 0.6, dormir: 1, morrer: dur }[anim] ?? dur * 0.5;
    await page.evaluate(([a, t]) => { window.__api.play(a, t); }, [anim, t]);
    await page.waitForTimeout(400);
    await page.screenshot({ path: join(outPrev, `${n}_${anim}.jpg`), type: 'jpeg', quality: 85 });
  }
}
await browser.close();
// close da cabeça (opcional): CLOSE=nome
if (process.env.CLOSE) {
  const b2 = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p2 = await b2.newPage({ viewport: { width: 800, height: 500 } }); p2.setDefaultTimeout(600000);
  if (process.env.THREE_DIR) await p2.route('https://cdn.jsdelivr.net/npm/three@0.160.0/**', route => {
    const rel = new URL(route.request().url()).pathname.replace('/npm/three@0.160.0/', '');
    route.fulfill({ body: readFileSync(join(process.env.THREE_DIR, rel)), contentType: 'text/javascript' });
  });
  await p2.goto(pathToFileURL(join(here, 'index.html')).href); await p2.waitForFunction(() => window.__ready === true);
  await p2.evaluate(n => { document.getElementById('painel').style.display = 'none'; window.__frozen = true; window.__api.show(n); window.__api.play('parado', 0.4); }, process.env.CLOSE);
  const [cp, ct] = JSON.parse(process.env.CLOSE_CAM);
  await p2.evaluate(([cp, ct]) => window.__api.setCam(cp, ct), [cp, ct]); await p2.waitForTimeout(400);
  await p2.screenshot({ path: join(outPrev, `${process.env.CLOSE}_cabeca.jpg`), type: 'jpeg', quality: 88 });
  await b2.close();
}
