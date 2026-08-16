---
layout: default
title: When star-burxt says no
section: guide
description: "The refusals, and why the most interesting one is not star-burxt's."
---

{% raw %}

# 3. When star-burxt says no

## An event it cannot wire

```
::: button on:hover=count + 1
```
```
STAR-E002 at 37: `on:hover` is not an event this host can wire.
Wired events are click, input, change, submit
```

It would have been easy to emit `onhover="..."` into the page and let the browser sort it out. That
is what the refusal exists to prevent: an inline handler is unchecked script on a page whose whole
escaping guarantee is that unchecked things cannot get there.

## A block it does not know

```
::: mystery
```
```
STAR-E001 at 37: this host does not declare a block named `mystery`.
```

Not rendered, not skipped, not passed through. BMX deliberately does not know what any block name
means — deciding is the host's job, and a host that silently ignores a block it does not understand
is deciding by accident.

## Now the interesting one

```
::: props total: Decimal<2>
:::

::: button on:click=total * 1.5
bump
:::
```
```
error: this multiplication of Decimal<2> by Decimal<2> has an exact product with
4 decimal places, and reaching Decimal<2> means rounding it. Say how —
Decimal<2, RoundHalfEven> — or take the exact answer with Decimal<4>.
```

**Nobody wrote that rule for star-burxt.** It is Burxt's ordinary rule about money: a value with two
decimal places, multiplied, has four, and getting back to two means throwing something away — so
say how you want it thrown away.

It reaches your click handler because the handler is an expression the compiler reads, not a
closure it cannot see inside.

Fix it by saying what you meant:

```
::: button on:click=total * 1.5 as Decimal<2, RoundHalfEven>
```

## The pattern

Three of these are star-burxt refusing something it cannot do honestly. Four are the language
noticing that your event handler is code like any other code.

The second kind is the point. A framework that can only check your templates has to invent its own
rules for everything else; one whose handlers are ordinary expressions inherits every rule the
language already had.

Next: [getting it into a browser](04-putting-it-in-a-browser.html).

{% endraw %}
