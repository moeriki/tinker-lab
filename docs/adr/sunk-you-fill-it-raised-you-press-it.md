# Sunk you fill it, raised you press it

**Status:** accepted · **Date:** 2026-08-08 · **Ticket:** [A box you type in, a box you pick from and a box you press are the same box](https://github.com/moeriki/tinker-lab/issues/104)

## Context

`.input`, `.input--select` and `.btn` were one shell wearing three fills. All three took a
`--edge-2` black border, square corners, `min-height: var(--tap)` and a hard shadow, and — inside a
`.stack`, which is every form on this site — the full width of the page. What separated them was
the fill and the type face, and neither was reliable:

- The hard shadow differed only in **direction**. A button's fell outside it; a text box's fell
  inside, at `rgb(0 0 0 / 12%)`. Twelve per cent black is invisible on a page whose background is a
  gradient, which is every page here. So on a real surface the two shadows were one shadow.
- The fill differed only when the button was a primary. A bare `.btn` is paper, and so is an input.

`/shots` was the proof and is the page this ticket was filed about: two selects and a button, all
paper, three white slabs in a column, the whole affordance of the selects resting on a 12px
triangle. `/g/yarn` was the second case — a text box and a way out of the page, one above the
other, told apart only by the fact that one had a placeholder in it.

[#107](https://github.com/moeriki/tinker-lab/issues/107) had already spent half of this problem
before it was picked up. Nothing is full width any more and nothing is uppercase, so a button is
snug to its words and a text box still spans the column, which separates those two on width alone.
What that left is the **select**, which is drawn as an input and is not one.

## Decision

**One rule, two directions, no copy: sunk means you fill it, raised means you press it. A select is
raised.**

- `.input` carries `inset var(--edge-2) var(--edge-2) 0 var(--c-gray)` — the same hard shadow the
  rest of the site uses, said out loud, falling *inside* the box. The paper is cut and this is the
  hole. Grey rather than black because at 4px black reads as a second border and the box gains a
  weight it should not have beside a primary.
- `.btn` is unchanged: `--shadow-1` falling *outside* onto the page, and 3px of travel under a
  thumb. A thing sitting on top of the paper.
- `.input--select` keeps `.input` for the border, the tap target and the serif, then undoes the one
  thing that class asserts. It is snug (`width: auto`), raised (`--shadow-1`), and it presses flat
  like every other pressable thing here. Its arrow is a **slab of ink** down the right edge with the
  triangle knocked out in paper — not a triangle floating in white.

Only the **value** stays serif. A select shows content — a team's name, a jug, a person — where a
button shows a word the site chose. Archivo Black on a guest's own answer would claim it was ours.

## Alternatives

Three treatments were drawn at phone width, on `/shots` and on a form holding a text box *and* a
select, and looked at before this one was picked.

- **The select stays a page-wide sunk input, with the better arrow.** The tab alone fixes *is this
  a control* and leaves *what kind* unanswered: it still reads as somewhere to type. Cheapest, and
  the only one that changes no layout.
- **The select is a third thing — snug, but still sunk.** Truthful (you can neither type in it nor
  press it flat) and it went inert on the page: beside a raised `look` and a raised `submit` it was
  the only control that did nothing when you touched it.
- **Do nothing but deepen the recess.** Genuinely better than today, because the recess alone
  separates a text box from a button. It leaves `/shots` — the page the ticket was about — as two
  white slabs above a snug button.

## Consequences

- **A select sizes itself to its widest option and cannot wrap**, which is what makes snug
  dangerous. `what it answers` on `/shots` holds prompts, and the first shot of this came out
  **454px wide on a 390px phone**.
- **The cap has to be an absolute length**, and the two obvious answers were both tried and both
  measured wrong:
  - `max-width: 100%` does nothing. A percentage is ignored while the browser works out how wide
    the thing *wants* to be, so the widest option grows every ancestor and the page with it; only
    the select ends up bounded, inside a page that has already stretched.
  - `max-width: calc(100vw - 3rem)` fixes `/shots` and then breaks `/kit`, at 406px. `100vw` is the
    initial containing block, which is the thing being stretched, so the cap grows with the
    overflow it exists to prevent. Same shape of trap as the one
    [#102](https://github.com/moeriki/tinker-lab/issues/102) found in the overflow check itself: on
    this site the viewport is not a fixed number.

  `20rem` is 320px — inside the content column of a 390px phone with room to spare, and wider than
  every option on the site except a prompt.
- **`text-overflow: ellipsis` moved from `.filters` onto `.input--select`.** It was written for that
  block because a prompt is a sentence; now every select is capped, so every select can truncate and
  the rule belongs to the component.
- **The two selects on `/shots` are no longer the same width as each other**, because each is as
  wide as its own content demands. That is the design working, not ragged alignment.
- **This lands on the admin.** [#66](https://github.com/moeriki/tinker-lab/issues/66) put admin
  surfaces outside `/kit`'s contract, but `.input` and `.btn` are the same rules there as everywhere,
  so `/admin/controls`' `which team` picker is a snug raised control now whether or not it was
  designed for. Looked at, and it holds.
- **`scripts/screenshot.js`' overflow check is what caught both failures.** Neither was visible in a
  screenshot; both were a number the harness compares on every shot.
