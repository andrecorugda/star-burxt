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
import { fakeRoot, checker } from './fake-dom.mjs';

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

const root = fakeRoot();
const app = await mount({
  wasm: readFileSync(process.argv[2] || 'feed.wasm').buffer,
  root, component: 'feed', initial: '{}',
});
const { is, done } = checker();

// The driver must ask for every event star accepts, or a handler star generated never runs.
is('the driver wires every event star can accept', root.wired, 39);

is('a subscription the state asks for is running', keys.length, 1);
is('one it does not ask for is not', timers.filter(Boolean).length, 0);

root.fire('click', 0);
await new Promise((r) => setTimeout(r, 10));
is('a command reaches the driver', fetched.join(' '), '/api/feed');
is("THE REPLY ARRIVES UNDER THE AUTHOR'S OWN TAG", app.state,
   '{"items":42,"status":"ready","polling":false}');

root.fire('click', 1);
is('a subscription starts because the STATE changed', timers.filter(Boolean).length, 1);

root.fire('click', 1);
is('and stops the same way — no cleanup function to forget', timers.filter(Boolean).length, 0);

done('commands and subscriptions hold');
