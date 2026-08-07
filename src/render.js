// Bare-bones rendering on top of the style kit (public/css/app.css, settled in "Build the style
// kit at /kit"). Pages here are structurally correct and compositionally unfinished on purpose:
// what each page is *made of* is owned by the per-game and dashboard tickets. What matters at
// this stage is that the route exists, the data is real, and nothing lies.

import * as chrome from '../content/chrome.js';
import { IS_DEV } from './config.js';
import { escape } from './http.js';

/**
 * The only thing in this file that reaches into `content/`, and the exception is narrow on
 * purpose. Every other primitive here is handed its words by the page rendering it, because the
 * words belong to that page. The marquee and the status bar belong to no page: they are the frame
 * every page is drawn inside, they say the same thing on all of them, and `layout()` is the only
 * caller there will ever be. Threading them through twenty-five call sites so that all twenty-five
 * pass the identical constant would be a seam that reports nothing.
 *
 * It stays a one-way dependency on static strings. Nothing here calls into content, and content
 * still never opens the database (ADR-game-content-lives-on-disk).
 */


/**
 * `still` opts a page out of the arrival animation. The admin surfaces are its callers: `/admin`
 * and `/league` refresh themselves, and a page that re-animates every few seconds is unreadable.
 * Team-facing pages animate by default so a new one never has to remember to.
 *
 * `refresh` is that self-refresh, in seconds, and until #79 it did not exist. Three comments in
 * this repository stated that `/admin` polls -- including the one above, and the one explaining
 * why the admin board drops the marquee -- and no page ever carried a timer or a meta refresh.
 * It had never once been true. It is a `<meta http-equiv>` rather than a script because client JS
 * here is the arrival animation and the hint modal, and a working surface should not be the one
 * thing on the site that needs a script to stay current.
 *
 * **A page that refreshes may not carry a form**, which is the constraint that shaped `/admin`
 * (#79): a reload at 30 seconds would eat a half-typed award reason at the exact moment the host
 * was using it. So every control that needs typing moved to `/admin/controls`, which does not
 * refresh, and the two pages that do are pure readouts.
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
 * (#31, ADR-document-order-instead-of-focus-management). The box arrives on a full page load
 * rather than being opened by script, so there is no focus to move in and none to give back -- but
 * document order still decided that the first six tab stops were the scorebar, the answer box and
 * the close link, all of them behind a dim backdrop, before you reached the box you were looking
 * at. Putting the markup first makes the thing you see first the thing you read first and tab to
 * first, in HTML, with no script involved. `.modal` is `position: fixed; z-index: 500`, so it
 * paints above `.app` whatever the tree order says. Slot is empty on every page but a hint reveal,
 * so this costs the rest of the site nothing.
 *
 * `theme-color` is here for the phones it still works on, and it is NOT what makes this work on an
 * iPhone. Safari 26 dropped the tag -- it parses it and ignores it -- and takes its bar colours
 * from CSS instead, which `.shell` in `app.css` explains at the declaration that feeds it. Android
 * Chrome and iOS below 26 do read the tag, and the party's guests bring whatever they bring, so one
 * line covering them is worth having as long as nobody mistakes it for the mechanism.
 */
export function layout({
  title,
  body,
  bar = '',
  nav = '',
  showClose = false,
  still = false,
  modal = '',
  refresh = 0,
}) {
  const foot = `${nav}${still ? '' : statusbar()}`;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#000">
  ${refresh ? `<meta http-equiv="refresh" content="${refresh}">` : ''}
  <title>${escape(title)}</title>
  <link rel="stylesheet" href="/css/app.css">
</head>
<body class="shell${nav ? ' shell--nav' : ''}">
  ${devBar()}
  ${modal}
  ${still ? '' : marquee()}
  <div class="app${still ? '' : ' anim-page'}">
    <div class="stack">
      ${bar}
      <h1 class="shout">${escape(title)}</h1>
      ${body}
      ${showClose ? '<a class="btn btn--close" href="/">close</a>' : ''}
    </div>
  </div>
  ${nav ? `<div class="foot">${foot}</div>` : foot}
  <script type="module" src="/js/app.js"></script>
</body>
</html>`;
}

/**
 * The dev build's own strip, above everything, on every page including the admin surfaces --
 * which is the point: "back and forth between dashboard and admin" is one link each way, from
 * wherever you are. Empty string in production, so the markup is not there to be inspected (#62).
 *
 * Styled INLINE rather than in `public/css/app.css`. The stylesheet is served to guests, and a
 * dev-only rule sitting in it would be dead weight on the night and one more thing on the style
 * kit's list of components the site owes. Six declarations in a string keep production's CSS
 * byte-identical to what it was.
 *
 * Both links are always shown rather than one of them chosen from request state, so `layout()`
 * does not have to start taking a request in order to draw its frame. Tapping the wrong one costs
 * a redirect.
 */
function devBar() {
  if (!IS_DEV) return '';

  const link = (href, text) =>
    `<a href="${href}" style="color:#000;text-decoration:none;padding:0 .5rem">${text}</a>`;

  const strip =
    'background:#ff0;color:#000;font:700 12px/2.2 monospace;' +
    'letter-spacing:.08em;text-align:center;text-transform:uppercase';

  return `<div style="${strip}">DEV ${link('/', 'board')}${link('/admin', 'admin')}${link(
    '/dev/login',
    'test team',
  )}${link('/dev/logout', 'log out')}</div>`;
}

/**
 * The scrolling banner across the top of every page: site branding, and explicitly not a feature.
 * The obvious content for a marquee on a party site is a live feed -- TEAM BADGER JUST FOUND A
 * CODE -- and #8 locked that out for the whole night, so this says one fixed jumble to everyone
 * and never mentions a team.
 *
 * **`aria-hidden` on the whole strip, not just the second copy.** It sits ahead of `.app` in
 * document order, so without this a screen reader would read forty-odd gags before the page title
 * on every route. It carries no information and has no tab stops, which is exactly the case for
 * treating it as decoration -- the same call `win()` makes for its two chrome buttons.
 *
 * **Two identical copies** because the keyframe translates the track by -50%: at the halfway point
 * copy two sits exactly where copy one started, so the loop is seamless. That is also why the
 * duration is derived rather than fixed. The animation moves one copy's width in whatever time it
 * is given, so a hardcoded 34s -- correct for the ~180 characters the kit used to carry -- would
 * crawl this list at a sixth of a readable speed. Dividing by 7 lands near 70px/s at this font
 * size, and unlike a constant it cannot go stale when someone edits the list.
 *
 * It sits **outside `.app`** for the reason the modal does (#30): `anim-page` animates a
 * `transform`, and a transformed ancestor becomes the containing block for `position: sticky`
 * inside it, which would peg this to the page instead of to the viewport.
 */
export function marquee(items = chrome.marquee) {
  const line = `★ ${items.join(' ★ ')} ★`;
  const copy = `<span class="marquee__item">${escape(line)}</span>`;
  const secs = Math.max(20, Math.round(line.length / 7));

  return `<div class="marquee" aria-hidden="true" style="--marquee-secs: ${secs}s">
    <div class="marquee__track">${copy}${copy}</div>
  </div>`;
}

/**
 * The strip of small print along the foot of every page. The marquee is a poster on the wall; this
 * is the bottom edge of the screen, and together they are what make a page read as a piece of
 * software rather than as a web page with a banner stuck to it.
 *
 * Sampled without replacement, so the two slots can never show the same line twice side by side --
 * the only repeat here that would look like a bug rather than a coincidence.
 *
 * `aria-hidden` for the marquee's reason, and dropped from `still` surfaces by `layout()` for one
 * more: `/admin` and `/league` refresh themselves (#79), so a resampling strip would rewrite
 * itself under a host who is trying to read the page.
 */
export function statusbar(items = sample(chrome.status, chrome.STATUS_SLOTS)) {
  return `<div class="statusbar" aria-hidden="true">
    ${items.map((text) => `<span class="mono">${escape(text)}</span>`).join('')}
  </div>`;
}

/**
 * The menu bar, pinned to the bottom of the screen above the small print (#76). Two audiences and
 * one list: a host holds `HQ court league recap shots`, a guest after the reveal holds
 * `games league recap shots`, and the three words in the middle are the same words on both.
 *
 * **It is a slot, not something this file decides.** Which links a request gets depends on the
 * admin cookie and on whether the game has ended, and `render.js` is the one file here that never
 * opens the database -- so `navFor()` in `app.js` picks the items and this draws them. Same seam
 * as `bar`, for the same reason.
 *
 * **Bottom rather than top, and that is the whole design.** The top of a guest page already holds
 * a sticky marquee and a scorebar, and nothing may go above the marquee: Safari 26 samples the
 * topmost sticky element to tint the phone's own status bar, which is what makes the frame run to
 * the edge of the screen (#72). The bottom was empty on every host surface -- `still: true` drops
 * the small print too -- and it is where a thumb already is at one in the morning.
 *
 * **`aria-current` and a lime block on the page you are standing on.** Five flat words in a loud
 * room are five identical words; the block is the only thing that says which one you already
 * pressed. Colour is decoration, `aria-current` is the meaning, and neither is load-bearing --
 * every one of these pages says its own name in its `<h1>`.
 */
export function navbar(items) {
  if (!items.length) return '';

  const link = ({ href, label, here }) =>
    `<a class="navbar__item${here ? ' navbar__item--here' : ''}" href="${escape(href)}"${
      here ? ' aria-current="page"' : ''
    }>${escape(label)}</a>`;

  return `<nav class="navbar" aria-label="Menu">${items.map(link).join('')}</nav>`;
}

/** `count` distinct members of `list`, in random order. Partial Fisher-Yates over a copy. */
function sample(list, count) {
  const pool = [...list];
  const picked = [];
  for (let n = 0; n < count && pool.length; n += 1) {
    picked.push(...pool.splice(Math.floor(Math.random() * pool.length), 1));
  }
  return picked;
}

/**
 * The as-seen-on-TV sunburst. One live caller: `/rules`, beside the block explaining the points,
 * where its own words are already on topic and the fine print undercuts the arithmetic the page
 * has just finished doing.
 *
 * Three spans rather than one string because the badge is a type specimen -- three sizes in three
 * fonts, stacked and centred inside the clip path -- and collapsing them would leave the caller
 * unable to say which line is which.
 */
export function starburst({ top = '', big = '', fine = '' }) {
  return `<div class="starburst">
    <span class="starburst__top">${escape(top)}</span>
    <span class="starburst__big">${escape(big)}</span>
    <span class="starburst__fine">${escape(fine)}</span>
  </div>`;
}

/**
 * A rubber stamp, tilted off level. One live caller: the arrival screen, which is the only moment
 * on this site that is an arrival, and a stamp is what a door gives you.
 *
 * The text is a parameter rather than baked in because the shape outlived its original words --
 * the kit drew it saying "R.S.V.P. OR ELSE", which nothing on a site you are already inside can
 * make true. See `content/chrome.js` for what it says instead, and why that line matters.
 */
export function stamp(text = '') {
  return `<p class="stamp">${escape(text)}</p>`;
}

/**
 * The one-line verdict under a team's score, and the first time a guest will ever have seen it
 * wearing a colour: the app has always emitted a bare `.standing` while the kit showed three
 * modifiers, so this is the site catching up with a design drawn back in #5.
 *
 * **Four bands, three colours.** `fresh` -- a team on zero -- is deliberately plain. It is a state
 * rather than a judgement (#37), and nothing about having just walked in deserves a colour.
 *
 * The colour is decoration and nothing rests on it: each band's sentence already says the whole
 * thing in words, which is what keeps green-amber-red safe for the roughly one guest in twelve who
 * cannot reliably tell those three apart.
 */
const STANDING_CLASS = {
  podium: 'standing--top',
  chasing: 'standing--mid',
  rest: 'standing--low',
};

export function standing({ band = 'fresh', text = '' }) {
  const modifier = STANDING_CLASS[band];
  return `<p class="standing${modifier ? ` ${modifier}` : ''}">${escape(text)}</p>`;
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
 * The house words for a modal's two answers, and the only two words any modal may use for them
 * (#90). They are exported so a second modal cannot quietly invent a third pair -- which is what
 * this one had already done to itself, saying "fine" when a hint cost and "lovely" when it did
 * not.
 *
 * The question marks are the register (#37): the site sounds unsure of its own offer even while
 * it takes your points. They hold on the admin's side too -- the admin is Dieter, who knows the
 * voice -- so there is no quieter register for HQ and no exception for the irreversible presses.
 */
export const MODAL_YES = 'Okay?';
export const MODAL_NO = 'No?';

/**
 * The action row of any modal, which exists so the **order** is as fixed as the words: aside,
 * then deny, then confirm, left to right. Confirm is always rightmost, including on a destructive
 * press -- an exception there would land on the one button in the house people press wrong.
 *
 * `deny` is **optional**, and plenty of modals will not have one: this one does not, because the
 * hint is already revealed and charged by the time the box appears, so there is nothing left to
 * say no to. A modal that only announces gets one button.
 *
 * `aside` is the third slot and is neither answer -- the hint modal's "What?" is a link to the
 * rules, not a refusal -- so it keeps its own words and sits outside the pair.
 *
 * The deny reuses `.btn--close`, the site's quiet paper-and-mono "leave this alone" button, rather
 * than earning a class of its own that no page had ever rendered.
 *
 * On layout, note that `.modal__actions .btn { flex: 1 1 auto }` **out-specifies**
 * `.btn--primary { flex: 1 1 100% }` (0,2,0 beats 0,1,0), so inside a modal the confirm does NOT
 * take a row of its own the way it does everywhere else -- the buttons share one row and wrap only
 * when they stop fitting. Two fit at 390px. Three has never been drawn, because no modal has
 * wanted an aside and a deny at once.
 *
 * And the pair is not case-matched on screen: `.btn--primary` is `text-transform: uppercase`
 * site-wide while `.btn--close` is `none`, so the words land as `No?` and `OKAY?`. That is the
 * primary button being itself, not this modal deciding something -- a modal opting out of it would
 * be exactly the page-level design decision `/kit` exists to prevent.
 */
export function modalActions({ aside = '', denyHref, confirmHref, confirmAttrs = {} }) {
  return `<div class="modal__actions">
        ${aside}
        ${denyHref ? `<a class="btn btn--close" href="${escape(denyHref)}">${MODAL_NO}</a>` : ''}
        <a class="btn btn--primary" href="${escape(confirmHref)}"${attrsHtml(confirmAttrs)}>${MODAL_YES}</a>
      </div>`;
}

/**
 * A modal that **asks**, rather than announcing: the two-answer shape, `No?` beside `Okay?`.
 *
 * No page renders one yet — the first will be the delete-team confirm (#87) — and that is the
 * whole reason this function exists rather than waiting. `/kit` calls it, so the deny ships as a
 * button somebody has looked at, drawn beside a real confirm, at phone width. The kit showing a
 * component only in the shape that already worked is how `<a class="btn">` rendered as a raw blue
 * link site-wide, and the map says so out loud.
 *
 * `title` and `body` are the caller's, because what is being asked differs every time. The two
 * answers are not the caller's: they come from `modalActions()` and there is no argument for
 * overriding them.
 */
export function askModal({ id = 'ask-modal', title, body, denyHref, confirmHref }) {
  return `<div class="modal" id="${escape(id)}">
    <div class="modal__box">
      <p class="modal__title">${escape(title)}</p>
      <p class="modal__body">${escape(body)}</p>
      ${modalActions({ denyHref, confirmHref })}
    </div>
  </div>`;
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
 * It carries **no ARIA role**, which is a correction rather than an omission (#31,
 * ADR-document-order-instead-of-focus-management). It used to claim `role="alertdialog"`, and
 * every part of that was untrue here: `alertdialog` says focus is placed inside on display, that
 * the rest of the page is unavailable behind it, and that the message is urgent enough to
 * interrupt. Nothing focuses this box, nothing is trapped, nothing waits for it, and a role
 * present in the initial HTML never fires as an alert anyway -- live regions only announce what
 * changes after the page settles. A titled box of text with two links is what this is; being
 * first in the document is what makes it heard.
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
      ${modalActions({
        aside: '<a class="btn btn--what" href="/rules">What?</a>',
        confirmHref: backHref,
        confirmAttrs: { 'data-close-modal': true },
      })}
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
 * Words underneath an asset hero, for the one case the frame forbids inside it: a picture that
 * still needs a sentence. Teddy is a photograph plus the only rule that matters.
 *
 * One line of markup, and it earns a function anyway. It was typed by hand on the game page while
 * `/kit` had no way to show it, which is the two-copies shape ADR-a-component-has-one-markup
 * exists to stop -- and the reason `.blurb` was sitting in #59's undocumented count with nothing
 * to say about itself. It is the other half of the rule `hero()` states above, so the kit has to
 * be able to draw the escape hatch and not only the prohibition.
 */
export const blurb = (text = '') => `<p class="blurb">${escape(text)}</p>`;

/**
 * Someone said a thing: a box with a tail, for text that came out of a person's mouth. A hint is
 * the house talking, and a Guess Who card is a stranger's answer read back.
 *
 * It is a `<div>` wrapping a `<p>`, which is the kit's shape and not either of the two the app had
 * grown by hand. That is forced rather than chosen. The box has to work as a row of a `<ul>` and
 * on its own, and **no single element does both**: `<li>` is invalid outside a list, and a `<div>`
 * or `<p>` is invalid as a direct child of one. So the component is the shape that stands alone
 * and a list caller wraps it in its own `<li>` -- the wrapping is the caller's business, the same
 * way `.stack` spacing is.
 *
 * The inner `<p>` is load-bearing, not scaffolding: `.bubble p { margin: 0; font-size: 1.05rem }`
 * is the type rule, so `<p class="bubble">` -- one of the two hand-written copies -- was wearing
 * the box and missing the type. That is exactly the drift ADR-a-component-has-one-markup exists to
 * catch, and it had been visible on the hint list since hints landed (#53).
 *
 * One paragraph, deliberately. `hero()` splits on blank lines because a hero is two beats; a
 * speech bubble is one thing someone said, and nothing has wanted a second.
 */
export const bubble = (text = '') => `<div class="bubble"><p>${escape(text)}</p></div>`;

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
 * A game that pays per unit does NOT use this: the scavenger's checklist and the portrait gallery
 * each compose their own stage out of `unitRow()` and `shot()`, because a flat strip cannot say
 * which units are still open. So today's roster reaches this through neither photo tile; it is
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
 * One row of the list a unit game puts on its tile.
 *
 * **"Unit" and not "prompt"**, which is what these classes said until now. A prompt is one *label*
 * of one unit (CONTEXT.md, Unit), and the glossary says so in the same change that shipped the
 * classes -- so the two came out of #25 disagreeing with each other and the classes won by
 * default. The word was already wrong for three of the four pages using this row: Guess Who's is a
 * card and a stranger's answer, Herd's is a question with an empty box under it, and the portrait
 * gallery's is a photograph with something somebody actually said. None of them has a prompt on it.
 *
 * **Two flavours, and the difference is not cosmetic.** A boxed row holds SEVERAL things that need
 * holding together -- a thumbnail beside its text, or a question above its dropdown -- so it gets
 * the border, the shadow and the paper. A plain row holds ONE control that already carries its own
 * frame: the camera's dashed target, or a `field()`. Boxing those draws a box around a box.
 *
 * Which one you get is **derived rather than declared**: a row is boxed exactly when it has a
 * `label` or a `shot`, because that is what there is to hold something against. That is true of
 * all three boxed callers and neither plain one, so a flag would only add a way to call this
 * wrong.
 *
 * `body` is markup the caller has already rendered, and that is what keeps the route out of here.
 * Every one of these rows lives inside a `<form>` -- one per row on the scavenger, one around the
 * whole list on Guess Who and Herd, none at all in the portrait gallery -- and which route it
 * posts to is the page's business, exactly as it is for `shoot()`. render.js renders no form
 * action anywhere, and this row was the reason #51 thought it might have to.
 *
 * The `<li>` belongs to the component, unlike `bubble()`, which stops one element short so it can
 * also stand outside a list (#53). This row never does: all four callers put it in a `.units`
 * list, and a `<div>` is not valid anywhere else in one.
 */
export function unitRow({ shot: cell = '', label = '', body = '' }) {
  if (!cell && !label) return `<li class="unit">${body}</li>`;

  return `<li class="unit unit--box">
      ${cell}
      <div class="unit__said">
        ${label ? `<p class="unit__label">${escape(label)}</p>` : ''}
        ${body}
      </div>
    </li>`;
}

/**
 * One square of the signature card.
 *
 * **"Square" and not "cell"**, which is what these classes said until #60. Square is the word the
 * glossary uses (CONTEXT.md, *Grid, and signature*) and the word the tile itself says out loud --
 * *"write it in the square"*, *"three in a row"*, *"every square says exactly what it wants"*.
 * `cell` was a spreadsheet word that arrived with the stylesheet and was never anybody's name for
 * this. Same correction #51 made to `.prompt`.
 *
 * **Signed is derived; a line is declared.** A square is signed exactly when it holds a signature,
 * so there is no flag to get wrong. Whether it is part of a completed line is not knowable from
 * the square -- it is a fact about the card's geometry that only the scorer computes -- so that
 * one is passed in. The two are **exclusive**: a square in a line wears the line and not the
 * signed green, because a line pays INSTEAD of its squares (#21) and the colour says so.
 *
 * The empty signature is a **non-breaking space rather than nothing**, and that is load-bearing:
 * it holds the line's height, so a card does not jolt upward as squares fill. On a tile a team
 * reopens twenty times a night, that is the difference between a card and a flicker.
 *
 * The `<li>` belongs to the component, like `unitRow()` and unlike `bubble()`: a square only ever
 * exists inside a card, and a `<div>` is not valid there.
 */
export function square({ trait = '', signature = '', line = false }) {
  const state = line ? ' square--line' : signature ? ' square--signed' : '';

  return `<li class="square${state}">
      <p class="square__trait">${escape(trait)}</p>
      <p class="square__signature">${signature ? escape(signature) : '&nbsp;'}</p>
    </li>`;
}

/**
 * The signature card: Sign Here's units laid out as the square its scoring rule assumes.
 *
 * **The card is always drawn, in every state.** Locked, fresh and finished all show the same nine
 * boxes -- what changes is what sits underneath them. This is the tile a team opens most often and
 * usually to *read* rather than to write ("which one did I still need?"), so the grid can never be
 * the thing that disappears.
 *
 * `cols` rides out as a custom property rather than a class, because the column count comes from
 * content: `grid: 4` is a declared number, and a card that drew three columns for a 4x4 would put
 * its lines somewhere the scorer cannot see them. A class per width would have to be written
 * before anyone declares it.
 *
 * **The `<form>` under it stays with the page**, exactly as it does for `unitRow()`. Which route a
 * signature posts to is `bingoStage`'s business, and render.js renders no form action anywhere
 * (#51). That is why the kit can show this component completely: the grid takes no form, so
 * nothing about the card is unreachable from a page with no database behind it.
 */
export function card(squares = [], cols = 3) {
  return `<ul class="card" style="--card-cols: ${Number(cols) || 3}">${squares
    .map((one) => square(one))
    .join('')}</ul>`;
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
 *
 * `extra` is markup, not text, and is the one thing a stub renders un-escaped. It exists because a
 * page can be undesigned and still owe a working link: `/admin` is a stub owned by #11, but the
 * reset it has to reach (#63) is built and live, and a control nobody can get to is not built.
 */
export function stub({ title, owner, does, data = null, still = false, extra = '', nav = '', refresh = 0 }) {
  return layout({
    title,
    still,
    refresh,
    nav,
    body: `
      <p class="banner"><strong>Not designed yet.</strong> Owned by: ${escape(owner)}.</p>
      <p>${escape(does)}</p>
      ${data ? `<pre class="mono">${escape(JSON.stringify(data, null, 2))}</pre>` : ''}
      ${extra}
      <a class="btn btn--close" href="/">back to the dashboard</a>
    `,
  });
}

export const notFound = () =>
  layout({
    title: '404',
    body: '<p>there is no rule 4 either</p>',
  });
