// Clearing the rehearsal out of the database, so the party starts on an empty board. Settled in
// #63.
//
// It is pressed once, deliberately, shortly before guests arrive -- from the admin surface, on a
// phone, by someone with a drink in hand. That last detail is the whole design brief: this is not
// a dev tool that happens to be reachable on the night, it is a live control sitting a tap away
// from `end game` at 23:00, and it has to be safe there.
//
// TWO decisions make it safe, and neither of them is a warning label.
//
// 1. **Nothing is deleted.** The database is snapshotted and the uploads directory is MOVED, both
//    into `data/resets/<timestamp>/`, before a single row is emptied. The worst a mis-press can do
//    is file the night away, and the restore is the one already written down in `MM-HANDOFF.md`.
//
// 2. **The page says what it is about to clear**, in the units the host cares about -- teams,
//    submissions, photographs, points, and how long ago somebody was last playing. At 19:45 that
//    reads `1 team, last active four hours ago` and is obviously the rehearsal. At 23:00 it reads
//    like the party, and that is the sentence that stops the thumb. The page states it; it does
//    not refuse. Refusing would be wrong at 19:45, when the host has been testing all afternoon
//    and the last activity is his own, two minutes old.
//
// WHAT `clear` COVERS follows from one line at the top of `db/migrations/001-init.sql`: the
// database holds PLAYER DATA ONLY. Games, codes, questions, hints and pages live in `content/`, on
// disk, in git -- see docs/adr/game-content-lives-on-disk.md. So a reset is not a careful
// selection of tables to empty, it is EVERY table there is, and the list is read out of the
// database rather than typed here. That is not tidiness: migration 006 added `deals` long after
// the first six tables landed, and a hand-written list would have silently stopped clearing
// everything that day, with the party as the place it was noticed. The database counts, rather
// than this file remembering.
//
// Photographs are player data that happen to live on disk rather than in a row, so they go with
// it. Leaving them would also make a documented promise false: `data/uploads` is the night's
// archive and `cp -r` is the export (#25), which is only true if it does not have the practice
// night in it.

import { existsSync, mkdirSync, renameSync } from 'node:fs';
import { join } from 'node:path';

import { DATA_DIR, UPLOADS_DIR } from './config.js';
import { all, db, get, run, transact } from './db.js';

const RESETS_DIR = join(DATA_DIR, 'resets');

/**
 * Every table in the file. There is no bookkeeping table to skip: migrations are tracked in
 * `PRAGMA user_version`, an integer on the file itself, so everything `sqlite_master` lists is
 * player data by construction. The `sqlite_%` filter is the standard guard for the internal
 * tables SQLite may create for itself, not for anything of ours.
 */
const playerTables = () =>
  all("select name from sqlite_master where type = 'table' and name not like 'sqlite_%'").map(
    (row) => row.name,
  );

/**
 * What a reset would clear, for the confirmation page to say out loud.
 *
 * `minutesIdle` is the one that does the work. It is computed in SQL rather than in JS because
 * `last_seen_at` is written by SQLite's own `datetime('now')`, which is UTC -- parsing that string
 * in a container whose clock is on Brussels time would report an hour of silence during the
 * loudest part of the party.
 */
export function whatWouldBeCleared() {
  const activity = get(`
    select max(last_seen_at) as at,
           cast((julianday('now') - julianday(max(last_seen_at))) * 1440 as integer) as idle
    from teams
  `);

  return {
    teams: get('select count(*) as n from teams').n,
    submissions: get('select count(*) as n from submissions').n,
    photos: get('select count(*) as n from submissions where photo_path is not null').n,
    awards: get('select count(*) as n from awards').n,
    points: get('select ifnull(sum(points), 0) as n from awards').n,
    lastSeenAt: activity.at,
    minutesIdle: activity.at === null ? null : Number(activity.idle),
  };
}

/**
 * File the night away and empty the board. Returns the name of the directory it was filed into,
 * so the page that called it can say where the old night went.
 *
 * The order is the failure direction, chosen rather than fallen into. The snapshot goes first, so
 * a disk that cannot take it stops the reset instead of leaving it half-done. The rows go next.
 * The photographs move LAST, because the two ways that ordering can fail are not equally bad: a
 * move that fails after the wipe leaves an empty board and some stray files, which is a reset that
 * did its job untidily, while moving first and failing to wipe would leave a party mid-flight with
 * every photograph 404. It fails towards done.
 */
export function resetGame() {
  const kept = freeDirectory(new Date().toISOString().replaceAll(':', '-').slice(0, 19));

  // `VACUUM INTO`, never a file copy: this database runs in WAL mode, so the most recent writes
  // are still in `bday.sqlite-wal` and a copy of the main file would look perfectly fine while
  // missing the last hour of the party. Same reasoning, same call as `scripts/backup.js`. The
  // path cannot be bound -- VACUUM INTO takes a literal -- and is built from DATA_DIR and a
  // timestamp, so nothing a guest can type reaches it.
  db.exec(`vacuum into '${join(RESETS_DIR, kept, 'bday.sqlite').replaceAll("'", "''")}'`);

  // Table names cannot be parameters either. These come from `sqlite_master`, which is to say
  // from the migrations in this repository, and never from a request.
  transact(() => {
    for (const table of playerTables()) run(`delete from "${table}"`);
  });

  if (existsSync(UPLOADS_DIR)) renameSync(UPLOADS_DIR, join(RESETS_DIR, kept, 'uploads'));
  mkdirSync(UPLOADS_DIR, { recursive: true });

  return kept;
}

/**
 * A directory nothing is in yet, named for the moment. The suffix loop is not paranoia about
 * clocks: the second tap of a double-tap is an ordinary thing on a phone, where the first press
 * takes a moment and nothing visibly happens until the redirect lands. Both presses arrive, in
 * the same second, and `VACUUM INTO` refuses to write over a file that already exists -- so
 * without this the second one throws on the most consequential button on the site, instead of
 * harmlessly re-clearing a board that is already empty.
 *
 * `mkdirSync` without `recursive` is the test: it throws `EEXIST` rather than succeeding quietly,
 * which is what makes claiming the name and creating it one step and not two.
 */
function freeDirectory(stamp) {
  mkdirSync(RESETS_DIR, { recursive: true });

  for (let attempt = 1; ; attempt += 1) {
    const name = attempt === 1 ? stamp : `${stamp}-${attempt}`;
    try {
      mkdirSync(join(RESETS_DIR, name));
      return name;
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
  }
}
