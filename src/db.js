// SQLite via node:sqlite -- zero dependencies and, decisively, no native compilation.
// See docs/adr/0004-sqlite-via-node-sqlite.md.

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
 * Numbered .sql files applied in order, tracked by PRAGMA user_version. Not a framework -- but
 * enough that a schema change at 21:30 with fourteen teams' data in the file is a new file
 * rather than a panic.
 */
export function migrate() {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith('.sql'))
    .sort();

  const [{ user_version: current }] = db.prepare('pragma user_version').all();

  for (const [index, file] of files.entries()) {
    const version = index + 1;
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
