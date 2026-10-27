// Gera os ícones PNG do app Android a partir de android/icon/icone.svg
// Uso: node tools/make_icons.mjs
import { createRequire } from 'node:module';
import { readFile, mkdir } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const svg = await readFile('android/icon/icone.svg', 'utf8');
const res = 'android/app/src/main/res';

const legacy = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };

const browser = await chromium.launch();
const page = await browser.newPage();

async function render(path, size, html) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:transparent">${html}</body></html>`);
  await page.screenshot({ path, omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
  console.log('  ', path);
}

// Ícone antigo (Android 7): quadrado com cantos arredondados.
for (const [dpi, size] of Object.entries(legacy)) {
  await mkdir(`${res}/mipmap-${dpi}`, { recursive: true });
  const html = `<div style="width:${size}px;height:${size}px;border-radius:22%;overflow:hidden">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</div>`;
  await render(`${res}/mipmap-${dpi}/ic_launcher.png`, size, html);
}

// Ícone adaptável (Android 8+): arte de fundo 108dp; o desenho fica no
// centro (área segura de 72dp) e o céu/mar preenchem a borda.
await mkdir(`${res}/drawable-nodpi`, { recursive: true });
const S = 432;
// viewBox maior = desenho menor no centro, céu e mar até a borda.
const html = svg.replace('<svg ', `<svg width="${S}" height="${S}" `).replace('viewBox="0 0 512 512"', 'viewBox="-72 -72 656 656"');
await render(`${res}/drawable-nodpi/ic_launcher_background.png`, S, html);

await browser.close();
