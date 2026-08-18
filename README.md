# star-burxt

**Build a front end by writing a document.** A `.sbmx` file becomes a component that renders,
responds to clicks, holds state, fetches, and routes.

**Documentation: [star.burxt-lang.org](https://star.burxt-lang.org)** — start there. It is a
seven-chapter tour, not a specification.

```
:props: count: Int
:!props:

# Counter

The count is {{ to_string(count) }}.

:button: on:click=count + 1
increment
:!button:
```

That is a whole component. It renders, the button works, and if you misspell `count` you are told
before the page exists — including inside the button, which is the part no other framework checks.

For anything past a counter, a `===bx` section holds your own Burxt — a `Model`, a `Msg`, and one
`update` — and `on:click=Msg.Increment` names a message instead of an expression.

## Using it

One line in your project's `burxt.package`:

```
dependency  star  https://github.com/andrecorugda/star-burxt  v0.2.0
dependency  bmx   https://github.com/andrecorugda/bmx         burxt-0.12.1
```

`burxt fetch` writes the exact commit into `burxt.lock`, so a checkout is reproducible.

Then `burxt fetch`. Full instructions: [star.burxt-lang.org/install](https://star.burxt-lang.org/install.html).

## What is in here

| | |
|---|---|
| `star.bx` | the framework — one file |
| `resolve.bx` | which components a document imports, resolved once for every tool |
| `examples/generate.bx` | a `.sbmx` document → a component. Built as `star-generate` |
| `examples/check.bx` | all three layers of problem, in one command. Built as `star-check` |
| `examples/build.bx` | document → component → wasm, one command. Built as `star-build` |
| `examples/app.js`, `reconcile.js`, `index.html` | the browser driver, and a page to copy |
| `examples/*.sbmx` | components — `Hero`, `Todos`, `Feed`, `Served`, `App` and the rest |
| `editors/` | the VS Code extension and the language server |
| `tools/liquid.bx` | the site's guard, a Burxt program |
| `tools/surface.bx` | builds a real dependent package and holds the README's promise to it |
| `tests/consumer/` | what an outside package compiles — the whole job on the published names |
| `tools/showcase.py`, `shoot.mjs` | the landing page's screenshot and its source panel |
| `test.py` | the guarantees |
| `verify-docs.py` | every example on the site — generated **and compiled** |
| `docs/` | the site |

## The supported surface is six names

```
star_generate     a document → a component, or a refusal naming what is wrong
star_resolve      which components a document imports, before generating it
star_source_of    the component as Burxt source, ready to compile
StarKnown         a component this one may use — `star_generate`'s third argument
StarComponent     what `star_generate` returns
StarHandler       one `on:` handler, inside `StarComponent.handlers`
```

**The old claim here was three names, and it was not merely understated — it was unusable.**
`star_generate(source, name, known: [StarKnown])` cannot be called without `StarKnown`, and nothing
reaches a document's imports without `star_resolve`. Somebody following that list would have got as
far as writing the call and no further.

**The compiler enforces this, and it is the package rather than the file that draws the line.** A
declaration without `public` is unreachable from a package that depends on this one, and eight
helpers here were `public` for no reason at all — `resolve.bx` is in the same package and never
needed them. Reaching one now is a named refusal that ends *"the fix belongs in `star`, by writing
`public` in front of its declaration"*, which is the failure mode worth having: loud, and a one-line
fix that is a deliberate decision by whoever maintains the surface.

`tools/surface.bx` builds a real dependent package and holds this to both directions — every name
listed is reachable, every reachable name is listed, and the six alone are enough to do the whole
job.

## Testing

```sh
./tools/check-all.sh     # everything, and it EXITS NON-ZERO when something fails

python3 test.py          # the guarantees. The ACCEPTING case runs first and its failure is fatal.
python3 verify-docs.py   # every .sbmx example on the site — generated AND compiled
node tools/paints.mjs    # the site colours burxt, bmx, sbmx and css

burxt build tools/liquid.bx -o star-liquid && ./star-liquid   # the site: raw blocks, front matter, CNAME
burxt build tools/surface.bx -o star-surface && ./star-surface # the surface, from a real dependent package
```

`tools/check-all.sh` exists because **a pipeline's exit status is the last command's**: running
`python3 test.py | tail -1` reports whether `tail` succeeded, so `set -e` never sees a failing suite.
Three failures sat visible-but-unread that way. A verification script that cannot fail is the same
defect this project keeps finding elsewhere, in the thing doing the finding.

`test.py` is mostly refusals, and a suite of nothing but refusals is satisfied by a generator that
refuses everything — so the accepting case runs first and nothing below it means anything if it
fails.

`verify-docs.py` exists because the docs are a tutorial. It found chapter 1 teaching a document the
generator refuses, on the day it was written.

`tools/liquid.bx` exists because there is no Ruby here, so Jekyll only runs after a push and the
first symptom of a bad page is a site that silently stops updating. A literal `{{` outside a
`{% raw %}` block takes the whole build down, and these pages are full of `{{`.

**It is a Burxt program, and it was Python.** A project arguing that a language can be strict enough
to catch what a reviewer would miss should not do its own checking in one that cannot — and the
rewrite paid for itself immediately: `file_walk` answers an `Option`, so a missing `docs/` and a
`docs/` with no pages in it stopped being the same answer. The Python reported *0 pages, all wrapped*
for both. `star-build` moved the same way, from a shell script that word-split `$exports` on purpose
and left a path unquoted by accident.

`test.py` and `verify-docs.py` are still Python and should not stay that way.

`docs/assets/site.css` and `site.js` are byte copies of burxt-lang.org's — re-copy rather than edit.
`docs/assets/star.css` is this site's own.

## Licence

MIT or Apache-2.0, matching Burxt.
