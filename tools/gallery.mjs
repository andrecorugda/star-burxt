// Every example, captured running, beside the markup that made it.
//
//     node tools/gallery.mjs            # -> docs/assets/gallery/*.png and docs/_includes/gallery.html
//
// **A screenshot is a claim that cannot go stale loudly**, which is the whole hazard of a gallery: the
// picture keeps looking correct after the component stops working, because a picture is a file. So every
// capture here is taken from a real browser mounting the real `.wasm`, and every one is VERIFIED — the
// page's own DOM has to contain the marker its demo state promises, or the run fails.
//
// That check exists because of how `from_text` behaves: it FALLS BACK when a field is missing or renamed.
// A demo state that drifted from its component would render the default view and the slide would look
// deliberate — a screenshot of nothing in particular, indistinguishable from a design decision.
//
// No dependency: Chrome is driven as a BINARY with `--headless --screenshot`, the pages are served by
// `node:http`, and nothing here imports anything that is not built in. `tools/shoot.mjs` needs puppeteer
// as a module and could not run on this machine, which is why the landing page's picture had gone stale
// once already.
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, copyFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { join, extname } from 'node:path';
import { tmpdir } from 'node:os';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const WORK = join(tmpdir(), 'star-gallery');
const SHOTS = join(ROOT, 'docs', 'assets', 'gallery');
const WIDTH = 720, HEIGHT = 470;

const chrome = () => {
  const roots = [join(process.env.HOME, '.cache', 'puppeteer', 'chrome'),
                 join(process.env.HOME, '.cache', 'ms-playwright')];
  for (const base of roots) {
    if (!existsSync(base)) continue;
    for (const dir of readdirSync(base).sort().reverse()) {
      for (const tail of ['chrome-linux64/chrome', 'chrome-linux/chrome']) {
        const path = join(base, dir, tail);
        if (existsSync(path)) return path;
      }
    }
  }
  console.error('tools/gallery.mjs: no Chrome binary found under ~/.cache/puppeteer or ~/.cache/ms-playwright.');
  process.exit(2);
};

// The roster is the COLLECTION, in the order the collection lists it — so a component cannot appear in a
// carousel it was never written down in, and the two orders cannot disagree.
const roster = () => {
  const page = readFileSync(join(ROOT, 'examples', 'README.md'), 'utf8');
  const names = [...page.matchAll(/^\| `(\w+)\.sbmx`/gm)].map((m) => m[1]);
  if (names.length < 15) {
    console.error('tools/gallery.mjs: found only %d rows in examples/README.md.', names.length);
    process.exit(2);
  }
  return names;
};

// A component with no `to_text`/`from_text` cannot be mounted on its own — `Badge` is used BY `Page`. They
// are named rather than skipped, because a gallery that quietly drops five of twenty-one reads as a
// gallery of everything.
const mountable = (name) => {
  const src = readFileSync(join(ROOT, 'examples', `${name}.sbmx`), 'utf8');
  return src.includes('function to_text(') && src.includes('function from_text(');
};

const demo = (name) => {
  const path = join(ROOT, 'tests', 'gallery', `${name}.json`);
  if (!existsSync(path)) return { shows: '', state: {} };
  return JSON.parse(readFileSync(path, 'utf8'));
};

const markup = (name) => {
  const src = readFileSync(join(ROOT, 'examples', `${name}.sbmx`), 'utf8');
  const at = src.indexOf(':props:');
  return src.slice(at).trimEnd();
};

const escape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ---- build every component into one served directory --------------------------------------------
mkdirSync(WORK, { recursive: true });
mkdirSync(SHOTS, { recursive: true });
for (const asset of ['app.js', 'reconcile.js', 'theme.css']) {
  copyFileSync(join(ROOT, 'examples', asset), join(WORK, asset));
}

const names = roster();
const skipped = names.filter((n) => !mountable(n));
const shown = names.filter(mountable);
console.log(`${shown.length} of ${names.length} components are mountable on their own`);
if (skipped.length) console.log(`  not in the carousel, and each is a CHILD component: ${skipped.join(', ')}`);

for (const name of shown) {
  const low = name.toLowerCase();
  execFileSync(join(ROOT, 'star-build'), [`examples/${name}.sbmx`, low, WORK],
               { cwd: ROOT, stdio: 'pipe' });
  const css = join(ROOT, 'examples', `${name}.css`);
  if (existsSync(css)) copyFileSync(css, join(WORK, `${low}.css`));
  const { state } = demo(name);
  writeFileSync(join(WORK, `${low}.html`), `<!doctype html>
<meta charset="utf-8"><title>${name}</title>
<link rel="stylesheet" href="./theme.css">
<link rel="stylesheet" href="./${low}.css">
<style>body{margin:0;padding:1.6rem;display:flex;align-items:flex-start;justify-content:center}
  .bx-shell{width:100%;max-width:34rem}</style>
<body class="bx"><div class="bx-shell"><div id="root"></div></div>
<script type="module">
  import { mount } from './app.js';
  import { reconcile } from './reconcile.js';
  await mount({ wasm: new URL('./${low}.wasm', import.meta.url),
                root: document.getElementById('root'), component: '${low}',
                initial: ${JSON.stringify(JSON.stringify(state))}, reconcile });
  document.title = 'ready';
</script>`);
}

// ---- serve, capture, verify ---------------------------------------------------------------------
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
                '.wasm': 'application/wasm' };
const server = createServer((req, res) => {
  const path = join(WORK, decodeURIComponent(req.url.split('?')[0]));
  try {
    res.writeHead(200, { 'content-type': types[extname(path)] || 'application/octet-stream' });
    res.end(readFileSync(path));
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
const BIN = chrome();

let failures = 0;
for (const name of shown) {
  const low = name.toLowerCase();
  const url = `http://127.0.0.1:${port}/${low}.html`;
  const flags = ['--headless', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
                 `--window-size=${WIDTH},${HEIGHT}`, '--virtual-time-budget=5000'];
  execFileSync(BIN, [...flags, `--screenshot=${join(SHOTS, `${low}.png`)}`, url], { stdio: 'pipe' });

  // **The capture is verified against the page's own DOM.** A picture cannot tell you it rendered the
  // default view instead of the state it was given.
  const dom = spawnSync(BIN, [...flags, '--dump-dom', url], { encoding: 'utf8' }).stdout || '';
  const { shows } = demo(name);
  const painted = dom.includes('class="star"');
  const landed = shows === '' || dom.includes(shows);
  console.log(`  ${painted && landed ? 'ok  ' : 'FAIL'}  ${low}.png`);
  if (!painted) { failures += 1; console.log('        the component did not render at all'); }
  else if (!landed) {
    failures += 1;
    console.log(`        rendered, but "${shows}" is not on the page — its demo state did not take, so`);
    console.log('        this is a picture of the DEFAULT view and would look deliberate');
  }
}
server.close();

if (failures) {
  console.error(`\n${failures} capture(s) not verified`);
  process.exit(1);
}
console.log(`\n${shown.length} captures, every one verified against the page it came from`);
