// A **moment** is the one thing that just happened, carried across a redirect so the arriving
// page can react to it. See docs/adr/0009-the-page-you-are-on-is-the-stage.md.
//
// Every state change on this site is a POST-and-redirect or a scan redirect, so the server has
// exactly one channel to say what it just did: a query param on the destination. `?just=` is
// that channel, and this module owns its vocabulary -- along with `?hint=`, its one sibling,
// for the reveal notice that has a price to announce rather than an animation to start.
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
  'rescan', // unlocked by a scan whose physical effect was deferred; go and scan it again
]);

/**
 * What a team is told on arrival, for the moment that carries an instruction rather than a
 * verdict.
 *
 * `rescan` exists because one scan on this site is not live: the very first one. An un-onboarded
 * guest's scan is held in a cookie and replayed a minute later, once they have a team -- and for
 * a hunt step that fires a webhook, the physical half of the scan is the whole point. Firing it
 * on the replay would flash a lamp in an empty room while the team is still head-down in a form,
 * spending the clue that lamp was supposed to be. So the replay keeps the unlock and drops the
 * webhook, and this line asks for the one thing that puts it right: scan it again, on purpose,
 * standing in front of it. See ADR-0011.
 */
export const ARRIVED = {
  rescan: "You're in — and this one is yours now. Go back and scan that code again: this time, something happens.",
};

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

// --- the hint notice ----------------------------------------------------------------------------
//
// Revealing a hint is a one-shot signal like a moment, but it is not one: nothing animates, and
// what it has to say is a price rather than a verdict. So it rides its own param and `?just=`
// keeps the closed vocabulary ADR-0009 gave it. Both are spent on arrival the same way.
//
// It is a **notification, never a confirmation**. By the time this param exists the reveal is
// written, the negative award is in the ledger and the hint is on the page underneath the modal.
// Nothing about the hint waits for a tap. See CONTEXT.md, "Hint reveal".

/** The whole vocabulary. A value outside this set is ignored rather than trusted. */
export const HINT_NOTICES = new Set([
  'free', // the first reveal this team has ever made, and it cost nothing
  'paid', // every reveal after it
]);

/** The hint notice this request is carrying, or null. */
export function hintNoticeOf(url) {
  const notice = url.searchParams.get('hint');
  return HINT_NOTICES.has(notice) ? notice : null;
}

/**
 * The notice a reveal earned, or `null` for one worth no announcement: a reveal that did not
 * happen because the team has seen every hint, or a `hintCost` of zero, which makes hints free
 * forever and leaves this modal with no price to name and no gift to make of it. The number
 * itself is the economy ticket's to move; all this asks is whether there is one.
 */
export function hintNoticeFor(revealed, hintCost) {
  if (!revealed || hintCost <= 0) return null;
  return revealed.isFirstEver ? 'free' : 'paid';
}

/** A game page, with what just happened attached. `step` is 0 for non-hunts. */
export function gamePath(gameId, { step = 0, moment = null, hint = null } = {}) {
  const params = new URLSearchParams();
  if (step) params.set('step', String(step));
  if (moment) params.set('just', moment);
  if (hint) params.set('hint', hint);

  const query = params.toString();
  return `/g/${gameId}${query ? `?${query}` : ''}`;
}

// --- what moves ---------------------------------------------------------------------------------
//
// Three animations, no more -- `anim-unlock`, `anim-correct`, `anim-page` are the entire
// vocabulary the style kit ships. Everything here returns a class to append, or ''.

/** The hero is where an arriving team is already looking, so it carries the arrival. */
export function heroAnimation(moment) {
  if (moment === 'unlock' || moment === 'rescan') return ' anim-unlock';
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
