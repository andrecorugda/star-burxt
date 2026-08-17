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

const listeners = [];
const root = { innerHTML: '', addEventListener(_kind, fn) { listeners.push(fn); } };

function clickOn(handler, key) {
  const el = {
    getAttribute: (n) => (n === 'data-star-h' ? String(handler) : String(key)),
    closest: (sel) => (sel === '[data-star-key]' ? (key === null ? null : el) : el),
  };
  listeners.forEach((fn) => fn({ target: { closest: () => el } }));
}

const app = await mount({
  wasm: readFileSync(process.argv[2] || 'todos.wasm').buffer,
  root, component: 'todos', initial: '{}',
});

const strip = (s) => s.replace(/<div class="star">|<\/div>$/g, '');
let failures = 0;
const is = (what, got, want) => {
  const ok = got === want;
  if (!ok) failures++;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${what}`);
  if (!ok) console.log(`       got  ${got}\n       want ${want}`);
};

is('an empty list renders', strip(root.innerHTML),
   '<h1>Todos</h1><ul></ul><button data-star-h="1">add one</button>');

clickOn(1, null);
is('a click adds a row and the state comes back', app.state,
   '{"todos":[{"id":1,"label":"task 1","done":false}],"next_id":2}');

clickOn(1, null);
is('the state the host kept is what the next frame reads', app.state,
   '{"todos":[{"id":1,"label":"task 1","done":false},{"id":2,"label":"task 2","done":false}],"next_id":3}');

clickOn(0, 2);
is('a per-row click toggles the row its KEY names', app.state,
   '{"todos":[{"id":1,"label":"task 1","done":false},{"id":2,"label":"task 2","done":true}],"next_id":3}');

is('the page shows both rows, each carrying its key', strip(root.innerHTML),
   '<h1>Todos</h1><ul><li data-star-key="1"><button data-star-h="0">task 1</button></li>'
   + '<li data-star-key="2"><button data-star-h="0">task 2</button></li></ul>'
   + '<button data-star-h="1">add one</button>');

console.log(failures ? `\n${failures} failure(s)` : '\nthe driver carries the state');
process.exit(failures ? 1 : 0);
