// not-burxt: platform — reads and writes the address bar
// star-burxt's router — the half of a single-page app that JavaScript has to do.
//
// **A path is a String, and a String crosses the wasm boundary.** So routing needs nothing the
// language does not already have: the driver hands the path in, the component's `route_of` turns it
// into a `Route`, and the exhaustive `match` in the view decides what to draw. Adding a screen and
// forgetting its branch is a build failure, not a blank page.
//
// This file holds NO application logic and you should not need to change it.
//
// What it does NOT do yet, and the reason is a language gap rather than an oversight: it cannot
// carry a model that is a record. Nothing in Burxt can hold state between two calls — a function
// sees its arguments and nothing else, which is what makes `pure` mean anything — so today the
// model crosses the boundary on every event, and only a scalar can. A router is state-free (the
// path IS the state), which is exactly why it works and why it came first.

export function startRouter({ render, onNavigate }) {
  // Every in-page link, intercepted once. A link is real markup — `::: a href=/posts/42` — so it
  // works with JavaScript off, and this only upgrades it.
  //
  // Delegated rather than bound per link, for the reason the click handler is: the reconciler
  // replaces nodes, and anything bound to a node dies with it.
  document.addEventListener('click', (ev) => {
    if (ev.defaultPrevented || ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey) return;
    const a = ev.target.closest('a[href]');
    if (!a) return;

    // Same-origin, no target, not a download. Anything else is somebody else's page and must
    // behave like a link rather than like an app.
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin) return;
    if (a.target || a.hasAttribute('download') || a.getAttribute('rel') === 'external') return;

    ev.preventDefault();
    go(url.pathname + url.search);
  });

  // The back button. `popstate` is the browser telling us the path changed without a click, and
  // treating it as a navigation rather than a special case is what makes back and forward work
  // without any history of our own.
  addEventListener('popstate', () => paint(location.pathname + location.search));

  function go(path) {
    if (path === location.pathname + location.search) return;
    history.pushState(null, '', path);
    paint(path);
  }

  function paint(path) {
    render(path);
    if (onNavigate) onNavigate(path);
  }

  paint(location.pathname + location.search);
  return { go };
}
