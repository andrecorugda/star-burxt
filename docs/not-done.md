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

**Anything asynchronous.** No fetching, no timers, no loading states. A component is given its data
and draws it. The shape is designed — an update answers the next state *and* commands for the driver
to perform — and it is not built.

**Carrying state costs two functions.** A component that runs in a browser needs `to_text` and
`from_text`, because nothing in Burxt holds state between two calls. That is a gap rather than a
decision, and it is being worked on.

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

- anything that fetches while you look at it
- anything needing fine-grained styling hooks on individual elements

## When this changes

This page is kept accurate rather than optimistic. If something moves off the first list, it moves
off this page in the same change.

{% endraw %}
