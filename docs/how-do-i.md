---
layout: default
title: How do I…?
description: "Short answers to the things you will want next."
---

{% raw %}

# How do I…?

One screen per answer. If you have not done [the tour](guide/01-your-first-component.html), start
there instead.

## …show a number?

Wrap it in `to_string`:

```
You have {{ to_string(unread) }} messages.
```

Slots put text in the page, so anything that is not already text gets converted. Money too:
`{{ to_string(total) }}`.

## …show a price?

```
::: props total: Decimal<2>
:::

Total: {{ to_string(total) }}
```

`Decimal<2>` is exactly two decimal places, always. See [chapter 5](guide/05-money.html) for what
happens when you multiply one.

## …make a button do something?

```
::: button on:click=count + 1
increment
:::
```

The part after `=` is **the new value**, not code that changes something. `on:click=0` sets it to
zero.

## …read what someone typed?

```
::: input on:input=name
:::
```

## …submit a form?

```
::: form on:submit=draft

::: input on:input=draft
:::

::: button on:click=draft
save
:::

:::
```

## …show a list?

```
::: for line in lines key line.id

::: li
{{ line.label }}
:::

:::
```

Always give `key` something that identifies the item. See
[chapter 4](guide/04-lists-and-choices.html).

## …hide something until it is ready?

```
::: if ready

::: p
Everything is set.
:::

:::
```

There is no `else`. Write a second `::: if` for the other case.

## …style a component?

Two sections, and **you have to say which**:

```
===style.local
.card { border: 1px solid #ddd; padding: 1rem; }
===

===style.global
body { font-family: system-ui; }
===
```

`local` is scoped to this component: `.card` becomes `.card[data-s-page]`, and star stamps that
attribute on the elements it emits. A component you call gets its *own* marker, so your rules stop
at its edge.

`global` is exactly what you wrote.

Neither spelling is shorter than the other, on purpose. There is no default, so nothing leaks
because somebody forgot a word.

Generating writes `Page.css` beside `Page.sbmx`, with an `@import` for each component the page
uses. One `<link>` loads the tree.

## …put a class on an element?

Put it in the head, before any `on:`:

```
::: div class=card
:::

::: span class="tag muted"
draft
:::
```

A value with spaces is quoted. A bare name is a boolean attribute — `::: input disabled`.

## …build a link from my data?

Interpolate the value:

```
::: a href=/posts/{{ to_string(post.id) }}
read more
:::
```

The expression inside `{{ }}` is checked like everything else, so a typo is a compile error rather
than a link to a page that does not exist.

## …use more than one piece of state?

Write a `===bx` section. Your state becomes a record, your handlers become messages, and an
`update` function you can read decides what each one does:

```
===bx
class Model { count: Int, items: [Item] }
enum Msg { Increment, Reset }

pure function update(msg: Msg, m: Model) -> Model {
    match msg {
        Increment => { return Model { count: m.count + 1, items: m.items }; }
        Reset     => { return Model { count: 0, items: m.items }; }
    }
}
===

::: props model: Model
:::

::: button on:click=Msg.Increment
more
:::
```

## …put a button on each row?

Key the loop, and let the handler use `key`:

```
::: for todo in model.todos key to_string(todo.id)

::: li

::: button on:click=Msg.Toggle(string_to_int(key, 0))
{{ todo.label }}
:::

:::

:::
```

**`key` is the row's identity, as text.** A DOM attribute is text, so it arrives as a `String` and
you convert — `string_to_int(key, 0)` for a number.

**What you cannot do is name the loop variable in the handler:**

```
::: for todo in model.todos key to_string(todo.id)

::: button on:click=Msg.Toggle(todo.id)
{{ todo.label }}
:::

:::
```

```
STAR-E007: this handler names `todo`, which does not exist where handlers run —
a handler is a function of (handler, key, state), and `todo` was bound while
drawing the page. Use `key`
```

`todo` existed while the page was being drawn. By the time somebody clicks, it is gone — so the row
is identified by its key and `update` finds it in the state it is given.

## …split a screen into several components?

Put the component in its own file, import it, and call it as a block.

`Badge.sbmx`:

```
::: props value: Int, tone: String
:::

::: span class=badge
{{ tone }}: {{ to_string(value) }}
:::
```

`Page.sbmx`:

```
===bx
use "./Badge.sbmx";

class Model { unread: Int }
enum Msg { Clear }

pure function update(msg: Msg, m: Model) -> Model {
    match msg {
        Clear => { return Model { unread: 0 }; }
    }
}
===

::: props model: Model
:::

::: Badge value={{ model.unread }} tone=unread
:::
```

Generating `Page.sbmx` generates `Badge.sbmx` too, beside its own source. One command.

**A prop you forget is named**, along with what the component wants:

```
STAR-E017: `Badge` needs `tone`, and this call does not give it.
Its props are `value: Int, tone: String`
```

And the order you write them in does not matter — arguments are passed in the order the component
declares them, so two props of the same type cannot swap by accident.

## …see what my document turned into?

```sh
./star-generate page.bmx page
```

It prints the component. Reading it is encouraged — there is nothing in there you did not write.

## …build a page with several screens?

Make the route an `enum`, derive it from the path, and `match` on it:

```
===bx
use "std/string.bx";

enum Route { Home, Post(Int), Missing }
class Model { route: Route, path: String }
enum Msg { Navigate(String) }

pure function route_of(path: String) -> Route {
    if path == "/" { return Route.Home; }
    if string_starts_with(path, "/posts/") {
        return Route.Post(string_to_int(substring(path, 7, len(path) - 7), 0));
    }
    return Route.Missing;
}

pure function update(msg: Msg, m: Model) -> Model {
    match msg {
        Navigate(to) => { return Model { route: route_of(to), path: to }; }
    }
}
===

::: props model: Model
:::

::: match model.route

::: case Home
# Welcome
:::

::: case Post(id)
# Post {{ to_string(id) }}
:::

::: case Missing
::: p
Nothing at {{ model.path }}
:::
:::

:::
```

Copy `examples/router.js` beside your page. It intercepts in-page links, handles the back button,
and hands the path in.

**Your links are real markup** — `::: a href=/posts/42` — so they work before any JavaScript runs
and the driver only upgrades them.

And because the route is an `enum` matched exhaustively, **adding a screen and forgetting to draw it
fails the build** rather than showing a blank page.

## …find out why it refused something?

Every refusal is listed with its fix on **[When it says no](refusals.html)**.

{% endraw %}
