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
:props: total: Decimal<2>
:!props:

Total: {{ to_string(total) }}
```

`Decimal<2>` is exactly two decimal places, always. See [chapter 5](guide/05-money.html) for what
happens when you multiply one.

## …make a button do something?

```sbmx
:button: on:click=count + 1
increment
:!button:
```

The part after `=` is **the new value**, not code that changes something. `on:click=0` sets it to
zero.

## …read what someone typed?

```sbmx
:input: on:input=name
:!input:
```

## …submit a form?

```sbmx
:form: on:submit=draft

:input: on:input=draft
:!input:

:button: on:click=draft
save
:!button:

:!form:
```

## …show a list?

```sbmx
:for: line in lines key line.id

:li:
{{ line.label }}
:!li:

:!for:
```

Always give `key` something that identifies the item. See
[chapter 4](guide/04-lists-and-choices.html).

## …hide something until it is ready?

```sbmx
:if: ready

:p:
Everything is set.
:!p:

:!if:
```

There is no `else`. Write a second `:if:` for the other case.

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
:div: class=card
:!div:

:span: class="tag muted"
draft
:!span:
```

A value with spaces is quoted. A bare name is a boolean attribute — `:input: disabled`.

## …build a link from my data?

Interpolate the value:

```sbmx
:a: href=/posts/{{ to_string(post.id) }}
read more
:!a:
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

:props: model: Model
:!props:

:button: on:click=Msg.Increment
more
:!button:
```

## …put a button on each row?

Key the loop, and let the handler use `key`:

```sbmx
:for: todo in model.todos key to_string(todo.id)

:li:

:button: on:click=Msg.Toggle(string_to_int(key, 0))
{{ todo.label }}
:!button:

:!li:

:!for:
```

**`key` is the row's identity, as text.** A DOM attribute is text, so it arrives as a `String` and
you convert — `string_to_int(key, 0)` for a number.

**What you cannot do is name the loop variable in the handler:**

```sbmx
:for: todo in model.todos key to_string(todo.id)

:button: on:click=Msg.Toggle(todo.id)
{{ todo.label }}
:!button:

:!for:
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
:props: amount: Int, tone: String
:!props:

:span: class=badge
{{ tone }}: {{ to_string(amount) }}
:!span:
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

:props: model: Model
:!props:

:Badge: amount={{ model.unread }} tone=unread
:!Badge:
```

Generating `Page.sbmx` generates `Badge.sbmx` too, beside its own source. One command.

**A prop you forget is named**, along with what the component wants:

```
STAR-E017: `Badge` needs `tone`, and this call does not give it.
Its props are `value: Int, tone: String`
```

And the order you write them in does not matter — arguments are passed in the order the component
declares them, so two props of the same type cannot swap by accident.

## …use a component somebody else published?

Two kinds of thing can come from a package, and they have different answers.

**A Burxt library works today, and its author need not have heard of star.** Anyone can publish
ordinary Burxt — money rules, validation, a domain type. Declare it and use it from your `===bx`
section:

```
name        my-app
version     0.1.0

dependency  star   https://github.com/andrecorugda/star-burxt  v0.2.0
dependency  bmx    https://github.com/andrecorugda/bmx         burxt-0.12.1
dependency  mylib  https://github.com/someone/mylib            v1.0.0
```

Then `use "mylib/money.bx";` alongside your other imports, and call what it exports. star passes that
line through to the generated component untouched, so the compiler resolves it the way it resolves any
import — there is no star-specific step and nothing to register.

**A component library is the same shape, one level up.** The author writes ordinary components and
publishes the repository:

```sbmx
:props: label: String
:!props:

:span: class=card
{{ label }}
:!span:
```

You then write `use "mylib/Card.sbmx";` and call `:Card: label={{ model.title }}` exactly as if the
file were yours. Its props are checked at your call site — a missing one is the same **STAR-E017** you
get for a local component, naming the component and what it declares.

What star does with it is worth knowing, because you will see the files. A packaged component is
generated into **`.star/mylib/Card.bx` in your tree**, never inside the fetched package — a package
directory is a cache keyed by the dependency's url and tag, so anything written there is thrown away
the day you bump the version. Add `.star/` to your `.gitignore`; it is build output, like the `.bx`
beside a local `.sbmx`.

> **This one needs a compiler that lists `burxt where` in its usage.** star finds the package by asking
> that command, because where a dependency sits on disk is derived from its source and is not something
> star may guess. Run `burxt` with no arguments to see whether yours has it — no version number here,
> because it is not in a release yet and a number written before the tag exists is a number that will be
> wrong.
>
> Without it, a package-qualified import is read as a path and refused, and star says which of the two
> things went wrong rather than making you guess: *"names a package, and this `burxt` cannot resolve one
> — its usage does not list `burxt where`"* for an old compiler, and the compiler's own *"`nosuch` is not
> a dependency of `my-app`"* when the name is simply undeclared. Those need opposite fixes. The
> Burxt-library half above has no such requirement.

## …see what my document turned into?

```sh
./star-generate page.sbmx page
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

### Polling — `after`

**A tick that should re-fetch needs `after`, and a tick must not be pointed at a fetch's tag.**

```sbmx
===bx
class Model { polling: Bool }

pure function watch(m: Model) -> [StarWatch] allocates {
    let mutable out: [StarWatch] = [];
    if m.polling { let a: Int = push(out, StarWatch.Every(8, 5000)); }   // 8 is the POLL
    return out;
}

// What to do after something arrived. `commands` takes a `Msg`, and a reply is not one.
pure function after(tag: Int, m: Model) -> [StarCmd] allocates {
    let mutable out: [StarCmd] = [];
    if tag == 8 { let a: Int = push(out, StarCmd.Fetch(7, "/api/feed")); }   // 7 is the REPLY
    return out;
}
===
```

**This is here because the example on this site was wrong for as long as the page existed.** It pointed
its timer at the fetch's tag, so every tick arrived at `arrived` with an **empty** body — and
`string_to_int("", 0)` set the items to zero. Measured: 42 before a tick, 0 after. A live feed that
blanked itself every five seconds.

Two rules come out of it. **A tick carries no value**, so anything that parses `value` as a body will
destroy what it had — give the poll its own tag and leave the items alone. And **`after` is the only way
a subscription can ask for anything**, because `commands` is keyed on a `Msg` and nothing that arrives
has one.

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

## …use Tailwind, Bootstrap or Ant Design?

You just use them. **star never reads a class name** — `class=` is an attribute, its value is a string,
and nothing in the framework inspects it. There is no plugin, no config, and nothing to integrate:

```sbmx
:button: class="px-4 py-2 rounded-lg bg-indigo-600 text-white" child=Save on:click=Msg.Save :!button:
```

A head is one line, so a long list of utilities is a long line. That is the honest cost of the utility
style and it is the same in JSX.

**One rule, and it is the one that bites:** more than one class means **quotes**.

Right:

```sbmx
:div: class="card shadow-sm p-4" child=x :!div:
```

Refused:

```sbmx
:div: class=card shadow-sm p-4 child=x :!div:
```

> STAR-E026 `shadow-sm` has no value, so it stands for a boolean attribute

An unquoted value ends at the first space, so the unquoted form is one class plus two boolean attributes.
That used to happen silently and the extra classes were simply lost; it is refused by name now, which
matters most for utility CSS, where four classes on an element is ordinary.

Whether the framework's stylesheet arrives from a CDN, a build step or your own file is your page's
business — the same as it would be in any other project. `examples/theme.css` is what this repository's
own examples use, and it is nothing more than a stylesheet: tokens, dark mode, and a few component
classes. Swap it for Tailwind's output and every component keeps working, because the split between *what
makes this component itself* (`===style.local`, scoped by star) and *what the page decides* (type, colour,
spacing) is the same split those frameworks already make.

## …use star as the front end of Laravel, Rails or Django?

Two things, and neither needs your backend to know what star is.

**1. Render the first paint on the server.** `--fragment` builds a native binary: state JSON in on
stdin, that component's HTML out on stdout. Nothing else — no doctype, no head, no script tag,
because your layout already has all three.

```sh
star-generate Poster.sbmx poster --fragment > render.bx
burxt build render.bx -o bin/poster-render
echo '{"status":"idle"}' | bin/poster-render
```

Any backend that can run a subprocess can call it. In Laravel:

```php
$state = ['status' => 'idle'];
$html = Process::input(json_encode($state))->run(base_path('bin/poster-render'))->output();

return view('page', ['state' => $state, 'rendered' => $html]);
```

```
<div id="root">{!! $rendered !!}</div>
<script type="application/json" id="star-state">@json($state)</script>
```

**One value, used twice** — the server renders from it and the page hands the same text to the
browser. That is what makes a hydration mismatch impossible rather than unlikely, and it is checked
on every push: the native binary and the wasm module must produce the **same bytes** from the same
state.

**Without this the page is blank until the wasm arrives** — 54 KB of module plus 28 KB of driver
before the first pixel. That gap is the flash, and it is not reactivity: a plain React or Vue SPA has
exactly the same one. Next, Nuxt and Inertia render first and hydrate after; Alpine avoids it by never
being the thing that produces the HTML.

**2. Put the CSRF token in the page and stop thinking about it.** A `StarCmd.Send` goes out as
`application/json`, asks for JSON back, and carries whatever token the page is holding:

| where you put it | what star sends | who does this |
|---|---|---|
| `<meta name="csrf-token">` | `X-CSRF-TOKEN` | Laravel (`web`), Rails |
| cookie `XSRF-TOKEN` | `X-XSRF-TOKEN` | Laravel Sanctum, Spring |
| cookie `csrftoken` | `X-CSRFToken` | Django |

Anything else — ASP.NET's `RequestVerificationToken`, a bearer token, a tenant id — goes to `mount`:

```js
await mount({ wasm, root, component: 'poster', initial, reconcile,
              headers: { 'Authorization': 'Bearer ' + token },
              credentials: 'include' });   // only when the API is on another origin
```

**The token never reaches your component, and that is deliberate.** It belongs to the session, not to
your state — a component that received one would carry a field about the transport, and then every
component would. The page is already where framework knowledge lives.

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

:props: model: Model
:!props:

:match: model.route

:case: Home
# Welcome
:!case:

:case: Post(id)
# Post {{ to_string(id) }}
:!case:

:case: Missing
:p:
Nothing at {{ model.path }}
:!p:
:!case:

:!match:
```

Copy `examples/router.js` beside your page. It intercepts in-page links, handles the back button,
and hands the path in.

**Your links are real markup** — `:a: href=/posts/42` — so they work before any JavaScript runs
and the driver only upgrades them.

And because the route is an `enum` matched exhaustively, **adding a screen and forgetting to draw it
fails the build** rather than showing a blank page.

## …find out why it refused something?

Every refusal is listed with its fix on **[When it says no](refusals.html)**.

{% endraw %}
