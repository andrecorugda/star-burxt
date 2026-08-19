# star-burxt for VS Code

Syntax highlighting and diagnostics for `.sbmx` components.

This is the page VS Code shows on the extension's detail pane, so it says what you get and what it
needs, and nothing else. The reasoning behind the split with BMX's extension is in
[`editors/README.md`](https://github.com/andrecorugda/star-burxt/blob/main/editors/README.md).

## What it does

- **Colour** in all three regions of a component — `===bx` as Burxt, `===style.local` and
  `.global` as CSS, the markup as BMX.
- **The two holes BMX leaves on purpose**, filled by injection: a slot's expression `{{ … }}` and a
  block's head get real Burxt highlighting. Because the grammar is included rather than copied, they
  keep working the day Burxt gains a keyword. The injection applies wherever BMX is highlighted, so
  it colours a `.bmx` as well as a `.sbmx`.
- **Diagnostics** — `BMX-Ennn` when the document is not well formed, `STAR-Ennn` when it is not a
  component, and type errors from the Burxt compiler.
- **Folding** that knows `:name:` opens, `:!name:` closes, and a one-liner closes itself.

Every diagnostic comes from `star-check`, the same binary you run on the command line. The server is
a protocol wrapper over it rather than a second implementation, because the second opinion is the one
that would be wrong.

## What it needs on `PATH`

| | why |
|---|---|
| `node` | runs the language server |
| `burxt` | the checker compiles your document |
| `star-check` | built with `burxt build examples/check.bx -o star-check` |

Point it somewhere else if that binary does not live on `PATH`:

```json
{ "starBurxt.check": "/home/you/star-burxt/star-check" }
```

**Colour needs none of this.** The grammar is data and works immediately; the checker is what needs
the three. If you get colour and no squiggle, the server did not start — `node` or `star-check` is
missing, and the extension says so rather than staying quiet.

## What it does not do yet

No completion, no hover, no go-to-definition. The server publishes diagnostics and answers
`initialize`, and that is all.

## Installing

```sh
code --install-extension star-burxt.vsix
```

The `.vsix` is committed at `editors/vscode/star-burxt.vsix`, and a copy or a symlink of
`editors/vscode/` into your extensions directory works too. All three are checked by
`tests/extension.py`.

MIT.
