---
layout: default
title: Lists and choices
section: guide
description: "A row per item, and a section that appears when it should."
---

{% raw %}

# 4. Lists and choices

Real screens repeat things and hide things. Two blocks do both.

## A row per item

```sbmx
:props: lines: [Line]
:!props:

# Order

:ul:

:for: line in lines key line.id

:li:
{{ line.label }} — {{ to_string(line.quantity) }}
:!li:

:!for:

:!ul:
```

**`:for: line in lines`** repeats its body once per item, with `line` naming the current one.

**`key line.id`** tells star-burxt how to recognise a row when the list changes. Give it something
that identifies the item — an id, an order number, a code.

### Why `key` is not optional

When a list changes, the page has to work out which rows moved, which are new, and which are gone.
Without a key it has to guess by position — and position lies. Delete the first of five rows and
every remaining row is now at a different index, so a page that matches by position will happily
show row 2's text with row 3's checkbox ticked.

A key is a promise: *this row is that item, wherever it ends up*. Give it one that does not change.
`line.id` is right. A row number is not.

Get the field name wrong and you are told:

```
unknown field: idd
```

## A section that appears when it should

```sbmx
:props: ready: Bool
:!props:

:if: ready

:p:
Everything is set.
:!p:

:!if:
```

The body appears when the condition is true and is absent when it is not — not hidden with CSS,
absent. There is no `else`; write a second `if` for the other case.

## The other branch

```sbmx
:if: ready

:p:
Everything is set.
:!p:

:!if:

:else:

:p:
Still waiting.
:!p:

:!else:
```

An `else` must come **directly after** its `if`, with nothing between them. It takes no condition —
if you meant a different question, write a second `if`.

## Choosing between many

When there are more than two answers, `match` is the one to reach for — and it is the reason to
build a screen this way rather than any other:

```sbmx
:match: model.route

:case: Home

# Welcome

:!case:

:case: Post(id)

# Post {{ to_string(id) }}

:!case:

:case: Search(q)

# Results for {{ q }}

:!case:

:!match:
```

`case Post(id)` binds `id` inside its branch, exactly as `for row in rows` binds `row`.

**Now add a screen and forget to render it:**

```
enum Route { Home, Post(Int), Search(String), Archive }
```

```
error: this `match` on `Route` does not handle `Archive`. Every variant must be
handled — that is what makes adding a variant later a compile error instead of
a silent fall-through.
```

**The build fails.** Not a blank page, not a bug report from somebody who clicked the wrong link
three weeks later — the thing you forgot, named, before the page exists.

This is the reason to write your routes as an `enum` rather than as strings, and it is the one
thing on this site that no other front-end framework can do.

## Conditions can be expressions

```sbmx
:if: len(lines) > 0

:p:
There is something to show.
:!p:

:!if:
```

Anything that answers true or false — `total > 0.00`, `ready`, `len(lines) > 0`. And as everywhere else, a mistake in the condition is a message
rather than a section that never shows up.

## A limit, said plainly

**You cannot put a button inside a `for` yet.**

```sbmx
:for: line in lines key line.id
:button: on:click=line.id
remove
:!button:
:!for:
```

```
an `on:` handler inside a `for` is not supported yet
```

Here is the honest reason. A handler runs later, on its own, with the component's state — and by
then `line` is gone, because `line` only existed while the page was being drawn. The framework
would have to remember *which row* rather than *which value*, and that is designed but not built.

**What to do instead**, today: drive the change from the whole list rather than from one row. A
"clear completed" button outside the loop works. A per-row delete does not, yet.

This is on [what's not built yet](../not-done.html) with everything else in that state.

## What you have

- `:for: x in xs key x.id` — a row per item
- a key identifies the row, and it matters more than it looks
- `:if: condition` — a section that appears when it should
- buttons do not go inside loops yet

**[Chapter 5: Money →](05-money.html)**

{% endraw %}
