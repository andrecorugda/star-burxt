---
layout: default
title: Getting star-burxt
description: "star-burxt ships in the Burxt standard library. There is nothing separate to install."
---

{% raw %}

# Getting star-burxt

**There is nothing to install.** star-burxt is `lib/star.bx` in the Burxt standard library, so if
you have Burxt you have it. That is deliberate: it cannot run without Burxt, so a separate
distribution would buy nothing and cost a wiring step.

Get Burxt from [burxt-lang.org/install](https://burxt-lang.org/install.html), then:

```
use "lib/star.bx";
```

## The generator

A `.bmx` document becomes Burxt source. The generator is an example program rather than a
subcommand, because it is ordinary Burxt and reads better as something you can open:

```
burxt build examples/star/generate.bx -o star-generate
./star-generate counter.bmx counter > counter.bx
burxt check counter.bx
```

`counter.bx` is ordinary Burxt. Read it — it is meant to be read, and the point of the whole design
is that nothing in it is magic.

## Building for a browser

`--target wasm32-unknown-unknown` emits an object; linking it needs a wasm linker, and you already
have one:

```
burxt build counter.bx --target wasm32-unknown-unknown -o counter.o

~/.rustup/toolchains/*/lib/rustlib/*/bin/rust-lld -flavor wasm \
  --no-entry --allow-undefined \
  --export=main --export='bx.counter_render' --export='bx.counter_dispatch' \
  -z stack-size=1048576 --initial-memory=4194304 --max-memory=268435456 \
  counter.o -o counter.wasm
```

**`rust-lld -flavor wasm` IS `wasm-ld`.** `lld` is usually not installed, but the Rust toolchain
ships one, so nothing needs installing for this either.

Two flags are load-bearing and their failures are confusing:

- **`--allow-undefined`, not `--import-undefined`.** The latter turns undefined *functions* into
  imports and leaves data symbols alone, so the link fails on `stderr` with three identical errors
  naming a symbol that looks like it should already be handled.
- **`--max-memory`**, or the memory is not growable and the allocator cannot serve a region at all.

`examples/star/index.html` is the driver, and it is about a hundred lines. Copy it; it holds no
application logic and you should not need to change it.

## Build through stage-0

Burxt has two compilers. Build wasm through **stage-0**, the Rust one — the default. Stage-1 emits
its whole runtime preamble unconditionally, so an object built through it carries `__multi3`,
`__divti3` and `snprintf` from rounding helpers your program never calls. Nothing is broken; the
import list simply looks far worse than it is, and you would go looking for a problem that is not
there.

{% endraw %}
