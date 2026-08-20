// not-burxt: blocked — asserts the icons' ink fraction, which means inflating a PNG — needs zlib before it needs anything else
// `language-configuration.json` decides how the editor BEHAVES, and nothing tested it.
//
//     node editors/vscode/config.mjs
//
// **The grammar had a test, the language server had a test, the file that decides folding had none.**
// It keyed folding on `:::` and BMX respelled the fence in 0.7, so folding a block has been silently
// dead in the shipped extension ever since. **A fold that does not appear looks like a feature that
// was never there** — nobody reports that as a bug, which is exactly why it survived. Found because
// BMX hit the same defect in their own config and said so.
//
// The two cases the config predates are the interesting ones, and both are asserted below: a
// one-liner must not open a fold that never closes, and a 0.6 fence must not fold at all — a stale
// document that folds correctly looks like it works in an editor whose parser refuses it.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(readFileSync(join(here, 'language-configuration.json'), 'utf8'));

const start = new RegExp(config.folding.markers.start);
const end = new RegExp(config.folding.markers.end);

let failures = 0;
const check = (name, ok, detail) => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${name}`);
  if (!ok) {
    failures += 1;
    if (detail !== undefined) console.log('        ' + String(detail));
  }
};

// ---- a block folds -----------------------------------------------------------------------------
check('a block opener starts a fold', start.test(':section: class=card'));
check('its named closer ends one', end.test(':!section:'));
check('an indented opener folds too — indentation is insignificant as of BMX 0.6',
      start.test('        :button: on:click=Msg.Go'));
check('and an indented closer ends it', end.test('        :!button:'));

// ---- a section folds ---------------------------------------------------------------------------
check('a `===bx` section starts a fold', start.test('===bx'));
check('a bare `===` ends one', end.test('==='));

// ---- what must NOT fold ------------------------------------------------------------------------
//
// A one-liner closes itself. Starting a fold on it opens one nothing closes, so every line below
// collapses into it — worse than no folding, and it looks like the file is malformed.
check('a ONE-LINER does not start a fold',
      !start.test(':span: class=box :!span:'), 'it would open a fold nothing closes');
check('a one-liner with a body does not either',
      !start.test(':span: class=text child={task.label} :!span:'));

// A closer is not an opener, or every fold would start at the wrong line.
check('a closer does not start a fold', !start.test(':!section:'));

// **The 0.6 fence must not fold.** If it did, a stale document would behave correctly in an editor
// whose parser refuses it — which is the most confusing state available: the editor agrees and the
// build does not.
check('the 0.6 opener does not fold', !start.test('::: section class=card'));
check('the 0.6 closer does not either', !end.test(':::'));

// Prose is not markup.
check('a sentence mentioning a name in colons does not fold',
      !start.test('Use :tada: inside emoji(...) — see the note'), 'a shortcode is not a block');

// ---- the pairs the editor closes for you -------------------------------------------------------
const pairs = (config.autoClosingPairs || []).map((p) => (p.open ? p.open : p[0]));
check('`{{ ` auto-closes, because that is the interpolation', pairs.includes('{{ '), pairs.join(' '));

// ---- the file icon, and the property that actually matters ------------------------------------
//
// **Andre's complaint about the `.bx` icon was that it "looks like it is really sticking to the edge making
// it no space on the file tree line."** Measured by the language session, it filled 86% of its height — four
// clear pixels at 48px — and the fix was to crop each source to its own ink and centre it at 70%.
//
// The consistency is the point rather than the padding: `.bx`, `.bmx` and `.sbmx` sit on consecutive rows of
// a file tree, and an eye reads inconsistent margins as misalignment rather than as three different logos.
// So this asserts the FRACTION, not the bytes. A byte comparison against a re-derivation would need the
// derivation script and would go green on any pair of files that agree with each other — including two that
// are both wrong. **A new drop of artwork nobody re-derived is exactly the case this has to catch**, and the
// artwork arrives from another repository.
import { readFileSync as readIcon } from 'node:fs';
import { inflateSync } from 'node:zlib';

// How much of a PNG's height its opaque pixels occupy. The rows are unfiltered by hand because that is what
// a PNG is — there is no decoder here and this file takes no dependency.
function inkFraction(path) {
  const d = readIcon(path);
  const w = d.readUInt32BE(16), h = d.readUInt32BE(20), ctype = d[25];
  const chans = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[ctype];
  let idat = [];
  for (let i = 8; i < d.length;) {
    const len = d.readUInt32BE(i);
    if (d.toString('ascii', i + 4, i + 8) === 'IDAT') idat.push(d.subarray(i + 8, i + 8 + len));
    i += 12 + len;
  }
  const px = inflateSync(Buffer.concat(idat));
  const stride = w * chans;
  let prev = Buffer.alloc(stride), off = 0, top = null, bottom = null;
  for (let row = 0; row < h; row += 1) {
    const f = px[off]; off += 1;
    const line = Buffer.from(px.subarray(off, off + stride)); off += stride;
    for (let x = 0; x < stride; x += 1) {
      const a = x >= chans ? line[x - chans] : 0;
      const b = prev[x];
      const c = x >= chans ? prev[x - chans] : 0;
      if (f === 1) line[x] = (line[x] + a) & 255;
      else if (f === 2) line[x] = (line[x] + b) & 255;
      else if (f === 3) line[x] = (line[x] + ((a + b) >> 1)) & 255;
      else if (f === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        line[x] = (line[x] + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255;
      }
    }
    let opaque = chans !== 4;
    if (chans === 4) for (let x = 0; x < w; x += 1) if (line[x * 4 + 3] > 8) { opaque = true; break; }
    if (opaque) { if (top === null) top = row; bottom = row; }
    prev = line;
  }
  return { w, h, fraction: top === null ? 0 : (bottom - top + 1) / h };
}

{
  const declared = JSON.parse(readIcon(join(here, 'package.json'), 'utf8'));
  const lang = declared.contributes.languages.find((l) => l.id === 'sbmx');
  check('the `.sbmx` language declares a file icon', !!(lang && lang.icon), JSON.stringify(lang));

  for (const size of [48, 128]) {
    const { w, h, fraction } = inkFraction(join(here, 'icons', `sbmx-gear-icon-${size}.png`));
    check(`the ${size}px icon is square at its declared size`, w === size && h === size, `${w}x${h}`);
    // 70% is the family's number. The tolerance is a few pixels at 48px, not a licence to drift.
    check(`and its ink fills ${Math.round(fraction * 100)}% of the box, which must be 70% ± 3`,
          Math.abs(fraction - 0.70) <= 0.03,
          `an icon at 86% sits against the filename; the three file types must agree with each other`);
  }
}

console.log(failures ? `\n${failures} failure(s)` : '\nthe editor configuration behaves');
process.exit(failures ? 1 : 0);
