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
import { execFileSync, spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { inflateSync } from 'node:zlib';
import { join, extname } from 'node:path';
import { tmpdir } from 'node:os';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const WORK = join(tmpdir(), 'star-gallery');
const SHOTS = join(ROOT, 'docs', 'assets', 'gallery');
// **Captured larger than it is shown, on purpose.** The column is about 880px, so a 720px capture had to be
// squeezed into half of it beside the code — Andre's words were "the actual capture is so small I can't even
// see the code." Capturing at 1120 and displaying at the column's width downscales, which is crisp on any
// display, and gives the component room to lay itself out properly while it is being photographed.
// `HEIGHT` is a FLOOR, not the height: a short component gets a slide of at least this much so the strip
// does not jump between a 200px slide and a 900px one, and a tall one gets whatever it needs.
const WIDTH = 1120, HEIGHT = 620;
// `--include-only` rewrites the page from the captures already on disk. The capture pass takes minutes and
// the include is the half that changes when the markup or the wording does.
const INCLUDE_ONLY = process.argv.includes('--include-only');

// **The bottom band of a capture must be empty, and that is the check a dimension comparison cannot make.**
// The page draws the component inside 1.6rem of padding, so the last rows are background unless something
// was cut off — and a cropped capture has ink running to its final row. Heights can agree and the picture
// still be wrong; this asks the picture.
//
// The rows are unfiltered by hand because that is what a PNG is, and this file takes no dependency.
function bottomIsClear(path, band = 12) {
  const d = readFileSync(path);
  const w = d.readUInt32BE(16), h = d.readUInt32BE(20), ctype = d[25];
  const chans = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[ctype];
  const idat = [];
  for (let i = 8; i < d.length;) {
    const len = d.readUInt32BE(i);
    if (d.toString('ascii', i + 4, i + 8) === 'IDAT') idat.push(d.subarray(i + 8, i + 8 + len));
    i += 12 + len;
  }
  const px = inflateSync(Buffer.concat(idat));
  const stride = w * chans;
  let prev = Buffer.alloc(stride), off = 0;
  const tail = [];
  for (let row = 0; row < h; row += 1) {
    const f = px[off]; off += 1;
    const line = Buffer.from(px.subarray(off, off + stride)); off += stride;
    for (let x = 0; x < stride; x += 1) {
      const a = x >= chans ? line[x - chans] : 0;
      const b = prev[x];
      const c = x >= chans ? prev[x - chans] : 0;
      if (f === 1) line[x] = (line[x] + a) & 255;
      else if (f === 2) line[x] = (line[x] + b) & 255;
      else if (f === 3) line[x] = (line[x] + ((a + b) >> 1)) & 255;
      else if (f === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        line[x] = (line[x] + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255;
      }
    }
    if (row >= h - band) tail.push(line);
    prev = line;
  }
  // Every pixel in the band the same colour as the band's first pixel.
  const r0 = tail[0][0], g0 = tail[0][1], b0 = tail[0][2];
  for (const line of tail) {
    for (let x = 0; x < w; x += 1) {
      if (Math.abs(line[x * chans] - r0) > 6 || Math.abs(line[x * chans + 1] - g0) > 6
          || Math.abs(line[x * chans + 2] - b0) > 6) return false;
    }
  }
  return true;
}

const chrome = () => {
  // A CI runner has one on PATH; this machine has them in a cache. Both, because a tool that only works
  // where it was written is a tool nobody else runs.
  for (const name of ['google-chrome', 'chromium', 'chromium-browser']) {
    try {
      const path = execFileSync('command', ['-v', name], { shell: true, encoding: 'utf8' }).trim();
      if (path) return path;
    } catch { /* not on PATH */ }
  }
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

for (const name of INCLUDE_ONLY ? [] : shown) {
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
  // **The page reports its own height, because a viewport screenshot CROPS.** Capturing at a fixed
  // 1120x720 cut the bottom off every component taller than that — Andre saw it immediately. There is no
  // full-page flag on the command line, so the height has to be known BEFORE the shot: this writes it
  // where a --dump-dom pass can read it.
  const tall = Math.ceil(document.documentElement.scrollHeight);
  document.title = 'ready h=' + tall;
</script>`);
}

// ---- serve, capture, verify ---------------------------------------------------------------------
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
                '.wasm': 'application/wasm' };
const server = createServer((req, res) => {
  const path = join(WORK, decodeURIComponent(req.url.split('?')[0]));
  // **Read first, then write the header.** Writing 200 and discovering the file is missing leaves nothing
  // to say — `writeHead(404)` after that throws `ERR_HTTP_HEADERS_SENT` and takes the whole run down, which
  // is what a missing favicon request did.
  let body;
  try { body = readFileSync(path); } catch { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': types[extname(path)] || 'application/octet-stream' });
  res.end(body);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
const BIN = chrome();

// **`spawnSync` cannot be used here, and finding out cost an hour.** The HTTP server serving these pages
// runs in THIS process, and a synchronous child blocks the event loop — so Chrome asked for the page, node
// was blocked waiting for Chrome, and neither moved. Sixteen timeouts, all of them looking like a page that
// would not settle, when the truth was that nothing was answering the request. It worked by hand because a
// shell puts the server in a different process.
//
// The lesson generalises past this file: **a server and a synchronous child in one process is a deadlock**,
// and its symptom is indistinguishable from the thing you would naturally suspect — the page.
const run = (args, capture) => new Promise((resolve) => {
  const child = spawn(BIN, args, { stdio: capture ? ['ignore', 'pipe', 'ignore'] : 'ignore' });
  let out = '';
  if (capture) child.stdout.on('data', (d) => { out += d; });
  const timer = setTimeout(() => child.kill('SIGKILL'), 25000);
  child.on('close', (code) => { clearTimeout(timer); resolve({ code, out }); });
  child.on('error', () => { clearTimeout(timer); resolve({ code: -1, out: '' }); });
});

let failures = 0;
for (const name of INCLUDE_ONLY ? [] : shown) {
  const low = name.toLowerCase();
  const url = `http://127.0.0.1:${port}/${low}.html`;
  // Pass one: how tall is it? Pass two: the shot, at that height.
  const probe = ['--headless', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
                 `--window-size=${WIDTH},${HEIGHT}`, '--virtual-time-budget=5000'];
  // Retried once, for the same reason the DOM check is: an empty dump is this tool, not the page. Two
  // components reported nothing on the first run of this and both rendered perfectly on their own.
  let sized = (await run([...probe, '--dump-dom', url], true)).out;
  let said = /<title>ready h=(\d+)<\/title>/.exec(sized);
  if (!said) {
    sized = (await run([...probe, '--dump-dom', url], true)).out;
    said = /<title>ready h=(\d+)<\/title>/.exec(sized);
  }
  if (!said) {
    failures += 1;
    console.log(`  FAIL  ${low}.png — the page never reported its height, twice. That is this tool rather`);
    console.log(`        than the component: ${sized.trim() === '' ? 'the dump came back EMPTY' : 'the dump had no title'}`);
    continue;
  }
  const tall = Math.max(HEIGHT, Number(said[1]));
  const flags = ['--headless', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
                 `--window-size=${WIDTH},${tall}`, '--virtual-time-budget=5000'];
  await run([...flags, `--screenshot=${join(SHOTS, `${low}.png`)}`, url], false);

  // **The capture is verified against the page's own DOM.** A picture cannot tell you it rendered the
  // default view instead of the state it was given, and `from_text` FALLS BACK on a field it does not
  // recognise — so a demo state that drifted would produce a slide of the default view and look
  // deliberate.
  // **An empty dump and a dump without the component are different failures**, and reporting the first as
  // the second sent me looking at `Clock` for ten minutes when the page was fine — it rendered perfectly
  // standalone. So an empty dump is retried once and, if it stays empty, named as a harness problem rather
  // than a finding about the component.
  let { out: dom } = await run([...flags, '--dump-dom', url], true);
  if (dom.trim() === '') ({ out: dom } = await run([...flags, '--dump-dom', url], true));
  if (dom.trim() === '') {
    failures += 1;
    console.log(`  FAIL  ${low}.png — no DOM came back, twice. That is this tool, not the component:`);
    console.log('        check the server is still up and the browser is not being killed early');
    continue;
  }
  const { shows } = demo(name);
  const painted = dom.includes('class="star"');
  const landed = shows === '' || dom.includes(shows);
  // A PNG's width and height live in its IHDR, at bytes 16..24 — so the capture can be checked for BEING a
  // picture of the page rather than a picture of nothing. A blank page still writes a valid PNG, and a
  // rendered page compresses to far more than an empty one, which is what the floor is for.
  const shotPath = join(SHOTS, `${low}.png`);
  const wrote = existsSync(shotPath);
  if (wrote) {
    const png = readFileSync(shotPath);
    const w = png.readUInt32BE(16), h = png.readUInt32BE(20);
    if (w !== WIDTH) {
      failures += 1;
      console.log(`  FAIL  ${low}.png is ${w}px wide, not ${WIDTH}`);
      continue;
    }
    if (h < tall) {
      failures += 1;
      console.log(`  FAIL  ${low}.png is ${h}px tall and the page asked for ${tall} — it is CROPPED`);
      continue;
    }
    if (!bottomIsClear(shotPath)) {
      failures += 1;
      console.log(`  FAIL  ${low}.png has ink in its bottom rows, so the component is CUT OFF. The page`);
      console.log('        keeps padding below the component, so those rows must be background.');
      continue;
    }
    if (png.length < 4000) {
      failures += 1;
      console.log(`  FAIL  ${low}.png is only ${png.length} bytes, which is a picture of an empty page`);
      continue;
    }
  }
  console.log(`  ${painted && landed && wrote ? 'ok  ' : 'FAIL'}  ${low}.png`);
  if (!wrote) { failures += 1; console.log('        no file was written — the capture never completed'); }
  else if (!painted) { failures += 1; console.log('        the component did not render at all'); }
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

// ---- the carousel -------------------------------------------------------------------------------
//
// **No JavaScript, and that is not a purity point.** `scroll-snap` plus anchor links is the whole
// mechanism: a browser scrolls the nearest scrollable ancestor when you follow a fragment, so the strip
// moves and snaps with nothing running. A carousel that needs a script is a carousel that is blank while
// the script loads, on the page whose argument is that the component is already there.
//
// The code panel is the MARKUP half — `:props:` onward — because that is the half a reader is deciding
// about. It ships as a `language-sbmx` block, so the site's own painter numbers it and draws its guides.
const reasons = (() => {
  const page = readFileSync(join(ROOT, 'examples', 'README.md'), 'utf8');
  const out = {};
  for (const m of page.matchAll(/^\| `(\w+)\.sbmx` \| ([^|]+)\|/gm)) out[m[1]] = m[2].trim();
  return out;
})();

const slides = shown.map((name, at) => {
  const low = name.toLowerCase();
  // The height comes from the FILE, so the browser reserves exactly the right box and the strip does not
  // jump as each slide loads.
  const png = readFileSync(join(SHOTS, `${low}.png`));
  const shot = png.readUInt32BE(20);
  return `  <section class="shelf-slide" id="shelf-${low}" aria-label="${name}, ${at + 1} of ${shown.length}">
    <figure class="shelf-shot">
      <!-- Versioned like the stylesheets, and for the same reason: a PNG keeps its filename when it is
           retaken, so a reader holds the PREVIOUS capture until the cache expires. Andre reported the
           captures as cropped after they had been retaken — the ones he was looking at were the old
           720x470 shots, which genuinely were cut off. -->
      <img src="{{ site.baseurl }}/assets/gallery/${low}.png?v={{ site.time | date: '%s' }}"
           width="${WIDTH}" height="${shot}"
           loading="${at < 2 ? 'eager' : 'lazy'}" alt="${name}.sbmx running in a browser">
    </figure>
    <figure class="shelf-code">
      <figcaption><strong>${name}.sbmx</strong> <span>${escape(reasons[name] || '')}</span></figcaption>
      <!-- Wrapped in raw, or Jekyll eats the markup: a double brace is a slot in a star document and a
           Liquid expression to Jekyll, so an unwrapped panel either fails the build or renders the wrong
           thing silently. tools/liquid.bx caught it the moment the page was generated, which is the gate
           earning its place — I had already pushed. -->
      {% raw %}<pre><code class="language-sbmx">${escape(markup(name))}</code></pre>{% endraw %}
    </figure>
  </section>`;
}).join('\n');

const dots = shown.map((name, at) =>
  `      <a href="#shelf-${name.toLowerCase()}" aria-label="${name}"${at === 0 ? ' class="on"' : ''}></a>`)
  .join('\n');

writeFileSync(join(ROOT, 'docs', '_includes', 'gallery.html'),
`<!-- GENERATED by tools/gallery.mjs. Do not edit: regenerate. -->
<!-- Every capture is a real browser mounting the real .wasm, and every one is verified against the DOM it
     came from — a screenshot cannot tell you it rendered the default view instead of the state it was given.

     The controls degrade: the strip is a scroll-snap container, so it drags and swipes with no script at all,
     and the dots are anchors that work the same way. \`shelf.js\` adds the arrows, the keyboard and the live
     counter on top of that — it is an enhancement rather than the mechanism. -->
<div class="shelf" data-shelf>
  <div class="shelf-bar">
    <button class="shelf-arrow" type="button" data-shelf-prev aria-label="Previous example">&#8249;</button>
    <div class="shelf-dots">
${dots}
    </div>
    <button class="shelf-arrow" type="button" data-shelf-next aria-label="Next example">&#8250;</button>
    <span class="shelf-count" data-shelf-count>1 / ${shown.length}</span>
  </div>
  <div class="shelf-track" data-shelf-track tabindex="0">
${slides}
  </div>
</div>
`);
// **Say which run this was.** `--include-only` printed "16 captures, every one verified" while capturing
// nothing, which is the exact shape of claim this tool exists to refuse.
console.log(INCLUDE_ONLY
  ? `\nreused ${shown.length} captures already on disk — nothing was re-captured or re-verified`
  : `\n${shown.length} captures, every one verified against the page it came from`);
console.log('wrote docs/_includes/gallery.html');
