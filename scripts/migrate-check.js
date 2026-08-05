#!/usr/bin/env node
// Run the real migration runner over databases that already hold rows.
//
//   node scripts/migrate-check.js        exits 1 if any vintage fails to roll forward
//
// Run it before landing a migration. Every migration in db/migrations/ has otherwise only ever
// been verified against a FRESH database -- the one case that never breaks. The case that breaks
// is a migration applied to a database with a party's worth of data in it, and 004 is the shape
// that makes that concrete: it renames `awards`, recreates it with a new check constraint, copies
// every row across, drops the old table and rebuilds two indexes, all with foreign keys ON.
//
// So: build a throwaway database at each historical user_version, put realistic rows in it, roll
// it forward to HEAD through the same runner the server boots with, and check that the data came
// out the other side. $DATA_DIR is never opened -- this works in a temp directory and deletes it.
//
// It is not a test framework and should not become one. This repo keeps its checks as scripts
// somebody runs (scripts/qr-sheet.js --check is the other one); there is no test suite, no CI,
// and a check nobody runs is worse than none because it looks like enforcement.

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { connect, migrate, readMigrations } from '../src/schema.js';

const HEAD = readMigrations().at(-1).version;

// --- the seed -----------------------------------------------------------------------------------

// A party's worth of rows, in every table, written with only the columns that existed at the
// version being seeded. `since` is the first version at which a statement is legal: `trophy` is
// not an award kind until 004 rebuilds the check constraint, and `deals` is not a table until 006.
// Columns added later are all nullable, so the base inserts stay valid at every later version and
// the two updates fill them in for the vintages that have them.
const SEED = [
  [1, `insert into teams (id, token, name) values
         (1, 'tok-badger', 'TEAM BADGER'),
         (2, 'tok-heron',  'TEAM HERON')`],
  [1, `insert into members (id, team_id, name, position) values
         (1, 1, 'Dieter', 1), (2, 1, 'Sofie', 2),
         (3, 2, 'Bram',   1), (4, 2, 'Lore',  2)`],
  [1, `insert into profile_answers (team_id, member_id, question_id, value) values
         (1, null, 'pizza-topping', 'pineapple'),
         (1, 1,    'wanted-to-be',  'astronaut'),
         (1, 2,    'wanted-to-be',  'a vet'),
         (2, null, 'pizza-topping', 'anchovy')`],
  [1, `insert into scans (team_id, slug, accepted) values
         (1, 'k7f2qx', 1), (1, '6cd3rd', 1), (2, 'k7f2qx', 0)`],
  [1, `insert into unlocks (team_id, game_id) values
         (1, 'yarn'), (1, 'scavenger'), (2, 'yarn')`],
  [1, `insert into submissions (id, team_id, game_id, body, photo_path, verdict) values
         (1, 1, 'yarn',      '160', null, 'correct'),
         (2, 1, 'scavenger', null, '0001-scavenger-20260814T2134-a3f9.jpg', 'pending'),
         (3, 2, 'guess-who', 'astronaut', null, 'pending')`],
  [1, `insert into hint_reveals (team_id, game_id, step, hint_index) values
         (1, 'lights', 1, 0), (1, 'lights', 1, 1)`],
  [1, `insert into awards (id, team_id, game_id, kind, points, reason, source_id) values
         (1, 1, 'yarn',      'answer', 7,  'second longest', null),
         (2, 1, 'scavenger', 'tally',  1,  'a photo',        3),
         (3, 1, 'scavenger', 'tally',  1,  'a photo',        4),
         (4, 1, 'lights',    'hunt',   2,  'step 1',         1),
         (5, 1, 'lights',    'hunt',   3,  'step 2',         2),
         (6, 1, 'lights',    'hint',   -3, 'a hint',         null),
         (7, 2, null,        'manual', 2,  'because I said so', null)`],
  [1, `insert into settings (key, value) values ('game_ended_at', null)`],

  // Photos know what they are from 002, and which unit they claim from 005 -- a modern database
  // has these filled in, and a later table rebuild has to carry them.
  [2, `update submissions set photo_mime = 'image/jpeg',
         photo_thumb = '0001-scavenger-20260814T2134-a3f9.thumb.jpg' where id = 2`],
  [4, `insert into awards (id, team_id, game_id, kind, points, reason, source_id) values
         (8, 2, 'teddy', 'trophy', 10, 'holding him at the end', null)`],
  [5, `update submissions set unit = 3 where id = 2`],
  [6, `insert into deals (team_id, game_id, unit, ref) values
         (1, 'guess-who', 1, 3), (1, 'guess-who', 2, 4), (2, 'guess-who', 1, 1)`],
];

const seed = (db, version) => {
  for (const [since, sql] of SEED) if (since <= version) db.exec(sql);
};

// --- reading a database -------------------------------------------------------------------------

const userVersion = (db) => db.prepare('pragma user_version').get().user_version;

const tables = (db) =>
  db
    .prepare(
      `select name from sqlite_master
       where type = 'table' and name not like 'sqlite_%' order by name`,
    )
    .all()
    .map((row) => row.name);

/** Every table's rows, by name, with the columns it had at the moment of the snapshot. */
function contents(db) {
  const snapshot = new Map();
  for (const table of tables(db)) {
    const columns = db
      .prepare(`pragma table_info(${table})`)
      .all()
      .map((column) => column.name);
    const rows = db.prepare(`select ${columns.join(', ')} from ${table} order by rowid`).all();
    snapshot.set(table, { columns, rows });
  }
  return snapshot;
}

/** The same tables through an older snapshot's columns, so a later ADD COLUMN is not a diff. */
const reread = (db, before) =>
  new Map(
    [...before].map(([table, { columns }]) => [
      table,
      db.prepare(`select ${columns.join(', ')} from ${table} order by rowid`).all(),
    ]),
  );

/**
 * sqlite_master, normalised. A database rolled forward from an old version must end up the same
 * SHAPE as one built from 001 in a single run.
 *
 * Deliberately weak, and worth knowing why: both paths apply the same files, so this can only
 * fire when a migration behaves DIFFERENTLY because rows are present. It does not catch a
 * migration that is wrong the same way in both paths -- drop the `create index` from 004 and this
 * stays silent, because the reference database loses the index too. Catching that needs an
 * expected-schema fixture, which is the test suite this repo does not have.
 */
const shape = (db) =>
  db
    .prepare(
      `select type, name, tbl_name, sql from sqlite_master
       where name not like 'sqlite_%' order by type, name`,
    )
    .all()
    .map((row) => `${row.type} ${row.name}: ${row.sql}`)
    .join('\n');

// --- the check ----------------------------------------------------------------------------------

const workspace = mkdtempSync(join(tmpdir(), 'bday-migrate-check-'));
const problems = [];
const lines = [];

const fresh = (name) => connect(join(workspace, `${name}.sqlite`));
const complain = (label, message) => problems.push(`${label}: ${message}`);

/**
 * A throwing migration is the likeliest thing this script exists to catch -- 004's rebuild does
 * nothing at all on a fresh database and everything on a full one -- so it is a reported problem
 * and never a stack trace. Catching it per case also means one bad vintage does not hide the rest.
 */
function attempt(label, fn) {
  try {
    fn();
  } catch (error) {
    complain(label, `threw -- ${error.message}`);
  }
}

let referenceShape = null;

/** One vintage: build it, fill it, roll it forward, and check what came out. */
function checkVintage(from, db, label) {
  migrate(db, { upTo: from, log: () => {} });
  if (userVersion(db) !== from) {
    complain(label, `setup landed on v${userVersion(db)}, so this case never ran`);
    return;
  }

  seed(db, from);
  const before = contents(db);
  const seeded = [...before.values()].reduce((total, { rows }) => total + rows.length, 0);

  const applied = [];
  migrate(db, { log: (line) => applied.push(line) });

  if (userVersion(db) !== HEAD) complain(label, `landed on v${userVersion(db)}, wanted v${HEAD}`);
  if (applied.length !== HEAD - from) {
    complain(label, `applied ${applied.length} migrations, wanted ${HEAD - from}`);
  }

  // The data survived: same tables, same rows, same values, read through the old columns.
  const missing = [...before.keys()].filter((table) => !tables(db).includes(table));
  if (missing.length) complain(label, `table(s) gone after migrating: ${missing.join(', ')}`);

  const after = reread(db, before);
  for (const [table, { rows }] of before) {
    const now = after.get(table) ?? [];
    if (now.length !== rows.length) {
      complain(label, `${table} held ${rows.length} rows and now holds ${now.length}`);
    } else if (JSON.stringify(now) !== JSON.stringify(rows)) {
      complain(label, `${table} kept its row count but its values changed`);
    }
  }

  // A rebuild that renames a parent table out from under a child leaves orphans behind.
  const orphans = db.prepare('pragma foreign_key_check').all();
  if (orphans.length) complain(label, `${orphans.length} orphaned row(s) after migrating`);

  // Skipped when the reference never got built -- one failure there, reported once, beats the
  // same failure restated by every vintage.
  if (referenceShape !== null && shape(db) !== referenceShape) {
    complain(label, 'ends up with a different schema than a database built fresh at HEAD');
  }

  // Running it again must do nothing at all -- the server boots this on every restart.
  const again = [];
  migrate(db, { log: (line) => again.push(line) });
  if (again.length) complain(label, `re-running applied ${again.length} more migration(s)`);
  if (userVersion(db) !== HEAD) complain(label, `re-running moved user_version off v${HEAD}`);
  if (JSON.stringify([...reread(db, before)]) !== JSON.stringify([...after])) {
    complain(label, 're-running changed the data');
  }

  lines.push(
    `  v${from} → v${HEAD}: ${applied.length} migration(s), ` +
      `${seeded} seeded row(s) across ${before.size} table(s) carried through`,
  );
}

try {
  // The reference: 001..HEAD in one run, on an empty file. Everything else must reach this shape.
  //
  // The seed itself is checked here before it is trusted. A migration that adds a table nobody
  // seeds would otherwise be "verified" against no rows at all -- the very hole this script exists
  // to close, reopened one table at a time as the schema grows.
  const reference = fresh('reference');
  attempt('reference', () => {
    migrate(reference, { log: () => {} });
    referenceShape = shape(reference);
    seed(reference, HEAD);
    for (const [table, { rows }] of contents(reference)) {
      if (!rows.length) complain('seed', `nothing is inserted into ${table} -- add a row to SEED`);
    }
  });
  reference.close();

  // Every vintage a real database could be sitting at, 0 (a fresh file) through HEAD - 1.
  for (let from = 0; from < HEAD; from += 1) {
    const label = `from v${from}`;
    const db = fresh(`from-v${from}`);
    attempt(label, () => checkVintage(from, db, label));
    db.close();
  }
} finally {
  rmSync(workspace, { recursive: true, force: true });
}

process.stdout.write(`${lines.join('\n')}\n`);

if (problems.length) {
  process.stderr.write(`\n${problems.length} PROBLEM(S):\n`);
  for (const problem of problems) process.stderr.write(`  ${problem}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`\nEvery vintage v0..v${HEAD - 1} rolls forward to v${HEAD} intact.\n`);
}
