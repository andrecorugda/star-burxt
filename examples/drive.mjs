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

const strip = (s) => s.replace(/<div class="star">|<\/div>$/g, '');
const { is, done } = checker();

is('an empty list renders', strip(root.innerHTML),
   '<h1>Todos</h1><ul></ul><button data-star-h="1">add one</button>');

root.fire('click', 1);
is('a click adds a row and the state comes back', app.state,
   '{"todos":[{"id":1,"label":"task 1","done":false}],"next_id":2}');

root.fire('click', 1);
is('the state the host kept is what the next frame reads', app.state,
   '{"todos":[{"id":1,"label":"task 1","done":false},{"id":2,"label":"task 2","done":false}],"next_id":3}');

root.fire('click', 0, { key: 2 });
is('a per-row click toggles the row its KEY names', app.state,
   '{"todos":[{"id":1,"label":"task 1","done":false},{"id":2,"label":"task 2","done":true}],"next_id":3}');

is('the page shows both rows, each carrying its key', strip(root.innerHTML),
   '<h1>Todos</h1><ul><li data-star-key="1"><button data-star-h="0">task 1</button></li>'
   + '<li data-star-key="2"><button data-star-h="0">task 2</button></li></ul>'
   + '<button data-star-h="1">add one</button>');

done('the driver carries the state');
