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
export const ADMIN_SECRET_IS_DEFAULT = !process.env.ADMIN_SECRET;

// ONE fully-qualified Home Assistant webhook URL, id included:
//   http://homeassistant:8123/api/webhook/<WEBHOOK_ID>
//
// It is deliberately not composed from parts. The webhook id is the only thing protecting that
// endpoint -- HA does not authenticate it -- and THIS REPOSITORY IS PUBLIC, so the id can never
// live in content/. Which effect to run is carried in the payload as `node`, and MM branches on
// it inside a single automation. See docs/adr/0007-one-home-assistant-webhook.md.
//
// Unset is valid and means "skip the call": every hunt still works, the lights just stay put.
export const HA_WEBHOOK_URL = process.env.HA_WEBHOOK_URL ?? '';

export const TEAM_COOKIE = 'team';
export const ADMIN_COOKIE = 'admin';
export const PENDING_COOKIE = 'pending'; // the slug someone arrived on, held across onboarding
