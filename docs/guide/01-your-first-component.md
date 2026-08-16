---
layout: default
title: Your first component
section: guide
description: "Write a .bmx file, generate it, read what came out."
---

{% raw %}

# 1. Your first component

Write `hello.bmx`:

```
::: props name: String
:::

# Hello, {{ name }}

Welcome back.
```

Two things are happening. `::: props name: String` declares what this component takes.
`{{ name }}` puts it somewhere.

Generate it:

```
./star-generate hello.bmx hello > hello.bx
```

## Read what came out

This is the part worth slowing down for, because nothing about it is hidden:

```burxt
pure function hello(name: String) -> Html allocates {
    let mutable kids: [Html] = [];
    let s_0_1: Int = push(kids, html_element("h1", [], [
        html_text("Hello, "), html_text(name)]));
    let s_0_2: Int = push(kids, html_element("p", [], [
        html_text("Welcome back.")]));
    return html_element("div", [html_attr("class", "star")], kids);
}
```

**That is ordinary Burxt.** No framework runtime, no virtual DOM, no component instance. A function
from your props to an `Html` value. You could have written it by hand, and if you ever need to, you
can.

It is `pure`, so it cannot reach a file, a socket or a clock — and `burxt effects --allow ""`
confirms that rather than trusting it.

## Now make a mistake

Change the slot to `{{ nmae }}` and generate again:

```
error: unknown variable: nmae
  --> hello.bx:9:52
   |
 9 |     ... html_element("h1", [], [html_text("Hello, "), html_text(nmae)]));
```

The compiler caught it, because the slot became an expression rather than staying a string. This is
the whole idea, and everything else in this guide is a consequence of it.

## What you have

A component that takes typed props, renders escaped HTML, and cannot compile if you refer to
something that is not there.

Next: [making it do something](02-events-and-state.html).

{% endraw %}
