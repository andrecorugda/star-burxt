// Screenshot a running component, for the site's showcase.
//
// **A real screenshot rather than a drawn mock-up.** The landing page claims a document becomes an
// application; a picture of a hand-drawn card would make that claim about the picture. So this
// starts a server, loads the real `.wasm` through the real driver, and photographs what a browser
// actually painted — and it is a script rather than a one-off session, so the image can be REMADE
// when the component changes instead of quietly describing a version that no longer exists.
//
//     node tools/shoot.mjs <page.html> <selector> <out.png> [viewport-width]
//
// It fails rather than photographing a broken page: a script error, or a selector that never
// appears, is an error here. A screenshot of an unmounted component would look like a design
// decision on the landing page.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { createRequire } from 'node:module';

// Puppeteer is not a dependency of this project — it is a tool the site's author happens to have.
// Resolved at runtime so a checkout without it fails with a sentence rather than an import trace.
let puppeteer;
try {
  const require = createRequire(import.meta.url);
  puppeteer = require('puppeteer');
} catch {
  console.error('this needs puppeteer:  npm i -g puppeteer   (or run it where puppeteer is installed)');
  process.exit(2);
}

const [page, selector, out, width = '900'] = process.argv.slice(2);
if (!page || !selector || !out) {
  console.error('usage: node tools/shoot.mjs <page.html> <selector> <out.png> [viewport-width]');
  process.exit(2);
}

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
                '.css': 'text/css', '.wasm': 'application/wasm', '.json': 'application/json',
                '.png': 'image/png' };

const root = join(process.cwd(), 'examples');
const server = createServer(async (req, res) => {
  const path = join(root, decodeURIComponent(req.url.split('?')[0]));
  try {
    const body = await readFile(path);
    res.writeHead(200, { 'content-type': TYPES[extname(path)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end('no');
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
try {
  const tab = await browser.newPage();
  // **deviceScaleFactor 2, because of where this is read.** A 1x shot of a 480px card is visibly
  // soft on every laptop sold in the last decade, and a blurry screenshot reads as a blurry project.
  await tab.setViewport({ width: Number(width), height: 900, deviceScaleFactor: 2 });
  const problems = [];
  tab.on('pageerror', (e) => problems.push(String(e.message)));
  await tab.goto(`http://127.0.0.1:${port}/${page}`, { waitUntil: 'networkidle0' });
  const el = await tab.waitForSelector(selector, { timeout: 5000 });
  if (problems.length) throw new Error('the page errored: ' + problems.join('; '));
  const box = await el.boundingBox();
  await el.screenshot({ path: out });
  console.log(`${out} — ${Math.round(box.width)}x${Math.round(box.height)} css px, at 2x`);
} finally {
  await browser.close();
  server.close();
}
