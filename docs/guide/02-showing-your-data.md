---
layout: default
title: Showing your data
section: guide
description: "Props, slots, and the elements you can wrap things in."
---

{% raw %}

# 2. Showing your data

Chapter 1 put one value on a page. This chapter is about the rest of what a page shows.

## More than one prop

List them one per line:

```
::: props name: String, greeting: String, unread: Int
:::

# {{ greeting }} {{ name }}

You have {{ to_string(unread) }} messages.
```

**`to_string`** is there because a slot puts *text* in the page, and `unread` is a number. Text goes
in as it is; anything else you convert. It is a small tax and it is the reason a number can never
quietly become `"[object Object]"`.

## Kinds of value

| You write | It means |
|---|---|
| `name: String` | text |
| `unread: Int` | a whole number |
| `ready: Bool` | true or false |
| `total: Decimal<2>` | money — two decimal places, exactly ([chapter 5](05-money.html)) |
| `items: [Line]` | a list of things ([chapter 4](04-lists-and-choices.html)) |

## Wrapping things in elements

A `:::` block with an element name wraps whatever is inside it:

```
::: section

# Today

Three things happened.

:::
```

You have these to reach for:

**Layout** — `div` `section` `article` `header` `footer` `nav` `form`

**Text** — `p` `span` `strong` `em` `label` `h1` to `h6`

**Lists** — `ul` `ol` `li`

**On their own** — `input` `img` `br` `hr`

**Buttons** — `button` ([chapter 3](03-buttons-and-events.html))

Anything else is refused by name, so a typo in an element is a message rather than a page that
quietly lost a section.

## Markdown still works everywhere

Inside a block or outside it, the ordinary things do the ordinary thing:

```
::: article

## Notes

We are **on track** for the *first* of the month.

- shipped
- tested
- documented

> Nothing outstanding.

:::
```

Headings, bold, italic, lists, quotes, links, `code`. You do not need a component for a paragraph.

## One rule about nesting

Some elements hold text, and some hold sections. `button`, `label`, `span`, `strong`, `em` and the
headings hold **text**; everything else holds **anything**.

Put a heading inside a button and you are told:

```
`button` takes phrasing content, so it cannot contain a heading
```

That is HTML's rule, not star-burxt's — a heading inside a button is invalid markup and browsers do
unpredictable things with it. You get told instead.

## What you have

- several props, one per line, separated by commas
- `to_string` for anything that is not already text
- elements to wrap things in, and the list is short enough to remember
- Markdown for everything a document normally has

**[Chapter 3: Buttons and events →](03-buttons-and-events.html)**

{% endraw %}
