// HERD MENTALITY -- one of the roster's three cross-team talkers (#7). Decisions in #23.
//
// Every team answered five one-word questions HONESTLY on the way in (`content/questions.js`).
// This tile, opened hours later, asks them a different question about the same five: not what you
// think, but what MOST TEAMS said.
//
// That is the Family Fortunes house-survey shape, which normally needs two tiles hours apart to
// collect the survey and then play it back. Onboarding supplies the gap for free, because teams
// arrive all night -- the harvest is still filling up while the earliest teams are already
// predicting against it.
//
// THE TILE IS BLIND. It shows the five questions and five empty boxes: no running tally, no sample,
// not even this team's own answers read back to them. A prediction you can look up is not a
// prediction, and anything shown here would hand a team arriving at 23:00 a strictly better board
// than one that arrived at 20:00 -- growing the late-play advantage #7 accepted rather than
// containing it. Blind, everybody guesses the same room from having stood in it.
//
// TWO POINTS A QUESTION, FIVE QUESTIONS, NO COMPLETION BONUS -- ADR-the-tile-is-the-unit-of-value
// names this tile as the clean case where the units divide the ten exactly.
//
// NO HINTS, for the reason Longest yarn and Guess Who have none, and here it is not even close: a
// hint costs 3 points and a question is worth 2, so the best hint imaginable -- one that simply
// told you the answer -- would still lose a point. That is arithmetic, not taste.

/** Two points a question, five questions, a flat ten-point tile. Boot checks the arithmetic. */
const POINT = 2;

export default {
  id: 'herd',
  kind: 'tally',
  title: 'Herd Mentality',

  points: POINT,

  // The units are the five questions asked at the door, named by id so the wording has exactly one
  // home -- `content/questions.js`. Boot refuses an id no question declares, and refuses one that
  // is not team-scoped, because a prediction is a thing a TEAM makes once.
  //
  // ORDER IS THE UNIT INDEX, and `submissions.unit` and the award's `source_id` both key on it, so
  // reordering this list after the party has started re-labels predictions already made. Adding to
  // the end is safe; swapping two rows is not. It would also blow the tile budget, which is the
  // boot error you would actually see first.
  harvest: ['herd-pizza', 'herd-fridge', 'herd-leave', 'herd-animal', 'herd-fire'],

  hero: {
    text:
      'You answered five of these at the door, honestly, and nobody is going to ask you to do ' +
      'that again.\n\n' +
      'This time write down what you think MOST teams said. Being right is worth two points. ' +
      'Being interesting is worth nothing.',
  },

  /**
   * Judged across every team once the night is over, because "what most teams said" is not knowable
   * until the last team is in -- and the last team walks in whenever it likes (#7).
   *
   * EVERY ANSWER TIED FOR MOST-GIVEN PAYS IN FULL. With ~12 teams and questions built to have four
   * to six plausible answers, a shared top is an ordinary outcome and not a degenerate one; there
   * is no sense in which one of two equally-common answers is more the herd than the other, so
   * breaking the tie would mean inventing a winner and telling a team that read the room correctly
   * that they were wrong. It is also the rule Longest yarn already uses on identical claims.
   *
   * THERE IS NO MINIMUM. An answer given by one team is still the top of the pile if nothing beat
   * it, and that is a deliberate refusal to write code for a bad question -- if a question scatters
   * so far that nothing clusters, the fix is a better question in `content/questions.js`, which is
   * why the one that used to sit in the fifth slot is not there any more.
   *
   * A team's OWN harvest answer stays in the corpus they are scored against. Thinking like the herd
   * and being the herd are the same thing, and taking their word back out would mean there was no
   * longer one herd answer per question for the showdown to read out.
   *
   * `sourceId` is the UNIT, not the submission, which is what caps the tile at ten with no counting
   * anywhere: `awards` is unique on (team, game, kind, source_id), so a prediction edited five times
   * upserts one row. See #25, where the same substitution capped the photo pair.
   */
  resolve(submissions, { herdFor }) {
    const outcomes = [];

    for (const submission of submissions) {
      if (submission.unit === null || submission.unit === undefined) continue;

      // What the room said for this question, already clustered. Content is handed a predicate and
      // a string rather than the raw answers, the same way Guess Who is handed `sameAnswer`: how
      // loosely two words count as the same word is the engine's policy (src/matching.js), and a
      // game that re-implemented it would be a second opinion nobody asked for.
      const question = herdFor(submission.unit);
      const predicted = submission.body;

      // An empty box is not a wrong answer. The award is zeroed rather than skipped, so a rescore
      // cannot leave points behind for a prediction that has since been cleared, and the row stays
      // `pending` rather than being called incorrect.
      if (!question || !predicted) {
        outcomes.push({
          teamId: submission.team_id,
          submissionId: submission.id,
          sourceId: submission.unit,
          points: 0,
          reason: 'no prediction',
        });
        continue;
      }

      const correct = question.agrees(predicted);

      outcomes.push({
        teamId: submission.team_id,
        submissionId: submission.id,
        sourceId: submission.unit,
        points: correct ? POINT : 0,
        verdict: correct ? 'correct' : 'incorrect',
        // The ledger is where the night gets read back afterwards, so it says what happened rather
        // than only what it cost.
        reason: correct
          ? `${predicted} — the herd agreed`
          : `said ${predicted}, the herd said ${question.said}`,
      });
    }

    return outcomes;
  },
};
