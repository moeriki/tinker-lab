// The only client-side JavaScript the site has. Everything else is server
// rendered and every form is a plain POST + redirect.
//
// Scope: the modals, and spending the one-shot signals. Animations themselves
// are pure CSS and fire on page load -- no JS starts them, which is why they
// still work with this file blocked. So does the hint modal: the server renders
// it open and its buttons are links.
//
// The bored button (#95) is the one thing here that a blocked script removes
// rather than degrades, and it is removed on purpose -- the server ships it
// hidden and this file reveals it, so nobody is handed a control that does
// nothing. It is decoration; a blocked phone loses a joke and no points.

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

// --- closing a modal -------------------------------------------------------
//
// The hint box is a notification, never a confirmation. By the time this runs
// the hint has been revealed, charged and rendered underneath it -- so there is
// nothing here that opens it and nothing here that gates it. All this does is
// dismiss it more smoothly than following the button's own href would. The
// bored box below is the other kind and opens itself.
//
// This closes whichever box a button is IN, rather than `#hint-modal` by name.
// It used to be by name, and every `[data-close-modal]` on the page hid that one
// box -- which meant a second modal's buttons would have shut the wrong thing,
// and is why /kit had to close its own askModal demo by hand. There are two real
// modals on the site now (#95), so the name is gone.
//
// There is deliberately NO focus management here -- no move-in, no trap, no
// restore -- and that is settled, not forgotten (#31,
// ADR-document-order-instead-of-focus-management). The hint box arrives on a
// full page load, so nothing was focused to take focus from and nothing exists
// to hand it back to; and a trap written here would be the one thing about it a
// phone with JavaScript blocked does not get. What the trap was for is done in
// HTML instead: `layout()` renders the modal first in the document, so it reads
// and tabs first. Do not add it back.

const closeModal = (box) => {
  if (box) box.hidden = true;
};

for (const button of document.querySelectorAll('[data-close-modal]')) {
  button.addEventListener('click', (event) => {
    // That href is the no-JS way out: this same page, minus the `?hint=` param.
    // We are the JS, so close in place and leave the scroll alone.
    event.preventDefault();
    closeModal(button.closest('.modal'));
  });
}

for (const box of document.querySelectorAll('.modal')) {
  // tapping the backdrop counts as dismissing it
  box.addEventListener('click', (event) => {
    if (event.target === box) closeModal(box);
  });
}

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  for (const box of document.querySelectorAll('.modal:not([hidden])')) closeModal(box);
});

// --- I'm bored -------------------------------------------------------------
//
// A slot machine with no jackpot: press it, get one suggestion, and both answers
// close the box and do nothing else. No points, no record, no route. The site
// suggests something and has no follow-through -- that is the whole joke (#95).
//
// This is the only thing on the site that a blocked script actually removes, and
// it removes it CLEANLY: the server ships the button `hidden` and the line below
// is what reveals it. A phone with JS off is handed no button rather than a dead
// one, which is the right trade for decoration and keeps #14's rule -- nothing
// load-bearing -- true rather than nearly true.
//
// Two things the box has to get right, both about how it FEELS rather than what
// it does:
//
//  - The sample changes per PRESS, not per page load. Press twice, get the same
//    word, and it reads as broken rather than dry.
//  - Never the same one twice running. With eighteen entries an immediate repeat
//    is the one outcome that kills it. Hence sampling from the list minus what
//    is already on screen, rather than rerolling until it differs -- a filter
//    cannot spin, and a reroll on a one-entry list would.

const boredButton = document.getElementById('bored');
const boredBox = document.getElementById('bored-modal');

if (boredButton && boredBox) {
  const line = boredBox.querySelector('.modal__title');
  const suggestions = JSON.parse(boredBox.dataset.bored || '[]');

  if (line && suggestions.length) {
    boredButton.hidden = false;

    boredButton.addEventListener('click', () => {
      const pool = suggestions.filter((one) => one !== line.textContent);
      line.textContent = pool[Math.floor(Math.random() * pool.length)] ?? line.textContent;
      boredBox.hidden = false;
    });
  }
}

// --- the host's live numbers -----------------------------------------------
//
// #94. HQ and the host's league keep themselves current by fetching rendered
// fragments and swapping them in, rather than by reloading the whole page every
// thirty seconds the way #79 built it. A reload flashes, and it throws away the
// scroll position -- on a phone lying on a kitchen counter for five hours that
// reads as the page turning over rather than as a dashboard.
//
// This is the first data-fetching JavaScript on the site, and it reopens a
// locked constraint on the map ("client JS is for animation and the hint modal
// only"). Reopened deliberately, by Dieter, for these two host-only surfaces:
// *"Scans, league, progress % - all refresh client-side so it looks real-time!"*
// It is NOT a licence to do this on a guest page. Nothing a guest sees updates
// itself, and #8's rule that nothing comparative reaches a guest before the
// reveal is the reason /admin/live is admin-gated at all.
//
// There is no templating here on purpose. The server renders every fragment
// with the same functions that rendered the page, so this file never learns
// what a percentage is or how a league row is shaped -- it only knows where
// things go. A poller with its own copy of the markup is a second renderer, and
// the two disagree the first time either is edited.
//
// Degradation is the meta refresh in <noscript>: a phone with this file blocked
// gets exactly what #79 built. The two can never fight, because a browser that
// runs this never parses that.

const liveSeconds = Number(document.body.dataset.liveSeconds || 0);

if (liveSeconds > 0) {
  // Only the slots this page actually has. One endpoint serves HQ and the
  // league, so each page picks up its own keys and ignores the rest.
  const slots = new Map(
    [...document.querySelectorAll('[data-live]')].map((node) => [node.dataset.live, node]),
  );

  // What was last written into each slot, as the SERVER spelled it. Comparing against
  // `slot.innerHTML` instead looks equivalent and is not: the browser re-serialises entities on
  // the way out, so a fragment containing `&middot;` reads back as `·` and never compares equal
  // to itself. That guard would have been dead on arrival and every slot would have been rebuilt
  // every tick -- invisible here, but it throws away a text selection and any half-made tap.
  const applied = new Map();

  let inFlight = false;

  const draw = async () => {
    // A slow response must not queue a second one behind it. Without this, a
    // phone waking with a stalled request would fire every missed tick at once.
    if (inFlight || document.hidden) return;
    inFlight = true;

    try {
      const response = await fetch('/admin/live', { headers: { accept: 'application/json' } });

      // A 404 here means the admin cookie is gone -- the secret URL is one-time
      // (ADR-admin-is-a-one-time-secret-url), so there is nothing to retry into
      // and no error worth drawing over the numbers. Leave the last good ones
      // on screen and stop asking.
      if (!response.ok) {
        clearInterval(timer);
        return;
      }

      const parts = await response.json();

      for (const [key, markup] of Object.entries(parts)) {
        const slot = slots.get(key);
        if (!slot || applied.get(key) === markup) continue;

        // Same-origin markup this server just rendered and escaped itself.
        slot.innerHTML = markup;
        applied.set(key, markup);
      }
    } catch {
      // The container restarting mid-party is the ordinary case, not the exotic
      // one. Keep the numbers that are on screen and try again on the next tick.
    } finally {
      inFlight = false;
    }
  };

  const timer = setInterval(draw, liveSeconds * 1000);

  // A phone locked in a pocket for forty minutes has its timers throttled, so
  // waking it would otherwise show numbers from before it went in the pocket
  // with nothing saying they were stale. The meta refresh this replaced could
  // not have that problem; this is what buys the parity back.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) draw();
  });
}
