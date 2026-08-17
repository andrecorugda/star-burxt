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

## …put a class on an element?

Not yet — attributes other than events are not supported. Style by element and by structure for
now, or wrap the component in your own markup. This is on
[what's not built yet](not-done.html).

## …use several pieces of state?

The component's state is its **first** prop, so make that one value hold everything that changes:

```
::: props draft: Draft, options: [Choice]
:::
```

`draft` changes; `options` is given to the component and stays put.

## …delete one row from a list?

Not yet — a button inside a `for` is refused, and
[chapter 4 explains why](guide/04-lists-and-choices.html). Today, drive the change from the whole
list: a "clear completed" button outside the loop works.

## …split a screen into several components?

Generate each document separately and call one from another. Each `.bmx` file becomes an ordinary
function, so a component is used the way any function is used.

## …see what my document turned into?

```sh
./star-generate page.bmx page
```

It prints the component. Reading it is encouraged — there is nothing in there you did not write.

## …find out why it refused something?

Every refusal is listed with its fix on **[When it says no](refusals.html)**.

{% endraw %}
