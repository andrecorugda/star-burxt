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

run "the site is Liquid-safe"        ./star-liquid
run "the guarantees"                 python3 test.py
run "every documented example"       python3 verify-docs.py
run "the highlighter"                node tools/paints.mjs
run "the editor configuration"       node editors/vscode/config.mjs
run "the showcase is current"        python3 tools/showcase.py

printf '  %-46s' "every component checks clean"
for doc in examples/*.sbmx; do
    if ! ./star-check "$doc" >/dev/null 2>&1; then
        printf 'FAILED\n      %s\n' "$doc"; exit 1
    fi
done
printf 'ok\n'

printf '\neverything green\n'
