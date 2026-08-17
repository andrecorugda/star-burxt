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

console.log(failures ? `\n${failures} failure(s)` : '\nthe editor configuration behaves');
process.exit(failures ? 1 : 0);
