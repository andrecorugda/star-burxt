// The gallery strip's arrows, keyboard and counter.
//
// **An enhancement, not the mechanism.** The strip is a `scroll-snap` container, so it drags, swipes and
// snaps with no script at all, and the dots are ordinary anchors that scroll their slide into view. Every
// control below is added ON TOP of something that already works — which is the only honest way to script a
// carousel on the page whose argument is that the component is already there.
//
// Andre's report of the first version was the whole brief: *"the actual capture is so small I can't even see
// the code, I need to scroll — and I need to press each button to change, really, the laziest carousel."* He
// was right on both counts: sixteen named pills is a table of contents, not navigation.
(() => {
  const shelves = document.querySelectorAll('[data-shelf]');
  if (!shelves.length) return;

  shelves.forEach((shelf) => {
    const track = shelf.querySelector('[data-shelf-track]');
    const slides = [...track.querySelectorAll('.shelf-slide')];
    const dots = [...shelf.querySelectorAll('.shelf-dots a')];
    const count = shelf.querySelector('[data-shelf-count]');
    const prev = shelf.querySelector('[data-shelf-prev]');
    const next = shelf.querySelector('[data-shelf-next]');
    if (!slides.length) return;

    let at = 0;

    // **Which slide is showing is read from the SCROLL, not remembered.** A remembered index disagrees with
    // the strip the moment somebody drags it, and then the arrows jump from wherever the index thinks it is.
    const show = (i) => {
      at = Math.max(0, Math.min(slides.length - 1, i));
      dots.forEach((d, n) => d.classList.toggle('on', n === at));
      if (count) count.textContent = `${at + 1} / ${slides.length}`;
      if (prev) prev.disabled = at === 0;
      if (next) next.disabled = at === slides.length - 1;
    };

    const go = (i) => {
      const target = slides[Math.max(0, Math.min(slides.length - 1, i))];
      track.scrollTo({ left: target.offsetLeft - track.offsetLeft, behavior: 'smooth' });
    };

    if (prev) prev.addEventListener('click', () => go(at - 1));
    if (next) next.addEventListener('click', () => go(at + 1));

    // Arrow keys, once the strip has focus — so a reader who tabs to it can move without a mouse.
    track.addEventListener('keydown', (ev) => {
      if (ev.key === 'ArrowLeft') { ev.preventDefault(); go(at - 1); }
      if (ev.key === 'ArrowRight') { ev.preventDefault(); go(at + 1); }
    });

    // The observer is what keeps the dots honest during a drag. `0.55` rather than `0.5` so two half-visible
    // slides cannot both claim to be current.
    if ('IntersectionObserver' in window) {
      const watching = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting && e.intersectionRatio > 0.55) show(slides.indexOf(e.target));
        });
      }, { root: track, threshold: [0.56] });
      slides.forEach((s) => watching.observe(s));
    } else {
      track.addEventListener('scroll', () => {
        show(Math.round(track.scrollLeft / track.clientWidth));
      }, { passive: true });
    }

    // Dragging with a MOUSE, which touch gets free and a desktop does not.
    let down = null;
    track.addEventListener('pointerdown', (ev) => {
      if (ev.pointerType === 'touch') return;
      down = { x: ev.clientX, left: track.scrollLeft };
      track.classList.add('dragging');
    });
    track.addEventListener('pointermove', (ev) => {
      if (!down) return;
      track.scrollLeft = down.left - (ev.clientX - down.x);
    });
    const release = () => {
      if (!down) return;
      down = null;
      track.classList.remove('dragging');
      // Snap to whatever is nearest, because a drag that ends mid-slide should not stay mid-slide.
      go(Math.round(track.scrollLeft / track.clientWidth));
    };
    track.addEventListener('pointerup', release);
    track.addEventListener('pointerleave', release);

    show(0);
  });
})();
