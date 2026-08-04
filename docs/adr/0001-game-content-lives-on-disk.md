# ADR-0001: Game content lives on disk; the database holds only player data

**Status:** accepted · **Date:** 2026-08-04 · **Ticket:** [Domain model and route inventory](https://github.com/moeriki/tinker-lab/issues/6)

## Context

Games, hints, correct answers, point values, QR mappings and onboarding questions all need to be
authored and edited quickly in the run-up to the party — including on the day. Meanwhile teams,
submissions and scores are genuinely dynamic data that must survive a redeploy.

## Decision

Game content is **code in this repository** (`content/`). The database stores **only player
data**, and refers to content by bare string id: every player-data row carries `game_id TEXT`
with **no foreign key**, and there is no `games` table.

## Consequences

- Editing a game is a commit and a redeploy — no admin CMS, no seeding step, one source of truth.
- Renaming a game id **orphans its rows**. Ids are permanent once the party starts; renames only
  happen before go-live. Boot validates that every distinct `game_id` in the database still
  resolves to content and logs loudly if not.
- SQL cannot join to a game. The admin dashboard iterates the *content* list and left-joins
  player data, so a game with zero submissions still renders.
- Scans store only the **slug**, not the game or step it resolved to, so re-mapping a slug in
  `content/codes.js` before go-live rewrites history correctly instead of leaving stale rows.

## Alternatives considered

**A `games` table seeded from content on boot.** Buys real foreign keys and lets SQL do the
joining. Rejected: it introduces a sync step and a second place where "what games exist" is
answered, for a payoff (referential integrity) that a ten-team party does not need.
