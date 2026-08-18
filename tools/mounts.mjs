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

// **TAINTED STATE CANNOT INJECT AN ATTRIBUTE OR AN ELEMENT**, and nothing asserted this until BMX
// found the same hazard class on their side — a document's info string reaching a `class`, true and
// tested by nothing.
//
// star's vector is stronger than a document's own bytes: **state arrives through `from_text`**, which
// means it comes off the page, which means it may come from a server or a user. If it reached an
// attribute unescaped, a value of `" onload="steal()` would close the attribute and open an event
// handler. The guarantee is real — `html_attr` and `html_render` escape — and the point of asserting
// it is that a regression would be silent and would look like nothing at all.
const evil = '" onload="steal()';
{
  const dirty = fakeRoot();
  await mount({ wasm: bytes, root: dirty, component,
                initial: JSON.stringify({ tasks: [{ id: 1, label: evil, done: false }], left: 1 }) });
  const html = String(dirty.innerHTML);
  check('tainted state cannot close an attribute',
        !html.includes('onload="steal()') && !/<[^>]*\sonload=/.test(html), html.slice(0, 200));
  check('and it is escaped rather than dropped, so the text still shows',
        html.includes('&quot;') || html.includes('&#34;'), html.slice(0, 200));
  // The CONTROL: the same run must contain the harmless part of the value, or this passes because
  // the component rendered nothing at all.
  check('the control: the row rendered, so there was something to escape',
        html.includes('onload=') || html.includes('steal()'), html.slice(0, 200));
}

// Click the third row — the one that is not done — by its key. `fire` is the fake DOM's way of
// delivering a real delegated event, so this goes through the driver's own listener rather than
// around it.
const before = first;
root.fire('click', 0, { key: 3 });
const after = String(root.innerHTML);
check('clicking a row changes the page', after !== before, 'the page did not change');

// **AN EVENT THE DOCUMENT DID NOT ASK FOR MUST DO NOTHING**, and nothing checked this until a real
// browser pointed at a real Laravel app wrote 495 rows while nobody touched the mouse. The driver
// wires all 39 kinds star accepts on one delegated listener and used to resolve the handler from
// `data-star-h` alone — so `on:click` ran on `mouseover`, on `keydown`, on `focus`. With a reconciler
// patching the DOM under the cursor, the resulting `mouseover` started the next one.
//
// One `on:` per element is what hid it: with a single index per element there was nothing to compare
// the event against, and no output looked wrong.
for (const kind of ['mouseover', 'mousemove', 'keydown', 'focus', 'pointerenter']) {
  const quiet = String(root.innerHTML);
  root.fire(kind, 0, { key: 3, on: 'click' });
  check(`a ${kind} does not run an on:click handler`,
        String(root.innerHTML) === quiet, `${kind} changed the page`);
}

// The CONTROL: the same element, the event it DID declare, still works — or the check above passes
// because nothing fires at all any more.
const quiet = String(root.innerHTML);
root.fire('click', 0, { key: 3, on: 'click' });
check('the control: its declared event still runs', String(root.innerHTML) !== quiet,
      'nothing fires at all now, so the check above proves nothing');

console.log(failures ? `\n${failures} failure(s)` : '\nthe showcase component mounts and responds');
process.exit(failures ? 1 : 0);
