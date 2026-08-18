---
layout: default
title: star-burxt
description: "Write a page in Markdown. Get a real front-end app. star-burxt turns .sbmx documents into components that render, respond to clicks, hold state, fetch and route."
---

<p class="lockup">
  <img src="{{ site.baseurl }}/assets/brand/starb_logo_transparent.svg"
       alt="star-burxt" width="319" height="97">
</p>

{% raw %}

# Build a front end by writing a document

star-burxt turns a `.sbmx` file into a working component — one that renders, responds to clicks,
holds state, fetches, and routes.

A component is markup, and the logic that goes with it, in one file:

```sbmx
:props: count: Int
:!props:

# Counter

The count is {{ to_string(count) }}.

:button: on:click=count + 1
increment
:!button:
```

You get this:

No build config. No component library. No JavaScript to write. **The document *is* the component.**

{% endraw %}
{% include showcase.html %}
{% raw %}

For anything past a counter, a component has two halves — the markup, and a `===bx` section holding
your own Burxt:

```sbmx
===bx
class Item  { id: Int, name: String }
class Model { count: Int, items: [Item] }
enum Msg { Increment, Reset }

pure function update(msg: Msg, m: Model) -> Model {
    match msg {
        Increment => { return Model { count: m.count + 1, items: m.items }; }
        Reset     => { return Model { count: 0, items: m.items }; }
    }
}
===

:props: model: Model
:!props:

# Counter

The count is {{ to_string(model.count) }}.

:button: on:click=Msg.Increment
increment
:!button:
```

`on:click=Msg.Increment` names a **message**, and your `update` decides what it does. That's one
function you can read, test, and diff — not a closure that re-runs.

## What a component can do

| You write | You get |
|---|---|
| `# Heading` and paragraphs | headings and paragraphs, as in any Markdown |
| `{{ total }}` | your data, in the page |
| `:props: model: Model` | what the component is given |
| `:button: on:click=Msg.Add` | a button, and your `update` decides what it does |
| `:for: item in items key item.id` | a row per item, each with its own buttons |
| `:match: model.route` | a screen per route — **forget one and the build fails** |
| `:if: ready` / `:else:` | a section that appears when it should |
| `:Badge: amount={{ n }}` | another component, imported with `use` |
| `:span: child={total} :!span:` | a leaf on one line, body and all |
| `===style.local` | CSS scoped to this component, with no default |
| `commands` and `watch` | fetching, timers, websockets — without `await` |
| `load` | server rendering, and server code that **cannot** reach the browser |

That is the whole idea. If you can write a document, you can write an app.

## Start with the tour

**[Your first component →](guide/01-your-first-component.html)**

Six short chapters. By the end you will have built a counter, a form, a list, and a price table, and
put them on a real page.

## The one thing that will surprise you

**star-burxt reads your buttons.**

Most frameworks treat what happens on a click as your business — it is a function, it runs, and if
it is wrong you find out when a user finds out. Here, a click is checked before the page exists.

Misspell something:

```sbmx
The total is {{ toatl }}
```

```
unknown variable: toatl
```

Try to add a word to a number:

```sbmx
:button: on:click=count + "one"
increment
:!button:
```

```
cannot apply `+` to Int and String
```

Round money without saying how:

```sbmx
:button: on:click=total * 1.5
apply surcharge
:!button:
```

<figure class="shot">
  <img src="assets/examples/money-refused.png"
       alt="A receipt document on the left, and on the right the checker refusing the multiplication in its on:click handler">
  <figcaption>That last one is the interesting case, and it has
  <a href="guide/05-money.html">its own chapter</a>.</figcaption>
</figure>

You do not have to know why this works to use it. If you would like to,
[Burxt](https://burxt-lang.org) is the language underneath and the explanation lives there.

## Where to go

- **[Your first component](guide/01-your-first-component.html)** — start here, it takes ten minutes
- **[Set up](install.html)** — what to install before chapter one
- **[How do I…?](how-do-i.html)** — short answers to common tasks
- **[When it says no](refusals.html)** — every refusal, and what to write instead

{% endraw %}
