# The frame is not the page

**Status:** accepted · **Date:** 2026-08-08 · **Ticket:** [Every gap on this site is one rem, and the one under each title is an accident](https://github.com/moeriki/tinker-lab/issues/103)

## Context

`layout()` put every page in a single flex column:

```html
<div class="app">
  <div class="stack">
    ${bar}                              <!-- the score header -->
    <h1 class="shout">${title}</h1>
    ${body}                             <!-- interpolated raw -->
    ${showClose ? '<a class="btn btn--tertiary">close</a>' : ''}
  </div>
</div>
```

`${body}` is raw markup, so **every element a page emits is a direct flex item of that one
`.stack`**, sharing one `gap: 1rem` with the score header, the title and the way out. The distance
from a paragraph to the next paragraph and from the last thing on a page to the button that leaves
it were therefore the same number *by construction*. Nothing in the markup distinguished them, so
no rule in `app.css` could have.

Two consequences, both measured on `/rules` before this ticket:

- **Margins on flex items do not collapse.** An `<h1>` still arrived wearing the UA's `0.67em` and
  a `<p>` its `1em`, and those landed *on top of* the gap the stack had already paid. Real gaps:
  39px under the page title, 54px between `HOW POINTS WORK` and its own first line, 50px between
  paragraphs of one passage — against **16px** between the last thing on the page and the exit.
  The page separated a thought from itself harder than it separated itself from the door.
- **The frame had no top.** `.app` had `padding-top: 0`, so the score header's shadow met the
  marquee's black bar with no seam and the two read as one object.

Separately, the stylesheet made **101 spacing declarations out of 28 distinct values** — `0.45rem`,
`0.48rem` and `0.5rem` all appear — with no token beside `--edge-1/2/3` to pick from.

## Decision

**Three things, and they are one decision because none of them works alone.**

1. **A ramp.** `--space-1` … `--space-7` (4, 8, 12, 16, 24, 32, 48px), numbered like `--edge-*`,
   documented by *relationship* rather than by size. Every spacing declaration picks a step. Every
   one of the 28 old values rounded onto its nearest step, so nothing moved more than ~3px.

2. **The browser's own margins go.** `h1`–`h6`, `p`, `ul`, `ol`, `dl`, `figure`, `blockquote`,
   `pre` get `margin: 0` in the reset. This is the rule the file has claimed since 126369b —
   *primitives carry no outer margin* — applied to the primitives the browser ships, which is
   where it had never been applied at all. Without it the ramp is advisory and the UA sheet wins.

3. **`layout()` wraps `${body}` in a `.stack` of its own.** The outer stack becomes
   `.stack--frame`: four children — header, title, *page*, exit — at `--space-5`. The inner one is
   the page, at `--space-4`. **That single wrapper is what makes the other two mean anything**,
   because it is the first time the markup has distinguished a seam in the frame from a seam in
   the content.

Two named asymmetries sit on top, and both sum onto a step rather than inventing a number:

- `.app .stack > h2` takes `--space-2` above, so a heading has `--space-5` over it and
  `--space-4` under it. A heading belongs to what follows it; without this every heading on the
  site floated exactly halfway between the passage it ended and the one it began.
- `.app .stack > .btn--tertiary` takes `--space-2`, so an exit sits at `--space-6` when the frame
  owns it and `--space-5` when a page emits its own — the widest seam in its column either way,
  where it used to be the narrowest. Scoped to a column child on purpose: [#107](https://github.com/moeriki/tinker-lab/issues/107)
  landed the three button tiers while this ticket was open and gave `.btn--tertiary` a second job,
  reloading a screen, and those all sit in rows rather than columns.

## Alternatives

**Keep one flat stack and add gap modifiers.** `.stack--tight` already existed and a
`.stack--loose` could have come back (it shipped once and was retired in #58 for having no
caller). Rejected: a modifier changes *every* gap in the column at once, and the problem is that
one column holds two different kinds of seam. No number assigned to that column is right, because
the exit and the paragraph are asking for different things from the same declaration. This is the
option the ticket named, and it fails on the structure rather than on the values.

**Give the close button its own margin instead of splitting the stack.** Cheapest possible fix and
it addresses one symptom. Rejected on the house rule that primitives carry no outer margin — the
same button sits mid-page elsewhere, and `.btn` cannot know which instance is a way out. The frame
knows; that is why the rule lives on `.stack--frame`.

**Reset UA margins only inside `.app`.** Narrower blast radius. Rejected because `/kit` and the
`/shots` viewer are the two documents outside `.app` and both want the same rule — a page that
documents the site's spacing should not be laid out by a different set of margins than the site.

**Leave the 28 values and only fix the reset.** The dead band under every title was the loud bug;
the value sprawl was quiet. Rejected because the sprawl is what puts the next value on the site:
with no ramp, the next component picks a number, and there is no test that catches it.

## Consequences

- The whole of `/rules` is now three numbers — 16 inside a passage, 24 for a new thought and for
  the frame's seams, 32 to the exit — and the page is **1553px → 1301px** tall with nothing
  removed.
- **The admin surfaces get all of this whether or not they were designed for it.**
  [#66](https://github.com/moeriki/tinker-lab/issues/66) ruled them outside `/kit`'s contract, and
  that ruling is about design rather than about the cascade: `.btn`, `.input` and every spacing
  token are the same rules there as everywhere. That was free here, and
  [#108](https://github.com/moeriki/tinker-lab/issues/108) is the first pass that will ever look
  at those pages to say whether it stayed free.
- `/kit` §4 draws the ramp as seven bars whose widths *are* the tokens, so a step that drifts from
  its demo is not possible. `.stack--frame` is drawn whole beside the other three gap demos.
- **Not on the ramp, deliberately:** sizes (a tile's `min-height`, a thumbnail's `4.5rem`), the
  marquee's `--cell` and `--gap` (derived from font metrics, and `marquee()` does arithmetic on
  them), and the two clearances the pinned foot and the viewer's close button owe the page. Those
  are measured against a thing rather than chosen from a scale, and rounding them would be a
  category error.
