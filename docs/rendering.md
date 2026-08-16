---
layout: default
title: How it reaches the page
description: "WebAssembly, one host import, a per-frame region, and a reconciler — the whole runtime."
---

{% raw %}

# How it reaches the page

A component compiles to WebAssembly. The browser runs it. A driver of about a hundred lines hands
bytes to the DOM and forwards clicks, and does nothing else.

## Why there is JavaScript at all

A browser executes exactly two things: JavaScript and WebAssembly. **The DOM is reachable only from
JavaScript** — there is no shipped mechanism for a wasm module to call `document.querySelector`
itself. Every wasm framework ships glue for this reason.

What is a choice is how much. The driver fetches the module, writes a string into a node, and
forwards an event. **It holds no state it decides anything with, formats nothing, and escapes
nothing** — because everything the language guarantees happens before the boundary.

That rule is not decoration. The first version of a host shim for Burxt did one small piece of real
work — walking a `printf` format string — and got the zero-pad wrong, turning **$1299.05 into
1299.5**. No crash, no warning, money wrong by a factor of ten, and it survived three other tests
because none of them formatted a fraction with a leading zero. Every line of logic that moves into
the driver leaves the reach of everything Burxt checks.

## The host surface

A pure component asks the host for seven symbols:

```
exit  fprintf  fwrite  getrlimit  malloc  memcpy  stderr
```

Of those, **two do real work** — `malloc` and `memcpy`. `getrlimit` tells one truth. `exit`,
`fprintf` and `fwrite` are the panic path; stubs returning zero are enough and they never fire.
`stderr` is a data symbol, not a function.

star-burxt adds exactly one more: **`host_mount`**, which writes the rendered bytes into the root
node.

## One region per frame

Burxt's allocator is a bump pointer that reclaims on region close. A long-lived page re-renders
indefinitely, so the frame is the region:

```
function counter_render(count: Int) -> Int {
    region frame {
        let html: String = html_render(counter(count));
        let sent: Int = host_mount(html);
        return len(html);
    }
}
```

Measured in a 16 MB linear memory: **1,000,000 frames with memory flat**, where rendering without
the per-frame region died at 50,000.

**`host_mount` is called inside the region, and that is required rather than tidy.** The compiler
refuses to let a String built in a region outlive the block:

```
error: cannot return this String: it was built inside a `region` block, which
releases at its closing brace, so its storage would not outlive the call.
```

So the host must take the bytes before the close. The memory architecture is not a design decision
anyone made — the compiler permitted exactly one shape.

## Reconciling, not replacing

The driver patches the existing DOM against the new HTML rather than assigning `innerHTML`.

**The defect this fixes was measured before it was fixed.** With `innerHTML` per frame, one
keystroke into a text input gave `activeElement: BODY`, a different node, and a cleared field. The
state was correct throughout — a text input was simply unusable.

It is also **5.8× faster**: 0.220 → 0.038 ms per frame, because `innerHTML` reparses a whole
subtree while a reconciler touches the one text node that changed. The correctness fix was the
performance fix.

There are [no keys yet](not-done.html), so children are matched by position. Reordering a list
rewrites every node from the first change onward.

## Native and wasm agree

The same component rendered by the native compiler and by the WebAssembly build produces
**byte-identical output**, and `examples/wasm/build.sh` diffs them on every run rather than
printing them for a human to compare.

That is what makes **hydration mismatch structurally impossible**: server and client are not two
implementations that must be kept in agreement, they are the same compiled code.

It is also the only instrument that caught the `1299.05` bug. A diff of two renders is worth more
than either render.

{% endraw %}
