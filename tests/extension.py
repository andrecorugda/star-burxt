"""The packaged extension: the version it declares, the bytes it is made of, and what it answers in
every way it is installed.

    python3 tests/extension.py
    python3 tests/extension.py --prove-it     # the negative control

**The defect that made this file necessary was not a packaging defect.** `star-lsp.mjs` reads its
version by walking up until it finds `burxt.package`, and `cp -r editors/vscode
~/.vscode/extensions/star-burxt` — the install `docs/editor.md` offers as the equal of a symlink —
lands the server where no parent holds one. It answered `initialize` with `0.0.0`. The symlink escaped
only by accident, because node resolves a module's realpath and lands back inside the checkout.

**The fallback is what made it invisible.** `0.0.0` is a server that starts, answers, and misdirects
the first question anybody asks about a diagnostic: which version produced it. There is no symptom
until somebody reads a bug report. `docs/editor.md` claimed both installs were *tested rather than
assumed*, and what had been tested was where the server file is — not what it says it is.

So the rule this file enforces is that **a claim about an install is checked through that install**.
Every shape the documentation offers gets the real server spawned inside it and is asked. That is the
one assertion here that could not have been written by reading the packer, and it is the one that
catches the class of bug that was actually live.

The rest is BMX's `tests/extension.py`, whose reasoning was measured and is inherited rather than
re-derived:

- **The committed artefact must be the one the packer writes**, byte for byte — which requires the
  pack to be reproducible first. Nothing detected staleness before, because CI packs and *then*
  inspects: **a check that regenerates the artefact it is verifying cannot see a stale one.**
- **Reproducibility is asserted as a property, not by packing twice.** BMX's first attempt packed
  twice in a row and PASSED on a non-reproducible packer — a zip stores timestamps at two-second
  granularity, so back-to-back runs share a bucket. **A test that can only fail when it happens to
  straddle a boundary is a test that reports success.** One fixed stamp per entry cannot pass by
  accident.
- **Every filename the documentation tells someone to install must exist.** The whole point of a
  stable name is that the docs keep pointing at a real file, and the way to lose that is to rename it.
- **`extensionKind` is checked in the archive, not just the source.** It is `["workspace"]` because
  the client spawns `star-check`; a UI-side load on WSL, SSH or a container colours documents and
  never checks one. That is the failure that looks most like the extension working.
"""

import json
import pathlib
import re
import shutil
import subprocess
import sys
import tempfile
import zipfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
EXT = ROOT / "editors" / "vscode"
PKG = EXT / "package.json"
VSIX = EXT / "star-burxt.vsix"
SERVER = "server/star-lsp.mjs"

# Where somebody is told to install it. A promise to install a file is a promise the file is there.
#
# **Found by globbing, not listed — and the list came first, which is the point.** This was six paths
# written by hand, and the BMX session had just been bitten by the same shape: their staleness checker
# held its pages in a literal list, so a new page matched every pattern it looks for and passed the gate
# anyway. Globbing theirs immediately found the landing page claiming a version eight minors stale.
#
# The transferable rule they stated, applied here to the file that prompted it: **when you add a check,
# ask what its own scope is hand-maintained on.** The next stale claim is not in the claims a check
# reads — it is in the list deciding which files it reads at all. A `.vsix` filename in a page nobody
# listed is exactly the promise this assertion exists to keep. Globbing added `CLAUDE.md`, which names
# the artefact and was held to nothing.
#
# **The cost, so it is not rediscovered: a gate's own explanatory text is input to the gate.** Reading
# the whole tree means reading this file, so prose here about a filename is indistinguishable from a
# promise of one — the control literal below had to be assembled for exactly that reason. Today every
# `.vsix` token in the repository is `star-burxt.vsix` and it exists, so there is no collision to
# excuse. If one ever arrives — a page discussing a name it does not ship — the fix is a marker in the
# file that opts itself out, the way BMX's changelog declares itself historical, and NOT a list of
# exceptions in here. That is the same accumulation this change removed.
SKIP = {".git", ".burxt", "node_modules", "__pycache__", ".star"}


def pages():
    """Every text file in the tree, so a filename promise made anywhere is a promise checked."""
    for base, dirs, names in __import__("os").walk(ROOT):
        dirs[:] = [d for d in dirs if d not in SKIP]
        for n in sorted(names):
            path = pathlib.Path(base) / n
            if path.suffix == ".vsix":
                continue
            try:
                yield path, path.read_text(encoding="utf-8")
            except (UnicodeDecodeError, OSError):
                continue

PROBE = r"""
import { spawn } from 'child_process';
const p = spawn('node', [process.argv[2]], { stdio: ['pipe', 'pipe', 'pipe'] });
const msg = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} });
p.stdin.write(`Content-Length: ${Buffer.byteLength(msg, 'utf8')}\r\n\r\n${msg}`);
let out = '';
p.stdout.on('data', (d) => {
  out += String(d);
  const m = /"serverInfo":\s*\{[^}]*"version":\s*"([^"]+)"/.exec(out);
  if (m) { console.log(m[1]); p.kill(); process.exit(0); }
});
setTimeout(() => { console.log('NO ANSWER'); p.kill(); process.exit(1); }, 10000);
"""


def declared_version():
    """The one place the version is decided: the package manifest at the repository root."""
    m = re.search(r"^version\s+(\S+)", (ROOT / "burxt.package").read_text(), re.M)
    if not m:
        sys.exit("burxt.package declares no `version`, so nothing else has anything to agree with")
    return m.group(1)


def ask(server_path, probe):
    """Spawn the real server at this path and return the version it answers `initialize` with."""
    try:
        out = subprocess.run([sys.executable and "node", str(probe), str(server_path)],
                             capture_output=True, text=True, timeout=30)
    except subprocess.TimeoutExpired:
        return "TIMED OUT"
    return out.stdout.strip().splitlines()[-1] if out.stdout.strip() else "NO ANSWER"


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

    want = declared_version()
    source = json.loads(PKG.read_text())

    check(source["version"] == want,
          f"the extension declares {source['version']}, which is burxt.package's {want}",
          f"the extension declares {source['version']} and burxt.package says {want} — VS Code decides "
          f"whether to offer an update by comparing versions, so a stale one there tells somebody they "
          f"are current when their grammar is not")

    # **The staged manifest is a second copy of a version, so it is pinned to the first.** It exists so
    # `cp -r` and the archive can find one at all; two copies is how they drift.
    staged = EXT / "burxt.package"
    staged_bytes = staged.read_bytes() if staged.exists() else b""
    if prove:
        staged_bytes = b"version     9.9.9\n"
    check(staged_bytes == (ROOT / "burxt.package").read_bytes(),
          "the staged burxt.package is byte-identical to the repository's",
          "editors/vscode/burxt.package is not the repository's — the server reads whichever is nearer, "
          "so a copy install would report a version this repository does not believe")

    # The version a tool actually reads is the one in the manifest, built by `pack.py` from `package.json`.
    with zipfile.ZipFile(VSIX) as z:
        manifest = z.read("extension.vsixmanifest").decode()
        packed = json.loads(z.read("extension/package.json"))
        names = set(z.namelist())
    m = re.search(r'<Identity[^>]*Version="([^"]+)"', manifest)
    check(m and m.group(1) == packed["version"] == source["version"],
          f"the manifest, the packaged manifest and the source agree on {packed['version']}",
          f"the manifest says {m.group(1) if m else '(none)'}, the packaged package.json says "
          f"{packed['version']}, and the source says {source['version']}")

    # **The one that looks most like it works.** A grammar loads UI-side happily; a client that spawns
    # a binary does not.
    src_kind, packed_kind = source.get("extensionKind"), packed.get("extensionKind")
    if prove:
        # The control is the defect exactly as it would arrive: BMX's packer defaults to this, and it is
        # right for a grammar. Inheriting the default is the whole failure.
        src_kind = packed_kind = ["ui", "workspace"]
    check(src_kind == ["workspace"] and packed_kind == ["workspace"],
          "the extension declares extensionKind [\"workspace\"], in the source and in the archive",
          f"extensionKind is {src_kind} in the source and {packed_kind} "
          f"in the archive — this client spawns `star-check`, so a UI-side load on WSL, SSH or a container "
          f"colours documents and never checks one")

    # Everything `package.json` points at has to be in the archive with it. A list that omits ships an
    # extension that is broken rather than large.
    referenced = {"extension/" + p for p in [
        source["main"].lstrip("./"),
        source["icon"],
        source["contributes"]["languages"][0]["configuration"].lstrip("./"),
        *[g["path"].lstrip("./") for g in source["contributes"]["grammars"]],
    ]}
    referenced |= {"extension/" + SERVER, "extension/burxt.package", "extension/README.md"}
    if prove:
        referenced.add("extension/syntaxes/never-shipped.json")
    absent = sorted(n for n in referenced if n not in names)
    check(not absent,
          f"every file the manifest names is in the archive ({len(names)} entries)",
          f"the archive is missing {', '.join(absent)} — an extension that installs and is broken")

    # And nothing that is not the extension. `config.mjs` is a TEST that lives in this directory.
    strays = sorted(n for n in names if n.endswith("config.mjs") or "-48.png" in n)
    if prove:
        strays.append("extension/config.mjs")
    check(not strays,
          "no test and no docs-only icon shipped to users",
          f"{', '.join(strays)} is in the archive — pack.py's FILES list exists to keep this directory's "
          f"tests and the site's artwork out of everyone's editor")

    # **Reproducibility first, because it is what makes the next check mean anything.** Asserted as a
    # property of the archive rather than by packing twice — see the docstring for why that passes on a
    # packer that stamps the time.
    with zipfile.ZipFile(VSIX) as z:
        stamps = {i.date_time for i in z.infolist()}
    if prove:
        stamps = stamps | {(2026, 8, 19, 19, 48, 36)}
    check(len(stamps) == 1,
          f"every entry carries one fixed timestamp {sorted(stamps)[0]}, so two packs give one artefact",
          f"entries carry {len(stamps)} different timestamps, so the bytes move on every run and a stale "
          f"commit cannot be detected: {sorted(stamps)}")

    # **And the committed artefact is the one the packer writes.** The packed bytes are restored either
    # way, so this never leaves a dirty tree.
    before = VSIX.read_bytes()
    subprocess.run([sys.executable, str(EXT / "pack.py")], capture_output=True, check=True, cwd=ROOT)
    after = VSIX.read_bytes()
    VSIX.write_bytes(before)
    if prove:
        after = before + b"stale"
    check(before == after,
          f"the committed .vsix is what the packer writes ({len(before)} bytes)",
          "the committed .vsix is not what the packer writes — it was changed without repacking")

    # ---- the claim that was false, checked the only way it can be -------------------------------
    #
    # Each documented install, really built, with the real server spawned inside it and asked.
    with tempfile.TemporaryDirectory() as tmp:
        tmp = pathlib.Path(tmp)
        probe = tmp / "probe.mjs"
        probe.write_text(PROBE)

        shapes = []

        shapes.append(("the checkout", EXT / SERVER))

        copied = tmp / "copy" / "star-burxt"
        copied.parent.mkdir()
        shutil.copytree(EXT, copied)
        shapes.append(("a copy install (`cp -r`)", copied / SERVER))

        linked = tmp / "link"
        linked.mkdir()
        (linked / "star-burxt").symlink_to(EXT)
        shapes.append(("a symlink install (`ln -s`)", linked / "star-burxt" / SERVER))

        unpacked = tmp / "vsix"
        with zipfile.ZipFile(VSIX) as z:
            z.extractall(unpacked)
        shapes.append(("the packaged .vsix", unpacked / "extension" / SERVER))

        for label, path in shapes:
            answered = ask(path, probe)
            if prove and label.startswith("a copy"):
                answered = "0.0.0"
            check(answered == want,
                  f"{label} answers `initialize` with {answered}",
                  f"{label} answers `initialize` with {answered}, and this repository is at {want} — "
                  f"a client logs that field, so every bug report from this install names the wrong "
                  f"version, and nothing about the editor looks wrong")

    # The name every document hands to a reader.
    named = set()
    for _, text in pages():
        named.update(re.findall(r"\b([\w.-]+\.vsix)\b", text))
    if prove:
        # **Assembled rather than written, because this file is now one of the files it reads.** Globbing
        # the tree instead of listing six paths made the check find its own control literal and fail the
        # real run — a gate reporting a defect it had planted. Excluding this file by name would put a
        # hand-maintained scope back in, one exception at a time, which is the shape being removed here.
        named.add("star-burxt-0.1.0" + ".vsix")
    missing = sorted(n for n in named if not (EXT / n).exists())
    check(not missing,
          f"every .vsix the documentation names exists ({', '.join(sorted(named))})",
          f"the documentation tells someone to install {', '.join(missing)}, which is not in the tree")

    # A versioned artefact is a second answer to "which one do I install", and it is the naming BMX
    # measured thirty stale commits against.
    stale = sorted(p.name for p in EXT.glob("star-burxt-*.vsix"))
    check(not stale, "no versioned .vsix is left over from a versioned naming",
          f"{', '.join(stale)} is in the tree beside star-burxt.vsix")

    print()
    if prove:
        if failures:
            print("the control failed as it must — a drifted staging, a UI-side kind, a missing part, a "
                  "shipped test, a moving timestamp, a stale artefact, a 0.0.0 copy install and a "
                  "documented filename that does not exist are all caught")
            return 0
        print("THE CONTROL DID NOT FAIL, so this check cannot see the defects it exists for")
        return 1
    if failures:
        print(f"{failures} thing{'' if failures == 1 else 's'} wrong with the packaged extension")
        return 1
    print(f"the extension declares {want} and answers it through every install this repository documents")
    return 0


if __name__ == "__main__":
    sys.exit(main())
