// not-burxt: platform — mounts a component and reads an event's value
// What a component RECEIVES from an event, one channel at a time.
//
//     node tools/values.mjs <echo.wasm>
//
// **Every one of these was unguarded, and the fake DOM is why.** `clientX` was hard-coded to
// `undefined` and `clientY` was never supplied at all, so every pointer event took the
// `=== undefined` arm of the driver's `valueOf` and the coordinate path had no coverage to lose.
// Proved rather than assumed: swapping x for y and deleting the rounding broke NOTHING across five
// test programs.
//
// This is the third instance of one shape in this repository — the fake that returned `null` for
// `data-star-on`, the `fetch` stub that took one parameter and dropped method/body/headers, and this.
// **A stub that discards what the code reads is an instrument that cannot fail**, and unlike a dead
// assertion it is invisible to a search for unused parameters: the parameter is not unused, it is
// absent from the signature. So the check is one per channel, and each one asserts a VALUE rather
// than that something happened.
import { readFileSync } from 'node:fs';
import { mount } from '../examples/app.js';
import { fakeRoot } from '../examples/fake-dom.mjs';

const file = process.argv[2];
if (!file) {
  console.error('usage: node tools/values.mjs <echo.wasm>');
  process.exit(2);
}
const bytes = new Uint8Array(readFileSync(file));

let failures = 0;
const check = (name, got, want) => {
  const ok = String(got) === String(want);
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${name}`);
  if (!ok) { failures += 1; console.log(`        got  ${JSON.stringify(got)}\n        want ${JSON.stringify(want)}`); }
};

// The handler indices are assigned in document order: tap, typed input, wheel, keys.
const TAP = 0, TYPED = 1, WHEEL = 2, KEYS = 3;

const said = async (kind, handler, payload) => {
  const root = fakeRoot();
  await mount({ wasm: bytes, root, component: 'echo', initial: '{"last":""}' });
  root.fire(kind, handler, { on: kind, ...payload });
  const m = String(root.innerHTML).match(/<h1>Last — ([^<]*)<\/h1>/);
  return m ? m[1] : '(no h1)';
};

// ---- a pointer's position, which is the one that had no coverage at all ------------------------
check('a click carries its rounded position', await said('click', TAP, { at: [12.4, 34.6] }), '12,35');
check('and a pointer with no position carries nothing, so a keyboard press is not a phantom click',
      await said('click', TAP, { at: null }), '');

// ---- the channels that did have a shape, now asserted as values --------------------------------
check('typing carries what is in the field',
      await said('input', TYPED, { value: 'hello' }), 'hello');
check('a checkbox carries its checked state, not its value',
      await said('input', TYPED, { type: 'checkbox', checked: true, value: 'ignored' }), 'true');
check('a wheel carries its rounded delta', await said('wheel', WHEEL, { deltaY: -3.7 }), '-4');
check('a key carries the key', await said('keydown', KEYS, { value: 'Escape' }), 'Escape');

// ---- the CONTROL ------------------------------------------------------------------------------
//
// Every check above reads one `<h1>`, so a component that stopped rendering would make them all fail
// together and look like six findings. This is the one that says the harness itself works.
check('the control: an event the element did not declare changes nothing',
      await said('mouseover', TAP, { at: [9, 9], on: 'click' }), '');

console.log(failures ? `\n${failures} failure(s)` : '\nevery event channel carries what the component reads');
process.exit(failures ? 1 : 0);
