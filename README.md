# star-burxt

**Build a front end by writing a document.** A `.bmx` file becomes a component that renders,
responds to clicks, and holds state.

**Documentation: [star.burxt-lang.org](https://star.burxt-lang.org)** — start there. It is a
six-chapter tour, not a specification.

```
::: props count: Int
:::

# Counter

The count is {{ to_string(count) }}.

::: button on:click=count + 1
increment
:::
```

That is a whole component. It renders, the button works, and if you misspell `count` you are told
before the page exists — including inside the button, which is the part no other framework checks.

## Using it

One line in your project's `burxt.package`:

```
dependency  star  https://github.com/andrecorugda/star-burxt  v0.1.0
dependency  bmx   https://github.com/andrecorugda/bmx         burxt-0.2.1
```

Then `burxt fetch`. Full instructions: [star.burxt-lang.org/install](https://star.burxt-lang.org/install.html).

## What is in here

| | |
|---|---|
| `star.bx` | the framework — one file |
| `examples/generate.bx` | a `.bmx` document → a component, on the command line |
| `examples/index.html`, `reconcile.js` | the browser driver |
| `examples/counter.bmx`, `form.bmx` | components |
| `test.py` | the guarantees |
| `verify-docs.py` | every example on the site, generated |
| `docs/` | the site |

## The supported surface is three names

`star_generate`, `StarComponent`, `StarHandler`. Everything else in `star.bx` is how it is done
today, and the day one of those changes should not be the day somebody else's build breaks.

## Testing

```sh
python3 test.py          # the guarantees. The ACCEPTING case runs first and its failure is fatal.
python3 verify-docs.py   # every .bmx example on the site
python3 check.py         # the site: front matter, raw blocks, CNAME
```

`test.py` is mostly refusals, and a suite of nothing but refusals is satisfied by a generator that
refuses everything — so the accepting case runs first and nothing below it means anything if it
fails.

`verify-docs.py` exists because the docs are a tutorial. It found chapter 1 teaching a document the
generator refuses, on the day it was written.

`check.py` exists because there is no Ruby here, so Jekyll only runs after a push and the first
symptom of a bad page is a site that silently stops updating. A literal `{{` outside a `{% raw %}`
block takes the whole build down, and these pages are full of `{{`.

`docs/assets/site.css` and `site.js` are byte copies of burxt-lang.org's — re-copy rather than edit.
`docs/assets/star.css` is this site's own.

## Licence

MIT or Apache-2.0, matching Burxt.
