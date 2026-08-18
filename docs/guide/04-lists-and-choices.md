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

**A button inside a `for` works, and the row it belongs to arrives as `key`.**

```sbmx
:for: line in lines key line.id
:button: on:click=Msg.Remove(string_to_int(key, 0))
remove
:!button:
:!for:
```

The `key` on the `for` is what makes it possible. A handler runs *later*, on its own, with the
component's state — and by then `line` is gone, because `line` only existed while the page was being
drawn. So the row's identity travels to the handler as text, in the `key` parameter, which is the
same expression the loop was given.

**Which is why naming the loop variable in a handler is refused**, rather than compiling into
something that looks right and is not:

```
STAR-E007: this handler names `line`, which does not exist where handlers run — a handler is
a function of (handler, key, state), and `line` was bound while drawing the page. Use `key`,
which carries this row's `key` expression as text: `string_to_int(key, 0)` for a number
```

**A `for` containing a handler must have a `key`** — without one, every row would dispatch
identically and the page would have no way to say which was clicked. That is STAR-E018, and it is a
refusal rather than a silent wrong answer for the usual reason: a button that looks like it works and
deletes the wrong row is worse than one that will not build.

## What you have

- `:for: x in xs key x.id` — a row per item
- a key identifies the row, and it matters more than it looks
- `:if: condition` — a section that appears when it should
- a button inside a loop gets its row as `key`, and the `for` must have one

**[Chapter 5: Money →](05-money.html)**

{% endraw %}
