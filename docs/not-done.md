---
layout: default
title: What's not built yet
description: "An honest list, so you can tell whether star-burxt fits what you are building."
---

{% raw %}

# What's not built yet

Read this before choosing star-burxt for something real. It is short, it is honest, and it is more
useful to you than a feature list.

## Not there yet

**Carrying state costs two functions.** A component that runs in a browser needs `to_text` and
`from_text`, because nothing in Burxt holds state between two calls. That is a gap rather than a
decision, and it is being worked on.

**One event per element**, and it is refused by name rather than silently taking the first. A handler
is an expression with no end marker, so the first `on:` takes the rest of the line — STAR-E022 says
so and tells you what to do instead. Put the second event on a wrapper, or handle both in the one you
keep.

**`template` and `svg` are not elements star knows**, and both are decisions rather than omissions.
A `template`'s children are inert and star renders children as live content, so admitting it would
render exactly what the element exists not to render. `svg` is foreign content — its children are not
HTML, so `:path:` and `:circle:` need a second vocabulary with its own content model. Everything else
in HTML that holds phrasing or flow content is there, including `time`, `abbr`, `kbd`, `iframe` and
`audio`, which were missing until they were looked for.

**Publishing a component library needs a compiler newer than any release.** star's side is built:
`use "mylib/Card.sbmx"` resolves through the package, the component is generated into `.star/` in your
tree, and its props are checked at the call site exactly as a local component's are. It works by asking
the compiler where a package sits — `burxt where` — because that location is derived from the
dependency's source and is deliberately not something star may re-derive.

That command is **not in a Burxt release yet**, so on today's `burxt` a package-qualified import falls
back to being read as a path and is refused, with the compiler's own message passed through underneath
star's. A third-party *Burxt library* has always worked and still does — declare it, `use
"mylib/money.bx"` in your `===bx` section, and the compiler resolves it the ordinary way.

**A block that only wraps something is still worth avoiding.** A `span` holding nothing but a square
is three tokens of markup for a shape CSS can draw — `===style.local` with a `::before` is usually the
better answer, and it keeps the document about content.

## Deliberately not planned

**Two-way binding beyond `on:input`.** A value flows in and an event flows out, and that is the
whole path.

**Anything that runs on the page but not in your document.** No directives, no lifecycle hooks, no
plugin system. What the page does is what your document says.

## Where it is a good fit today

- a screen made of data you already have
- forms, counters, filters, toggles
- **anything with prices on it** — this is where star-burxt earns its place
- a page that must render the same on the server and in the browser

## Where it is not, yet

- a control that needs two different events on the same element

## When this changes

This page is kept accurate rather than optimistic. If something moves off the first list, it moves
off this page in the same change.

{% endraw %}
