"""star used the way a consumer uses it: from somewhere else, with the commands only on `PATH`.

    python3 tests/consuming.py
    python3 tests/consuming.py --prove-it     # the negative control

**Every other check in this repository runs from this repository's root, and that is why none of them
could see the bug this file exists for.** `star-build` defaulted its generator to `./star-generate` — a
path into whichever directory you are standing in. From the root, where the binary sits, a sibling
lookup and a `PATH` lookup resolve to the same file, so no test could tell them apart. A person who
declared star as a dependency, built the commands the way `docs/install.md` says to, and put them on
`PATH` got:

    sh: 1: ./star-generate: not found

**and a zero-byte `.bx` left behind**, because the shell's redirect creates the file before the command
is found. An empty artefact is worse than none: the next reader cannot tell it from real output.

It was found by building `comet-code-playground` — a real consumer repository that installs star with
`burxt fetch` — rather than by anything in here. That is the finding behind the finding: **a check that
runs where the code lives cannot see what depends on where the code lives.** The same shape as
`tests/extension.py`, which had to spawn the real server inside each documented install because "both
are tested" was true of where the server file is and false of what it reports.

So this runs star from a temporary directory with nothing but the built commands on `PATH`, which is the
one configuration the rest of the suite never exercises.
"""

import os
import pathlib
import shutil
import subprocess
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parent.parent

# **Stateful on purpose, and the first version of this file was not.** A document without `to_text` and
# `from_text` defines none of the four exports `star-build` roots, so `--gc-sections` empties the module
# and the assertion below passed on 1,615 bytes of nothing. No imports, so this exercises the consumer
# path rather than resolution.
DOCUMENT = """===bx
use "std/json.bx";

class Model { n: Int }
enum Msg { Bumped }

pure function update(msg: Msg, m: Model) -> Model {
    match msg { Bumped => { return Model { n: m.n + 1 }; } }
}

pure function to_text(m: Model) -> String allocates {
    let mutable f: [Field] = [];
    let a: Int = push(f, json_field("n", json_int(m.n)));
    return json_render(json_object(f));
}

function from_text(text: String) -> Model {
    return Model { n: 0 };
}
===

:props: model: Model
:!props:

:button: on:click=Msg.Bumped
Count is {{ to_string(model.n) }}
:!button:
"""

# The document the build tool used to accept and turn into an exportless module.
STATELESS = """:props: n: Int
:!props:

# Count is {{ to_string(n) }}
"""


def main():
    prove = "--prove-it" in sys.argv
    failures = 0

    def check(ok, ok_line, fail_line):
        nonlocal failures
        if ok:
            print(f"  ok    {ok_line}")
        else:
            failures += 1
            print(f"  FAIL  {fail_line}")

    missing = [t for t in ("star-generate", "star-build") if not (ROOT / t).exists()]
    if missing:
        sys.exit(f"build {', '.join(missing)} first — see CLAUDE.md")

    with tempfile.TemporaryDirectory() as tmp:
        tmp = pathlib.Path(tmp)
        (tmp / "Widget.sbmx").write_text(DOCUMENT)

        # `PATH` carries the commands and nothing else points at this repository. The cwd is the
        # temporary directory, so `./star-generate` cannot resolve — which is the whole point.
        env = dict(os.environ)
        env["PATH"] = f"{ROOT}{os.pathsep}{env.get('PATH', '')}"
        env.pop("STAR_GENERATE", None)
        env.pop("BURXT_LIB", None) if prove else None

        # ---- the accepting case, first and fatally ------------------------------------------------
        #
        # A suite of failure assertions is satisfied by a `star-build` that never works, so this runs
        # first: if a consumer cannot build at all, nothing below it means anything.
        done = subprocess.run(["star-build", "Widget.sbmx", "widget", "out"],
                              cwd=tmp, env=env, capture_output=True, text=True)
        wasm = tmp / "out" / "widget.wasm"
        # **A file that exists is not a module that works.** Asserting `size > 0` would pass a module
        # `--gc-sections` had emptied — the language session shipped a 122-byte wasm that instantiated
        # cleanly and exported nothing, because an export name was misspelled and every root was
        # dropped. So the exports are read, and the component's own entry point has to be among them.
        exports = []
        if wasm.exists():
            listed = subprocess.run(
                ["node", "-e", "const fs=require('fs');"
                 "console.log(WebAssembly.Module.exports(new WebAssembly.Module("
                 "fs.readFileSync(process.argv[1]))).map(e=>e.name).join(','))", str(wasm)],
                capture_output=True, text=True)
            exports = [e for e in listed.stdout.strip().split(",") if e]
        built = any(e.startswith("bx.widget") for e in exports)
        if prove:
            built = False
            done.stderr = "sh: 1: ./star-generate: not found"
        check(built,
              f"a consumer builds a component with the commands only on PATH "
              f"({wasm.stat().st_size if wasm.exists() else 0} bytes, exporting "
              f"{', '.join(e for e in exports if e.startswith('bx.')) or 'nothing'})",
              f"a consumer cannot build: {done.stderr.strip().splitlines()[-1] if done.stderr.strip() else 'no output'}"
              f" — every check in this repository runs from its root, where `./star-generate` resolves"
              f" and a PATH lookup resolves to the same file, so only this one can see it")

        # ---- and a failure leaves nothing that looks like output ----------------------------------
        env_broken = dict(env)
        env_broken["STAR_GENERATE"] = "/nonexistent/star-generate"
        subprocess.run(["star-build", "Widget.sbmx", "broken", "bad"],
                       cwd=tmp, env=env_broken, capture_output=True, text=True)
        left = sorted(p.name for p in (tmp / "bad").iterdir()) if (tmp / "bad").exists() else []
        if prove:
            left = ["broken.bx"]
        check(not left,
              "a generator that cannot run leaves no truncated artefact behind",
              f"a failed build left {', '.join(left)} — the shell's redirect creates the file before the"
              f" command is found, and a zero-byte `.bx` cannot be told from real output")

        # ---- and a document that cannot work is refused where the person is standing ---------------
        #
        # This is the defect the export assertion above exposed: `star-build` wrote a 1,615-byte module
        # with no `bx.` exports and exited 0. `examples/app.js` catches it, but at MOUNT time in a
        # browser console, to somebody who has already deployed.
        (tmp / "Flat.sbmx").write_text(STATELESS)
        flat = subprocess.run(["star-build", "Flat.sbmx", "flat", "flatout"],
                              cwd=tmp, env=env, capture_output=True, text=True)
        said = (flat.stdout + flat.stderr)
        refused = flat.returncode != 0 and "does not carry its own state" in said
        if prove:
            refused = False
            said = "(built it anyway)"
        check(refused,
              "a document with no state is refused at build time, not at mount time",
              f"a stateless document built without complaint — that writes a module exporting nothing,"
              f" which loads and can do nothing, and the only thing that says so is the browser: {said.strip()[:90]}")

    print()
    if prove:
        if failures:
            print("the control failed as it must — a consumer who cannot build, and a truncated "
                  "artefact left where output belongs, are both caught")
            return 0
        print("THE CONTROL DID NOT FAIL, so this check cannot see the defects it exists for")
        return 1
    if failures:
        print(f"{failures} thing{'' if failures == 1 else 's'} wrong with star as a dependency")
        return 1
    print("star builds a component for somebody who only has it on PATH")
    return 0


if __name__ == "__main__":
    sys.exit(main())
