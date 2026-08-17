#!/usr/bin/env python3
"""The guard this repository would otherwise not have.

There is no Ruby on the machines this site is written on, so Jekyll only runs after a push, and
**the first symptom of a bad page is a site that silently stops updating**. That is the worst shape
a failure can have: nothing is red, nothing is logged where you are looking, and the page you are
reading is the last good build.

`burxt-lang.org` went down for exactly one cause — a reference page containing `{{` was read as a
Liquid variable — and the main repository grew a test for it. A separate repository inherits none
of that, so this file is the equivalent, and it runs in CI on every push.

star-burxt's documentation shows slot syntax on nearly every page, so this is not hypothetical
here; it is the single most likely way to break this site.

    python3 check.py
"""
import os
import re
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
DOCS = os.path.join(ROOT, "docs")

FRONT_MATTER = re.compile(r"\A---\n(.*?)\n---\n", re.S)
# A Liquid delimiter is `{{` or `{%`. `{% raw %}` and `{% endraw %}` are the two that are allowed
# to appear outside a raw block, because they are what opens and closes one.
DELIM = re.compile(r"\{\{|\{%")
RAW_TAG = re.compile(r"\{%-?\s*(end)?raw\s*-?%\}")
# **Liquid this site MEANS to use.** The guard exists for delimiters that arrive by accident — slot
# syntax in prose, `{{ total }}` in an example — and a page that includes a partial or asks for
# `site.baseurl` is using Liquid on purpose. Narrow and explicit rather than a general escape: any
# delimiter that is not one of these is still an error, which is the whole value of the check.
INTENDED = re.compile(r"\{%-?\s*include\s+[\w./-]+\s*-?%\}|\{\{\s*site\.[\w.]+\s*\}\}")


def pages():
    for base, _, names in os.walk(DOCS):
        for name in sorted(names):
            if name.endswith(".md"):
                yield os.path.join(base, name)


def unprotected(text):
    """Every Liquid delimiter that Jekyll would interpret, with its line number.

    Walks the file rather than counting, because a page may legitimately open and close several
    raw blocks and a count cannot tell an unbalanced file from a balanced one.
    """
    found, in_raw = [], False
    for n, line in enumerate(text.splitlines(), 1):
        for tag in RAW_TAG.finditer(line):
            in_raw = tag.group(1) is None
        if in_raw:
            continue
        stripped = INTENDED.sub("", RAW_TAG.sub("", line))
        if DELIM.search(stripped):
            found.append((n, line.strip()))
    return found


def main():
    wrong = []
    counted = 0

    for path in pages():
        rel = os.path.relpath(path, ROOT)
        text = open(path, encoding="utf-8").read()
        counted += 1

        matter = FRONT_MATTER.match(text)
        if not matter:
            wrong.append("%s: no YAML front matter, so Jekyll will not lay it out" % rel)
            continue
        for key in ("layout", "title"):
            if not re.search(r"^%s:" % key, matter.group(1), re.M):
                wrong.append("%s: front matter has no `%s:`" % (rel, key))

        body = text[matter.end():]
        for line, content in unprotected(body):
            wrong.append("%s:%d: Liquid delimiter outside a raw block — Jekyll will try to "
                         "interpret it and the build will fail silently:\n    %s"
                         % (rel, line, content[:100]))

    if counted == 0:
        wrong.append("no pages found under docs/ — this check would pass by having nothing to say")

    # The CNAME is what makes the custom domain work; an empty or wrong one takes the site off its
    # address without any page being broken.
    cname = os.path.join(DOCS, "CNAME")
    if not os.path.exists(cname):
        wrong.append("docs/CNAME is missing — the site will not answer on its own domain")
    elif open(cname).read().strip() != "star.burxt-lang.org":
        wrong.append("docs/CNAME is not star.burxt-lang.org")

    if wrong:
        print("%d problem(s) in %d page(s):\n" % (len(wrong), counted))
        for w in wrong:
            print("  " + w)
        return 1

    print("%d pages, all wrapped, front matter present, CNAME correct" % counted)
    return 0


if __name__ == "__main__":
    sys.exit(main())
