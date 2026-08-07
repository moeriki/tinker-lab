# The night ends twice

**Status:** accepted · **Ticket:** [#77](https://github.com/moeriki/tinker-lab/issues/77) · **Renamed by** [#79](https://github.com/moeriki/tinker-lab/issues/79)

## Context

One flag did two jobs. One timestamp froze the game *and* opened the results, so pressing **END
GAME** at 01:00 published the final table in the same instant it stopped anyone from playing —
every mutating POST and every scan redirected straight to the results.

Those are two moments and the hosts need the gap between them. Ending the game is what runs the
resolvers for Herd Mentality, Guess Who and the Triangle Test, so it is also the moment the numbers
become final; announcing before it is announcing numbers that are not. But finishing the queue and
reading the top three out is a chunk of the night with a room in it, and for the whole of that
chunk the old flag had already told thirteen phones who won.

The real alternative was leaving it as one press and making the hosts do their counting *before*
they froze anything. It loses because it inverts the dependency: the queue cannot be emptied until
submissions stop arriving, and the resolvers have not run, so the board the hosts would be reading
from is not the board the site is about to publish.

## Decision

**Two settings, three states, in one order: running → frozen → ended. Only the first arrow goes
both ways.**

- **`frozen_at`** — the freeze. A toggle, **no confirm**, fully reversible: the resolvers are
  idempotent and the awards upsert, so freezing, unfreezing and re-freezing land on the same
  numbers.
- **`ended_at`** — the publish. It computes nothing and freezes nothing; it is the only thing
  gating `/league`.

**The second press sits behind a confirm page, not a typed word.** RESET earns its spelling test by
being destructive and irreversible in the same breath. This one is irreversible *socially* — once
the room has read the table there is no undo, however the database feels about it — so what it
needs is a clear sentence and the checklist the hosts would otherwise be running from memory. A
spelling test in front of the climax, at 01:00, with a room watching, was considered and rejected
in [#11](https://github.com/moeriki/tinker-lab/issues/11).

**Between the two, a team keeps its own dashboard**, tiles and all, with a banner saying why
nothing responds. Not a holding page: they keep the board they spent five hours on. A refused POST
lands back on the page it came from rather than on the results, which is
[ADR-the-page-you-are-on-is-the-stage](the-page-you-are-on-is-the-stage.md) and also the whole
point — a stale tab must not publish an ending nobody has released.

**Once the night has ended the game does not unfreeze.** `unfreezeGame()` refuses and the control
is gone. The safety that makes reopening free is arithmetic, and arithmetic stops being the whole
story the moment a room has read the table; a site publishing final standings for a game that is
accepting answers again is the one state this split exists to make unreachable.

## Consequences

**The words were the site's own, and [#79](https://github.com/moeriki/tinker-lab/issues/79)
replaced them with the host's.** This ADR originally named the two moments *game end* and *the
showdown*, on the reasoning that both were already in `CONTEXT.md` and already on the routes — it
chose its vocabulary by not inventing any. That was the right instinct applied to the wrong
source. The words are now **freeze** and **end**, which inverts what *end* means: it used to be
the first press, and it is now the second.

Freeze says what press one does, and says that it is undoable, which *game end* did not. End is
what a guest actually experiences at press two — nothing ends for them at the freeze, they simply
find the buttons dead — and the page they end up on is `/league`, which is what the menu bar had
been calling it since #76 while the route said `/showdown`. #11's own candidates were *lock* and
*reveal*; **lock** still collides (a signature card locks for 30 minutes, and Teddy is in a
lockbox), which is why press one is *freeze* rather than *lock*.

**Nothing pushes to a guest.** A guest page does not refresh itself, so pressing this moves no
phone by itself: it publishes, and the next load anybody does finds the results. That is why the
banner carries a way in at all. (The host's two readouts *do* refresh, since #79 — `/admin` and
`/league` — which is a separate thing from pushing, and no guest page has one.)

**One migration, and only for the key names.** `settings` is key/value and `setSetting` upserts, so
neither timestamp needed a schema change when this ADR landed. #79's rename does need one —
`007-freeze-and-end.sql` — not because the shape changed but because a frozen database rolling
forward with the old key names would read as unfrozen.
