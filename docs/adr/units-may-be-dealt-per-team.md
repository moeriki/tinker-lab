# Units may be dealt per team

**Status:** accepted · **Ticket:** [#22](https://github.com/moeriki/tinker-lab/issues/22)

## Context

Guess Who shows a team answers other guests gave at the door and asks who wrote each. The obvious
shape is the whole corpus: every answer in the house, each needing a person. With ~25 guests that
is ~23 attributions once your own two are out.

Two things break at 23.

**The arithmetic.** A tile is worth exactly 10 points and the atom is 1
([ADR-the-tile-is-the-unit-of-value](the-tile-is-the-unit-of-value.md)). Ten does not divide 23
without fractions or bands, and the rule that ADR set is that the board has to be arithmetic a
guest can do in their head.

**The form.** Twenty-three dropdowns on a phone, growing all night as teams keep arriving (#7),
under a team that knows six of them.

Ten cards fixes both — one point each, exactly the budget, no completion bonus and no remainder —
but ten cards *drawn from other guests* is the first thing on this site whose units are a fact
about a **team** rather than about a game. Every unit until now has been content: the scavenger's
ten prompts are ten strings on disk, identical for everybody.

## Decision

**A game may declare a `hand` instead of `units`, and the engine deals it per team, storing what
it dealt.**

```js
hand: { size: 10, fromLadder: 'guess-who' }
```

`db/migrations/006-deals.sql` adds one table. `src/deals.js` owns dealing and hands the game back
plain facts — `{ unit, memberId, name, prompt, answer }`.

Three properties, each load-bearing:

**The seam holds.** `game_id` is a bare string with no foreign key, and `ref` is an **opaque
integer** whose meaning belongs entirely to the game that dealt it — Guess Who reads it as a member
id, and nothing in the schema says so or joins on it. Content still never opens the database
([ADR-game-content-lives-on-disk](game-content-lives-on-disk.md)); a resolver that needs to judge a
guess is handed `cardOwner`, `answerOf`, `nameOf` and `sameAnswer` as functions over facts already
read.

**The hand tops up, and never displaces.** It fills to `size` on every open, so the first team
through the door is not capped for the night at however few guests had onboarded when they opened
the tile. A dealt card is never re-dealt (unique on `(team, game, ref)`) and top-ups only append
units, so a guess made at 21:00 cannot be taken away by somebody arriving at 23:00.

**The ledger keys on the unit, not the submission.** `awards` is unique on
`(team, game, kind, source_id)`, so writing the unit into `source_id` caps the tile at ten points
with no counting anywhere — the same substitution that capped the photo pair (#25).

## Alternatives

**The whole corpus, capped at ten points.** No dealing, no table, no top-up — the cap caps points
and the form never closes, which is exactly the shape the photo tiles already use. Rejected for
the form: by midnight it is ~23 dropdowns on one page and it grows under you all night. It is the
better *mechanism* and the worse *page*, and this tile is played standing up in a kitchen.

**Deriving the hand instead of storing it** — order the pool by `hash(team, member)` and take the
first ten. Free, no migration. Rejected because a member arriving later can hash into the top ten
and **displace an unanswered card**, so a card you were about to name silently disappears. The
patch for that is "keep everything you have already guessed, fill the rest from hash order", which
is derivable but produces visible churn during the arrival hour for no gain over one small table.

**Dealing from the pool once and freezing it.** Simplest of all, and it caps the first team at
however many answers existed when they looked. Rejected outright: a team that arrives on time
being permanently worse off is the wrong way round.

## Consequences

- One new table, one new module, and `unitCount()` now answers for hands too, so every existing
  caller of it — the tile budget check, the submit path, the admin gallery — works unchanged.
- `runResolvers` had `kind: 'answer'` hardcoded. That had never been wrong because no `tally` game
  had a resolver; Guess Who is the first, and it would have written `answer` rows for a game whose
  other surfaces write `tally` ones. Fixed here, the same latent shape #10 found in `/admin/judge`.
- A resolver may now return `sourceId` to key its award on something other than the submission.
  `yarn` returns none and writes exactly what it wrote before.
- Nothing stops a second game declaring a hand from the same ladder. That would deal two
  independent hands from one pool, which is coherent and untested, because no such game exists.
