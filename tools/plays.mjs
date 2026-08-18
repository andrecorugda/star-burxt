// Play the game, and assert the board.
//
//     node tools/plays.mjs <snake.wasm>
//
// **A form asks star one question; a game asks the other four.** A tick that runs only while the state
// says so, four global keys, a list that moves and grows every frame, and a rule that ends it. Nothing
// else in this repository exercises any of that together.
//
// It can assert a BOARD rather than "something changed" because the game is deterministic: `update` is
// `pure`, so it cannot reach a clock, and the food position comes from a seed carried in the state. A
// game that could not be replayed exactly would leave this file checking that a number went up.
import { readFileSync } from 'node:fs';
import { mount } from '../examples/app.js';
import { fakeRoot } from '../examples/fake-dom.mjs';

const file = process.argv[2];
if (!file) { console.error('usage: node tools/plays.mjs <snake.wasm>'); process.exit(2); }

// The browser's async, faked — but only the parts the driver actually calls, and every parameter it
// reads is kept. A stub that drops one is how the coordinate channel went untested for months.
const timers = new Map();
let nextTimer = 1;
globalThis.setInterval = (fn, ms) => { const h = nextTimer++; timers.set(h, { fn, ms }); return h; };
globalThis.clearInterval = (h) => { timers.delete(h); };
const keyListeners = [];
globalThis.addEventListener = (kind, fn) => { if (kind === 'keydown') keyListeners.push(fn); };
globalThis.removeEventListener = (kind, fn) => {
  const at = keyListeners.indexOf(fn);
  if (at >= 0) keyListeners.splice(at, 1);
};

let failures = 0;
const check = (name, got, want) => {
  const ok = String(got) === String(want);
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${name}`);
  if (!ok) { failures += 1; console.log(`        got  ${JSON.stringify(got)}\n        want ${JSON.stringify(want)}`); }
};

const root = fakeRoot();
const app = await mount({ wasm: new Uint8Array(readFileSync(file)), root, component: 'snake',
                          initial: '{}' });

const state = () => JSON.parse(app.state);
const head = () => { const b = state().body; return `${b[0].x},${b[0].y}`; };
const tick = async () => { for (const { fn } of timers.values()) fn(); await new Promise((r) => setTimeout(r, 0)); };
const press = async (key) => { for (const fn of [...keyListeners]) fn({ key }); await new Promise((r) => setTimeout(r, 0)); };

// ---- it starts, and the tick is running BECAUSE the state says it is alive --------------------
check('a fresh game has a three-square snake', state().body.length, 3);
check('its head is in the middle', head(), '8,8');

// **A board nobody has touched does not move**, and that is `watch` rather than a flag the driver
// reads: it asks for no timer until the state says the game has started. The first version began
// moving at mount and was over in 840ms — before a player could reach the keyboard.
check('NO TICK until the game has started', timers.size, 0);
check('but all four arrow keys are watched, so there is something to start it with',
      keyListeners.length, 4);
check('and the page says what to do', /press an arrow key/.test(String(root.innerHTML)), true);

// ---- the first key starts it ------------------------------------------------------------------
await press('ArrowRight');
check('the first key starts the clock', timers.size, 1);

// ---- a tick moves it, and the length is unchanged ---------------------------------------------
await tick();
check('a tick advances the head', head(), '9,8');
check('and the snake does not grow on an ordinary move', state().body.length, 3);

// ---- a key turns it --------------------------------------------------------------------------
await press('ArrowDown');
check('a key turns it, without waiting for a tick to be pressed', `${state().dx},${state().dy}`, '0,1');
await tick();
check('and the next tick goes that way', head(), '9,9');

// ---- a reversal is ignored rather than fatal --------------------------------------------------
await press('ArrowUp');
check('reversing into its own neck is IGNORED, not death', `${state().dx},${state().dy}`, '0,1');
check('and it is still alive', state().alive, true);

// ---- eating: walk onto the food and check it grew ---------------------------------------------
{
  const before = state();
  const target = `${before.fx},${before.fy}`;
  // Steer square by square. A game that can be driven this way is a game that can be tested.
  for (let step = 0; step < 60 && `${state().body[0].x},${state().body[0].y}` !== target; step += 1) {
    const s = state();
    const dx = Math.sign(s.fx - s.body[0].x);
    const dy = Math.sign(s.fy - s.body[0].y);
    // Never reverse, and prefer the axis currently free to turn onto.
    if (dx !== 0 && s.dx === 0) await press(dx > 0 ? 'ArrowRight' : 'ArrowLeft');
    else if (dy !== 0 && s.dy === 0) await press(dy > 0 ? 'ArrowDown' : 'ArrowUp');
    await tick();
    if (!state().alive) break;
  }
  const after = state();
  check('walking onto the food scores', after.score, 1);
  check('and the snake is one square longer', after.body.length, before.body.length + 1);
  check('and the food has moved somewhere else', `${after.fx},${after.fy}` !== target, true);
}

// ---- a wall ends it, and the TICK STOPS because the state stopped asking ----------------------
{
  await press('ArrowRight');
  for (let step = 0; step < 40 && state().alive; step += 1) await tick();
  check('running into a wall ends the game', state().alive, false);
  check('THE TICK STOPS BECAUSE THE STATE STOPPED ASKING — no cleanup to forget', timers.size, 0);
  check('the page says so', /dead on/.test(String(root.innerHTML)), true);
  // The keys stay watched, or "new game" would be unreachable by keyboard.
  check('but the keys are still watched, so the game can be restarted', keyListeners.length, 4);
}

// ---- and it can be played again ---------------------------------------------------------------
root.fire('click', 0, { on: 'click' });
await new Promise((r) => setTimeout(r, 0));
check('a new game resets the board', state().body.length, 3);
check('with the score back to nothing', state().score, 0);
check('and it waits to be started, exactly as the first one did', timers.size, 0);
await press('ArrowUp');
check('a key starts it again', timers.size, 1);

console.log(failures ? `\n${failures} failure(s)` : '\nthe game plays, ends, and starts again');
process.exit(failures ? 1 : 0);
