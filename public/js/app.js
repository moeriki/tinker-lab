// The only client-side JavaScript the site has. Everything else is server
// rendered and every form is a plain POST + redirect.
//
// Scope: the hint modal. Animations are pure CSS and fire on page load.

const modal = document.getElementById('hint-modal');

if (modal) {
  const open = () => {
    modal.hidden = false;
  };

  const close = () => {
    modal.hidden = true;
  };

  for (const button of document.querySelectorAll('[data-open-modal]')) {
    button.addEventListener('click', open);
  }

  for (const button of document.querySelectorAll('[data-close-modal]')) {
    button.addEventListener('click', close);
  }

  // tapping the backdrop counts as dismissing it
  modal.addEventListener('click', (event) => {
    if (event.target === modal) close();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') close();
  });
}
