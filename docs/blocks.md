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
:name: head
body
:!name:
```

**A block opens with `:name:` and closes with `:!name:`** — the closer says what it closes, so a
document with three levels in it can be read without counting. The body is an ordinary document:
headings, paragraphs, lists, and more blocks.

Two things follow from the closer carrying a name:

- **a closer that names the wrong block is refused**, so a document cannot be wrong about its own
  structure
- **you can indent**, because nesting is by containment and leading space means nothing. Indent for
  the reader; the parser ignores it either way.

And a short block fits on one line:

```text
:name: head :!name:
```

**A head can be delimited, and then the body is content.** Put it in brackets after an arrow:

```text
:button: -> [class=row, on:click=Msg.Save] Save it :!button:
```

Everything after the `]` is the body — **parsed**, so a slot is a slot and `**bold**` is bold. That is
the difference from `child=`, whose value is a string nothing looks inside. Use `child=` for a value;
use the brackets when the body is content.

Separate head tokens with a space or a comma, whichever reads better. A comma inside a handler is an
argument — `on:click=Msg.Toggle(string_to_int(key, 0))` is one token, not three.

---

## `props` — what the component is given

```sbmx
:props: name: String, total: Decimal<2>, lines: [Line]
:!props:
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
:section:

# Today

Three things happened.

:!section:
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
:div: class=card id=main
hello
:!div:
```

A value with spaces is quoted — `class="tag muted"`. A bare name is a boolean attribute —
`:input: disabled`. And a value can interpolate:

```sbmx
:a: href=/posts/{{ to_string(post.id) }}
read more
:!a:
```

The expression is checked like every other one, so a typo is a compile error rather than a broken
link.

---

## `on:` — events

```sbmx
:button: on:click=count + 1
increment
:!button:

:input: on:input=name
:!input:
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
:for: line in lines key line.id

:li:
{{ line.label }}
:!li:

:!for:
```

`key` is required in practice: it is how a row is recognised when the list changes. Use something
that identifies the item.

No `on:` handlers inside a `for` yet.

---

## `match` — choosing between many

```sbmx
:match: model.route

:case: Home
# Welcome
:!case:

:case: Post(id)
# Post {{ to_string(id) }}
:!case:

:!match:
```

A `match` holds `case` blocks and nothing else. A `case`'s head is a pattern, and it binds — `id` is
in scope inside that branch.

**Every variant must have a branch.** Add one to the enum and forget its `case`, and the build
fails naming it. See [chapter 4](guide/04-lists-and-choices.html).

---

## `else` — the other branch

```sbmx
:if: ready
…
:!if:

:else:
…
:!else:
```

Directly after the `if`, nothing between them, and no condition of its own.

---

## `if` — a section that appears when it should

```sbmx
:if: ready

:p:
Everything is set.
:!p:

:!if:
```

Any condition that answers true or false. No `else` — write a second `if`.

---

## A body written in the head — `child=`

```sbmx
:span: class=total child={to_string(amount)}
:!span:
```

The same element with its text between the fences, in one fewer line. Use it for a leaf — a label, a
badge, a cell — where a three-line block is all closer and no content.

**Braces mean an expression**, so the compiler judges what is inside them: `child={task.labl}` is an
error naming the field. Spaces need no quotes, because the braces say where the value ends.

**Keep a one-liner short.** `child=` and BMX's one-line form together let a leaf be a single line —

```sbmx
:p: child={to_string(model.left) + " left"} :!p:
```

— which is worth it for a label or a cell, and not worth it once the head carries three things. A long
one-liner wraps, and a wrapped line loses the indentation that made the nesting readable in the first
place. When the head grows, put the body back between the fences.

| you write | you get |
|---|---|
| `child={task.label}` | the value of that expression |
| `child={to_string(n) + " left"}` | any Burxt expression, spaces and all |
| `child={}` | an element with nothing in it, said out loud |
| `child=hello` | the literal text |
| `child="two words"` | the literal text, spaces kept |

`child={{ x }}` means the same as `child={x}` — the interpolation you already write everywhere else
in a head works here too.

- **a `child=` and a body between the fences is refused**, not silently merged
- a bare word is still a boolean attribute, exactly as in HTML: `:input: disabled`

**`child`, not `value`.** `value` is a real HTML attribute — `:input: value={{ model.draft }}` is
how a field is driven — so that is the one name it could not have been.

## Every attribute goes BEFORE `on:`

```sbmx
:button: class=danger on:click=Msg.Delete
delete
:!button:
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
:Badge: amount={{ model.count }} tone=unread
:!Badge:
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

---

## A note to yourself — `<!-- -->`

```sbmx
<!-- The designer wants this reworked; the copy is not final. -->
Hello {{ name }}.
```

**It emits nothing.** Before BMX 0.12.0 there was no comment at all, and an author's only options
were to delete the thought or watch it render: `<!-- TODO -->` came out the far side as visible
escaped text, on the page, for a reader to see. Not refused — *accepted, and wrong*, which is the one
shape worth fixing first.

A comment is a **whole line**. Mid-line is refused, because closing half of this would be worse than
closing none — that form would still ship the note:

```sbmx
:p:
Total: 5 <!-- fix this -->
:!p:
```

> BMX-E007 a comment is a whole line — move `<!--` to the start of its own line, or put it in a code
> span to show it literally

And the alternative that message names does work — `` `<!-- fix this -->` `` shows the characters
themselves. An unterminated comment is `BMX-E006` rather than a document that quietly ends early.

{% endraw %}
