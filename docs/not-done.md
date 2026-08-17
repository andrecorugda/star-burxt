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

**One event per element.** `on:input=…` and `on:keydown=…` on the same element is not supported yet —
the head reads one `on:` binding and the rest of the line is the expression. Put the second event on
a wrapper, or handle it in the one you have.

**A document cannot be indented, and a block cannot open and close on one line.** Nesting is by
containment, so a block's contents start at column one however deep the block is, and a `span`
holding one slot costs three lines and a closer. Both are BMX's decision rather than star's, and both
requests are with them, measured. Until then, blocks that only wrap something — a square, a label —
are often better done in `===style.local` with a pseudo-element.

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
