// A **harvest**: the honest answers a question collected at the door, counted hours later by a game
// that asks teams to predict them. Added for Herd Mentality (#23).
//
// The contrast with `deals.js` is the whole reason this is a separate file. A hand is units that
// DIFFER per team, so which cards you hold is player data. A harvest is identical for everybody and
// already lives in content -- the questions are in `content/questions.js`; what lives in the
// database is only what people answered.
//
// ADR-game-content-lives-on-disk is intact. Content declares `harvest: [questionId, ...]` and
// receives, per unit, a predicate and a sentence; it never learns that `profile_answers` exists,
// and it never gets to decide how loosely two words count as the same word -- that is
// `src/matching.js`, and one opinion about it is enough.

import { harvestIds } from './content.js';
import { all } from './db.js';
import { onboardingComplete } from './identity.js';
import { cluster, fuzzyEquals } from './matching.js';

/**
 * Every team's answer to one team-scoped question, raw and unnormalised.
 *
 * Answers from teams that never made it through the gate are dropped, for the reason `poolFor` in
 * deals.js drops the same teams: onboarding saves what it has before bouncing a team back for the
 * blanks, so a team that walked away mid-questionnaire has rows in this table for a team that never
 * played. Counting them would let somebody who never got past the hallway shift what the herd said.
 */
export function harvestAnswers(questionId) {
  const rows = all(
    `select team_id, value from profile_answers
      where member_id is null and question_id = ? and trim(value) <> ''`,
    questionId,
  );

  const gate = new Map();
  return rows
    .filter((row) => {
      if (!gate.has(row.team_id)) gate.set(row.team_id, onboardingComplete(row.team_id));
      return gate.get(row.team_id);
    })
    .map((row) => row.value);
}

/**
 * What the room said, per unit, ready for a resolver.
 *
 * EVERY ANSWER TIED FOR MOST-GIVEN IS THE HERD (#23). With ~12 teams and questions written to have
 * four to six plausible answers, a shared top is an ordinary outcome, and there is no sense in which
 * one of two equally-common answers is more what most teams said than the other.
 *
 * There is deliberately NO MINIMUM COUNT: an answer given once still tops a pile nothing else beat.
 * A question so loose that nothing clusters is a bad question, and it gets fixed in
 * `content/questions.js` rather than papered over with a threshold here.
 *
 * `said` is spelled the way most teams actually spelled it -- `cluster()` keeps the commonest
 * spelling rather than a normalised stub -- because this string is read back to humans.
 */
export function herdByUnit(game) {
  return harvestIds(game).map((questionId) => {
    const clusters = cluster(harvestAnswers(questionId));
    const top = clusters[0]?.count ?? 0;
    const winners = clusters.filter((entry) => entry.count === top);

    return {
      said: winners.map((entry) => entry.answer).join(' / ') || 'nothing',
      count: top,
      // Matched against the cluster's seed with the same fuzzy rule that built the cluster, so a
      // prediction of "socks" lands on the pile eleven people spelled "sock".
      agrees: (prediction) =>
        winners.length > 0 && winners.some((entry) => fuzzyEquals(prediction, entry.seed)),
    };
  });
}
