---
layout: default
title: Gallery
---

# Gallery

Every example in the repository, **captured running in a browser**, beside the markup that made it.

{% include gallery.html %}

## What these are

Each one is in the collection for a reason — an edge, a combination nothing else covers, or a case that was
silently wrong until somebody wrote it down. Most of them found a defect when they were written, and
[`examples/README.md`](https://github.com/andrecorugda/star-burxt/tree/main/examples#readme) says which.

**Nothing here is a mock-up.** `tools/gallery.mjs` builds each component, serves it, mounts the real
`.wasm` in a real browser and screenshots the result — and then reads the page's own DOM back to check the
state it was given actually took. A screenshot is the one kind of claim that cannot go stale loudly: the
picture keeps looking correct after the component stops working, because a picture is a file.

**The styling is two halves, and that is the same split Tailwind and Bootstrap make.** A component's
`===style.local` holds what makes it itself — a board is 3.6rem squares, a snake segment is 18px, and star
scopes those rules to that component. Everything shared — type, colour, spacing, the shape of a button —
belongs to the page, and here it is one 166-line stylesheet. star never reads a class name, so swapping that
file for Tailwind's output changes nothing about how any of this works.
