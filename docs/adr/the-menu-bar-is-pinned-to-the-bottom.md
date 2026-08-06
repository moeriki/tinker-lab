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
| guest | until the showdown is published | *nothing* |
| guest | once the showdown is up | `games` `league` `recap` `shots` |
| host | all night | `HQ` `court` `league` |
| host | once the showdown is up | `HQ` `court` `league` `recap` `shots` |

**The reveal is the showdown, not the freeze.**
[#77](https://github.com/moeriki/tinker-lab/issues/77) landed while this was being built and split
the ending in two — running → ended → showdown — and the bar gates on the second. The gap between
them is the hour in which the hosts finish the queue, and a guest whose bar had already sprouted
`league` during it would be one tap from an ending nobody has read out yet.

**Which links a request gets is decided by the server on every page load, and nothing else** — no
counts, no badges, nothing that could be stale by the time it is read. `navFor()` in `src/app.js`
picks the items from the admin cookie and `showdownHasStarted()`; `navbar()` in `src/render.js` draws them,
so the one file here that never opens the database still doesn't. Same seam as `bar`.

**`/showdown` opens to the admin cookie at any time.**
[#8](https://github.com/moeriki/tinker-lab/issues/8) locked out showing a *guest* anything
comparative all night; the person running the night has to be able to read the rankings whenever
they want — including during #77's gap, which is precisely when they are reading the top three off
something. A guest is still bounced to `/` until the showdown is published.

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

**No guest bar at all**, with the showdown carrying links onward to the other three. Rejected: the
four end-of-night surfaces are ones guests move *between*, and a guest deep in the photographs would
have no one-tap route back out.

## What #77 forced

[#77](https://github.com/moeriki/tinker-lab/issues/77) landed mid-build and anticipated this ticket
in a comment: the guest board's `see where you came` button was, it said, *"the only thing on this
site that points a guest at `/showdown` — the menu bar (#76) is where that link properly belongs"*.

**Both stay.** They are not the same thing. The button appears once, in a banner, at the moment the
table goes up: it is the invitation, and it is a moment. The bar is the way back afterwards, from
wherever a guest has wandered to. Deleting the button would delete the announcement and leave the
reveal arriving silently.

Opening `/showdown` to the admin also broke three of #77's own checks, and they were right to
break: its `ending` flow hands the walker both cookies, so it was asking whether the results were
being kept back of the one visitor they are not kept back from, and passing by accident. Those
checks now run before the admin cookie is in the jar, and the frozen-game one empties the jar and
walks a second team in to ask it properly.
