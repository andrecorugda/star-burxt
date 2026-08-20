// not-burxt: platform — VS Code's extension API is JavaScript and cannot be anything else
// The thinnest client that will do: spawn the server, pipe it, let it publish diagnostics.
//
// **No `vscode-languageclient` dependency.** That package is the normal answer and it would be the
// only thing in this repository with a node_modules — for a server that speaks four messages and
// publishes diagnostics. The protocol is a header and a JSON body; VS Code's own API can carry it.
//
// The consequence to accept honestly: no automatic restart, no trace channel, no workspace
// configuration sync. When this server grows completion those are worth the dependency. Diagnostics
// alone are not.
const { workspace, languages, window, Uri, Range, Diagnostic, DiagnosticSeverity } = require('vscode');
const { spawn } = require('child_process');
const { existsSync } = require('fs');

// **Where the server is, tried rather than assumed.** This was a bare
// `asAbsolutePath('../lsp/star-lsp.mjs')` — a path OUTSIDE the extension folder, which works only when the
// extension is the repository's own `editors/vscode`. Copy that folder into `~/.vscode/extensions` and the
// server is not there; package it with `vsce` and the file is not in the archive. Either way the extension
// installs, activates, colours a document and silently never reports a single error — which is the worst
// shape available, because the half that still works looks like the whole thing working.
//
// **Tested, and the first fix was still wrong.** I moved the sibling path to a candidate list and documented
// a symlink install — then checked it, and `path.join('/ext', '../lsp/x')` normalises the `..` LEXICALLY, so
// it resolves outside the symlink too. A symlink install would have coloured and never checked, exactly like
// a copy. The server had to move INSIDE the extension; nothing else makes every install method work.
//
// ---- and the server is a compiled binary now, which adds one candidate and removes `node` ---------
//
// `server/star-lsp.bx` replaced `server/star-lsp.mjs`, so what gets spawned is a program rather than a
// script handed to an interpreter. **That is the point of the port: this extension needed `node`,
// `burxt` and `star-check` on `PATH`, and `node` was there only to run a wrapper around the other two.**
// It now needs `burxt`, `star-check` and `star-lsp` — three of star's own, and no interpreter.
//
// **A binary cannot be shipped the way a script could, and that is the one thing this change costs.**
// `star-lsp.mjs` was portable text: one file in the `.vsix` ran on every machine that had `node`. A
// compiled `star-lsp` is built for one platform, so an archive carrying one is an archive that works on
// one. Hence the second candidate, and it is not a fallback in the sense the old `../lsp/` one was:
//
//   * `server/star-lsp` INSIDE the extension — the shape the paragraphs above argue for, and the only
//     one that survives a copy install and a symlink install alike. A checkout that built the server
//     there, or a platform-specific package, is found here.
//   * `star-lsp` on `PATH` — resolved by the OS, exactly as `star-check` already is. This is the
//     documented install: `burxt build editors/vscode/server/star-lsp.bx -o star-lsp`, then put it
//     where the other star commands are. **A bare name is deliberately not a path**, so none of the
//     lexical-`..` hazard above applies to it — there is no `..` to normalise.
//
// The `PATH` name is returned rather than `null`, because a missing binary is now reported by the spawn
// failing rather than by this function guessing: `spawn` raises `ENOENT` and the handler below says so.
// A message printed before trying would be wrong for everyone who installed it the documented way.
function serverCommand(context) {
  const inside = context.asAbsolutePath('server/star-lsp');
  if (existsSync(inside)) return inside;
  return 'star-lsp';
}

let server = null;
const collection = languages.createDiagnosticCollection('star');

function activate(context) {
  const checker = workspace.getConfiguration('starBurxt').get('check') || 'star-check';
  const found = serverCommand(context);
  server = spawn(found, [], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, STAR_CHECK: checker },
  });
  // **The one place a missing server is reported, and it names the consequence rather than the error.**
  // Without it `.sbmx` files are still coloured — the grammar loads UI-side — so the extension looks
  // like it is working while checking nothing, which is the shape the comments above exist about.
  server.on('error', (e) => window.showErrorMessage(
    `star-burxt: the language server did not start, so \`.sbmx\` files will be coloured but never `
    + `checked. Tried \`${found}\`. Build it with \`burxt build editors/vscode/server/star-lsp.bx `
    + `-o star-lsp\` and put it on PATH beside \`star-check\`. (${e.message})`));
  server.stderr.on('data', (d) => console.log(String(d)));

  let buffer = Buffer.alloc(0);
  server.stdout.on('data', (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    for (;;) {
      const split = buffer.indexOf('\r\n\r\n');
      if (split < 0) return;
      const length = Number(/Content-Length: (\d+)/i.exec(buffer.slice(0, split).toString())?.[1] ?? 0);
      if (buffer.length < split + 4 + length) return;
      const message = JSON.parse(buffer.slice(split + 4, split + 4 + length).toString('utf8'));
      buffer = buffer.slice(split + 4 + length);
      if (message.method === 'textDocument/publishDiagnostics') show(message.params);
    }
  });

  const send = (m) => {
    const text = JSON.stringify({ jsonrpc: '2.0', ...m });
    server.stdin.write(`Content-Length: ${Buffer.byteLength(text, 'utf8')}\r\n\r\n${text}`);
  };
  send({ id: 1, method: 'initialize', params: { capabilities: {} } });

  const open = (doc) => {
    if (doc.languageId !== 'sbmx') return;
    send({ method: 'textDocument/didOpen', params: { textDocument: {
      uri: doc.uri.toString(), languageId: 'sbmx', version: doc.version, text: doc.getText() } } });
  };
  workspace.textDocuments.forEach(open);
  context.subscriptions.push(
    workspace.onDidOpenTextDocument(open),
    workspace.onDidSaveTextDocument(open),
    workspace.onDidChangeTextDocument((e) => open(e.document)),
    collection,
  );
}

// **The severity is the server's to decide, and this threw it away.** Every diagnostic was rendered as
// `Error` regardless of what arrived, so BMX's structural warnings — sent at severity 2 precisely
// because *a linter that fails a build is a linter people switch off* — reached the editor as red
// errors. The server's rule and the client's display disagreed, and the client won.
//
// Nothing sends a 2 today: the warnings came from `reference/bmx.js`, which the ported server cannot
// import, and they return when `bmx_lint` exists on BMX's Burxt side. That is why this is mapped rather
// than left as it was — a display that discards a field is wrong whether or not anything is currently
// setting it, and this one would have been rediscovered by whoever landed the lint.
const SEVERITIES = {
  1: DiagnosticSeverity.Error,
  2: DiagnosticSeverity.Warning,
  3: DiagnosticSeverity.Information,
  4: DiagnosticSeverity.Hint,
};

function show({ uri, diagnostics }) {
  collection.set(Uri.parse(uri), diagnostics.map((d) => {
    const it = new Diagnostic(
      new Range(d.range.start.line, d.range.start.character, d.range.end.line, d.range.end.character),
      d.message, SEVERITIES[d.severity] ?? DiagnosticSeverity.Error);
    it.source = d.source || 'star';
    if (d.code) it.code = d.code;
    return it;
  }));
}

function deactivate() { if (server) server.kill(); }

module.exports = { activate, deactivate };
