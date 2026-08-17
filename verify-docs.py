#!/usr/bin/env python3
"""Every `.bmx` example on the site is generated, so the book cannot teach something that is refused.

**A tutorial that teaches a thing the tool rejects is worse than no tutorial**, because the reader
concludes they made the mistake. This found exactly that on its first run: chapter 1 opened with a
plain Markdown document and no `::: props`, which star-burxt refuses — so the first lesson on the
site did not work.

Most examples are FRAGMENTS: a reference page showing a `for` block should not have to carry a
props line to be readable. A fragment is given the preamble below before it is checked, so what is
under test is the block structure the example teaches rather than a document nobody would write.
Generation checks structure — block names, events, nesting, void elements — and leaves names and
types to the compiler, which is the right split for a page of fragments.

    python3 verify-docs.py
"""
import os, re, subprocess, sys, tempfile

ROOT = os.path.dirname(os.path.abspath(__file__))
GEN = os.path.join(ROOT, "star-generate")

# Every prop the site's examples mention. A fragment naming something that is not here is a page
# using a name it never introduced, which is worth failing on.
PREAMBLE = ("::: props count: Int, name: String, greeting: String, unread: Int, ready: Bool,"
            " total: Decimal<2>, subtotal: Decimal<2>, shipping: Decimal<2>, lines: [Line],"
            " draft: String, options: [Choice], go: Bool, thing: Line\n:::\n\n")


def examples():
    for base, _, names in os.walk(os.path.join(ROOT, "docs")):
        for n in sorted(names):
            if not n.endswith(".md"):
                continue
            path = os.path.join(base, n)
            text = open(path, encoding="utf-8").read()
            # Fences with a language tag (```sh, ```burxt) are not documents. Matching them
            # anyway is not a style point: an untagged regex pairs an opening ``` with the CLOSING
            # fence of a tagged block, and then hands prose to the generator as if it were an
            # example. That happened, and the report blamed a paragraph.
            for m in re.finditer(r"^```(\w*)\n(.*?)^```", text, re.S | re.M):
                if m.group(1):
                    continue
                body = m.group(2)
                if ":::" not in body and "{{" not in body:
                    continue
                yield (os.path.relpath(path, ROOT), text[:m.start()].count("\n") + 1, body)


def main():
    if not os.path.exists(GEN):
        print("build the generator first:\n  burxt build examples/generate.bx -o star-generate")
        return 2

    # Examples that are MEANT to be refused — a page about refusals has to show the thing it
    # refuses. Keyed by the message the page promises, so a fixture cannot drift from its prose.
    expected_refusals = {
        "::: mystery": "STAR-E001",
        "on:hover": "STAR-E002",
        "type here": "STAR-E004",
        "# Click me": "STAR-E005",
        "if ready key": "STAR-E006",
        "remove": "STAR-E007",
        "::: props name: Type": "STAR-E003",
    }

    work = tempfile.mkdtemp(prefix="star-docs-")
    doc = os.path.join(work, "d.bmx")
    wrong, checked, refuted = [], 0, 0

    for path, line, body in examples():
        source = body if "::: props" in body else PREAMBLE + body
        open(doc, "w").write(source)
        out = subprocess.run([GEN, doc, "c"], capture_output=True, text=True, cwd=ROOT)
        said = (out.stderr or out.stdout).strip()

        want = next((code for marker, code in expected_refusals.items() if marker in body), None)
        if want:
            refuted += 1
            if want not in said:
                wrong.append("%s:%d expected %s and got: %s" % (path, line, want, said[:90] or "no error"))
            continue

        checked += 1
        if out.returncode != 0:
            wrong.append("%s:%d is refused:\n      %s\n%s"
                         % (path, line, said.splitlines()[0][:110],
                            "".join("      | " + l + "\n" for l in body.strip().splitlines())))

    if wrong:
        print("%d problem(s) in %d examples:\n" % (len(wrong), checked + refuted))
        for w in wrong:
            print("  " + w + "\n")
        return 1
    print("%d examples generate, %d are refused exactly as their page promises" % (checked, refuted))
    return 0


if __name__ == "__main__":
    sys.exit(main())
