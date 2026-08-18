// The three methods the driver touches, and nothing else.
//
// **Shared by every driver test, because two copies drifted.** `drive.mjs` was written before the
// driver called `preventDefault`, so its stub had no such method — and the change that added it was
// only ever re-run against `drive-feed.mjs`, which happened to have one. Locally both passed,
// because I never re-ran the older test after changing what the driver needed. CI ran both.
//
// A stub is a claim about what the thing under test requires. Two claims that disagree means one of
// them is wrong and neither says so.
export function fakeRoot() {
  const kinds = {};
  return {
    innerHTML: '',
    addEventListener(kind, fn) { (kinds[kind] ||= []).push(fn); },
    querySelector: () => null,
    // How many event kinds the driver asked for — the number that must match star's wired list.
    get wired() { return Object.keys(kinds).length; },
    // An event on an element carrying `data-star-h`, and optionally a row key and a value.
    //
    // **`on` is what the DOCUMENT declared, and `kind` is what happened — they are not the same
    // question.** This faked them as one for as long as it existed, returning null for
    // `data-star-on`, so every test here agreed that an element responds to any event that reaches
    // it. That is what a real browser then did: `on:click` ran on `mouseover`. It defaults to `kind`
    // because a test firing the event an element asked for is the ordinary case; pass them
    // DIFFERENTLY to check that the wrong event is ignored.
    fire(kind, handler, { key = null, value = '', on = kind } = {}) {
      const el = {
        type: 'text', value,
        getAttribute: (n) => (n === 'data-star-h' ? String(handler)
                           : n === 'data-star-on' ? on
                           : n === 'data-star-key' ? (key === null ? null : String(key)) : null),
        closest: (sel) => (sel === '[data-star-key]' ? (key === null ? null : el) : el),
      };
      (kinds[kind] || []).forEach((fn) => fn({
        target: { closest: () => el },
        // Everything the driver reads off an event. Missing any of these is what broke `drive.mjs`.
        preventDefault() {}, key: value, clientX: undefined, deltaY: 0,
        animationName: '', propertyName: '',
      }));
    },
  };
}

export function checker() {
  let failures = 0;
  return {
    is(what, got, want) {
      const ok = String(got) === String(want);
      if (!ok) failures++;
      console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${what}`);
      if (!ok) console.log(`       got  ${got}\n       want ${want}`);
    },
    done(said) {
      console.log(failures ? `\n${failures} failure(s)` : `\n${said}`);
      process.exit(failures ? 1 : 0);
    },
  };
}
