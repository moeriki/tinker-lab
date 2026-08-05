// The signature card: what a square holds, what refuses one, and what the card is worth.
//
// Sign Here (#21) is the only tile whose payout is a function of the WHOLE card rather than of its
// units one at a time -- three in a row pays the tile, and pays it instead of the squares that
// made it, not on top of them. So the arithmetic cannot live in an award-per-unit the way the
// photo pair's does, and it lives here.
//
// Everything about a signature is derived from the submissions table and nothing is stored twice.
// A signed square is a submission row with a verdict; the lock is the timestamp of the most recent
// refusal plus half an hour. That is the same move `reachedStep` makes for hunts -- state that is
// a reading of what already happened cannot drift out of step with it, and a lock that is derived
// expires by arithmetic rather than by anyone remembering to clear it.

import { all, get } from './db.js';
import { gridSize, lockMinutes } from './content.js';
import { fuzzyEquals } from './matching.js';

/**
 * Every line on a square card: rows, then columns, then the two diagonals. On a 3x3 that is 8.
 *
 * Built rather than written down because `grid` is content's to set, and a 4x4 card would have 10
 * lines that nobody would remember to add here.
 */
export function linesOf(size) {
  const lines = [];

  for (let row = 0; row < size; row += 1) {
    lines.push(Array.from({ length: size }, (_, col) => row * size + col));
  }
  for (let col = 0; col < size; col += 1) {
    lines.push(Array.from({ length: size }, (_, row) => row * size + col));
  }
  lines.push(Array.from({ length: size }, (_, i) => i * size + i));
  lines.push(Array.from({ length: size }, (_, i) => i * size + (size - 1 - i)));

  return lines;
}

/** The units making up every completed line, or an empty set. Used to score AND to light the card. */
export function lineUnits(game, signed) {
  const winning = new Set();

  for (const line of linesOf(gridSize(game))) {
    if (line.every((unit) => signed.has(unit))) {
      for (const unit of line) winning.add(unit);
    }
  }

  return winning;
}

/** Which squares this team has signed, and with whose handle. Unit -> handle. */
export function signaturesFor(teamId, gameId) {
  const rows = all(
    `select unit, body from submissions
      where team_id = ? and game_id = ? and unit is not null and verdict = 'correct'
      order by unit`,
    teamId,
    gameId,
  );

  return new Map(rows.map((row) => [row.unit, row.body]));
}

/**
 * What the card is worth right now.
 *
 * A line pays `game.bingo` and nothing else pays at all; short of one, a signed square is worth
 * `game.points`. Non-cumulative is the whole rule, and writing it as a branch rather than as a sum
 * is what makes it impossible to exceed the tile budget by accident.
 */
export function cardScore(game, signed) {
  if (lineUnits(game, signed).size) return game.bingo ?? 0;
  return signed.size * (game.points ?? 0);
}

/**
 * When this team's card reopens, or null if it is open now.
 *
 * Derived from the last refusal rather than stored, so it needs no column, no migration and no
 * sweeper: half an hour after the row was written the arithmetic simply stops being true.
 *
 * `datetime('now')` is UTC and so is every timestamp this database writes, so the comparison is
 * done in SQL rather than in JavaScript, where a `new Date(...)` on a space-separated SQLite
 * timestamp is parsed by one engine and refused by another.
 */
export function lockedUntil(teamId, game) {
  const row = get(
    `select created_at,
            datetime(created_at, ?) as until,
            datetime(created_at, ?) > datetime('now') as active
       from submissions
      where team_id = ? and game_id = ? and verdict = 'incorrect'
      order by created_at desc, id desc
      limit 1`,
    `+${lockMinutes(game)} minutes`,
    `+${lockMinutes(game)} minutes`,
    teamId,
    game.id,
  );

  return row?.active ? row.until : null;
}

/** Whole minutes left on a lock, rounded up, so a page never says "0 minutes left". */
export function minutesLeft(until) {
  const row = get(
    "select (julianday(?) - julianday('now')) * 1440 as minutes",
    until,
  );
  return Math.max(1, Math.ceil(row?.minutes ?? 0));
}

/**
 * Whose handle this is, or null. Fuzzy, because the whole point is that somebody said it out loud
 * across a loud kitchen and somebody else typed it -- see src/matching.js, and content/team-names.js
 * for the boot rule that keeps two live handles from ever being within that budget of each other.
 */
export function teamByHandle(handle) {
  const wanted = String(handle ?? '').trim();
  if (!wanted) return null;

  for (const team of all('select id, name from teams')) {
    if (fuzzyEquals(team.name, wanted)) return team;
  }
  return null;
}

/**
 * Why a signature cannot be accepted, or null if it can.
 *
 * THREE REFUSALS, AND ONLY ONE OF THEM IS A FORGERY. That distinction is the whole reason this is
 * a function rather than a boolean:
 *
 *   unknown   nobody holds that word. A guess, or a mishearing. This is the one that locks.
 *   yourself  your own handle. A misreading of the rules thirty seconds after opening the tile.
 *   spent     a handle already somewhere on this card. The allocation rule biting.
 *
 * The last two cost a forger nothing to avoid -- they already know their own handle, and they
 * already know which words are on their card -- so locking for them buys no protection at all and
 * only knifes people who misread the rules. They bounce with a sentence and no penalty. `spent`
 * even names the square, because the player got that handle from a human and is entitled to know
 * where it already is.
 */
export function refusalFor({ handle, team, signed }) {
  const owner = teamByHandle(handle);

  if (!owner) return { kind: 'unknown' };
  if (owner.id === team.id) return { kind: 'yourself' };

  for (const [unit, signature] of signed) {
    if (fuzzyEquals(signature, owner.name)) return { kind: 'spent', unit, name: owner.name };
  }

  return null;
}
