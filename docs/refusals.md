---
layout: default
title: When it refuses
description: "Every refusal star-burxt makes, and every refusal it hands to the compiler, with the reason for each."
---

{% raw %}

# When it refuses

Seven refusals. **Four of them are not star-burxt's** — they are the ordinary rules of Burxt,
reaching an event handler because the handler is an expression the compiler can see. That is the
entire argument for generating checked code rather than interpreting a head at run time.

## From the compiler

### A typo in a slot

```
The count is {{ to_string(cuont) }}.
```
```
error: unknown variable: cuont
```

### A type error in a handler

```
::: button on:click=count + "one"
```
```
error: type error: cannot apply `+` to Int and String
```

### Money narrowing in a handler

```
::: props total: Decimal<2>
:::
::: button on:click=total * 1.5
```
```
error: this multiplication of Decimal<2> by Decimal<2> has an exact product with
4 decimal places, and reaching Decimal<2> means rounding it. Say how —
Decimal<2, RoundHalfEven> — or take the exact answer with Decimal<4>.
```

**This is the one to look at twice.** Nobody wrote a rule about money in click handlers. The rule
already existed and the handler is somewhere it can now reach.

### A missing field, inside a loop

The head of a `for` is real Burxt, so the binding is real. `line.skuu` is a compile error naming
the field, at the expression you wrote.

## From star-burxt

### STAR-E001 — a block name this host does not declare

```
::: mystery
```
```
STAR-E001 at 37: this host does not declare a block named `mystery`. Elements and
`for`/`if`/`props` are declared; a component needs cross-file resolution, which
does not exist yet
```

BMX's §4a.5, first line: refuse an unknown block name, never render it and never skip it silently.

### STAR-E002 — an event this host cannot wire

```
::: button on:hover=count + 1
```
```
STAR-E002 at 37: `on:hover` is not an event this host can wire. Wired events are
click, input, change, submit
```

The alternative would be emitting an inline handler, which §4a.5 forbids for a reason: it puts
unchecked script on the page.

### STAR-E003 — no props

A document with no `props` block has no signature, so nothing can invoke it.

### STAR-E004 — a void element with a body

```
::: input on:input=name
oops
:::
```

`html_element` carries `requires !html_is_void(tag) || len(children) == 0`. Without this refusal the
contract would still catch it — at run time, with the page already open. The contract is also what
makes this refusal provably complete rather than a list somebody maintains.

### STAR-E005 — flow content in a phrasing element

```
::: button on:click=n + 1
# nope
:::
```

`<button>` takes phrasing content. A heading is flow content. See [the content
model](components.html#the-content-model).

{% endraw %}
