---
layout: default
title: Getting star-burxt
description: "star-burxt is a Burxt package. Install Burxt, declare one dependency, fetch."
---

{% raw %}

# Getting star-burxt

star-burxt needs Burxt the way Laravel needs PHP: it is **a package written in the language**, not a
runtime of its own. There is nothing to install globally, no CLI to put on your `PATH`, and no
`node_modules`. You install Burxt once, then name star-burxt in the manifest of each project that
uses it.

## Requirements

| | |
|---|---|
| **Burxt 1.2 or later** | earlier releases cannot express a `pure` view — see below |
| **git** | `burxt fetch` clones the dependency at its tag |
| a wasm linker | only to reach a browser; you already have one, see below |
| node, or any browser | to run what you build |

**Why 1.2 and not 1.1.** Burxt 1.1.0 shipped a `lib/html.bx` whose element
builders are not declared `pure`. Purity is transitive, so on that release a
`pure function view -> Html` cannot be written at all — and star-burxt's whole guarantee is that a
view is `pure`, so `burxt effects --allow ""` confirms it reaches nothing.

The failure is worth showing, because it does not look like a version problem:

```
error: `pure function view` may not call `html_element`, which is not declared `pure`:
the guarantee cannot rest on a function that does not make it.
Declare `pure function html_element` too, or drop `pure` from `view`.
```

That error points at **your** file, names a rule you did not break, and its suggested fix — *drop
`pure` from `view`* — would have you delete the property deliberately. If you see it, the answer is
a newer Burxt, not a smaller guarantee.

## 1. Install Burxt

One line on any of four platforms, and the page that owns it is
[burxt-lang.org/install](https://burxt-lang.org/install.html). Then:

```sh
burxt --version
```

**Read this before you go further: the newest release is 1.1.0, and star-burxt needs 1.2.** Until
1.2 ships there is no tarball that satisfies the requirement above, so today the only way to run
star-burxt is to build the compiler from `develop`:

```sh
git clone https://github.com/andrecorugda/burxt && cd burxt
sh scripts/release.sh               # builds, then writes dist/burxt-<version>-<host>.tar.gz
sudo sh scripts/install.sh          # installs from dist/; PREFIX=~/.local works too
```

That needs Rust and LLVM 18, which the release tarball exists precisely to spare you.

That is stated here rather than left for you to discover, because the failure otherwise arrives as
a `pure` error inside a file you did not write — the one shown just above. **Nothing on this site
requires a version that does not exist except this one line, and it will stop being true on the day
1.2 is published.**

## 2. Declare star-burxt in your manifest

A Burxt project is a directory with a `burxt.package` in it. One line adds star-burxt:

```
name        my-app
version     0.1.0
dependency  star  https://github.com/andrecorugda/star-burxt  v0.1.0
```

```sh
burxt fetch
```

`fetch` clones the tag and writes `burxt.lock`, which pins the **commit** the tag pointed at:

```
package  star  https://github.com/andrecorugda/star-burxt  v0.1.0  29b88e0c2816…
```

**Commit that file.** A tag can be moved; a commit cannot, so the lockfile is what makes two
machines build the same star-burxt. There are no version ranges to resolve, by design — you name
one tag and get one commit, so a fetch is a lookup rather than a solver.

Then, in your program:

```burxt
use "star/star.bx";
```

The first segment is the **dependency's name**, not a directory beside your file. Call it what you
like — `dependency star-burxt …` gives you `use "star-burxt/star.bx"`.

### Working against a checkout instead

While you are changing star-burxt itself, point at the directory:

```
dependency  star  ../star-burxt
```

No fetch, no lockfile entry, and your edits are live. This is also how the repository's own
`examples/` reach it.

## What the package supports

**Three names**, and the compiler enforces it:

| | |
|---|---|
| `star_generate(source, name)` | a document → `Result<StarComponent, String>` |
| `StarComponent` | `view`, `dispatch`, `handlers`, `props`, `argument_list` |
| `StarHandler` | `event`, `expression` |

Everything else in `star.bx` is how it is done today. Reach for one and you are told so by name:

```
error: `star_emit_stmts` is declared in the package `star` but not `public`, so this
package cannot reach it. A package exposes what it means to support — if
`star_emit_stmts` is meant to be part of that, the fix belongs in `star`, by writing
`public` in front of its declaration.
```

That is not a lint you can turn off; it is the package boundary. It exists so that the day one of
those internal functions changes is not the day somebody else's build breaks.

## 3. The generator

A `.bmx` document becomes Burxt source. The generator is an **example program** rather than a
subcommand, because it is ordinary Burxt and reads better as something you can open:

```sh
git clone https://github.com/andrecorugda/star-burxt
burxt build star-burxt/examples/generate.bx -o star-generate

./star-generate counter.bmx counter > counter.bx
burxt check counter.bx
```

`counter.bx` is ordinary Burxt. Read it — it is meant to be read, and the point of the whole design
is that nothing in it is magic.

Or call `star_generate` from your own program and skip the file, which is what a build step would
do.

## A trap on the first program, and it is not star-burxt's

**A Burxt program is its top-level statements.** There is no `main`, and the name is reserved:

```burxt
use "star/star.bx";

match star_generate(read_file("counter.bmx"), "counter") {
    Error(message) => { print_error(message); exit(1); }
    Ok(component)  => { print(component.view); }
}
```

Writing `function main()` out of habit is refused — correctly, and with a clear message *if that is
the only thing wrong*. In a program that also has a `use`, a different check reports first and you
get an error pointing into the standard library at a function you never called. If you ever see
that, delete your `main` and un-indent its body.

## 4. Building for a browser

`--target wasm32-unknown-unknown` emits an object; linking it needs a wasm linker, and you already
have one:

```sh
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

`examples/index.html` is the driver, and it is about a hundred lines. Copy it; it holds no
application logic and you should not need to change it.

## Build through stage-0

Burxt has two compilers. Build wasm through **stage-0**, the Rust one — the default. Stage-1 emits
its whole runtime preamble unconditionally, so an object built through it carries `__multi3`,
`__divti3` and `snprintf` from rounding helpers your program never calls. Nothing is broken; the
import list simply looks far worse than it is, and you would go looking for a problem that is not
there.

{% endraw %}
