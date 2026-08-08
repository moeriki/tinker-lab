# A photograph pays on submit, and the host may veto it

**Status:** accepted · **Date:** 2026-08-08 · **Ticket:** [Photographs are trusted, and nobody has decided what the queue holds](https://github.com/moeriki/tinker-lab/issues/83)

Supersedes [ADR-a-photograph-pays-on-approval](a-photograph-pays-on-approval.md), which was written
one day earlier under [#84](https://github.com/moeriki/tinker-lab/issues/84) on the assumption that
#83 would keep photographs host-judged. It did not.

## Context

[What the hosts actually have to do on the night](https://github.com/moeriki/tinker-lab/issues/11)
decided that photographs become host-judged, reversing `trust` on Photo scavenger and Portrait of a
stranger, and parked *when the point lands* for this ticket. Everything after that followed from
the premise that a verdict is owed on every photograph.

Nobody had counted the photographs. Both tiles are ten units at a point, so the roster puts
**twenty per team** in front of a host — two hundred to three hundred on a night with ten to
fifteen teams, arriving all evening. That is not a queue anyone empties while holding a drink.

The deeper problem is what a verdict would be *for*. The only thing a host can actually reject is
somebody farming points off pictures of a radiator. A blurry photograph of two people laughing
answers the prompt, and a portrait's quote is unfalsifiable by construction — the tile records
nothing about who is in the shot, on purpose. So judging photographs is anti-cheat wearing a
scoring hat, which is both a locked constraint on the map and the exact phrase
[`content/games/portrait.js`](../../content/games/portrait.js) already uses to kill an earlier
draft of that tile.

## Decision

**There is no judging queue.** `/admin/court` is deleted — route, stub, the word in the host's menu
bar, and HQ's `court — N waiting` row. Nothing on this site ever waits on a human verdict.

**Photographs stay `judging: 'trust'` and pay on submit**, which is what they already did. #11's
flip to host-judged is reversed; no game on the roster is `manual`.

**The host's only control is a delete**, in the fullscreen viewer on `/shots`, admin-only, behind
the house confirm modal. It is a veto for a picture of a radiator and for *please take that one
down* — not a pass anyone is expected to make. Nothing counts what has not been looked at, because
there is nothing to be behind on.

**A delete is a true delete**: the submission row goes, the file is unlinked, and the point goes
with it **if it was the last photograph answering that unit**. A retake writes a second submission
against one unit and upserts one award, so deleting one of a pair takes nothing — the prompt is
still answered.

**The team is told nothing.** The slot reopens and the tile's count drops. There is no line on the
tile and no record anywhere.

## Consequences

- **The economy keeps exactly one debit a team chose**, and gains one it did not: a vetoed
  photograph. Accepted, because it is rare by construction and because the alternative — a slow
  host holding two hundred photographs at nought — is worse for the tile these two exist to feed.
- **A slow host stalls nobody.** The tile stays alive for someone shooting in a dark corridor,
  which is the property the whole pair is built to produce.
- **Photo scavenger's copy stays.** *"Nobody is judging them, so the only way to lose is to stand
  still"* was going to become a lie under the design we did not pick. Under this one it is true in
  every way a guest meets it: no verdict is owed and every photograph pays the moment it lands.
- **A mis-tap destroys a photograph**, which is why the confirm exists and why the control sits in
  the viewer rather than on a 5mm thumbnail on the wall.
- **`manual` judging now has no caller on this roster.** The per-unit cap the superseded ADR
  specified for that path was never built and no longer needs to be. The gallery still reads the
  mode from content, so a game declaring `manual` gets buttons with no code change — and would pay
  per photograph rather than per unit, which is a real gap for whoever adds one.
- **Portrait's anonymous ordinals had to change.** They were the *count* of photographs a team had
  sent, which is the same number as the next free slot right up until a delete makes a hole: a team
  holding slots 0,1,3,4 would claim 4 again, collide with a paid award, and lose a point forever.
  They are the lowest free ordinal now, which also keeps a vetoed portrait costing its point and
  not the slot as well.

## Alternatives considered

**Keep the queue and pay on approval**, as the superseded ADR decided. Rejected on volume and on
purpose: two hundred verdicts nobody can owe, in service of catching a fraud the map has already
ruled out of scope.

**An "agree" button beside the veto**, so the list can be cleared. Rejected because it turns the
veto back into a queue: the list would only empty by pressing two hundred buttons, and HQ's count
would become a debt climbing all night. Without one, nothing is ever waiting and the surface is
optional by construction. The cost — a host doing a careful pass cannot mark where they got to —
is paid by newest-first ordering.

**Remove the row but leave the file on disk**, so nothing is destroyed. Rejected: the host asked
for a delete and got a confirmation dialog instead of a safety net, which is the right trade for a
control that also has to satisfy somebody asking to be taken off the wall.
