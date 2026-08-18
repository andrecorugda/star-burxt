#!/usr/bin/env python3
"""star-burxt's guarantee test.

**This is the whole claim, and it is a claim about REFUSALS.** A `.bmx` document becomes a component
the compiler judges: a typo in a slot, a wrong type in a handler, and money narrowing inside a click
handler are all compile errors, and three more refusals are star-burxt's own.

It lived in Burxt's `tests/runner.rs` while star-burxt lived in Burxt's `lib/`. It moves with the
code, because a suite that tests a package the repository no longer contains is testing something it
cannot see change.

**The accepting case runs first and its failure is fatal.** Every refusal below it is satisfied by a
generator that refuses everything, so a suite of nothing but refusals proves nothing at all.

    python3 test.py
"""
import os
import re
import shutil
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.abspath(__file__))
BURXT = os.environ.get("BURXT", "burxt")


def run(args, cwd=None):
    return subprocess.run(args, cwd=cwd, capture_output=True, text=True)


def main():
    work = tempfile.mkdtemp(prefix="star-burxt-test-")
    failures = []

    def check(name, condition, detail):
        if condition:
            print("  ok    %s" % name)
        else:
            print("  FAIL  %s" % name)
            failures.append("%s\n%s" % (name, "\n".join("      " + l for l in detail.splitlines()[:8])))

    # The generator has to build before anything else means anything.
    generator = os.path.join(work, "star-generate")
    built = run([BURXT, "build", os.path.join(ROOT, "examples/generate.bx"), "-o", generator],
                cwd=ROOT)
    if built.returncode != 0:
        print("the generator does not build:\n%s" % (built.stderr or built.stdout))
        return 1

    def generate(document):
        path = os.path.join(work, "doc.bmx")
        with open(path, "w") as f:
            f.write(document)
        return run([generator, path, "c"], cwd=ROOT)

    def compile_component(document):
        out = generate(document)
        # **No rewriting.** This used to patch `lib/html.bx` into `std/html.bx` before checking,
        # which meant the suite tested a line the generator does not emit — so the generator could
        # emit an import that resolves nowhere and every test would still pass. It did exactly
        # that. A test that repairs its input is testing the repair.
        source = out.stdout
        path = os.path.join(work, "c.bx")
        with open(path, "w") as f:
            f.write(source)
        checked = run([BURXT, "check", path])
        return checked.stdout + checked.stderr

    # ---- the accepting case, first ------------------------------------------------------------
    good = (":props: count: Int\n:!props:\n\nAt {{ to_string(count) }}.\n\n:button: on:click=count + 1\nmore\n:!button:\n")
    check("a correct component compiles", "no errors" in compile_component(good),
          compile_component(good))

    emitted = generate(good).stdout
    check("a handler reaches the page as an INDEX", "data-star-h" in emitted, emitted)
    check("no inline handler is ever emitted", "onclick" not in emitted, emitted)
    check("the handler expression reaches `dispatch`",
          "if handler == 0 { return count + 1; }" in emitted, emitted)

    # ---- what the COMPILER refuses ------------------------------------------------------------
    typo = compile_component(":props: count: Int\n:!props:\n\nAt {{ to_string(cuont) }}.\n")
    check("a slot typo is refused by name", "unknown variable: cuont" in typo, typo)

    wrong = compile_component(":props: count: Int\n:!props:\n\n:button: on:click=count + \"one\"\ngo\n:!button:\n")
    check("a handler type error is refused",
          "cannot apply `+` to Int and String" in wrong, wrong)

    # The one no framework whose handlers are closures can make.
    money = compile_component(":props: total: Decimal<2>\n:!props:\n\n:button: on:click=total * 1.5\nbump\n:!button:\n")
    check("money narrowing INSIDE a click handler is a compile error",
          "rounding" in money, money)

    # ---- what star-burxt refuses --------------------------------------------------------------
    unknown = generate(":props: count: Int\n:!props:\n\n:mystery:\nhi\n:!mystery:\n").stderr
    check("an undeclared block name is refused by name",
          "STAR-E001" in unknown and "mystery" in unknown, unknown)

    unwired = generate(":props: count: Int\n:!props:\n\n:button: on:hover=count + 1\nhi\n:!button:\n").stderr
    check("an event this host cannot wire is refused (SPEC.md 4a.5)",
          "STAR-E002" in unwired and "on:hover" in unwired, unwired)

    # **THE LIST INSIDE THE MESSAGE WENT STALE AND NOBODY NOTICED.** It named four events for as long
    # as there were four, and kept naming them after thirty-five more were wired — telling an author
    # their options were `click`, `input`, `change` and `submit` while `keydown` worked. A stale list
    # in an error is worse than no list: a reader believes it and stops looking.
    check("the refusal does not name a four-event list that has not been true for hours",
          "Wired events are click, input, change, submit" not in unwired, unwired)
    check("`hover` is answered with what it actually is — CSS, not an event",
          "hovering is CSS" in unwired and "mouseenter" in unwired, unwired)

    for asked, wanted in [("keypress", "keydown"), ("mousemove", "pointermove")]:
        said = generate(":props: n: Int\n:!props:\n\n:div: on:%s=n + 1\nx\n:!div:\n" % asked).stderr
        check("`%s` is answered with `%s`" % (asked, wanted), wanted in said, said)

    # Every event the driver installs a listener for must be one star accepts, and the reverse. The
    # driver's side is asserted in `drive-feed.mjs`; this is star's.
    for wired in ["click", "dblclick", "keydown", "keyup", "focus", "blur", "mouseenter",
                  "mouseleave", "mouseover", "mouseout", "pointerenter", "wheel", "scroll",
                  "drop", "touchstart", "animationend", "transitionend", "submit", "reset"]:
        got = generate(":props: n: Int\n:!props:\n\n:div: on:%s=n + 1\nx\n:!div:\n" % wired)
        check("`on:%s` is wired" % wired, got.returncode == 0, got.stderr)

    voided = generate(":props: n: Int\n:!props:\n\n:input: on:input=n\noops\n:!input:\n").stderr
    check("a void element with a body is refused before it trips a contract",
          "STAR-E004" in voided, voided)

    flowed = generate(":props: n: Int\n:!props:\n\n:button: on:click=n + 1\n# nope\n:!button:\n").stderr
    check("flow content inside a phrasing element is refused",
          "STAR-E005" in flowed, flowed)

    looped = generate(":props: rows: [Row]\n:!props:\n\n:for: row in rows key row.id\n:li: on:click=row.id\n{{ row.label }}\n:!li:\n:!for:\n").stderr
    check("a handler inside a `for` is refused, rather than emitting a name out of scope",
          "STAR-E007" in looped, looped)

    # ---- component mode: a `===bx` section, and handlers become MESSAGES ----------------------
    #
    # The accepting case first, as everywhere on this page: a suite of refusals is satisfied by a
    # generator that refuses everything.
    component = ("===bx\nclass Model { count: Int, history: [Int] }\nenum Msg { Increment, Reset }\npure function update(msg: Msg, m: Model) -> Model {\n    match msg {\n        Increment => { return Model { count: m.count + 1, history: m.history }; }\n        Reset     => { return Model { count: 0, history: m.history }; }\n    }\n}\n===\n\n:props: model: Model\n:!props:\n\nAt {{ to_string(model.count) }}.\n\n:button: on:click=Msg.Increment\nmore\n:!button:\n")
    check("a component with a ===bx section compiles", "no errors" in compile_component(component),
          compile_component(component))

    emitted = generate(component).stdout
    check("STATE IS A RECORD HOLDING A LIST — the thing the region rule refused until today",
          "class Model { count: Int, history: [Int] }" in emitted, emitted)
    check("a handler is a MESSAGE, routed through the author's `update`",
          "return update(Msg.Increment, model);" in emitted, emitted)
    check("the author's code is emitted BEFORE the view that names it",
          emitted.index("pure function update") < emitted.index("pure function c("), emitted)

    # `use` lines cannot sit where they were written: Burxt scans only a file's LEADING lines for
    # imports, so a `use` after a declaration is a syntax error. They are hoisted.
    imported = generate("===bx\nuse \"std/string.bx\";\nclass Model { n: Int }\npure function update(msg: Int, m: Model) -> Model { return m; }\n===\n\n:props: model: Model\n:!props:\n\nAt {{ to_string(model.n) }}.\n").stdout
    check("an author's `use` is hoisted above the generated header",
          imported.index('use "std/string.bx";') < imported.index("class Model"), imported)

    # A `===bx` section with no `update` is refused BY NAME rather than left to fail as a compiler
    # error about a function nobody wrote.
    orphan = generate("===bx\nclass Model { n: Int }\n===\n\n:props: model: Model\n:!props:\n\n:button: on:click=Msg.Go\ngo\n:!button:\n").stderr
    check("a ===bx section with no `update` is refused by name",
          "STAR-E008" in orphan and "update" in orphan, orphan)

    # Expression mode is untouched — the guide teaches it and it keeps working.
    check("without a ===bx section a handler is still an EXPRESSION",
          "if handler == 0 { return count + 1; }" in generate(good).stdout, generate(good).stdout)

    # ---- routing: the path IS the state, so it needs nothing the language lacks ---------------
    #
    # A route is derived from `location.pathname`, which is a String, and a String crosses the wasm
    # boundary. That is the whole reason routing works today while the rest of an SPA does not: a
    # model that is a RECORD cannot cross, because nothing in Burxt holds state between two calls.
    routed = ("===bx\nuse \"std/string.bx\";\nenum Route { Home, Post(Int), Missing }\nclass Model { route: Route, path: String }\nenum Msg { Navigate(String) }\npure function route_of(path: String) -> Route {\n    if path == \"/\" { return Route.Home; }\n    if string_starts_with(path, \"/posts/\") {\n        return Route.Post(string_to_int(substring(path, 7, len(path) - 7), 0));\n    }\n    return Route.Missing;\n}\npure function update(msg: Msg, m: Model) -> Model {\n    match msg {\n        Navigate(to) => { return Model { route: route_of(to), path: to }; }\n    }\n}\n===\n\n:props: model: Model\n:!props:\n\n:nav:\n\n:a: href=/posts/42\na post\n:!a:\n\n:!nav:\n\n:match: model.route\n\n:case: Home\n\n# Welcome\n\n:!case:\n\n:case: Post(id)\n\n# Post {{ to_string(id) }}\n\n:!case:\n\n:case: Missing\n\n:p:\nNothing at {{ model.path }}\n:!p:\n\n:!case:\n\n:!match:\n")
    check("a routed app compiles", "no errors" in compile_component(routed),
          compile_component(routed))
    made = generate(routed).stdout
    check("a link is real markup, so it works before any JavaScript runs",
          'html_element("a", [html_attr("href", "/posts/42")]' in made, made)
    check("the route is decided by an exhaustive match", "match model.route {" in made, made)

    # Adding a screen to the enum and forgetting its branch fails the BUILD. Checked here on a
    # router rather than in the abstract, because this is where it earns its keep.
    grew = compile_component(routed.replace("enum Route { Home, Post(Int), Missing }",
                                            "enum Route { Home, Post(Int), Missing, Archive }"))
    check("ADDING A ROUTE AND FORGETTING ITS SCREEN IS A BUILD FAILURE",
          "does not handle `Archive`" in grew, grew)

    # ---- per-row handlers: identity crosses the page as the key -------------------------------
    #
    # This was refused outright until now — STAR-E007 said a handler inside a `for` was "designed
    # and unbuilt". What it was waiting for is structured state, which the language allowed this
    # morning: a row's identity crosses as its `key`, and `update` re-derives the row from the
    # state it is given rather than from a value captured while drawing the page.
    rows = ("===bx\nuse \"std/string.bx\";\nclass Todo { id: Int, label: String }\nclass Model { todos: [Todo] }\nenum Msg { Toggle(Int) }\npure function update(msg: Msg, m: Model) -> Model { return m; }\n===\n\n:props: model: Model\n:!props:\n\n:for: todo in model.todos key to_string(todo.id)\n\n:li:\n\n:button: on:click=Msg.Toggle(string_to_int(key, 0))\n{{ todo.label }}\n:!button:\n\n:!li:\n\n:!for:\n")
    check("a handler inside a `for` compiles", "no errors" in compile_component(rows),
          compile_component(rows))
    made = generate(rows).stdout
    check("`dispatch` takes the row's KEY and the event's VALUE, in that order",
          "_dispatch(handler: Int, key: String, value: String, model: Model)" in made, made)
    check("the row carries its key on the page, which is what the driver sends",
          'html_attr("data-star-key", to_string(todo.id))' in made, made)

    # The loop variable is gone by the time a handler runs. Refused HERE naming it, rather than
    # left to the compiler — which would say `unknown variable: todo` inside a `dispatch` the
    # author never wrote, about a binding they did.
    captured = generate(rows.replace("Msg.Toggle(string_to_int(key, 0))", "Msg.Toggle(todo.id)")).stderr
    check("A HANDLER NAMING THE LOOP VARIABLE IS REFUSED, naming it and pointing at `key`",
          "STAR-E007" in captured and "todo" in captured and "key" in captured, captured)

    # Without a key the page cannot say which row was clicked, and every row would dispatch
    # identically — which looks like it works, so it is refused.
    unkeyed = generate(rows.replace(" key to_string(todo.id)", "")).stderr
    check("an unkeyed `for` containing a handler is refused",
          "STAR-E018" in unkeyed, unkeyed)

    # ---- `key` and `value` belong to star ------------------------------------------------------
    #
    # A dispatch is `(handler, key, value, <props>)`, so a prop of either name produces a function
    # with two parameters of the same name. **Found by running the linter over this repository's own
    # examples** — `Badge.sbmx` had a prop called `value` and had shipped.
    for taken in ["key", "value"]:
        clash = generate(":props: %s: Int\n:!props:\n\nAt {{ to_string(%s) }}.\n" % (taken, taken)).stderr
        check("a prop named `%s` is refused by name, not by the compiler" % taken,
              "STAR-E019" in clash and taken in clash, clash)
    fine = generate(":props: amount: Int\n:!props:\n\nAt {{ to_string(amount) }}.\n")
    check("a prop named anything else is fine", fine.returncode == 0, fine.stderr)

    # ---- styles: `local` scopes, `global` does not, and neither is the default -----------------
    styled = ("===style.global\nbody { font-family: system-ui; }\n===\n\n===style.local\n.card { border: 1px solid #ddd; }\n.card p, .note { color: #555; }\n@media (max-width: 600px) { .card { padding: .5rem; } }\n===\n\n:props: n: Int\n:!props:\n\n:div: class=card\n\n:p:\ninside\n:!p:\n\n:!div:\n")
    made = generate(styled)
    sheet = open(os.path.join(work, "doc.css")).read() if os.path.exists(os.path.join(work, "doc.css")) else ""
    check("a `local` selector is scoped to the component",
          ".card[data-s-c]" in sheet, sheet)
    check("a `global` rule is left exactly as written",
          "body { font-family: system-ui; }" in sheet, sheet)
    check("the marker lands on the elements, so the scope is real",
          'html_attr("data-s-c", "")' in made.stdout, made.stdout)

    # `@media` is not a selector. Stamping it produces `@media (…)[data-s-c]`, which is not CSS —
    # its BODY holds the rules that need scoping.
    check("AN AT-RULE IS NOT STAMPED; the rules inside it are",
          "@media (max-width: 600px) {" in sheet and ".card[data-s-c] { padding: .5rem; }" in sheet,
          sheet)

    # The reason `local` is exact matching rather than a descendant selector: a child component's
    # elements sit inside the parent's subtree, and `[data-s-parent] .card` would reach them.
    check("a component with no local sheet gets no marker and no attribute",
          'data-s-' not in generate(":props: n: Int\n:!props:\n\n:div:\nx\n:!div:\n").stdout,
          generate(":props: n: Int\n:!props:\n\n:div:\nx\n:!div:\n").stdout)

    # ---- components: another `.sbmx`, imported with `use`, called as a block -------------------
    with open(os.path.join(work, "Badge.sbmx"), "w") as f:
        f.write(":props: amount: Int, tone: String\n:!props:\n\n:span: class=badge\n{{ tone }}: {{ to_string(amount) }}\n:!span:\n")
    page = ("===bx\nuse \"./Badge.sbmx\";\nclass Model { unread: Int }\npure function update(msg: Int, m: Model) -> Model { return m; }\n===\n\n:props: model: Model\n:!props:\n\n:Badge: amount={{ model.unread }} tone=unread\n:!Badge:\n")
    made = generate(page)
    check("a component is CALLED, as an ordinary function",
          "badge((model.unread), \"unread\")" in made.stdout, made.stdout + made.stderr)
    check("the child is generated too, beside its own source",
          os.path.exists(os.path.join(work, "Badge.bx")), work)
    check("the generated page imports the child as `.bx`, not `.sbmx`",
          'use "./Badge.bx";' in made.stdout, made.stdout)

    # ARGUMENTS GO IN THE CALLEE'S ORDER, not the order they were written — two props of the same
    # type would swap in silence otherwise, and the compiler cannot see that mistake.
    reordered = generate(page.replace("amount={{ model.unread }} tone=unread",
                                      "tone=unread amount={{ model.unread }}"))
    check("ARGUMENT ORDER FOLLOWS THE CALLEE, not the call site",
          "badge((model.unread), \"unread\")" in reordered.stdout, reordered.stdout)

    missing_prop = generate(page.replace(" tone=unread", "")).stderr
    check("a call missing a prop is refused, naming it and listing what is wanted",
          "STAR-E017" in missing_prop and "tone" in missing_prop, missing_prop)

    unimported = generate(":props: n: Int\n:!props:\n\n:Missing: x=1\n:!Missing:\n").stderr
    check("a component block with no import is refused, and says what to write",
          "STAR-E001" in unimported and ".sbmx" in unimported, unimported)

    absent = generate("===bx\nuse \"./Nope.sbmx\";\nclass Model { n: Int }\npure function update(m: Int, x: Model) -> Model { return x; }\n===\n\n:props: model: Model\n:!props:\n\nhi\n").stderr
    check("an import that does not resolve names the file and the importer",
          "Nope.sbmx" in absent and "imported by" in absent, absent)

    # ---- `match`: adding a screen and forgetting its view is a BUILD FAILURE -----------------
    #
    # This is the claim no JavaScript framework can make. React, Vue and Svelte give you a blank
    # page and a bug report; here the compiler names the variant nobody rendered.
    router = ("===bx\nenum Route { Home, Post(Int) }\nclass Model { route: Route }\npure function update(msg: Int, m: Model) -> Model { return m; }\n===\n\n:props: model: Model\n:!props:\n\n:match: model.route\n\n:case: Home\n\n# Welcome\n\n:!case:\n\n:case: Post(id)\n\n# Post {{ to_string(id) }}\n\n:!case:\n\n:!match:\n")
    check("a match over a route compiles", "no errors" in compile_component(router),
          compile_component(router))
    check("a case PATTERN destructures, so `id` is in scope in its branch",
          "Post(id) => {" in generate(router).stdout, generate(router).stdout)

    # The whole point, and it is checked by REMOVING a branch rather than by adding a variant —
    # same defect, and this way the fixture cannot pass because the compiler was lenient.
    missing = compile_component(router.replace(
        ":case: Post(id)\n\n# Post {{ to_string(id) }}\n\n:!case:\n\n", ""))
    check("A VARIANT WITH NO BRANCH IS A COMPILE ERROR, naming it",
          "does not handle `Post`" in missing, missing)

    stray = generate(":props: n: Int\n:!props:\n\n:case: Home\nx\n:!case:\n").stderr
    check("a `case` outside a `match` is refused", "STAR-E014" in stray, stray)
    loose = generate(":props: n: Int\n:!props:\n\n:match: n\n\ntext, not a case\n\n:!match:\n").stderr
    check("text between branches is refused — it has no branch to belong to",
          "STAR-E011" in loose, loose)
    empty = generate(":props: n: Int\n:!props:\n\n:match: n\n\n:!match:\n").stderr
    check("a match with no cases decides nothing, and is refused",
          "STAR-E013" in empty, empty)

    # ---- `else` -------------------------------------------------------------------------------
    branched = generate(":props: n: Int\n:!props:\n\n:if: n > 0\n\n:p:\nsome\n:!p:\n\n:!if:\n\n:else:\n\n:p:\nnone\n:!p:\n\n:!else:\n").stdout
    check("an `else` becomes the other branch of the `if` above it",
          "else {" in branched, branched)
    orphaned = generate(":props: n: Int\n:!props:\n\nA paragraph.\n\n:else:\n\nx\n\n:!else:\n").stderr
    check("an `else` with no `if` directly above it is refused",
          "STAR-E016" in orphaned, orphaned)
    conditioned = generate(":props: n: Int\n:!props:\n\n:if: n > 0\n\nx\n\n:!if:\n\n:else: n < 0\n\ny\n\n:!else:\n").stderr
    check("an `else` carrying a condition is refused rather than silently ignored",
          "STAR-E015" in conditioned, conditioned)

    # ---- positions: a refusal points AT the thing, in line:column -----------------------------
    #
    # These were byte offsets into the container until BMX 0.3 gave every node its own position.
    # `STAR-E005` said "at 112" — the button — when the heading was at 127, so a reader with a long
    # document was sent to the block and left to find the line themselves.
    located = generate(":props: n: Int\n:!props:\n\n# A page\n\nSome introduction\nover two lines.\n\n:div:\n\n:button: on:click=n + 1\n# nope\n:!button:\n\n:!div:\n").stderr
    check("a refusal points at the OFFENDING construct, in line:column",
          "STAR-E005 at 12:1" in located, located)

    # `column` counts CHARACTERS, not bytes. A hand-rolled conversion is right on every ASCII line
    # and one place wrong on the first line with an accent in it — which is why this uses BMX's
    # `bmx_where` rather than star's own arithmetic, and why this fixture has an `å` in it.
    accented = generate(":props: n: Int\n:!props:\n\nA line with an Ã¥ in it, then:\n\n:button: on:click=n + 1\n# nope\n:!button:\n").stderr
    check("a line with a multi-byte character does not move the caret",
          "STAR-E005 at 7:1" in accented, accented)

    # ---- attributes, and the element vocabulary as a content model ---------------------------
    attrs = (":props: post: Post\n:!props:\n\n:div: class=card\n\n:span: class=\"tag muted\"\ndraft\n:!span:\n\n:a: href=/posts/{{ to_string(post.id) }}\nread more\n:!a:\n\n:input: disabled\n:!input:\n\n:!div:\n")
    out = generate(attrs).stdout
    check("an attribute reaches the element", 'html_attr("class", "card")' in out, out)
    check("a quoted value keeps its spaces", 'html_attr("class", "tag muted")' in out, out)
    check("A VALUE INTERPOLATES, so a link can be computed from state",
          'html_attr("href", "/posts/" + (to_string(post.id)))' in out, out)
    check("a bare name is a boolean attribute", 'html_attr("disabled", "")' in out, out)

    # The vocabulary is three sets rather than one list, because the SPLIT is what refuses a
    # heading inside a button. A tag being present is not the interesting half.
    for tag in ["a", "textarea", "table", "select", "details", "dialog", "main", "figure"]:
        got = generate(":props: n: Int\n:!props:\n\n:%s:\nx\n:!%s:\n" % (tag, tag))
        check("`%s` is an element star knows" % tag, got.returncode == 0, got.stderr)
    voided = generate(":props: n: Int\n:!props:\n\n:source:\nbody\n:!source:\n").stderr
    check("a NEWLY added void element is still refused a body",
          "STAR-E004" in voided, voided)
    flowed = generate(":props: n: Int\n:!props:\n\n:textarea:\n# nope\n:!textarea:\n").stderr
    check("a NEWLY added phrasing element still refuses a heading",
          "STAR-E005" in flowed, flowed)

    unclosed = generate(":props: n: Int\n:!props:\n\n:div: class=\"oops\nx\n:!div:\n").stderr
    check("a quote that never closes is refused rather than guessed at",
          "STAR-E009" in unclosed, unclosed)

    # ---- the content model has no seam --------------------------------------------------------
    one = generate(":props: n: Int\n:!props:\n\n:button: on:click=n + 1\nonly\n:!button:\n").stdout
    two = generate(":props: n: Int\n:!props:\n\n:button: on:click=n + 1\nfirst\n\nsecond\n:!button:\n").stdout
    kept = generate(":props: n: Int\n:!props:\n\n:div:\nkept\n:!div:\n").stdout
    check("one paragraph in a phrasing element unwraps",
          'html_element("p", [], [html_text("only")])' not in one, one)
    check("TWO paragraphs unwrap the same way — no discontinuity",
          'html_text("first"), html_text("second")' in two, two)
    check("a flow element KEEPS its paragraph — a content model, not 'strip paragraphs'",
          'html_element("p", [], [html_text("kept")])' in kept, kept)

    # ---- a phrasing element may hold a phrasing element ---------------------------------------
    #
    # `<button><span class=box></span></button>` is correct HTML and how a styled control is built.
    # The first content model refused EVERY nested block inside a phrasing element, so a button could
    # not contain a `span` — found by the site's own showcase, where a checkbox is exactly that.
    nested = generate(":props: n: Int\n:!props:\n\n:button: on:click=n + 1\n:span: class=box\n:!span:\n:span: class=text\nhi\n:!span:\n:!button:\n")
    check("a phrasing element may contain another phrasing element",
          nested.returncode == 0 and 'html_element("span"' in nested.stdout,
          (nested.stderr or nested.stdout))
    flow_in_phrasing = generate(":props: n: Int\n:!props:\n\n:button: on:click=n + 1\n:div:\nno\n:!div:\n:!button:\n")
    check("but FLOW content inside one is still refused",
          "STAR-E005" in (flow_in_phrasing.stderr + flow_in_phrasing.stdout),
          (flow_in_phrasing.stderr or flow_in_phrasing.stdout))

    # ---- an attribute NAME is checked here, not in the browser --------------------------------
    #
    # `html_element` has a precondition on its attribute names, so a name that is not one exits 70 —
    # a bare "burxt exit 70" in a console, from a function the author never called. An unquoted value
    # with spaces in it is read as several attributes, and the last of them is not a name.
    unquoted = generate(":props: n: Int\n:!props:\n\n:input: placeholder=What needs doing?\n:!input:\n")
    check("an unquoted value with spaces is refused by NAME, with the fix in the message",
          "STAR-E020" in (unquoted.stderr + unquoted.stdout)
          and "quotes" in (unquoted.stderr + unquoted.stdout),
          (unquoted.stderr or unquoted.stdout))

    # ---- a `for` over a CALL binds it first ----------------------------------------------------
    #
    # Burxt refuses `for x in f(y)` — the call would be remade on every pass — and it is right to.
    # But the author wrote `::: for task in shown(model)`, which is reasonable, so the binding is
    # emitted here rather than showing a reader a complaint about generated code.
    call_loop = generate(":props: items: [Line]\n:!props:\n\n:for: line in shown(items)\na row\n:!for:\n")
    check("a `for` over a call binds the call before the loop",
          call_loop.returncode == 0 and "let rows_" in call_loop.stdout
          and "in shown(items)" not in call_loop.stdout,
          (call_loop.stderr or call_loop.stdout))

    # ---- `===style.local` can reach a MARKDOWN element -----------------------------------------
    #
    # A heading, a paragraph, a list and a code block all come out of BMX with no attributes, so the
    # scope marker was missing from exactly the elements a document writes most. A local rule for
    # `.card h1` matched nothing, and the site's own hero was the thing that showed it.
    styled = generate("===bx\nclass Model { n: Int }\nenum Msg { Nothing }\npure function update(msg: Msg, m: Model) -> Model { return m; }\n===\n\n===style.local\nh1 { color: red; }\n===\n\n:props: model: Model\n:!props:\n\n# Title\n")
    check("a markdown heading carries the component's scope marker",
          styled.returncode == 0 and 'html_element("h1", [html_attr("data-s-' in styled.stdout,
          (styled.stderr or styled.stdout)[:400])

    # ---- a scoped selector keeps its pseudo LAST ----------------------------------------------
    #
    # `.row::before[data-s-hero]` is invalid CSS and a browser drops the whole rule **silently** — a
    # dropped rule looks exactly like a rule that decided not to change anything. Appending the marker
    # at the end of a selector is correct for `.row` and wrong for every `:hover`, `:focus`, `::before`
    # and `::after`, so every hover state in this repository was dead from the day styles landed.
    # Found by moving a checkbox into a pseudo-element to shorten a document: the squares left the
    # picture, and that was the only symptom there has ever been.
    pseudo = generate("===bx\nclass Model { n: Int }\nenum Msg { Nothing }\npure function update(msg: Msg, m: Model) -> Model { return m; }\n===\n\n===style.local\n.row::before { content: \"x\"; }\n.row:hover { color: red; }\n.card h1 { margin: 0; }\n===\n\n:props: model: Model\n:!props:\n\n:div: class=row\nhi\n:!div:\n")
    # **The stylesheet is a FILE beside the document, not stdout.** Reading the wrong stream is how
    # this assertion first "passed" against a program that had never been asked the question.
    sheet_path = os.path.join(work, "doc.css")
    sheet = open(sheet_path).read() if os.path.exists(sheet_path) else ""
    check("a style section writes a stylesheet", len(sheet) > 0, sheet_path)
    interesting = sheet[:300]
    check("the marker goes BEFORE a pseudo, not after it",
          "::before[data-s-" not in sheet and ":hover[data-s-" not in sheet, interesting)
    check("and it is still attached, so the rule is still scoped",
          "[data-s-c]::before" in sheet and "[data-s-c]:hover" in sheet, interesting)
    # A descendant selector stamps its LAST part, or a parent's rule would reach into a child.
    check("a descendant selector stamps its last part", "h1[data-s-c]" in sheet, interesting)

    # ---- `child=` — a body written in the head -------------------------------------------------
    #
    # BMX's heads are opaque bytes, so a one-line block has no delimiter between head and body and
    # BMX reads it as ALL head. Andre's answer is to name the body: `child=hello` is an ordinary
    # `name=value` pair, so the format changes not at all and there is nothing to guess.
    #
    # **It also closes a defect that predates one-liners.** `::: span class=text hello` read `hello`
    # as a boolean attribute and emitted `<span class="text" hidden></span>` — the text silently gone.
    kid = generate(":props: label: String\n:!props:\n\n:span: class=text child=hello\n:!span:\n")
    check("`child=` becomes the element's text, not an attribute",
          'html_attr("class", "text")], [html_text("hello")]' in kid.stdout, kid.stdout[-200:])
    quoted = generate(":props: label: String\n:!props:\n\n:span: child=\"two words\"\n:!span:\n")
    check("a quoted `child=` keeps its spaces and loses its quotes",
          'html_text("two words")' in quoted.stdout, quoted.stdout[-200:])
    # **Braces mean an EXPRESSION, and `child={}` is an empty body said out loud.** Andre's form: the
    # braces say where the value ends, so a body with spaces needs no quotes, and there is a spelling
    # for "deliberately empty" that is different from "content went missing".
    braced = generate(":props: label: String\n:!props:\n\n:span: child={label}\n:!span:\n")
    check("`child={expr}` is Burxt the compiler judges",
          "html_text(label)" in braced.stdout, braced.stdout[-200:])
    spaced = generate(":props: n: Int\n:!props:\n\n:span: child={to_string(n + 1)}\n:!span:\n")
    check("a braced body may hold spaces without quotes",
          "html_text(to_string(n + 1))" in spaced.stdout, spaced.stdout[-200:])
    empty = generate(":props: n: Int\n:!props:\n\n:span: class=box child={}\n:!span:\n")
    check("`child={}` is an element with NO children, not one holding \"\"",
          'html_attr("class", "box")], []' in empty.stdout, empty.stdout[-200:])
    # `{{ … }}` is the interpolation everywhere else in a head, so it has to mean the same here.
    slot = generate(":props: label: String\n:!props:\n\n:span: child={{ label }}\n:!span:\n")
    check("`child={{ x }}` means the same as `child={x}`",
          "html_text(label)" in slot.stdout, slot.stdout[-200:])
    both = generate(":props: label: String\n:!props:\n\n:div: child=one\ntwo\n:!div:\n")
    check("a `child=` AND a body is refused rather than one being picked",
          "STAR-E021" in (both.stderr + both.stdout), (both.stderr or both.stdout)[:160])
    void_child = generate(":props: label: String\n:!props:\n\n:input: child=nope\n:!input:\n")
    check("`child=` on a void element is refused",
          "STAR-E004" in (void_child.stderr + void_child.stdout),
          (void_child.stderr or void_child.stdout)[:160])
    bare = generate(":props: label: String\n:!props:\n\n:span: class=text hidden\n:!span:\n")
    check("and a bare word is STILL a boolean attribute, as in HTML",
          'html_attr("hidden", "")' in bare.stdout, bare.stdout[-200:])

    # ---- an attribute after `on:` is refused ---------------------------------------------------
    #
    # `on:` runs to the end of the head by design, so anything after it is eaten. Measured before the
    # refusal existed: `::: button on:click=n + 1 class=danger` emitted a button with NO class and
    # folded `class=danger` into the dispatch expression, which then failed to compile in generated
    # code with a message about a name the author never wrote there.
    after = generate(":props: n: Int\n:!props:\n\n:button: on:click=n + 1 class=danger\nhi\n:!button:\n")
    check("an attribute written after `on:` is refused, naming it",
          "STAR-E022" in (after.stderr + after.stdout)
          and "class=" in (after.stderr + after.stdout), (after.stderr or after.stdout)[:200])
    ok_order = generate(":props: n: Int\n:!props:\n\n:button: class=danger on:click=n + 1\nhi\n:!button:\n")
    check("and the same head with the attribute BEFORE it is accepted",
          ok_order.returncode == 0 and 'html_attr("class", "danger")' in ok_order.stdout,
          (ok_order.stderr or ok_order.stdout)[:200])
    # A handler with `==` or a quoted `=` inside it is not a trailing attribute.
    compare = generate(":props: n: Int\n:!props:\n\n:button: on:click=n + 1\nhi\n:!button:\n")
    check("a plain handler is not mistaken for one", compare.returncode == 0,
          (compare.stderr or compare.stdout)[:200])

    # ---- a single-brace ATTRIBUTE value is refused ---------------------------------------------
    #
    # `class={mark(x)}` reaches Burxt as the string literal `"{mark(x)}"` and produces the right class
    # only because Burxt interpolates braces inside its own string literals. A value holding a literal
    # brace would ship `{mark(x)}` to a browser and nothing would say so.
    #
    # **This is the check the day's last lesson asked for.** I shipped that spelling and two
    # screenshots agreed — an equality test says nothing about whether either side is right, and the
    # thing that caught it was reading the emitted attribute. So the emitted attribute is what is
    # asserted here, and the accident is a refusal rather than a documented footgun.
    one_brace = generate(":props: n: Int\n:!props:\n\n:span: class={to_string(n)}\nx\n:!span:\n")
    said = one_brace.stderr + one_brace.stdout
    check("a single-brace attribute value is refused, with the fix in the message",
          "STAR-E023" in said and "{{" in said, said[:200])
    two_brace = generate(":props: n: Int\n:!props:\n\n:span: class={{ to_string(n) }}\nx\n:!span:\n")
    check("and `{{ … }}` compiles to an EXPRESSION, not a string holding braces",
          'html_attr("class", (to_string(n)))' in two_brace.stdout, two_brace.stdout[-200:])
    # `child=` is the one place single braces are star's, and it must not be caught by this.
    still_child = generate(":props: n: Int\n:!props:\n\n:span: child={to_string(n)}\n:!span:\n")
    check("`child={…}` is untouched — the one place single braces are star's",
          "html_text(to_string(n))" in still_child.stdout, still_child.stdout[-200:])

    # ---- no refusal message teaches the old fence ----------------------------------------------
    #
    # **Four of them did, and a message is the compiler talking.** `Add \`::: props name: Type\`` told a
    # reader to write syntax BMX now refuses — an error that instructs you to write something illegal
    # is worse than an error that says nothing. They survived the 0.7 sweep because a message is a
    # string inside `star.bx`, and I had scoped the sweep to documents and fixtures.
    #
    # Read out of the SOURCE rather than by triggering each refusal: there are twenty-odd and a test
    # that fires only the ones somebody remembered is the shape that let these through.
    source = open(os.path.join(ROOT, "star.bx"), encoding="utf-8").read()

    # Read forward from each call to its BALANCED close, rather than matching the shape of the string.
    #
    # **A scan built around the syntax it is hunting cannot be wrong about a form nobody taught it.**
    # BMX built the same guard with a regex over quoted strings, and it captured 1 of 3 known positives
    # because the other two were template literals — its boolean control passed and its zero was over
    # incomplete text. A message here is a chain of concatenations with nested calls in it, which is the
    # same hazard wearing different clothes.
    def message_at(text, start):
        open_paren = text.index("(", start)
        depth, i = 0, open_paren
        while i < len(text):
            if text[i] == "(":
                depth += 1
            elif text[i] == ")":
                depth -= 1
                if depth == 0:
                    return text[open_paren + 1:i]
            i += 1
        return text[open_paren + 1:]

    sites = [m.start() for m in re.finditer(r"Result\.Error\(", source)]
    messages = [message_at(source, at) for at in sites]

    stale = [m for m in messages if ":::" in m]
    check("no refusal message teaches the 0.6 fence",
          not stale, "\n".join(m.strip()[:110] for m in stale[:4]))

    # **A QUANTITATIVE control, not a floor.** The floor here was `> 15` while the real number is 48 —
    # loose enough that a scan silently capturing a third of the messages would still pass, which is
    # precisely the failure BMX hit. So the two extractions are required to AGREE: a cheap regex and
    # the balanced read must see the same number of sites, and any drift means one of them is blind.
    cheap = re.findall(r"Result\.Error\((.*?)\);", source, re.S)
    check("every refusal site is captured — two extractions, same count",
          len(cheap) == len(messages) == len(sites),
          "regex %d, balanced %d, call sites %d" % (len(cheap), len(messages), len(sites)))
    check("and there are enough of them that a zero means something",
          len(messages) >= 40, "%d refusal messages found" % len(messages))
    # The positive control is a COUNT, not an existence: some messages must show the 0.7 fence, and
    # both methods must agree about how many.
    fence = re.compile(r":[A-Za-z][\w-]*:")
    check("the scan sees the messages that DO show a fence, and both methods agree",
          len([m for m in messages if fence.search(m)])
          == len([c for c in cheap if fence.search(c)]) > 0,
          "balanced %d, regex %d" % (len([m for m in messages if fence.search(m)]),
                                     len([c for c in cheap if fence.search(c)])))

    # ---- a comma separates head tokens ---------------------------------------------------------
    #
    # BMX 0.9 delimits a head — `:button: -> [on:click=save(id), .featured] Save :!button:` — and a
    # comma is the natural separator inside brackets, which is how Andre writes them. Until this
    # existed `class=card, id=main` produced **`class="card,"`**: the comma swallowed into the value,
    # silently, with no refusal.
    #
    # BMX found the identical shape in `BMX-E033`, where asking whether a `#` followed *whitespace*
    # let `#one,#two` evade the one-id rule in both implementations at once — 70 of 70 fixtures
    # agreeing while both were wrong.
    commas = generate(":props: n: Int\n:!props:\n\n:div: class=card, id=main\nhi\n:!div:\n")
    check("a comma separates head tokens, and is not part of the value",
          'html_attr("class", "card"), html_attr("id", "main")' in commas.stdout,
          commas.stdout[-220:])
    spaced = generate(":props: n: Int\n:!props:\n\n:div: class=card id=main\nhi\n:!div:\n")
    check("and a space still does, unchanged",
          'html_attr("class", "card"), html_attr("id", "main")' in spaced.stdout, spaced.stdout[-220:])

    # **The qualifier is the whole of it: a comma ends a value only at DEPTH ZERO.** A handler is full
    # of commas that separate ARGUMENTS, and a comma rule that could not see parentheses would cut
    # every keyed handler in this repository in half at the first one.
    handler = generate(":props: n: Int\n:!props:\n\n"
                       ":button: class=row, on:click=Msg.Toggle(string_to_int(key, 0))\nhi\n:!button:\n")
    check("a handler's own commas are arguments, not separators",
          "Msg.Toggle(string_to_int(key, 0))" in handler.stdout
          and 'html_attr("class", "row")' in handler.stdout, handler.stdout[-260:])
    # `child=` is found after a comma too — it used to test whether the PREVIOUS BYTE was a space.
    kid = generate(":props: n: Int\n:!props:\n\n:span: class=box, child={to_string(n)}\n:!span:\n")
    check("`child=` is still found when a comma precedes it",
          "html_text(to_string(n))" in kid.stdout, kid.stdout[-220:])
    # And an interpolation may still hold a comma without being cut.
    interp = generate(":props: n: Int\n:!props:\n\n:div: class={{ pick(n, 2) }}\nhi\n:!div:\n")
    check("an interpolated value may hold a comma",
          "pick(n, 2)" in interp.stdout, interp.stdout[-220:])

    # ---- a delimiter rule must know what PROTECTS a delimiter ----------------------------------
    #
    # BMX shipped `-> [title="a]b"]` splitting at the `]` inside the quoted value — an hour after
    # documenting why first-delimiter-wins was safe. I asked whether a `]` in a string was still the
    # first `]`, and then found the same class three times in star, in three different scanners:
    #
    #     child={pick("}", n)}          the `}` in the literal ended the braced value
    #     class={{ pick("}}", n) }}     the `}}` in the literal ended the interpolation — twice, once
    #                                   in the scan and again in the expression builder
    #
    # **The danger is not that a truncated value breaks, it is that it keeps working**: a cut
    # expression is still valid syntax, so it compiles and renders something plausible.
    for label, head, want in [
        ("a `}` inside a string in `child={}`",
         ':span: child={pick("}", n)}', 'html_text(pick("}", n))'),
        ("a `}}` inside a string in an interpolation",
         ':div: class={{ pick("}}", n) }}', 'html_attr("class", (pick("}}", n)))'),
        ("a comma inside a string",
         ':div: class={{ pick("a,b", n) }}', 'html_attr("class", (pick("a,b", n)))'),
        ("a space inside a string",
         ':div: class={{ pick("a b", n) }}', 'html_attr("class", (pick("a b", n)))'),
        ("a paren inside a string",
         ':span: child={pick(")", n)}', 'html_text(pick(")", n))'),
        ("a comma inside a quoted value",
         ':div: class="a,b"', 'html_attr("class", "a,b")'),
    ]:
        body = "\nhi\n:!div:\n" if head.startswith(":div:") else "\n:!span:\n"
        got = generate(":props: n: Int\n:!props:\n\n" + head + body)
        check(label, want in got.stdout, (got.stderr or got.stdout)[-200:])

    # And the ordinary shapes still work, so the guards did not buy correctness with breakage.
    mixed = generate(":props: n: Int\n:!props:\n\n:a: href=/x/{{ to_string(n) }}/y\ngo\n:!a:\n")
    check("a value mixing literal and interpolation is unaffected",
          'html_attr("href", "/x/" + (to_string(n)) + "/y")' in mixed.stdout, mixed.stdout[-200:])

    # ---- the SEVENTH costume: a comma inside a selector's parentheses --------------------------
    #
    # BMX found the class in a head, then in a slot, then in a link target — six instances across two
    # repositories in a day. This is the seventh, and it was a wrong ANSWER rather than a refusal:
    #
    #     .x:not(.a .b, .c)   ->   .x:not(.a .b[data-s-c], .c)[data-s-c]
    #
    # The splitter cut mid-parenthesis, so the marker landed INSIDE the `:not()` and the rule excluded
    # `.a .b[data-s-c]` instead of `.a .b`. Valid CSS, silent, wrong meaning — which is the shape all
    # seven shared.
    def sheet_for(css):
        generate("===bx\nclass Model { n: Int }\nenum Msg { Nothing }\n"
                 "pure function update(msg: Msg, m: Model) -> Model { return m; }\n===\n\n"
                 "===style.local\n" + css + "\n===\n\n"
                 ":props: model: Model\n:!props:\n\n:div: class=x\nhi\n:!div:\n")
        path = os.path.join(work, "doc.css")
        return open(path).read() if os.path.exists(path) else ""

    for label, css, want in [
        ("a comma inside `:not()` is not a separator",
         ".x:not(.a .b, .c) { color: red; }", ".x[data-s-c]:not(.a .b, .c)"),
        ("and the marker stays OUTSIDE the parentheses",
         ".a:not(.b, .c) { color: red; }", ".a[data-s-c]:not(.b, .c)"),
        ("a comma inside an attribute selector is protected",
         '[title="a,b"] { color: red; }', '[title="a,b"][data-s-c]'),
        ("a real selector list still splits",
         ".a, .b { color: red; }", ".a[data-s-c], .b[data-s-c]"),
        ("a descendant still stamps its last part",
         ".card h1 { margin: 0; }", ".card h1[data-s-c]"),
        ("and a pseudo-element still comes after the marker",
         '.row::before { content: "}"; }', ".row[data-s-c]::before"),
    ]:
        got = sheet_for(css)
        check(label, want in got, got[:160])

    shutil.rmtree(work, ignore_errors=True)

    if failures:
        print("\n%d failure(s):\n" % len(failures))
        for f in failures:
            print("  " + f + "\n")
        return 1
    print("\nall guarantees hold")
    return 0


if __name__ == "__main__":
    sys.exit(main())
