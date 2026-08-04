// Bare-bones rendering on top of the style kit (public/css/app.css, settled in "Build the style
// kit at /kit"). Pages here are structurally correct and compositionally unfinished on purpose:
// what each page is *made of* is owned by the per-game and dashboard tickets. What matters at
// this stage is that the route exists, the data is real, and nothing lies.

import { escape } from './http.js';

/**
 * `still` opts a page out of the arrival animation. The admin board is the only caller that
 * wants it: it polls, and a page that re-animates every few seconds is unreadable. Team-facing
 * pages animate by default so a new one never has to remember to.
 *
 * `modal` is a slot, and it sits **outside `.app` on purpose**: `anim-page` animates a
 * `transform`, and a transformed ancestor becomes the containing block for `position: fixed`, so
 * a modal nested inside would be pinned to the page rather than to the viewport for the length of
 * the arrival animation. The style kit puts it at the end of `<body>` for the same reason.
 */
export function layout({ title, body, showClose = false, still = false, modal = '' }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escape(title)}</title>
  <link rel="stylesheet" href="/css/app.css">
</head>
<body class="shell">
  <div class="app${still ? '' : ' anim-page'}">
    <div class="stack">
      <h1 class="shout">${escape(title)}</h1>
      ${body}
      ${showClose ? '<a class="btn btn--close" href="/">close</a>' : ''}
    </div>
  </div>
  ${modal}
  <script type="module" src="/js/app.js"></script>
</body>
</html>`;
}

/**
 * The hint modal: the one modal the site has, and the only thing `/js/app.js` binds beyond
 * spending a param.
 *
 * It **announces a reveal that has already happened** -- the row is written, the negative award
 * is in the ledger, the hint is in the list behind the box. So the server renders it already
 * open, and nothing about the hint is gated on it (CONTEXT.md, "Hint reveal").
 *
 * Which means it must work with `/js/app.js` blocked, and it does: both actions are ordinary
 * links. "What?" goes to the rules, where the hint line has just stopped being hidden; the
 * primary one goes back to this same page without the `?hint=` param, which is the no-JS way to
 * dismiss it. With JS the click is intercepted and the box just closes.
 *
 * Nothing here is load-bearing on animation either. `modal-pop` flattens under
 * `prefers-reduced-motion` and the box still says its piece, in words, standing still.
 */
export function hintModal({ notice, cost, backHref }) {
  const free = notice === 'free';
  const price = `<strong>${Number(cost)} point${Number(cost) === 1 ? '' : 's'}</strong>`;

  return `<div class="modal" id="hint-modal">
    <div class="modal__box" role="alertdialog" aria-labelledby="hint-modal-title">
      <p class="modal__title" id="hint-modal-title">${free ? 'on the house.' : 'oh yeah.'}</p>
      <p class="modal__body">${
        free
          ? `that one was <strong>free</strong> — your first one always is. every hint after it costs you ${price}.`
          : `that hint cost you ${price}.`
      }</p>
      <div class="modal__actions">
        <a class="btn btn--what" href="/rules">What?</a>
        <a class="btn btn--primary" href="${escape(backHref)}" data-close-modal>${free ? 'lovely' : 'fine'}</a>
      </div>
    </div>
  </div>`;
}

/**
 * An honest placeholder. It names the ticket that owns the design, so nobody mistakes a stub for
 * a decision that was already made.
 */
export function stub({ title, owner, does, data = null, still = false }) {
  return layout({
    title,
    still,
    body: `
      <p class="banner"><strong>Not designed yet.</strong> Owned by: ${escape(owner)}.</p>
      <p>${escape(does)}</p>
      ${data ? `<pre class="mono">${escape(JSON.stringify(data, null, 2))}</pre>` : ''}
      <a class="btn btn--close" href="/">back to the dashboard</a>
    `,
  });
}

export const notFound = () =>
  layout({
    title: '404',
    body: '<p>there is no rule 4 either</p>',
  });
