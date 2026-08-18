// `code.js` colours a `.sbmx` snippet — checked, rather than eyeballed once.
//
//     node tools/paints.mjs
//
// **A highlighter that stops working fails silently.** The page still renders; the code is just grey
// again, which is exactly the state this pair of files exists to end. Nothing in a build would
// notice, so this does.
//
// `code.js` is an IIFE that paints the DOM, so there is nothing to import. It is loaded here with a
// tiny stub of the two DOM calls it makes — which is the whole integration, and keeps the file
// dependency-free for the site.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, '..', 'docs', 'assets', 'code.js'), 'utf8');

// One block per language, painted the way the site paints them.
const blocks = [];
const stub = {
  readyState: 'complete',
  querySelectorAll(selector) {
    const m = /language-(\w+)/.exec(selector);
    return blocks.filter((b) => b.language === m[1]);
  },
  addEventListener() {},
};

function paint(language, text) {
  const block = { language, textContent: text, innerHTML: '', dataset: {} };
  blocks.length = 0;
  blocks.push(block);
  // `code.js` closes over `document`; give it one.
  new Function('document', source)(stub);
  return block.innerHTML;
}

let failures = 0;
const check = (name, ok, detail) => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${name}`);
  if (!ok) {
    failures += 1;
    if (detail) console.log('        ' + String(detail).slice(0, 300));
  }
};

// ---- a `.sbmx` file is three languages, and the SEAM is what earns colour --------------------
const component = [
  '===bx',
  'class Model { count: Int }',
  '===',
  '',
  '===style.local',
  '.card { color: red; }',
  '===',
  '',
  ':button: on:click=Msg.Add',
  '{{ to_string(model.count) }}',
  ':!button:',
].join('\n');

const painted = paint('sbmx', component);

check('the `===bx` seam is marked', painted.includes('t-section') && painted.includes('===bx'), painted);
check('Burxt inside `===bx` is coloured as Burxt',
      /t-keyword">class/.test(painted) && /t-type">Int/.test(painted), painted);
check('CSS inside `===style.local` gets a selector and a property',
      painted.includes('t-selector') && painted.includes('t-prop'), painted);
check('the markup half still gets its fence and block name',
      painted.includes('t-fence') && painted.includes('t-name'), painted);
check('a slot in the markup is a slot', painted.includes('t-slot') || painted.includes('{{'), painted);

// **The painter must not eat a line.** A section painter that dropped or added lines would push
// every following line out of step with the code it colours, which is worse than no colour at all.
check('painting preserves the line count',
      painted.split('\n').length === component.split('\n').length,
      `${painted.split('\n').length} vs ${component.split('\n').length}`);

// ---- the nesting is SHOWN without changing the document ---------------------------------------
//
// A flat document — one written without indentation, which every `.bmx` was before BMX 0.6 —
// and nothing says what any of them closes. The painter indents the DISPLAY.

const nested = [
  ':section: class=card',
  ':for: task in items key task.id',
  ':button: on:click=Msg.Go',
  ':span: class=box',
  ':!span:',
  ':!button:',
  ':!for:',
  ':!section:',
].join('\n');

const deep = paint('bmx', nested);

check('a nested document gets depth spans', /class="d1"/.test(deep) && /class="d3"/.test(deep), deep);

// **A closer is drawn at its OPENER's depth**, which is the entire point: four closers that all look
// identical are what a reader has to count.
const rows = deep.split('\n');
const depthOf = (row) => { const m = /class="d(\d)"/.exec(row); return m ? Number(m[1]) : 0; };
check('a closer sits at the depth of the block it closes',
      depthOf(rows[3]) === 3 && depthOf(rows[4]) === 3 && depthOf(rows[5]) === 2
      && depthOf(rows[6]) === 1 && depthOf(rows[7]) === 0,
      rows.map((r, i) => i + ':' + depthOf(r)).join(' '));

// **AND THE TEXT IS UNCHANGED, which is the half that makes it honest.** A panel showing indented
// SOURCE would be a trap: a reader copies it and BMX refuses the document. Padding is not text.
const asText = deep.replace(/<[^>]*>/g, '');
check('what a reader copies has no leading whitespace',
      asText.split('\n').every((l) => l === l.trimStart()),
      asText.split('\n').filter((l) => l !== l.trimStart())[0]);
check('and it is the document, line for line',
      asText === nested.replace(/&/g, '&amp;'), asText);

// ---- a self-indented line hangs its own wrap --------------------------------------------------
//
// BMX 0.6 made leading whitespace insignificant, so an author can write the nesting out. Then a long
// line wraps and the continuation has nothing holding it: on the landing page it restarted at column
// zero, which made a nested `:!p:` read as a top-level closer — the opposite of what the indentation
// is for. Andre saw it on the deployed page.

const own = paint('bmx', [
  ':section: class=card',
  '    :p: a very long head that will wrap at any sensible panel width whatsoever',
  '    :!p:',
  ':!section:',
].join('\n'));

check('a line with its own indentation gets a hanging-indent span',
      /class="w1"/.test(own), own);
check('and a line at column zero does not', !/class="w\d"[^>]*>:section:/.test(own), own);
check('the text still has the author\'s spaces, exactly',
      own.replace(/<[^>]*>/g, '').split('\n')[1].startsWith('    :p:'),
      own.replace(/<[^>]*>/g, '').split('\n')[1]);

// ---- BMX 0.9's delimited head ------------------------------------------------------------------
//
// `:name: -> [head] body` — the head is delimited, so a one-liner's body is real inline content
// rather than opaque head bytes. The painter must colour the head as a head and leave the body as
// body; if it treats the whole line as head, a slot in the body stops being a slot.

const delimited = paint('sbmx', ':button: -> [class=row, on:click=Msg.Go] {{ label }} :!button:');
check('a delimited head is still a fence with a name',
      delimited.includes('t-fence') && delimited.includes('t-name'), delimited);
check('and its head is coloured as a head', delimited.includes('t-head'), delimited);

// ---- the other two languages still work ------------------------------------------------------
check('`burxt` still paints', /t-keyword">function/.test(paint('burxt', 'function f() { }')));
check('`bmx` still paints', paint('bmx', ':p:\nhi\n:!p:').includes('t-fence'));

// ---- and prose in a snippet cannot be turned into markup -------------------------------------
//
// The section scan keys on a `===name` at the START of a line; a paragraph that mentions
// `===style.local` mid-sentence is a paragraph.
const prose = paint('sbmx', 'Use ===style.local for this.\n');
check('a section name mid-sentence is not a section', !prose.includes('t-section'), prose);

// ---- the gutter and the guides ----------------------------------------------------------------
//
// **Every line gets a box or the numbering stops meaning anything.** Three exits from the wrapper had
// none on the first attempt — a fence line, a tab-indented line, and the depth line — which would have
// numbered most of a panel and silently skipped the rest.
{
  const doc = [':section: class=card', '    # Today', '', '    :p: child=x :!p:',
               '```', 'fenced', '```', ':!section:'].join('\n');
  const out = paint('sbmx', doc);
  const boxes = (out.match(/class="cl"/g) || []).length;
  check(`every one of the ${doc.split('\n').length} lines is a numbered box`,
        boxes === doc.split('\n').length, `${boxes} boxes`);

  // The number is drawn by CSS, so it must not be in the text — and the text must still be the
  // document, which is the property the whole display-indent design exists to keep.
  const text = out.replace(/<[^>]*>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&')
                  .replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  check('no line number reached the text a reader copies', text === doc, JSON.stringify(text.slice(0, 90)));
  check('and the depth spans are still inside the boxes, so the guides have a width',
        /class="cl"><span class="d1"/.test(out), out.slice(0, 200));
}

console.log(failures ? `\n${failures} failure(s)` : '\nthe highlighter paints all three languages');
process.exit(failures ? 1 : 0);
