// Does this component mount, and does clicking it change the page?
//
//     node tools/mounts.mjs <component.wasm> <name>
//
// **A screenshot cannot go stale loudly.** The landing page shows a picture of `Hero.sbmx` running;
// if that component stopped working the picture would keep looking correct, because a picture is a
// file. So the same module is loaded through the real driver here, and the first row is clicked.
//
// It is deliberately not a copy of `drive.mjs`: that file asserts the Todos example's specific
// behaviour, and this one asks the two questions any component must answer — did it paint, and did
// a click change what it painted.
import { readFileSync } from 'node:fs';
import { mount } from '../examples/app.js';
import { fakeRoot } from '../examples/fake-dom.mjs';

const [file, component] = process.argv.slice(2);
if (!file || !component) {
  console.error('usage: node tools/mounts.mjs <component.wasm> <name>');
  process.exit(2);
}

// `readFileSync(...).buffer` is WRONG here and looks right: Node hands out small files from a
// shared pool, so the ArrayBuffer starts at some other file's bytes and WebAssembly reports a bad
// magic word. Copying through a Uint8Array is what gives this module its own bytes.
const bytes = new Uint8Array(readFileSync(file));

const root = fakeRoot();
let failures = 0;
const check = (name, ok, detail) => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${name}`);
  if (!ok) {
    failures += 1;
    if (detail) console.log('        ' + String(detail).slice(0, 300));
  }
};

// The state the landing page's screenshot was taken from, so this runs the same thing a reader sees.
const initial = JSON.stringify({
  tasks: [
    { id: 1, label: 'Read the tour', done: true },
    { id: 2, label: 'Write a component', done: true },
    { id: 3, label: 'Give it a style section', done: false },
  ],
  left: 1,
});

const app = await mount({ wasm: bytes, root, component, initial });

const first = String(root.innerHTML);
check('the component paints', first.length > 0 && first.includes('Read the tour'), first);
check('its own styles reach it', first.includes('class="card"'), first);
check('a markdown heading is inside the output', first.includes('<h1'), first);

// **NO UNRESOLVED INTERPOLATION REACHES THE PAGE, and this exists because a matching hash did not
// catch one.** `class={mark(task.done)}` emitted the Burxt string `"{mark(task.done)}"`, which works
// only because the compiler interpolates braces inside its own string literals — so a value holding a
// literal brace would have shipped a class of `{mark(...)}` to a browser. Two screenshots agreed and
// both would have been wrong.
//
// The lesson generalises past that one spelling: an equality test says nothing about whether either
// side is RIGHT, so it needs a companion that asserts CONTENT. Then the check can fail in two ways
// that have different causes — *the pages differ* and *the pages agree about something false* — and a
// check that cannot tell those apart sends you to the wrong one.
const leaked = [...first.matchAll(/(?:class|href|value|id|data-[\w-]+)="([^"]*[{}][^"]*)"/g)];
check('no attribute carries an unresolved interpolation',
      leaked.length === 0, leaked.map((m) => m[0]).join('  '));
check('a state-chosen class is the COMPUTED value, not the expression',
      /class="row(?: done)?"/.test(first), first);

// Click the third row — the one that is not done — by its key. `fire` is the fake DOM's way of
// delivering a real delegated event, so this goes through the driver's own listener rather than
// around it.
const before = first;
root.fire('click', 0, { key: 3 });
const after = String(root.innerHTML);
check('clicking a row changes the page', after !== before, 'the page did not change');

console.log(failures ? `\n${failures} failure(s)` : '\nthe showcase component mounts and responds');
process.exit(failures ? 1 : 0);
