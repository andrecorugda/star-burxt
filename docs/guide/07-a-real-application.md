---
layout: default
title: A real application
section: guide
description: "Several files, state that survives, fetching, routing, and a server."
---

{% raw %}

# 7. A real application

Chapters 1 to 6 built screens. This one builds an application: more than one file, state that lasts
longer than a click, data that arrives late, and a server.

Every example on this page is generated **and compiled** by the project's own tests, so what you read
here is what runs.

## Two names the framework knows

A component with a `===bx` section keeps its state in a `Model` and its events in a `Msg`:

```sbmx
===bx
class Model { count: Int }
enum Msg { Increment, Reset }

pure function update(msg: Msg, m: Model) -> Model {
    match msg {
        Increment => { return Model { count: m.count + 1 }; }
        Reset     => { return Model { count: 0 }; }
    }
}
===

:props: model: Model
:!props:

Count: {{ to_string(model.count) }}

:button: on:click=Msg.Increment
more
:!button:
```

Those two names are fixed, and there is nothing else to name. `update` takes a `Msg` and a `Model` and
returns the next `Model` — one function, one `match`, one branch per thing that can happen.

## One component uses another

A component is a file, and you reach one by saying where it is:

```sbmx
===bx
use "./Badge.sbmx";

class Model { count: Int }
enum Msg { Nothing }

pure function update(msg: Msg, m: Model) -> Model { return m; }
===

:props: model: Model
:!props:

:Badge: amount={{ model.count }} tone=unread
:!Badge:
```

Three rules, and they are the whole system:

**The file name is the component name.** `Badge.sbmx` is `Badge`. There is no registry to add it to.

**Its props are checked where you use it.** Miss one and you are told which, by name, before anything
runs — not with an empty space on the page at four in the afternoon.

**Props are passed by name**, in any order, and nothing is silently dropped.

## Styles that stay where you put them

A `===style.local` section is CSS for this component only:

```sbmx
===style.local
.total { font-variant-numeric: tabular-nums; font-weight: 600; }
.total:hover { text-decoration: underline; }
===

:props: count: Int
:!props:

:span: class=total
{{ to_string(count) }}
:!span:
```

`.total` here cannot reach a `.total` in another file. **Nothing is scoped by convention** — the
generator rewrites the selectors and marks the elements, so a name you chose in one file is yours.

`===style.global` is the other choice, and it means what it says: page-wide, for a reset or a font.
There is no third option and no ordering to reason about — a component's own CSS always wins over the
global sheet.

**Generating writes the stylesheet for you.** `Badge.sbmx` produces `Badge.css`, with the local rules
already scoped, and one `@import` per component it uses. Nothing links it by hand — a served page
links it for you, because star knows the name.

**You can also use a CSS library.** Put its stylesheet in your page and use its class names; `class=`
is a normal attribute. star does not wrap, re-export, or bless a library, so there is nothing to keep
up to date when the library changes.

## State that survives

A component in a browser is called many times, and Burxt keeps nothing between two calls. So state
travels as text, and you write the two functions that convert it:

```sbmx
===bx
use "std/json.bx";

class Model { count: Int }
enum Msg { Nothing }

pure function update(msg: Msg, m: Model) -> Model { return m; }

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

It is two functions and it is honest: your state is a value you can print, save, send to a server, or
paste into a bug report. **This is a gap rather than a decision** — when the page can hold a value for
you these two go away, and nothing else about your component changes.

## Data that arrives later

Nothing waits. You do not write `await`, and there is no such thing as a half-finished render.

You say **what should be in flight**, and star tells you when it arrived:

```sbmx
===bx
use "std/string.bx";

class Model { items: Int, status: String }
enum Msg { Refresh, Nothing }

pure function update(msg: Msg, m: Model) -> Model {
    match msg {
        Refresh => { return Model { items: m.items, status: "loading" }; }
        Nothing => { return m; }
    }
}

pure function commands(msg: Msg, m: Model) -> [StarCmd] allocates {
    let mutable out: [StarCmd] = [];
    match msg {
        Refresh => { let a: Int = push(out, StarCmd.Fetch(7, "/api/items")); }
        Nothing => { }
    }
    return out;
}

pure function arrived(tag: Int, value: String, m: Model) -> Model {
    if tag == 7 { return Model { items: string_to_int(value, 0), status: "ready" }; }
    return m;
}
===
```

**The `7` is yours.** You choose the tags, so nothing in your code has to know the handler numbers
star assigns — and those move when you add a button.

`StarCmd` is the whole list of what you can ask for: `Fetch` a URL, `Send` a body, `Focus` an element,
`Store` and `Load` across reloads, `Go` to a path, and `Cancel` what is in flight.

Two things follow, and both are worth knowing:

**A failed fetch is still an answer.** It arrives with an empty body, so a page cannot sit in
`loading` forever with nothing ever coming back.

**Two clicks cannot race.** Each click produces a state, the state says what should be in flight, and
what is no longer wanted is dropped. You never cancel anything, because you never started anything.

## Things that keep happening

A timer, a key, or a websocket works the same way — describe the ones your state wants:

```sbmx
===bx
class Model { polling: Bool }
enum Msg { Nothing }

pure function update(msg: Msg, m: Model) -> Model { return m; }

pure function watch(m: Model) -> [StarWatch] allocates {
    let mutable out: [StarWatch] = [];
    if m.polling { let a: Int = push(out, StarWatch.Every(7, 5000)); }
    let b: Int = push(out, StarWatch.Key(9, "Escape"));
    return out;
}
===
```

Turn `polling` off and the timer stops. **There is no cleanup function to forget**, because there was
nothing to remember: a subscription lives exactly as long as the state that asks for it. Everything it
delivers arrives at `arrived`, under your tag.

## More than one screen

Routing is a `match` on a field you keep yourself:

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

:props: model: Model
:!props:

:nav:

:a: href=/
home
:!a:

:a: href=/posts/42
a post
:!a:

:!nav:

:match: model.route

:case: Home

# Welcome

:!case:

:case: Post(id)

# Post {{ to_string(id) }}

:!case:

:case: Missing

Nothing at {{ model.path }}

:!case:

:!match:
```

**Forget a route and the build fails**, naming the one you left out. That is the difference between a
`match` and a table of paths: a table cannot tell you what is missing from it.

A route is your own enum, so `Post(Int)` carries a parsed number rather than a string you re-parse in
four places. The address bar is handled for you — a link changes the URL without reloading, and the
back button produces a message like any other event.

## The server half

One function makes a component render on the server:

```sbmx
===bx
class Model { user: String, unread: Int }
enum Msg { Nothing }

pure function update(msg: Msg, m: Model) -> Model { return m; }

function load(request: String) -> Model touches network, files {
    // …reach a database, read a file, call an API…
    return Model { user: request, unread: 0 };
}
===
```

`load` may touch the network and the disk. **A view may not**, and that is checked rather than
encouraged: a view is `pure`, and a `pure` function cannot call anything impure. So a database call in
a view does not compile —

```
error: `pure function view` may not call `db_lookup`, which crosses into C:
a pure function's result must depend only on its arguments.
```

— which is the single largest bug class in server-rendered React, refused by the compiler.

Generating gives you a `serve(request) -> String`, and it returns **the whole document** — not a
fragment you paste into a page you wrote. The `<head>`, your component's stylesheet, the rendered
body, the state, and the lines that start the driver:

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ada — unread</title>
<link rel="stylesheet" href="./page.css">
</head>
<body>
<div id="root">…your rendered page…</div>
<script type="application/json" id="star-state">{"user":"ada","unread":3}</script>
…
```

The state travels with the page, so the browser picks up **the same value** instead of fetching it
again — which is the hydration mismatch this design does not have.

**What goes in the `<head>` is yours, and it is a function of the state.** Write a `head` and it is
asked for a list of elements:

```sbmx
===bx
class Model { user: String }
enum Msg { Nothing }

pure function update(msg: Msg, m: Model) -> Model { return m; }

pure function head(m: Model) -> [Html] allocates {
    let mutable top: [Html] = [];
    let a: Int = push(top, html_element("title", [], [html_text(m.user + " — inbox")]));
    return top;
}

function load(request: String) -> Model touches network, files {
    return Model { user: request };
}
===
```

A title that depends on the state is the whole reason it is a function. Leave `head` out and you
still get the charset, the viewport and your stylesheet — everything star can know by itself.

And the part worth being precise about, because it is the strongest thing star-burxt claims:

> **Server code cannot reach the browser.** Not by a bundler rule and not "should not" — the client's
> entry points never call `load`, so the linker drops it, its strings, and the network import it made.
> Measured: a password inside `load` is present in the object file and absent from the linked module,
> checked on every push, with a control that proves the check can find things.

You get server rendering out of it. The reason to care is the other direction: the line between what
your server knows and what you ship is drawn by the compiler, not by which folder a file is in.

## Where you are

| | |
|---|---|
| several files | `use "./Badge.sbmx"`, props checked by name |
| styling | `===style.local`, scoped for real |
| state | one `Model`, and two functions that make it text |
| fetching | `commands` — describe it, never cancel it |
| timers, keys, sockets | `watch` — nothing to clean up |
| screens | `match` on a route, exhaustive |
| the server | `load`, and a boundary the compiler holds |

## You have finished the tour

- **[How do I…?](../how-do-i.html)** — short answers to the next ten things you will want
- **[When it says no](../refusals.html)** — every refusal, with what to write instead
- **[What's not built yet](../not-done.html)** — read this before choosing star-burxt for real work

{% endraw %}
