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

  // ---- getting a String INTO the module -------------------------------------------------------
  //
  // **Allocated by the MODULE, not by the host.** A JS bump allocator handing out addresses in the
  // same linear memory the module's arena is growing collides with it — measured: the first frame
  // rendered and the second exited 70. `burxt.alloc` knows where its arena is; the host does not.
  //
  // **And allocated ONCE PER SLOT, not once per frame.** The arena has no `free`, and a region only
  // reclaims what was allocated inside it — the host's strings are allocated before `_frame` opens
  // one, so they sit below the mark and are never given back. Three small strings per click
  // exhausted the region in two frames. Measured, not feared.
  //
  // So each argument gets a buffer that is reused, grown only when a longer string arrives. A
  // Burxt String is length-prefixed, so rewriting one is writing a new length and new bytes.
  let alloc = null;
  const slots = new Map();
  const write = (slot, text) => {
    const bytes = new TextEncoder().encode(text);
    const need = 8 + bytes.length + 1;
    let held = slots.get(slot);
    if (!held || held.size < need) {
      // Grown with room to spare, so a state that creeps upward does not allocate every frame.
      const size = Math.max(need * 2, 4096);
      held = { base: Number(alloc(BigInt(size))), size };
      slots.set(slot, held);
    }
    dv().setBigUint64(held.base, BigInt(bytes.length), true);
    u8().set(bytes, held.base + 8);
    u8()[held.base + 8 + bytes.length] = 0;
    return held.base + 8;
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
  // Commands are collected during a frame and performed after it. The module is inside its region
  // when it asks, and a synchronous reply would re-enter a module mid-render.
  const pending = [];

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
    // A command, performed after the frame — never during. The module is mid-region when it says
    // this, and a reply that arrived synchronously would re-enter it.
    host_command: (p) => { pending.push(read(p)); return 0; },
    // A subscription the component wants for this state. Collected, then diffed against what is
    // already running once the frame is over.
    host_watch: (p) => {
      const spec = read(p).split("\t");
      asked.set(Number(spec[1] || 0), [spec[0], ...spec.slice(2)]);
      return 0;
    },
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

  // A URL, an ArrayBuffer, or the bytes themselves.
  //
  // **The typed-array case is not convenience.** `readFileSync(path).buffer` looks like the right
  // way to hand a file to WebAssembly and is wrong: Node serves small files out of a shared pool, so
  // that ArrayBuffer starts at some other file's bytes and the module is rejected for a bad magic
  // word. Accepting the view — which knows its own offset and length — is what makes the obvious
  // call site correct.
  const bytes = wasm instanceof ArrayBuffer ? wasm
    : ArrayBuffer.isView(wasm) ? wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength)
    : await (await fetch(wasm)).arrayBuffer();
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
    // **Reconciled, not replaced.** `root.innerHTML = html` rebuilds every node, so an input loses
    // its focus and caret on the first keystroke — which makes a form unusable, and makes `on:input`
    // pointless even once it is delivered. Patching keeps node identity, and therefore keeps the
    // cursor where the person put it.
    if (reconcile) reconcile(root, html);
    else root.innerHTML = html;
  };

  // ---- what an event's VALUE is ----------------------------------------------------------------
  //
  // A handler is an index and a message; the event's payload arrives as one text channel, the way
  // the row key does, because the DOM boundary is text. What "the value" means depends on the
  // event, and the mapping is here rather than in the component so a document never has to know
  // about `event.target`.
  const valueOf = (kind, ev, el) => {
    switch (kind) {
      case "input": case "change":
        return el.type === "checkbox" ? String(!!el.checked) : String(el.value ?? "");
      case "focus": case "blur": case "focusin": case "focusout":
        return String(el.value ?? "");
      case "keydown": case "keyup":
        return String(ev.key ?? "");
      case "pointerdown": case "pointerup": case "pointermove":
      case "mousedown": case "mouseup": case "mouseover": case "mouseout":
      case "mouseenter": case "mouseleave": case "click": case "dblclick": case "contextmenu":
        return ev.clientX === undefined ? "" : `${Math.round(ev.clientX)},${Math.round(ev.clientY)}`;
      case "wheel":
        return String(Math.round(ev.deltaY ?? 0));
      case "scroll":
        return String(Math.round(el.scrollTop ?? 0));
      case "animationend": case "animationstart": case "animationiteration":
        return String(ev.animationName ?? "");
      case "transitionend": case "transitionstart":
        return String(ev.propertyName ?? "");
      default:
        return "";
    }
  };

  // **Every event star accepts, and no others.** `star_event_is_wired` refuses an `on:` this driver
  // does not deliver, so a handler that never runs is impossible — and the suite generates every
  // name in this list to keep the two from drifting apart.
  const WIRED = [
    "click", "dblclick", "contextmenu",
    "pointerdown", "pointerup", "pointermove", "pointerenter", "pointerleave",
    "mousedown", "mouseup", "mouseenter", "mouseleave", "mouseover", "mouseout",
    "keydown", "keyup",
    "input", "change", "submit", "reset", "focus", "blur", "focusin", "focusout",
    "dragstart", "dragover", "dragleave", "drop", "dragend",
    "touchstart", "touchmove", "touchend",
    "wheel", "scroll",
    "animationend", "animationstart", "animationiteration",
    "transitionend", "transitionstart",
  ];

  // Events that do not bubble, so a delegated listener on the root never sees them. `capture` does
  // see them, which is why these are registered that way rather than left quietly broken.
  const CAPTURED = new Set([
    "focus", "blur", "mouseenter", "mouseleave", "pointerenter", "pointerleave", "scroll",
  ]);

  // The default a browser would take, which is wrong once the page is an app: a form would reload
  // it, a dropped file would be opened, a context menu would appear over your own.
  const PREVENT = new Set(["submit", "reset", "drop", "dragover", "contextmenu"]);

  // ---- commands: what the component asked the driver to go and do ------------------------------
  //
  // A command arrives as one tab-separated line, encoded by the component in Burxt — so the encoding
  // lives with the types it encodes rather than in this file, where it could disagree with them.
  //
  // Whatever comes back goes to `_arrived` with **the tag the author chose**. This driver never
  // invents a number: a reply cannot become a message any other way, and handler indices are
  // assigned by the generator and move when somebody adds a button.
  const arrived = instance.exports[`bx.${component}_arrived`];
  const watch = instance.exports[`bx.${component}_watch`];
  const inFlight = new Map();

  const deliver = (tag, text) => {
    if (!arrived) return;
    arrived(BigInt(tag), write("reply", String(text)), write("state", state));
    paint();
    while (pending.length) perform(pending.shift());
  };

  const perform = (line) => {
    const [kind, tagText, ...rest] = line.split("\t");
    const tag = Number(tagText || 0);
    switch (kind) {
      case "fetch": {
        const ctrl = new AbortController();
        inFlight.set(tag, ctrl);
        fetch(rest[0], { signal: ctrl.signal })
          .then((r) => r.text())
          .then((body) => { inFlight.delete(tag); deliver(tag, body); })
          // A failed fetch is still an ANSWER, delivered with an empty body. Swallowing it would
          // leave a component in `loading` with nothing ever arriving, which is the worst state a
          // page can be stuck in.
          .catch(() => { inFlight.delete(tag); deliver(tag, ""); });
        break;
      }
      case "send": {
        const ctrl = new AbortController();
        inFlight.set(tag, ctrl);
        fetch(rest[0], { method: "POST", body: rest[1] ?? "", signal: ctrl.signal })
          .then((r) => r.text())
          .then((body) => { inFlight.delete(tag); deliver(tag, body); })
          .catch(() => { inFlight.delete(tag); deliver(tag, ""); });
        break;
      }
      case "focus": {
        const el = root.querySelector ? root.querySelector(rest[0]) : null;
        if (el && el.focus) el.focus();
        break;
      }
      case "store":
        try { localStorage.setItem(rest[0], rest[1] ?? ""); } catch {}
        break;
      case "load": {
        let held = "";
        try { held = localStorage.getItem(rest[0]) ?? ""; } catch {}
        deliver(tag, held);
        break;
      }
      case "go":
        if (typeof history !== "undefined") history.pushState(null, "", rest[0]);
        break;
      case "cancel": {
        const ctrl = inFlight.get(tag);
        if (ctrl) { ctrl.abort(); inFlight.delete(tag); }
        stop(tag);
        break;
      }
    }
  };

  // ---- subscriptions: what to keep listening to, diffed between frames -------------------------
  //
  // **The set is a function of the state**, exactly as the view is. So the driver compares what the
  // component asks for now with what it asked for last time, and adds or removes the difference.
  // There is no `onMounted`, no cleanup function to forget, and stopping something is a state change
  // rather than a call.
  const live = new Map();
  let asked = new Map();

  const stop = (tag) => {
    const held = live.get(tag);
    if (!held) return;
    if (held.kind === "every") clearInterval(held.handle);
    if (held.kind === "key") removeEventListener("keydown", held.handle);
    if (held.kind === "socket") held.handle.close();
    live.delete(tag);
  };

  const start = (tag, spec) => {
    const [kind, ...rest] = spec;
    if (kind === "every") {
      live.set(tag, { kind, spec, handle: setInterval(() => deliver(tag, ""), Number(rest[0])) });
    } else if (kind === "key") {
      const want = rest[0];
      const handle = (ev) => { if (ev.key === want) deliver(tag, ev.key); };
      addEventListener("keydown", handle);
      live.set(tag, { kind, spec, handle });
    } else if (kind === "socket") {
      const sock = new WebSocket(rest[0]);
      sock.addEventListener("message", (ev) => deliver(tag, String(ev.data)));
      live.set(tag, { kind, spec, handle: sock });
    }
  };

  const settleWatches = () => {
    // Anything no longer asked for, stopped. Anything asked for differently, restarted — comparing
    // the whole spec rather than only the tag, so changing an interval's period actually changes it.
    for (const [tag, held] of [...live]) {
      const want = asked.get(tag);
      if (!want || want.join("\t") !== held.spec.join("\t")) stop(tag);
    }
    for (const [tag, spec] of asked) if (!live.has(tag)) start(tag, spec);
  };

  first(write("state", state));
  paint();
  if (watch) { asked = new Map(); watch(write("state", state)); settleWatches(); }

  // ONE delegated listener per event kind. The page carries `data-star-h` indices and nothing
  // executable, so there is no inline handler anywhere and nothing bound to a node the reconciler
  // will replace.
  for (const kind of WIRED) {
    root.addEventListener(kind, (ev) => {
      const el = ev.target.closest ? ev.target.closest("[data-star-h]") : null;
      if (!el) return;
      if (PREVENT.has(kind)) ev.preventDefault();

      // The handler index is per EVENT as well as per element: `on:click` and `on:input` on the same
      // element are two handlers, and the attribute names which.
      const attr = el.getAttribute("data-star-h");
      if (attr === null) return;
      const handler = BigInt(attr);

      // WHICH ROW, read from the DOM rather than remembered: rows move, and the key moves with them.
      const keyed = el.closest("[data-star-key]");
      const key = keyed ? keyed.getAttribute("data-star-key") : "";

      asked = new Map();
      frame(handler, write("key", key), write("value", valueOf(kind, ev, el)),
            write("state", state));
      paint();
      settleWatches();
      while (pending.length) perform(pending.shift());
    }, CAPTURED.has(kind));
  }

  return {
    get state() { return state; },
    get html() { return html; },
    get mounts() { return mounts; },
  };
}
