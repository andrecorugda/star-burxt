---
layout: default
title: Writing a component
description: "props, control flow, elements and the content model — everything a .bmx component can say."
---

{% raw %}

# Writing a component

A component is a `.bmx` document. [BMX](https://bmx.burxt-lang.org) supplies the syntax and refuses
to interpret any of it; star-burxt decides what it means. That split is
[BOUNDARY.md](https://bmx.burxt-lang.org/building-on.html), and it is why the format did not have
to grow a single construct for this framework to exist.

## props — the signature

```
::: props title: String, featured: Bool
:::
```

`props` is a block like any other. BMX captures `title: String, featured: Bool` as opaque text;
star-burxt reads it and puts it verbatim into the generated function's parameter list, where the
compiler judges every name and type in it.

**A component declares its own props**, which is what lets another document invoke it without
knowing an out-of-band signature. A document with no `props` block is refused: it has no signature,
so nothing could call it.

The first prop is the **state**. A handler yields the next one. With a single prop that is
unambiguous; structured state is [not done](not-done.html).

## Slots

```
The count is {{ to_string(count) }}.
```

A slot is an ordinary Burxt expression, checked where it stands. A typo is `unknown variable`
naming it. A `Decimal` where a `String` belongs is a type error. **A slot's value is always
escaped** — that is BMX's guarantee, not star-burxt's, and there is no opt-out because
`html_raw` is a different constructor that no document has syntax to produce.

## Control flow

```
::: if featured
Featured.
:::

::: for line in order.lines
- {{ line.sku }} × {{ to_string(line.qty) }}
:::
```

The head goes through verbatim as Burxt code, so `line` is bound with its real type and the
compiler resolves it. A field that does not exist on a `Line` is a compile error naming the field.

## Elements

A block whose name is an HTML element becomes that element:

```
::: div
::: button on:click=count + 1
increment
:::
:::
```

**An unknown block name is refused** rather than rendered or skipped — the first line of BMX's
§4a.5. Components in other files need cross-file resolution, which is [not
done](not-done.html), so today the declared names are elements plus `for`, `if` and `props`.

## The content model

An element that takes **phrasing** content unwraps its paragraphs; an element that takes **flow**
content keeps them.

```
::: button on:click=n + 1
increment
:::
```

becomes `<button>increment</button>`, not `<button><p>increment</p></button>` — because `<p>` is
flow content and `<button>` takes phrasing, so the nested version is invalid HTML rather than
merely unwanted.

**This is a rule rather than a preference, and it has no seam.** A phrasing element unwraps however
many paragraphs it has, one or several, so adding a second line to a button changes the output in
quantity and never in kind. An earlier version unwrapped only a *lone* paragraph and had exactly
that discontinuity in it. A `div` keeps its paragraphs, because in a `<div>` a `<p>` is correct.

Flow content inside a phrasing element — a heading in a button — is refused.

## Void elements

`input`, `br`, `hr` and `img` cannot have a body. Writing one is refused at generate time, with the
offset of the block you wrote, rather than left to trip `html_element`'s own contract at run time
with the page already open.

{% endraw %}
