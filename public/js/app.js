// The only client-side JavaScript the site has. Everything else is server
// rendered and every form is a plain POST + redirect.
//
// Scope: the hint modal, and spending the one-shot `?just=` signal. Animations
// themselves are pure CSS and fire on page load -- no JS starts them, which is
// why they still work with this file blocked.

// --- spend the moment ------------------------------------------------------
//
// A POST-and-redirect can only tell the next page what happened through a query
// param (see docs/adr/0009-the-page-you-are-on-is-the-stage.md). That param then
// lingers: pull-to-refresh would replay the animation, and a team showing a mate
// their screen would be sharing a URL ending `?just=correct`.
//
// So it is spent as soon as it is used. This runs after the first paint, and the
// class that animates was baked into the server's HTML, so removing the param
// cannot cancel anything.

requestAnimationFrame(() => {
  const url = new URL(window.location.href);
  if (!url.searchParams.has('just')) return;

  url.searchParams.delete('just');
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
});

// --- the hint modal --------------------------------------------------------

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
