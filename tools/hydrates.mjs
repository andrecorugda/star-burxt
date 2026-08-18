// Does the server's HTML match what the browser renders?
//
//     node tools/hydrates.mjs <component.wasm> <name> <served.html> [state-json]
//
// **A backend that owns the page needs star to render a FRAGMENT**, and the browser build alone does
// not: it ships an empty `<div id="root">`, so nothing is painted until 54 KB of wasm and 28 KB of
// JavaScript have arrived and instantiated. That gap is the flash, and it is not star's reactivity —
// a plain React or Vue SPA has exactly the same one. Next, Nuxt and Inertia render first and hydrate
// after; Alpine sidesteps it by never producing the HTML in the first place.
//
// `star-generate --fragment` is the answer: a native binary, state in on stdin, that component's HTML
// out. Which leaves the question this file exists to settle — **are the two renderers the same?** If
// the server's bytes and the module's bytes differ, the reconciler patches the difference on mount and
// the page moves under the reader, which is the hydration mismatch every framework in this space has
// had to apologise for. Here both sides are one compiled component over one value, so equality is
// something to CHECK rather than to hope for.
import { readFileSync } from 'node:fs';
import { mount } from '../examples/app.js';
import { fakeRoot } from '../examples/fake-dom.mjs';

const [file, component, servedPath, state = '{"status":"idle","url":"/tasks"}'] = process.argv.slice(2);
if (!file || !component || !servedPath) {
  console.error('usage: node tools/hydrates.mjs <component.wasm> <name> <served.html> [state-json]');
  process.exit(2);
}

let failures = 0;
const check = (name, ok, detail) => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${name}`);
  if (!ok) { failures += 1; if (detail !== undefined) console.log('        ' + String(detail).slice(0, 400)); }
};

const served = readFileSync(servedPath, 'utf8').trim();
const root = fakeRoot();
await mount({ wasm: new Uint8Array(readFileSync(file)), root, component, initial: state });
const painted = String(root.innerHTML).trim();

// The CONTROL first: an empty comparison is equal to another empty one, and that would pass forever.
check('the server rendered something', served.length > 0, served);
check('the module rendered something', painted.length > 0, painted);
check('and the markup is a component, not an error page',
      served.includes('class="star"'), served);

check('THE SERVER AND THE BROWSER AGREE, BYTE FOR BYTE', served === painted,
      `server: ${served}\n        client: ${painted}`);

// The handler wiring has to survive the trip, or the page looks right and does nothing.
check('the server HTML carries the handler index', /data-star-h="\d+"/.test(served), served);
check('and the event that handler answers to', /data-star-on="\w+"/.test(served), served);

console.log(failures ? `\n${failures} failure(s)` : '\none component, two hosts, the same bytes');
process.exit(failures ? 1 : 0);
