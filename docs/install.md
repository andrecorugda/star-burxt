---
layout: default
title: Set up
description: "Three steps before chapter one: install Burxt, make a project, build the generator."
---

{% raw %}

# Set up

Three steps. Ten minutes, most of it waiting for a download.

star-burxt is written in **Burxt**, so Burxt is the one thing you install — the way you install PHP
before Laravel, or Node before React. After that, star-burxt is a line in your project file.

## 1. Install Burxt

Follow [burxt-lang.org/install](https://burxt-lang.org/install.html). Then check it worked:

```sh
burxt --version
```

**Burxt 1.3.0 or newer.** Earlier releases refuse two things every component does — an update
function returning a record that holds a list, and a `pure` function calling the JSON encoder — so a
component will not compile against 1.2.0 or below. A released version is all you need; there is
nothing to build from source.

## 2. Make a project

A project is a folder with a file called `burxt.package` in it:

```
name        my-app
version     0.1.0

dependency  star  https://github.com/andrecorugda/star-burxt  main
dependency  bmx   https://github.com/andrecorugda/bmx         burxt-0.5.1
```

Then:

```sh
burxt fetch
```

That downloads both and writes `burxt.lock`. **Keep `burxt.lock`** — it is what makes your
teammate's build match yours.

> **Why two lines and not one.** star-burxt uses BMX to read your documents, and a Burxt project
> names everything it uses, including what its own libraries use. If you forget the second line you
> will see this, and it is not a mistake in your code:
>
> ```
> error: cannot read .../bmx/burxt/bmx.bx: No such file or directory
> ```
>
> Add the line and it goes away.
>
> **`burxt-0.7.1` is not a typo for the format's version.** BMX the *format* has its own number; that
> tag names the Burxt implementation of it, which is a separate thing released on its own schedule.

## 3. Build the three commands

They are Burxt programs, and you build them once:

```sh
git clone https://github.com/andrecorugda/star-burxt && cd star-burxt
burxt build examples/generate.bx -o star-generate
burxt build examples/check.bx    -o star-check
burxt build examples/build.bx    -o star-build
```

| the command | what it is for |
|---|---|
| `star-check counter.sbmx` | every problem in one place — **use this while you write** |
| `star-build counter.sbmx counter` | document → component → `.wasm`, one command |
| `star-generate counter.sbmx counter` | just the component, printed |

`star-generate` prints the component it made, and **you are meant to read that output.** Nothing is
hidden in it, and watching your document turn into ordinary code is the quickest way to see what
star-burxt does for you.

## That's it

**[Chapter 1: Your first component →](guide/01-your-first-component.html)**

---

### If something goes wrong

**`pure function view may not call html_element…`** — your Burxt is too old. Step 1.

**`cannot read .../bmx/burxt/bmx.bx`** — the second `dependency` line is missing. Step 2.

**`main is a name the language owns`** — a Burxt program is just statements, top to bottom. Delete
the `function main() {` wrapper and un-indent what was inside it.

{% endraw %}
