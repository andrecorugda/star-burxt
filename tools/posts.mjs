// What a SERVER receives when a component saves something.
//
//     node tools/posts.mjs <poster.wasm>
//
// **The test that covers commands could not have caught this, and the reason is worth keeping.**
// `drive-feed.mjs` fakes the browser with `globalThis.fetch = (url) => …` — one parameter, so the
// options object carrying method, body and headers is dropped on the floor. Commands have been tested
// since they existed and the wire has never been looked at. **A stub that discards the argument under
// test is an instrument that cannot fail**, and it looks exactly like coverage.
//
// So this one starts a real `node:http` server and reads what turns up. Measured against Laravel's
// rules, a `send` used to fail three ways and only one of them was loud:
//
//   no `X-CSRF-TOKEN`              419 Page Expired on any `web` route
//   `content-type: text/plain`     `$request->input('label')` is EMPTY, and nothing reports it
//   `accept: */*`                  a validation failure returns 302 + HTML instead of 422 + fields
//
// The middle one is why this is a test and not a note. A silent empty body looks like the user typed
// nothing, and the place you would go looking is the component.
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { mount } from '../examples/app.js';
import { fakeRoot } from '../examples/fake-dom.mjs';

const file = process.argv[2];
if (!file) {
  console.error('usage: node tools/posts.mjs <poster.wasm>');
  process.exit(2);
}
const bytes = new Uint8Array(readFileSync(file));

let failures = 0;
const check = (name, ok, detail) => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${name}`);
  if (!ok) { failures += 1; if (detail !== undefined) console.log('        ' + String(detail).slice(0, 300)); }
};

let seen = null;
const server = createServer((req, res) => {
  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', () => {
    seen = { method: req.method, url: req.url, headers: { ...req.headers }, body };
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end('saved');
  });
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

// One save, driven through the real driver at the real server.
//
// **Waiting for the request is not waiting for the reply**, and the first version of this stopped at
// the first: the server sets `seen` when it RECEIVES, and the response still has to travel back and
// reach `arrived`. So the page was read mid-flight and the check passed or failed depending on
// scheduling — green the first time I ran it. It waits for the delivered value now, with the timeout
// as the failure rather than the pass.
const save = async (initial, until) => {
  seen = null;
  const root = fakeRoot();
  const app = await mount({ wasm: bytes, root, component: 'poster', initial });
  root.fire('click', 0, {});
  for (let i = 0; i < 200; i += 1) {
    if (seen && (!until || String(root.innerHTML).includes(until))) break;
    await new Promise((r) => setTimeout(r, 10));
  }
  return { root, app };
};

const url = `http://127.0.0.1:${port}/tasks`;

// ---- without a page, which is every non-browser host ------------------------------------------
{
  const { root } = await save(JSON.stringify({ status: 'idle', url }), 'saved');

  // **The CONTROL FIRST.** Every header assertion below is about a request, so if no request arrived
  // they would all pass on an empty object — the shape this file exists to refuse.
  check('the request arrived at all', seen !== null, 'nothing reached the server');
  if (seen) {
    check('it is a POST', seen.method === 'POST', seen.method);
    check('to the url the component chose', seen.url === '/tasks', seen.url);
    check('carrying the body the component built', seen.body === '{"label":"buy milk"}', seen.body);
    check('the server is told the body is JSON, so a framework will parse it',
          seen.headers['content-type'] === 'application/json', seen.headers['content-type']);
    // What axios sends, and the value is the point rather than a preference: `application/json`
    // FIRST makes Laravel's `wantsJson()` true, and `*/*` present makes `acceptsAnyContentType()`
    // true — so a validation error arrives as 422 with the fields either way, while a plain-text
    // reply is still not refused.
    check('and asked for JSON back, so an error is data rather than a redirect',
          seen.headers['accept'] === 'application/json, text/plain, */*', seen.headers['accept']);
    check('and told this is a background request',
          seen.headers['x-requested-with'] === 'XMLHttpRequest', seen.headers['x-requested-with']);
    check('no CSRF token, because this page has none to give',
          seen.headers['x-csrf-token'] === undefined, seen.headers['x-csrf-token']);
  }
  check('the reply reaches the component under its own tag',
        String(root.innerHTML).includes('saved'), String(root.innerHTML).slice(0, 200));
}

// ---- with a page that carries a token, which is Laravel and Rails ------------------------------
//
// The token is read from the PAGE rather than taken from the component, and that is the design
// rather than a convenience: a CSRF token belongs to the session, so a component receiving one would
// carry a field about the transport in its own state, and every component would have that field.
{
  globalThis.document = {
    querySelector: (sel) => (sel === 'meta[name="csrf-token"]'
      ? { getAttribute: (a) => (a === 'content' ? 'tok-abc123' : null) } : null),
  };
  await save(JSON.stringify({ status: 'idle', url }));
  check('a page with `<meta name="csrf-token">` sends the token',
        seen && seen.headers['x-csrf-token'] === 'tok-abc123', seen && seen.headers['x-csrf-token']);
  // The control for THIS case: a token appearing without a request would be meaningless too.
  check('and it is the same request that carried the body',
        seen && seen.body === '{"label":"buy milk"}', seen && seen.body);
  delete globalThis.document;
}

server.close();
console.log(failures ? `\n${failures} failure(s)` : '\nwhat a server receives is what a server needs');
process.exit(failures ? 1 : 0);
