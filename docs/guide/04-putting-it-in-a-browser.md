---
layout: default
title: Putting it in a browser
section: guide
description: "Compile to WebAssembly, link it, and open the page."
---

{% raw %}

# 4. Putting it in a browser

```
burxt build counter.bx --target wasm32-unknown-unknown -o counter.o

~/.rustup/toolchains/*/lib/rustlib/*/bin/rust-lld -flavor wasm \
  --no-entry --allow-undefined \
  --export='bx.counter_render' --export='bx.counter_dispatch' \
  -z stack-size=1048576 --initial-memory=4194304 --max-memory=268435456 \
  counter.o -o counter.wasm
```

Copy `examples/index.html` and `examples/reconcile.js` beside it, serve the directory over
HTTP — a `file://` page cannot instantiate WebAssembly — and open it.

Clicking works.

## What is running

Your component, compiled. Not interpreted, not transpiled to JavaScript — the browser's own
WebAssembly engine is executing the same machine-level code the native build runs.

The JavaScript is a driver. It fetches the module, writes a string into a node, and forwards a
click. **Everything else happened inside the module**: parsing your document happened at build
time, and escaping, formatting, control flow and your handler all happen in wasm.

## Look at the page source

```html
<div class="star">
  <h1>Counter</h1>
  <p>The count is 0.</p>
  <button data-star-h="0">increment</button>
</div>
```

No `onclick`. No `<script>` inside your component. A handler is an **index**, and one delegated
listener at the root turns it back into a call.

Put `<script>alert(1)</script>` into a prop and look again: `&lt;script&gt;`. The escaping happened
in Burxt before any byte left the module, and the driver has no way to undo it because it never had
the unescaped version.

## Type into a text input

```
::: props name: String
:::

# Hello {{ name }}

::: input on:input=name
:::
```

The heading updates as you type, and the caret stays where you left it. That second part is not
free: rendering by assigning `innerHTML` destroys and rebuilds every node, which loses focus,
selection and scroll position. The driver reconciles instead — and reconciling turned out to be
**5.8× faster** as well, because it touches one text node rather than reparsing a subtree.

## What you have

A page whose interactive parts are compiled, whose handlers the compiler has checked, and which
ships about 7.7 KB in total.

Read [what is not done](../not-done.html) before you build anything real on it. The list is honest
and it is not short.

{% endraw %}
