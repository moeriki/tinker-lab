import { join } from 'node:path';

export const PORT = Number(process.env.PORT ?? 3040);

// The dev build: a test team already logged in, every tile open, and a way back out to walk real
// onboarding. See src/dev.js and #62.
//
// It turns on for the EXPLICIT value and nothing else. An unset NODE_ENV is production here --
// not because unset is meaningful, but because the failure directions are not symmetric: a
// laptop that forgets the flag shows locked tiles and you notice in one screen, while a deployed
// container that loses its env file would hand every guest every game with no way to tell. The
// Dockerfile bakes `production` in and docker-compose can override it at build time.
export const IS_DEV = process.env.NODE_ENV === 'development';

// Everything mutable lives here so the container can bind-mount one directory. See
// docs/adr/sqlite-via-node-sqlite.md -- it must be the DIRECTORY, not the .sqlite file.
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
// it inside a single automation. See docs/adr/one-home-assistant-webhook.md.
//
// Unset is valid and means "skip the call": every hunt still works, the lights just stay put.
export const HA_WEBHOOK_URL = process.env.HA_WEBHOOK_URL ?? '';

// The commit this build was made from, baked in as a Dockerfile ARG because `.dockerignore` drops
// `.git/` and there is nothing to read at runtime. Reported by /healthz so that "is my fix live?"
// is one curl and not a guess -- the deployed container has no other way to say how far behind
// `main` it is. Outside Docker there is no build, so `dev` is the truthful answer rather than a
// sha this process cannot verify it is actually running.
export const BUILD_COMMIT = process.env.BUILD_COMMIT || 'dev';

export const TEAM_COOKIE = 'team';
export const ADMIN_COOKIE = 'admin';
export const PENDING_COOKIE = 'pending'; // the slug someone arrived on, held across onboarding
export const DEV_OUT_COOKIE = 'devout'; // dev only: "leave me logged out, I am testing the door"
