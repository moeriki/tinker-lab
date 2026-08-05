// A **moment** is the one thing that just happened, carried across a redirect so the arriving
// page can react to it. See docs/adr/the-page-you-are-on-is-the-stage.md.
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
  'shot', // a photo just landed, and it paid
  'spare', // a photo just landed and paid nothing: a retake, or past the last unit
  'rescan', // unlocked by a scan whose physical effect was deferred; go and scan it again
  'signed', // a signature landed on a card square
  'bingo', // that signature completed a line, and the line pays the tile
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
 * standing in front of it. See ADR-the-first-scan-is-not-live.
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
export function momentForSubmission({ photo, mode, verdict, paid = true }) {
  if (photo) return paid ? 'shot' : 'spare';
  if (mode === 'check') return verdict === 'correct' ? 'correct' : 'incorrect';
  if (mode === 'trust') return 'banked';
  return 'pending';
}

// --- the hint notice ----------------------------------------------------------------------------
//
// Revealing a hint is a one-shot signal like a moment, but it is not one: nothing animates, and
// what it has to say is a price rather than a verdict. So it rides its own param and `?just=`
// keeps the closed vocabulary ADR-the-page-you-are-on-is-the-stage gave it. Both are spent on
// arrival the same way.
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

/**
 * Only a genuinely correct answer is celebrated. Everything else gets an honest line instead.
 *
 * `bingo` qualifies and `signed` deliberately does not: a completed line is a verdict on the whole
 * tile, decided and paid on the spot, which is exactly what `anim-correct` was reserved for. A
 * signature is a step towards one, and animating all eight of them would spend the celebration on
 * the thing that happens most.
 */
export const verdictAnimation = (moment) =>
  moment === 'correct' || moment === 'bingo' ? ' anim-correct' : '';

/**
 * The photo that just landed, and only that one. A `spare` animates too: it is every bit as much
 * a photograph as one that paid, and the party wanted it. The banner is where the difference in
 * worth gets said, not the animation.
 */
export const shotAnimation = (moment) =>
  moment === 'shot' || moment === 'spare' ? ' anim-correct' : '';

/**
 * What the team is told after submitting. Deliberately honest for the three non-`check` modes:
 * on a full roster most submissions cannot be scored yet, and pretending otherwise would make
 * the Unknown tile a lie.
 *
 * These are the DEFAULTS. A game may bring its own words as `verdicts: { correct, incorrect }` in
 * content, and one kind of game must: `incorrect` below promises the answer can still be changed,
 * which is true of every editable answer game and a flat lie on a game whose answer is final --
 * told at the one moment a team most needs to know it. Boot refuses a `final` game that does not
 * replace it. See docs/adr/an-answer-may-be-final.md.
 */
export const SUBMITTED = {
  correct: 'Correct. That is on the board.',
  incorrect: 'Not that one. You can change your answer right up to the end.',
  banked: 'Got it, and counted. Nobody is judging this one.',
  pending: 'Sent. This one cannot be scored until the end of the night.',
  // A paid photo says nothing: the thumbnail flying into the strip has already said it, and a
  // banner on every single shot would be noise on the two tiles you use most. Only the unpaid
  // one has news, and it must never read as "stop" -- the photographs are what the pair is for.
  spare:
    "Kept. It doesn't add a point — you've had that one already. Take more anyway: we want the photographs more than the arithmetic.",
  // A signature that landed and did not finish a line. Deliberately flat: this happens up to eight
  // times a night on the same tile, and a celebration on each one is noise by the third.
  signed: 'Signed. That name is spent now — you cannot use it again on this card.',
  // The one shout the tile has. It replaces the squares rather than adding to them, and says so,
  // because a team watching the number go 3 -> 10 will otherwise assume it kept the 3 as well.
  bingo: 'Three in a row. That is the whole tile — ten points, and the squares stop mattering.',
};
