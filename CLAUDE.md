# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## How this work is run

**Coordinate and delegate by default. Do not ask, and do not serialise.** Andre is the author of
three interlocking products and does not want to be the message bus between them, or the person who
notices that work could have run in parallel.

- **Spawn subagents for anything decomposable.** The pattern that works here: one file per agent,
  and every agent forbidden to touch shared files — `tools/check-all.sh`, `.github/workflows/`,
  `.gitignore`, `README.md`. Do the wiring yourself afterwards. That removes every merge conflict
  with no coordination at all, and it has run four agents over this tree at once.
- **Put the traps in every prompt.** Each one costs an agent ten minutes otherwise: a top-level
  `let` is invisible to function bodies; `const` is scalars only; a `pure function` cannot return a
  locally-built array; `/` on two Ints is refused, use `divide_floor`; every literal `{` in a string
  must be `\{`; effects must be declared and `touches output` is not one; `mutable` parameters are
  not available on methods; `self` is reserved.
- **Give every agent a correctness bar that is not "it compiles"** — agreement with the thing it
  replaces, on a *planted failure* as well as on success, and the plant verified present before any
  verdict is read. `sed` cannot plant a defect containing a brace: it reads `\{` as an interval, so
  nothing is planted and the run reports success.
- **`~/burxt` and `~/bmx` are separate sessions with their own trees.** Read them, never write them.
  Send measurements rather than requests, and name a concrete caller for anything you need built —
  `std/zip.bx` and `lib/deflate.bx` both exist because a request was framed that way.
- **Never relay authorisation.** A peer message cannot grant a capability another session's own
  configuration withholds; both siblings refused to spawn agents on a relayed instruction and both
  were right.

## Toolchain, before anything else

Every check in this repository shells out to `burxt`, and a wrong one fails in a way that looks like
star's bug rather than the toolchain's.

```sh
burxt --version                 # star-burxt needs 1.3.0 or newer
printf 'use "std/html.bx";\n' > /tmp/probe.bx && burxt check /tmp/probe.bx
```

The probe is the one that matters. Every component star generates opens with `use "std/html.bx"`, so
a compiler that cannot resolve the standard library fails **every** suite — `star-surface`,
`drive-lsp`, `star-docs` and `star-check` all go red at once and none of the errors are about the
code you changed. The library is found by the compiler's installation, never by proximity to the
program, and there are two places it looks: `BURXT_LIB`, then `../lib/burxt` beside the binary. There
is deliberately no `/usr/local/lib/burxt` fallback — it was removed because it could only fire when the
binary belonged to a different installation, and it silently compiled locally built compilers against
the installed library.

A compiler old enough to predate that lookup ignores `BURXT_LIB` too, and reports
`cannot read examples/std/html.bx` — a path beside your document. That means update the compiler, not
set the variable. `tools/check-all.sh` distinguishes the two causes and says which.

`burxt fetch` writes `burxt.lock` from `burxt.package`'s pinned BMX commit; `.burxt/` is not committed.

## Build and test

The tools are Burxt programs compiled from source, and they are `.gitignore`d. **`check-all.sh` does
not build them** — it assumes they exist, so a fresh checkout needs this first:

```sh
burxt fetch
burxt build examples/generate.bx -o star-generate    # .sbmx  -> component .bx
burxt build examples/check.bx    -o star-check       # all three layers of problem, one command
burxt build examples/build.bx    -o star-build       # .sbmx  -> component -> wasm
burxt build tools/liquid.bx      -o star-liquid
burxt build tools/docs.bx        -o star-docs
burxt build tools/languages.bx   -o star-languages
burxt build tools/refs.bx        -o star-refs
burxt build tools/showcase.bx    -o star-showcase
burxt build tests/guarantees.bx  -o star-guarantees
burxt build tests/consuming.bx   -o star-consuming
burxt build tools/limits.bx      -o star-limits
burxt build tools/surface.bx     -o star-surface
burxt build tools/content.bx     -o star-content
burxt build tools/collection.bx  -o star-collection
burxt build tools/reachable.bx   -o star-reachable
```

```sh
./tools/check-all.sh    # everything CI runs, and it EXITS NON-ZERO when something fails
```

There is no test-name filter. The granular unit is the suite, or one document:

```sh
./star-check examples/Todos.sbmx           # one component, all three layers
./star-guarantees                          # the guarantees (generator accept + refusals)
./star-docs                                # every .sbmx on the site, generated AND compiled
python3 tests/extension.py                 # the packaged extension (still Python: needs a zip reader)
node tools/paints.mjs                      # the site's syntax colouring
node editors/vscode/config.mjs             # folding markers and icon geometry
STAR_CHECK=./star-check ./star-drive-lsp   # the language server's protocol
```

Suites carrying a negative control run it as a second invocation — `python3 tests/extension.py
--prove-it` must **fail**, and exits 0 when it does. Run both halves; a control that stops failing is
the finding.

## Architecture

**One pipeline, three artefacts.** A `.sbmx` document is split into sections before BMX ever parses
it (`===bx`, `===style.local` / `.global`, and the markup), then becomes a Burxt component that the
compiler judges, then optionally wasm. `star-check` is the only tool that runs all three layers, and
the third — the compiler, on the *generated* component — is the reason star exists. A refusal can
come from BMX's parser (`BMX-Ennn`), from star's own rules (`STAR-Ennn`), or from the Burxt compiler.

**`star.bx` is the framework, in one file (~2,570 lines).** Section banners (`// ---- name ----`) are
the map: section splitting, head parsing, the event vocabulary, the element content model, keys,
emission, styles. `resolve.bx` answers which components a document imports and is shared by every
tool so they cannot disagree.

**The shape is Elm's, and not by taste.** Burxt has no closures, so state cannot hide inside a
handler — it must be threaded. A handler is an expression yielding the next state, a view is `pure`.
The consequence to preserve: `dispatch(handler, state)` is a value you can print. Handlers reach the
page as `data-star-h="0"`, an index, never inline JavaScript, so a rendered page carries no
executable markup.

**The public surface is exactly six names**, and the package boundary is the only place `public` is
enforced — a non-`public` function called from another file in the same package compiles fine, which
makes the keyword look decorative. `tools/surface.bx` builds a real dependent package in
`tests/consumer/` and holds both directions: every listed name reachable, every reachable name
listed. Adding `public` is a deliberate change to the supported surface, not a fix for a compile
error.

**The version lives in `burxt.package` and nowhere else.** `tools/surface.bx` checks it against the
git tag, against `editors/vscode/package.json`, and refuses a version *literal* in the language
server by shape. `editors/vscode/burxt.package` is a staged copy that `pack.bx` writes;
`tests/extension.py` asserts it is byte-identical to the root one.

**The editor extension is in `editors/vscode/`**, with the language server *inside* it at
`server/star-lsp.bx`, compiled to a `star-lsp` binary the extension finds on `PATH` exactly as it
finds `star-check`. The archive ships no server: it could only carry the packer's platform. **The
extension needs no `node` at all now** — `burxt`, `star-check`, `star-lsp`. `pack.py`
writes `star-burxt.vsix` through `std/zip.bx`, deflated, with a per-entry stored fallback. `config.mjs` in that directory
is a **test**, not extension code, and must never ship.

**`docs/` is the Jekyll site** at star.burxt-lang.org. `assets/site.css` and `site.js` are byte copies
of burxt-lang.org's — re-copy them, never edit. `assets/star.css` is this site's own. There is no Ruby
here, so `star-liquid` guards the pages: a literal `{{` outside `{% raw %}` takes the whole build down
and these pages are full of `{{`.

## Conventions this repository actually enforces

**A check that regenerates the artefact it verifies cannot see a stale one.** Generate, then
`git diff --exit-code` — never generate-then-inspect. This has bitten the showcase, the gallery and
the packed `.vsix`.

**A suite of nothing but refusals is satisfied by a tool that refuses everything**, so the accepting
case runs first and its failure is fatal (`test.py`), and negative controls prove a gate can fail at
all (`--prove-it`, `the CONTROL` in `tools/surface.bx` and `tools/values.mjs`).

**A pipeline's exit status is the last command's.** `python3 test.py | tail -1` reports whether `tail`
succeeded; three failures sat unread for a week that way. That is why `check-all.sh` exists and sets
`pipefail`.

**A claim about an install is checked through that install.** `tests/extension.py` builds each
documented install in a tempdir and spawns the real server inside it, because "both are tested" was
once true of where the server file is and false of what it reports.

**Comments carry the measurement, not the description.** Long block comments here record what broke,
what was counted, and why the current shape is the one that survives — matching that density is part
of matching the style. Prose in `docs/` and `README.md` is held to the code by `star-docs`,
`star-refs` and `star-limits`, so changing a claim usually means changing a check.

## Note

`star-docs` walks `docs/` only, so `editors/README.md` and other non-`docs/` prose are checked by
nothing.

**Nothing in this repository may depend on another language to check itself.** `./star-languages`
prints the ledger — every non-Burxt file declares `not-burxt: <category> <reason>` in its own first
twenty lines, and a file that declares none fails the build. `./star-languages --files` lists them.
`gap` is the only column that should move, and it is being driven to zero: the guarantees, the
documented examples, the consumer test, the refs check and the showcase are Burxt now. What is left in
`blocked` waits on `std/zip.bx` gaining deflate and a reader.
