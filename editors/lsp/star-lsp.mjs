#!/usr/bin/env node
// star-lsp — diagnostics for `.sbmx`, over JSON-RPC on stdio. No dependencies.
//
//     node star-lsp.mjs            (an editor spawns it; it is not run by hand)
//
// **A server, not a library, and separate from BMX's.** BMX ships one for `.bmx`; this one owns
// `.sbmx`. Two extensions cannot fight over a file, ownership matches who owns what — the format
// versus the framework — and each can do things the other should not. BMX's can hold a conformance
// opinion about a document; that would be noise in a component.
//
// ---- what it reports, and who decides ---------------------------------------------------------
//
//     BMX-Ennn    the document is not well formed        BMX's parser
//     STAR-Ennn   the document is not a component        star's own rules
//     a type error the code inside it does not compile   the Burxt compiler
//
// **All three come from `star-check`, which is the command line.** A server that reimplemented any
// of them would be a second opinion, and the second opinion is the one that would be wrong. So this
// file is a protocol wrapper: it runs the same binary a person runs, and turns its output into
// ranges.
//
// ---- the one thing that is genuinely approximate, said out loud --------------------------------
//
// A type error points into the GENERATED component, because that is where the code the compiler
// judged lives. Mapping it back onto the document is done by finding the offending expression in
// the source — which is exact when the expression appears once and picks the first occurrence when
// it appears twice. The alternative is a real source map, which needs the emitter to record an
// offset per expression; that is worth building and is not built.
//
// It is marked in the message when it happens, so nobody trusts a position further than it deserves.
import { spawnSync } from 'child_process';
import { writeFileSync, mkdtempSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const CHECK = process.env.STAR_CHECK || 'star-check';
const work = mkdtempSync(join(tmpdir(), 'star-lsp-'));

// ---- the protocol, which is four messages and a header ----------------------------------------
let buffer = Buffer.alloc(0);
process.stdin.on('data', (chunk) => {
  buffer = Buffer.concat([buffer, chunk]);
  for (;;) {
    const split = buffer.indexOf('\r\n\r\n');
    if (split < 0) return;
    const header = buffer.slice(0, split).toString('ascii');
    const length = Number(/Content-Length: (\d+)/i.exec(header)?.[1] ?? 0);
    if (buffer.length < split + 4 + length) return;
    const body = buffer.slice(split + 4, split + 4 + length).toString('utf8');
    buffer = buffer.slice(split + 4 + length);
    try { handle(JSON.parse(body)); } catch (e) { log(`bad message: ${e.message}`); }
  }
});

const send = (message) => {
  const text = JSON.stringify(message);
  process.stdout.write(`Content-Length: ${Buffer.byteLength(text, 'utf8')}\r\n\r\n${text}`);
};
const log = (text) => process.stderr.write(`star-lsp: ${text}\n`);

const documents = new Map();

function handle(message) {
  switch (message.method) {
    case 'initialize':
      // **Diagnostics only, and each omission has a reason.** No formatting: reflowing a block head
      // means deciding what it means, and that is the document's business. No completion yet: it
      // needs the element vocabulary and the imported components, which star knows and this server
      // does not ask for yet.
      send({ jsonrpc: '2.0', id: message.id, result: {
        capabilities: { textDocumentSync: 1, diagnosticProvider: { interFileDependencies: true, workspaceDiagnostics: false } },
        serverInfo: { name: 'star-lsp', version: '0.1.0' },
      }});
      break;
    case 'shutdown':
      send({ jsonrpc: '2.0', id: message.id, result: null });
      break;
    case 'exit':
      process.exit(0);
      break;
    case 'textDocument/didOpen':
      check(message.params.textDocument.uri, message.params.textDocument.text);
      break;
    case 'textDocument/didChange':
      // Sync is FULL (1), so the last change carries the whole document.
      check(message.params.textDocument.uri,
            message.params.contentChanges[message.params.contentChanges.length - 1].text);
      break;
    case 'textDocument/didClose':
      documents.delete(message.params.textDocument.uri);
      publish(message.params.textDocument.uri, []);
      break;
  }
}

// ---- running the real checker ------------------------------------------------------------------
//
// Written to a file beside nothing, because `star-check` resolves component imports relative to the
// document — so a page's `use "./Badge.sbmx"` has to be findable. The temp copy goes in the SAME
// directory as the real file for exactly that reason; a temp directory would break every import.
function check(uri, text) {
  documents.set(uri, text);
  const real = uri.replace(/^file:\/\//, '');
  const shadow = real.replace(/\.sbmx$/, '.lsp.sbmx');
  try {
    writeFileSync(shadow, text);
    const run = spawnSync(CHECK, [shadow], { encoding: 'utf8' });
    publish(uri, diagnose((run.stderr || '') + (run.stdout || ''), text, shadow));
  } catch (e) {
    log(`could not check: ${e.message}`);
  } finally {
    try { unlinkSync(shadow); } catch {}
  }
}

const publish = (uri, diagnostics) =>
  send({ jsonrpc: '2.0', method: 'textDocument/publishDiagnostics', params: { uri, diagnostics } });

// A whole line, from a one-based line:column pair.
function range(text, line, column, length) {
  const lines = text.split('\n');
  const l = Math.max(0, line - 1);
  const c = Math.max(0, column - 1);
  const width = length ?? Math.max(1, (lines[l] ?? '').length - c);
  return { start: { line: l, character: c }, end: { line: l, character: c + width } };
}

function diagnose(output, text, shadow) {
  const found = [];
  const at = (line, column, code, message, length) => found.push({
    range: range(text, line, column, length),
    severity: 1, source: 'star', code, message,
  });

  // `<path>:<line>:<column>: BMX-Ennn message` — BMX's own, already positioned.
  for (const m of output.matchAll(/^.*?:(\d+):(\d+): (BMX-E\d+) (.*)$/gm)) {
    at(Number(m[1]), Number(m[2]), m[3], m[4]);
  }

  // `<path>: STAR-Ennn at <line>:<column>: message`
  for (const m of output.matchAll(/^.*?: (STAR-E\d+) at (\d+):(\d+): (.*)$/gm)) {
    at(Number(m[2]), Number(m[3]), m[1], m[4]);
  }

  // `<path>: STAR-Ennn: message` — the refusals that are about the whole document rather than a
  // place in it, like a missing `props` block.
  for (const m of output.matchAll(/^.*?: (STAR-E\d+): (.*)$/gm)) {
    at(1, 1, m[1], m[2]);
  }

  // A type error, which points into the generated component. Mapped back by finding the offending
  // expression in the document — exact when it appears once, first-occurrence when it does not.
  for (const m of output.matchAll(/^error: (.*)\n\s*-->[^\n]*\n[^\n]*\n\s*\d+ \| (.*)$/gm)) {
    const [, message, generated] = m;
    const where = locate(text, message, generated);
    found.push({
      range: where.range,
      severity: 1, source: 'burxt',
      message: where.exact ? message
        : `${message}\n\n(position approximate — this is a type error in the generated component, `
          + `mapped back by searching for the expression)`,
    });
  }
  return found;
}

// Where in the document a compiler error belongs.
//
// The compiler names the thing it objected to — `unknown variable: cuont` — and that name appears in
// the document, in the slot or head the author wrote. Searching for it beats reporting line 1, and
// says so when it is a guess.
function locate(text, message, generatedLine) {
  const named = /`([^`]+)`|unknown variable: (\S+)|unknown field: (\S+)/.exec(message);
  const needle = named ? (named[1] || named[2] || named[3]) : null;
  if (needle) {
    const index = text.indexOf(needle);
    if (index >= 0) {
      const before = text.slice(0, index);
      const line = before.split('\n').length;
      const column = index - before.lastIndexOf('\n');
      const twice = text.indexOf(needle, index + 1) >= 0;
      return { range: range(text, line, column, needle.length), exact: !twice };
    }
  }
  return { range: range(text, 1, 1, 1), exact: false };
}

log(`ready (checker: ${CHECK}, scratch: ${work})`);
