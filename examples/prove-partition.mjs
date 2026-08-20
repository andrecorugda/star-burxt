// not-burxt: platform — greps a linked wasm module for symbols the browser build must not contain
// **Server code cannot reach the browser, and this is the proof rather than the claim.**
//
// Every meta-framework has a server/client boundary held up by a bundler convention. Here it is a
// signature: `load` may `touches network`, a view is `pure` and the compiler refuses a pure function
// that calls an impure one — so a page cannot fetch while it renders, and the client's entry points
// never reach `load`.
//
// What that buys is checkable, and this checks it:
//
//   1. the secret in `load` is in the wasm OBJECT      — the compiler emitted it
//   2. it is NOT in the linked client module            — the linker dropped it
//   3. the client module does not import the network call it makes
//
// **Step 1 is the control and it is the point.** Without it, "the secret is absent" would also be
// true of a grep that could never find anything — which is how a check passes for the wrong reason.
import { readFileSync } from 'fs';

const [, , objPath, wasmPath] = process.argv;
const SECRET = 'hunter2-should-never-reach-a-browser';
const NETWORK_CALL = 'db_lookup';

const has = (path) => readFileSync(path).includes(Buffer.from(SECRET));

let failures = 0;
const is = (what, got, want) => {
  const ok = got === want;
  if (!ok) failures++;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${what}`);
  if (!ok) console.log(`       got ${got}, want ${want}`);
};

is('the CONTROL: the secret is in the wasm object, so this grep can find things',
   has(objPath), true);
is('THE SECRET IS NOT IN THE CLIENT MODULE', has(wasmPath), false);

const mod = await WebAssembly.compile(readFileSync(wasmPath));
const imports = WebAssembly.Module.imports(mod).map((i) => i.name);
is(`the client does not import \`${NETWORK_CALL}\``, imports.includes(NETWORK_CALL), false);
console.log('       client imports:', imports.join(' '));

console.log(failures ? `\n${failures} failure(s)` : '\nthe server half stays on the server');
process.exit(failures ? 1 : 0);
