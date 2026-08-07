// The numbers the host watches the night with. One module because two surfaces render them --
// the HQ page on load, and `/admin/live` every ten seconds after that -- and a percentage
// defined twice is a percentage that disagrees with itself the first time a tile is retuned.
//
// #94 asked for a bird's-eye view "just to gauge engagement", which is a weaker justification
// than #79's rule that a number must send you to a room rather than to a thought. That relaxation
// is deliberate and it is why everything here is QUIET: the unfound-code row stays the one loud
// thing on the page, and these sit under it in mono, at the size of a fact you glance at.

import { all, get } from './db.js';
import { listCodes, listGames } from './content.js';
import { standings } from './scoring.js';
import economy from '../content/economy.js';

/** How far back the pulse looks. Long on purpose -- see `pulse()`. */
export const PULSE_MINUTES = 30;

/**
 * A perfect night, in points. Derived rather than written as `100`, because the 100 is not a
 * constant -- it is `content/economy.js`'s tile budget times however many tiles the roster
 * happens to hold, and `src/content.js` refuses to boot when a game overspends its share. Adding
 * an eleventh tile therefore moves the ceiling to 110 and this follows it; a literal would have
 * quietly started reporting percentages over 100.
 */
export const perfectScore = () => listGames().length * economy.tilePoints;

/**
 * Progress, as one percent. The average team's score over a perfect one.
 *
 * This is the metric Dieter proposed in #94 after a tile-counting one had been half-designed, and
 * it is better than what it replaced for a reason worth keeping written down: **points already
 * are the partial-progress measure**. A team holding four of the photo scavenger's ten prompts
 * has four points. Counting *tiles* would have had to call that either "nought finished" or "one
 * touched", and both are lies about the same team -- the scoring already weighs it, so borrowing
 * the scoring costs nothing and argues with nobody.
 *
 * **It cannot reach 100 and is not meant to.** Teddy's ten points go to exactly one team all
 * night, and Longest yarn pays most teams only its floor of two -- so roughly fifteen of the
 * hundred are unreachable for most teams by construction. Dieter's own words on that: *"It's a
 * close-enough metric, I know we won't reach a 100."* Do not "fix" this by dividing by an
 * achievable ceiling; the achievable ceiling depends on how many teams turn up and would make the
 * number jump when someone onboards.
 *
 * Zero teams is 0 rather than NaN, which is the state the page sits in from the moment the
 * container boots until the first team walks through the door.
 */
export function progressPercent() {
  const board = standings();
  if (!board.length) return 0;

  const average = board.reduce((sum, team) => sum + team.score, 0) / board.length;
  return Math.round((average / perfectScore()) * 100);
}

/**
 * The three code numbers, which #94 asked for together after being told two of them are the same
 * fact from opposite ends. They are, arithmetically -- `unfound` and `found` sum to `total` -- and
 * keeping both was Dieter's call, made after the redundancy was put to him: *"No I think they all
 * say something."*
 *
 * He is right that they read differently at a glance, which is what a dashboard is for:
 *
 *   unfound   a to-do. Three cards are still behind a radiator, and you can go and move them.
 *   found     progress. Nineteen of twenty-two rooms have been walked into.
 *   scans     noise. A hundred and forty visits, most of them the same kitchen code eleven times.
 *
 * `found` is derived from the inventory rather than from `count(distinct slug)` so that the three
 * can never disagree: they are one subtraction apart by construction. Unknown slugs cannot muddy
 * `scans` either -- `/q/<unknown>` 404s before anything is recorded.
 */
export function codeCounts() {
  const codes = listCodes();
  const found = new Set(all('select distinct slug from scans').map((row) => row.slug));
  const unfound = codes.filter(([slug]) => !found.has(slug));

  return {
    total: codes.length,
    unfound: unfound.length,
    found: codes.length - unfound.length,
    scans: get('select count(*) as count from scans').count,
  };
}

/**
 * The pulse: everything that happened in the last half hour. Scans AND submissions, which is the
 * whole point of it.
 *
 * A scans-only pulse flatlines at exactly the hour it is most wanted. By 23:00 the teams still
 * going have found most of the codes already, so they stop scanning and start grinding -- another
 * scavenger photo, another bingo square, another guess. Counting only scans would have reported
 * *"nobody is playing"* at the precise moment the answer was *"everybody has already found
 * everything"*, which is the crying-wolf failure #79 cut the lost-team section for.
 *
 * **Thirty minutes, and it is long on purpose.** A five-minute window swings to zero every time
 * the room pauses for a conversation, which trains the host to ignore it by midnight. The scans
 * and the progress percent are the numbers that should feel live; this one is a stall detector
 * and it earns its keep by being slow.
 *
 * Submissions key on `updated_at`, not `created_at`: an answer edited at 23:40 is a team playing.
 */
export function pulse() {
  const since = `-${PULSE_MINUTES} minutes`;

  const scans = get(
    "select count(*) as count from scans where scanned_at >= datetime('now', ?)",
    since,
  ).count;

  const submissions = get(
    "select count(*) as count from submissions where updated_at >= datetime('now', ?)",
    since,
  ).count;

  return scans + submissions;
}
