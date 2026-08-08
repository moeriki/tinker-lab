// GUESS WHO -- one of the roster's three cross-team talkers (#7). Decisions in #22.
//
// Everybody answers one question on their way in (`content/questions.js`, the `guess-who` ladder).
// This tile deals a team TEN of those answers, stripped of their owners, and asks who wrote each.
//
// THE TILE IS A LICENCE TO INTERRUPT STRANGERS. You cannot deduce that Sofie wanted to be a
// paleontologist; the only way to find out is to walk up to Sofie, who you may never have met, and
// ask. The cards are the excuse, the conversations are the product, and the points are what makes
// anyone bother. Every decision below falls out of that and not out of puzzle design.
//
// TEN CARDS, NOT THE WHOLE HOUSE. With ~25 guests the corpus is ~22 answers once your own are
// out, and 10 points do not divide 22 ways without fractions or bands -- against the rule that the
// board has to be arithmetic a guest can do in their head (#8). Ten cards is one point each,
// exactly the tile budget, no completion bonus and no remainder. It also dissolves the growing
// corpus rather than managing it: teams arrive all night (#7), and a hand is ten whenever you open
// it, where a whole-corpus form would keep growing under you.
//
// THIS TILE COUNTS GUESTS, NOT TEAMS, which is why #117 went past it without touching anything. Cards
// are dealt per member, so a house of teams of three has the same corpus as a house of pairs and a
// team of three merely holds one more of its own answers back. Ten cards either way.
//
// The hand TOPS UP rather than freezing, so the first team through the door is not capped at
// however few guests had onboarded when they opened the tile -- see src/deals.js.
//
// RESOLVED AT GAME END, and that is load-bearing rather than tidy. A verdict on submit would let a
// team sit on the sofa cycling names until the tile went green, which is the one way to score this
// without talking to anybody. So guesses are editable all night and judged once, at the end.
//
// NO HINTS, for the reason Longest yarn has none: a hint costs 3 points and a card is worth 1, so
// the only hint this tile could sell is a purchase nobody sane makes. That is arithmetic, not
// taste. If it ever wants one it needs something worth more than three cards, and nothing here is.

/** One point per card, ten cards, a flat ten-point tile. Boot checks the arithmetic. */
const POINT = 1;

export default {
  id: 'guess-who',
  kind: 'tally',
  title: 'Guess Who',

  points: POINT,

  // Units dealt per team out of what other guests answered at the door, rather than declared here
  // the way the scavenger's ten prompts are. Which ten you hold is a fact about your team, so it
  // cannot live in content -- src/deals.js owns the dealing, and hands this file back plain facts.
  hand: { size: 10, fromLadder: 'guess-who' },

  hero: {
    text:
      'Ten answers, every one of them given at this door tonight, none of them yours.\n\n' +
      'You will not work these out by thinking about them. You are going to have to go and ask ' +
      'people. Knowing that is the trick does not help.',
  },

  /**
   * A point per card named correctly, judged across every team once the night is over.
   *
   * EITHER ASTRONAUT COUNTS. Two people at a party of twenty-five write the same thing, and a card
   * saying "astronaut" is then genuinely undecidable -- not by asking harder, not by thinking
   * longer. So a guess is checked against the ANSWER rather than against the row we dealt: name
   * anyone who wrote it and you are right. Without this the tile punishes a team for doing exactly
   * what the tile exists to make them do, which is the one failure it cannot afford.
   *
   * `sourceId` is the UNIT, not the submission, which is what caps the tile at ten points with no
   * counting anywhere: `awards` is unique on (team, game, kind, source_id), so a card edited five
   * times upserts one row. See #25, where the same substitution capped the photo pair.
   *
   * A card whose guess has been cleared returns 0 points and NO verdict -- the award is zeroed so
   * a rescore cannot leave points behind for a guess that no longer exists, while the row stays
   * `pending` rather than being called wrong, because an empty box is not a wrong answer.
   */
  resolve(submissions, { cardOwner, answerOf, nameOf, sameAnswer }) {
    const outcomes = [];

    for (const submission of submissions) {
      if (submission.unit === null || submission.unit === undefined) continue;

      const named = submission.body;

      if (!named) {
        outcomes.push({
          teamId: submission.team_id,
          submissionId: submission.id,
          sourceId: submission.unit,
          points: 0,
          reason: 'no guess',
        });
        continue;
      }

      const owner = cardOwner(submission.team_id, submission.unit);
      const correct = sameAnswer(answerOf(named), answerOf(owner));

      outcomes.push({
        teamId: submission.team_id,
        submissionId: submission.id,
        sourceId: submission.unit,
        points: correct ? POINT : 0,
        verdict: correct ? 'correct' : 'incorrect',
        // The ledger is where the night gets read back afterwards, so it says what happened rather
        // than only what it cost.
        reason: correct
          ? `${nameOf(named) ?? 'someone'} — right`
          : `said ${nameOf(named) ?? 'someone'}, it was ${nameOf(owner) ?? 'someone else'}`,
      });
    }

    return outcomes;
  },
};
