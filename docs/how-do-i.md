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

```sbmx
You have {{ to_string(unread) }} messages.
```

Slots put text in the page, so anything that is not already text gets converted. Money too:
`{{ to_string(total) }}`.

## …show a price?

```sbmx
::: props total: Decimal<2>
:::

Total: {{ to_string(total) }}
```

`Decimal<2>` is exactly two decimal places, always. See [chapter 5](guide/05-money.html) for what
happens when you multiply one.

## …make a button do something?

```sbmx
::: button on:click=count + 1
increment
:::
```

The part after `=` is **the new value**, not code that changes something. `on:click=0` sets it to
zero.

## …read what someone typed?

```sbmx
::: input on:input=name
:::
```

## …submit a form?

```sbmx
::: form on:submit=draft

::: input on:input=draft
:::

::: button on:click=draft
save
:::

:::
```

## …show a list?

```sbmx
::: for line in lines key line.id

::: li
{{ line.label }}
:::

:::
```

Always give `key` something that identifies the item. See
[chapter 4](guide/04-lists-and-choices.html).

## …hide something until it is ready?

```sbmx
::: if ready

::: p
Everything is set.
:::

:::
```

There is no `else`. Write a second `::: if` for the other case.

## …style a component?

Two sections, and **you have to say which**:

```sbmx
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

```sbmx
::: div class=card
:::

::: span class="tag muted"
draft
:::
```

A value with spaces is quoted. A bare name is a boolean attribute — `::: input disabled`.

## …build a link from my data?

Interpolate the value:

```sbmx
::: a href=/posts/{{ to_string(post.id) }}
read more
:::
```

The expression inside `{{ }}` is checked like everything else, so a typo is a compile error rather
than a link to a page that does not exist.

## …use more than one piece of state?

Write a `===bx` section. Your state becomes a record, your handlers become messages, and an
`update` function you can read decides what each one does:

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

::: props model: Model
:::

::: button on:click=Msg.Increment
more
:::
```

## …put a button on each row?

Key the loop, and let the handler use `key`:

```sbmx
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

```sbmx
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

```sbmx
::: props amount: Int, tone: String
:::

::: span class=badge
{{ tone }}: {{ to_string(amount) }}
:::
```

`Page.sbmx`:

```sbmx
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

::: Badge amount={{ model.unread }} tone=unread
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

## …fetch something?

Two functions. One says what to go and do, the other receives whatever comes back:

```sbmx
===bx
use "std/string.bx";

class Model { items: Int, status: String }
enum Msg { Refresh, Other }

pure function update(msg: Msg, m: Model) -> Model {
    match msg {
        Refresh => { return Model { items: m.items, status: "loading" }; }
        Other   => { return m; }
    }
}

pure function commands(msg: Msg, m: Model) -> [StarCmd] allocates {
    let mutable out: [StarCmd] = [];
    match msg {
        Refresh => { let a: Int = push(out, StarCmd.Fetch(7, "/api/feed")); }
        Other => { }
    }
    return out;
}

pure function arrived(tag: Int, value: String, m: Model) -> Model {
    if tag == 7 { return Model { items: string_to_int(value, 0), status: "ready" }; }
    return m;
}
===
```

**The `7` is yours.** You pick the tags, so nothing has to know the handler numbers star assigns —
and they move when you add a button.

There is no `await`, and you do not need one: the browser is already the event loop. An update says
what the next state is, `commands` says what to go and do about it, and the reply is an ordinary
event. **A failed fetch is still an answer**, delivered with an empty body, so a page cannot get
stuck in `loading` with nothing ever arriving.

You can also `Send` a body, `Focus` an element, `Store` and `Load` across reloads, `Go` to a path,
and `Cancel` anything in flight.

## …run something on a timer, or watch for a key?

Say what you want to be listening to, as a function of your state:

```sbmx
===bx
class Model { polling: Bool }

pure function watch(m: Model) -> [StarWatch] allocates {
    let mutable out: [StarWatch] = [];
    if m.polling { let a: Int = push(out, StarWatch.Every(7, 5000)); }
    let b: Int = push(out, StarWatch.Key(9, "Escape"));
    return out;
}
===
```

The driver compares this with what is already running and starts or stops the difference. **So
stopping a timer is a state change** — set `polling` to false and it stops.

There is no `onMounted`, no cleanup function to forget, and no way to leak a listener: what is
running is whatever your current state asks for.

Timers, keys and websockets all arrive at `arrived`, under your tag.

## …render on the server?

Give your component a `load`, and its **signature** is what makes it server-only:

```sbmx
===bx
class Model { user: String, unread: Int }

function load(request: String) -> Model touches network, files {
    // …reach a database, read a file, call an API…
    return Model { user: request, unread: 0 };
}
===
```

Generating emits a `page_serve(request) -> String` that returns the whole page with the state
embedded in it, so the browser picks up **the same value** rather than fetching it again:

```html
<div id="root">…your rendered page…</div>
<script type="application/json" id="star-state">{"user":"ada","unread":3}</script>
```

**A view cannot fetch, and that is checked rather than promised.** A view is `pure`, and a `pure`
function may not call anything impure — so this does not compile:

```
error: `pure function view` may not call `db_lookup`, which crosses into C:
a pure function's result must depend only on its arguments.
```

That is the single largest bug class in server-rendered React, refused by the compiler.

**And server code does not reach the browser.** Not by a bundler rule — the client's entry points
never call `load`, so the linker drops it, its string data and the network import it made. Measured:
a password inside `load` is present in the wasm object file and absent from the linked module. It is
checked on every push, with a control that proves the check can find things.

## …run a real app in a browser?

Give your component a way to carry its state as text, and the driver does the rest:

```sbmx
===bx
use "std/json.bx";

class Model { count: Int }

pure function to_text(m: Model) -> String allocates {
    let mutable f: [Field] = [];
    let a: Int = push(f, json_field("count", json_int(m.count)));
    return json_render(json_object(f));
}

// Your own fallback for a value that is not there — star does not choose one for you.
function from_text(text: String) -> Model {
    let mutable count: Int = 0;
    match json_parse(text) {
        Error(e) => { }
        Ok(v) => {
            match json_at(v, "count") {
                None => { }
                Some(x) => { match json_as_int(x) { None => { } Some(n) => { count = n; } } }
            }
        }
    }
    return Model { count: count };
}
===
```

Then:

```html
<script type="module">
  import { mount } from './app.js'
  mount({ wasm: 'app.wasm', root: document.getElementById('root'), component: 'app' })
</script>
```

**Why you have to write those two.** Nothing in Burxt holds state between two calls — a function
sees its arguments and nothing else, which is what lets the compiler promise a view reaches nothing.
So the host keeps the model and hands it back, and text is what can cross today.

It is a real cost, and it is the one thing on this page that exists because of a gap rather than a
decision. When the language grows a value the host can hold as-is, these two go away and nothing
else changes.

## …build a page with several screens?

Make the route an `enum`, derive it from the path, and `match` on it:

```sbmx
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
