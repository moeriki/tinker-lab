# The menu bar is pinned to the bottom

**Status:** accepted · **Date:** 2026-08-06 · **Ticket:** [The menu bar only exists on dev builds, and five new surfaces need a way in](https://github.com/moeriki/tinker-lab/issues/76)

## Context

Until this ticket the only navigation on the site was `devBar()` in `src/render.js`, a yellow strip
the dev build appends and production has never rendered. Five surfaces were arriving behind it —
the host's overview, the judging queue, the results, the recap and the photographs — and guests and
hosts need different ones.

[#11](https://github.com/moeriki/tinker-lab/issues/11) had already settled *what goes in it*: no bar
at all for a guest while the game is playing, since the tiles are the navigation; a bar for the host
from the first minute; and the end-of-night surfaces appearing for everyone at the reveal. What was
open was where it sits, what the words are, and whether five of them fit on a 390px phone.

Two facts about the frame decided most of it:

- **A guest's page top is full and a host's is empty.** Guest pages carry a sticky marquee and a
  scorebar; every admin surface renders `still: true`, which drops the marquee *and* the foot strip
  and passes no scorebar, so a host's page has no chrome at either end.
- **Nothing may go above the marquee.** Safari 26 dropped `theme-color` and samples the topmost
  sticky element to tint the phone's own status bar, which is what makes the frame reach the edge of
  the screen ([#72](https://github.com/moeriki/tinker-lab/issues/72)). A strip inserted above it
  takes that job over and is the wrong colour for it.

## Decision

**The bar is `position: fixed` at the bottom of the viewport, with the small print pinned under
it.** The frame therefore still ends in the same black band it always did, and iOS keeps sampling
`<body>`'s `background-color` for its own bottom bar rather than sampling this.

It exists only on pages that were given one. `layout()` emits the foot strip bare otherwise, so
every page that had no menu before this ticket lays out exactly as it did.

**Six words, and three of them are the same word in both bars:**

| who | when | bar |
| --- | --- | --- |
| guest | until the night has ended | *nothing* |
| guest | once the night has ended | `games` `league` `recap` `shots` |
| host | all night | `HQ` `court` `league` |
| host | once the night has ended | `HQ` `court` `league` `recap` `shots` |

**The reveal is the end, not the freeze.**
[#77](https://github.com/moeriki/tinker-lab/issues/77) landed while this was being built and split
the ending in two — running → frozen → ended — and the bar gates on the second. The gap between
them is the hour in which the hosts finish the queue, and a guest whose bar had already sprouted
`league` during it would be one tap from an ending nobody has read out yet.

**Which links a request gets is decided by the server on every page load, and nothing else** — no
counts, no badges, nothing that could be stale by the time it is read. `navFor()` in `src/app.js`
picks the items from the admin cookie and `gameHasEnded()`; `navbar()` in `src/render.js` draws them,
so the one file here that never opens the database still doesn't. Same seam as `bar`.

**`/league` opens to the admin cookie at any time.**
[#8](https://github.com/moeriki/tinker-lab/issues/8) locked out showing a *guest* anything
comparative all night; the person running the night has to be able to read the rankings whenever
they want — including during #77's gap, which is precisely when they are reading the top three off
something. A guest is still bounced to `/` until the night has ended.

**The page you are standing on wears a solid lime block**, plus `aria-current="page"`. Five flat
words in a loud room at one in the morning are five identical words.

## Consequences

- **`dashboard` is not a word on this site.** It was #11's candidate and it meant two different
  pages depending on who was reading. It is `HQ` for the host's overview and `games` for a guest's
  tiles, so no label ever has to mean both. This is safe because **a host is never a team**: one
  host runs the admin and does not play, the other plays as an ordinary guest, so the two bars never
  appear on one device.
- **Width is a budget and the words were cut to it.** At 390px the bar holds roughly 44 characters
  including gaps. #11's own five — `dashboard queue results highlights gallery` — come to 41 before
  gaps and do not fit. The six chosen words come to 23 for the host's five, which is why
  `.navbar__item` shrinking is insurance rather than a live squeeze.
- **`.shell--nav .app` owes 8rem of bottom clearance**, for the same reason the 3rem already there
  exists: the last thing a page says must stop above the frame rather than under it.
- **Three routes were created to stop the bar pointing at 404s** — `/admin/court`, `/recap` and
  `/shots` — as honest stubs naming
  [#83](https://github.com/moeriki/tinker-lab/issues/83),
  [#81](https://github.com/moeriki/tinker-lab/issues/81) and
  [#80](https://github.com/moeriki/tinker-lab/issues/80). The words are settled; the pages are not.
- **The door keeps no menu.** `/welcome` and `/questions` stay bare: you are not inside yet.
  *Amended [#96](https://github.com/moeriki/tinker-lab/issues/96) — still true on the night, and no
  longer true on a dev build. See the amendment below.*
- `scripts/walk.js` grows a `menu` flow that ends the game mid-run, so both bars either side of the
  reveal are photographed rather than reasoned about.

## Alternatives considered

**Top, directly under the marquee.** Reads as one black frame and is the obvious place. Rejected
because it scrolls away unless it is also sticky, and if it is sticky that is two black strips
permanently eating the top of a 390px screen — three, on a guest page, once the scorebar is counted.
The bottom was empty on every host surface and is where a thumb already is.

**Bottom, but in the document flow.** Cheapest to build, nothing covered, no clearance owed.
Rejected because the host's queue is a list: getting back to the overview would mean scrolling to
the end of it first, and this bar exists to be reachable without scrolling.

**A count on `queue`.** Tempting — it is the thing that fills up while nobody is looking. Rejected
because this site polls nowhere but `/admin`, so a count is only true at page load and a stale
`court 7` on a page opened ten minutes ago is a small lie in the one place that must not tell them.
The numbers live on the board, which does poll.

**No guest bar at all**, with `/league` carrying links onward to the other three. Rejected: the
four end-of-night surfaces are ones guests move *between*, and a guest deep in the photographs would
have no one-tap route back out.

## What #77 forced

[#77](https://github.com/moeriki/tinker-lab/issues/77) landed mid-build and anticipated this ticket
in a comment: the guest board's `see where you came` button was, it said, *"the only thing on this
site that points a guest at `/league` — the menu bar (#76) is where that link properly belongs"*.

**Both stay.** They are not the same thing. The button appears once, in a banner, at the moment the
table goes up: it is the invitation, and it is a moment. The bar is the way back afterwards, from
wherever a guest has wandered to. Deleting the button would delete the announcement and leave the
reveal arriving silently.

Opening `/league` to the admin also broke three of #77's own checks, and they were right to
break: its `ending` flow hands the walker both cookies, so it was asking whether the results were
being kept back of the one visitor they are not kept back from, and passing by accident. Those
checks now run before the admin cookie is in the jar, and the frozen-game one empties the jar and
walks a second team in to ask it properly.

## Amendment: the yellow strip is gone (#96)

**Date:** 2026-08-07 · **Ticket:** [The yellow strip is a fourth menu, and three of its four links
have homes now](https://github.com/moeriki/tinker-lab/issues/96)

This ADR's Context opens by naming `devBar()` as the only navigation the site had. It is now
deleted, and this bar is the only navigation the site has on any build.

**Why it could go.** Three of its four links had homes by the time this bar shipped: `admin` is
`HQ`, `board` moves into this bar, and `test team`/`log out` were never two links but one toggle,
which now sits at the foot of `/admin/controls` beside the other levers with consequences. The
fourth item was the word `DEV`. Keeping a whole strip at the top of the screen to carry one word
would have contradicted this ADR's own decision twice over — a second navigation, and one above
the marquee.

**What replaced the warning.** The bar is drawn **yellow on a dev build**, ink on yellow with the
lit block inverted, because lime on yellow is unreadable. The colour is the badge. It is inline on
the element rather than a rule in `app.css`, which is why production's stylesheet is still
byte-identical — the same bargain `devBar()` struck in
[#62](https://github.com/moeriki/tinker-lab/issues/62). The one state that cannot be inlined,
`:active`, keeps its magenta.

**A dev build holds every word.** `board`, plus `recap` and `shots` whatever the clock says, and
`showRecap`/`showShots` let a dev build past the gate that bounces production — a word in the bar
whose route redirects away is the dead link this ADR created three stubs to avoid. `board` is
dev-only and not as a preference: `/` demands a team, and **a host is never a team**, so on the
night that link would land the host on the front door and invite him into his own league. It works
in dev only because `devAttach()` plants both cookies.

**The door keeps no menu, on the night.** `/welcome` and `/questions` now draw one on a dev build,
for the two reasons the deleted strip existed: it is where a stray dev build says hello — and
[#69](https://github.com/moeriki/tinker-lab/issues/69) put one on `bday.moeriki.com` with nothing
to take it off — and it is where `/dev/logout` lands you, so without it the walk back in was typing
an admin URL from memory.

**Width was not spent.** The night's widest bar is still the host's five words and still 23
characters. The sixth word exists only on a build no guest loads.

## Amendment: nothing may go above the marquee — because nothing is up there (#88)

**Date:** 2026-08-07 · **Ticket:** [The marquee rides the top of the screen, and it is meant to
scroll away](https://github.com/moeriki/tinker-lab/issues/88)

This ADR's Context rests on two facts about the frame. **The second one has expired.** "Nothing may
go above the marquee" was true because Safari 26 samples the topmost `sticky` element to tint the
phone's own status bar, and the marquee was sticky. Dieter wanted the strip to leave with the page,
so it is an ordinary block now — and with it went the last `position: sticky` rule on the site.

**The decision does not move, and that is the point of recording this.** The bottom placement was
carried by the other reasons on their own: a guest's page top already holds the marquee and a
scorebar, the bottom was empty on every host surface, and it is where a thumb is at one in the
morning. An argument expiring is only interesting if it was load-bearing, and this one was not.

**What did change is the frame itself.** The top of the screen is no longer black — Safari draws
its own colour there, because nothing is pinned for it to sample. Looked at on Dieter's iPhone
before this landed: it is fine. So the frame is asymmetric on purpose now, black along the bottom
from `<body>`'s `background-color` and the browser's own along the top, and the foot stays pinned
because being reachable without scrolling is this ADR's whole decision.

**"Top, directly under the marquee" stays rejected**, and for a sharper reason than before. It
scrolls away unless it is also sticky — and a sticky bar up there would now be the only pinned
thing at the top of the page, so it would inherit Safari's sampling and have to be the right colour
for a job it was never meant to do, on top of eating the screen the Alternatives section already
counted.

**What it cost the style kit.** `/kit` draws this bar in flow inside a padded section, which offers
about 327px against a phone's 390px. The six-word bar is 381px of min-content, so it did not
overflow — Chrome widened the *layout viewport* until it fit and rendered the whole page at 445px,
silently, hiding from a check that compares `scrollWidth` to `innerWidth` because both grew
together. The same failure `.board` had in `app.css`, and the same medicine: the kit's demo slots
now `contain: inline-size` and scroll. Measured, not assumed — and the items shrink as this ADR
claims they do, verified at a 200px container.
