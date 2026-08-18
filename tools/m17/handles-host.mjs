// The host-side half of M17's handle suite — the refusals a HOST can reach and Burxt cannot.
//
//     node tools/m17/handles-host.mjs <handles.wasm>
//
// **Written for the language session, at their request.** Two of M17's six acceptance criteria — a
// never-issued handle and a wrong-type handle — are unreachable from Burxt, because the type system
// will not let a program fabricate a `Handle`. From JS they are one integer each.
//
// Build the module it drives with `tools/m17/handles.bx`:
//
//     burxt build handles.bx --target wasm32-unknown-unknown -o handles.o
//     rust-lld -flavor wasm --no-entry --allow-undefined --export=main \
//       --export='bx.start' --export='bx.bump' --export='bx.read' \
//       --export='burxt.alloc' --export=memory handles.o -o handles.wasm
//
// **`fwrite` and `fprintf` are implemented rather than stubbed, and that is the point of the file.**
// A Burxt runtime refusal writes its message to stderr and then calls `exit`. star's own browser
// driver stubs both to 0, so in a real page the wording — which IS the feature — is discarded and the
// host sees a bare `exit 70`. A test that stubs them cannot read what it is testing.

const WASM = process.argv[2] || '/tmp/m17/handles.wasm';

import { readFileSync } from 'node:fs';

const load = async () => {
  let mem = null, brk = 0, said = [];
  const u8 = () => new Uint8Array(mem.buffer);
  const dv = () => new DataView(mem.buffer);
  const cstr = (p) => { const b = u8(); let e = p; while (b[e] !== 0) e++;
    return new TextDecoder().decode(b.subarray(p, e)); };

  class Exited extends Error { constructor(code) { super('exit ' + code); this.code = code; } }

  // Enough of printf to read a runtime message: %s, %d/%i/%u, and the length modifiers Burxt emits.
  const format = (f, va) => {
    if (va === undefined) return f;
    const d = dv(); let a = va, out = '';
    for (let i = 0; i < f.length; i++) {
      if (f[i] !== '%') { out += f[i]; continue; }
      i++;
      let flags = ''; while ('-+ #0'.includes(f[i])) flags += f[i++];
      let width = ''; while (f[i] >= '0' && f[i] <= '9') width += f[i++];
      let length = ''; while ('hlLzjt'.includes(f[i])) length += f[i++];
      const c = f[i];
      if (c === '%') { out += '%'; continue; }
      if (c === 's') { out += cstr(d.getUint32(a, true)); a += 4; continue; }
      let v;
      if (length.includes('ll') || length.includes('z') || length.includes('j')) {
        a = (a + 7) & ~7;
        v = c === 'u' ? d.getBigUint64(a, true) : d.getBigInt64(a, true);
        a += 8;
      } else {
        v = c === 'u' ? BigInt(d.getUint32(a, true)) : BigInt(d.getInt32(a, true));
        a += 4;
      }
      out += v.toString();
    }
    return out;
  };

  const env = {
    malloc: (n) => { n = Number(n); if (!brk) brk = mem.buffer.byteLength;
      const need = brk + n;
      if (need > mem.buffer.byteLength) {
        try { mem.grow(Math.ceil((need - mem.buffer.byteLength) / 65536)); } catch { return 0; }
      }
      const p = brk; brk = (brk + n + 15) & ~15; return p; },
    memcpy: (d, s, n) => { u8().copyWithin(d, s, s + Number(n)); return d; },
    getrlimit: (_r, p) => { dv().setBigUint64(p, 1048576n, true);
      dv().setBigUint64(p + 8, 1048576n, true); return 0; },
    snprintf: (buf, n, fmt) => { const b = new TextEncoder().encode(cstr(fmt));
      const k = Math.min(b.length, Number(n) - 1); u8().set(b.subarray(0, k), buf);
      u8()[buf + k] = 0; return b.length; },
    // The two that matter: capture what the runtime says instead of discarding it.
    fwrite: (ptr, size, count) => { const n = Number(size) * Number(count);
      said.push(new TextDecoder().decode(u8().subarray(ptr, ptr + n))); return count; },
    // **Varargs formatted, not dumped.** The first version pushed the format string raw and reported
    // `generation %lld` — which would have been me sending a language session a defect that was mine.
    // A runtime message carries its numbers through `fprintf`, so a host that does not format is a
    // host that cannot read the message it is testing.
    fprintf: (_stream, fmt, va) => { said.push(format(cstr(fmt), va)); return 0; },
    exit: (code) => { throw new Exited(Number(code)); },
    stderr: 0,
    __multi3: () => 0,
  };

  const { instance } = await WebAssembly.instantiate(
    new Uint8Array(readFileSync(WASM)).buffer.slice(0), { env });
  mem = instance.exports.memory;
  return {
    exports: instance.exports,
    call(name, ...args) {
      said = [];
      try { return { value: instance.exports['bx.' + name](...args), said: said.join('') }; }
      catch (e) { return { threw: e.code ?? String(e.message), said: said.join('') }; }
    },
  };
};

// **A BigInt-safe stringifier, and I needed it within a minute of writing this file.** A handle is an
// i64, JS sees a BigInt, and `JSON.stringify` throws `TypeError: Do not know how to serialize a
// BigInt` — the exact trap I had just reported to the language session as "a host author will meet
// this in the first hour". I met it in the test written to check their feature.
const show = (v) => JSON.stringify(v, (_k, x) => (typeof x === 'bigint' ? x + 'n' : x));

let failures = 0;
const check = (name, ok, detail) => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${name}`);
  if (!ok) { failures += 1; if (detail) console.log('        ' + String(detail).slice(0, 400)); }
};

const a = await load();

// ---- the control: a handle the module issued works, and its VALUE is right ---------------------
const first = a.call('start', 7n);
check('a module-issued handle reads back', Number(a.call('read', first.value).value) === 7,
      show(first));
const next = a.call('bump', first.value);
check('and the next generation carries the update', Number(a.call('read', next.value).value) === 8,
      show(next));

// ---- what a host can actually reach, and WHAT EACH ONE SAYS ----------------------------------
//
// **A correction to what I told the language session.** I assumed `bump(h)` supersedes `h`. It does
// not: each `handle_of` takes a fresh INDEX in the same generation, so h1, h2 and h3 are all live and
// all readable — 7, 8, 9. The generation guards a table RESET, not a stale-but-live handle.
for (const [label, h] of [
  ['gen 1, index 999 — never issued',      (1n << 32n) | 999n],
  ['gen 9, index 0 — a future generation', (9n << 32n) | 0n],
  ['gen 0, index 0 — zero, the obvious host mistake', 0n],
  ['a negative i64',                        -1n],
]) {
  const got = a.call('read', h);
  check(label + ' is refused', got.threw !== undefined, show(got));
  console.log('        ' + (got.said ? JSON.stringify(got.said.trim()) : '(said nothing)'));
}

// ---- the shape that is NOT detected, reported rather than asserted ----------------------------
//
// **Two instances issue identical bit patterns**, so module A accepts B's handle and reads its OWN
// value at that index. Not corruption — A never touches B's memory, they are separate instances — but
// not detection either: a handle carries no module identity. M17's third criterion, *a handle from
// another module*, is unreachable this way whenever the bit patterns coincide, which for two freshly
// started modules is always.
//
// **Not a star-burxt risk**, and the reason is worth stating so nobody treats this as urgent on my
// account: star compiles every component of a page into ONE module, so there is no second table for a
// handle to come from. It is reported because it is the criterion, not because it blocks me.
const b2 = await load();
const theirs2 = b2.call('start', 99n);
const foreign2 = a.call('read', theirs2.value);
console.log('  note   another module\'s handle has the same bits and is accepted: read = '
            + show(foreign2.value) + '  (module A\'s own value, not B\'s 99)');

// The one shape that is NOT refused, asserted so a change of mind shows up here.
const older = a.call('read', first.value);
check('an OLDER live handle still reads — by design, and worth pinning',
      Number(older.value) === 7, show(older));

console.log(failures ? `\n${failures} failure(s)` : '\nall three host-reachable refusals fire');
process.exit(failures ? 1 : 0);
