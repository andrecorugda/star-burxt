---
layout: default
title: Events and state
description: "A handler is an expression producing the next state — and the architecture was forced rather than chosen."
---

{% raw %}

# Events and state

```
::: props count: Int
:::

::: button on:click=count + 1
increment
:::
```

`on:click=count + 1` is not a callback. It is **an expression producing the next state**, and it is
emitted into a function the compiler checks:

```
pure function counter_dispatch(handler: Int, count: Int) -> Int {
    if handler == 0 { return count + 1; }
    return count;
}
```

`dispatch(0, 41)` is `42`. You can print it. `burxt review` can diff what it promises between
versions. A contract can constrain it.

## Why it is this shape

**Burxt has no closures.** They were declined in `DESIGN.md` long before any of this, because a
closure needs an owner for its captured state — a memory question in a language whose entire memory
model is regions.

With no closures, there is nothing for state to hide inside. A handler cannot capture a mutable
cell, so state has to be threaded explicitly, so a handler has to be a function of the state
producing the next state. **That is The Elm Architecture, arrived at from a memory model rather
than from taste.** Nobody chose it and nobody could have chosen otherwise.

The refusal that looked like a limitation is what produces the inspectable component.

## What that deletes

| A framework with closures needs | star-burxt | why |
|---|---|---|
| dependency arrays | — | nothing captures, so nothing goes stale |
| `useCallback` / `useMemo` for identity | — | a handler is an index, not a function object |
| rules about where state may be declared | — | state is a parameter |
| debugging a stale closure | — | there are no closures |

**This is not a claim that staleness is solved.** Killing capture fixes *"the handler read a value
from three renders ago"*. It does nothing for *"the request resolved after the thing it was about
went away"*. Those are different bugs, and star-burxt has [no async at all](not-done.html) yet, so
it has not even met the second one.

## Events this host can wire

`click`, `input`, `change`, `submit`.

Anything else is **refused by name**. A host that accepts an event it does not deliver has told the
author something the compiler cannot catch, and BMX's §4a.5 requires refusing rather than emitting
an inline handler — because emitting one would put unchecked script on a page, which is the hole
the escaping rule exists to close.

Adding an event means adding a delegated listener to the driver. The list is short because it is a
list of things that actually work.

## What reaches the page

```html
<button data-star-h="0">increment</button>
```

An **index**. One delegated listener at the root reads it and calls the exported `dispatch`. Load a
star-burxt page and count the inline handlers and `<script>` elements inside the component: both
are zero.

That property is also what makes the page **resumable**. Because a handler is a static symbol plus
serialisable state rather than a closure, a server can emit the wiring and the client never has to
run a render to attach it — the module need not even be fetched until the first click. Measured in
Chrome: a server-rendered page, interactive, with zero component code executed.

{% endraw %}
