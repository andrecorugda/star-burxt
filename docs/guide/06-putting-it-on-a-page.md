---
layout: default
title: Putting it on a page
section: guide
description: "From a component to something a browser opens."
---

{% raw %}

# 6. Putting it on a page

You have a component. Now put it on a screen somebody can click.

## One command

```sh
./star-build counter.sbmx counter
```

It prints `./counter.wasm`, and that is the whole build. Three things happened: your component became
Burxt, the Burxt became a WebAssembly object, and the object was linked.

You do not have to know the third step to use it, and you should not have to — **which entry points a
component exports depends on what it does.** One that fetches exports something one that does not
must not, because the function would not exist. `star-build` reads your component and works it out.

It is itself a Burxt program, `examples/build.bx`, which is worth saying out loud: the tools that
build star-burxt are written in the language star-burxt is for.

> **You do not need to install anything for this.** The linker ships with Rust, which you already
> have from installing Burxt.

## The page

Copy `examples/index.html` and `examples/app.js` from the star-burxt repository next to it, serve the
folder, and open it:

```sh
python3 -m http.server 8000
```

`app.js` is the part that puts your component's output into the page and hands events back. **It
holds nothing about your app** — copy it once per project and leave it alone.

**You do not write the page.** A component with a `load` produces its own — `<head>`, its stylesheet,
the state, and the four lines that start the driver — which chapter 7 covers. For a browser-only
component, `examples/index.html` is a page you copy once.

## What you get

- **about 8 KB**, everything included. For comparison, React with ReactDOM is around 45 KB before
  you have written a line.
- **no build config.** No bundler, no plugin list, no transform order to get right.
- **nothing executable in your markup.** A button reaches the page as a number, and one listener
  handles all of them, so there is no inline script anywhere on the page.
- **the same output on the server and in the browser**, exactly, because both run the same compiled
  component. A page rendered ahead of time and the same page after it wakes up cannot disagree.

## Checking it before you build it

```sh
./star-check counter.sbmx
```

Use this while you write. It is faster than a build and it reports the same three kinds of problem —
a malformed document, something that is not a component, and a type error in your own code.

## Where to go now

You have finished the basics: values, elements, buttons, typing, lists, conditions, and money that
stays exact. **Chapter 7 is where it becomes an application** — several files, state that survives,
fetching, and a server.

- **[7. A real application](07-a-real-application.html)** — components, styles, fetching, routing
- **[How do I…?](../how-do-i.html)** — short answers to the next ten things you will want
- **[When it says no](../refusals.html)** — every refusal, with what to write instead
- **[What's not built yet](../not-done.html)** — read this before choosing star-burxt for real work

{% endraw %}
