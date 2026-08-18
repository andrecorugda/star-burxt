// Does a form show its own state?
//
//     node tools/flags.mjs <choices-render>
//
// **HTML has no false.** `checked="false"` is checked; the only spelling that means "not checked" is for
// the attribute not to be there. So a boolean attribute cannot carry a computed value, and until star
// compiled `checked={{ model.agree }}` into a DECISION rather than a value, a form could not show its own
// state: server-rendering `Choices.sbmx` with `agree: true` produced an unticked box and an unselected
// dropdown. The model was right and the page was wrong, with nothing reported — and a checkbox is the
// first thing anybody tries.
//
// This runs the native renderer twice, because the property is about presence and ABSENCE, and a test
// that only looks at one state cannot tell an attribute that is always there from one that is never
// there. Both columns, again.
import { execFileSync } from 'node:child_process';

const bin = process.argv[2];
if (!bin) { console.error('usage: node tools/flags.mjs <choices-render>'); process.exit(2); }

const render = (state) => execFileSync(bin, { input: JSON.stringify(state) }).toString();

let failures = 0;
const check = (name, ok, detail) => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${name}`);
  if (!ok) { failures += 1; if (detail !== undefined) console.log('        ' + String(detail).slice(0, 300)); }
};

const on  = render({ size: 'large',  tone: 'cool', agree: true,  note: '' });
const off = render({ size: 'small', tone: 'warm', agree: false, note: '' });

// The control first: both renders must actually be forms, or every absence below is vacuous.
check('both renders produced a form', /type="checkbox"/.test(on) && /type="checkbox"/.test(off), on.slice(0, 120));
check('and they are not the same page', on !== off);

const box = (html) => (html.match(/<input[^>]*type="checkbox"[^>]*>/) || [''])[0];
check('a checked box carries `checked`', /checked=""/.test(box(on)), box(on));
check('an unchecked box carries NOTHING — the only false HTML understands',
      !/checked/.test(box(off)), box(off));

const option = (html, value) => (html.match(new RegExp(`<option[^>]*value="${value}"[^>]*>`)) || [''])[0];
check('the chosen option is `selected`', /selected=""/.test(option(on, 'large')), option(on, 'large'));
check('the others are not', !/selected/.test(option(on, 'small')), option(on, 'small'));
check('and the choice follows the state', /selected=""/.test(option(off, 'small')), option(off, 'small'));

const radio = (html, value) => (html.match(new RegExp(`<input[^>]*value="${value}"[^>]*>`)) || [''])[0];
check('the chosen radio is checked', /checked=""/.test(radio(on, 'cool')), radio(on, 'cool'));
check('the other radio is not', !/checked/.test(radio(on, 'warm')), radio(on, 'warm'));

console.log(failures ? `\n${failures} failure(s)` : '\na form rendered on the server shows its own state');
process.exit(failures ? 1 : 0);
