---
layout: default
title: Your first component
section: guide
description: "Write a document, turn it into a component, see what it made."
---

{% raw %}

# 1. Your first component

By the end of this page you will have a greeting on a screen, made from a document you wrote.

## Write the component

Make a file called `hello.sbmx`.

**The extension matters, and the two are not interchangeable.** `.bmx` belongs to BMX the way `.html`
belongs to HTML: a document any tool can render, with no logic in it. `.sbmx` belongs to star the way
`.jsx` belongs to React: the same markup plus the code that makes it do something. A `.bmx` is a
document; a `.sbmx` is a component. Rename one to the other and the tool that reads it changes.

```sbmx
:props: name: String
:!props:

# Hello {{ name }}

Welcome to the page.
```

Three things are going on, and only one of them is new:

**`# Hello` and the paragraph** are ordinary Markdown. If you have written a README, you have written
these.

**`:props: name: String`** says *this component is given a name, and a name is text*. Every
document starts with one of these — it is how the component gets anything to be about.

**`{{ name }}`** puts that value in the page.

## Turn it into a component

```sh
./star-generate hello.sbmx hello > hello.bx
```

Open `hello.bx`:

```burxt
pure function hello(name: String) -> Html allocates {
    let mutable kids: [Html] = [];
    let s_0_1: Int = push(kids, html_element("h1", [], [html_text("Hello "), html_text(name)]));
    let s_0_2: Int = push(kids, html_element("p", [], [html_text("Welcome to the page.")]));
    return html_element("div", [html_attr("class", "star")], kids);
}
```

**Nothing surprising is in there.** The heading became an `h1`, the paragraph became a `p`, they went
into a `div`, and `name` went where you put it. That is the whole translation, and it stays this
readable however big your document gets.

You will rarely open this file again. Knowing that you *can* — and that there is nothing hidden in
it — is the point.

Call `hello("Ada")` and the page says **Hello Ada**.

## Get it wrong on purpose

Change `{{ name }}` to `{{ nmae }}` and generate again:

```
unknown variable: nmae
```

**You found that typo now**, not from a blank space on a page after somebody deployed it.

Do this once deliberately, because it is the habit the rest of the tour relies on: when you are not
sure whether something works, write it and look.

## Every document needs `props`

Drop the `:props:` block and you are told:

```sbmx
this document declares no `props` block, so it has no signature and nothing
can invoke it. Add `:props: name: Type`
```

A component that is given nothing has nothing to show that a plain HTML file would not show better.
If a piece of your page really is fixed text, write it as fixed text.

## What you have

- a `.sbmx` file is a component
- `:props:` says what it is given, and comes first
- `{{ }}` puts a value in the page
- a mistake in a `{{ }}` is caught before the page exists

**One command checks all of it**, and you will use it more than the generator:

```sh
./star-check hello.sbmx
```

It reports three kinds of problem — a malformed document, something that is not a component, and a
type error in your own code — and stops at the first.

**[Chapter 2: Showing your data →](02-showing-your-data.html)**

{% endraw %}
