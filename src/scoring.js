// Points are a ledger. Every movement is an awards row; a score is a SUM.
// See docs/adr/0002-points-are-a-ledger.md.

import economy from '../content/economy.js';
import { all, get, run, transact, setting, setSetting } from './db.js';
import { getGame, listGames, hintsFor } from './content.js';
import { huntIsComplete, reachedStep } from './progress.js';

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

export function standingsMessage(teamId) {
  const board = standings();
  const position = board.findIndex((row) => row.id === teamId);
  if (position < 0) return economy.standingsBands.at(-1).message;

  const fraction = (position + 1) / board.length;
  return (
    economy.standingsBands.find((band) => fraction <= band.topFraction) ??
    economy.standingsBands.at(-1)
  ).message;
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

/** Re-run content scoring over existing player data. Manual awards are never touched. */
export function rescore() {
  return transact(() => {
    for (const team of all('select id from teams')) {
      for (const game of listGames()) {
        if (game.kind === 'hunt' && huntIsComplete(team.id, game)) {
          award({ teamId: team.id, gameId: game.id, kind: 'hunt', points: game.points ?? 0 });
        }
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
