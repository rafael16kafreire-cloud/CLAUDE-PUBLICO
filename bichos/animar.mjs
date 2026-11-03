// Anima um modelo parado (da IA do Blender, Sketchfab livre…).
// Uso: node animar.mjs config/<bicho>.json
//   config: { "nome": "trex", "titulo": "T-Rex", "modelo": "caminho/do/modelo_parado.glb",
//             "comprimento": 12, "rot": [0,0,0], "tipo": "bipede", "ataque": "mordida", "rugido": "baixo",
//             "cabeca": 0.13, "braco": 0.06, "ajuste": { ...medidas para corrigir à mão... } }
// O modelo parado sai do blender/preparar.py. Gera modelos/<nome>.glb e previas/<nome>_*.jpg
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const { chromium } = createRequire(import.meta.url)('playwright');
const here = dirname(fileURLToPath(import.meta.url));
const cfgPath = resolve(process.argv[2]), cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));
const modelo = resolve(dirname(cfgPath), cfg.modelo);
mkdirSync(join(here, 'modelos'), { recursive: true }); mkdirSync(join(here, 'previas'), { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 800, height: 500 } });
page.setDefaultTimeout(600000);
page.on('pageerror', e => console.error('ERRO NA PÁGINA:', e.message));
if (process.env.THREE_DIR) await page.route('https://cdn.jsdelivr.net/npm/three@0.160.0/**', route => {
  const f = join(process.env.THREE_DIR, new URL(route.request().url()).pathname.replace('/npm/three@0.160.0/', ''));
  if (!existsSync(f)) return route.fulfill({ status: 404 });
  route.fulfill({ body: readFileSync(f), contentType: 'text/javascript' });
});
await page.goto(pathToFileURL(join(here, 'index.html')).href);
await page.waitForFunction(() => window.__ready === true);
await page.evaluate(() => { document.getElementById('painel').style.display = 'none'; window.__frozen = true; });
const res = await page.evaluate(([b, c]) => window.__api.importar(b, c), [readFileSync(modelo).toString('base64'), cfg]);
console.log(`${cfg.nome}: ${res.tris} triângulos; medidas:`, JSON.stringify(res.medidas));
writeFileSync(join(here, 'modelos', cfg.nome + '.glb'), Buffer.from(await page.evaluate(n => window.__api.export(n), cfg.nome), 'base64'));
// foto com os ossos aparecendo (para conferir o encaixe)
await page.evaluate(n => { window.__api.ossos(true); window.__api.show(n); window.__api.play('parado', 0); }, cfg.nome);
await page.evaluate(() => window.__api.setCam(...window.__lado()));
await page.waitForTimeout(300);
await page.screenshot({ path: join(here, 'previas', `${cfg.nome}_ossos.jpg`), type: 'jpeg', quality: 85 });
await page.evaluate(n => { window.__api.ossos(false); window.__api.show(n); }, cfg.nome);
const info = await page.evaluate(n => window.__api.info(n), cfg.nome);
for (const [anim, dur] of info.anims) {
  const t = { parado: 0.4, andar: 0.25, correr: 0.15, comer: 0.6, dormir: 1, morrer: dur }[anim] ?? dur * 0.55;
  await page.evaluate(([a, t]) => window.__api.play(a, t), [anim, t]);
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(here, 'previas', `${cfg.nome}_${anim}.jpg`), type: 'jpeg', quality: 85 });
}
console.log('animações:', info.anims.map(a => a[0]).join(', '));
await browser.close();
