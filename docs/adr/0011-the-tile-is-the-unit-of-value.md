# ADR-0011: The tile is the unit of value, and the hint is priced against it

**Status:** accepted · **Date:** 2026-08-05 · **Ticket:** [Points economy and hint cost](https://github.com/moeriki/tinker-lab/issues/8)

## Context

The mission fixes one number and leaves every other one open: **a hint costs 3 points**. That
number is a joke — the submit button says *"What?"*, and the modal says *"oh yeah, a hint costs
you 3 points"* — and a joke about a price only works if the audience knows what things cost.

So "how much is a hint" and "how much is everything else" are the same question asked twice. Pick
a scale where a tile is worth 100 and the modal is announcing pocket change. Pick one where a
tile is worth 4 and hints are unaffordable, so nobody buys one and the joke never fires at all.

The roster ([#7](https://github.com/moeriki/tinker-lab/issues/7)) had already fixed ten tiles of
wildly different shapes: two three-step hunts, a nine-square bingo card, an attribution game over
~25 names, five predictions, two capped photo tallies, a one-in-three taste test and a trophy
awarded by hand. Their units do not divide into any single number.

## Decision

**The atom is 1 point. Every tile is worth 10. A perfect score is exactly 100.**

Flat, not weighted. A tile's price says nothing about its difficulty, how long it takes, or how
much talking it forces — only that it is one of ten things to do tonight.

At that scale a hint is **three bingo squares, or three photos**: 30% of a tile in the moment you
buy it, 3% of the night by 01:00. It stings where you are standing and does not decide the party.

Five things follow.

**A tile spends its 10 per unit, with a completion bonus where the units don't divide.** Human
Bingo pays 1 per square with a 10th point for the blackout; the photo scavenger pays 1 per prompt
capped at 6, with 4 for the full set. Where they *do* divide, there is no bonus — Herd Mentality
is a clean 2 × 5, and Portrait of a stranger is 2 per distinct team capped at five teams.

**Hunts bank per step, back-loaded: 2 + 3 + 5.** Points live on the step, not the hunt; a hunt
declaring a game-level `points` is a boot error. This is the one place partial credit is
load-bearing rather than generous, because hunts are the two tiles where a team can buy a hint
and still fail. All-or-nothing at the finish makes that hint a gamble on an outcome you don't
control, so the tiles that most need hints would be the tiles where hints are least rational.

**Finding a code pays nothing.** Points mean *you played the game*, never *you walked past it*.
A team that scans everything and submits nothing scores 0. Hunts are the deliberate exception —
there the walking **is** the mechanic, and the scan is the play.

**Scores may go negative, and nothing clamps them.** Hints are the only debit. Getting under zero
takes real bad luck — buy hints, score nothing — so it is rare and shallow, worst realistic case
about −5. `score = SUM(awards)` stays literally true, with no special case in the tile, the
header or the showdown, which is the whole point of [ADR-0002](0002-points-are-a-ledger.md).

**Three standing bands, and only the first is a rank.** *Podium* is a score at or above third
place. *Chasing* is within 30 of it — three tiles, catchable. *Rest* is everything further back.
Band 2 is proximity rather than a slice of the field because rank alone lies about a near-tie: if
third has 60, a team on 59 is close whether they are fourth or eleventh. **No comparative number
is ever shown** — not a rank, not another team's score, not the distance to the podium. The vague
message is the entire signal a team gets all night; the host has the true board at `/admin`, and
the showdown is where the reveal happens.

## Consequences

- `economy.tilePoints` is the contract per-game tickets author against. Only hunts can be checked
  at boot, because `answer` and `tally` games spend their budget inside `check()` and `resolve()`
  where only the ticket that wrote them can verify the arithmetic.
- `awardHuntProgress()` re-awards **every** reached step, not just the newest, keyed on
  `source_id = step`. It upserts, so it is safe on every scan and again from `/admin/rescore`, and
  it self-heals a step whose award was never written.
- Before any team has scored, there is no podium: the whole party sits in *chasing*, which is
  exactly true at 20:05. A podium made of zeroes would tell a team who has done nothing that they
  are amazing.
- Ties take the better band. Ordering breaks them on `created_at`, and telling a team they missed
  the podium on identical points because they arrived later is a worse error than occasionally
  showing four teams "top 3".
- The **Triangle Test is flat 10 like everything else**, which the roster warned about: it is one
  guess in three, and one team shouting the answer makes it free for everyone after them. Taken
  knowingly — flat was chosen for legibility, and the fix belongs to that game's own design.

## Alternatives considered

**Weighting tiles by talking, or by effort.** Both were drawn up. Talking-weighted (6–14) would
have made the points argue for what the party is *for*; effort-weighted would have paid by the
roster's own minute estimates. Rejected for flat: ten tiles at ten points is a board a guest can
do arithmetic on in their head, and the ceiling is a round 100.

**Paying resolve-games a premium for blind commitment.** The ticket proposed it. The premise is
false — `answer` games are editable until game end, so the resolve tiles are the ones you can
keep *improving* all night, and the roster already accepts that corpus-reading tiles are richer
at midnight. A premium would compound an advantage they have rather than pay for a cost they bear.

**Raising the hint cost off 3.** Clean mechanically, and it throws away a line written into
`MISSION.md` and quoted in the modal copy. The scale was the free variable; the 3 was not.

**Flooring the displayed score at zero.** Kinder to a stuck team, and it breaks `score =
SUM(awards)` in three places at once — the tile, the header and the showdown can then disagree
with each other.

**Never charging a hint below zero.** Inverts the joke: doing badly would make hints free, and
exactly the teams who most need to feel the price would stop paying it.

**One point per unlock**, so exploring always pays. Rejected: the ceiling becomes 108 and "every
tile is 10" stops being true, to reward walking past a thing rather than doing it.

**Showing the podium line, or a live rank.** Both make band 2 actionable, and both are a
leaderboard — which is the thing the three vague bands exist *instead of*.
