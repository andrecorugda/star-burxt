#!/usr/bin/env python3
# not-burxt: blocked — needs `std/zip.bx` IN A RELEASE. `editors/vscode/pack.bx` is written, verified
#            and byte-equivalent, but CI installs the published compiler and 1.4.0's lib has no
#            zip module, so main went red the moment this file was deleted. The port waits on a
#            release, not on the code — writes the .vsix, and a .vsix is a ZIP — Burxt has no std/zip.bx, stored-only would be enough, and the same addition unblocks the packer in all three repositories
"""Package the extension as a .vsix, with no toolchain.

    python3 editors/vscode/pack.py
    code --install-extension editors/vscode/star-burxt.vsix

Adapted from BMX's packer, which adapted Burxt's. A .vsix is a ZIP with three things in it: an OPC
content-types map, a VSIX manifest, and the extension under `extension/`. `vsce` does more than this —
linting, dependency bundling, marketplace checks — and all of it is for publishing, none of it for
installing locally. The extension has no npm dependencies (`client.js` requires `vscode`,
`child_process` and `fs`; the server takes node builtins only; there is no `node_modules`), so a
packer in the standard library is the whole job, and it keeps the promise that this directory needs
no toolchain to use.

Why package at all when `editors/README.md` says a symlink works: an installed extension is
registered, versioned, upgradable and uninstallable through the normal UI. A symlink works until
something scans the registry and does not find you.

**Three things here are star's rather than BMX's, and each is a defect avoided rather than taste.**

`extensionKind` is `["workspace"]`, read from `package.json` where it is declared. BMX's packer
defaults to `["ui", "workspace"]` because a grammar spawns nothing — but this extension spawns
`star-check`, and a UI-side load on WSL, SSH or a container puts the extension where the binary is
not. Taking BMX's default would have produced an extension that highlights and never checks, on
exactly the setups where that is hardest to notice.

The FILES list is authored, not globbed — a stray file never ships. That cuts both ways and the
first direction is the live one: `config.mjs` sits in this directory and is a TEST (it asserts the
folding markers and the icons' ink fraction; `tools/check-all.sh` and CI run it). A glob would ship
a test to every user. Four of the six icons are for `docs/` and for that test, and only the one
`package.json` names is packaged. The other direction is why `tests/extension.py` exists: a list can
also omit, and an omitted file ships an extension that is broken rather than large.

And `burxt.package` is STAGED into this directory from the repository root, which is the part that
was not cosmetic. The server reads the version by walking up until it finds that manifest, and
**`cp -r editors/vscode ~/.vscode/extensions/star-burxt` — the install `docs/editor.md` offers as the
equal of a symlink — landed it where no parent held one, so it answered `initialize` with `0.0.0`.**
The symlink escaped only by accident: node resolves a module's realpath, so it lands back in the
checkout. A .vsix is that same failure made unconditional, because an archive contains `extension/`
and nothing above it. Staging the manifest beside the server fixes all four shapes — checkout, copy,
symlink, archive — with one mechanism and no change to the resolution logic. `tests/extension.py`
asserts the staged copy is byte-identical to the root one, because two copies of a version is how
they drift.
"""

import json
import zipfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent

# Everything that belongs in the package. Listed rather than globbed — see the docstring: this
# directory holds a test and five icons that are not the extension's.
FILES = [
    "package.json",
    "client.js",
    # Staged from the repository root a moment before packing. The server walks up for this, and
    # without it in the archive there is nothing above `extension/` to find.
    "burxt.package",
    "language-configuration.json",
    "syntaxes/sbmx.tmLanguage.json",
    # Injected into BMX rather than contributed as a language, so it colours a slot and a block head
    # in a `.bmx` as well as a `.sbmx`. `package.json` names it; leaving it out is a silent half-install.
    "syntaxes/star-injection.tmLanguage.json",
    "icons/sbmx-gear-icon-128.png",
    "README.md",
]

# `burxt.package` has no extension in the usual sense — OPC maps by suffix, so `.package` needs a
# line here or the archive declares a part it has no type for.
CONTENT_TYPES = """<?xml version="1.0" encoding="utf-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension=".json" ContentType="application/json"/>
  <Default Extension=".js" ContentType="application/javascript"/>
  <Default Extension=".mjs" ContentType="application/javascript"/>
  <Default Extension=".package" ContentType="text/plain"/>
  <Default Extension=".png" ContentType="image/png"/>
  <Default Extension=".svg" ContentType="image/svg+xml"/>
  <Default Extension=".md" ContentType="text/markdown"/>
  <Default Extension=".xml" ContentType="text/xml"/>
  <Default Extension=".vsixmanifest" ContentType="text/xml"/>
</Types>
"""

ICON = "icons/sbmx-gear-icon-128.png"


def escape(text):
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def manifest(pkg):
    tags = ",".join(pkg.get("keywords", []))
    categories = ",".join(pkg.get("categories", []))
    # **Read, with no default.** BMX's packer falls back to `["ui", "workspace"]`, which is right for a
    # grammar and wrong for this: `client.js` spawns `star-check`, so a UI-side load on a remote puts
    # the extension where the binary is not. Declared in `package.json` so an editor reading the source
    # folder sees the same answer the archive does.
    kind = pkg.get("extensionKind")
    if not kind:
        raise SystemExit(
            "package.json declares no `extensionKind`. This extension spawns `star-check`, so it must "
            'say ["workspace"] — a UI-side load on WSL, SSH or a container colours documents and never '
            "checks one, which is the failure that looks like the extension working"
        )
    return f"""<?xml version="1.0" encoding="utf-8"?>
<PackageManifest Version="2.0.0" xmlns="http://schemas.microsoft.com/developer/vsx-schema/2011" xmlns:d="http://schemas.microsoft.com/developer/vsx-schema-design/2011">
  <Metadata>
    <Identity Language="en-US" Id="{escape(pkg['name'])}" Version="{escape(pkg['version'])}" Publisher="{escape(pkg['publisher'])}"/>
    <DisplayName>{escape(pkg.get('displayName', pkg['name']))}</DisplayName>
    <Description xml:space="preserve">{escape(pkg.get('description', ''))}</Description>
    <Tags>{escape(tags)}</Tags>
    <Categories>{escape(categories)}</Categories>
    <GalleryFlags>Public</GalleryFlags>
    <Properties>
      <Property Id="Microsoft.VisualStudio.Code.Engine" Value="{escape(pkg['engines']['vscode'])}"/>
      <Property Id="Microsoft.VisualStudio.Code.ExtensionDependencies" Value=""/>
      <Property Id="Microsoft.VisualStudio.Code.ExtensionPack" Value=""/>
      <Property Id="Microsoft.VisualStudio.Code.ExtensionKind" Value="{escape(','.join(kind))}"/>
      <Property Id="Microsoft.VisualStudio.Services.Links.Source" Value="{escape(pkg.get('repository', {}).get('url', ''))}"/>
    </Properties>
    <Icon>extension/{ICON}</Icon>
  </Metadata>
  <Installation>
    <InstallationTarget Id="Microsoft.VisualStudio.Code"/>
  </Installation>
  <Dependencies/>
  <Assets>
    <Asset Type="Microsoft.VisualStudio.Code.Manifest" Path="extension/package.json" Addressable="true"/>
    <Asset Type="Microsoft.VisualStudio.Services.Content.Details" Path="extension/README.md" Addressable="true"/>
    <Asset Type="Microsoft.VisualStudio.Services.Icons.Default" Path="extension/{ICON}" Addressable="true"/>
  </Assets>
</PackageManifest>
"""


def main():
    pkg = json.loads((HERE / "package.json").read_text())

    # **The filename carries no version, and that is a fix inherited rather than a style copied.** BMX
    # measured what the alternative costs: `bmx-<version>.vsix` put the version in seven places — two
    # READMEs, three doc pages, the packer's docstring, CI — so bumping it broke every install command in
    # the repository, and **thirty commits changed the package while the version never moved off 0.1.0.**
    # VS Code decides whether to offer an update by comparing versions, so everyone who installed the
    # first one keeps a stale grammar and is told they are current. A version belongs where a tool reads
    # it. `tests/extension.py` fails if `package.json` is not bumped.
    out = HERE / f"{pkg['name']}.vsix"

    # Staged rather than symlinked, because a symlink inside a zip is a file nobody can read. Written
    # into this directory rather than only into the archive, so `cp -r` gets it too — that install is
    # documented and it is the one that was broken.
    (HERE / "burxt.package").write_bytes((ROOT / "burxt.package").read_bytes())

    missing = [f for f in FILES if not (HERE / f).exists()]
    if missing:
        raise SystemExit(f"cannot package, these are missing: {missing}")

    # **Every entry gets the same fixed timestamp, so packing twice gives identical bytes.** Inherited
    # from BMX with its reasoning intact: without it the two entries written from strings take the
    # current time and the staged manifest carries a fresh mtime, so the bytes move on every run — and
    # **a committed artefact that cannot be reproduced cannot be checked against its source.** A stale
    # .vsix then becomes undetectable, which matters most in CI, where the pack step overwrites the
    # evidence one line before the inspect step looks at it.
    #
    # BMX also recorded the trap, and it is worth not re-entering: a reproducibility check that packs
    # twice in a row PASSES on a non-reproducible packer, because a zip stores timestamps at two-second
    # granularity and back-to-back runs share a bucket. `tests/extension.py` asserts the fixed stamp as
    # a property of the archive instead, which cannot pass by accident.
    EPOCH = (1980, 1, 1, 0, 0, 0)   # the earliest a zip can represent

    def entry(name, external=0o644 << 16):
        info = zipfile.ZipInfo(name, date_time=EPOCH)
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = external
        return info

    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr(entry("[Content_Types].xml"), CONTENT_TYPES)
        z.writestr(entry("extension.vsixmanifest"), manifest(pkg))
        for name in FILES:
            z.writestr(entry(f"extension/{name}"), (HERE / name).read_bytes())

    print(f"wrote {out.relative_to(ROOT)} "
          f"({out.stat().st_size} bytes, version {pkg['version']})")
    print("install with:  code --install-extension", out)


if __name__ == "__main__":
    main()
