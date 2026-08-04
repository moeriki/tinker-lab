# ADR-0003: The QR entry point mutates on GET

**Status:** accepted · **Date:** 2026-08-04 · **Ticket:** [Domain model and route inventory](https://github.com/moeriki/tinker-lab/issues/6)

## Context

`GET /q/:slug` is what a phone camera opens. It unlocks tiles, advances hunts, fires Home
Assistant webhooks and records scans. That is a mutating GET, which HTTP says should be safe.

## Decision

Accept the violation. `/q/:slug` mutates on GET, and every effect is made **idempotent** instead
of safe — with one deliberate exception.

- Unlocking an already-unlocked game is a no-op.
- Re-scanning a hunt step already passed opens the game page at that step and advances nothing.
- Scanning out of order changes no state; it records a flagged scan and shows the "you're not
  supposed to be here" page.
- **Webhooks re-fire on every scan.** This is the exception, and it is the point: a treasure hunt
  step is supposed to take several tries to interpret, and re-triggering the automation means
  physically walking back to the code. Step navigation on the game page (`?step=n`) never fires a
  webhook — only `/q/:slug` does.

## Consequences

- Safe under refresh, the back button and link prefetch, except that a prefetch may blink the
  lights. At a party this is indistinguishable from the intended behaviour.
- No interstitial stands between a guest and a game.

## Alternatives considered

**An interstitial page with an "Open" button** so the mutation happens on POST. Correct by the
book, and a terrible thing to put in front of a guest holding a phone at a party.
