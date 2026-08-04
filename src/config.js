import { join } from 'node:path';

export const PORT = Number(process.env.PORT ?? 3040);

// Everything mutable lives here so the container can bind-mount one directory. See
// docs/adr/0004-sqlite-via-node-sqlite.md -- it must be the DIRECTORY, not the .sqlite file.
export const DATA_DIR = process.env.DATA_DIR ?? new URL('../data/', import.meta.url).pathname;
export const DB_PATH = join(DATA_DIR, 'bday.sqlite');
export const UPLOADS_DIR = join(DATA_DIR, 'uploads');

export const PUBLIC_DIR = new URL('../public/', import.meta.url).pathname;
export const CONTENT_DIR = new URL('../content/', import.meta.url).pathname;
export const MIGRATIONS_DIR = new URL('../db/migrations/', import.meta.url).pathname;

// Visited once at the start of the night: /admin/key/<ADMIN_SECRET>.
export const ADMIN_SECRET = process.env.ADMIN_SECRET ?? 'change-me';

// Home Assistant automations hang off this. The container holds no HA credentials -- MM wires
// the far end. Left empty, webhook firing is logged and skipped.
export const WEBHOOK_BASE_URL = process.env.WEBHOOK_BASE_URL ?? '';

export const TEAM_COOKIE = 'team';
export const ADMIN_COOKIE = 'admin';
export const PENDING_COOKIE = 'pending'; // the slug someone arrived on, held across onboarding
