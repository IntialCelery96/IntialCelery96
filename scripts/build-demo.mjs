/**
 * Builds the standalone demo: the real web app, with the API and socket
 * resolved against fixtures, bundled into a single self-contained HTML file.
 *
 *   node scripts/build-demo.mjs [outfile]
 *
 * Everything is inlined because the output is published as one static page with
 * no origin to serve assets from. The pages, components and routing are the
 * shipped app — only the network boundary is substituted.
 */
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const webDir = path.join(root, 'web');
const outFile = process.argv[2] ?? path.join(root, 'web', 'dist-demo', 'connect4gg-demo.html');

console.log('Building engine…');
execSync('npm run build -w @connect4gg/engine', { cwd: root, stdio: 'inherit' });

console.log('Building demo bundle…');
execSync('npx vite build --outDir dist-demo/app --emptyOutDir', {
  cwd: webDir,
  stdio: 'inherit',
  env: { ...process.env, VITE_DEMO: '1' },
});

const appDir = path.join(webDir, 'dist-demo', 'app');
const assetsDir = path.join(appDir, 'assets');
const assets = readdirSync(assetsDir);

const js = assets.filter((f) => f.endsWith('.js'));
const css = assets.filter((f) => f.endsWith('.css'));

let html = readFileSync(path.join(appDir, 'index.html'), 'utf8');

// Every replacement below uses a function rather than a string, because
// String.replace treats $&, $` and $' in a *string* replacement as special —
// and minified JS is full of `$`. Passing a string here silently corrupts the
// bundle, which then fails to parse with a bare "Unexpected token '<'".
const literal = (text) => () => text;

// Inline the stylesheet.
for (const file of css) {
  const contents = readFileSync(path.join(assetsDir, file), 'utf8');
  html = html.replace(
    new RegExp(`<link[^>]*href="[^"]*${file}"[^>]*>`),
    literal(`<style>${contents}</style>`),
  );
}

// Inline every script, entry last so its imports are already defined.
const entry = js.find((f) => html.includes(f));
const chunks = [...js.filter((f) => f !== entry), ...(entry ? [entry] : [])];

let scripts = '';
for (const file of chunks) {
  const code = readFileSync(path.join(assetsDir, file), 'utf8');
  // An HTML parser ends a <script> at the first `</script`, wherever it sits —
  // including inside a JS string. React ships one, so it has to be escaped.
  scripts += `<script type="module">${code.replace(/<\/script/gi, '<\\/script')}</script>\n`;
}

// Drop the original tags and the module preloads that point at removed files.
html = html
  .replace(/<script[^>]*src="[^"]*"[^>]*><\/script>/g, '')
  .replace(/<link[^>]*rel="modulepreload"[^>]*>/g, '');

// index.html carries scripts of its own — the theme's anti-flash snippet — so
// the expected closer count is whatever it already had plus one per chunk.
const baselineClosers = (html.match(/<\/script>/gi) ?? []).length;

html = html.replace('</body>', literal(`${scripts}</body>`));

// Inline the favicon so the page carries its own icon.
const favicon = readFileSync(path.join(webDir, 'public', 'favicon.svg'), 'utf8');
const faviconData = `data:image/svg+xml;base64,${Buffer.from(favicon).toString('base64')}`;
html = html.replace(/href="\/favicon\.svg"/g, literal(`href="${faviconData}"`));

// The corruption this guards against is invisible in the output — the file
// looks fine and the page just fails to boot — so check it here.
//
// Counting `<script` would be wrong: React ships the string "<script>" in a
// literal, and an opening tag inside a script is harmless. Only `</script`
// ends an element, so that is what has to come out at exactly the expected
// count: one closer per block written, and nothing left unescaped inside them.
const expected = baselineClosers + chunks.length;
const closers = (html.match(/<\/script>/gi) ?? []).length;
if (closers !== expected) {
  throw new Error(`Expected ${expected} script closers, found ${closers}`);
}
for (const file of chunks) {
  const code = readFileSync(path.join(assetsDir, file), 'utf8');
  // A distinctive tail of each chunk must survive verbatim.
  const tail = code.trim().slice(-60).replace(/<\/script/gi, '<\\/script');
  if (!html.includes(tail)) {
    throw new Error(`Bundle ${file} did not survive inlining intact`);
  }
}

// A standing note that this build has no server behind it, so the couple of
// things that genuinely need one do not read as bugs. Injected here rather
// than added to the app, so no shipped component carries a demo branch.
const notice = `
<div id="demo-note" style="position:fixed;left:50%;transform:translateX(-50%);bottom:12px;z-index:60;display:flex;align-items:center;gap:10px;max-width:calc(100vw - 24px);padding:8px 12px;border-radius:10px;border:1px solid rgb(var(--c-line));background:rgb(var(--c-surface)/0.94);backdrop-filter:blur(6px);color:rgb(var(--c-ink-3));font:400 12px/1.4 system-ui,-apple-system,sans-serif;box-shadow:0 10px 30px -12px rgb(0 0 0 / 0.6)">
  <span>Demo build — everything runs in this page. Live opponents and accounts need the server.</span>
  <button type="button" onclick="this.parentElement.remove()" style="border:0;background:rgb(var(--c-surface-2));color:rgb(var(--c-ink-2));border-radius:6px;padding:3px 8px;font:inherit;cursor:pointer">Got it</button>
</div>`;
html = html.replace('</body>', literal(`${notice}</body>`));

writeFileSync(outFile, html);
console.log(`\nWrote ${outFile} (${(html.length / 1024).toFixed(0)} KB)`);
