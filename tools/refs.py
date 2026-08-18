#!/usr/bin/env python3
"""Every git ref the documentation tells a reader to depend on must exist.

    python3 tools/refs.py

**The README told readers to depend on `v0.2.0`, a tag that does not exist**, while the install page
said `v0.1.0` — so one instruction fails to fetch and the other fetches a framework 55 commits behind
that cannot read a single example on the site. Two pages, two answers, neither true.

BMX found the same family by grepping their own claims of absence: a README saying the format was 0.4
when it was 0.11, and a page listing *"what exists as of 0.2"* frozen before four features shipped.
**A version claim is a claim like any other, and nothing was checking these.**

It greps for the SHAPE of a dependency line rather than keeping a list of files, because a registry
cannot see an instruction added somewhere new — which is the same reason their version check greps
phrasings.
"""
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEPENDENCY = re.compile(r"^dependency\s+(\S+)\s+(\S+)\s+(\S+)\s*$", re.M)


def resolves(ref):
    """Does this ref exist in the repository it names?

    Local refs are checked locally; `main` is checked as a branch. A remote lookup would make this
    depend on the network, and a check that cannot run offline is a check that gets skipped.
    """
    for candidate in (ref, "refs/tags/" + ref, "origin/" + ref):
        got = subprocess.run(["git", "rev-parse", "--verify", "--quiet", candidate],
                             cwd=ROOT, capture_output=True, text=True)
        if got.returncode == 0:
            return True
    return False


def main():
    wrong, checked = [], 0
    for base, dirs, names in os.walk(ROOT):
        if "/.git" in base or "/.burxt" in base or "node_modules" in base:
            continue
        for name in sorted(names):
            if not name.endswith((".md", ".package")):
                continue
            path = os.path.join(base, name)
            text = open(path, encoding="utf-8").read()
            for m in DEPENDENCY.finditer(text):
                package, url, ref = m.groups()
                # Only this project's own refs can be checked without a network.
                if "star-burxt" not in url:
                    continue
                checked += 1
                if not resolves(ref):
                    wrong.append("%s:%d tells a reader to depend on `%s`, which does not exist"
                                 % (os.path.relpath(path, ROOT),
                                    text[:m.start()].count("\n") + 1, ref))

    if not checked:
        print("no `dependency star …` line found anywhere — the pattern has stopped matching")
        return 1
    if wrong:
        print("%d problem(s):" % len(wrong))
        for w in wrong:
            print("  " + w)
        return 1
    print("%d dependency ref(s) named by the documentation, all of which exist" % checked)
    return 0


if __name__ == "__main__":
    sys.exit(main())
