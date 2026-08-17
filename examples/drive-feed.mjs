// Commands and subscriptions, against a real WebAssembly module.
//
// **This is the only place the async story is checked**, and it has to be here rather than in
// `test.py`: what is being tested is that a fetch goes out, a reply comes back under the author's
// tag, and a subscription starts and stops because the STATE changed. None of that exists until the
// driver and the module are both running.
//
//     node drive-feed.mjs feed.wasm
import { readFileSync } from 'fs';
import { mount } from './app.js';

// The browser's async, faked: fetch, timers, keyboard.
const fetched = [];
globalThis.fetch = (url) => { fetched.push(url); return Promise.resolve({ text: () => Promise.resolve('42') }); };
globalThis.AbortController = class { constructor() { this.signal = {}; } abort() {} };
const timers = [];
globalThis.setInterval = (fn, ms) => { timers.push({ fn, ms }); return timers.length; };
globalThis.clearInterval = (h) => { timers[h - 1] = null; };
const keys = [];
globalThis.addEventListener = (k, fn) => keys.push({ k, fn });
globalThis.removeEventListener = () => {};

const kinds = {};
const root = {
  innerHTML: '', addEventListener(k, fn) { (kinds[k] ||= []).push(fn); }, querySelector: () => null,
};
function fire(kind, handler) {
  const el = { getAttribute: (n) => (n === 'data-star-h' ? String(handler) : null), closest: () => null };
  (kinds[kind] || []).forEach((fn) => fn({ target: { closest: () => el }, preventDefault() {} }));
}

const app = await mount({
  wasm: readFileSync(process.argv[2] || 'feed.wasm').buffer,
  root, component: 'feed', initial: '{}',
});

let failures = 0;
const is = (what, got, want) => {
  const ok = String(got) === String(want);
  if (!ok) failures++;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${what}`);
  if (!ok) console.log(`       got  ${got}\n       want ${want}`);
};

is('a subscription the state asks for is running', keys.length, 1);
is('one it does not ask for is not', timers.filter(Boolean).length, 0);

fire('click', 0);
await new Promise((r) => setTimeout(r, 10));
is('a command reaches the driver', fetched.join(' '), '/api/feed');
is('THE REPLY ARRIVES UNDER THE AUTHOR\'S OWN TAG', app.state,
   '{"items":42,"status":"ready","polling":false}');

fire('click', 1);
is('a subscription starts because the STATE changed', timers.filter(Boolean).length, 1);

fire('click', 1);
is('and stops the same way — no cleanup function to forget', timers.filter(Boolean).length, 0);

console.log(failures ? `\n${failures} failure(s)` : '\ncommands and subscriptions hold');
process.exit(failures ? 1 : 0);
