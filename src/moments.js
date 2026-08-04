// A **moment** is the one thing that just happened, carried across a redirect so the arriving
// page can react to it. See docs/adr/0009-the-page-you-are-on-is-the-stage.md.
//
// Every state change on this site is a POST-and-redirect or a scan redirect, so the server has
// exactly one channel to say what it just did: a query param on the destination. `?just=` is
// that channel, and this module owns its vocabulary.
//
// The page a team is already on is the stage. A moment is therefore always delivered to the page
// that caused it -- never to the dashboard, which the team did not ask to see.

/** The whole vocabulary. A value outside this set is ignored rather than trusted. */
export const MOMENTS = new Set([
  'unlock', // a scan just unlocked this game
  'step', // a scan just advanced this hunt to a new step
  'correct', // an answer was judged right, on submit
  'incorrect', // an answer was judged wrong, on submit
  'banked', // a trust game took the submission and paid for it, unjudged
  'pending', // submitted, and unscoreable until game end
  'shot', // a photo just landed
]);

/** The moment this request is carrying, or null. */
export function momentOf(url) {
  const moment = url.searchParams.get('just');
  return MOMENTS.has(moment) ? moment : null;
}

/**
 * The moment a submission produced. Mirrors the four judging modes: only `check` knows a verdict
 * at submit time, which is why `correct` is the rarest moment on the site and cannot be the only
 * feedback a team ever gets.
 */
export function momentForSubmission({ photo, mode, verdict }) {
  if (photo) return 'shot';
  if (mode === 'check') return verdict === 'correct' ? 'correct' : 'incorrect';
  if (mode === 'trust') return 'banked';
  return 'pending';
}

/** A game page, with the moment that just happened attached. `step` is 0 for non-hunts. */
export function gamePath(gameId, { step = 0, moment = null } = {}) {
  const params = new URLSearchParams();
  if (step) params.set('step', String(step));
  if (moment) params.set('just', moment);

  const query = params.toString();
  return `/g/${gameId}${query ? `?${query}` : ''}`;
}

// --- what moves ---------------------------------------------------------------------------------
//
// Three animations, no more -- `anim-unlock`, `anim-correct`, `anim-page` are the entire
// vocabulary the style kit ships. Everything here returns a class to append, or ''.

/** The hero is where an arriving team is already looking, so it carries the arrival. */
export function heroAnimation(moment) {
  if (moment === 'unlock') return ' anim-unlock';
  if (moment === 'step') return ' anim-page';
  return '';
}

/** Only a genuinely correct answer is celebrated. Everything else gets an honest line instead. */
export const verdictAnimation = (moment) => (moment === 'correct' ? ' anim-correct' : '');

/** The photo that just landed, and only that one. */
export const shotAnimation = (moment) => (moment === 'shot' ? ' anim-correct' : '');

/**
 * What the team is told after submitting. Deliberately honest for the three non-`check` modes:
 * on a full roster most submissions cannot be scored yet, and pretending otherwise would make
 * the Unknown tile a lie.
 */
export const SUBMITTED = {
  correct: 'Correct. That is on the board.',
  incorrect: 'Not that one. You can change your answer right up to the end.',
  banked: 'Got it, and counted. Nobody is judging this one.',
  pending: 'Sent. This one cannot be scored until the end of the night.',
};
