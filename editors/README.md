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

VS Code reads extensions out of a directory:

```sh
ln -s "$PWD/editors/vscode" ~/.vscode/extensions/star-burxt
```

It depends on BMX's and Burxt's extensions, which install the same way from their own repositories.

## What it does not do

**No completion and no hover.** Those need to know which blocks exist, and only star knows that —
the element vocabulary and the imported components both live in `star.bx` and in the document's own
`===bx` section. That is the language server's job, and it is next.

**No red squiggles.** Colouring cannot say `on:hover` is unwirable, because the list of wirable
events lives in `star.bx` and a grammar guessing at it would be a second copy to keep in step. A
grammar that is wrong about a refusal is worse than one that is silent about it — the diagnostics
come from `star check`, which asks the real thing.

One exception: **an unknown `===` section is marked invalid**, because that judgement needs no list.
A section star does not know is refused by the generator, and a reader should see it before they run
anything.
