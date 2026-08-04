// Hunt position is derived, never stored: the longest contiguous run of steps a team has an
// accepted scan for. See docs/adr/0006-hunt-progress-is-derived-from-scans.md.

import { all, get, run } from './db.js';
import { slugsForGame } from './content.js';

const acceptedSlugs = (teamId) =>
  new Set(
    all('select slug from scans where team_id = ? and accepted = 1', teamId).map((row) => row.slug),
  );

/** Step number this team has reached in a hunt, 0 if they have not started it. */
export function reachedStep(teamId, game) {
  if (game.kind !== 'hunt') return 0;

  const scanned = acceptedSlugs(teamId);
  const slugByStep = new Map(slugsForGame(game.id).map(([slug, target]) => [target.step, slug]));

  let reached = 0;
  for (let step = 1; step <= game.steps.length; step += 1) {
    if (!scanned.has(slugByStep.get(step))) break;
    reached = step;
  }

  return reached;
}

/**
 * Is this scan legitimate? Re-scanning a step already passed is fine and idempotent; jumping
 * ahead is not. Everything else is accepted.
 */
export function scanIsInOrder(teamId, game, step) {
  if (game.kind !== 'hunt') return true;
  return step <= reachedStep(teamId, game) + 1;
}

export const huntIsComplete = (teamId, game) =>
  game.kind === 'hunt' && reachedStep(teamId, game) === game.steps.length;

export const isUnlocked = (teamId, gameId) =>
  Boolean(get('select 1 from unlocks where team_id = ? and game_id = ?', teamId, gameId));

export const unlock = (teamId, gameId) =>
  run(
    'insert into unlocks (team_id, game_id) values (?, ?) on conflict do nothing',
    teamId,
    gameId,
  );

export const recordScan = (teamId, slug, accepted) =>
  run('insert into scans (team_id, slug, accepted) values (?, ?, ?)', teamId, slug, accepted ? 1 : 0);

/**
 * How many times this team has scanned one slug. The motivational gag rotates on it, so the line
 * advances on a real scan and holds still on a refresh -- which is what lets someone show the
 * thing they just read to the person next to them without it changing under them.
 */
export const scanCountFor = (teamId, slug) =>
  get('select count(*) as n from scans where team_id = ? and slug = ?', teamId, slug)?.n ?? 0;

/**
 * Where this team came in the order of teams that found a slug: 1 for the first, 2 for the next,
 * and so on. Zero if they have never scanned it.
 *
 * It is a RANK, not a running total, and the difference is the whole point. `count(distinct
 * team_id)` grows all night, so a team that re-scanned at midnight would be told they were fifth
 * when they were second -- their own line would rewrite itself behind them. Anchoring on the id
 * of their own first scan freezes it forever.
 *
 * Keyed on `id` rather than `scanned_at` because `datetime('now')` resolves to the second and two
 * teams a heartbeat apart would tie; ids cannot.
 */
export const finderRankFor = (teamId, slug) =>
  get(
    `select count(distinct team_id) as n from scans
      where slug = ?
        and id <= (select min(id) from scans where slug = ? and team_id = ?)`,
    slug,
    slug,
    teamId,
  )?.n ?? 0;
