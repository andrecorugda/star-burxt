---
layout: default
title: Blocks
description: "Every block, on one page, with an example of each."
---

{% raw %}

# Blocks

Everything you can write, on one page.

## The shape

```text
::: name head
body
:::
```

A block opens with `:::`, closes with `:::`, and the body is an ordinary document — headings,
paragraphs, lists, and more blocks.

---

## `props` — what the component is given

```sbmx
::: props name: String, total: Decimal<2>, lines: [Line]
:::
```

Always the first block. Empty body.

| Kind | For |
|---|---|
| `String` | text |
| `Int` | whole numbers, counts |
| `Bool` | true or false |
| `Decimal<2>` | money |
| `[Thing]` | a list |

The **first** prop is the component's state — the thing your buttons change.

---

## Elements — wrapping things

```sbmx
::: section

# Today

Three things happened.

:::
```

Elements come in three kinds, and the kind decides what may go inside.

**Text-level** — holds text and nothing else:

`a` `b` `button` `caption` `code` `em` `h1`–`h6` `i` `label` `legend` `mark` `option` `q` `s`
`small` `span` `strong` `sub` `summary` `sup` `textarea` `title` `u`

**Empty** — holds nothing at all:

`area` `base` `br` `col` `embed` `hr` `img` `input` `link` `meta` `source` `track` `wbr`

**Everything else** — holds anything:

`address` `article` `aside` `blockquote` `canvas` `dd` `details` `dialog` `div` `dl` `dt`
`fieldset` `figcaption` `figure` `footer` `form` `header` `li` `main` `nav` `ol` `p` `picture`
`pre` `section` `select` `table` `tbody` `td` `tfoot` `th` `thead` `tr` `ul` `video`

Put a heading in a text-level element and you are told — that is HTML's rule, not star-burxt's, and
browsers handle the invalid version unpredictably.

---

## Attributes

Anything before an `on:` is an attribute:

```sbmx
::: div class=card id=main
hello
:::
```

A value with spaces is quoted — `class="tag muted"`. A bare name is a boolean attribute —
`::: input disabled`. And a value can interpolate:

```sbmx
::: a href=/posts/{{ to_string(post.id) }}
read more
:::
```

The expression is checked like every other one, so a typo is a compile error rather than a broken
link.

---

## `on:` — events

```sbmx
::: button on:click=count + 1
increment
:::

::: input on:input=name
:::
```

Most DOM events: the pointer and mouse, `keydown`/`keyup`, the form events including `focus` and
`blur`, dragging, touch, `wheel`, `scroll`, and the animation and transition events. Ask for one
that is not wired and the message says what to write instead.

Every event carries a **value**: the typed text for `input`, the key for `keydown`, the coordinates
for a pointer, the animation's name for `animationend`. It reaches a handler as `value`.

After `=` goes **an expression for the next value** — or a message, in a component with a `===bx`
section — and it runs to the end of the line, so write the event last if the block has anything
else on it.

---

## `for` — a row per item

```sbmx
::: for line in lines key line.id

::: li
{{ line.label }}
:::

:::
```

`key` is required in practice: it is how a row is recognised when the list changes. Use something
that identifies the item.

No `on:` handlers inside a `for` yet.

---

## `match` — choosing between many

```sbmx
::: match model.route

::: case Home
# Welcome
:::

::: case Post(id)
# Post {{ to_string(id) }}
:::

:::
```

A `match` holds `case` blocks and nothing else. A `case`'s head is a pattern, and it binds — `id` is
in scope inside that branch.

**Every variant must have a branch.** Add one to the enum and forget its `case`, and the build
fails naming it. See [chapter 4](guide/04-lists-and-choices.html).

---

## `else` — the other branch

```sbmx
::: if ready
…
:::

::: else
…
:::
```

Directly after the `if`, nothing between them, and no condition of its own.

---

## `if` — a section that appears when it should

```sbmx
::: if ready

::: p
Everything is set.
:::

:::
```

Any condition that answers true or false. No `else` — write a second `if`.

---

## A body written in the head — `child=`

```sbmx
::: span class=total child={{ to_string(amount) }}
:::
```

The same element with its text between the fences, in one fewer line. Use it for a leaf — a label, a
badge, a cell — where a three-line block is all closer and no content.

- it is an ordinary attribute, so a quoted value keeps its spaces: `child="two words"`
- it takes a slot, so the text can come from state
- **a `child=` and a body between the fences is refused**, not silently merged
- a bare word is still a boolean attribute, exactly as in HTML: `::: input disabled`

**`child`, not `value`.** `value` is a real HTML attribute — `::: input value={{ model.draft }}` is
how a field is driven — so that is the one name it could not have been.

## Every attribute goes BEFORE `on:`

```sbmx
::: button class=danger on:click=Msg.Delete
delete
:::
```

An `on:` binding runs to the end of the line, because a handler is an expression and an expression has
no end marker. So anything after it would be part of the handler — and star **refuses** that rather
than quietly dropping it:

```
STAR-E022: `on:click` runs to the end of the head, so `class=` after it becomes part of
the handler instead of an attribute. Put every attribute BEFORE the `on:` binding
```

## A component — a capitalised name

```sbmx
::: Badge amount={{ model.count }} tone=unread
:::
```

Any `.sbmx` you imported in `===bx`:

```sbmx
===bx
use "./Badge.sbmx";
===
```

Props are passed by name. Order does not matter; a missing one is named.

---

## `{{ }}` — a value in the page

```sbmx
Hello {{ name }}, you have {{ to_string(unread) }} messages.
```

Text goes in as it is. Everything else needs `to_string`.

---

## Markdown

Everything a document normally has, inside blocks or outside them:

```
# Heading
## Smaller heading

A paragraph with **bold**, *italic*, `code` and a [link](https://example.com).

- a list
- of things

1. or a numbered
2. one

> A quote.
```

{% endraw %}
