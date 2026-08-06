# The night ends twice

**Status:** accepted · **Ticket:** [#77](https://github.com/moeriki/tinker-lab/issues/77)

## Context

One flag did two jobs. `game_ended_at` froze the game *and* opened `/showdown`, so pressing **END
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

**Two settings, three states, in one order: running → ended → showdown. Only the first arrow goes
both ways.**

- **`game_ended_at`** — the freeze. A toggle, **no confirm**, fully reversible: the resolvers are
  idempotent and the awards upsert, so ending, reopening and re-ending land on the same numbers.
- **`showdown_at`** — the publish. It computes nothing and freezes nothing; it is the only thing
  gating `/showdown`.

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

**Once the showdown is up the game does not reopen.** `reopenGame()` refuses and the control is
gone. The safety that makes reopening free is arithmetic, and arithmetic stops being the whole
story the moment a room has read the table; a site publishing final standings for a game that is
accepting answers again is the one state this split exists to make unreachable.

## Consequences

**The words are the site's own.** `game end` and `the showdown` were already in `CONTEXT.md` and
already on the routes. The grilling in #11 called these two moments *lock* and *reveal*, and both
of those collide here — **unlock** is what a scanned code does to a tile, and **hint reveal** is
what a team pays points for. The concepts are #11's; only the vocabulary is chosen here, and it is
chosen by not inventing any.

**Nothing pushes.** Guest pages do not poll — that is a locked constraint, and only `/admin` polls
— so pressing this moves no phone by itself. It publishes, and the next load anybody does finds
the results. That is why the banner carries a way in at all: `/showdown` would otherwise be a page
with no route to it from anywhere a guest can see, until the menu bar
([#76](https://github.com/moeriki/tinker-lab/issues/76)) lands and gives it the one it should have.

**No migration.** `settings` is key/value and `setSetting` upserts, so `showdown_at` needs no
schema change and a reset clears both rows with every other.
