# The collection

Every `.sbmx` here is a working component and each one is in the collection for a **reason** — an edge, a
combination nothing else covers, or a case that was silently wrong until somebody wrote it down. Most of
them found a defect when they were written; where they did, the row says so.

`tools/collection.bx` holds this list and the directory to each other: every document here is listed, every
document listed exists and checks clean, and every row says what it is for.

| component | what it shows | found |
|---|---|---|
| `counter.sbmx` | the smallest thing that works — one handler, no `===bx` section at all | |
| `Badge.sbmx` | a component with **props and no state**, made to be used by others | |
| `Page.sbmx` | using another component — `:Badge:` with its props | |
| `Todos.sbmx` | a list, a text field, and state carried as text | |
| `Form.sbmx` | `on:submit`, `on:input`, and a field the view drives | |
| `Hero.sbmx` | the landing page's component: a keyed `:for:`, `===style.local`, a pseudo-element checkbox | a scope marker appended after a pseudo-element, so `:hover` and `::before` were dead |
| `Showcase.sbmx` | the biggest one — every block form on one page | a `.tab.on` rule its markup could never set, so **every tab looked identical including the one you were on** |
| `App.sbmx` | `:match:` choosing between screens | |
| `router.sbmx` | `:if:` / `:else:` and an address that changes without a reload | |
| `Served.sbmx` | `load(request)`, so the page is rendered where the data is | |
| `Feed.sbmx` | fetching, polling with `after`, and a subscription that stops itself | **a live feed that blanked itself every five seconds**: the timer shared the fetch's tag, so each tick arrived with an empty body |
| `Poster.sbmx` | `StarCmd.Send` — saving to a server that enforces CSRF | a `send` went out as `text/plain` with no token: 419 on any Laravel `web` route, and `$request->input()` empty with nothing reported |
| `Echo.sbmx` | what every event kind gives you as `value`, one element per channel | the pointer coordinate channel had never been exercised — the fake DOM pinned `clientX` to `undefined` |
| `Rows.sbmx` | a keyed list whose rows hold focus, reordered while you type in one | **the caret followed the POSITION, not the row**, so the next keystroke edited a different record |
| `Grid.sbmx` | a **nested `:for:`** — a loop inside a loop, and which key wins | |
| `Choices.sbmx` | every form control: select, radio, checkbox, textarea | `<label>size <select>…</select></label>` was refused, and `<button><h1>` was not |
| `Notes.sbmx` | `Store`, `Load` and `Focus` — the browser's own storage, and a caret | a restored draft reported success with the field still **empty**: a textarea's value is its children, not an attribute |
| `Clock.sbmx` | a `pure` view cannot read a clock, so a tick asks the server | not expressible at all until `after` existed |
| `Snake.sbmx` | a game: a tick, four global keys, a list that moves every frame | **a save button fired on `mouseover`** — 495 writes with nobody touching the mouse; and the tick never stopped when the game ended |
| `Cart.sbmx` | money: `Decimal<2>`, a percent literal, and `money_split` placing the odd penny | `12.5` where `12.5%` was meant is **1250%** and typechecks — £1000.00 instead of £10.00 |
| `Board.sbmx` | noughts and crosses: rules as a pure function, a winner derived rather than trusted | |

## Running one

```sh
./star-build examples/Snake.sbmx snake out            # browser: a .wasm and a .css
./star-generate examples/Snake.sbmx snake --fragment  # server: state in, HTML out
```

Anything with a `:props:` line and no `to_text` is a **child component** — `Badge` is used by `Page`, not
mounted on its own.

## What is deliberately not here

**No `svg` and no `template`.** Both are decisions rather than omissions and `docs/not-done.md` says why —
a convention that exists only as an absence is indistinguishable from a name somebody forgot.
