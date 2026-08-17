# star-burxt

**A front-end framework written in [Burxt](https://github.com/andrecorugda/burxt). A `.bmx` file is
a component, and the compiler judges its handlers.**

Documentation: [star.burxt-lang.org](https://star.burxt-lang.org).

```
::: props count: Int
:::

# Counter

The count is {{ to_string(count) }}.

::: button on:click=count + 1
increment
:::
```

That becomes a `pure function counter(count: Int) -> Html` and a
`pure function counter_dispatch(handler: Int, count: Int) -> Int`, compiles to WebAssembly, and
runs in a browser. A typo in a slot is `unknown variable`. A wrong type in a handler is a type
error. Narrowing money inside a click handler is a compile error — which no framework whose
handlers are closures can see, because a closure's captured state is invisible to the signature.

## Using it

star-burxt needs Burxt the way Laravel needs PHP. One line in your `burxt.package`:

```
dependency  star  https://github.com/andrecorugda/star-burxt  v0.1.0
```

```sh
burxt fetch
```

```burxt
use "star/star.bx";
```

Full instructions, including the wasm link line and the Burxt version this needs, are on
[the install page](https://star.burxt-lang.org/install.html).

## What is in here

| | |
|---|---|
| `star.bx` | the framework — one file |
| `examples/generate.bx` | a `.bmx` document → Burxt source, on the command line |
| `examples/index.html`, `reconcile.js` | the browser driver and the DOM reconciler |
| `examples/counter.bmx`, `form.bmx` | components |
| `test.py` | the guarantees, as a runnable claim |
| `docs/` | the site at `star.burxt-lang.org` |

## The supported surface is three names

`public` is what a dependent package may reach, and this package exposes `star_generate` and the two
classes it answers with — `StarComponent` and `StarHandler`. Everything else in `star.bx` is how it
is done today, and the day one of those changes should not be the day somebody else's build breaks.

## Testing

```sh
python3 test.py        # the guarantees. The ACCEPTING case runs first and its failure is fatal.
python3 check.py       # the site: front matter, raw blocks, CNAME
```

`test.py` is a suite of refusals, and a suite of nothing but refusals is satisfied by a generator
that refuses everything — so the accepting case runs first and nothing below it means anything if it
fails.

`check.py` exists because there is no Ruby on the machines this is written on, so Jekyll only runs
after a push and **the first symptom of a bad page is a site that silently stops updating**. A
literal `{{` outside a `{% raw %}` block reads as a Liquid variable and takes the whole build down.
That has happened on `burxt-lang.org` before; star-burxt's pages show slot syntax on nearly every
one, so it is not hypothetical here.

`docs/assets/site.css` and `docs/assets/site.js` are **byte copies** of `burxt-lang.org`'s, exactly
as BMX's site does it, so the three sites are one site. Re-copy them when they change upstream
rather than editing here; `docs/assets/star.css` is where this site's own rules go.

## Why its own repository

Two reasons, and the second is the one that forced it.

**It versions on its own cadence.** Tying its number to the language's would mean either a version
bump with nothing in it or a fix waiting for a language release.

**GitHub Pages serves one site per repository.** `burxt` serves `burxt-lang.org` and `bmx` serves
`bmx.burxt-lang.org`, each from its own `docs/CNAME`. A third subdomain needs a third repository.

## Licence

MIT or Apache-2.0, matching Burxt.
