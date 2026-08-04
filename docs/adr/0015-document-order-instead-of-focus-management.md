# ADR-0015: Document order instead of focus management

**Status:** accepted · **Date:** 2026-08-05 · **Ticket:** [Does this site do focus management at all?](https://github.com/moeriki/tinker-lab/issues/31)

## Context

[#30](https://github.com/moeriki/tinker-lab/issues/30) wired the hint modal into the real pages and
left the question behind: `hintModal()` asserted `role="alertdialog"` with `aria-labelledby`, but
nothing moved focus into the box, nothing trapped it while open, and nothing gave it back on close.
The hint modal is the **only** modal this site has, so whatever is decided here is decided once.

The conventional answer — move focus in, trap it, restore it — assumes a dialog opened by script
over a page that stays put. **This one is not that**, and the difference is the whole decision:

- The box arrives on a **full page load**. `POST /g/:id/hint` redirects to `/g/:id?hint=free|paid`
  and the server renders the modal already open. The button that triggered it lived in the
  *previous* document. On arrival `document.activeElement` is `<body>`.
- So there is **no focus to move in** (nothing has any) and **nothing to restore to** (the trigger
  no longer exists). Two of the three jobs of a focus-managed dialog have no referent here.
- It is a **notification, not a confirmation**. The reveal is written, charged and rendered in the
  hint list before the modal exists (CONTEXT.md, "Hint reveal"). Nothing waits for a tap.
- Both its actions are ordinary links, so it announces and dismisses with **JavaScript blocked** —
  and client JS on this site is animation and this modal only.

The third job did have a referent, and it was worth checking rather than assuming. Captured from a
real server, the arrival HTML put the modal last in `<body>`, after `.app`. So the tab order on
arrival was: scorebar → answer input → Submit → close → "What?" → "fine". **Six stops, five of them
behind a dim backdrop**, before reaching the box you were looking at — and a screen reader reading
top to bottom heard the entire game page before the sentence explaining why the page had changed.

That is a real defect, and it is a **document-order** defect, not a focus one.

`role="alertdialog"` was measured against the same reality and failed on every clause. The role
promises focus is placed inside the element on display, that what is behind it is unavailable, and
that the message is urgent enough to interrupt. None of the three is true here. It is also present
in the **initial HTML**, and a live region only announces what changes after the page settles, so
the alert semantics could never have fired even if they had been wanted.

## Decision

**This site does no focus management. It does document order instead.**

- No focus trap, no move-in, no restore, no `autofocus`, no `inert`. Not anywhere, not later.
- `layout()` renders the `modal` slot **first in `<body>`**, ahead of `.app`, so the box you see
  first is the box that reads first and tabs first. It stays *outside* `.app` for the reason it
  always was — `anim-page` animates a transform, and a transformed ancestor becomes the containing
  block for `position: fixed` — and `.modal` carries `z-index: 500`, so it paints above `.app`
  whatever the tree order says.
- The hint modal carries **no ARIA role and no `aria-labelledby`**. It is a titled box of text with
  two links, and its place in the document is what makes it heard.

The point of preferring markup here is not elegance. A focus trap is script, and this modal's whole
design is that it works without any: writing the trap would make the JS-blocked phone the only one
that does not get it. Document order works identically with JS blocked, under
`prefers-reduced-motion`, and on a browser that has never heard of `dialog`.

## Consequences

- The modal is the first tab stop and the first thing read on a hint reveal. Everything behind it
  is still reachable by tabbing on, which is correct for a notice you are allowed to ignore.
- Nothing about the page underneath is made inert, and nothing should be. Tapping the backdrop and
  pressing Escape still close it — enhancements, both, and both still optional.
- **The role came out rather than being tested.** No screen reader was available to the session that
  decided this, and an untested assertion that is wrong on inspection is worth less than no
  assertion. Hearing the arrival on a real phone before the party is
  [#50](https://github.com/moeriki/tinker-lab/issues/50), and it is a human's job.
- If a second modal is ever built, it inherits this: server-rendered, already open, links for
  actions, first in the document. A modal that genuinely gates something would be a new decision
  and would need this ADR revisited rather than quietly ignored.
- `/kit` still opens its copy by hand with a button, so its own marker stays at the end of the
  page. The kit's note says so, and says why the real pages differ.
