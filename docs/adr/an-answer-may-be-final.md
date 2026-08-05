# An answer may be final

**Status:** accepted · **Ticket:** [#26](https://github.com/moeriki/tinker-lab/issues/26)

## Context

An `answer` game holds one submission per team and upserts it, editable until game end. That was
settled by the domain model (#6) and it is right for every game that had one until now: yarn, and
the resolve games, are tiles you keep *improving* all night, and the points economy (#8) leaned on
exactly that when it refused a premium for committing early.

The Triangle Test is the first game on this site judged by `check()` — the first to know a verdict
at submit time at all. Under the editable rule that is not a taste test, it is a **three-tap brute
force**: pick jug 1, told wrong; pick jug 3, told wrong; pick jug 2, ten points. The row upserts,
`award()` upserts against the same `source_id`, and the last verdict is the only one that survives.
A team can hold the full tile without leaving the sofa, having tasted nothing.

The tile is worth 10 and the whole joke is that being right means nothing, because one in three
guessers gets there anyway. Retries delete both halves: the points stop being about tasting, and
nobody is ever told they were wrong, so the failure copy never fires for anybody.

Judging at game end instead — the shape Guess Who took for this same anti-brute-force reason — was
the real alternative and it loses here. The tile's whole moment is at the station: you taste, you
tap, it answers you. A grey `unknown` tile until 01:00 throws away the one place on the roster where
`anim-correct` has an honest trigger.

## Decision

**A game may declare `final: true`, and its first submission is its last.**

The form is gone from the page the moment a row exists, replaced by what the team answered and how
it went. A POST that arrives anyway — stale tab, back button — bounces with `spent` instead of
re-judging.

Restricted to `kind: 'answer'` at boot: a tally game's shape is many submissions, and a formless
kind has no form to close.

**A final game must declare its own `verdicts.incorrect`, enforced at boot.** The site-wide line in
`src/moments.js` reads *"Not that one. You can change your answer right up to the end"* — true of
every other answer game, and a lie here delivered at the exact moment it does the most damage. The
constraint is what makes the fix structural instead of a thing the next author has to remember.

## Consequences

A mis-tap is unrecoverable, which is why the dropdown opens on `— pick one —` and an empty choice
bounces rather than reaching `check()`. That bounce is load-bearing, not politeness: without it the
one shot is spent on an answer nobody meant to give.

`/admin/rescore` re-runs resolvers, not `check()`, so a final game's verdict is written once and
never revisited. **That is a decision, not an omission** (#57). The remedy for a mis-poured station
is physical: two of the three jugs hold the same cola, so moving the number tags makes the content
true again in ten seconds, and nothing is ever edited on the night. With content frozen, re-running
`check()` would evaluate a pure function over an unchanged submission body and write back the
verdict already sitting there — a no-op in every case that can actually occur. Teams scored before
the swap are put right one at a time with `/admin/award`.

Boot now also checks a `check()` game's `points` against the tile budget. The rule was that answer
and tally games spend their budget inside `check()`/`resolve()` where nothing can check the
arithmetic — true of `resolve()`, and never true of `check()`, which pays a flat game-level
`points` that is as declared as a trophy's.

Nothing else on the roster wants this. It exists for the one tile where being wrong has to cost
something, and the editable default stands everywhere else.
