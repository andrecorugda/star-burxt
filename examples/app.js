// star-burxt's driver: the part JavaScript has to do, and nothing else.
//
// **This file holds no application logic.** Copy it once per project and leave it alone.
//
// ---- why the state crosses the boundary as text ----------------------------------------------
//
// Nothing in Burxt holds state between two calls. A function sees its arguments and nothing else —
// which is what makes `pure` mean anything, and what lets `burxt effects` say what a component can
// reach. So the model cannot live in the module between events: the host holds it, hands it in, and
// takes the next one back.
//
// It crosses as JSON because that is what a component can write with `to_text` and read with
// `from_text`. When the language grows a value the host can hold opaquely, this file loses the two
// codec calls and nothing else changes.
//
// ---- the two directions are not symmetric, and that is the region model ----------------------
//
// OUT is a host call: `host_mount(html)` and `host_state(text)`. A String built inside a region
// cannot outlive the block, so the host takes the bytes before the region closes. A return value
// would be a pointer into freed memory.
//
// IN is an allocation: `burxt.alloc` gives us room inside the module's own heap and we write the
// bytes there. Writing anywhere else would be guessing at a layout the compiler owns.

// ---- a Burxt String, exactly ------------------------------------------------------------------
//
// Eight bytes of length, then the bytes, then a NUL. The length is BEFORE the pointer, which is why
// `host_mount` reads `p - 8` rather than scanning for the terminator — a rendered page may contain
// a NUL in an attribute and scanning would truncate it.
//
// The host owns `malloc`, so the host owns where a string goes. Writing anywhere else would be
// guessing at a layout the compiler decides.

const STACK_SIZE = 1048576;

export async function mount({ wasm, root, initial = "{}", component = "app", reconcile }) {
  let state = initial;
  let mem = null;
  let brk = 0;
  let mounts = 0;

  const u8 = () => new Uint8Array(mem.buffer);
  const dv = () => new DataView(mem.buffer);

  const cstr = (p) => {
    const b = u8();
    let e = p;
    while (b[e] !== 0) e++;
    return new TextDecoder().decode(b.subarray(p, e));
  };

  const malloc = (n) => {
    n = Number(n);
    if (!brk) brk = mem.buffer.byteLength;
    const need = brk + n;
    if (need > mem.buffer.byteLength) {
      try { mem.grow(Math.ceil((need - mem.buffer.byteLength) / 65536)); } catch { return 0; }
    }
    const p = brk;
    brk = (brk + n + 15) & ~15;
    return p;
  };

  // A String the module can read: length, bytes, NUL. Returns the pointer the ABI expects, which is
  // eight bytes past what was allocated.
  //
  // **Allocated by the MODULE, not by the host's `malloc`.** A JS bump allocator handing out
  // addresses in the same linear memory the module's arena is growing collides with it — measured:
  // the first frame rendered, the second exited 70. `burxt.alloc` is the compiler's own allocator
  // and knows where its arena is; the host has no business guessing.
  let alloc = null;
  const write = (text) => {
    const bytes = new TextEncoder().encode(text);
    const base = Number(alloc(BigInt(8 + bytes.length + 1)));
    dv().setBigUint64(base, BigInt(bytes.length), true);
    u8().set(bytes, base + 8);
    u8()[base + 8 + bytes.length] = 0;
    return base + 8;
  };

  const read = (p) => {
    const len = Number(dv().getBigUint64(p - 8, true));
    return new TextDecoder().decode(u8().subarray(p, p + len));
  };

  // `snprintf` is reached from Decimal formatting, so a page that shows money needs it.
  const format = (f, va) => {
    const d = dv();
    let a = va, s = "";
    for (let i = 0; i < f.length; i++) {
      if (f[i] !== "%") { s += f[i]; continue; }
      i++;
      let flags = ""; while ("-+ #0".includes(f[i])) flags += f[i++];
      let width = ""; while (f[i] >= "0" && f[i] <= "9") width += f[i++];
      let length = ""; while ("hlLzjt".includes(f[i])) length += f[i++];
      const c = f[i];
      if (c === "%") { s += "%"; continue; }
      let text;
      if (c === "s") { text = cstr(d.getUint32(a, true)); a += 4; }
      else {
        let v;
        if (length.includes("l") || length.includes("z")) {
          a = (a + 7) & ~7;
          v = c === "u" ? d.getBigUint64(a, true) : d.getBigInt64(a, true);
          a += 8;
        } else {
          v = c === "u" ? BigInt(d.getUint32(a, true)) : BigInt(d.getInt32(a, true));
          a += 4;
        }
        text = v.toString();
      }
      const n = width ? parseInt(width, 10) : 0;
      if (text.length < n) {
        if (flags.includes("0") && c !== "s") {
          const neg = text.startsWith("-"), body = neg ? text.slice(1) : text;
          text = (neg ? "-" : "") + body.padStart(n - (neg ? 1 : 0), "0");
        } else text = text.padStart(n, " ");
      }
      s += text;
    }
    return s;
  };

  let html = "";

  const env = {
    malloc,
    memcpy: (d, s, n) => { u8().copyWithin(d, s, s + Number(n)); return d; },
    snprintf: (buf, n, fmt, va) => {
      n = Number(n);
      const b = new TextEncoder().encode(format(cstr(fmt), va));
      const k = Math.min(b.length, n - 1);
      u8().set(b.subarray(0, k), buf);
      u8()[buf + k] = 0;
      return b.length;
    },
    getrlimit: (_r, p) => {
      dv().setBigUint64(p, BigInt(STACK_SIZE), true);
      dv().setBigUint64(p + 8, BigInt(STACK_SIZE), true);
      return 0;
    },
    // The page. Called from INSIDE the frame region, because a String built there cannot outlive
    // the block — a return value would be a pointer into freed memory.
    host_mount: (p) => { html = read(p); mounts++; return 0; },
    // The next state. Kept here because the module cannot keep it.
    host_state: (p) => { state = read(p); return 0; },
    exit: (c) => { throw new Error("burxt exit " + c); },
    fwrite: () => 0, fprintf: () => 0, stderr: 0,
    // **128-bit multiply, implemented rather than stubbed.** Clang emits a call to this for any
    // `Int` multiplication whose overflow has to be detected exactly — which is most of them in a
    // language that traps rather than wraps. A stub returning 0 does not fail loudly: it produces
    // wrong products, and the overflow check then fires on a correct program. That is exactly how
    // this was found — a component that round-tripped perfectly under `burxt run` exited 70 in the
    // browser on its second frame.
    //
    // The result is 128 bits, so it comes back through a pointer the caller supplies.
    __multi3: (ret, alo, ahi, blo, bhi) => {
      const a = BigInt.asIntN(128, (BigInt.asUintN(64, ahi) << 64n) | BigInt.asUintN(64, alo));
      const b = BigInt.asIntN(128, (BigInt.asUintN(64, bhi) << 64n) | BigInt.asUintN(64, blo));
      const r = BigInt.asUintN(128, a * b);
      dv().setBigUint64(ret, r & 0xffffffffffffffffn, true);
      dv().setBigUint64(ret + 8, r >> 64n, true);
      return 0;
    },
  };

  const bytes = wasm instanceof ArrayBuffer ? wasm : await (await fetch(wasm)).arrayBuffer();
  const { instance } = await WebAssembly.instantiate(bytes, { env });
  mem = instance.exports.memory;
  alloc = instance.exports["burxt.alloc"];
  if (!alloc) {
    throw new Error("link with --export='burxt.alloc' — the host allocates strings through the "
      + "module's own allocator, because a host-side one collides with its arena");
  }

  const first = instance.exports[`bx.${component}_first`];
  const frame = instance.exports[`bx.${component}_frame`];
  if (!first || !frame) {
    throw new Error(
      `\`${component}\` does not carry its own state. Add \`to_text\` and \`from_text\` to its ` +
      `\`===bx\` section — nothing in Burxt holds state between two calls, so the host has to.`);
  }

  const paint = () => {
    if (reconcile) reconcile(root, html);
    else root.innerHTML = html;
  };

  first(write(state));
  paint();

  // ONE delegated listener. The page carries `data-star-h` indices and nothing executable, so there
  // is no inline handler anywhere and nothing bound to a node the reconciler will replace.
  root.addEventListener("click", (ev) => {
    const el = ev.target.closest("[data-star-h]");
    if (!el) return;
    const handler = BigInt(el.getAttribute("data-star-h"));

    // WHICH ROW, read from the DOM rather than remembered: rows move, and the key moves with them.
    const keyed = el.closest("[data-star-key]");
    const key = keyed ? keyed.getAttribute("data-star-key") : "";

    frame(handler, write(key), write(state));
    paint();
  });

  return {
    get state() { return state; },
    get html() { return html; },
    get mounts() { return mounts; },
  };
}
