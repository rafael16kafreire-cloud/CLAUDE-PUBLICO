// =============================================================
// GERAR O JOGO:  npm run build
// Junta todo o código num único arquivo HTML que roda offline:
//   dist/ilha-primordial.html   -> abrir no navegador (PC/celular)
//   build/artifact.html         -> versão para publicar no Claude
//   android/app/src/main/assets/index.html -> usado pelo app Android
// =============================================================
import * as esbuild from 'esbuild';
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { dirname } from 'node:path';

const pkg = JSON.parse(await readFile('package.json', 'utf8'));

// Ícones provisórios (assets/icons/placeholder_ark): só os .png que existirem
// entram no jogo; sem eles, ficam os ícones desenhados pelo jogo.
const placeholderIcons = {
  name: 'icones-provisorios',
  setup(build) {
    build.onResolve({ filter: /^virtual:icones-provisorios$/ }, () => ({ path: 'icones', namespace: 'icones' }));
    build.onLoad({ filter: /.*/, namespace: 'icones' }, async () => {
      const dir = 'assets/icons/placeholder_ark';
      const map = JSON.parse(await readFile(`${dir}/mapa.json`, 'utf8').catch(() => '{}'));
      const out = {};
      for (const [id, file] of Object.entries(map)) {
        if (id.startsWith('_')) continue;
        const data = await readFile(`${dir}/${file}`).catch(() => null);
        if (data) out[id] = `data:image/png;base64,${data.toString('base64')}`;
      }
      return { contents: `export default ${JSON.stringify(out)};`, loader: 'js' };
    });
  },
};

// Sons gravados (assets/sons/<nome>.mp3|ogg|wav): o jogo toca no lugar do
// som gerado. Variações: nome_1.mp3, nome_2.mp3 ... (sorteia uma).
const recordedSounds = {
  name: 'sons-gravados',
  setup(build) {
    build.onResolve({ filter: /^virtual:sons$/ }, () => ({ path: 'sons', namespace: 'sons' }));
    build.onLoad({ filter: /.*/, namespace: 'sons' }, async () => {
      const dir = 'assets/sons';
      const files = await readdir(dir).catch(() => []);
      const out = {};
      const MIME = { mp3: 'audio/mpeg', ogg: 'audio/ogg', wav: 'audio/wav' };
      for (const f of files) {
        const m = f.match(/^(.+?)(?:_(\d+))?\.(mp3|ogg|wav)$/i);
        if (!m) continue;
        const data = await readFile(`${dir}/${f}`);
        (out[m[1]] ??= []).push(`data:${MIME[m[3].toLowerCase()]};base64,${data.toString('base64')}`);
      }
      return { contents: `export default ${JSON.stringify(out)};`, loader: 'js' };
    });
  },
};

const js = await esbuild.build({
  plugins: [placeholderIcons, recordedSounds],
  entryPoints: ['src/main.js'],
  bundle: true,
  minify: true,
  format: 'iife',
  target: ['es2020', 'chrome80', 'safari14'],
  write: false,
  legalComments: 'none',
  define: { __VERSION__: JSON.stringify(pkg.version) },
  logLevel: 'warning',
});

// Fontes embutidas no próprio arquivo (o jogo funciona sem internet).
// Licença: SIL Open Font License (ver src/ui/fonts/OFL-*.txt).
const FONTS = [
  ['Lilita One', 400, 'lilita-one-400.woff2'],
  // Rajdhani: letra "técnica" parecida com a da interface do ARK
  ['Rajdhani', 500, 'rajdhani-medium.woff2'],
  ['Rajdhani', 600, 'rajdhani-semibold.woff2'],
  ['Rajdhani', 700, 'rajdhani-bold.woff2'],
  // Jost (estilo Futura) para os títulos
  ['Jost', 500, 'jost-500.woff2'],
  ['Jost', 600, 'jost-600.woff2'],
  ['Jost', 700, 'jost-700.woff2'],
  ['Barlow Semi Condensed', 500, 'barlow-semi-condensed-500.woff2'],
  ['Barlow Semi Condensed', 600, 'barlow-semi-condensed-600.woff2'],
  ['Barlow Semi Condensed', 700, 'barlow-semi-condensed-700.woff2'],
];
let fontCss = '';
for (const [family, weight, file] of FONTS) {
  const b64 = (await readFile(`src/ui/fonts/${file}`)).toString('base64');
  fontCss += `@font-face{font-family:"${family}";font-style:normal;font-weight:${weight};font-display:swap;src:url(data:font/woff2;base64,${b64}) format("woff2")}`;
}

const css = await esbuild.transform(fontCss + (await readFile('src/ui/styles.css', 'utf8')), {
  loader: 'css',
  minify: true,
});

// Evita que o navegador ache um "</script>" no meio do código.
const jsCode = js.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const template = await readFile('src/index.template.html', 'utf8');
const content = template
  .replace('/*__CSS__*/', () => css.code)
  .replace('/*__JS__*/', () => jsCode);

// Versão completa (arquivo .html que abre sozinho): título, fontes e
// estilo vão no <head>; o resto no <body>.
const split = content.indexOf('<div id="app">');
const standalone = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
${content.slice(0, split)}</head>
<body>
${content.slice(split)}</body>
</html>
`;

async function out(path, text) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, text);
  console.log(`  ${path}  (${(Buffer.byteLength(text) / 1024).toFixed(0)} KB)`);
}

console.log(`Ilha Primordial v${pkg.version}`);
// ILHA_OUT=arquivo.html: gera só a versão para abrir no navegador nesse
// caminho (útil para testar sem mexer no dist/ enquanto outro teste roda)
if (process.env.ILHA_OUT) {
  await out(process.env.ILHA_OUT, standalone);
  process.exit(0);
}
await out('dist/ilha-primordial.html', standalone);
await out('build/artifact.html', content);
await out('android/app/src/main/assets/index.html', standalone);
