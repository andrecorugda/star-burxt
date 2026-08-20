// not-burxt: platform — patches the DOM, which only a JS engine can touch
// star-burxt's DOM reconciler.
//
// This is the one place in the driver that does more than hand bytes over, and it
// is worth saying exactly why it is allowed to exist. The rule is that the driver
// carries no APPLICATION logic — no templating, no escaping, no formatting, no
// state — because everything Burxt guarantees happens before the boundary. This
// is none of those. It compares two DOM trees, and the DOM is JavaScript's own
// data structure; there is no version of this that lives in wasm, because wasm
// cannot hold a node.
//
// **Why it is needed at all**, measured rather than assumed. With `innerHTML =` on
// every frame, one keystroke into a text input gives:
//
//     sameNodeAfterRender  false      activeElement  BODY
//     stillFocused         false      value          ""
//
// The node is destroyed and rebuilt, so focus, selection, scroll position and any
// in-flight IME composition go with it. A text input is unusable. The state was
// correct the whole time — the heading read "Hello A" — so this is not a data
// problem, it is that replacing a node is not the same as updating one.
//
// **No keys in this version, and the consequence is stated rather than hidden.**
// Children are matched by position. Reordering a list therefore rewrites every
// node from the first change onward, which is correct but wasteful, and a list
// whose items hold focus would lose it on reorder. Keys are the fix and they need
// a format decision — `::: for` would have to carry one — so they wait for that
// conversation rather than being guessed at here.
export function reconcile(parent, nextHTML) {
  const template = document.createElement('template');
  template.innerHTML = nextHTML;

  // **Moving a node blurs it**, because the DOM defines a move as a remove followed by an insert. So
  // where the caret was is recorded before the patch and put back after it — by NODE, which is the
  // whole point of matching by key: the same input element is still there to give it back to.
  const held = document.activeElement;
  const caret = held && typeof held.selectionStart === 'number' && parent.contains(held)
    ? { node: held, start: held.selectionStart, end: held.selectionEnd } : null;

  patchChildren(parent, template.content);

  if (caret && caret.node.isConnected && document.activeElement !== caret.node) {
    caret.node.focus();
    try { caret.node.setSelectionRange(caret.start, caret.end); } catch {}
  }
}

function patchChildren(oldParent, newParent) {
  // **Keys, and this file used to say they were "the fix" and wait for a format decision.** The
  // decision had already been made — `:for: … key …` has emitted `data-star-key` since it existed, and
  // the reconciler ignored it. Positional matching is not merely wasteful when a list REORDERS, which
  // is what the old comment said. Measured in a real browser: typing in the third row and moving that
  // row up left the caret at POSITION two, which by then held a different record — so the next
  // keystroke edited the wrong row, with the state and the DOM both correct. Silent, and exactly the
  // kind of thing only somebody using it finds.
  //
  // **The keyed nodes are aligned first, then patched positionally.** My first attempt matched by key
  // only when EVERY child carried one, which never fired: a `:for:` emits its rows as siblings of
  // whatever else the view rendered, so `<h1>` sat in the same parent and disqualified the list. A
  // loop's rows are a CONTIGUOUS RUN, so moving that run into the new order and then running the
  // existing positional pass gets both — no special case for headings, and one code path doing the
  // patching.
  alignKeys(oldParent, newParent);

  const oldKids = oldParent.childNodes;
  const newKids = newParent.childNodes;
  const shared = Math.min(oldKids.length, newKids.length);

  for (let i = 0; i < shared; i++) patchNode(oldKids[i], newKids[i]);

  // Surplus old nodes go; surplus new ones arrive. Removing from the end keeps
  // the live NodeList indices stable while we walk it.
  while (oldKids.length > newKids.length) oldParent.removeChild(oldKids[oldKids.length - 1]);
  for (let i = shared; i < newKids.length; i++) oldParent.appendChild(newKids[i].cloneNode(true));
}

// The keys a parent's element children carry, in order.
//
// `alignKeys` is exported for `tools/orders.mjs`. **Nothing in CI exercised this file at all** — every
// test mounts without a reconciler, so the whole module was covered by a landing-page screenshot and
// two manual browser sessions. There is no DOM in CI and this project does not take dependencies it
// does not own, so what is checked here is the ORDERING, against a small DOM that proves its own
// `insertBefore` moves rather than copies. The focus and caret half is browser-measured and says so.
function keysOf(parent) {
  const out = [];
  for (const node of parent.childNodes) {
    if (node.nodeType === 1 && node.hasAttribute('data-star-key')) {
      out.push([node.getAttribute('data-star-key'), node]);
    }
  }
  return out;
}

// Put the existing keyed nodes into the order the new markup names them, before anything is patched.
// Only nodes that appear on both sides move; arrivals and departures are left to the positional pass,
// which already handles a longer or shorter list.
export function alignKeys(oldParent, newParent) {
  const held = keysOf(oldParent);
  if (held.length < 2) return;                       // nothing can be out of order
  const wanted = keysOf(newParent).map(([key]) => key);
  if (wanted.length === 0) return;

  const byKey = new Map(held);
  const order = wanted.filter((key) => byKey.has(key));
  const already = held.map(([key]) => key).filter((key) => order.includes(key));
  if (order.join('\u0000') === already.join('\u0000')) return;   // the common case: nothing moved

  // **The anchor is what follows the whole run**, so a heading above it and a button below it stay
  // where the view put them. Anchoring on the last SURVIVOR instead was my first attempt and
  // `tools/orders.mjs` caught it: when a row departs, the survivors landed after the departing node,
  // and the positional pass then patched a survivor's identity onto it. Survivors first in the new
  // order, then whatever the new list no longer names — so the surplus is at the END, which is where
  // the positional pass removes from.
  const last = held[held.length - 1][1];
  const anchor = last.nextSibling;
  for (const key of order) oldParent.insertBefore(byKey.get(key), anchor);
  for (const [key, node] of held) {
    if (!order.includes(key)) oldParent.insertBefore(node, anchor);
  }
}

export function patchNode(oldNode, newNode) {
  // A different kind of node, or a different tag, cannot be updated into the
  // other — replace it and accept that its identity is gone. That is the honest
  // case; the point of the rest is that it is the rare one.
  if (oldNode.nodeType !== newNode.nodeType ||
      (oldNode.nodeType === 1 && oldNode.tagName !== newNode.tagName)) {
    oldNode.parentNode.replaceChild(newNode.cloneNode(true), oldNode);
    return;
  }

  if (oldNode.nodeType === 3) {
    // Text. Assigning an unchanged value would still churn the node, so check.
    if (oldNode.nodeValue !== newNode.nodeValue) oldNode.nodeValue = newNode.nodeValue;
    return;
  }

  if (oldNode.nodeType !== 1) return;

  // Attributes: set what changed, remove what went. Setting an attribute to the
  // value it already holds is not free in every engine, so compare first.
  for (const attr of newNode.attributes) {
    if (oldNode.getAttribute(attr.name) !== attr.value) oldNode.setAttribute(attr.name, attr.value);
  }
  for (const attr of Array.from(oldNode.attributes)) {
    if (!newNode.hasAttribute(attr.name)) oldNode.removeAttribute(attr.name);
  }

  // **A form control's value is state the DOM holds, not markup.** The rendered
  // HTML for `<input>` has no `value` attribute unless the view wrote one, and
  // even when it does, the attribute is the DEFAULT rather than the current
  // value. So the field is left alone unless the view is explicitly driving it —
  // otherwise every keystroke would fight the user for the caret.
  if (oldNode.tagName === 'INPUT') {
    if (newNode.hasAttribute('value') && oldNode.value !== newNode.getAttribute('value')) {
      oldNode.value = newNode.getAttribute('value');
    }
  }

  // **A `<textarea>`'s value is its CHILD CONTENT, not an attribute, and that is why restoring a draft
  // did nothing.** This branch used to ask both tags for a `value` attribute; a textarea rendered from
  // `{{ model.text }}` has none, so a component that loaded a saved note reported "restored" with the
  // field still empty — the state was right and the page was not. Worse than a visible failure, because
  // the status line said it had worked.
  //
  // Assigning only on a DIFFERENCE is what keeps this from fighting the caret: after a keystroke the
  // state and the field already agree, so nothing is written. That is the same reason the `input` case
  // above compares first, and the text is patched into the child node either way — this is about the
  // DOM's live value, which stops following its children the moment somebody types.
  if (oldNode.tagName === 'TEXTAREA') {
    const wanted = newNode.textContent;
    if (oldNode.value !== wanted) oldNode.value = wanted;
  }

  patchChildren(oldNode, newNode);
}
