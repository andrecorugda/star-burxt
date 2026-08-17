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

// Click the third row — the one that is not done — by its key. `fire` is the fake DOM's way of
// delivering a real delegated event, so this goes through the driver's own listener rather than
// around it.
const before = first;
root.fire('click', 0, { key: 3 });
const after = String(root.innerHTML);
check('clicking a row changes the page', after !== before, 'the page did not change');

console.log(failures ? `\n${failures} failure(s)` : '\nthe showcase component mounts and responds');
process.exit(failures ? 1 : 0);
