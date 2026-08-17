---
layout: default
title: When it says no
description: "Every refusal, in plain words, with what to write instead."
---

{% raw %}

# When it says no

star-burxt refuses things. Each refusal is here with what to write instead.

**Nothing on this page is a bug.** A refusal means the problem reached you in a terminal instead of
reaching a user on a screen.

---

## "unknown variable: `nmae`"

A slot or a handler names something that is not there.

```sbmx
Hello {{ nmae }}
```

**Fix:** check the spelling against your `::: props` line. If the value is new, add it there.

---

## "cannot apply `+` to Int and String"

You mixed a number and text.

```sbmx
::: button on:click=count + "one"
increment
:::
```

**Fix:** `count + 1`. If you want text, convert first: `to_string(count) + "one"`.

---

## "this multiplication … means rounding it"

You multiplied money and did not say how to round.

```sbmx
::: button on:click=total * 1.5
apply surcharge
:::
```

**Fix:** say how — `::: props total: Decimal<2, RoundHalfEven>` — or keep the exact answer with
`Decimal<4>`. [Chapter 5](guide/05-money.html) is about this one.

---

## "`mystery` is not a block this host knows"

You used a block name that is not an element.

```sbmx
::: mystery
:::
```

**Fix:** use one of these, or check the spelling.

`div` `span` `p` `section` `article` `header` `footer` `nav` `form` `label`
`strong` `em` `h1`–`h6` `ul` `ol` `li` `input` `img` `br` `hr` `button`

Plus `props`, `for` and `if`, which are not elements.

---

## "`on:hover` is not an event this host can wire"

**There is no `hover` event.** Hovering is CSS, not something that happens once:

```sbmx
===style.local
.card:hover { border-color: #333; }
===
```

If a hover has to change your *state* rather than its appearance, the events are `mouseenter` and
`mouseleave`.

Two others get the same treatment, because they are the ones people reach for:

| you wrote | the message says |
|---|---|
| `on:keypress` | use `on:keydown` — `keypress` is deprecated and misses keys |
| `on:mousemove` | use `on:pointermove` — it covers a mouse, a pen and a finger |

For anything else the message lists what is wired, which is most DOM events —
see [Events](blocks.html#on--events).

**star refuses an event it cannot deliver rather than accepting it and doing nothing.** A handler
that never runs is the worst failure a page can have: nothing breaks, nothing is logged, and you
stare at the screen wondering what you got wrong.

---

## "`input` is a void element, so it cannot have a body"

Some elements hold nothing.

```sbmx
::: input on:input=name
type here
:::
```

**Fix:** leave the body empty. Put the text in a `label` beside it. This applies to `input`, `img`,
`br` and `hr`.

---

## "`button` takes phrasing content, so it cannot contain a heading"

You put a block-level thing inside a text-level element.

```sbmx
::: button on:click=go
# Click me
:::
```

**Fix:** use text. `button`, `label`, `span`, `strong`, `em` and the headings hold text; everything
else holds anything.

This is HTML's rule — a heading inside a button is invalid markup and browsers handle it
unpredictably.

---

## "`key` belongs on a `for`, not on an `if`"

```sbmx
::: if ready key thing.id

::: p
Everything is set.
:::

:::
```

**Fix:** drop the `key`. A key tells rows apart, and an `if` has one branch with nothing to tell
apart.

---

## "an `on:` handler inside a `for` is not supported yet"

```sbmx
::: for line in lines key line.id
::: button on:click=line.id
remove
:::
:::
```

This one is a limit rather than a mistake, and it is the only refusal on this page that will
eventually go away.

A handler runs later, on its own, with the component's state. By then `line` no longer exists — it
was only there while the page was being drawn. The framework needs to remember *which row* rather
than *which value*, which is designed and not built.

**Fix, today:** drive the change from the whole list rather than from one row. A button outside the
loop works.

{% endraw %}
