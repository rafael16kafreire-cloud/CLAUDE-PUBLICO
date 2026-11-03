// Gera todos os arquivos .glb e imagens de prévia sem abrir o navegador.
// Uso:  node exportar.mjs            (precisa do pacote "playwright")
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
const page = await browser.newPage({ viewport: { width: 1400, height: 820 } });
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
await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });

const names = await page.evaluate(() => window.__api.names);
const save = (file, b64) => writeFileSync(file, Buffer.from(b64, 'base64'));
for (const n of process.env.SEM_MODELOS ? [] : names) {
  save(join(outModels, n + '.glb'), await page.evaluate(n => window.__api.exportPiece(n), n));
  const tris = await page.evaluate(n => window.__api.tris(n), n);
  console.log(`${n}.glb  (${tris} triângulos)`);
}
if (!process.env.SEM_MODELOS) {
save(join(outModels, 'kit_construcao.glb'), await page.evaluate(() => window.__api.exportKit()));
const scenes = await page.evaluate(() => window.__api.scenes);
for (const [k, file] of Object.entries(scenes)) save(join(outModels, file + '.glb'), await page.evaluate(k => window.__api.exportScene(k), k));
console.log('kit_construcao.glb,', Object.values(scenes).map(f => f + '.glb').join(', '));

// tabela de materiais (custos.json para o jogo e CUSTOS.md para ler)
const { pecas, cenas } = await page.evaluate(() => window.__api.custos());
const recursos = await page.evaluate(() => window.__api.recursos);
writeFileSync(join(here, 'custos.json'), JSON.stringify({ recursos, pecas, cenas }, null, 2) + '\n');
const cols = Object.keys(recursos), cell = (c, k) => c[k] ?? '—';
let md = '# Materiais de cada peça\n\nGerado por `exportar.mjs` a partir do volume real de cada material na peça.\n'
  + 'Para balancear, mude `m3` em `RECURSOS` no `index.html` (quantos m³ vale 1 unidade) e rode o script de novo.\n';
let cat = null;
for (const [n, d] of Object.entries(pecas)) {
  if (d.categoria !== cat) {
    cat = d.categoria;
    md += `\n## ${cat}\n\n| Peça | Tamanho | ${cols.map(k => recursos[k].nome).join(' | ')} |\n|---|---|${cols.map(() => '--:').join('|')}|\n`;
  }
  md += `| ${d.nome} (\`${n}\`) | ${d.tamanho} | ${cols.map(k => cell(d.custo, k)).join(' | ')} |\n`;
}
md += `\n## Construções de exemplo (total)\n\n| Cena | ${cols.map(k => recursos[k].nome).join(' | ')} |\n|---|${cols.map(() => '--:').join('|')}|\n`;
for (const [f, d] of Object.entries(cenas)) md += `| ${d.nome} (\`${f}.glb\`) | ${cols.map(k => cell(d.custo, k)).join(' | ')} |\n`;
writeFileSync(join(here, 'CUSTOS.md'), md);
console.log('custos.json, CUSTOS.md');
}

if (!process.env.SEM_PREVIAS) {
  await page.evaluate(() => document.getElementById('painel').style.display = 'none');
  const shot = async (file) => { await page.waitForTimeout(1200); await page.screenshot({ path: join(outPrev, file), type: 'jpeg', quality: 82 }); };
  const want = process.env.PREVIAS ? process.env.PREVIAS.split(',') : null, ok = n => !want || want.includes(n);
  const scenes = await page.evaluate(() => window.__api.scenes);
  for (const [k, file] of Object.entries(scenes)) if (ok(file)) { await page.evaluate(k => window.__api.showScene(k), k); await shot(file + '.jpg'); }
  for (const n of names.filter(ok)) { await page.evaluate(n => window.__api.showPiece(n), n); await shot(n + '.jpg'); }
}
await browser.close();
