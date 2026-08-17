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

let server = null;
const collection = languages.createDiagnosticCollection('star');

function activate(context) {
  const checker = workspace.getConfiguration('starBurxt').get('check') || 'star-check';
  server = spawn('node', [context.asAbsolutePath('../lsp/star-lsp.mjs')], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, STAR_CHECK: checker },
  });
  server.on('error', (e) => window.showErrorMessage(`star-lsp did not start: ${e.message}`));
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

function show({ uri, diagnostics }) {
  collection.set(Uri.parse(uri), diagnostics.map((d) => {
    const it = new Diagnostic(
      new Range(d.range.start.line, d.range.start.character, d.range.end.line, d.range.end.character),
      d.message, DiagnosticSeverity.Error);
    it.source = d.source || 'star';
    if (d.code) it.code = d.code;
    return it;
  }));
}

function deactivate() { if (server) server.kill(); }

module.exports = { activate, deactivate };
