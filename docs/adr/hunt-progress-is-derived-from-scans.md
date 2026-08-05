# Hunt progress is derived from scans, and is strictly sequential

**Status:** accepted · **Date:** 2026-08-04 · **Ticket:** [Domain model and route inventory](https://github.com/moeriki/tinker-lab/issues/6)

## Context

A treasure hunt is one game with N ordered steps, each bound to a QR code hidden further along a
trail. Codes are not secret — a team will overhear where another team is going, or simply trip
over a later code by accident.

## Decision

A team's position in a hunt is **derived**, not stored: the longest **contiguous** run of steps,
starting at step 1, for which the team has an accepted scan. There is no progress column.

Progression is **strictly sequential**. Scanning step *k* when the team has not reached step
*k-1*:

- unlocks nothing and advances nothing,
- records the scan with `accepted = 0`,
- shows the "you're not supposed to be here" page, which does not name the game.

## Consequences

- A team can never be at step 4 without having stood in front of codes 1, 2 and 3.
- Overhearing a hiding place is useless on its own, which keeps the trail honest without any
  anti-cheat machinery.
- The out-of-order scan is still recorded, so the admin board shows who ran ahead of themselves —
  good material for the reveal.
- Because progress is a projection of `scans` through `content/codes.js`, re-mapping slugs before
  go-live recomputes progress correctly rather than stranding rows.

## Alternatives considered

**A `hunt_progress` column** updated on each scan. Fewer rows to read, but it is state that can
disagree with the event log, and it makes a slug re-map a data migration.

**Allow skipping.** Simpler, and it lets one lucky stumble skip an entire trail — which deletes
the game for that team.
