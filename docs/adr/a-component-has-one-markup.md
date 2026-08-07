# A component's markup exists in exactly one place

**Status:** accepted · **Date:** 2026-08-05 · **Ticket:** [Is /kit a static document allowed to drift, or does it render from the app?](https://github.com/moeriki/tinker-lab/issues/32)

## Context

`/kit` is the style kit, settled in [#5](https://github.com/moeriki/tinker-lab/issues/5): every
primitive on the site, on one page, with a footer claiming that a page needing something absent
from it is either wrong or evidence the kit is incomplete.

[#30](https://github.com/moeriki/tinker-lab/issues/30) built the hint modal for real and left a
second copy behind in `public/kit.html`, which is what raised the question. It was never only
about the modal: every tile, hero, field and scorebar on that page was duplicated markup too.

**The styles were never the problem.** `public/css/app.css` is linked by the kit and by every page
`layout()` renders, so appearance is physically shared and cannot drift. What was written twice is
the *markup* — which elements wear those classes — once by hand in `kit.html` and once by hand in
`src/`. Four had already come apart in three weeks:

| | kit | app |
| --- | --- | --- |
| scorebar | `<div>`, no open-count | `<a href="/">` with `scorebar__open` ([#9](https://github.com/moeriki/tinker-lab/issues/9)) |
| tile | `tile__lock` / `tile__flag` badges | neither emitted, though both are styled |
| hero | text inside `hero__body` | text bare inside `.hero` |
| field | `<div>` + `<label for>` | `<label>` wrapping the input |

Two of those were the *app* lagging the kit, not the kit rotting: `.tile__lock`, `.tile__flag`,
`.tile--wrong .tile__flag` and `.hero__body` are all fully styled in `app.css` and were emitted by
nothing. Every hero on the site was rendering in the inherited font rather than the designed one —
invisible in the code, obvious on a phone.

Three options were weighed. **Let it drift**, disclosing each divergence with a pointer to the
owning function, was nearly free but leaves a page whose whole value is being believed. **Delete
the demos** and point at the code removes the lie but takes roughly half the visual reference with
it, including the parts most worth looking at. **Render the kit from the app** was initially
priced as a refactor of every page — until it turned out that so little is built that `tile`,
`hero` and `field` have one to three call sites each, and that extracting them *before* the
per-game tickets land is cheaper than after, since otherwise each of those tickets invents its own
field markup.

Detection was considered and is not available: there is no test suite, no `test` script and no CI,
so a drift check would be a file nobody ever runs — enforcement in appearance only.

> Amended by [#102](https://github.com/moeriki/tinker-lab/issues/102): a `test` script now exists.
> It does not change this decision. The suite covers pure functions on bytes — sniffing, EXIF,
> content types, QR — and deliberately touches no markup and no CSS, so there is still nothing
> here that a drift check could hang off. The reasoning above stands as written.

## Decision

**A component's markup exists in exactly one place.**

- Where the app renders it, that place is a function in `src/render.js`, and `/kit` calls that
  function through a marker comment which `src/kit.js` swaps for the real output at request time:
  `@scorebar name="BADGER" score="47" open="2" total="10"`, written as an HTML comment.
- Where the app does **not** render it yet, that place is `kit.html`, and the kit is its only
  home. This is not drift; it is design the site still owes. Which sections those are is not
  listed here on purpose: the list shrinks every time a page is built, so an inventory in a
  decision record goes stale without anyone noticing — it already had, naming the window frame
  (#37) and the speech bubble (#53) long after both were built. The live list is the kit's own
  footer, which is by construction exactly the sections `kit.html` still writes by hand.
- **That "by construction" was aspirational until [#55](https://github.com/moeriki/tinker-lab/issues/55).**
  The footer was itself typed by hand, so it could be — and was — wrong about the page it sits on.
  Each hand-written demo now carries an `@owed` marker rendering a **STILL OWED** badge, `src/kit.js`
  counts them, and both halves of the footer sentence are generated: what the app builds from
  `injectable`, what it still owes from the badges. Deleting a copy of a list is not the same as
  removing the reason a copy exists.
- **New design is drawn on the kit first, then built into a page** — the direction this rule
  assumes but never stated.
- Building one of those into a page means **moving** its markup into `render.js` and leaving a
  marker behind **in the same change**, so a second copy is never created.

The kit keeps every section, every demo variant and every joke: a marker takes parameters, so five
tile states are five markers.

Where both sides already built the same component differently, the app's shape wins on merit
rather than seniority. For fields that means the label **wraps** the control instead of pointing at
it with `for` — there is no id to keep in sync, which is the one way that markup breaks silently,
and it breaks by labelling the wrong box.

## Consequences

- `/kit` cannot show a component the site does not render. Its remaining hand-written sections are
  now a **visible list of what the app still owes the design**, which is a job it could not do
  while everything on it was hand-written and indistinguishable.
- The app picked up `tile__lock` / `tile__flag` and `hero__body`, so tiles gained their badges and
  the kit's pts copy (`go find it`, `not played`, `+10 pts`) and heroes gained their designed type.
- `inject()` renders a loud banner for an unknown marker name rather than nothing, because a
  marker that silently vanished would look exactly like a section somebody deleted.
- Markers cannot be shown by example inside an HTML comment: a marker carries its own `-->`, which
  would close the comment and then be injected into the page.
- A component gaining a parameter now changes the kit too, which is the point. The cost is that a
  demo is no longer editable purely in HTML — a new variant may need the function to accept it.
- **Not enforced by a test**, because there is nowhere for one to run. It is enforced by there
  being nothing to keep in sync — which, after #55, is true of the inventory as well as the markup.
- An `@owed` marker without a `name` renders the same loud banner as an unknown primitive. A badge
  the footer could not count would let the page claim a debt its own summary denies.
