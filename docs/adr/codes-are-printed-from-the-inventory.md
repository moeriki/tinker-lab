# Codes are printed from the inventory, by a script that decodes what it prints

**Status:** accepted · **Date:** 2026-08-04 · **Ticket:** [QR inventory and generator script](https://github.com/moeriki/tinker-lab/issues/12)

## Context

Nineteen codes get printed **on the day of the party** and taped around a house. By then the
script has to be boring: no install, no network, no surprises, and a rerun that costs nothing.

Two facts pull against each other. The **inventory is settleable now** — the roster (#7) fixed
which codes exist and what each points at. The **content behind six of them is not** — the lights
hunt, the riddle hunt, the Triangle Test and the gag pages are open tickets. A slug must be
printable before the game behind it is written, or the printing waits on the slowest game.

## Decision

**`content/codes.js` is the only source of truth for which codes exist**, and
`scripts/qr-sheet.js` reads exactly that file to emit one self-contained A4 HTML sheet.

Four things follow.

**The QR encoder is `qrcode-generator`; the decoder is written in this repo**
(`scripts/qr-encode.js`, byte mode, versions 1–10, all four correction levels).

This originally read *the encoder is written in this repo*, and gave the reason: printing happens
on the morning of the party, and `pnpm install` that morning means a lockfile, a registry, a
network and a package manager all working on the one day they must not be a question.
[#102](https://github.com/moeriki/tinker-lab/issues/102) overturned it. Libraries handle edge
cases better than we do, and this one is zero-dependency, so what the printed card depends on is
one package deep. The offline guarantee survives in a weaker form — the packages are in the
lockfile and the pnpm store, and `--frozen-lockfile` needs no network once they have been fetched
even once — and the swap paid for itself immediately, below.

**The encoder is trusted because it is decoded, not because it is short.** `--selftest` encodes
and decodes 98 symbols — every payload in the inventory, plus a full sweep of every version and
level — back through the spec: format bits, mask, zigzag, de-interleave, Reed-Solomon syndromes,
payload. It corrects nothing, so a single wrong module fails it.

**And that check only became real when the encoder left.** While both halves were written here
they read the same tables, so a wrong table produced a symbol that decoded perfectly against the
same wrong number — the sweep could not catch the one thing it was built to catch. Version 8 at
level H said five blocks where the spec says six, from the day the file was written until #102
swapped the encoder and the decoder could no longer read it. The inventory prints at version 4, so
no card was ever affected. The lesson is the general one: a self-test is only a test where the two
sides are independent.

**A code may point at content that does not exist yet, if it says so.** `pending: true` in the
inventory turns a dangling target from a boot error into a loud boot warning; scanning one shows
a placeholder naming the ticket that owes the content. **Without the flag it is still fatal**, so
a typo in a game id has not become survivable. The flag is a promise with a deadline attached:
`node scripts/qr-sheet.js --check` **exits non-zero while any pending flag survives**, so the
tolerance can never reach paper.

**Slugs are minted once and frozen.** Nothing in the generator is random or timestamped, so the
same inventory produces the same sheet forever, and `--only=<slug>` reprints a single lost card
without touching the other eighteen.

### The numbers

**Level H (30%)**, symbol **49.9mm**, module **1.51mm**, quiet zone 4 modules, six cards to an A4
sheet. A 33-byte URL at level H is a version-4 symbol, 33×33 modules; with the quiet zone that is
41 spans across a 62mm box.

H over M costs one version step — 2mm of module size on the same card — and buys damage tolerance
on paper that gets folded, taped and handled by twenty-five people holding drinks. Measured with
an independent decoder (Apple's `CIDetector`), a version-4 H symbol still reads with a contiguous
blot covering **20% of its area**. Rendered to PDF and rasterised, all nineteen decode down to
**~4 pixels per module**; a 12MP phone at arm's length gives roughly nine.

### What is on the card

Every card front is **identical apart from the number, the slug and a stripe colour**. It carries
the site name, `#07`, the slug in small type, and "point your camera". It does **not** say what
the code opens.

That is the gag decision, and it is uniform on purpose: a rickroll that announces itself isn't a
rickroll, and if only the gags were unlabelled then *unlabelled* would be the label. The mapping
lives on a **host key sheet** printed last and never cut.

## Consequences

- The print pipeline is one command, offline, on any Node 22+: `node scripts/qr-sheet.js`.
- Every game ticket that lands must **delete its `pending: true`** in the same commit. Boot warns
  when the flag is stale, and the printer keeps refusing until it goes.
- Renumbering: the card number is the position in `content/codes.js`. New codes go at the **end**.
- Scanning an unknown slug is a dead end with a 404 and a page that says so, not a search.
- The sheet is HTML printed by a browser, so page geometry depends on printing at **100% scale**.
  The key sheet says so.

## Alternatives considered

**A devDependency (`qrcode`, `qrcode-generator`).** Slips past the build guard legitimately, and
still fails the actual requirement: trustworthy on the day, from a bare checkout, with no network.

**Emitting a PDF.** A PDF writer is either a dependency or a hand-rolled font embedder, and the
browser we would open the PDF in to check it is the same browser that prints the HTML.

**Labelling every card with its game, and leaving the gags blank.** Rejected: the blank ones
become the interesting ones, which is worse than labelling everything.

**Holding the inventory back until every game exists.** Rejected: it makes the slowest game
ticket block the print, and the slugs were never the uncertain part.

**Keeping a separate print-time inventory so `content/codes.js` could stay strict.** Rejected —
two files listing slugs is exactly how a printed card ends up pointing nowhere.
