# ADR-0014: The first scan is not live

**Status:** accepted · **Date:** 2026-08-05 · **Ticket:** [Onboarding flow and questionnaire](https://github.com/moeriki/tinker-lab/issues/9)

## Context

Every code in the house lands on `/q/:slug`, and a guest arriving at the party has no cookie yet.
So the first scan of the night cannot be applied when it happens: the team it would belong to
does not exist. `/q/:slug` holds the slug in a cookie, sends them through onboarding, and applies
the code on the way out — which is what makes the code they scanned cost them nothing.

For nine of the ten tiles that delay is invisible. The scan unlocks a game, the game opens, and
whether that happened instantly or ninety seconds later changes nothing.

**The lights hunt is not one of those nine.** A hunt step's `webhook` fires an outbound call to
Home Assistant and a lamp somewhere in the house flashes — and that flash *is* the clue. It is
what tells the team which room to walk to next; the step's own hero text is deliberately vague
("Nothing happens?"). Firing it on the deferred replay means it goes off at the exact moment the
team is head-down in a questionnaire in the hallway, aimed at a room nobody is standing in. The
clue is spent, and the site cannot tell — Home Assistant returns `200 OK` for everything by
design ([ADR-0007](0007-one-home-assistant-webhook.md)), so there is nothing to detect and
nothing to retry against.

Nine of ten teams would have hit this in the first five minutes of the party.

## Decision

**A deferred scan keeps its state and drops its physical effect.**

`applyCode({ deferred })` in `src/app.js` is one function used by both paths — a live scan and the
post-onboarding replay — and `deferred` changes exactly one thing: the webhook does not fire.
Everything else is identical. The scan row is written, the unlock is granted, the hunt is properly
at step 1.

The team then lands on the game page carrying a tenth moment, `rescan`, which asks for the one
thing that puts it right:

> You're in — and this one is yours now. Go back and scan that code again: this time, something
> happens.

Their rescan is an ordinary live scan. The webhook fires with them standing in front of it, which
is the retry loop the hunt was already built around: **webhooks re-fire on every scan**, and
making the lights blink again has always meant physically walking back to the code
([ADR-0006](0006-hunt-progress-is-derived-from-scans.md)).

The prompt is **derived, not declared**. The discriminator is whether the step declares a
`webhook` at all, so nothing in `content/` needs a new field and the rule cannot drift out of sync
with the content it describes.

## Consequences

- The riddle hunt correctly needs no prompt and gets none. Its clue is the on-screen riddle, which
  survives a delay perfectly — it declares no webhook, so it takes the ordinary `unlock` moment.
- Non-hunt games are untouched: a deferred scan of a game tile is an ordinary `unlock`.
- No lamp ever flashes for an empty room, and MM's automation is never asked to snapshot and
  restore a room for an audience of nobody.
- One more moment in the closed vocabulary (`src/moments.js`), and the first one that carries an
  **instruction** rather than a verdict — hence `ARRIVED` alongside `SUBMITTED`.
- It costs the team one extra scan, once, on the first hunt code they ever find. They are standing
  next to it.
- The replay no longer round-trips through `/q/:slug`. `afterOnboarding()` calls `applyCode()`
  directly, so "this scan is stale" is a fact the code passes along rather than something a second
  HTTP request would have to reconstruct or a query param would have to carry — and a query param
  would have been guessable, letting a team suppress their own webhook.

## Alternatives considered

**Fire it anyway, and warn.** Apply the deferred scan exactly like a live one, webhook included,
and show the rescan line regardless in case they missed it. Fewer branches. Rejected because it
guarantees a wasted flash for every single team at the moment they finish onboarding, and because
a team that *did* happen to catch it gets told to go and do it again.

**Apply nothing; let the rescan do everything.** Drop the deferred scan entirely — no scan row, no
unlock — and let the team's second scan be their first. Purest model of "a scan is a live event".
Rejected because they finish onboarding on a board where the code they scanned bought them
nothing, which reads as the site having eaten their first action rather than as an instruction.

**Suppress by query param.** Redirect to `/q/:slug?deferred=1` and let the scan handler read it.
Rejected: it is a guessable switch for turning off your own webhook, and it makes a URL that gets
shared and screenshotted carry an internal flag.
