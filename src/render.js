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
 * **It used to drop the small print too, and that was a third meaning it should never have had**
 * (#113). The strip resamples per render, so on a page reloading every thirty seconds it rewrote
 * itself under the host -- true when #79 wrote it, and untrue since #94 swapped the reload for a
 * fragment poll that returns no footer. Nobody re-read the reason when its premise changed, so a
 * host lost the bottom edge of the screen on nine pages to a hazard that no longer existed. The
 * `<noscript>` reload does still resample it, which is the one place the old behaviour survives
 * and is not worth a branch: it is two gag lines swapping on a page nobody is reading with
 * JavaScript off. So `still` now means animation and the marquee, and nothing else.
 *
 * `refresh` is that self-refresh, in seconds, and until #79 it did not exist. Three comments in
 * this repository stated that `/admin` polls -- including the one above, and the one explaining
 * why the admin board drops the marquee -- and no page ever carried a timer or a meta refresh.
 * It had never once been true.
 *
 * **`live` is how it stays current now (#94), and `refresh` is the `<noscript>` fallback.** The
 * meta refresh was chosen in #79 over a script, on the reasoning that a working surface should
 * not be the one thing on the site needing JavaScript to stay accurate. What that reasoning
 * missed is what a whole-page reload does to a dashboard: it flashes, it throws away the scroll
 * position, and it lands you back at the top every thirty seconds. Dieter asked for the numbers
 * to move *"so it looks real-time"*, which a reload cannot do however often it fires.
 *
 * So `live` marks the page for `public/js/app.js`, which polls `/admin/live` and swaps SERVER-
 * rendered fragments into the `data-live` slots. The two halves of #79's reasoning both survive:
 * every number is still rendered on the server, and a phone with JavaScript blocked still
 * self-updates -- it falls back to exactly the meta refresh it had before, wrapped in `<noscript>`
 * so the two can never fight.
 *
 * **A page that refreshes may not carry a form**, which is the constraint that shaped `/admin`
 * (#79): a reload at 30 seconds would eat a half-typed award reason at the exact moment the host
 * was using it. So every control that needs typing moved to `/admin/controls`, which does not
 * refresh, and the two pages that do are pure readouts. Polling would technically lift that ban
 * -- a fragment swap leaves an untouched form alone -- but nothing has been moved back, because
 * the `<noscript>` reload is still a reload and would still eat the field.
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
 * `viewport-fit=cover` is what makes `env(safe-area-inset-*)` report anything at all. Without it
 * every one of those insets is `0px`, and the menu bar -- `position: fixed; bottom: 0` -- lands in
 * the strip iPadOS draws its home indicator across: a centred pill over a centred bar, in the
 * gesture region that swallows the tap before the page sees it. `/shots` had the flag from the
 * start for the notch; the rest of the site has it now for the foot, which pays the inset back as
 * padding in `app.css`.
 *
 * `theme-color` is here for the phones it still works on, and it is NOT what makes this work on an
 * iPhone. Safari 26 dropped the tag -- it parses it and ignores it -- and takes its bar colours
 * from CSS instead, which `.shell` in `app.css` explains at the declaration that feeds it. Android
 * Chrome and iOS below 26 do read the tag, and the party's guests bring whatever they bring, so one
 * line covering them is worth having as long as nobody mistakes it for the mechanism.
 *
 * `heading: false` suppresses the `<h1>` and hands the body responsibility for emitting one. Only
 * `doorStep()` passes it (#97): the wizard's title belongs inside its box, in the box's own display
 * face, and an `<h1>` above the box repeating it would be the title twice. The body still has to
 * carry a real `<h1>` -- this is a relocation, not a removal, and every door screen has one.
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
  live = 0,
  heading = true,
}) {
  const foot = `${nav}${statusbar()}`;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="theme-color" content="#000">
  ${refresh ? `<noscript><meta http-equiv="refresh" content="${refresh}"></noscript>` : ''}
  <title>${escape(title)}</title>
  <link rel="stylesheet" href="/css/app.css">
</head>
<body class="shell${nav ? ' shell--nav' : ''}"${live ? ` data-live-seconds="${Number(live)}"` : ''}>
  ${modal}
  ${still ? '' : marquee()}
  <div class="app${still ? '' : ' anim-page'}">
    <div class="stack">
      ${bar}
      ${heading ? `<h1 class="shout">${escape(title)}</h1>` : ''}
      ${body}
      ${showClose ? '<a class="btn btn--tertiary" href="/">close</a>' : ''}
    </div>
  </div>
  ${nav ? `<div class="foot">${foot}</div>` : foot}
  <script type="module" src="/js/app.js"></script>
</body>
</html>`;
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
 * **Two identical copies, and the animation is on the cells rather than on the track.** The two
 * copies are the seamless-loop trick: every cell travels exactly one strip width per lap, so at the
 * moment copy A's cell wraps back to the right it lands precisely where copy B's identical cell is
 * leaving, and the swap cannot be seen. What changed is which element moves. Translating the
 * *track* by -50% is the obvious way to write that and it is why this strip used to judder: at 43
 * gags the track measured 21,111px, and a transform-animated layer past the compositor's max
 * texture size (16,384px on most GPUs, and this is a 2x-3x phone) cannot be handed to the GPU
 * whole, so it repaints on the main thread every frame. Moving the same distance a cell at a time
 * leaves the biggest animated box at one gag -- 498px, at the longest one on the list -- and the
 * track, still twenty-odd thousand pixels, is now only a layout box that nothing animates.
 *
 * **Which is why the strip length is arithmetic rather than a percentage.** A cell cannot say
 * "-50%" and mean the strip; percentages in a transform are of the element's own size. So
 * `--marquee-strip` counts it out in characters, which is exact because this is set in a monospace
 * face: every font in `--font-mono` -- Courier Prime, `ui-monospace`, Courier New -- advances
 * 0.6em, and `--cell`/`--gap` in the stylesheet carry that number so it is stated once. Splitting
 * the line into one cell per gag is what makes the count possible at all.
 *
 * The duration is derived rather than fixed for the same reason it always was. The animation moves
 * one strip width in whatever time it is given, so a hardcoded 34s -- correct for the ~180
 * characters the kit used to carry -- would crawl this list at a sixth of a readable speed.
 * Dividing by 7 lands near 70px/s at this font size, and unlike a constant it cannot go stale when
 * someone edits the list.
 *
 * It sits **outside `.app`**, and since #88 that is a plain layout fact rather than a positioning
 * one: `.app` is capped at 42rem with side padding, so a strip inside it would stop short of both
 * edges instead of running the full width of the phone. It used to be out here because it was
 * `position: sticky` and `anim-page` animates a `transform`, which would have made `.app` its
 * containing block and pegged it to the page rather than the viewport. That hazard left with the
 * stickiness; the modal is still out here for exactly that reason (#30), because it is `fixed`.
 */
export function marquee(items = chrome.marquee) {
  // The star leads each gag rather than sitting between two, so that the wrap needs no separator
  // of its own: the last cell is followed by the first, and the first already brings its star.
  const cells = items.map((item) => `★ ${item}`);
  const chars = cells.reduce((n, cell) => n + cell.length, 0);
  const secs = Math.max(20, Math.round(chars / 7));

  // One strip: every character in a copy, plus the one-character gap the track puts after each.
  const strip = `calc(${chars} * var(--cell) + ${cells.length} * var(--gap))`;

  // `--n` is the cell's character count, and the stylesheet makes that its width. Letting the text
  // size the box instead leaves the strip a hair wider than the arithmetic says -- the star is not
  // a Courier Prime glyph and the face it falls back to advances 0.025px further, which across 43
  // of them put the wrap 1.2px out. Stating the width takes that back to 0.6px, which is Blink
  // rounding each cell down to a 64th of a pixel and is as exact as this can be made; a hair either
  // way once every 163 seconds is not a thing anyone can see. What it also does is make the strip
  // immune to the same class of drift from any future character the mono face turns out not to
  // carry, and from the fallback face if the woff2 never arrives.
  const copy = cells
    .map((cell) => `<span class="marquee__item" style="--n: ${cell.length}">${escape(cell)}</span>`)
    .join('');

  return `<div class="marquee" aria-hidden="true" style="--marquee-secs: ${secs}s; --marquee-strip: ${strip}">
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
 * `aria-hidden` for the marquee's reason.
 *
 * **On every page, which it had stopped being** (#113). `layout()` dropped it from `still`
 * surfaces because they reloaded whole every thirty seconds (#79) and the strip would resample
 * under a host mid-sentence. #94 replaced that reload with a poll of `/admin/live` -- named
 * fragments, no footer among them -- and left the exclusion standing, so the pages a host spends
 * the night on were the pages missing the bottom edge of the screen. It is a gag, not a readout;
 * the marquee is the poster on the wall and this is the frame under it, and the frame is the
 * thing that has to be on all four sides of everything.
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
 * **Bottom rather than top, and that is still the whole design.** The top of a guest page already
 * holds the marquee and a scorebar; the bottom was empty on every host surface -- `still: true`
 * dropped the small print too, until #113 put it back on every page -- and it is where a thumb
 * already is at one in the morning. One of
 * the original arguments has since expired: the top was also spoken for because Safari 26 sampled
 * the topmost sticky element to tint the phone's own status bar (#72), and #88 unstuck the marquee,
 * so nothing up there is load-bearing any more. The remaining reasons carried the decision on
 * their own, which is why this bar did not move.
 *
 * **`aria-current` and a lime block on the page you are standing on.** Five flat words in a loud
 * room are five identical words; the block is the only thing that says which one you already
 * pressed. Colour is decoration, `aria-current` is the meaning, and neither is load-bearing --
 * every one of these pages says its own name in its `<h1>`.
 *
 * **Yellow on a dev build, and that is now the only thing saying so** (#96). Until this the badge
 * was `devBar()`, a yellow strip across the top carrying four links. Three of those links have
 * homes -- `admin` is `HQ` here, `board` is here, and the test-team toggle moved to
 * `/admin/controls` -- and a fourth menu at the top of the screen contradicted the one decision
 * this site's navigation has made (ADR-the-menu-bar-is-pinned-to-the-bottom). So the strip is
 * gone and its colour moved down here: same warning, no second navigation, and it lands on the
 * bar a walker is already looking at.
 *
 * Recolouring rather than adding: lime on yellow is unreadable, so the pair inverts to ink on
 * yellow and the lit block inverts with it. It stays legible because it is the same two colours
 * swapped, not a new palette.
 *
 * **Inline, for the reason `devBar()` was inline (#62).** `public/css/app.css` is served to every
 * guest on the night; a `.navbar--dev` rule in it would be dead weight there and one more
 * component the style kit owes. Three declarations in a string keep production's CSS
 * byte-identical, and production emits no `style` attribute at all. `:active` is the one state
 * that cannot be inlined and so stays magenta on paper -- its own colour pair, legible over
 * either background, and a tap flash besides.
 */
export function navbar(items, { dev = IS_DEV } = {}) {
  if (!items.length) return '';

  const link = ({ href, label, here }) =>
    `<a class="navbar__item${here ? ' navbar__item--here' : ''}" href="${escape(href)}"${
      here ? ' aria-current="page"' : ''
    }${dev ? ` style="${here ? 'background:#000;color:#ff0' : 'color:#000'}"` : ''}>${escape(
      label,
    )}</a>`;

  return `<nav class="navbar" aria-label="Menu"${
    dev ? ' style="background:#ff0;border-top-color:#000"' : ''
  }>${items.map(link).join('')}</nav>`;
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
 * Standard competition ranking over an already-sorted board: 1, 2, 2, 4. Equal scores share a
 * place and the next one skips.
 *
 * `standings()` orders on `created_at` after the score, which is arbitrary and fine for ORDER --
 * two rows have to be printed in some sequence. It is not fine for the NUMBER beside them, and
 * `scoring.js` already argues exactly this for the bands: telling a team they came fourth instead
 * of second on identical points, because they walked in later, is a worse error than printing the
 * same numeral twice. The board is the one surface where that number is read out loud.
 */
function ranked(rows) {
  let place = 0;
  let previous = null;

  return rows.map((row, index) => {
    if (row.score !== previous) {
      place = index + 1;
      previous = row.score;
    }
    return { ...row, place };
  });
}

/**
 * The board: every team, best first, and the only comparative number this site ever prints (#78).
 *
 * **Not a `.board`.** That primitive says in its own comment that teams never see one -- it is a
 * dense `nowrap` mono table for admin surfaces, scrolling sideways inside its own box. Two reasons
 * it is wrong here beyond that rule. A row that has to *expand* cannot live in a table whose whole
 * design is uniform density; and `.board` is the exact component whose `contain: inline-size` had
 * to be invented after it silently widened the layout viewport to 672px on a 390px phone. A column
 * of `<li>` that wraps has neither problem to have.
 *
 * **Your own row is a different component, not a marked-up one.** Dieter's call, and it is the one
 * thing on the page doing real work: after five hours of a deliberately vague sentence and no rank
 * at all, a guest opens this to twelve rows of strangers' numbers. Finding yourself in that by
 * reading twelve names is the wrong first five seconds. So the row you are looking for is the one
 * that breaks the rhythm -- thicker edge, harder shadow, the tile gradient, and roughly double the
 * type -- and it is legible from arm's length while the rest of the column is not.
 *
 * It is decoration on top of a fact, never instead of one: the row carries its rank and its score
 * in the same two slots as every other row, and `league__flag` says "that's you" in words. A guest
 * who sees none of the styling still reads the same board.
 *
 * **First place is quieter than you are.** It gets the yellow and the shout face, and that is all
 * -- if the winner out-shouted the row a reader is hunting for, the page would be doing its one
 * job backwards. A team who is both wears `--you`, which lands later in the cascade and wins.
 *
 * **A host gets no expanded row at all**, and `showLeague()` enforces that by passing a null
 * `youId` rather than trusting it to fall out of "a host is never a team" (#76). It does not: that
 * rule is about people, and this function is handed a cookie jar. See the comment there.
 *
 * **The scale line belongs to the board, not to the page.** It reads as a footnote and is load-
 * bearing: this is the first and last surface where a number means anything, and `88` is a
 * different fact depending on whether the ceiling is 100 or 500. Keeping it here rather than in
 * `showLeague()` is also what the kit's own rule asks for -- a component's markup exists in exactly
 * one place -- and `/kit`'s coverage count is what caught it sitting in the other one, reporting
 * `.league__foot` as a class with nowhere on the page to look it up.
 *
 * It is inside the empty guard, so a night nobody played prints no scale for nothing.
 *
 * `data-team` and `data-score` are for `scripts/walk.js`, which read this board as JSON while it
 * was a stub and needed something to read instead.
 */
export function league(rows, { youId = null } = {}) {
  if (!rows.length) return '<p class="blurb">Nobody played. That is also a result.</p>';

  const row = ({ id, name, score, place }) => {
    const you = youId !== null && id === youId;
    const modifier = `${place === 1 ? ' league__row--first' : ''}${you ? ' league__row--you' : ''}`;

    return `<li class="league__row${modifier}" data-team="${Number(id)}" data-score="${Number(
      score,
    )}">
      <span class="league__rank">${Number(place)}</span>
      <span class="league__name">${escape(name)}</span>
      <span class="league__pts">${Number(score)}</span>
      ${you ? '<span class="league__flag">that’s you</span>' : ''}
    </li>`;
  };

  return `<ol class="league">${ranked(rows).map(row).join('')}</ol>
    <p class="league__foot">Ten tiles, ten points each. A perfect night is a hundred.</p>`;
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
 * Both answers take an attrs bag, because "what the button does" is the caller's and "what the
 * button says" is not. The hint modal's confirm carries `data-close-modal`; the bored box (#95)
 * carries it on *both*, since there both answers close it and do nothing else. `denyAttrs` was
 * added for that second caller -- until one existed there was nothing to hang on a deny.
 *
 * The deny is the site's **secondary** (#107). It briefly had a class of its own, `.btn--deny`,
 * invented here and used nowhere else; naming the three tiers found that a deny and a wizard's
 * back are the same act -- the other direction off this screen -- and they now share one look.
 *
 * On layout, the pair is **end-aligned, side by side and snug**, straddling the box's bottom
 * border. It used to stack, with the confirm spanning a row of its own, because equal widths left
 * hierarchy resting on fill colour alone on the one control people press without reading. #107
 * reopened that deliberately: nothing on this site is full width by default, so fill and the
 * deeper shadow are the hierarchy, and the words carry the rest.
 *
 * The pair lands as `No?` and `Okay?` -- as written. It used to land as `NO?` and `OKAY?`, because
 * `.btn--primary` was `text-transform: uppercase` site-wide and shouted a line reaching for
 * deadpan; the map had carried that as an open copy complaint since #90. #107 took the uppercase
 * off every button at once, which was always the correct blast radius for it.
 */
export function modalActions({
  aside = '',
  denyHref,
  denyAttrs = {},
  confirmHref,
  confirmAttrs = {},
}) {
  return `<div class="modal__actions">
        ${aside}
        ${denyHref ? `<a class="btn btn--secondary" href="${escape(denyHref)}"${attrsHtml(denyAttrs)}>${MODAL_NO}</a>` : ''}
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
 * The hint modal: the first of the site's two boxes (`boredModal()` is the other, #95), and the
 * reason `/js/app.js` binds anything at all beyond spending a param. It is also the only one of
 * the two that works with that file blocked -- it is rendered open and its buttons are links,
 * where the bored box is script from end to end and withholds its own button without one.
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
 * The **I'm bored** button, at the foot of the dashboard (#95). It opens `boredModal()` and does
 * nothing else -- no form, no href, no route.
 *
 * It ships **`hidden`, and `/js/app.js` is what reveals it.** That is the answer to the one thing
 * about this feature that could have gone wrong quietly: a resampling box is JavaScript by
 * definition, and #14 says nothing on this site may be load-bearing. So a phone with JS blocked
 * must not be handed a button that does nothing when pressed -- it is handed no button. It loses a
 * joke and no points, which is the correct trade for decoration, and it never sees a dead control.
 * The alternative -- render it and have it degrade to a link -- was rejected because every honest
 * destination for that link is a page the team is already on.
 *
 * It is a `<button>` with no form around it, which on this site is unusual enough to say out loud:
 * every other press a guest makes is a POST or a link. This one is the exception because it is the
 * only control on the site that changes nothing anywhere.
 *
 * **It is not a nineteenth tile.** It sits outside `.tiles` as a plain `.btn` in the stack, below
 * the grid, next to `the rules`.
 */
export function boredButton(face = chrome.boredFace) {
  return `<button class="btn" type="button" id="bored" hidden>${escape(face)}</button>`;
}

/**
 * The box behind that button: one suggestion, and two ways to say nothing back.
 *
 * **The first modal on this site that is rendered shut.** The hint box arrives open because by the
 * time it exists the hint has been revealed and charged -- it announces something that already
 * happened. This one announces nothing until asked, so `hidden` is its resting state and the
 * button is what lifts it.
 *
 * The suggestion is the `modal__title`, not the body, and the box has no body at all. It is one
 * word in the big display face with two buttons under it: the site shouts a thing at you and
 * offers you two ways to dismiss it. A sentence of explanation underneath would be the site
 * justifying the joke.
 *
 * **Both answers close it**, which is why both carry `data-close-modal` -- this is the site's
 * first caller with a deny that does anything, and what it does is nothing. Their words come from
 * `modalActions()`, so `No?` and `Okay?` are not this box's to pick (#90). The hrefs are the
 * dashboard: a press is `preventDefault`ed by `/js/app.js`, and the fallback if it ever were not
 * is the page you are already on.
 *
 * The whole list rides on the box as `data-bored` rather than being fetched, because resampling
 * per press with no page load is the point (a slot machine that needs a round trip is a slot
 * machine that stalls), and eighteen short strings are cheaper than the request that would fetch
 * one. `attrsHtml` escapes it on the way out.
 *
 * The one drawn into the markup is **sampled**, not `list[0]`, and that is not decoration. The
 * press picks from the list minus whatever is currently on screen -- so a fixed first entry would
 * be the one suggestion no team could ever get on its first press. Sampling makes the exclusion
 * land somewhere different every page load, which is to say nowhere.
 */
export function boredModal({ suggestions = chrome.bored } = {}) {
  const list = suggestions.length ? suggestions : [''];
  const [first = ''] = sample(list, 1);

  return `<div class="modal" id="bored-modal" hidden${attrsHtml({ 'data-bored': JSON.stringify(list) })}>
    <div class="modal__box">
      <p class="modal__title">${escape(first)}</p>
      ${modalActions({
        denyHref: '/',
        denyAttrs: { 'data-close-modal': true },
        confirmHref: '/',
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

/**
 * `+1 pt`, `+3 pts`. It only started mattering when tiles began reporting single points: before
 * #82 the only numbers a tile ever printed were a finished tile's ten, and `pts` was always right.
 */
const pts = (points) => `+${points} pt${Math.abs(points) === 1 ? '' : 's'}`;

const TILE_PTS = {
  locked: () => 'go find it',
  // An unlocked tile is the only state that can be part-played, and three kinds spend most of the
  // night in it on purpose: the two `trust` tiles and the signature card stay `unlocked` until
  // they are FINISHED, so that green keeps meaning finished rather than started (CONTEXT.md,
  // "Tile"). The same paragraph says a half-filled tile "lets its points do the talking" -- and
  // until #82 played the roster, nothing here let it: this returned the same three words whatever
  // the ledger said, so a team that had signed a square and sent two photographs read `not
  // played` on all three of the tiles it had actually been working at. Zero still says `not
  // played`, because zero is what you scored and not a thing you have done.
  unlocked: (points) => (points ? pts(points) : 'not played'),
  correct: (points) => pts(points),
  unknown: () => 'answered · counts at the end',
  wrong: (points) => pts(points),
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
 *
 * `download` is what the unrenderable branch means by "tap to open", and it is a parameter rather
 * than a constant because #80 gave this component a second kind of destination. Every caller
 * before it linked straight at bytes, where the attribute is exactly right. `/shots` links at a
 * *page* -- the fullscreen viewer -- and a `download` on that would hand the phone the viewer's
 * own HTML as a file. The default keeps all four original callers byte-identical.
 */
export function shot({ href = '', src = '', label = 'file', anim = '', download = true }) {
  return src
    ? `<a class="shot${anim}" href="${escape(href)}">
        <img class="shot__img" src="${escape(src)}" alt="" loading="lazy">
      </a>`
    : `<a class="shot shot--dl${anim}" href="${escape(href)}"${download ? ' download' : ''}>
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
 * `/shots` (#80): every photograph of the night, by everyone, as a wall.
 *
 * **A wall and not a strip**, which is why it is not `shots()` with a wider grid. `shots()` counts
 * what YOU sent and reads *"you've sent 6"*; this counts what the house shot and belongs to
 * nobody. They also tap through to different places -- a strip at raw bytes, a wall at the
 * viewer -- so one function with a flag would be two functions sharing a name.
 *
 * Each entry is `{ href, src, label, id }`, already resolved by the caller for `shot()`'s reason:
 * which of a submission's three photo columns to point at is database knowledge and this file has
 * none. `id` becomes the cell's fragment, which is what lets the viewer's close link land you back
 * on the photograph you opened rather than at the top of a seven-screen scroll -- and, on a
 * browser that has them, is what the reverse view transition morphs into. See `viewer()`.
 *
 * `filters` is markup the page has already rendered, for the same reason `unitRow()` takes a
 * `body`: which route a form points at is the page's business, never the design system's.
 */
export function wall(cells = [], { filters = '', empty = 'No photographs yet.' } = {}) {
  if (!cells.length) return `${filters}<p class="blurb">${escape(empty)}</p>`;

  const cell = ({ id, ...rest }) =>
    `<div class="wall__cell" id="p${Number(id)}">${shot({ ...rest, download: false })}</div>`;

  return `${filters}
    <p class="statusline">${cells.length} photograph${cells.length === 1 ? '' : 's'}</p>
    <div class="wall">${cells.map(cell).join('')}</div>`;
}

/**
 * One photograph, fullscreen, with every other photograph in the same filter to either side of it.
 *
 * **It builds its own document instead of calling `layout()`, and that is the point of it.**
 * `layout()` is the site's frame -- marquee, scorebar, `<h1>`, menu bar, small print -- and this
 * surface exists to have none of that: a picture on a black field, edge to edge, which is what
 * "opens fullscreen" means. Passing four flags into `layout()` to switch off everything it does
 * would leave a function whose only remaining job is the `<head>`, and this needs a different one
 * anyway (`viewport-fit=cover`, so the picture reaches under a notch).
 *
 * **The swipe is the browser's, not ours.** The track is a horizontal scroller with
 * `scroll-snap-type: x mandatory` and one panel per photograph, so flicking through them is native
 * momentum scrolling on both phones -- with the inertia, the rubber-banding and the scrollbar the
 * OS already draws. There is no gesture handler anywhere on this site, and this page did not add
 * the first one. What it costs is that all N panels are in the document; `loading="lazy"` is what
 * keeps that from being N megabytes, and the caller marks the one you arrived at eager so it is
 * painted rather than pending at the moment the transition needs it.
 *
 * **Arriving at the right photograph is a fragment**, `#p<id>`, which the browser scrolls the
 * track to before first paint. No script, no scroll maths, and the URL of a picture is a URL you
 * can hand to someone.
 *
 * **The view transition is CSS on this side.** `:target` names the panel you arrived at
 * `shot-open`, the wall names the thumbnail you tapped the same thing, and the browser morphs one
 * into the other -- see `public/js/app.js` for the outbound half and `app.css` for the pair of
 * rules. A browser without view transitions cuts, which is what every browser did before.
 */
export function viewer({ panels, back, title = 'Shots' }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="theme-color" content="#000">
  <title>${escape(title)}</title>
  <link rel="stylesheet" href="/css/app.css">
</head>
<body class="viewer">
  <div class="viewer__track">${panels}</div>
  <a class="viewer__close" href="${escape(back)}" aria-label="Back to the wall">close</a>
</body>
</html>`;
}

/**
 * One panel of the viewer: the photograph, and underneath it who took it and what it answers.
 *
 * **Whose camera, and what it answers. Nothing else** -- and the thing deliberately NOT here is
 * Portrait of a stranger's sentence.
 *
 * It was here, in a `bubble()`, and it looked good. Dieter took it out: the ~65 things people
 * actually said tonight are the recap's raw material ([#81]), and spending them on a wall nobody
 * reads captions on is spending them. `submissions.body` still holds every one of them; this
 * surface is looking at photographs, and the recap is what turns them back into a moment.
 *
 * **"shot by", and it is not decoration.** The handle alone sat directly above the game's title,
 * and on a portrait that reads as a caption for the FACE -- PLATYPUS, Portrait of a stranger.
 * Portrait records nothing whatever about who is in the shot and that is a decision, not a gap
 * (#25, CONTEXT.md): the photograph is the identity. A caption that quietly names the subject
 * would be inventing the one field the tile refuses to store. Two words fix it, and they are true
 * of every photograph on the wall rather than a special case for one game.
 */
export function viewerPanel({ id, src, href, label = 'file', who, what = '', eager = false }) {
  const picture = src
    ? `<img class="viewer__img" src="${escape(src)}" alt=""${eager ? '' : ' loading="lazy"'}>`
    : `<a class="viewer__dl" href="${escape(href)}" download>${escape(label)}<br>tap to open</a>`;

  return `<figure class="viewer__panel" id="p${Number(id)}">
      ${picture}
      <figcaption class="viewer__cap">
        <span class="viewer__who">shot by ${escape(who)}</span>
        ${what ? `<span class="viewer__what">${escape(what)}</span>` : ''}
      </figcaption>
    </figure>`;
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

/**
 * A sheet of paper with a run of prose on it (#105).
 *
 * The site had three answers to "does a paragraph get a box" and no rule: the door's paper, a game
 * page's tile-gradient blurb, and -- on `/rules`, under the longest read in the house -- nothing at
 * all. This is the answer. **Two or more paragraphs the page exists to have read sit on paper**, and
 * it is the passage that decides rather than the page, so a one-line joke or a `<small>` sign-off
 * under a hero still sits on the gradient where it always did.
 *
 * Takes the paragraphs as STRINGS and escapes them, because every caller so far is handing it copy
 * out of `content/` and the one thing a prose surface must never become is a hole markup falls
 * through. A caller that genuinely needs markup inside a sheet writes `<div class="paper">` itself
 * and takes the escaping on -- `content/pages/` already does exactly that for `.hero`.
 *
 * A heading is deliberately NOT part of it. On `/rules` the `HOW POINTS WORK` shout stays outside on
 * the gradient, so the page still reads as a loud page with a quiet passage in it rather than
 * turning into a document -- and the window frame above it already relates to its heading the same
 * way. Dieter's call, off four rendered versions of the page.
 */
export const paper = (paragraphs = []) =>
  `<div class="paper">${paragraphs.map((para) => `<p>${escape(para)}</p>`).join('')}</div>`;

/**
 * One screen of the onboarding wizard (#97) -- the door, taken one question at a time.
 *
 * It is a `.paper` sheet with a form on it (#105). The surface used to be `.door`'s own and is now
 * shared with every long read on the site, which is why the class list starts with `paper`; nothing
 * about this screen changed on the way.
 *
 * It wears the **look** of the house alert box and is deliberately not one: no `.modal` overlay, no
 * `role`, nothing fixed, nothing to dismiss. It is a page with a form in it that happens to be
 * drawn as a box, which is what the ticket asked for in those words. That distinction is load
 * bearing in one place -- the nav words. `No?` and `Okay?` are reserved for a real modal's two
 * answers (#90); these are page buttons, which is what lets the wizard have its own six forward
 * words and `actually, no` for back.
 *
 * **Everything is a `<button>` in one `<form>`, and back carries `formmethod="get"`.** That is the
 * same trick the team-name reroll and the ladder's skip already use, and it is why the wizard needs
 * no client JS and no server-side draft: pressing back re-submits the screen you are looking at as
 * a GET to the previous screen, so whatever you had typed travels with you in the query string and
 * is still there when you come forward again. `formnovalidate` is what lets that happen with a
 * required field still empty.
 *
 * **The counter is honest rather than equal**, which was the third of the ticket's open questions.
 * A solo captain genuinely walks one screen fewer than a pair, so either two teams standing beside
 * each other see different totals or N is a fixed lie. Different totals, then -- nobody compares
 * counters in a hallway, and a pair reaching "8 of 8" with a screen still to go is the kind of
 * small dishonesty that makes people distrust the rest of the page. Before the second name is
 * settled the total assumes a pair, because teams of two are the locked constraint and the solo
 * case is the exception; a solo sees the total tick down by one when they skip, which is the moment
 * it becomes knowable.
 *
 * `back` is optional -- screen one has nothing behind it but the front door.
 *
 * `extra` is a screen's own ad-hoc press -- `deal us another`, `ask me something else` -- and it
 * renders INSIDE the action row, ahead of back. Both of those RELOAD this same screen with a
 * different name or a different question rather than advancing it, which is what makes them the
 * site's **tertiary** and not an alternative to the primary (#107). Back is the **secondary**: the
 * other direction off this screen, the same act as a dialog's deny, wearing the same look.
 *
 * The row reads quietest-first, left to right -- tertiary, secondary, primary -- and is
 * end-aligned, so the way on is the button under your thumb.
 *
 * `forwardAlt` is the forward button's OTHER word, and it is why step 2 no longer carries three
 * buttons (#107). That screen asks for a second name and used to offer `on my own` beside back, in
 * the identical look, so the press that goes on without a mate and the press that throws away your
 * typing were the same button. One button says both things now: `watch` names an input, and while
 * that input is empty the forward reads `forwardAlt` instead of `forward`. Pure CSS in `app.css`,
 * no script, and the server renders both words -- see `.door__fw-alt` there for why that is not the
 * site's no-self-updating rule being broken.
 */
export function doorStep({
  step,
  of,
  title,
  intro = '',
  body = '',
  action,
  method = 'get',
  back = '',
  backWord = 'actually, no',
  forward,
  forwardAlt = '',
  extra = '',
}) {
  return `<form class="paper door stack" method="${escape(method)}" action="${escape(action)}">
    <p class="door__count">step ${Number(step)} of ${Number(of)}</p>
    <h1 class="door__title">${escape(title)}</h1>
    ${intro ? `<p class="door__intro">${escape(intro)}</p>` : ''}
    ${body}
    <div class="door__actions">
      ${extra}
      ${
        back
          ? `<button class="btn btn--secondary" formmethod="get" formaction="${escape(back)}"
                     formnovalidate>${escape(backWord)}</button>`
          : ''
      }
      <button class="btn btn--primary">${
        forwardAlt
          ? `<span class="door__fw">${escape(forward)}</span><span class="door__fw-alt">${escape(forwardAlt)}</span>`
          : escape(forward)
      }</button>
    </div>
  </form>`;
}

/**
 * The box that tells a team what onboarding just opened for them (#97).
 *
 * This is the wizard's step 6, and it is **not a screen** -- that was the ticket's fourth open
 * question. A team who scanned a code on the way in has one held in a cookie, and finishing the
 * door spends it and lands them on that game; a screen announcing the unlock would sit between them
 * and the thing they walked across the room for. So the announcement rides on the page they were
 * always going to land on, and costs a tap fewer than it did as a screen.
 *
 * It only ever renders on the dashboard. A team that arrives on a game page instead has been handed
 * something better than an announcement, which is the whole argument above.
 */
export function openedBox({ tiles = 0 }) {
  const count = Number(tiles);
  const opened = count === 1 ? 'One game is open' : `${escape(String(count))} games are open`;

  return `<p class="banner banner--opened">You're in. ${opened}. The rest are on bits of paper around this house.</p>`;
}

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
      <a class="btn btn--tertiary" href="/">back to the dashboard</a>
    `,
  });
}

/**
 * The 404. It used to read "there is no rule 4 either" -- a lie the site told until a team bought a
 * hint and made it true, since the hint rule arrived on `/rules` as the fourth item.
 *
 * #97 added a visible fourth rule and that line would have become honest on every page load, which
 * is the one thing it could not survive. Dieter's call was that he never got the gag and does not
 * care about it, so it is gone rather than renumbered to chase the hint rule down the list -- a
 * joke that has to be renumbered every time a rule is written is a maintenance cost nobody agreed
 * to pay. What replaces it keeps the register and counts nothing.
 */
export const notFound = () =>
  layout({
    title: '404',
    body: '<p>nothing here. you were not sent here by a QR code, so you typed this yourself.</p>',
  });
