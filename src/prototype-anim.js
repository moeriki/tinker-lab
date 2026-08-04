// PROTOTYPE — THROWAWAY. Delete this file, do not merge it to main.
//
// The question ("Animation choreography", issue #14): which moment in the real flow fires which
// animation, and does a page transition earn client JS at all?
//
// Three choreography schemes, switchable via `?variant=A|B|C`, walkable against the REAL routes
// with real redirects and real player data. They disagree about one thing:
//
//   A  STILL     the site never celebrates. `anim-page` on arrival is the only motion. No
//                signals, no query params, no JS. Redirects exactly as they are today.
//   B  GRID      the dashboard is the stage. Every moment is a tile moving, so the flow is
//                routed THROUGH the grid: a scan lands on `/` and you watch the tile crack open
//                before tapping in. Costs one extra tap on every single unlock.
//   C  IN PLACE  the page you are already on is the stage. A scan opens the game directly and
//                the hero plays the unlock; submitting keeps you on the game page and the
//                verdict lands under your thumb. You never bounce to the grid to be told things.
//
// The variant rides in a COOKIE, not the URL — every one of these moments is a POST-and-redirect
// or a scan redirect, so a query param would be dropped on the first hop. That is itself a
// finding about how much a PRG flow can carry.

import { parseCookies, setCookie } from './http.js';

export const SCHEMES = {
  A: 'STILL — nothing celebrates',
  B: 'GRID — the dashboard is the stage',
  C: 'IN PLACE — the page you are on is the stage',
};

const COOKIE = 'protoanim';
const DEFAULT = 'A';

/** `?variant=` wins and is remembered; otherwise the cookie; otherwise A. */
export function variantOf(req, res, url) {
  const asked = (url.searchParams.get('variant') ?? '').toUpperCase();

  if (asked && asked in SCHEMES) {
    if (res) setCookie(res, COOKIE, asked, { httpOnly: false });
    return asked;
  }

  const remembered = parseCookies(req)[COOKIE];
  return remembered in SCHEMES ? remembered : DEFAULT;
}

// --- where the flow lands ------------------------------------------------------------------------

/**
 * A scan resolved to a game. `step` is 0 for non-hunts. `firstUnlock` is true when this scan is
 * what granted the unlock (a plain game, or step 1 of a hunt) — the only moment `anim-unlock`
 * has any claim to.
 */
export function scanLanding(scheme, { game, step, firstUnlock }) {
  const stepQuery = step ? `?step=${step}` : '';

  if (scheme === 'B') {
    // Route through the grid so the tile can be watched opening. The cost is an extra tap: the
    // guest wanted the game, and got a dashboard.
    if (firstUnlock) return `/?unlocked=${encodeURIComponent(game.id)}`;
    return `/g/${game.id}${stepQuery}`;
  }

  if (scheme === 'C') {
    // Straight in, no detour. The GAME PAGE plays the arrival — its hero does the unlocking.
    const separator = stepQuery ? '&' : '?';
    return `/g/${game.id}${stepQuery}${firstUnlock ? `${separator}just=unlock` : `${separator}just=step`}`;
  }

  return `/g/${game.id}${stepQuery}`;
}

/** A submission landed. `verdict` is 'correct' | 'incorrect' | 'pending'; photo games differ. */
export function submitLanding(scheme, { game, verdict, photo }) {
  if (photo) {
    // Photo games never returned to the dashboard anyway — one tap to send another is the point.
    return scheme === 'C' ? `/g/${game.id}?shot=1` : `/g/${game.id}`;
  }

  if (scheme === 'B') return `/?${verdict === 'correct' ? 'correct' : 'done'}=${encodeURIComponent(game.id)}`;

  // C keeps you where you are: the answer is judged under your thumb, and closing is your call.
  if (scheme === 'C') return `/g/${game.id}?verdict=${verdict}`;

  return '/';
}

// --- what moves ----------------------------------------------------------------------------------

/** The class a dashboard tile gets this render. Only B ever moves a tile. */
export function tileAnimation(scheme, url, gameId) {
  if (scheme !== 'B') return '';
  if (url.searchParams.get('unlocked') === gameId) return ' anim-unlock';
  if (url.searchParams.get('correct') === gameId) return ' anim-correct';
  return '';
}

/** The class the game page's hero gets. Only C ever moves it. */
export function heroAnimation(scheme, url) {
  if (scheme !== 'C') return '';
  const just = url.searchParams.get('just');
  if (just === 'unlock') return ' anim-unlock';
  if (just === 'step') return ' anim-page';
  return '';
}

/** The class the submitted-answer area gets. Only C shows a verdict in place. */
export function verdictAnimation(scheme, url) {
  if (scheme !== 'C') return '';
  return url.searchParams.get('verdict') === 'correct' ? ' anim-correct' : '';
}

/** The class the newest photo gets. Only C acknowledges a photo landing. */
export const shotAnimation = (scheme, url) =>
  scheme === 'C' && url.searchParams.get('shot') ? ' anim-correct' : '';

/** Every scheme animates page arrival — that is the one thing none of them argue about. */
export const pageAnimation = () => ' anim-page';

// --- the switcher --------------------------------------------------------------------------------

const KEYS = Object.keys(SCHEMES);

/**
 * The floating bar. Deliberately ugly and obviously not part of the design under evaluation.
 * Plain links, because this site has no client router and the prototype should not invent one.
 */
export function switcherBar(scheme, url) {
  const index = KEYS.indexOf(scheme);
  const previous = KEYS[(index - 1 + KEYS.length) % KEYS.length];
  const next = KEYS[(index + 1) % KEYS.length];

  const link = (variant) => {
    const target = new URL(url);
    // Drop the one-shot signals so switching variant does not replay someone else's animation.
    for (const key of ['unlocked', 'correct', 'done', 'just', 'verdict', 'shot']) {
      target.searchParams.delete(key);
    }
    target.searchParams.set('variant', variant);
    return `${target.pathname}${target.search}`;
  };

  return `
    <div class="protobar" data-protobar data-prev="${link(previous)}" data-next="${link(next)}">
      <a class="protobar__arrow" href="${link(previous)}" aria-label="previous variant">←</a>
      <span class="protobar__label"><strong>${scheme}</strong> ${SCHEMES[scheme]}</span>
      <a class="protobar__arrow" href="${link(next)}" aria-label="next variant">→</a>
    </div>`;
}
