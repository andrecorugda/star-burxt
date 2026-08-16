---
layout: default
title: What is not done
description: "The honest limits. Read this before choosing star-burxt for anything real."
---

{% raw %}

# What is not done

star-burxt is a first milestone. This page exists because a stated limitation is worth more than a
discovered one, and because everything on the rest of this site is easier to believe when the gaps
are listed beside it.

## No keys

Children are matched by position, so reordering a list rewrites every node from the first change
onward. That is wasteful, and worse than wasteful the moment anything owns a resource:
**`items[3]` is not the same item after a splice, silently.** Keys are a prerequisite for owning
anything per row, not a list optimisation.

## No async

None. No `fetch`, no timers, no cancellation, no suspension.

This is the largest gap and the one most likely to change the design rather than extend it. Killing
closure capture removes *stale reads*; it does nothing for **a request that resolves after the
thing it was about went away**. Those need generation counters or cancellation tokens, and every
framework gets complicated here.

## Structured state has nowhere to live

State is currently a scalar held by the driver. Burxt's regions are LIFO and nested regions do not
exist, so a value built inside a frame cannot outlive it. Where persistent structured state lives —
in the driver as data, in a never-closed region, or somewhere that does not exist yet — is an open
design question and should not be guessed at.

## No cross-file components

A document cannot invoke a component in another file, because that needs module resolution. A
component *can* declare its own props, so the piece that would otherwise block it is already done.

## Every frame is a whole HTML string

The module renders the entire component to text, and the driver reparses it to diff. React never
serialises anything. On a small tree this is invisible and the reconciler is fast; **on a large tree
this is the design's real cost**, and the fix is to emit a patch list rather than a document.

Anyone quoting a performance number for star-burxt should say what size tree it was measured on.
The published 0.038 ms per frame is a four-node counter, which is the workload where nothing is
hard.

## No resource ownership

A component cannot own a WebSocket, an `AbortController`, a media stream or any other live object,
because those cannot be named by serialisable state. The obvious escape hatch — a registry of live
objects keyed by an integer — is a manual heap with manual free, sitting **outside** everything
Burxt's memory model guarantees. Whether that escape hatch is acceptable is the open question that
decides whether this is a foundation or a demonstration, and it is being tested rather than
asserted.

## Not measured in a browser other than Chrome

Everything on this site that says "measured" was measured in headless Chrome via puppeteer. The
code is engine-level and there is no reason to expect Firefox or Safari to differ — but that is a
reason, not a measurement, and reasons about platforms have been wrong here before.

{% endraw %}
