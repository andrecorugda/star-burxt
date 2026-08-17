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
  patchChildren(parent, template.content);
}

function patchChildren(oldParent, newParent) {
  const oldKids = oldParent.childNodes;
  const newKids = newParent.childNodes;
  const shared = Math.min(oldKids.length, newKids.length);

  for (let i = 0; i < shared; i++) patchNode(oldKids[i], newKids[i]);

  // Surplus old nodes go; surplus new ones arrive. Removing from the end keeps
  // the live NodeList indices stable while we walk it.
  while (oldKids.length > newKids.length) oldParent.removeChild(oldKids[oldKids.length - 1]);
  for (let i = shared; i < newKids.length; i++) oldParent.appendChild(newKids[i].cloneNode(true));
}

function patchNode(oldNode, newNode) {
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
  if (oldNode.tagName === 'INPUT' || oldNode.tagName === 'TEXTAREA') {
    if (newNode.hasAttribute('value') && oldNode.value !== newNode.getAttribute('value')) {
      oldNode.value = newNode.getAttribute('value');
    }
  }

  patchChildren(oldNode, newNode);
}
