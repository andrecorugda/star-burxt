---
layout: default
title: In your editor
description: "Syntax colour and live refusals for .sbmx documents in VS Code — how to install the star-burxt extension and what it does."
---

# In your editor

`.sbmx` documents get **colour** and **live refusals** in VS Code: the same errors `star-check` prints, on the
line that caused them, as you type.

## What the file tree looks like

Each of the three file types has its own icon, and the `b` in each is Burxt's own logo doing duty as a letter —
a subproject is not a separate identity with a family resemblance, it is that letter inside its own name. The
bare `b` belongs to Burxt alone, so `.bmx` gets a document with the `b` in it and `.sbmx` gets a gear.

<figure class="tree">
  <div class="tree-rows">
    <div class="tree-row"><img src="{{ site.baseurl }}/assets/brand/burxt-bx-icon-128.png?v={{ site.time | date: '%s' }}" alt="" width="16" height="16"><span>main.bx</span></div>
    <div class="tree-row"><img src="{{ site.baseurl }}/assets/brand/bmx-file-icon-48.png?v={{ site.time | date: '%s' }}" alt="" width="16" height="16"><span>shop.bmx</span></div>
    <div class="tree-row"><img src="{{ site.baseurl }}/assets/brand/sbmx-gear-icon-48.png?v={{ site.time | date: '%s' }}" alt="" width="16" height="16"><span>Card.sbmx</span></div>
  </div>
  <figcaption><strong>An illustration, not a screenshot.</strong> The three icons are the files the extensions
  actually register — VS Code loads <code>icons/sbmx-gear-icon-128.png</code> for <code>.sbmx</code> — shown at
  the 16px box an explorer row gives them. The rows around them are drawn here.</figcaption>
</figure>

**16px is the size that matters**, and showing it larger would hide the thing the icons were fixed for: the
first `.bx` icon filled 86% of its box and sat against the filename with four clear pixels at 48px. All three
are cropped to their ink and centred at **70%** now, which is checked rather than promised — `editors/vscode/config.mjs`
decodes each PNG and fails outside 70% ± 3, and pointing it at the un-cropped source reports 86%.

## What you get

- **Colour for `.sbmx`** — the fences, the block names, a slot's expression, the `===bx` and `===style`
  sections, and Burxt inside them. The same classes the site's own snippets use, so a keyword looks the same
  in both places.
- **Refusals as you type** — `star-check` runs over the document and its diagnostics land on the line that
  caused them, including inside a `===bx` section.
- **Folding** that knows `:name:` opens and `:!name:` closes, and that a one-liner closes itself.

## Installing it

The extension is not on the Marketplace yet, so it is installed from the repository. Copy it or link it —
the language server lives inside the extension, so both work:

```sh
git clone https://github.com/andrecorugda/star-burxt
cp -r star-burxt/editors/vscode ~/.vscode/extensions/star-burxt
#  …or, to keep it in step with the checkout:
ln -s "$PWD/star-burxt/editors/vscode" ~/.vscode/extensions/star-burxt
```

Then reload VS Code. On Windows, `mklink /D` does the linking; on VS Code Insiders the folder is
`~/.vscode-insiders/extensions`.

**Both of those are tested rather than assumed.** The first version of this page said a symlink was required
because the server sat beside the extension rather than inside it — and when I checked the instruction, the
symlink did not work either: `path.join` normalises `..` lexically, so it resolved outside the link just as a
copy did. Either way the extension would have installed, coloured a document, and never checked one. The
server moved inside; both paths are verified by resolving them.

**It needs three things on `PATH`:** `node`, to run the server; `burxt`, because the checker compiles your
document; and `star-check`, built from this repository with `burxt build examples/check.bx -o star-check`.
Point the extension at it explicitly if it lives somewhere else:

```json
{ "starBurxt.check": "/home/you/star-burxt/star-check" }
```

## Checking that it works

Open any `.sbmx` file. You should see colour immediately — that is the grammar, and it needs nothing but the
extension. Then type a mistake:

```sbmx
:button: on:hover=Msg.Go
click
:!button:
```

A squiggle under `on:hover` with **STAR-E002** is the language server answering. If you get colour and no
squiggle, the server did not start: `node` is missing from `PATH`, or `star-check` is. The extension says so
rather than staying quiet — a version of this shipped that coloured documents and silently never checked one,
because the server path pointed outside the extension folder.

## What it does not do yet

No completion, no hover, no go-to-definition. The server publishes diagnostics and answers `initialize`, and
that is all — [`what's not built yet`]({{ site.baseurl }}/not-done.html) is the honest list.

Highlighting inside `.bmx` files comes from [BMX's own extension](https://bmx.burxt-lang.org/editor.html);
this one adds the Burxt colouring for slots and block heads wherever BMX is highlighted, so the two are worth
having together. Neither requires the other.
