# ADR-0004: SQLite via `node:sqlite`, with a hand-rolled migration runner

**Status:** accepted · **Date:** 2026-08-04 · **Ticket:** [Domain model and route inventory](https://github.com/moeriki/tinker-lab/issues/6)

## Context

The mission asks for minimal framework use and a Docker container with data persisted outside it.
Data must survive redeploys.

## Decision

**Driver: `node:sqlite` (`DatabaseSync`).** Zero dependencies, synchronous API, and — the
decisive property — **no native compilation**. Verified working on Node v26.6.0. The Docker image
pins `node:26-alpine`, matching development exactly.

Pragmas on boot: `journal_mode=WAL`, `foreign_keys=ON`, `busy_timeout=5000`,
`synchronous=NORMAL`.

**Migrations: numbered SQL files** in `db/migrations/NNN-*.sql`, applied in order and tracked by
`PRAGMA user_version`. About twenty lines of runner, no framework.

**Paths: everything mutable under `$DATA_DIR`** (default `./data`) — the database, its WAL
sidecars, and `uploads/`.

## Consequences

- The container needs no build toolchain and no prebuilt binaries.
- Deployment must bind-mount **the directory**, never the `.sqlite` file. Bind-mounting the file
  alone breaks WAL, and it breaks *silently*. This goes in `MM-HANDOFF.md` in bold.
- A schema change at 21:30 on the night, with fourteen teams' data already in the database, is a
  new migration file rather than a panic.

## Alternatives considered

**`better-sqlite3`.** Faster and more featureful, but on Alpine/musl it means prebuild roulette or
a compiler in the image. Not worth it for this data volume.

**No migrations — delete the file before go-live.** Right up until the moment it isn't, which is
the moment that matters.
