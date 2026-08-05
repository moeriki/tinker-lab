# A question may be a ladder

**Status:** accepted · **Ticket:** [#22](https://github.com/moeriki/tinker-lab/issues/22) ·
**Amends:** the flat gate from [#9](https://github.com/moeriki/tinker-lab/issues/9)

## Context

Guess Who's deck is seeded at the door: everyone answers *"what did you want to be when you were
young?"* and each answer becomes a card somebody else has to attribute.

That is a **memory** question, and it is the only kind of onboarding question that can fail on a
person rather than on the form. Somebody who genuinely cannot remember has nothing to type — and
onboarding is a **gate** (#9), all-or-nothing, with every field `required`. So they are stuck in a
hallway with their coat on, in front of a form that will not let them through, over a party game.

The pressure was to accept junk: `dunno`, `?`, a mashed key. Junk seeds a dead card, and detecting
it is not something code can do — *"Jan's answer was literally `dunno`"* is a perfectly winnable
card, and a sincerity detector is exactly the kind of thing this repo has ruled out elsewhere.

## Decision

**Questions sharing a `ladder` id are rungs, of which a subject answers exactly one.**

Onboarding shows rung 1. *"Ask me something else"* walks down the list. **The last rung has no
skip**, so everyone contributes exactly one answer.

That last clause is the whole design. There is **no opt-out**: the ladder is not an escape from the
question, it is an escape from *a* question. Which means the gate stays a gate, there is no
"skipped" state to represent anywhere, and the deck never has a hole in it. It also imposes a
requirement on the last rung — it has to be answerable by absolutely anyone, which is why it is a
possession (*the most useless thing you own*) rather than a memory, an opinion or an experience.

The gate counts **slots**, not questions. A ladder is one slot however many rungs it has, so
`onboardingComplete()` asks *"is any rung of this slot answered?"* per subject. Answering a rung
**deletes** the member's answer to any rung they skipped past, so a member holds exactly one and no
abandoned answer can be dealt as a card whose owner does not remember writing it.

Skipping re-submits the whole form as a **GET**, carrying every typed value and a `rung:` marker
per subject back on the query string — the same trick the team name's reroll uses on screen one,
and for the same reason: no client JS anywhere near onboarding, and nothing typed is lost.

## Alternatives

**One fixed fallback question.** One extra tap for the few who need it, nothing for anyone else.
Rejected by Dieter on the grounds that a ladder costs nothing either — only the people who choose
to skip ever see rung 2, so "more questions exist" is not "more questions asked". He was right;
the objection had conflated the two.

**A menu — three questions, answer whichever.** Arguably the least friction, since there is no
back-and-forth. Rejected because it is the only option that makes a *choice* out of what is
currently a prompt, and it charges the 90% who would happily have answered the first one.

**Allow a blank answer.** Cheapest of all. Rejected because it puts a state in the gate that
nothing else on the site has, and because the ladder gets the same outcome while still producing a
card.

**Sniff out junk answers.** Rejected: undecidable, and `dunno` is a real answer.

## Consequences

- `onboardingComplete` no longer counts rows against a total. As well as making the ladder work,
  that closes a hole in the old version — a member with two answers could mask another subject's
  blank, because only the total was compared.
- `saveQuestions` now ignores any field that does not name a real question. It used to insert every
  posted field as an answer, so the `rung:` carriers and the `skip` button would have become rows
  under ids no content declares.
- A rung must declare `card` (the short prompt a Guess Who card wears), rungs must share a scope,
  and a one-rung ladder is a boot error.
- **A question id could be renamed for free here, and cannot be again.** `age-eight` became
  `wanted-to-be` because the label stopped naming an age. Renaming orphans every answer already
  given ([ADR-game-content-lives-on-disk](game-content-lives-on-disk.md)); it was free only
  because no party had happened yet.
- The door is now five questions deep in one place, and nothing polices the *total* size of
  onboarding — every question is justified on its own and the sum is nobody's job.
  [#52](https://github.com/moeriki/tinker-lab/issues/52) exists to count it once every game has
  declared what it needs.
