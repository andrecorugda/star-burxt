// not-burxt: gap — speaks the protocol to the server over stdio; portable, and paired with the server above so both move together or neither does
// The language server, spoken to over JSON-RPC exactly as an editor would.
//
// **A server tested only by opening an editor is a server whose protocol handling is a guess.** This
// speaks the four messages that matter, on a document with a real problem in each of the three
// layers, and asserts the diagnostics come back on the right lines.
//
//     STAR_CHECK=./star-check node editors/lsp/drive-lsp.mjs
import { readFileSync } from 'node:fs';
import { spawn } from 'child_process';

const server = spawn('node', ['editors/vscode/server/star-lsp.mjs'], {
  stdio: ['pipe', 'pipe', 'inherit'],
  env: { ...process.env, STAR_CHECK: process.env.STAR_CHECK || 'star-check' },
});

let buffer = Buffer.alloc(0);
const waiting = [];
server.stdout.on('data', (chunk) => {
  buffer = Buffer.concat([buffer, chunk]);
  for (;;) {
    const split = buffer.indexOf('\r\n\r\n');
    if (split < 0) return;
    const length = Number(/Content-Length: (\d+)/i.exec(buffer.slice(0, split).toString())?.[1] ?? 0);
    if (buffer.length < split + 4 + length) return;
    const message = JSON.parse(buffer.slice(split + 4, split + 4 + length).toString('utf8'));
    buffer = buffer.slice(split + 4 + length);
    const next = waiting.shift();
    if (next) next(message);
  }
});

const send = (m) => {
  const text = JSON.stringify({ jsonrpc: '2.0', ...m });
  server.stdin.write(`Content-Length: ${Buffer.byteLength(text, 'utf8')}\r\n\r\n${text}`);
};
const reply = () => new Promise((resolve) => waiting.push(resolve));

let failures = 0;
const is = (what, got, want) => {
  const ok = String(got) === String(want);
  if (!ok) failures++;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${what}`);
  if (!ok) console.log(`       got  ${got}\n       want ${want}`);
};

// A document beside the real examples, so component imports resolve the way they would in a project.
const uri = `file://${process.cwd()}/examples/.lsp-probe.sbmx`;

send({ id: 1, method: 'initialize', params: { capabilities: {} } });
const ready = await reply();
is('the server answers initialize', ready.result.serverInfo.name, 'star-lsp');

// **This asserted the NAME, which is the half that never changes.** The server reported version `0.1.0`
// while the released tag was `v0.2.0`, and a client LOGS this field — so every bug report about a diagnostic
// would have named the wrong version, and nothing here would have said so. The markup session hit the
// identical defect in theirs and told me to grep for it.
{
  const manifest = readFileSync(new URL('../../burxt.package', import.meta.url), 'utf8');
  const wanted = /^version\s+(\S+)/m.exec(manifest)[1];
  is('and reports the version the package declares, rather than one of its own',
     ready.result.serverInfo.version, wanted);
}
is('it offers text sync', ready.result.capabilities.textDocumentSync, 1);

async function diagnosticsFor(text) {
  send({ method: 'textDocument/didOpen', params: { textDocument: { uri, languageId: 'sbmx', version: 1, text } } });
  const note = await reply();
  return note.params.diagnostics;
}

// 1. A well-formed component with a typo in a slot — the layer only star can find.
let got = await diagnosticsFor(':props: count: Int\n:!props:\n\nAt {{ to_string(cuont) }}.\n');
is('a slot typo is reported', got.length >= 1, true);
is('  …on the line the author wrote it', got[0]?.range.start.line, 3);
is('  …naming what is wrong', /cuont/.test(got[0]?.message ?? ''), true);

// 2. Not a component: an unknown block. star's own rule, already positioned.
got = await diagnosticsFor(':props: n: Int\n:!props:\n\n:mystery:\nhi\n:!mystery:\n');
is('an unknown block is reported with its code', got[0]?.code, 'STAR-E001');
is('  …on its fence', got[0]?.range.start.line, 3);

// 3. Not a document: a missing fence. BMX's rule.
got = await diagnosticsFor(':props: n: Int\n:!props:\n\n:div:\nno closing fence\n');
is('a malformed document is reported with BMX\'s code', got[0]?.code?.startsWith('BMX-E'), true);

// 4. A clean document reports nothing, which is the case a broken server also produces — so it is
//    asserted last, after three that prove the server can find things.
got = await diagnosticsFor(':props: count: Int\n:!props:\n\nAt {{ to_string(count) }}.\n');
is('a clean component reports nothing', got.length, 0);

// 5. BMX's structural WARNING, merged in beside star's errors — imported from BMX rather than
//    reimplemented, and severity 2 so it cannot fail a build.
got = await diagnosticsFor(':props: n: Int\n:!props:\n\n# One\n\n### Three\n');
const warned = got.find((d) => d.code === 'BMX-W001');
is("BMX's lint warnings are reported too", Boolean(warned), true);
is('  …as a warning, not an error', warned?.severity, 2);

// 6. And a `===bx` section is NOT linted as markup. Its braces are Burxt, and its lines must not
//    shift the line numbers of the markup below it.
got = await diagnosticsFor('===bx\nclass Model { n: Int }\npure function update(m: Int, x: Model) -> Model { return x; }\n===\n\n:props: model: Model\n:!props:\n\n# One\n\n### Three\n');
const shifted = got.find((d) => d.code === 'BMX-W001');
// `### Three` is the eleventh line of that document, and LSP counts from zero. **The point is that
// it is not shifted by the three lines of `===bx` above it** — the sections are blanked space for
// space rather than removed, so every offset below them is where the author put it.
is('a warning below a ===bx section is on the right line', shifted?.range.start.line, 10);

send({ id: 2, method: 'shutdown' });
await reply();
send({ method: 'exit' });

console.log(failures ? `\n${failures} failure(s)` : '\nthe server speaks the protocol');
process.exit(failures ? 1 : 0);
