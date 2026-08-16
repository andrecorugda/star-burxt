---
layout: default
title: Events and state
section: guide
description: "A handler is an expression producing the next state."
---

{% raw %}

# 2. Events and state

```
::: props count: Int
:::

# Counter

The count is {{ to_string(count) }}.

::: button on:click=count + 1
increment
:::

::: button on:click=0
reset
:::
```

`on:click=count + 1` says: **when this is clicked, the next state is `count + 1`.**

Not "call this function". Not "set this variable". The next state, as an expression.

## What comes out

```burxt
pure function counter_dispatch(handler: Int, count: Int) -> Int {
    if handler == 0 { return count + 1; }
    if handler == 1 { return 0; }
    return count;
}
```

Your two handlers, in a function you can call, test and read. `counter_dispatch(0, 41)` is `42`.

## Why not a callback

Burxt has no closures. Not "discourages" — has none, by a decision made years before this framework
existed, because a closure needs an owner for its captured state and that is a memory question in a
language built on regions.

So a handler *cannot* capture a variable and mutate it later. It can only be given the state and
produce the next one. Everything people find annoying about closures in other frameworks — stale
values, dependency arrays, memoising a function so its identity stays stable — is about a thing
that cannot happen here.

**You are not being asked to write it this way for discipline. There is no other way to write it.**

## The state is your first prop

`count: Int` is both what the view renders and what a handler returns. One prop, one state, no
ambiguity. [Structured state](../not-done.html) is not done.

Next: [what happens when you get it wrong](03-when-it-says-no.html).

{% endraw %}
