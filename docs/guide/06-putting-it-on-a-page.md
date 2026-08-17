---
layout: default
title: Putting it on a page
section: guide
description: "From a document to something a browser opens."
---

{% raw %}

# 6. Putting it on a page

You have a component. Now put it on a screen somebody can click.

## Two commands

```sh
./star-generate counter.bmx counter > counter.bx

burxt build counter.bx --target wasm32-unknown-unknown -o counter.o
```

The first turns your document into a component. The second turns the component into something a
browser can run.

## The link line

One more command joins it up. It is long, you will copy it once, and then never look at it again —
put it in a script:

```sh
~/.rustup/toolchains/*/lib/rustlib/*/bin/rust-lld -flavor wasm \
  --no-entry --allow-undefined \
  --export=main --export='bx.counter_render' --export='bx.counter_dispatch' \
  -z stack-size=1048576 --initial-memory=4194304 --max-memory=268435456 \
  counter.o -o counter.wasm
```

Change `counter` to your component's name in the two `--export` lines. That is the only part that
varies.

> **You do not need to install anything for this.** The linker ships with Rust, which you already
> have from installing Burxt.

## The page

Copy `examples/index.html` and `examples/reconcile.js` from the star-burxt repository into the same
folder, serve it, and open it:

```sh
python3 -m http.server 8000
```

Those two files are the page and the part that updates it. **They hold nothing about your app** —
copy them once per project and leave them alone.

## What you get

- **about 8 KB**, everything included. For comparison, React with ReactDOM is around 45 KB before
  you have written a line.
- **no build step to configure.** Two commands and a link line.
- **nothing executable in your markup.** A button reaches the page as a number, and one listener
  handles all of them, so there is no inline script anywhere on the page.
- **the same output on the server and in the browser**, exactly, because both run the same compiled
  component. A page rendered ahead of time and the same page after it wakes up cannot disagree.

## Where to go now

- **[How do I…?](../how-do-i.html)** — short answers to the next ten things you will want
- **[When it says no](../refusals.html)** — every refusal, with what to write instead
- **[What's not built yet](../not-done.html)** — read this before choosing star-burxt for real work

## You have finished the tour

You can now build a screen out of documents: values, elements, buttons, typing, lists, conditions,
and money that stays exact.

The rest is practice.

{% endraw %}
