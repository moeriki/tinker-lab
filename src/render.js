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
 * the arrival animation.
 *
 * It sits **first**, ahead of `.app`, and that is this site's entire answer to focus management
 * (#31, ADR-0015). The box arrives on a full page load rather than being opened by script, so
 * there is no focus to move in and none to give back -- but document order still decided that the
 * first six tab stops were the scorebar, the answer box and the close link, all of them behind a
 * dim backdrop, before you reached the box you were looking at. Putting the markup first makes the
 * thing you see first the thing you read first and tab to first, in HTML, with no script involved.
 * `.modal` is `position: fixed; z-index: 500`, so it paints above `.app` whatever the tree order
 * says. Slot is empty on every page but a hint reveal, so this costs the rest of the site nothing.
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
  ${modal}
  <div class="app${still ? '' : ' anim-page'}">
    <div class="stack">
      ${bar}
      <h1 class="shout">${escape(title)}</h1>
      ${body}
      ${showClose ? '<a class="btn btn--close" href="/">close</a>' : ''}
    </div>
  </div>
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
 *
 * It carries **no ARIA role**, which is a correction rather than an omission (#31, ADR-0015).
 * It used to claim `role="alertdialog"`, and every part of that was untrue here: `alertdialog`
 * says focus is placed inside on display, that the rest of the page is unavailable behind it, and
 * that the message is urgent enough to interrupt. Nothing focuses this box, nothing is trapped,
 * nothing waits for it, and a role present in the initial HTML never fires as an alert anyway --
 * live regions only announce what changes after the page settles. A titled box of text with two
 * links is what this is; being first in the document is what makes it heard.
 */
export function hintModal({ notice, cost, backHref }) {
  const free = notice === 'free';
  const price = `<strong>${Number(cost)} point${Number(cost) === 1 ? '' : 's'}</strong>`;

  return `<div class="modal" id="hint-modal">
    <div class="modal__box">
      <p class="modal__title">${free ? 'on the house.' : 'oh yeah.'}</p>
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
 *
 * `options` makes it a `<select>`. Entries are either a bare string, or `{ value, label }` where
 * the two differ -- which is Guess Who's case, since a card names a member by id and shows a
 * person's name. `content/questions.js` has been allowed to declare `input: 'select'` with options
 * since #9, and boot has been *enforcing* that a select carries options, while this function had
 * no branch for one: the questionnaire would have rendered `<input type="select">`, which every
 * browser quietly treats as a text box. A validated promise nothing kept.
 */
export function field({ label, name, type = 'text', value = '', rows = 0, options = null, attrs = {} }) {
  const extra = attrsHtml(attrs);

  const choice = (option) => (typeof option === 'string' ? { value: option, label: option } : option);

  let control;
  if (options) {
    const items = options
      .map(choice)
      .map(
        (option) =>
          `<option value="${escape(option.value)}"${
            String(option.value) === String(value) ? ' selected' : ''
          }>${escape(option.label)}</option>`,
      )
      .join('');
    control = `<select class="input input--select" name="${escape(name)}"${extra}>${items}</select>`;
  } else if (rows) {
    control = `<textarea class="input input--area" name="${escape(name)}" rows="${Number(rows)}"${extra}>${escape(value)}</textarea>`;
  } else {
    control = `<input class="input${type === 'file' ? ' input--file' : ''}" name="${escape(name)}" type="${escape(type)}"${extra} value="${escape(value)}">`;
  }

  return `<label class="field">
      <span class="field__label">${escape(label)}</span>
      ${control}
    </label>`;
}

/**
 * The camera. The big dashed target that opens a phone's camera, and the only control on the site
 * that is not a `.btn`.
 *
 * The `<input>` is a real file input, hidden by clipping inside its own label, because the native
 * one is unstylable across browsers. Never `display: none` -- that would take it out of the tab
 * order and off the keyboard entirely (see `.shoot__input` in app.css).
 *
 * `name="photo"` and `accept`/`capture` are fixed here rather than passed in: `/g/:id/submit`
 * reads exactly that field name, and a caller free to rename it could produce a control that
 * looks right and posts nothing. What varies is only the `face` -- the words on it -- because the
 * scavenger wears its prompt there ("Both hosts in one shot") and everything else says some
 * flavour of "take a photo".
 *
 * There is no `<form>` here on purpose. render.js renders no form action anywhere: which route a
 * control posts to is a page's business, not the design system's. Every caller wraps this.
 */
export function shoot({ face = 'take a photo' }) {
  return `<label class="shoot">
      <input class="shoot__input" type="file" name="photo" accept="image/*" capture="environment">
      <span class="shoot__face">${escape(face)}</span>
    </label>`;
}

/**
 * One photo, back to whoever sent it: a small square that taps through to the full thing.
 *
 * Two states, and which one you get is decided by whether the caller could find something to
 * render. `src` is the cheap EXIF thumbnail where the camera embedded one and the full file where
 * it did not, so a tile full of photos costs kilobytes rather than megabytes (#10).
 *
 * With no `src` there is nothing this browser will draw, which today means HEIC off an iPhone
 * (`displayFor` in photos.js). That gets `.shot--dl`: a yellow tile naming the format, and a
 * `download` link rather than an `<img>` that would break or a plain link that would open a blank
 * page. This branch was the admin gallery's alone until #41 -- the team-facing strip used to say
 * "sent ✓" and link straight at bytes the phone refuses, which looks like it worked and does not.
 * One component, so there is one answer to what an unrenderable photo looks like.
 *
 * `anim` is a class from the closed vocabulary in `src/moments.js`, and only the photo that just
 * arrived carries one.
 */
export function shot({ href = '', src = '', label = 'file', anim = '' }) {
  return src
    ? `<a class="shot${anim}" href="${escape(href)}">
        <img class="shot__img" src="${escape(src)}" alt="" loading="lazy">
      </a>`
    : `<a class="shot shot--dl${anim}" href="${escape(href)}" download>
        <span class="shot__none">${escape(label)}<br>tap to open</span>
      </a>`;
}

/**
 * The strip of them, with a count above it. What a plain `photo: true` game renders under its
 * hero -- every photo this team has sent to it, newest last.
 *
 * A game that pays per unit does NOT use this: the scavenger's prompt list and the portrait
 * gallery each compose their own stage out of `shot()` directly, because a flat strip cannot say
 * which prompts are still open. So today's roster reaches this through neither photo tile; it is
 * what a photo game that declares no `units` gets for free.
 *
 * Each entry is `{ href, src, label }` -- already resolved by the caller, because deciding which
 * of a submission's three photo columns to point at is database knowledge and this file has none.
 */
export function shots(photos = [], newestAnim = '') {
  if (!photos.length) return '';

  // Only the photo that just arrived moves; the rest of the strip stays put.
  const cells = photos
    .map((photo, index) => shot({ ...photo, anim: index === photos.length - 1 ? newestAnim : '' }))
    .join('');

  return `<p class="statusline">you've sent ${photos.length}</p>
          <div class="shots">${cells}</div>`;
}

/**
 * The window frame, straight off the invite. Anything that wants to feel like a document: the
 * rules, and later the results and the handoff.
 *
 * It lived only in `kit.html` until `/rules` became the first page to render one, which is the
 * moment `src/kit.js` says it moves here -- so there is never a second copy of the markup.
 *
 * The two chrome buttons are **decorative spans, not buttons**. They do nothing, and a control
 * that does nothing is worse than an ornament for anyone on a screen reader, so they are
 * `aria-hidden`. The close one is a real link, which is what the stylesheet's own comment beside
 * `.win__btn--x` always said it was for.
 *
 * `title` is a filename because the frame is pretending to be a text file. The joke is the
 * extension; nothing else here depends on it.
 */
/**
 * The numbered list inside the window on `/rules`. Its own component rather than part of `win`,
 * because the frame is generic -- the results and the handoff will want one too -- and because
 * this is the markup both the page and the kit would otherwise each keep a copy of.
 */
export const rulesList = (rules = []) =>
  `<ol class="rules">${rules.map((rule) => `<li>${escape(rule)}</li>`).join('')}</ol>`;

export function win({ title = '', body = '', status = '', closeHref = '/' }) {
  return `<div class="win">
    <div class="win__bar">
      <span class="win__icon" aria-hidden="true">📄</span>
      <span class="win__title">${escape(title)}</span>
      <span class="win__btns">
        <span class="win__btn" aria-hidden="true">_</span>
        <span class="win__btn" aria-hidden="true">□</span>
        <a class="win__btn win__btn--x" href="${escape(closeHref)}" aria-label="close">×</a>
      </span>
    </div>
    <div class="win__body">
      ${body}
      ${status ? `<p class="statusline mono">${escape(status)}</p>` : ''}
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
