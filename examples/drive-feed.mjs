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

// **A POLL MUST ACTUALLY POLL**, and for as long as this file existed it did not. The example pointed
// its timer at the FETCH's tag, so every tick delivered an empty body and `string_to_int("", 0)` set
// the items to zero: 42 before a tick, 0 after — a live feed that blanked itself every five seconds,
// taught on the site. This test asserted that a timer STARTS and STOPS and never once asked what a tick
// does, which is the same shape as every other miss this week: the assertion that was never written.
//
// The cause was not the example. `commands` takes a `Msg` and a reply is not one, so nothing arriving
// through a subscription could ask for anything to be done — polling was not expressible. `after(tag, m)`
// is the missing half.
{
  const before = fetched.length;
  timers.filter(Boolean)[0].fn();
  await new Promise((r) => setTimeout(r, 20));
  is('a tick ASKS FOR THE FETCH AGAIN, which is what a poll is', fetched.length, before + 1);
  is('and the items it already had survive the tick', JSON.parse(app.state).items, 42);
}

root.fire('click', 1);
is('and stops the same way — no cleanup function to forget', timers.filter(Boolean).length, 0);

done('commands and subscriptions hold');
