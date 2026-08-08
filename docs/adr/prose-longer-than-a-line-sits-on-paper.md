# Prose longer than a line sits on paper

**Status:** accepted · **Date:** 2026-08-08 · **Ticket:** [The rules page drops its longest passage straight onto the gradient](https://github.com/moeriki/tinker-lab/issues/105)

## Context

The site had **three answers to "does a paragraph get a box" and no rule**, which is the actual
defect — any one of the three is defensible on its own.

- **`.door`** — paper, `--edge-3`, `--shadow-3`. Every onboarding screen puts its heading, its
  sentence and its form inside one, and it is comfortably the most legible copy on the site. It is
  also named for *where it lives*, which is the shape of name that stops a class being reused (see
  **Component** in `CONTEXT.md`).
- **`.hero--text`** — the tile gradient with the same edge, for a game page's two or three sentences.
- **Nothing at all** — `/rules` rendered its five-paragraph points block as bare `<p>` on the party
  gradient. The longest continuous read on the site was the only one with nothing behind it.

The complaint is stated as legibility, but the mechanism is sharper than that and it is the reason
this needed deciding rather than tuning: **`--grad-party` is `background-attachment: fixed`, so it
belongs to the screen and not to the page.** Where a paragraph falls on it depends on how far that
particular team has scrolled. The same sentence is on lime for one team and on orange for another,
and no amount of contrast-checking one screenshot says anything about the next phone.

`/rules` is also the page most likely to be read standing up in a hallway at 20:30, and the only
page whose whole job is to be read rather than pressed. The list *above* the passage was already
boxed — the Windows-95 frame in `win()` — so the page was a boxed list followed by unboxed prose
under a heading, which is the inconsistency at its most visible.

## Decision

**A run of prose gets paper when it is two or more paragraphs the page exists to have read. The
passage decides, not the page it is on.**

The surface is `.paper` — `paper()` in `src/render.js`, drawn on `/kit` §20 — and it is
`.door`'s old declarations, promoted verbatim. Nothing changed on screen at the front door.

**`.door` composes it rather than copying it.** `doorStep()` emits `class="paper door stack"`, the
surface is declared once, and everything about a *form* — title, count, intro, action row — stays
`.door__*`. So a change to the paper is a change to the front door too. That is intended rather
than tolerated: this site has one paper and one edge, and the moment there are two of them there is
no rule, only two boxes that happen to match today.

**The name is the material, not a place.** `.sheet` was the obvious word and the house had already
spent it on the QR cutting sheet; `.paper` follows `--c-paper`, which is what it is made of.

**A heading does not go inside.** On `/rules` the `HOW POINTS WORK` shout stays outside on the
gradient, so the page still reads as a loud page with a quiet passage in it rather than turning into
a document — and it is the same relationship the window frame above it already has to the page's own
heading. Dieter's call, made off four rendered versions of the real page rather than a description.

## Consequences

- **Three pages change and no others.** `/rules`' points block, `/p/hidden`'s two paragraphs, and
  the no-such-code page's two. `/p/motivation`, `/p/rickroll` and `too-soon` are one-liners under a
  hero and are untouched — one paragraph on a gradient was never the complaint; five of them were.
- **The `<small>` sign-offs stay outside the sheet** on both gag pages. They are asides, not the
  read, and a sheet around one line is a box for its own sake.
- **`content/pages/` writes the markup by hand**, as it already does for `.hero`. `paper()` takes
  escaped strings, and those two pages carry an em dash, a `<strong>` and a `<small>` that a list of
  escaped strings cannot hold. A prose surface that accepted markup from `content/` would be a hole
  markup falls through, and every caller so far is handing it copy.
- **`/kit` grew a patch of the real party gradient** (`.demo-party`, kit chrome) because every
  `.sect` on that page is `--c-paper`: a white sheet demoed on white paper looks fine, and so does
  the counter-example beside it, so the page would have documented this component while hiding the
  thing it exists to fix. `fixed` is kept on that patch deliberately — a scrolling copy of the
  gradient draws a pretty box and demonstrates nothing.
- **The gaps between those paragraphs are not this ticket's.** They are about 65px for a mechanical
  reason and belong to [the spacing scale](https://github.com/moeriki/tinker-lab/issues/103), which
  fixes them under everything at once.

## Alternatives considered

**Leave it bare and fix the contrast instead.** Rejected because there is no contrast to fix: the
background of any given sentence is a function of scroll position, so the passage has no single
pair of colours to measure. It is also the answer that keeps three answers and no rule.

**The tile gradient (`.hero--text`) around the passage.** Drawn and looked at. It does fix the
drift — the box carries its own gradient, so the words stop travelling — and it fixes none of the
legibility, because it is still colour behind five paragraphs. It also borrows the look that
currently means *this is a game*, on the one page that is not one.

**Paper with the heading inside it.** Drawn and looked at, and the closest runner-up. It reads as
one document, the way the door does. Rejected because `/rules` is not a document — it is a loud page
with a quiet passage in it, and swallowing the shout turns the whole block into an appendix.

**A fourth surface, distinct from `.door`.** Rejected as the thing the ticket was filed against: a
fourth answer to a question that already had three. If the door's paper is right for a paragraph
read standing up in a hallway — and it is the most legible copy on the site — then the reason to
draw a second one is that `.door` is named for a place, and renaming is cheaper than duplicating.
