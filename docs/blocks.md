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

```
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

```
::: section

# Today

Three things happened.

:::
```

**Layout:** `div` `section` `article` `header` `footer` `nav` `form`

**Text:** `p` `span` `strong` `em` `label` `h1` `h2` `h3` `h4` `h5` `h6`

**Lists:** `ul` `ol` `li`

**Empty:** `input` `img` `br` `hr`

**Interactive:** `button`

Text-level elements — `button` `label` `span` `strong` `em` and the headings — hold text only.
Everything else holds anything.

---

## `on:` — events

```
::: button on:click=count + 1
increment
:::

::: input on:input=name
:::
```

`click` · `input` · `change` · `submit`

After `=` goes **an expression for the next value**, and it runs to the end of the line — so write
the event last if the block has anything else on it.

---

## `for` — a row per item

```
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

## `if` — a section that appears when it should

```
::: if ready

::: p
Everything is set.
:::

:::
```

Any condition that answers true or false. No `else` — write a second `if`.

---

## `{{ }}` — a value in the page

```
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
