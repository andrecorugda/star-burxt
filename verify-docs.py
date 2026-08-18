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
PREAMBLE = (":props: count: Int, name: String, greeting: String, unread: Int, ready: Bool, total: Decimal<2>, subtotal: Decimal<2>, shipping: Decimal<2>, lines: [Line], draft: String, options: [Choice], go: Bool, thing: Line\n:!props:\n\n")


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
                # `sbmx` is what a star document IS, so a tagged example is still an example — the
                # tag is what earns it syntax colour on the site. Every OTHER tag (`sh`, `html`,
                # `error`) is not a document and must not reach the generator.
                if m.group(1) and m.group(1) != "sbmx":
                    continue
                body = m.group(2)
                # A `===` section counts only at the start of a line. A refusal message
                # that MENTIONS `===style.local` mid-sentence is prose, and feeding prose to
                # the generator produces a report that blames a paragraph.
                has_section = re.search(r"^===\w", body, re.M) is not None
                # **A 0.7 fence is `:name:`, so looking for `:::` stopped finding examples.** BMX
                # respelled the fence in 0.7 and this line decides whether a block is a document at
                # all — it would have quietly skipped every migrated example and reported a smaller
                # number as a pass.
                has_fence = re.search(r"^\s*:!?[A-Za-z][\w-]*:", body, re.M) is not None
                if not has_fence and "{{" not in body and not has_section:
                    continue
                yield (os.path.relpath(path, ROOT), text[:m.start()].count("\n") + 1, body)


def quoted_messages():
    r"""Every refusal the pages QUOTE must be one the generator still emits.

    **A page quoting a message the compiler stopped emitting is worse than a stale example**, because
    the example is checked and the quote is not: a reader searches for the sentence they were shown and
    finds nothing. `docs/guide/01` quoted `Add \`::: props name: Type\`` for a day after that message
    was respelled, and only Andre reading the page found it.

    Compared on the DISTINCTIVE tail rather than the whole line, because a page wraps a message and a
    source file concatenates one — neither holds it as a single string, and requiring that would fail
    on formatting rather than on content.
    """
    source = open(os.path.join(ROOT, "star.bx"), encoding="utf-8").read()
    # Everything star.bx can say, with the Burxt string plumbing removed so a quote can be found in it.
    said = re.sub(r'"\s*\+\s*[\w_.\[\]()+ ]*?\+\s*"', "", source)
    said = said.replace('\\`', '`').replace('\\"', '"')

    wrong = []
    for base, _, names in os.walk(os.path.join(ROOT, "docs")):
        for n in sorted(names):
            if not n.endswith(".md"):
                continue
            path = os.path.join(base, n)
            text = open(path, encoding="utf-8").read()
            for m in re.finditer(r"^(STAR-E\d+): ?(.{12,60})", text, re.M):
                code, tail = m.group(1), m.group(2).strip()
                if code not in source:
                    wrong.append("%s:%d quotes %s, which star.bx does not emit at all"
                                 % (os.path.relpath(path, ROOT),
                                    text[:m.start()].count("\n") + 1, code))
                elif tail.split("`")[0].strip() and tail.split("`")[0].strip() not in said:
                    wrong.append("%s:%d quotes %s with wording star.bx does not have: %r"
                                 % (os.path.relpath(path, ROOT),
                                    text[:m.start()].count("\n") + 1, code,
                                    tail.split("`")[0].strip()[:48]))
    return wrong


def hidden_fences():
    """Code blocks the extractor above cannot see, which is worse than a block that fails.

    A four-backtick fence is invisible to `examples()` — the pattern needs a newline right after the
    optional word — so two component examples on the landing page were never generated and never
    compiled, and nothing said so. They happened to be correct. **A block that escapes the checker
    reads exactly like a block that passed it**, so finding them is worth its own failure.
    """
    bad = []
    for base, _, names in os.walk(os.path.join(ROOT, "docs")):
        for n in sorted(names):
            if not n.endswith(".md"):
                continue
            path = os.path.join(base, n)
            text = open(path, encoding="utf-8").read()
            for m in re.finditer(r"^(`{4,})(\w*)\n(.*?)^\1", text, re.S | re.M):
                body = m.group(3)
                if (re.search(r"^\s*:!?[A-Za-z][\w-]*:", body, re.M) or "{{" in body
                        or re.search(r"^===\w", body, re.M)):
                    bad.append("%s:%d is a %d-backtick fence holding an example, which the checker "
                               "cannot see — use ```sbmx"
                               % (os.path.relpath(path, ROOT), text[:m.start()].count("\n") + 1,
                                  len(m.group(1))))
    return bad


def main():
    if not os.path.exists(GEN):
        print("build the generator first:\n  burxt build examples/generate.bx -o star-generate")
        return 2

    # Examples that are MEANT to be refused — a page about refusals has to show the thing it
    # refuses. Keyed by the message the page promises, so a fixture cannot drift from its prose.
    expected_refusals = {
        ":mystery:": "STAR-E001",
        "on:hover": "STAR-E002",
        "type here": "STAR-E004",
        "# Click me": "STAR-E005",
        ":if: ready key": "STAR-E006",
        "remove": "STAR-E007",
        "Msg.Toggle(todo.id)": "STAR-E007",
        "# A component with nothing declared": "STAR-E003",
    }

    work = tempfile.mkdtemp(prefix="star-docs-")
    doc = os.path.join(work, "d.bmx")

    # Components the pages show the reader, written beside the examples so a page teaching
    # `::: Badge` is checked against a `Badge` that exists. Its props are the ones the pages use —
    # a component here that did not match the documented call would make this check a fiction.
    open(os.path.join(work, "Badge.sbmx"), "w").write(
        ":props: amount: Int, tone: String\n:!props:\n\n:span: class=badge\n{{ tone }}: {{ to_string(amount) }}\n:!span:\n")
    wrong, checked, refuted, typechecked = list(hidden_fences()) + quoted_messages(), 0, 0, [0]

    for path, line, body in examples():
        # **An example that is MEANT to be refused is fed verbatim.** The preamble below supplies a
        # `props` block to fragments, which quietly repairs the one example whose whole point is not
        # having one — and a test that repairs its input tests the repair. Decided before the source is
        # assembled, so there is one place where it is decided.
        want = next((code for marker, code in expected_refusals.items() if marker in body), None)
        # **Only the STAR-E003 example is fed verbatim, and only that one.** The preamble supplies a
        # `props` block to fragments, which quietly repairs the one example whose whole point is not
        # having one — a test that repairs its input tests the repair. Every OTHER refusal fragment
        # still needs the preamble, or it hits E003 before reaching the refusal it is demonstrating.
        if want == "STAR-E003":
            source = body
        elif ":props:" in body:
            source = body
        elif "===bx" in body:
            # A component-mode fragment gets the props its OWN declarations imply. The general
            # preamble names types no page declares (`lines: [Line]`), which is fine for a structure
            # check and is not a program — and these blocks go to the compiler.
            source = body + "\n:props: model: Model\n:!props:\n"
        else:
            source = PREAMBLE + body
        # A fragment that calls a component needs the import too — the surrounding page has it and
        # the excerpt does not, which is what makes it a fragment.
        if ":Badge:" in source and "use \"./Badge.sbmx\"" not in source:
            source = ("===bx\nuse \"./Badge.sbmx\";\n"
                      "pure function update(msg: Int, m: Int) -> Int { return m; }\n===\n\n"
                      + source)
        # A `===bx` section shown to teach ONE thing — an import, a style, an effect — is a fragment
        # too, and STAR-E008 is right to want an `update` in a real file. Supply the missing half
        # rather than making every excerpt carry it.
        if "===bx" in source and "function update" not in source:
            # The injected `update` has to agree with what the fragment DECLARED: a block that
            # defines a `Model` gets an update over that Model, or the generated dispatch names a
            # type the example never wrote.
            # The generated driver names the message type `Msg` and the state `Model`, so a
            # fragment that shows one framework function still needs both to exist.
            head = "" if "enum Msg" in source else "enum Msg { Nothing }\n"
            head += "" if "class Model" in source else "class Model { count: Int }\n"
            source = source.replace(
                "===bx\n",
                "===bx\n" + head + "pure function update(msg: Msg, m: Model) -> Model { return m; }\n", 1)
        open(doc, "w").write(source)
        out = subprocess.run([GEN, doc, "c"], capture_output=True, text=True, cwd=ROOT)
        said = (out.stderr or out.stdout).strip()

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
            continue

        # **Generation checks structure; it cannot check a NAME.** An example calling
        # `command_get(...)` generates perfectly and does not exist — which is how chapter 7 was
        # first written, and how chapter 6 shipped a linker line naming two functions that had been
        # renamed. So a component-mode example goes to the real compiler.
        if re.search(r"^===bx", body, re.M):
            typechecked[0] += 1
            bx = os.path.join(work, "c.bx")
            open(bx, "w").write(out.stdout)
            chk = subprocess.run(["burxt", "check", bx], capture_output=True, text=True, cwd=work)
            if chk.returncode != 0:
                first = ((chk.stderr or chk.stdout).strip().splitlines() or ["no output"])[0]
                wrong.append("%s:%d generates but does not compile:\n      %s\n%s"
                             % (path, line, first[:130],
                                "".join("      | " + l + "\n" for l in body.strip().splitlines())))

    if wrong:
        print("%d problem(s) in %d examples:\n" % (len(wrong), checked + refuted))
        for w in wrong:
            print("  " + w + "\n")
        return 1
    print("%d examples generate (%d of them typecheck), %d are refused exactly as their page promises"
          % (checked, typechecked[0], refuted))
    return 0


if __name__ == "__main__":
    sys.exit(main())
