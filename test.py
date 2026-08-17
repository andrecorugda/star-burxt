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
        source = out.stdout.replace('use "lib/html.bx";', 'use "std/html.bx";')
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
