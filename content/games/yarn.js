// LONGEST YARN -- one of the two starter tiles (#7): open for every team from onboarding, and the
// only game on the roster with no QR code, because there is nothing to scan. The string is the
// find. Decisions in #24.
//
// Yarns of varying length are hidden around the house. You keep what you find, only your single
// longest one counts, and one of them is much longer than the rest.

// ---------------------------------------------------------------------------------------------
// TWO NUMBERS ARE MISSING AND LAND ON THE DAY.
//
// The yarns are laid out on the 14th -- which one ends up longest depends on the hiding spots,
// and how many go out depends on the team count, which is only known once the RSVPs are in the
// night before. So neither number can honestly be written here in advance.
//
// `unfinished()` below makes the boot shout while either is null, and `resolve()` degrades to
// floor-plus-ranking and pays no jackpot. Nothing crashes; the tile just loses its secret.
// ---------------------------------------------------------------------------------------------

/** The true length, in centimetres, of the longest yarn actually hidden in the house. */
const ACTUAL_LONGEST_CM = null;

/**
 * How far a claim may sit from `ACTUAL_LONGEST_CM` and still count as holding it, as a fraction:
 * 0.25 means 225-375 around a true 300. It is a BAND and not a nearest-match, which is what keeps
 * the jackpot honest under eyeballed claims -- a team typing 900 to steal first place lands far
 * outside it and gets nothing extra.
 *
 * The band is only as honest as the gap between the longest yarn and the next one: if the runner
 * up is within the band, a team that badly overestimates an ordinary yarn can gate-crash it. Set
 * this once the yarns are laid out and both lengths are known.
 *
 * EVERY CLAIM IS EYEBALLED (#100). Nothing in this house measures -- there is no tape measure and
 * no ruler put anywhere on purpose, because #24 rejected length tags to keep an estimation game
 * inside the hoard game, and a tape measure is a length tag with a queue in front of it. So the
 * band is not a rounding allowance, it is the entire margin between a good guess and a bad one,
 * and it is the ONLY number here that has to be chosen rather than measured.
 *
 * Which makes the gate-crash above arithmetic rather than a worry. Write A for the true longest,
 * R for the runner up, and k for the worst overestimate a person makes holding wool -- half as
 * long again, so k = 1.5. A claim gets into the band from A(1 - TOLERANCE) upwards, so the
 * runner up stays out of it while
 *
 *     TOLERANCE < 1 - k * (R / A)
 *
 * At the 2x gap #43 asks the scissors for -- A = 300, R = 150 -- that is TOLERANCE < 0.25, and
 * 0.25 sits exactly ON the line: a 150cm yarn eyeballed at 225 lands on the band's lower edge and
 * collects the jackpot. So take 0.2 and leave the daylight. Cut the gap wider and this loosens;
 * come out of the scissors with less than 2x and it tightens fast.
 */
const TOLERANCE = null;

const FLOOR = 2; // for claiming anything at all
const RANK = { 1: 5, 2: 3, 3: 2 }; // on top of the floor
const JACKPOT = 3; // for holding the genuinely longest yarn

// 2 + 5 + 3 = 10, exactly the tile budget, so the ceiling enforces itself and nothing clamps.
// Boot cannot check this the way it checks a hunt: an `answer` game spends its budget inside
// resolve(), where only this file knows the arithmetic. If you edit the numbers above, they must
// still sum to 10 at most for a single team.

/**
 * The first number in whatever they typed, or null. Deliberately forgiving of "about 210" and
 * "210cm" and deliberately unforgiving of "quite long" -- there is no submit-time hook on a
 * resolve game, so the alternative is this function inventing a length for a sentence.
 */
function parseClaim(body) {
  const match = /(\d+(?:[.,]\d+)?)/.exec(body ?? '');
  if (!match) return null;
  const cm = Number(match[1].replace(',', '.'));
  return Number.isFinite(cm) && cm > 0 ? cm : null;
}

/** Whether a claim sits inside the band around the true longest. False while either is unset. */
function holdsTheLongest(cm) {
  if (ACTUAL_LONGEST_CM === null || TOLERANCE === null) return false;
  return Math.abs(cm - ACTUAL_LONGEST_CM) <= ACTUAL_LONGEST_CM * TOLERANCE;
}

export default {
  id: 'yarn',
  title: 'Longest yarn',
  kind: 'answer',

  // A tile starts open only if learning about it late is unrecoverable (#7): a team that hears
  // about the string at midnight has already walked past all of it.
  starter: true,

  hero: {
    text:
      'There is string hidden all over this house. Find it. Keep it. ' +
      'Only your longest one counts.\n\n' +
      'One of them is much longer than the rest. Nobody has to find it.',
  },

  // The page says nothing about how to measure, and that silence is the decision (#100). A line
  // like "there is a tape measure in the hall" reads as help and behaves as an errand: it sends
  // ten to fifteen teams to one object, and it swaps an estimate made in the room for a queue.
  // The rules already grant the only permission a team needs -- "Open the drawers. Open the
  // cupboards. Close them again." -- so anything the house happens to own is found the way
  // everything else in this house is found, and never announced.
  form: { placeholder: 'how long, in centimetres', inputmode: 'decimal' },

  // No hints, deliberately. A hint here could only name a hiding place, and the hiding places do
  // not exist until the 14th -- so any hint written today would be a lie sold for three points.
  // If spot-hints are wanted, they are a day-of content edit alongside the two numbers above.

  /** Loud at boot while the day-of numbers are missing. */
  unfinished() {
    const holes = [];
    if (ACTUAL_LONGEST_CM === null) holes.push('ACTUAL_LONGEST_CM is null, so nobody can win the jackpot');
    if (TOLERANCE === null) holes.push('TOLERANCE is null, so the jackpot band does not exist');
    return holes;
  },

  /**
   * Judged across every team at game end, because "longest" is not knowable until every claim is
   * in. Ties share the better rank and push the ranks below them down, the same way the standings
   * do -- telling two teams with identical string that one of them came second is a worse error
   * than occasionally paying two firsts.
   */
  resolve(submissions) {
    const outcomes = [];
    const claims = [];

    for (const submission of submissions) {
      const cm = parseClaim(submission.body);
      if (cm === null) {
        outcomes.push({
          teamId: submission.team_id,
          submissionId: submission.id,
          points: 0,
          verdict: 'incorrect',
          reason: 'no length in the claim',
        });
        continue;
      }
      claims.push({ teamId: submission.team_id, submissionId: submission.id, cm });
    }

    claims.sort((a, b) => b.cm - a.cm);

    let rank = 0;
    let previous = null;
    for (const [index, claim] of claims.entries()) {
      if (claim.cm !== previous) {
        rank = index + 1;
        previous = claim.cm;
      }
      claim.rank = rank;
    }

    for (const claim of claims) {
      const placing = RANK[claim.rank] ?? 0;
      const jackpot = holdsTheLongest(claim.cm) ? JACKPOT : 0;

      const reason = [`${claim.cm}cm`];
      if (placing) reason.push(`${claim.rank}${['st', 'nd', 'rd'][claim.rank - 1]} place`);
      if (jackpot) reason.push('the longest yarn in the house');

      outcomes.push({
        teamId: claim.teamId,
        submissionId: claim.submissionId,
        points: FLOOR + placing + jackpot,
        verdict: 'correct',
        reason: reason.join(', '),
      });
    }

    return outcomes;
  },
};
