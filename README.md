# star-burxt

The documentation site for **star-burxt**, served at
[star.burxt-lang.org](https://star.burxt-lang.org).

## Why this is a separate repository when the code is not

star-burxt itself is **not** here. It ships in the Burxt standard library as
[`lib/star.bx`](https://github.com/andrecorugda/burxt/blob/main/lib/star.bx), with its examples in
[`examples/star/`](https://github.com/andrecorugda/burxt/tree/main/examples/star) — because it
cannot run without Burxt, so a separate distribution would buy nothing and cost a wiring step.

The *site* is here for one reason: **GitHub Pages serves one site per repository.** `burxt` serves
`burxt-lang.org` and `bmx` serves `bmx.burxt-lang.org`, each from its own `docs/CNAME`. A second
subdomain needs a second repository whether or not it needs a second codebase.

So this repository contains documentation and nothing else. If you are looking for the framework,
it is in [burxt](https://github.com/andrecorugda/burxt).

## The stylesheet is copied, not reimplemented

`docs/assets/site.css` and `docs/assets/site.js` are **byte copies** of `burxt-lang.org`'s, exactly
as BMX's site does it, so the three sites are one site. When they change upstream, re-copy them
rather than editing here.

## Before pushing

```
python3 check.py
```

Every page must wrap its body in `{% raw %}` … `{% endraw %}`. A literal `{{` reads as a Liquid
variable and takes the whole build down — and because there is no Ruby locally, the first symptom is
a site that silently stops updating rather than an error anyone sees. That failure has happened here
before; `check.py` and the CI workflow are why it should not happen again.

## Licence

MIT or Apache-2.0, matching Burxt.
