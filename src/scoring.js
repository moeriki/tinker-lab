// Points are a ledger. Every movement is an awards row; a score is a SUM.
// See docs/adr/0002-points-are-a-ledger.md.

import economy from '../content/economy.js';
import { all, get, run, transact, setting, setSetting } from './db.js';
import { getGame, listGames, hintsFor } from './content.js';
import { reachedStep } from './progress.js';

export const GAME_ENDED_AT = 'game_ended_at';

export const gameEndedAt = () => setting(GAME_ENDED_AT);
export const gameIsOver = () => Boolean(gameEndedAt());

/**
 * Upsert on (team, game, kind, source_id) -- which is what makes rescoring and re-running a
 * resolver safe to do repeatedly.
 */
export function award({ teamId, gameId = null, kind, points, reason = null, sourceId = null }) {
  return run(
    `insert into awards (team_id, game_id, kind, points, reason, source_id)
     values (?, ?, ?, ?, ?, ?)
     on conflict (team_id, ifnull(game_id, ''), kind, ifnull(source_id, 0))
     do update set points = excluded.points,
                   reason = excluded.reason,
                   updated_at = datetime('now')`,
    teamId,
    gameId,
    kind,
    points,
    reason,
    sourceId,
  );
}

export const teamScore = (teamId) =>
  get('select coalesce(sum(points), 0) as score from awards where team_id = ?', teamId).score;

export const gameScore = (teamId, gameId) =>
  get(
    'select coalesce(sum(points), 0) as score from awards where team_id = ? and game_id = ?',
    teamId,
    gameId,
  ).score;

/** Every team, best first. The showdown reads this; so does the dashboard's vague message. */
export const standings = () =>
  all(`
    select t.id, t.name, coalesce(sum(a.points), 0) as score
    from teams t
    left join awards a on a.team_id = t.id
    group by t.id
    order by score desc, t.created_at asc
  `);

/**
 * The score that currently holds the last podium place -- the bar to clear. With fewer teams than
 * places it is the last team's score, because with two teams both of them really are in the top
 * three.
 */
function podiumLine(board) {
  return board[economy.podiumSize - 1]?.score ?? board.at(-1)?.score ?? 0;
}

/**
 * The one comparative signal a team ever gets. Deliberately vague: no rank, no other team's
 * score, no distance to the podium -- the showdown is where the reveal happens, and the host has
 * the true board at /admin.
 *
 * Four bands, and only the second is a rank:
 *
 *   fresh    exactly zero -- nothing on the board, whatever the reason
 *   podium   scored something, and at or above the third-place score
 *   chasing  within `podiumGap` of that score
 *   rest     further back than that
 *
 * Band 3 is proximity, not a slice of the field, because rank alone lies about a near-tie: if
 * third has 60, a team on 59 is close whether they are fourth or eleventh.
 *
 * `fresh` is tested first, and it is the amendment ADR-0011 did not make. That ADR reasoned only
 * about 20:05, where the `score > 0` guard put the whole party in "chasing" -- exactly true, and
 * fine. The case it missed is 22:30: teams join all night by design (#7), so a team that has just
 * walked in sits on zero while third place is on forty-something. The gap exceeds `podiumGap`,
 * they fall into `rest`, and the harshest line on the site becomes the first sentence they ever
 * read. Zero is a distinct fact the board knows for free, so it gets its own line -- which also
 * frees `rest` to be genuinely rude, since everyone left in it has played and is behind.
 *
 * A negative score is deliberately NOT `fresh`. Hints are the only debit, so a team below zero
 * has spent something, and they fall through to `rest` where they belong.
 *
 * Ties take the better band. Ordering breaks them on `created_at`, which is arbitrary -- telling
 * a team they missed the podium on identical points because they arrived later is a worse error
 * than occasionally showing four teams "top 3".
 */
export function standingsMessage(teamId) {
  const board = standings();
  const me = board.find((row) => row.id === teamId);
  if (!me) return economy.standingsBands.fresh;

  if (me.score === 0) return economy.standingsBands.fresh;

  const line = podiumLine(board);

  if (me.score > 0 && me.score >= line) return economy.standingsBands.podium;
  if (line - me.score < economy.podiumGap) return economy.standingsBands.chasing;
  return economy.standingsBands.rest;
}

// --- hints ---------------------------------------------------------------------------------

export const revealedHints = (teamId, gameId, step = 0) =>
  all(
    'select * from hint_reveals where team_id = ? and game_id = ? and step = ? order by hint_index',
    teamId,
    gameId,
    step,
  );

const totalReveals = (teamId) =>
  get('select count(*) as count from hint_reveals where team_id = ?', teamId).count;

/**
 * Reveal the next hint. The first reveal per team, across all games, is free -- the modal
 * announces the price as a gift rather than a fine. Returns the hint text, or null when the
 * team has already seen them all.
 */
export function revealNextHint(teamId, game, step = 0) {
  const hints = hintsFor(game, step);
  const seen = revealedHints(teamId, game.id, step);
  if (seen.length >= hints.length) return null;

  const index = seen.length;
  const isFirstEver = economy.firstHintFree && totalReveals(teamId) === 0;
  const cost = isFirstEver ? 0 : economy.hintCost;

  return transact(() => {
    const { lastInsertRowid } = run(
      'insert into hint_reveals (team_id, game_id, step, hint_index) values (?, ?, ?, ?)',
      teamId,
      game.id,
      step,
      index,
    );

    if (cost > 0) {
      award({
        teamId,
        gameId: game.id,
        kind: 'hint',
        points: -cost,
        reason: `hint ${index + 1}${step ? ` of step ${step}` : ''}`,
        sourceId: Number(lastInsertRowid),
      });
    }

    return { text: hints[index], index, cost, isFirstEver };
  });
}

/** The rules page hides its "hints cost you N points" line until the team has revealed one. */
export const hasDiscoveredHintCost = (teamId) => totalReveals(teamId) > 0;

/**
 * What a reveal costs, for the two surfaces that have to say it out loud. Read through here
 * rather than importing `content/economy.js` again, so the number has exactly one owner and the
 * economy ticket can move it in one place.
 */
export const hintCost = () => economy.hintCost;

// --- submissions ---------------------------------------------------------------------------

export const submissionsFor = (teamId, gameId) =>
  all(
    'select * from submissions where team_id = ? and game_id = ? order by created_at',
    teamId,
    gameId,
  );

export const allSubmissionsFor = (gameId) =>
  all('select * from submissions where game_id = ? order by created_at', gameId);

// --- end game ------------------------------------------------------------------------------

/**
 * Stamp the end and run every resolver, in one transaction. Idempotent, because awards upsert --
 * which is what makes reopening and re-ending safe.
 */
export function endGame() {
  return transact(() => {
    setSetting(GAME_ENDED_AT, new Date().toISOString());
    runResolvers();
  });
}

export function reopenGame() {
  return transact(() => setSetting(GAME_ENDED_AT, null));
}

// --- hunts ---------------------------------------------------------------------------------

/**
 * Bank the points for every step this team has reached. Hunts pay per accepted scan rather than
 * all at the finish, because they are the two tiles a team can pay a hint for and still fail --
 * partial credit is what makes buying that hint a rational move instead of a gamble. A team
 * stranded on step 2 of three keeps what they walked for.
 *
 * One row per step, `source_id` being the step number, so this upserts and is safe to call on
 * every scan and again from /admin/rescore. It re-awards every reached step rather than only the
 * newest, which self-heals a step whose award was never written -- from a crash mid-scan, or
 * from step points being edited in content after the party started.
 */
export function awardHuntProgress(teamId, game) {
  if (game.kind !== 'hunt') return 0;

  const reached = reachedStep(teamId, game);

  for (let step = 1; step <= reached; step += 1) {
    award({
      teamId,
      gameId: game.id,
      kind: 'hunt',
      points: game.steps[step - 1]?.points ?? 0,
      reason: `step ${step}`,
      sourceId: step,
    });
  }

  return reached;
}

/** Re-run content scoring over existing player data. Manual awards are never touched. */
export function rescore() {
  return transact(() => {
    for (const team of all('select id from teams')) {
      for (const game of listGames()) {
        awardHuntProgress(team.id, game);
      }
    }
    if (gameIsOver()) runResolvers();
  });
}

/**
 * Games judged across every team at once -- "closest to the average height", "who shares your
 * favourite colour". A resolver is a pure function in content returning
 * [{ teamId, points, verdict, submissionId }].
 */
function runResolvers() {
  for (const game of listGames()) {
    if (typeof game.resolve !== 'function') continue;

    const outcomes = game.resolve(allSubmissionsFor(game.id), { getGame }) ?? [];

    for (const outcome of outcomes) {
      if (outcome.submissionId && outcome.verdict) {
        run(
          "update submissions set verdict = ?, updated_at = datetime('now') where id = ?",
          outcome.verdict,
          outcome.submissionId,
        );
      }
      award({
        teamId: outcome.teamId,
        gameId: game.id,
        kind: 'answer',
        points: outcome.points ?? 0,
        reason: outcome.reason ?? 'resolved at game end',
        sourceId: outcome.submissionId ?? null,
      });
    }
  }
}

export { reachedStep };
