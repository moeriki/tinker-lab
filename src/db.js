// SQLite via node:sqlite -- zero dependencies and, decisively, no native compilation.
// See docs/adr/sqlite-via-node-sqlite.md.
//
// This module is THE connection: importing it opens $DATA_DIR/bday.sqlite. How a database is
// opened and migrated lives in src/schema.js, which holds no state and can be pointed at any
// file -- that is what scripts/migrate-check.js uses.

import { mkdirSync } from 'node:fs';

import { DB_PATH, DATA_DIR, UPLOADS_DIR } from './config.js';
import { connect, migrate as migrateDatabase } from './schema.js';

mkdirSync(DATA_DIR, { recursive: true });
mkdirSync(UPLOADS_DIR, { recursive: true });

export const db = connect(DB_PATH);

/** Bring the server's own database up to date. Called once at boot, before anything reads. */
export function migrate() {
  migrateDatabase(db);
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
