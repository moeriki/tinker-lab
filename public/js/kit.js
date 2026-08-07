// /kit page only. Lets the animations be replayed on demand — on a real page
// they fire once on load and are never re-armed. Same for the modal: a real page
// arrives with it already open, so opening one is a thing only the kit needs.

// Every `.modal` on this page, not just the hint one. §11 now demos the two-answer shape as
// well — `No?` beside `Okay?` — because no page renders a deny yet (#90), and a pair of words
// that has never been drawn is exactly the kind of thing that ships wrong. A button says which
// box it opens with `data-open-modal="<id>"`; a bare `data-open-modal` still means the hint one.
for (const box of document.querySelectorAll('.modal')) {
  // Both boxes here are the REAL ones, injected from render.js (see src/kit.js), and the server
  // renders them already open because on a game page the thing being announced has already
  // happened. This page is the one place that wants them shut on arrival.
  box.hidden = true;

  // app.js binds every `[data-close-modal]` on the page but only ever hides `#hint-modal`, so a
  // second box has to close itself. Leaving that to app.js would hide the wrong modal.
  if (box.id === 'hint-modal') continue;

  const close = (event) => {
    event.preventDefault();
    box.hidden = true;
  };

  for (const button of box.querySelectorAll('.btn')) button.addEventListener('click', close);
  box.addEventListener('click', (event) => {
    if (event.target === box) close(event);
  });
}

for (const button of document.querySelectorAll('[data-open-modal]')) {
  const box = document.getElementById(button.dataset.openModal || 'hint-modal');
  if (box) button.addEventListener('click', () => (box.hidden = false));
}

const replay = (name) => {
  const klass = `anim-${name}`;
  for (const target of document.querySelectorAll(`[data-anim-target="${name}"]`)) {
    target.classList.remove(klass);
    void target.offsetWidth; // force reflow so the animation restarts
    target.classList.add(klass);
  }
};

for (const button of document.querySelectorAll('[data-replay]')) {
  button.addEventListener('click', () => replay(button.dataset.replay));
}

// Play each once on arrival so the page is not silent when it loads.
window.requestAnimationFrame(() => {
  replay('page');
  window.setTimeout(() => replay('unlock'), 400);
  window.setTimeout(() => replay('correct'), 900);
});
