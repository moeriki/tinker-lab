# ADR-0009: The page you are on is the stage

**Status:** accepted · **Date:** 2026-08-04 · **Ticket:** [Animation choreography](https://github.com/moeriki/tinker-lab/issues/14)

## Context

The style kit ships exactly three animations — `anim-unlock`, `anim-correct`, `anim-page` — and
nothing said which moment in the real flow fires which.

Every state change on this site is a POST-and-redirect or a scan redirect, so the server has
exactly one channel for telling the arriving page what it just did: a query param on the
destination URL. That constraint is not negotiable; what was open is where the moment gets
delivered, and therefore what a team is looking at when it plays.

Three schemes were built and walked against the real routes on
[`prototype/animation-choreography`](https://github.com/moeriki/tinker-lab/tree/prototype/animation-choreography).

## Decision

**A moment is always delivered to the page that caused it.** A team is never routed somewhere
they did not ask to go in order to be shown something.

One query param carries it — `?just=<moment>` — with a closed vocabulary owned by `src/moments.js`:
`unlock`, `step`, `correct`, `incorrect`, `banked`, `pending`, `shot`.

| what happened | lands on | what moves |
| --- | --- | --- |
| scan unlocks a game | `/g/:id?just=unlock` | the hero plays `anim-unlock` |
| scan starts a hunt | `/g/:id?step=1&just=unlock` | the hero plays `anim-unlock` |
| scan advances a hunt | `/g/:id?step=n&just=step` | the hero alone plays `anim-page` |
| answer judged right | `/g/:id?just=correct` | the verdict line plays `anim-correct` |
| answer judged wrong, banked or pending | `/g/:id?just=<moment>` | an honest line, no animation |
| photo lands | `/g/:id?just=shot` | the newest photo plays `anim-correct` |
| any page arrival | — | `.app` plays `anim-page` |

Submitting therefore **keeps the team on the game page** rather than returning them to the
dashboard. Closing the game is their tap to make.

The param is spent on arrival: `public/js/app.js` strips it after first paint, so a refresh does
not replay the animation and a shared screenshot does not read `?just=correct`.

## Consequences

- Scanning a code costs no extra taps. The team wanted to play, and the game opens.
- The dashboard becomes a chooser rather than a stage. It animates on arrival like any page, but
  no tile moves in response to a scan or a submission.
- **The animation is never load-bearing.** `app.css` already flattens all motion under
  `prefers-reduced-motion`, so every one of these moments degrades to a still page. The verdict
  line, the hint list and the tile state all say the same thing in text.
- `anim-correct` fires only for `check()` games, which are the only ones that know a verdict at
  submit time. On a full roster most submissions are `pending` or `banked` and get a line instead
  — the alternative was celebrating submissions nobody has scored.
- Client JS grows by one small block, still inside the "animation and the hint modal only"
  constraint: it *ends* an animation's signal rather than starting an animation.
- Admin surfaces opt out via `layout({ still: true })`, because the board will poll and a page
  that re-animates every few seconds cannot be read.

## Alternatives considered

**The dashboard is the stage.** Route scans through `/` so the team watches the tile crack open,
then taps in. Rejected on three counts: it charges an extra tap on every single unlock; the tile
that moves may be off-screen once the roster fills the grid, so it needs scroll-into-view and
therefore *more* client JS, not less; and under `prefers-reduced-motion` the unlock becomes
completely invisible, since watching the tile change was the entire signal.

**Nothing moves.** No signals, no params, no client JS — page arrival only. Genuinely tempting,
and it remains the fallback every reduced-motion guest gets. Rejected because the unlock is the
single best moment in the game and it is free to mark, and because a photo landing with no
acknowledgement at all reads as a failed upload.
