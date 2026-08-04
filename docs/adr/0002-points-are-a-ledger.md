# ADR-0002: Points are a ledger, not derived at render time

**Status:** accepted · **Date:** 2026-08-04 · **Ticket:** [Domain model and route inventory](https://github.com/moeriki/tinker-lab/issues/6)

## Context

Points arrive from five different directions: a judged answer, each submission in a tally game,
completing a hunt, revealing a hint (negative), and the host handing out points by hand. Scores
are read constantly — the dashboard on every load, the admin board on a poll.

## Decision

An `awards` table is the single record of every point movement:

```
awards(team_id, game_id, kind, points, reason, source_id, created_at, updated_at)
kind ∈ answer | tally | hunt | hint | manual
```

A team's score is `SUM(points)`; a tile's score is the same sum filtered by `game_id`.
Submissions carry a **verdict and no points column** — a submission is what the team did, an
award is what it was worth.

Awards are **unique on `(team_id, game_id, kind, source_id)`**, so re-running the content scoring
rules upserts in place. That is what makes `POST /admin/rescore` safe to press repeatedly, and
what lets a `resolve()` function run more than once after the game is reopened.

Manual awards (`kind = 'manual'`) are **exempt from rescoring** — the host's judgement is not
something a content rule may overwrite.

## Consequences

- Every score read is one indexed `SUM`. Cheap enough for a polling admin page.
- The host is omnipotent: adding or clawing back points is one insert, with no special case.
- Awards **snapshot** the point value in force when they were written. Changing a game from 10
  to 20 points at 22:00 does not retroactively move teams already scored — `/admin/rescore` does
  that, deliberately and visibly.

## Alternatives considered

**Derive scores at render time** from `submissions` + `scans` + `hint_reveals` by running content
scoring rules on every page load. Content stays the sole source of truth for value, and a point
change retro-updates everyone for free.

Rejected because it collapses back into a ledger anyway: the host's one-off "have 5 points for
making me laugh" needs its own table, and "this photo was worth 3, not 1" needs a per-submission
override column — a ledger in a trenchcoat, plus a second scoring path to keep in sync.
