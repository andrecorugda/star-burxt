# Editor support

**Nothing here reimplements Burxt or BMX.** Three grammars already exist; this points them at the
three regions of a `.sbmx` file and fills the two holes BMX leaves on purpose.

| region | who colours it |
|---|---|
| `===bx` | `source.burxt` |
| `===style.local` / `.global` | `source.css` |
| the markup | `text.bmx` |
| a slot's expression, `{{ … }}` | **star's injection** → `source.burxt` |
| a block's head | **star's injection** → `on:`, `key`, attributes, then `source.burxt` |

BMX colours document structure and leaves `meta.slot.bmx`, `meta.block.head.bmx` and
`meta.inline-block.head.bmx` uncoloured, treating those three names as a compatibility surface it
will not rename without a major. star injects into them. **The consequence worth knowing: a slot
expression gets real Burxt highlighting, including the day Burxt gains a keyword**, because the
grammar is included rather than copied.

## Installing, while none of this is published

```sh
code --install-extension editors/vscode/star-burxt.vsix
```

`editors/vscode/pack.py` writes that file with nothing but the standard library — the extension has no
npm dependencies, so `vsce` would only add a toolchain. An installed extension is registered, versioned
and uninstallable through the normal UI, which is the reason to prefer it: a symlink works until
something scans the registry and does not find you.

VS Code also reads extensions straight out of a directory, and both of these still work:

```sh
cp -r editors/vscode ~/.vscode/extensions/star-burxt
ln -s "$PWD/editors/vscode" ~/.vscode/extensions/star-burxt
```

**All three are checked by spawning the server inside them and asking**, rather than by inspecting the
packer — `tests/extension.py`. The reason is that the copy was broken and read as working: the server
finds its version by walking up for `burxt.package`, a copy lands where no parent has one, and it
answered `0.0.0` while colouring and checking perfectly. `pack.py` stages that manifest beside the
server so all three shapes find one.

**A remote window reads a different directory**, and this is worth knowing before you debug a grammar
that never appears: on WSL, SSH, a dev container or a Codespace, extensions live in
`~/.vscode-server/extensions` on the remote machine.

**It has two grades and the silent one is likelier.** With no `~/.vscode` at all the copy fails and
names the reason. With `~/.vscode` present — which it is for anyone who has ever opened a local window
— the copy succeeds, lands where no editor reads it, and reports nothing. The markup session measured
both after this file claimed only the second; the loud grade never protects the people who need it,
because having the directory is what makes you vulnerable.

`code --install-extension` resolves the directory itself and names the machine it used, which is why
the `.vsix` is the instruction that does not depend on knowing any of this.

It depends on BMX's and Burxt's extensions, which install the same way from their own repositories.

## The language server

`editors/vscode/server/star-lsp.mjs` — diagnostics for `.sbmx`, over JSON-RPC on stdio, no
dependencies. **It lives inside the extension deliberately**: it sat in `editors/lsp/` and was
reached by a `..` path, which resolves outside the folder on a copy install AND on a symlink one,
because `path.join` normalises `..` lexically. Either way the extension coloured documents and
never checked one.

**It is a protocol wrapper over `star check`, deliberately.** All three layers of judgement come from
the same binary a person runs on the command line. A server that reimplemented any of them would be
a second opinion, and the second opinion is the one that would be wrong.

    BMX-Ennn    the document is not well formed
    STAR-Ennn   the document is not a component
    a type error  the code inside it does not compile

**BMX ships its own server for `.bmx`, and that is the right split.** Two extensions, two file
kinds, no file with two servers — and each can hold opinions the other should not. BMX's can judge a
document against the format's conformance levels; that would be noise in a component.

One position is approximate and says so in the message: a type error points into the *generated*
component, and mapping it back is done by finding the offending expression in the source. That is
exact when the expression appears once. A real source map needs the emitter to record an offset per
expression — worth building, not built.

```sh
STAR_CHECK=./star-check node editors/lsp/drive-lsp.mjs
```

speaks the protocol to it and asserts nine things, including that a clean document reports nothing —
**last**, after three that prove it can find problems. A server answering nothing to everything would
pass that one on its own.

## What it does not do

**No completion.** It needs the element vocabulary and the imported components — star knows both, and
the server does not ask for them yet.

**No hover, and it is closer than it looks.** `burxt lsp` already answers hover on a field with its
full contract, *including the rounding rule* — `Decimal<2, RoundHalfEven>`, "rounds half to even" —
which is exactly what a template loses in every other stack. And it answers from text supplied over
the protocol, so no file has to exist on disk. What is missing is the map from a slot in the document
to the position in the generated component: a source-map problem rather than a capability one.

**No formatting, and not planned.** Reflowing a block head means deciding what the head means, and
that is the document's business rather than a tool's.

**No red squiggles.** Colouring cannot say `on:hover` is unwirable, because the list of wirable
events lives in `star.bx` and a grammar guessing at it would be a second copy to keep in step. A
grammar that is wrong about a refusal is worse than one that is silent about it — the diagnostics
come from `star check`, which asks the real thing.

One exception: **an unknown `===` section is marked invalid**, because that judgement needs no list.
A section star does not know is refused by the generator, and a reader should see it before they run
anything.
