// /kit page only. Lets the animations be replayed on demand — on a real page
// they fire once on load and are never re-armed. Same for the modal: a real page
// arrives with it already open, so opening one is a thing only the kit needs.

const modal = document.getElementById('hint-modal');

if (modal) {
  for (const button of document.querySelectorAll('[data-open-modal]')) {
    button.addEventListener('click', () => {
      modal.hidden = false;
    });
  }
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
