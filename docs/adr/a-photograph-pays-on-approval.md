# A photograph pays on approval, and a prompt pays once

**Status:** superseded by [ADR-a-photograph-pays-on-submit-and-the-host-may-veto-it](a-photograph-pays-on-submit-and-the-host-may-veto-it.md) · **Date:** 2026-08-07 · **Ticket:** [Nothing has checked the points economy against the whole roster at once](https://github.com/moeriki/tinker-lab/issues/84)

> **Superseded 8 Aug.** Every decision below rests on a premise that turned out to be false: that
> [#83](https://github.com/moeriki/tinker-lab/issues/83) would keep photographs host-judged. It
> reversed that instead — photographs stay `trust`, they pay on submit, there is no queue, and the
> host's only control is a delete. Nothing here is implemented and nothing here should be. It is
> kept because the *reasoning* about a second debit is still the best statement of what the veto
> costs, and because the alternative it rejected is the one the site now ships.

## Context

Photo scavenger and Portrait of a stranger are twenty of the hundred points on the board, and
both are `judging: 'trust'` — a photograph pays the instant it is sent, nobody looks at it.
[Photographs are trusted](https://github.com/moeriki/tinker-lab/issues/83) reversed that: the
hosts judge photographs now. It deliberately parked **when the point lands** until the roster had
been reviewed, because the answer changes what the tile feels like to play and what the ledger has
to be able to express.

The economy has exactly one debit — a hint, at 3 points, the first one free. Everything else on
the roster only ever adds. Paying a photograph on submit and taking it back on rejection would
introduce a **second debit, and the first one a team never chose**: a number going down on its own
while they are stood in a corridor holding a phone.

## Decision

**A photograph pays only once a host has approved it.** A submitted photograph is worth nothing
until then, and a rejected one has nothing to take back.

**A prompt pays once**, no matter how many photographs are sent for it. That rule already exists
on the trust path — a second photograph of the same prompt pays nothing extra — and it *is* the
tiles' ten-point cap. The host-judging path must carry the same rule, so the value of a prompt is
**one point if any photograph for it has been approved, and nothing otherwise**, recomputed from
the submissions each time a verdict is written.

Recomputed, not accumulated, because the hosts judge in whatever order the queue hands them
photographs. A team that shoots three pictures of prompt #4 and has one approved and two rejected
holds that prompt; approving and then rejecting must not leave them worse off than rejecting and
then approving.

For Portrait of a stranger, whose ten slots are anonymous rather than labelled, the same rule in
its own terms: the tile pays **the number of approved photographs, capped at ten**. Which slot a
photograph landed in is an ordinal assigned at submit time and means nothing, so a rejection in
the middle of the run must not strand a slot.

## Consequences

- **Hints remain the only debit on the roster**, and no score moves backwards because of something
  a host did. The `fresh` / `podium` / `chasing` / `rest` bands keep reasoning about a single
  negative path.
- **A slow host stalls a team's score**, and this is the cost taken knowingly. Ten photographs can
  sit at nought until someone with a drink in their hand gets to the queue. The queue being a
  full-screen one-thing-at-a-time surface is what makes that survivable.
- **Photo scavenger's copy becomes a lie** and has to change — *"Nobody is judging them, so the
  only way to lose is to stand still"* is now false twice over.
- **A rejected photograph must say so on the tile.** With nothing debited, a silent rejection is
  invisible: the team's score never moved, so the only signal that they need to shoot it again is
  the tile itself saying so.
- Re-judging stays free. Rejecting writes a zero rather than deleting, so a mis-tap at 23:00 costs
  nothing permanent, and the recompute means fixing it restores the point.

## Alternatives considered

**Pay on submit, take the point back on rejection.** Keeps the tile alive for people shooting in a
dark corridor, and means a slow host never stalls the game — the two properties that make it
tempting on a night with two hosts and ten to fifteen teams.

Rejected because it buys those with a debit nobody chose. A hint costs 3 and a team *presses the
button* — the modal announces the price, and the joke only works because the team elected to pay
it. A photograph clawed back is a number falling on its own, and the team most likely to see it is
the one shooting hardest. It also makes the retake path incoherent: the prompt has already been
paid and refunded, so a replacement photograph has to re-open a unit the ledger considers spent.
