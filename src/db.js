// SQLite via node:sqlite -- zero dependencies and, decisively, no native compilation.
// See docs/adr/sqlite-via-node-sqlite.md.

import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { DB_PATH, DATA_DIR, UPLOADS_DIR, MIGRATIONS_DIR } from './config.js';

mkdirSync(DATA_DIR, { recursive: true });
mkdirSync(UPLOADS_DIR, { recursive: true });

export const db = new DatabaseSync(DB_PATH);

db.exec(`
  pragma journal_mode = WAL;
  pragma foreign_keys = ON;
  pragma busy_timeout = 5000;
  pragma synchronous = NORMAL;
`);

/**
 * The ledger is a single integer, so `user_version = N` can only mean "files 1..N are applied".
 * That is true exactly while the migrations are numbered from 001, densely, one file per number --
 * so the runner checks that invariant on every boot, before it applies anything, and refuses when
 * it does not hold. Two sessions landing a migration on the same afternoon is the ordinary case
 * here, not the exotic one, and both halves of that collision used to be silent. See #39.
 */
function readMigrations() {
  const migrations = readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith('.sql'))
    .map((file) => {
      const [, digits] = /^(\d+)-/.exec(file) ?? [];
      if (!digits) {
        throw new Error(
          `migration ${file} has no NNN- prefix -- the number on the file IS its version`,
        );
      }
      return { version: Number(digits), file };
    })
    .sort((a, b) => a.version - b.version || a.file.localeCompare(b.file));

  migrations.forEach(({ version, file }, index) => {
    const previous = migrations[index - 1];
    if (previous?.version === version) {
      throw new Error(
        `migrations ${previous.file} and ${file} are both numbered ${version} -- two files ` +
          `cannot be one user_version; renumber the one that landed second`,
      );
    }
    if (version !== index + 1) {
      throw new Error(
        `migration ${file} is numbered ${version} but is file number ${index + 1} -- the ` +
          `numbering must run 001, 002, 003 with no gaps, or user_version stops meaning ` +
          `"everything before me has run"`,
      );
    }
  });

  return migrations;
}

/**
 * Numbered .sql files applied in order, tracked by PRAGMA user_version. Not a framework -- but
 * enough that a schema change at 21:30 with fourteen teams' data in the file is a new file
 * rather than a panic.
 *
 * A file's version is the number written on it, never its position in the sorted list: position
 * made a second `003` into version 4 silently, and every database that booted in between skipped
 * a migration forever.
 */
export function migrate() {
  const migrations = readMigrations();

  const [{ user_version: current }] = db.prepare('pragma user_version').all();

  for (const { version, file } of migrations) {
    if (version <= current) continue;

    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
    db.exec('begin');
    try {
      db.exec(sql);
      db.exec(`pragma user_version = ${version}`);
      db.exec('commit');
      console.log(`migrated → ${version} (${file})`);
    } catch (error) {
      db.exec('rollback');
      throw new Error(`migration ${file} failed: ${error.message}`, { cause: error });
    }
  }
}

/** Run `fn` inside a transaction, rolling back if it throws. */
export function transact(fn) {
  db.exec('begin');
  try {
    const result = fn();
    db.exec('commit');
    return result;
  } catch (error) {
    db.exec('rollback');
    throw error;
  }
}

export const all = (sql, ...params) => db.prepare(sql).all(...params);
export const get = (sql, ...params) => db.prepare(sql).get(...params);
export const run = (sql, ...params) => db.prepare(sql).run(...params);

export const setting = (key) => get('select value from settings where key = ?', key)?.value ?? null;

export const setSetting = (key, value) =>
  run(
    `insert into settings (key, value) values (?, ?)
     on conflict(key) do update set value = excluded.value`,
    key,
    value,
  );
