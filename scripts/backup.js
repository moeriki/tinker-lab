// Take a consistent snapshot of the database while the party is running.
//
// `cp bday.sqlite somewhere` is NOT a backup here. The database runs in WAL mode, so recent
// writes live in bday.sqlite-wal and a plain copy of the main file silently loses them -- which
// is the worst possible failure, because the copy looks fine.
//
// VACUUM INTO takes a proper snapshot through the same connection, checkpointing as it goes. It
// needs no sqlite3 CLI, no dependencies, and it is safe to run with fourteen teams mid-answer.
//
//   node scripts/backup.js                      -> $DATA_DIR/backups/bday-<timestamp>.sqlite
//   node scripts/backup.js /somewhere/else.sqlite
//
// In the container:  docker compose exec bday node scripts/backup.js

import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { DB_PATH, DATA_DIR } from '../src/config.js';

const stamp = new Date().toISOString().replaceAll(':', '-').slice(0, 19);
const target = process.argv[2] ?? join(DATA_DIR, 'backups', `bday-${stamp}.sqlite`);

mkdirSync(dirname(target), { recursive: true });

const db = new DatabaseSync(DB_PATH, { readOnly: true });

try {
  // Bound as a parameter would be a syntax error -- VACUUM INTO takes a literal.
  db.exec(`vacuum into '${target.replaceAll("'", "''")}'`);
  console.log(`backup → ${target}`);
} catch (error) {
  console.error(`backup FAILED: ${error.message}`);
  process.exitCode = 1;
} finally {
  db.close();
}
