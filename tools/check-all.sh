#!/bin/sh
# Everything CI runs, in one command, with `pipefail` — which is the point of the file.
#
# **A pipeline's exit status is the LAST command's, so `python3 test.py | tail -1` reports whether
# `tail` succeeded.** I ran the suite that way for a week and `set -e` never saw three failures; they
# were visible only in output nobody was reading closely. A verification script that cannot fail is
# the same defect this project keeps finding elsewhere, in the thing doing the finding.
set -eu
if [ -n "${BASH_VERSION-}" ]; then set -o pipefail; fi

run() {
    printf '  %-46s' "$1"
    shift
    if out=$("$@" 2>&1); then
        printf 'ok\n'
    else
        printf 'FAILED\n'
        printf '%s\n' "$out" | sed 's/^/      /'
        exit 1
    fi
}

# **Which compiler, checked first.** A stale `burxt` on PATH resolves `std/` relative to the file and
# the first failure is `cannot read examples/../std/html.bx` — an error about the standard library that
# is really an error about the binary. Said once, here, rather than puzzled over each time.
printf '  %-46s' "the compiler on PATH"
# **`burxt --version` writes to STDERR and exits 2**, so `2>/dev/null` discards the very line this
# reads — which it did, reporting "no burxt on PATH" while the compiler sat right there. Measured,
# because guessing which stream carries a version is how you write a check that is always red.
version=$(burxt --version 2>&1 | head -1 || true)
case "$version" in
    *" 1."*) printf 'ok  (%s)\n' "$version" ;;
    "")      printf 'FAILED\n      no `burxt` on PATH\n'; exit 1 ;;
    *)       printf 'FAILED\n      %s — star-burxt needs 1.3.0 or newer\n' "$version"; exit 1 ;;
esac

run "the site is Liquid-safe"        ./star-liquid
run "the guarantees"                 python3 test.py
run "every documented example"       python3 verify-docs.py
run "the highlighter"                node tools/paints.mjs
run "the editor configuration"       node editors/vscode/config.mjs
run "the showcase is current"        python3 tools/showcase.py
run "every advertised ref exists"    python3 tools/refs.py
run "every published limitation holds" ./star-limits

printf '  %-46s' "every component checks clean"
for doc in examples/*.sbmx; do
    if ! ./star-check "$doc" >/dev/null 2>&1; then
        printf 'FAILED\n      %s\n' "$doc"; exit 1
    fi
done
printf 'ok\n'

printf '\neverything green\n'
