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
    good = ("::: props count: Int\n:::\n\nAt {{ to_string(count) }}.\n\n"
            "::: button on:click=count + 1\nmore\n:::\n")
    check("a correct component compiles", "no errors" in compile_component(good),
          compile_component(good))

    emitted = generate(good).stdout
    check("a handler reaches the page as an INDEX", "data-star-h" in emitted, emitted)
    check("no inline handler is ever emitted", "onclick" not in emitted, emitted)
    check("the handler expression reaches `dispatch`",
          "if handler == 0 { return count + 1; }" in emitted, emitted)

    # ---- what the COMPILER refuses ------------------------------------------------------------
    typo = compile_component("::: props count: Int\n:::\n\nAt {{ to_string(cuont) }}.\n")
    check("a slot typo is refused by name", "unknown variable: cuont" in typo, typo)

    wrong = compile_component('::: props count: Int\n:::\n\n'
                              '::: button on:click=count + "one"\ngo\n:::\n')
    check("a handler type error is refused",
          "cannot apply `+` to Int and String" in wrong, wrong)

    # The one no framework whose handlers are closures can make.
    money = compile_component("::: props total: Decimal<2>\n:::\n\n"
                              "::: button on:click=total * 1.5\nbump\n:::\n")
    check("money narrowing INSIDE a click handler is a compile error",
          "rounding" in money, money)

    # ---- what star-burxt refuses --------------------------------------------------------------
    unknown = generate("::: props count: Int\n:::\n\n::: mystery\nhi\n:::\n").stderr
    check("an undeclared block name is refused by name",
          "STAR-E001" in unknown and "mystery" in unknown, unknown)

    unwired = generate("::: props count: Int\n:::\n\n"
                       "::: button on:hover=count + 1\nhi\n:::\n").stderr
    check("an event this host cannot wire is refused (SPEC.md 4a.5)",
          "STAR-E002" in unwired and "on:hover" in unwired, unwired)

    voided = generate("::: props n: Int\n:::\n\n::: input on:input=n\noops\n:::\n").stderr
    check("a void element with a body is refused before it trips a contract",
          "STAR-E004" in voided, voided)

    flowed = generate("::: props n: Int\n:::\n\n::: button on:click=n + 1\n# nope\n:::\n").stderr
    check("flow content inside a phrasing element is refused",
          "STAR-E005" in flowed, flowed)

    looped = generate("::: props rows: [Row]\n:::\n\n::: for row in rows key row.id\n"
                      "::: li on:click=row.id\n{{ row.label }}\n:::\n:::\n").stderr
    check("a handler inside a `for` is refused, rather than emitting a name out of scope",
          "STAR-E007" in looped, looped)

    # ---- component mode: a `===bx` section, and handlers become MESSAGES ----------------------
    #
    # The accepting case first, as everywhere on this page: a suite of refusals is satisfied by a
    # generator that refuses everything.
    component = ("===bx\n"
                 "class Model { count: Int, history: [Int] }\n"
                 "enum Msg { Increment, Reset }\n"
                 "pure function update(msg: Msg, m: Model) -> Model {\n"
                 "    match msg {\n"
                 "        Increment => { return Model { count: m.count + 1, history: m.history }; }\n"
                 "        Reset     => { return Model { count: 0, history: m.history }; }\n"
                 "    }\n"
                 "}\n"
                 "===\n\n"
                 "::: props model: Model\n:::\n\n"
                 "At {{ to_string(model.count) }}.\n\n"
                 "::: button on:click=Msg.Increment\nmore\n:::\n")
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
    imported = generate("===bx\nuse \"std/string.bx\";\nclass Model { n: Int }\n"
                        "pure function update(msg: Int, m: Model) -> Model { return m; }\n===\n\n"
                        "::: props model: Model\n:::\n\nAt {{ to_string(model.n) }}.\n").stdout
    check("an author's `use` is hoisted above the generated header",
          imported.index('use "std/string.bx";') < imported.index("class Model"), imported)

    # A `===bx` section with no `update` is refused BY NAME rather than left to fail as a compiler
    # error about a function nobody wrote.
    orphan = generate("===bx\nclass Model { n: Int }\n===\n\n::: props model: Model\n:::\n\n"
                      "::: button on:click=Msg.Go\ngo\n:::\n").stderr
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
    routed = ("===bx\nuse \"std/string.bx\";\n"
              "enum Route { Home, Post(Int), Missing }\n"
              "class Model { route: Route, path: String }\n"
              "enum Msg { Navigate(String) }\n"
              "pure function route_of(path: String) -> Route {\n"
              "    if path == \"/\" { return Route.Home; }\n"
              "    if string_starts_with(path, \"/posts/\") {\n"
              "        return Route.Post(string_to_int(substring(path, 7, len(path) - 7), 0));\n"
              "    }\n"
              "    return Route.Missing;\n"
              "}\n"
              "pure function update(msg: Msg, m: Model) -> Model {\n"
              "    match msg {\n"
              "        Navigate(to) => { return Model { route: route_of(to), path: to }; }\n"
              "    }\n"
              "}\n===\n\n"
              "::: props model: Model\n:::\n\n"
              "::: nav\n\n::: a href=/posts/42\na post\n:::\n\n:::\n\n"
              "::: match model.route\n\n"
              "::: case Home\n\n# Welcome\n\n:::\n\n"
              "::: case Post(id)\n\n# Post {{ to_string(id) }}\n\n:::\n\n"
              "::: case Missing\n\n::: p\nNothing at {{ model.path }}\n:::\n\n:::\n\n:::\n")
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
    rows = ("===bx\nuse \"std/string.bx\";\n"
            "class Todo { id: Int, label: String }\n"
            "class Model { todos: [Todo] }\n"
            "enum Msg { Toggle(Int) }\n"
            "pure function update(msg: Msg, m: Model) -> Model { return m; }\n===\n\n"
            "::: props model: Model\n:::\n\n"
            "::: for todo in model.todos key to_string(todo.id)\n\n"
            "::: li\n\n::: button on:click=Msg.Toggle(string_to_int(key, 0))\n"
            "{{ todo.label }}\n:::\n\n:::\n\n:::\n")
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
        clash = generate("::: props %s: Int\n:::\n\nAt {{ to_string(%s) }}.\n" % (taken, taken)).stderr
        check("a prop named `%s` is refused by name, not by the compiler" % taken,
              "STAR-E019" in clash and taken in clash, clash)
    fine = generate("::: props amount: Int\n:::\n\nAt {{ to_string(amount) }}.\n")
    check("a prop named anything else is fine", fine.returncode == 0, fine.stderr)

    # ---- styles: `local` scopes, `global` does not, and neither is the default -----------------
    styled = ("===style.global\nbody { font-family: system-ui; }\n===\n\n"
              "===style.local\n.card { border: 1px solid #ddd; }\n"
              ".card p, .note { color: #555; }\n"
              "@media (max-width: 600px) { .card { padding: .5rem; } }\n===\n\n"
              "::: props n: Int\n:::\n\n::: div class=card\n\n::: p\ninside\n:::\n\n:::\n")
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
          'data-s-' not in generate("::: props n: Int\n:::\n\n::: div\nx\n:::\n").stdout,
          generate("::: props n: Int\n:::\n\n::: div\nx\n:::\n").stdout)

    # ---- components: another `.sbmx`, imported with `use`, called as a block -------------------
    with open(os.path.join(work, "Badge.sbmx"), "w") as f:
        f.write("::: props amount: Int, tone: String\n:::\n\n"
                "::: span class=badge\n{{ tone }}: {{ to_string(amount) }}\n:::\n")
    page = ("===bx\nuse \"./Badge.sbmx\";\n"
            "class Model { unread: Int }\n"
            "pure function update(msg: Int, m: Model) -> Model { return m; }\n===\n\n"
            "::: props model: Model\n:::\n\n"
            "::: Badge amount={{ model.unread }} tone=unread\n:::\n")
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

    unimported = generate("::: props n: Int\n:::\n\n::: Missing x=1\n:::\n").stderr
    check("a component block with no import is refused, and says what to write",
          "STAR-E001" in unimported and ".sbmx" in unimported, unimported)

    absent = generate("===bx\nuse \"./Nope.sbmx\";\nclass Model { n: Int }\n"
                      "pure function update(m: Int, x: Model) -> Model { return x; }\n===\n\n"
                      "::: props model: Model\n:::\n\nhi\n").stderr
    check("an import that does not resolve names the file and the importer",
          "Nope.sbmx" in absent and "imported by" in absent, absent)

    # ---- `match`: adding a screen and forgetting its view is a BUILD FAILURE -----------------
    #
    # This is the claim no JavaScript framework can make. React, Vue and Svelte give you a blank
    # page and a bug report; here the compiler names the variant nobody rendered.
    router = ("===bx\n"
              "enum Route { Home, Post(Int) }\n"
              "class Model { route: Route }\n"
              "pure function update(msg: Int, m: Model) -> Model { return m; }\n"
              "===\n\n"
              "::: props model: Model\n:::\n\n"
              "::: match model.route\n\n"
              "::: case Home\n\n# Welcome\n\n:::\n\n"
              "::: case Post(id)\n\n# Post {{ to_string(id) }}\n\n:::\n\n"
              ":::\n")
    check("a match over a route compiles", "no errors" in compile_component(router),
          compile_component(router))
    check("a case PATTERN destructures, so `id` is in scope in its branch",
          "Post(id) => {" in generate(router).stdout, generate(router).stdout)

    # The whole point, and it is checked by REMOVING a branch rather than by adding a variant —
    # same defect, and this way the fixture cannot pass because the compiler was lenient.
    missing = compile_component(router.replace(
        "::: case Post(id)\n\n# Post {{ to_string(id) }}\n\n:::\n\n", ""))
    check("A VARIANT WITH NO BRANCH IS A COMPILE ERROR, naming it",
          "does not handle `Post`" in missing, missing)

    stray = generate("::: props n: Int\n:::\n\n::: case Home\nx\n:::\n").stderr
    check("a `case` outside a `match` is refused", "STAR-E014" in stray, stray)
    loose = generate("::: props n: Int\n:::\n\n::: match n\n\ntext, not a case\n\n:::\n").stderr
    check("text between branches is refused — it has no branch to belong to",
          "STAR-E011" in loose, loose)
    empty = generate("::: props n: Int\n:::\n\n::: match n\n\n:::\n").stderr
    check("a match with no cases decides nothing, and is refused",
          "STAR-E013" in empty, empty)

    # ---- `else` -------------------------------------------------------------------------------
    branched = generate("::: props n: Int\n:::\n\n::: if n > 0\n\n::: p\nsome\n:::\n\n:::\n\n"
                        "::: else\n\n::: p\nnone\n:::\n\n:::\n").stdout
    check("an `else` becomes the other branch of the `if` above it",
          "else {" in branched, branched)
    orphaned = generate("::: props n: Int\n:::\n\nA paragraph.\n\n::: else\n\nx\n\n:::\n").stderr
    check("an `else` with no `if` directly above it is refused",
          "STAR-E016" in orphaned, orphaned)
    conditioned = generate("::: props n: Int\n:::\n\n::: if n > 0\n\nx\n\n:::\n\n"
                           "::: else n < 0\n\ny\n\n:::\n").stderr
    check("an `else` carrying a condition is refused rather than silently ignored",
          "STAR-E015" in conditioned, conditioned)

    # ---- positions: a refusal points AT the thing, in line:column -----------------------------
    #
    # These were byte offsets into the container until BMX 0.3 gave every node its own position.
    # `STAR-E005` said "at 112" — the button — when the heading was at 127, so a reader with a long
    # document was sent to the block and left to find the line themselves.
    located = generate("::: props n: Int\n:::\n\n# A page\n\nSome introduction\nover two lines.\n\n"
                       "::: div\n\n::: button on:click=n + 1\n# nope\n:::\n\n:::\n").stderr
    check("a refusal points at the OFFENDING construct, in line:column",
          "STAR-E005 at 12:1" in located, located)

    # `column` counts CHARACTERS, not bytes. A hand-rolled conversion is right on every ASCII line
    # and one place wrong on the first line with an accent in it — which is why this uses BMX's
    # `bmx_where` rather than star's own arithmetic, and why this fixture has an `å` in it.
    accented = generate("::: props n: Int\n:::\n\nA line with an å in it, then:\n\n"
                        "::: button on:click=n + 1\n# nope\n:::\n").stderr
    check("a line with a multi-byte character does not move the caret",
          "STAR-E005 at 7:1" in accented, accented)

    # ---- attributes, and the element vocabulary as a content model ---------------------------
    attrs = ("::: props post: Post\n:::\n\n"
             "::: div class=card\n\n"
             "::: span class=\"tag muted\"\ndraft\n:::\n\n"
             "::: a href=/posts/{{ to_string(post.id) }}\nread more\n:::\n\n"
             "::: input disabled\n:::\n\n:::\n")
    out = generate(attrs).stdout
    check("an attribute reaches the element", 'html_attr("class", "card")' in out, out)
    check("a quoted value keeps its spaces", 'html_attr("class", "tag muted")' in out, out)
    check("A VALUE INTERPOLATES, so a link can be computed from state",
          'html_attr("href", "/posts/" + (to_string(post.id)))' in out, out)
    check("a bare name is a boolean attribute", 'html_attr("disabled", "")' in out, out)

    # The vocabulary is three sets rather than one list, because the SPLIT is what refuses a
    # heading inside a button. A tag being present is not the interesting half.
    for tag in ["a", "textarea", "table", "select", "details", "dialog", "main", "figure"]:
        got = generate("::: props n: Int\n:::\n\n::: %s\nx\n:::\n" % tag)
        check("`%s` is an element star knows" % tag, got.returncode == 0, got.stderr)
    voided = generate("::: props n: Int\n:::\n\n::: source\nbody\n:::\n").stderr
    check("a NEWLY added void element is still refused a body",
          "STAR-E004" in voided, voided)
    flowed = generate("::: props n: Int\n:::\n\n::: textarea\n# nope\n:::\n").stderr
    check("a NEWLY added phrasing element still refuses a heading",
          "STAR-E005" in flowed, flowed)

    unclosed = generate("::: props n: Int\n:::\n\n::: div class=\"oops\nx\n:::\n").stderr
    check("a quote that never closes is refused rather than guessed at",
          "STAR-E009" in unclosed, unclosed)

    # ---- the content model has no seam --------------------------------------------------------
    one = generate("::: props n: Int\n:::\n\n::: button on:click=n + 1\nonly\n:::\n").stdout
    two = generate("::: props n: Int\n:::\n\n::: button on:click=n + 1\nfirst\n\nsecond\n:::\n").stdout
    kept = generate("::: props n: Int\n:::\n\n::: div\nkept\n:::\n").stdout
    check("one paragraph in a phrasing element unwraps",
          'html_element("p", [], [html_text("only")])' not in one, one)
    check("TWO paragraphs unwrap the same way — no discontinuity",
          'html_text("first"), html_text("second")' in two, two)
    check("a flow element KEEPS its paragraph — a content model, not 'strip paragraphs'",
          'html_element("p", [], [html_text("kept")])' in kept, kept)

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
