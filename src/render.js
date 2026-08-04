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
 * `bar` is the scorebar, and it is a slot rather than something this function builds, so that
 * render.js keeps knowing nothing about the database. Team-facing pages pass one; admin surfaces
 * and gag pages pass nothing. See `scorebar()` for why it is on every page rather than only the
 * dashboard.
 *
 * `modal` is a slot, and it sits **outside `.app` on purpose**: `anim-page` animates a
 * `transform`, and a transformed ancestor becomes the containing block for `position: fixed`, so
 * a modal nested inside would be pinned to the page rather than to the viewport for the length of
 * the arrival animation. The style kit puts it at the end of `<body>` for the same reason.
 */
export function layout({ title, body, bar = '', showClose = false, still = false, modal = '' }) {
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
      ${bar}
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
 * Who you are, what you have, and how much of the board is still shut -- on every team-facing
 * page rather than only the dashboard, and the whole thing is a link back to it.
 *
 * The open count is doing a specific job. The roster opens two tiles for every team at onboarding
 * (#7), on the rule that a tile starts open only if learning about it late is unrecoverable --
 * and Human Bingo has a hard window, because 20:00 to 21:00 is when people still introduce
 * themselves. But a team lands in the game they scanned, not on their board, so nothing would
 * otherwise tell them those two exist. A running count advertises the board from wherever they
 * are, needs no first-arrival flag, and keeps working every time a tile opens all night. Settled
 * in #9.
 *
 * `open` of zero total means content has no games yet, and a bare "0 OF 0" says nothing worth the
 * pixels, so the line is dropped entirely rather than rendered empty.
 */
export function scorebar({ name, score, open = 0, total = 0 }) {
  return `<a class="scorebar" href="/">
    <span class="scorebar__who">
      <span class="scorebar__label">TEAM</span>
      <span class="scorebar__name">${escape(name)}</span>
      ${total ? `<span class="scorebar__open">${Number(open)} of ${Number(total)} open</span>` : ''}
    </span>
    <span class="scorebar__pts">
      <span class="scorebar__num">${Number(score)}</span><span class="scorebar__unit">pts</span>
    </span>
  </a>`;
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
 * A dashboard tile, in one of the five states the style kit ships.
 *
 * This function is the ONLY markup for a tile. `/kit` does not keep a copy -- it calls this, with
 * demo arguments, through the injection in `src/kit.js`. That is the rule settled in #32: a
 * component's markup exists once, so a change to it cannot land in one place and not the other.
 *
 * The badge and the pts copy come from the kit, which had them from the start while the dashboard
 * was rendering neither -- `.tile__lock`, `.tile__flag` and `.tile--wrong .tile__flag` were all
 * styled in `app.css` and emitted by nothing. A locked tile says "go find it" rather than "0 pts",
 * because zero is what you scored and this is a tile you have not met.
 */
const TILE_BADGE = {
  locked: '<span class="tile__lock" aria-hidden="true">🔒</span>',
  unlocked: '<span class="tile__flag" aria-hidden="true">▶</span>',
  correct: '<span class="tile__flag" aria-hidden="true">✓</span>',
  unknown: '<span class="tile__flag" aria-hidden="true">?</span>',
  wrong: '<span class="tile__flag" aria-hidden="true">✗</span>',
};

const TILE_PTS = {
  locked: () => 'go find it',
  unlocked: () => 'not played',
  correct: (points) => `+${points} pts`,
  unknown: () => 'answered · counts at the end',
  wrong: (points) => `+${points} pts`,
};

/**
 * Extra HTML attributes from an object, every value escaped on the way out. Taking an object
 * rather than a raw string is what stops a caller opening a hole by interpolating content into an
 * attribute; `true` renders a bare boolean attribute, `false`/null/undefined render nothing.
 */
function attrsHtml(attrs = {}) {
  return Object.entries(attrs)
    .map(([key, value]) => {
      if (value === false || value === null || value === undefined) return '';
      return value === true ? ` ${key}` : ` ${key}="${escape(String(value))}"`;
    })
    .join('');
}

export function tile({ state = 'locked', title = '', points = 0, href = '', attrs = {} }) {
  const known = TILE_BADGE[state] ? state : 'locked';
  const inner = `${TILE_BADGE[known]}
      <span class="tile__title">${escape(known === 'locked' ? '???' : title)}</span>
      <span class="tile__pts">${escape(TILE_PTS[known](Number(points) || 0))}</span>`;

  // A locked tile is not a link: there is nowhere to go until it is found.
  return known === 'locked'
    ? `<span class="tile tile--locked"${attrsHtml(attrs)}>${inner}</span>`
    : `<a class="tile tile--${known}" href="${escape(href)}"${attrsHtml(attrs)}>${inner}</a>`;
}

/**
/**
 * The top half of a game page: either words or a picture, never both.
 *
 * `.hero__body` carries the font, the size and the line-height. The game page used to drop its
 * text straight into `.hero`, which meant every hero on the site was rendering in the inherited
 * font rather than the designed one -- invisible in code, obvious on a phone.
 *
 * Text splits on blank lines into paragraphs. Without that a two-beat hero collapses into one
 * run-on line, because nothing in the CSS preserves newlines.
 *
 * The asset flavour has two states. With a real file behind it the frame holds the picture; with
 * none it holds the kit's placeholder, which is what `/kit` renders and what a game whose
 * photograph has not been shot yet renders too -- never a broken image, and never a refusal to
 * boot. Boot has already shouted about the missing file (see content.js).
 *
 * A game that needs a picture AND a sentence puts the sentence in its `blurb`, which the game
 * page renders underneath this frame rather than inside it.
 *
 * The kicker is optional because no game has a number to put in one yet; the kit passes one to
 * show the slot works. `anim` is a class from the closed vocabulary in `src/moments.js`.
 */
export function hero({
  text = '',
  kicker = '',
  flavour = '',
  anim = '',
  asset = '',
  alt = '',
  assetExists = true,
}) {
  // A path implies the flavour, so content says `hero: { asset, alt }` and nothing else. The kit
  // passes `flavour` on its own, with no file behind it, to demonstrate the empty frame.
  const known = flavour || (asset ? 'asset' : 'text');

  let inside;
  if (known === 'asset') {
    inside =
      asset && assetExists
        ? `<img class="hero__img" src="${escape(asset)}" alt="${escape(alt || text)}">`
        : `<div class="hero__asset" role="img" aria-label="${escape(alt || text || 'placeholder asset')}">
        <span class="hero__assetnote">${escape(text || '[ asset goes here ]')}</span>
      </div>`;
  } else {
    inside = String(text)
      .split(/\n\s*\n/)
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => `<p class="hero__body">${escape(part)}</p>`)
      .join('\n      ');
  }

  return `<div class="hero hero--${escape(known)}${anim}">
      ${kicker ? `<p class="hero__kicker">${escape(kicker)}</p>\n      ` : ''}${inside}
    </div>`;
}

/**
 * A labelled form control.
 *
 * The label WRAPS the control rather than pointing at it with `for`. Both are valid HTML and the
 * kit demonstrated the other one, but this shape has no id to keep in sync -- which is the single
 * way this markup can silently break, and it breaks by labelling the wrong box.
 *
 * `attrs` is an object, not a string, so everything it carries is escaped on the way out and a
 * caller cannot accidentally open a hole by interpolating content into an attribute.
 */
export function field({ label, name, type = 'text', value = '', rows = 0, attrs = {} }) {
  const extra = attrsHtml(attrs);

  const control = rows
    ? `<textarea class="input input--area" name="${escape(name)}" rows="${Number(rows)}"${extra}>${escape(value)}</textarea>`
    : `<input class="input${type === 'file' ? ' input--file' : ''}" name="${escape(name)}" type="${escape(type)}"${extra} value="${escape(value)}">`;

  return `<label class="field">
      <span class="field__label">${escape(label)}</span>
      ${control}
    </label>`;
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
