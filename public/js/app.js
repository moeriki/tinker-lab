// The only client-side JavaScript the site has. Everything else is server
// rendered and every form is a plain POST + redirect.
//
// Scope: the hint modal, and spending the one-shot signals. Animations
// themselves are pure CSS and fire on page load -- no JS starts them, which is
// why they still work with this file blocked. So does the modal: the server
// renders it open and its buttons are links.

// --- spend the one-shot signals --------------------------------------------
//
// A POST-and-redirect can only tell the next page what happened through a query
// param (see docs/adr/the-page-you-are-on-is-the-stage.md). That param then
// lingers: pull-to-refresh would replay the animation, and a team showing a mate
// their screen would be sharing a URL ending `?just=correct`.
//
// So it is spent as soon as it is used. This runs after the first paint, and
// what it announces was baked into the server's HTML -- the class that animates,
// the modal that is already on screen -- so removing the param cannot cancel
// anything. `?hint=` is spent the same way and for the same reason: without it,
// refreshing after a hint re-announces a price that was already paid.

const ONE_SHOT = ['just', 'hint'];

requestAnimationFrame(() => {
  const url = new URL(window.location.href);
  if (!ONE_SHOT.some((name) => url.searchParams.has(name))) return;

  for (const name of ONE_SHOT) url.searchParams.delete(name);
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
});

// --- the hint modal --------------------------------------------------------
//
// A notification, never a confirmation. By the time this runs the hint has been
// revealed, charged and rendered underneath it -- so there is nothing here that
// opens it and nothing here that gates it. All this does is dismiss it more
// smoothly than following the button's own href would.
//
// There is deliberately NO focus management here -- no move-in, no trap, no
// restore -- and that is settled, not forgotten (#31,
// ADR-document-order-instead-of-focus-management). The box arrives on a full
// page load, so nothing was focused to take focus from and nothing exists to
// hand it back to; and a trap written here would be the one thing about this
// modal that a phone with JavaScript blocked does not get. What the trap was for
// is done in HTML instead: `layout()` renders the modal first in the document,
// so it reads and tabs first. Do not add it back.

const modal = document.getElementById('hint-modal');

if (modal) {
  const close = () => {
    modal.hidden = true;
  };

  for (const button of document.querySelectorAll('[data-close-modal]')) {
    button.addEventListener('click', (event) => {
      // That href is the no-JS way out: this same page, minus the `?hint=`
      // param. We are the JS, so close in place and leave the scroll alone.
      event.preventDefault();
      close();
    });
  }

  // tapping the backdrop counts as dismissing it
  modal.addEventListener('click', (event) => {
    if (event.target === modal) close();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') close();
  });
}
