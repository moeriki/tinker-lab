# Screenshots: you can look at this site

**A page is verifiable here.** `node scripts/screenshot.js` boots the server on a free port against
a throwaway database, drives headless Chrome, and writes PNGs you can open with the Read tool.

That is the exact wrong conclusion this file exists to prevent: an agent that reached for a browser,
got *"Browser extension is not connected"*, and reported a layout change as **"not seen by eye"**
would be wrong twice — the eyes are here, and the change was one command away from being looked at.

```sh
node scripts/screenshot.js                      # / and /kit, on a phone
node scripts/screenshot.js /kit /no-such-code   # any routes you like
node scripts/screenshot.js --reduced-motion /   # the frozen marquee
node scripts/screenshot.js --full /kit          # the whole page, not just the fold
node scripts/screenshot.js --out shots /        # somewhere you choose, instead of a temp dir
node scripts/screenshot.js --base https://bday.moeriki.com /   # the real deploy
```

It prints the path of every PNG it writes. Nothing is installed, `node_modules` stays empty, and it
needs no human at the keyboard — so it works in a background session and in a parallel worktree.

## Why the Chrome extension is not the answer

The Claude browser extension was never paired to this account, which is why every session that
asked for a browser got the same error. Pairing it helps a session somebody is watching, but it
drives **one shared Chrome, interactively** — and this repo runs several background sessions in
parallel worktrees, which would collide in it. This script has no such problem: its Chrome is
private to the run, and its port is picked from whatever is free.

## Why not `chrome --screenshot`

Because this site is **mobile only** and that flag cannot render a phone.

Chrome clamps its window to a minimum width of roughly 500px, then crops the image to whatever
`--window-size` asked for. So `--window-size=390,844` gives you a 390px-wide **photograph of a
500px-wide layout**: text wraps in the wrong places, the content column never narrows, and every
page looks like it overflows sideways. Measured 2026-08-06 — it nearly had a fictional overflow bug
filed against the arrival page before the crop was spotted.

`Emulation.setDeviceMetricsOverride` over the DevTools protocol sets a **real** 390×844 viewport
with `mobile: true`, so the viewport meta tag applies and the page lays out the way a guest's phone
will lay it out. Node's own `WebSocket` and `fetch` are the entire client; there is no dependency.

Two consequences worth knowing:

- **It measures overflow for you.** Every shot compares `document.documentElement.scrollWidth`
  against `innerWidth` and complains if the page is wider than its viewport. On a mobile-only site
  that is a real defect, and this is the one moment it can be seen.
- **`--full` misplaces sticky things.** Rendering past the fold shows the whole page but puts
  anything `position: sticky` where it would sit at the top, not where a scrolling guest sees it.
- **So use `--scroll <px>` for anything sticky.** A default shot is taken at the top of the page,
  which is the one place a sticky thing is still sitting where it started — so at zero the marquee
  is indistinguishable from an ordinary strip, and `--full` renders from the top too. Neither shows
  the marquee *pinned over content that has scrolled under it*, which is the only view in which it
  can be judged. `--scroll 9999` clamps to the bottom, which is how you check the status bar is the
  last thing on the page.

## What it cannot do

**It cannot become a team.** There is no cookie and no form submission, so everything behind arrival
is out of reach, and the database it shoots is always empty — `/` is the arrival page, never a
board. Walking a hunt, submitting an answer, and seeing a real score need Playwright, which is
[issue #65](https://github.com/moeriki/tinker-lab/issues/65). Until that lands, a state nobody
reaches by browsing is still checked by hand.

## Housekeeping it already does

The server, the Chrome, the temp profile and the throwaway database are all torn down on the way
out, including on Ctrl-C. Nothing is written inside the repo, so the checkout stays clean.

One thing it deliberately does **not** do: `pkill -f "node server.js"`. Other sessions run their own
servers in their own worktrees, and a broad pattern kill takes theirs down too. Kill by the pid you
started, never by name.
