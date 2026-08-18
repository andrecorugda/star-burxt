// The driver, exercised against a real WebAssembly module with no browser.
//
// **This is the test that would have caught `__multi3`.** A component that round-trips perfectly
// under `burxt run` exited 70 on its second frame in the browser, because the driver stubbed
// 128-bit multiply to zero — which does not fail loudly, it produces wrong products and lets the
// overflow check fire on a correct program. Nothing native could have found it; only running the
// wasm could.
//
//     burxt build Todos.sbmx -> todos.bx -> todos.o -> todos.wasm
//     node drive.mjs
//
// The DOM here is three methods, because the driver touches three: innerHTML, addEventListener and
// closest. A component that needed more than that would be a driver doing too much.
import { readFileSync } from 'fs';
import { mount } from './app.js';
import { fakeRoot, checker } from './fake-dom.mjs';

const root = fakeRoot();
const app = await mount({
  wasm: readFileSync(process.argv[2] || 'todos.wasm').buffer,
  root, component: 'todos', initial: '{}',
});

const { is, done } = checker();

// **What this asserts, and why it is no longer the whole page.** It used to pin the exact HTML, which
// made it a test of the STYLING as much as the driver: restyling `Todos.sbmx` broke it twice while the
// rendering was perfectly correct. A brittle assertion trains you to update it without reading it, which
// is how a real regression walks past. So these ask the questions this file is FOR — the rows exist, they
// are in order, each carries its key, and the handler indices are the ones the generator assigned.
const rows = () => [...String(root.innerHTML).matchAll(/data-star-key="(\d+)"/g)].map((m) => m[1]);
const labels = () => [...String(root.innerHTML).matchAll(/<button[^>]*>([^<]*)<\/button>/g)].map((m) => m[1]);
const handlerOf = (label) => {
  const m = String(root.innerHTML).match(new RegExp(`<button[^>]*data-star-h="(\\d+)"[^>]*>${label}<`));
  return m ? m[1] : null;
};

is('an empty list has no rows', rows().length, 0);
is('and the add button is there, under the index the generator gave it', handlerOf('add one'), '1');

root.fire('click', 1);
is('a click adds a row and the state comes back', app.state,
   '{"todos":[{"id":1,"label":"task 1","done":false}],"next_id":2}');

root.fire('click', 1);
is('the state the host kept is what the next frame reads', app.state,
   '{"todos":[{"id":1,"label":"task 1","done":false},{"id":2,"label":"task 2","done":false}],"next_id":3}');

root.fire('click', 0, { key: 2 });
is('a per-row click toggles the row its KEY names', app.state,
   '{"todos":[{"id":1,"label":"task 1","done":false},{"id":2,"label":"task 2","done":true}],"next_id":3}');

is('the page shows both rows, in order, each carrying its key', rows().join(','), '1,2');
is('and both rows are on the page', labels().filter((t) => t.startsWith('task ')).join(','),
   'task 1,task 2');
is('a row\'s button carries the per-row handler, not the add button\'s',
   handlerOf('task 2'), '0');
is('the toggled row is the one the state says', /class="pick done"[^>]*>task 2</.test(root.innerHTML), true);

done('the driver carries the state');
