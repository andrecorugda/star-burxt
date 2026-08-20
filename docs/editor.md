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

The extension is not on the Marketplace yet, so it is installed from the repository. There is a packaged
build committed alongside it:

```sh
git clone https://github.com/andrecorugda/star-burxt
code --install-extension star-burxt/editors/vscode/star-burxt.vsix
```

That is the one to prefer — an installed extension is registered, versioned, upgradable and uninstallable
through the normal UI. The `.vsix` is written by `editors/vscode/pack.py` using nothing but Python's standard
library, because the extension has no npm dependencies and `vsce` would only add a toolchain to a repository
that promises not to need one.

Copying or linking the folder also works, and the language server lives inside the extension so neither
needs anything else:

```sh
cp -r star-burxt/editors/vscode ~/.vscode/extensions/star-burxt
#  …or, to keep it in step with the checkout:
ln -s "$PWD/star-burxt/editors/vscode" ~/.vscode/extensions/star-burxt
```

Then reload VS Code. On Windows, `mklink /D` does the linking; on VS Code Insiders the folder is
`~/.vscode-insiders/extensions`.

> **If you are on WSL, SSH, a container or a Codespace, that folder is not the one your editor reads.**
> A remote window loads extensions from **`~/.vscode-server/extensions`** on the remote machine, so a
> copy or a symlink into `~/.vscode/extensions` silently does nothing — no error, no extension, and the
> instruction looks like it worked. That is the case this project cares about most: `extensionKind` is
> `["workspace"]` precisely because the checker runs where your code is, which is the remote side.
>
> **`code --install-extension` avoids the question entirely** — it resolves the right directory itself
> and says which machine it used (`Installing extensions on WSL: Ubuntu…`). Prefer it, and reach for a
> folder only when you want the extension to track a checkout.

**All three are tested rather than assumed, and the second time that sentence was written it was false.**
The first version of this page said a symlink was required because the server sat beside the extension rather
than inside it — and when I checked the instruction, the symlink did not work either: `path.join` normalises
`..` lexically, so it resolved outside the link just as a copy did. Either way the extension would have
installed, coloured a document, and never checked one. The server moved inside, and both paths were verified
by resolving them.

**What that verified was where the server is, not what it says it is.** The server reads its version by
walking up until it finds `burxt.package`, and a copy install lands it where no parent directory holds one —
so it answered `initialize` with `0.0.0` while colouring and checking correctly. The symlink escaped by
accident, because node resolves a module's realpath and lands back inside the checkout. **A version that is
wrong in a field nobody looks at has no symptom until somebody reads a bug report** and it names the wrong
release. `pack.py` now stages `burxt.package` beside the server, and `tests/extension.py` spawns the real
server inside each of the three installs above and asks it — because a claim about an install is only worth
what checking it through that install is worth.

**It needs three things on `PATH`:** `node`, to run the server; `burxt`, because the checker compiles your
document; and `star-check`, built from this repository with `burxt build examples/check.bx -o star-check`.
Point the extension at it explicitly if it lives somewhere else:

```json
{ "starBurxt.check": "/home/you/star-burxt/star-check" }
```

**And a `burxt` whose standard library resolves, which is worth saying because the failure is total.**
Every component star generates opens with `use "std/html.bx"`, so a compiler that cannot find the
standard library checks nothing at all — every document reports an error and none of them are about your
document. The library is found by the compiler's own installation, never by proximity to your program,
and there are **two** places it looks: `BURXT_LIB` if set, then `../lib/burxt` beside the binary. An
install done with `scripts/install.sh` satisfies the second, because it puts the binary at
`$PREFIX/bin/burxt` and the library at `$PREFIX/lib/burxt`. A compiler run out of a build directory
satisfies neither, and says so by name.

**There is deliberately no `/usr/local/lib/burxt` fallback**, which is worth knowing because it is the
one people expect. It was removed for being redundant when right and wrong when it fired: a standard
install already resolves there through the exe-relative root, so the hardcoded one could only be
reached when the binary lived somewhere else — meaning that library belonged to a *different*
installation. It was live, and it silently compiled a locally built compiler against the installed
library.

```sh
printf 'use "std/html.bx";\n' > /tmp/probe.bx && burxt check /tmp/probe.bx
#  /tmp/probe.bx: no errors                     ← the library resolved
#  error: `use "std/html.bx"` — no standard library found. Looked in: …   ← it did not, and says where
```

A compiler old enough to predate that lookup ignores `BURXT_LIB` as well, and then the error names a
path beside your document rather than the library — `cannot read examples/std/html.bx`. If that is what
you see, the compiler is the thing to update, not the variable to set.

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
