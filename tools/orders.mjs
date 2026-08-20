// not-burxt: platform — mounts a keyed list and reads the DOM order back
// Does a keyed list end up in the order the view asked for?
//
//     node tools/orders.mjs
//
// **`:for: … key …` has emitted `data-star-key` since it existed and the reconciler ignored it.** The
// file's own comment called keys "the fix" and said they were waiting for a format decision that had
// already been made. Positional matching does not merely rewrite more nodes than it needs to, which is
// what that comment claimed: measured in a real browser, typing in the third row and moving THAT row up
// left the caret at position two, which by then held a different record. The next keystroke edited the
// wrong row, with the state and the DOM both correct.
//
// **What this file checks and what it cannot.** There is no DOM in CI and star takes no dependency it
// does not own, so the ORDERING is checked here against a small DOM below — and the DOM proves its own
// `insertBefore` MOVES a node rather than copying it, because a fake that copied would make every
// assertion below pass while the real defect survived. That is the third time a stub has been the
// weak link in this repository, so it is checked first.
//
// The focus-and-caret half is not fakeable honestly and is measured in a real browser instead:
//
//     php artisan serve  →  /rows  →  focus the third field, type, setSelectionRange(5,5),
//     dispatch a click on that row's `up` button, then read document.activeElement.
//
// Before: `activeElement.value` was "two" with the caret clamped to 3. After: "THIRD" with the caret
// still at 5, and the same NODE. Re-run it whenever this file changes.
import { alignKeys, patchNode } from '../examples/reconcile.js';

let failures = 0;
const check = (name, got, want) => {
  const ok = String(got) === String(want);
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${name}`);
  if (!ok) { failures += 1; console.log(`        got  ${JSON.stringify(got)}\n        want ${JSON.stringify(want)}`); }
};

// ---- a DOM small enough to read, faithful in the one way that matters -------------------------
const el = (tag, key = null) => {
  const node = { nodeType: 1, tagName: tag.toUpperCase(), childNodes: [], parentNode: null,
                 attrs: key === null ? {} : { 'data-star-key': String(key) } };
  node.hasAttribute = (n) => Object.prototype.hasOwnProperty.call(node.attrs, n);
  node.getAttribute = (n) => (node.hasAttribute(n) ? node.attrs[n] : null);
  Object.defineProperty(node, 'nextSibling', {
    get() {
      if (!node.parentNode) return null;
      const at = node.parentNode.childNodes.indexOf(node);
      return node.parentNode.childNodes[at + 1] ?? null;
    },
  });
  return node;
};

const parent = (...kids) => {
  const p = { nodeType: 1, tagName: 'DIV', childNodes: [] };
  p.insertBefore = (node, before) => {
    // **A move, not a copy** — the DOM defines `insertBefore` of a node already in the tree as a
    // remove followed by an insert, and that is exactly why a focused input gets blurred by a reorder.
    const at = p.childNodes.indexOf(node);
    if (at >= 0) p.childNodes.splice(at, 1);
    const to = before ? p.childNodes.indexOf(before) : -1;
    if (to < 0) p.childNodes.push(node); else p.childNodes.splice(to, 0, node);
    node.parentNode = p;
    return node;
  };
  p.removeChild = (node) => {
    const at = p.childNodes.indexOf(node);
    if (at >= 0) p.childNodes.splice(at, 1);
    node.parentNode = null;
    return node;
  };
  for (const k of kids) p.insertBefore(k, null);
  return p;
};

const order = (p) => p.childNodes.map((n) => n.getAttribute('data-star-key') ?? n.tagName).join(',');

// ---- the fake's own guarantee, first --------------------------------------------------------
{
  const a = el('div', 1), b = el('div', 2), c = el('div', 3);
  const p = parent(a, b, c);
  p.insertBefore(c, a);
  check('THE FAKE MOVES A NODE RATHER THAN COPYING IT', order(p), '3,1,2');
  check('and the node count is unchanged, so nothing was duplicated', p.childNodes.length, 3);
}

// ---- the case that was silently wrong -------------------------------------------------------
{
  const live = parent(el('h1'), el('div', 1), el('div', 2), el('div', 3));
  const next = parent(el('h1'), el('div', 1), el('div', 3), el('div', 2));
  const moved = live.childNodes[3];
  alignKeys(live, next);
  check('a row that moves up lands where the view put it', order(live), 'H1,1,3,2');
  check('and it is the SAME NODE, which is what a caret can be given back to',
        live.childNodes[2] === moved, true);
  check('the unkeyed heading is untouched, still first', live.childNodes[0].tagName, 'H1');
}

// ---- the ordinary case must not touch the tree -----------------------------------------------
{
  const live = parent(el('h1'), el('div', 1), el('div', 2), el('div', 3));
  const next = parent(el('h1'), el('div', 1), el('div', 2), el('div', 3));
  const before = live.childNodes.slice();
  alignKeys(live, next);
  check('an unchanged list moves nothing at all',
        before.every((n, i) => live.childNodes[i] === n), true);
}

// ---- a full reversal, and a list that grew or shrank -----------------------------------------
{
  const live = parent(el('li', 1), el('li', 2), el('li', 3));
  alignKeys(live, parent(el('li', 3), el('li', 2), el('li', 1)));
  check('a reversal reverses', order(live), '3,2,1');
}
{
  const live = parent(el('li', 1), el('li', 2));
  alignKeys(live, parent(el('li', 2), el('li', 9), el('li', 1)));
  check('an arrival is left to the positional pass, and what exists is still reordered',
        order(live), '2,1');
}
{
  const live = parent(el('li', 1), el('li', 2), el('li', 3));
  alignKeys(live, parent(el('li', 3), el('li', 1)));
  check('a departure does not disturb the survivors\' new order', order(live), '3,1,2');
}

// ---- and an unkeyed list is left entirely alone ----------------------------------------------
{
  const live = parent(el('li'), el('li'), el('li'));
  const before = live.childNodes.slice();
  alignKeys(live, parent(el('li'), el('li'), el('li')));
  check('a list with no keys is not reordered by guesswork',
        before.every((n, i) => live.childNodes[i] === n), true);
}

// ---- what a form control's value follows -------------------------------------------------------
//
// **A `<textarea>`'s value is its CHILD CONTENT, not an attribute**, and this branch used to ask both
// tags for a `value` attribute. A textarea rendered from `{{ model.text }}` has none, so a component
// that loaded a saved draft reported "restored" with the field still EMPTY — the state right, the page
// wrong, and a status line claiming success. Measured in a real browser before and after.
//
// What is checked here is the DECISION — assign on a difference, leave alone when equal, which is what
// keeps the view from fighting the caret. The reason the rule is needed at all is a browser behaviour no
// fake can honestly reproduce: a control's live value stops following its children the moment somebody
// types. That half is browser-measured: `/x/notes`, type, save, wipe, restore, then type again and read
// `selectionStart`.
const field = (tag, { value = '', text = '', attrs = {} } = {}) => {
  const node = { nodeType: 1, tagName: tag, value, childNodes: [], attrs: { ...attrs } };
  node.textContent = text;
  node.attributes = Object.entries(node.attrs).map(([name, v]) => ({ name, value: v }));
  node.hasAttribute = (n) => Object.prototype.hasOwnProperty.call(node.attrs, n);
  node.getAttribute = (n) => (node.hasAttribute(n) ? node.attrs[n] : null);
  node.setAttribute = (n, v) => { node.attrs[n] = v; };
  node.removeAttribute = (n) => { delete node.attrs[n]; };
  return node;
};

{
  const live = field('TEXTAREA', { value: '' });
  patchNode(live, field('TEXTAREA', { text: 'restored draft' }));
  check('a textarea takes its value from the child content', live.value, 'restored draft');
}
{
  // The one that keeps the caret: the state and the field already agree, so nothing is written.
  const live = field('TEXTAREA', { value: 'typed so far' });
  let writes = 0;
  Object.defineProperty(live, 'value', {
    get: () => 'typed so far', set: () => { writes += 1; },
  });
  patchNode(live, field('TEXTAREA', { text: 'typed so far' }));
  check('and it is NOT rewritten when it already agrees, so typing keeps the caret', writes, 0);
}
{
  const live = field('INPUT', { value: 'old' });
  patchNode(live, field('INPUT', { attrs: { value: 'new' } }));
  check('an input still follows its value ATTRIBUTE', live.value, 'new');
}
{
  const live = field('INPUT', { value: 'what the user typed' });
  patchNode(live, field('INPUT', {}));
  check('an input the view does not drive is left alone', live.value, 'what the user typed');
}

console.log(failures ? `\n${failures} failure(s)` : '\nthe reconciler moves what moved and drives what the view drives');
process.exit(failures ? 1 : 0);
