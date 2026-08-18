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

# **Which compiler — asked by CAPABILITY, not by version, and that is not fastidiousness.**
#
# `burxt --version` prints `CARGO_PKG_VERSION`, so a `develop` build many commits past a release
# self-reports as the release: the constant does not move until the tag does. A "1.3.0 or newer" test
# therefore passes identically on the artefact and on a branch build that behaves nothing like it —
# **a check that cannot distinguish what it claims to distinguish.** The language session measured this
# and told me; my previous version of this block was exactly that check.
#
# So it compiles the two programs that actually decide whether star can be built. They are the same two
# that kept this project pinned to a branch until Burxt 1.3.0, and CI carries them for the same reason.
# A compiler that runs both can build star-burxt whatever it calls itself.
printf '  %-46s' "the compiler can build a component"
probe=$(mktemp -d)
trap 'rm -rf "$probe"' EXIT
cat > "$probe/relay.bx" <<'BX'
class Task  { id: Int, label: String }
class Model { tasks: [Task], count: Int }
enum Msg { Add }
pure function update(msg: Msg, m: Model) -> Model allocates {
    match msg {
        Add => {
            let mutable out: [Task] = [];
            let mutable i: Int = 0;
            while i < len(m.tasks) { let k: Int = push(out, m.tasks[i]); i += 1; }
            let n: Int = push(out, Task { id: m.count, label: "new" });
            return Model { tasks: out, count: m.count + 1 };
        }
    }
}
let mutable start: [Task] = [];
let a: Int = push(start, Task { id: 1, label: "one" });
print(to_string(len(update(Msg.Add, Model { tasks: start, count: 2 }).tasks)));
BX
cat > "$probe/pure.bx" <<'BX'
use "std/json.bx";
class Model { count: Int }
pure function to_text(m: Model) -> String allocates {
    let mutable f: [Field] = [];
    let a: Int = push(f, json_field("count", json_int(m.count)));
    return json_render(json_object(f));
}
print(to_text(Model { count: 7 }));
BX
if ! out=$(burxt check "$probe/relay.bx" 2>&1); then
    printf 'FAILED\n      this compiler cannot return a record holding a list:\n'
    printf '%s\n' "$out" | sed 's/^/      /'
    printf '      star-burxt needs Burxt 1.3.0 or newer.\n'
    exit 1
fi
if ! out=$(burxt check "$probe/pure.bx" 2>&1); then
    # **Two causes, two messages.** A compiler that cannot find `std/json.bx` has a broken install or
    # is old enough to resolve `std/` relative to the FILE; a compiler that finds it and refuses the
    # call lacks the `pure` markers. Reporting the second when it is the first sends a reader to look
    # for a language feature when their PATH is the problem — which is the mistake this script existed
    # to stop making, made inside the script.
    case "$out" in
        *"cannot read"*"std/"*)
            printf 'FAILED\n      this compiler cannot find its own standard library:\n'
            printf '%s\n' "$out" | sed 's/^/      /'
            printf '      Either the install is broken or the binary predates `std/` resolution.\n'
            printf '      Check `command -v burxt` and BURXT_LIB.\n' ;;
        *)
            printf 'FAILED\n      a `pure` function cannot call the JSON encoder on this compiler:\n'
            printf '%s\n' "$out" | sed 's/^/      /'
            printf '      star-burxt needs Burxt 1.3.0 or newer.\n' ;;
    esac
    exit 1
fi
printf 'ok\n'

run "the site is Liquid-safe"        ./star-liquid
run "the guarantees"                 python3 test.py
run "every documented example"       python3 verify-docs.py
run "the highlighter"                node tools/paints.mjs
run "the editor configuration"       node editors/vscode/config.mjs
run "the showcase is current"        python3 tools/showcase.py
run "every advertised ref exists"    python3 tools/refs.py
run "every published limitation holds" ./star-limits
run "the published surface is the real one" ./star-surface
run "HTML's content model, both ways" ./star-content
run "the collection and the directory agree" ./star-collection

printf '  %-46s' "every component checks clean"
for doc in examples/*.sbmx; do
    if ! ./star-check "$doc" >/dev/null 2>&1; then
        printf 'FAILED\n      %s\n' "$doc"; exit 1
    fi
done
printf 'ok\n'

printf '\neverything green\n'
