---
layout: default
title: Buttons and events
section: guide
description: "Clicks, typing, and how a component remembers."
---

{% raw %}

# 3. Buttons and events

Now make it do something.

## A button that changes the page

```
::: props count: Int
:::

# Counter

The count is {{ to_string(count) }}.

::: button on:click=count + 1
increment
:::
```

<figure class="shot">
  <img src="../assets/examples/counter-running.png"
       alt="The counter document beside the same document running in a browser, showing 'The count is 3.'">
  <figcaption>The right-hand side is this document, clicked three times.</figcaption>
</figure>

**`on:click=count + 1`** reads as *when this is clicked, the count becomes count plus one*.

That is the whole model, and it is worth pausing on because it is different from what you may be
used to:

> **You do not write code that changes something. You write what the new value is.**

There is no `setState`, no `this.count++`, no store to reach into. The old value goes in, the new
value comes out. If you can read the expression, you know what the button does.

## Two buttons

```
::: button on:click=count + 1
increment
:::

::: button on:click=count - 1
decrement
:::

::: button on:click=0
reset
:::
```

`on:click=0` is a button that sets the count to zero. Not *decrements to* zero — **is** zero. Once
you see handlers as "the next value", the reset button stops needing a special case.

## Typing in a box

```
::: props name: String
:::

# Hello {{ name }}

::: input on:input=name
:::
```

`on:input=name` means *the new value is whatever was typed*. As you type, the heading follows.

## The events you can use

Most of them.

**Pointer and mouse** — `click` `dblclick` `contextmenu` `pointerdown` `pointerup` `pointermove`
`pointerenter` `pointerleave` `mousedown` `mouseup` `mouseenter` `mouseleave` `mouseover` `mouseout`

**Keyboard** — `keydown` `keyup`

**Forms** — `input` `change` `submit` `reset` `focus` `blur` `focusin` `focusout`

**Dragging** — `dragstart` `dragover` `dragleave` `drop` `dragend`

**Touch** — `touchstart` `touchmove` `touchend`

**Scrolling** — `wheel` `scroll`

**Animation** — `animationstart` `animationend` `animationiteration` `transitionstart`
`transitionend`

Ask for one that is not there and you are told, with what to write instead:

```
`on:hover` is not an event this host can wire. There is no `hover` event —
hovering is CSS. Use `:hover` in a `===style.local` section, or
`on:mouseenter` and `on:mouseleave` if the hover has to change your state.
```

**star refuses an event it cannot deliver, rather than accepting it and doing nothing.** A handler
that never runs is the worst failure a page can have — nothing is broken, nothing is logged, and you
stare at the screen wondering what you got wrong.

## Your handlers are checked

Try to add text to a number:

```
::: button on:click=count + "one"
increment
:::
```

```
cannot apply `+` to Int and String
```

Misspell your own prop:

```
::: button on:click=cont + 1
increment
:::
```

```
unknown variable: cont
```

**This is the part no other framework does.** Everywhere else, what happens on a click is a function
that nobody looks inside until it runs. Here it is checked with the rest of your document, and a
broken button is a message rather than a bug report.

## One thing state cannot be yet

A component's state is its **first** prop. So this works:

```
::: props count: Int
:::
```

and a handler yields the next `count`. If you need several fields to change, put them in one value
and give the component that — chapter 6 shows the shape.

## What you have

- `on:click=` and `on:input=` take an **expression for the next value**
- most DOM events, including the keyboard, the pointer, dragging and animation
- the expression is checked like the rest of your code
- state is the first prop

**[Chapter 4: Lists and choices →](04-lists-and-choices.html)**

{% endraw %}
