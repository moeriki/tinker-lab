# Screenshots: you can look at this site

**A page is verifiable here, and so is a state.** Two scripts, sharing one Chrome driver in
`scripts/lib/browser.js`:

- `node scripts/screenshot.js` — shoot anything a URL can reach, cold.
- `node scripts/walk.js` — arrive as a team, play, and shoot what is behind the door.

Both boot the server on a free port against a throwaway database, drive headless Chrome, and write
PNGs you can open with the Read tool.

That is the exact wrong conclusion this file exists to prevent: an agent that reached for a browser,
got *"Browser extension is not connected"*, and reported a layout change as **"not seen by eye"**
would be wrong twice — the eyes are here, and the change was one command away from being looked at.

```sh
node scripts/screenshot.js                      # / and /kit, on a phone
node scripts/screenshot.js /kit /no-such-code   # any routes you like
node scripts/screenshot.js --reduced-motion /   # the frozen marquee
node scripts/screenshot.js --dark /welcome     # the PHONE in dark mode, not a dark site
node scripts/screenshot.js --full /kit          # the whole page, not just the fold
node scripts/screenshot.js --out shots /        # somewhere you choose, instead of a temp dir
node scripts/screenshot.js --admin /admin      # as the host, not as a stranger
node scripts/screenshot.js --base https://bday.moeriki.com /   # the real deploy
```

**`--admin` is not optional for an admin route, it is the difference between seeing the page and
seeing a 404.** Every `/admin/*` route answers a stranger with the 404 page rather than a login
(ADR-admin-is-a-one-time-secret-url), so a cold shot of `/admin` returns *there is no rule 4
either* — a real screenshot of the wrong page, which is exactly the shape of thing a session reads
as the answer. The flag visits `/admin/key/<secret>` first, the way a host does. Added by
[#79](https://github.com/moeriki/tinker-lab/issues/79), which built two admin pages nobody could
look at.

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

## `--dark` shoots the phone, not the site

There is no dark version of this site and there is never going to be one — the map rules a dark
mode out of scope. `--dark` is not a way to look at one. It is the only way to look at **what a
phone does to a site that has not declared a colour scheme**, and both scripts take it.

It sets two overrides, and the interesting one is the second:

- `prefers-color-scheme: dark`, which on its own **changes nothing here** — and that is not the
  flag failing. With no scheme declared the used value is `normal`, and Chrome draws `input`,
  `select` and the file button light under `normal` whatever the phone prefers. Measured: the media
  query reported dark and every control stayed white.
- **Auto Dark Theme** (`Emulation.setAutoDarkModeOverride`), which is Chrome for Android taking an
  undeclared page and *algorithmically inverting it*. This is the one that bites, and off an
  Android phone this override is the only way to see it.

[#89](https://github.com/moeriki/tinker-lab/issues/89) is why the flag exists. Before it, with the
phone dark: headline and body copy white on the light end of the gradient, both onboarding name
fields black boxes, the DO NOT LOSE THIS PHONE stamp brown. The fix is one line — `color-scheme:
only light` on `html` in `app.css` — and **`only` is the whole fix**. Plain `light` says the page
*supports* light, which Auto Dark Theme is happy to hear before inverting it anyway; shot with
`light`, the page was still white-on-lime. So if that line ever gets tidied down to `light`, this
flag is what catches it.

**What it cannot do: iOS.** This is Chrome's algorithm and Chrome's override. Safari has no
equivalent behaviour to emulate, and the declaration is the standard one, but nobody has held a
dark iPhone against this site.

## What it cannot do: be a team. That is `walk.js`

`screenshot.js` holds no cookie and submits no form, so its database is always empty and `/` is
always the arrival page. Everything behind the door — the board, a tile mid-play, a verdict, a
photo coming back as a thumbnail, the three standing colours — needs a state nobody reaches by
browsing.

```sh
node scripts/walk.js                    # every flow, shot as it goes
node scripts/walk.js standings          # one flow by name
node scripts/walk.js --list             # what the flows are
node scripts/walk.js --reduced-motion   # the frozen marquee, on a real board
node scripts/walk.js --dark             # the phone in dark mode, through all nine fields
node scripts/walk.js --out shots
```

It arrives as a stranger, walks both onboarding screens, scans codes, submits answers and
photographs, moves points through `/admin/award` and ends the night — then shoots each of those
states. Six flows: `door`, `scan`, `answer`, `photo`, `standings`, `ending`. Each gets its **own
server and its own database**, so a flow never inherits the teams the flow before it left lying
around.

The standings flow is the one that pays for the rest: it puts three rivals on the board and walks
the viewing team through **podium, chasing and rest**, which is the only way to see all three
standing colours (`#0a7a0a`, `#a35b00`, `#8a0d0d`) — they appear one band at a time and need a
real score to reach.

The `ending` flow reaches the other state nobody can browse to: **01:00**. It presses
`/admin/freeze`, sits in the gap with a frozen board, then presses `/admin/end` — so the two
endings, the locked dashboard and the confirm page are all photographable. It holds both cookies at
once, which is what the hosts actually have on the night.

### It is the E2E suite, and that is deliberately not a separate thing

[#32](https://github.com/moeriki/tinker-lab/issues/32) settled that this repo has no test script
and no CI, because a check nobody runs is worse than none: it looks like enforcement.
[#59](https://github.com/moeriki/tinker-lab/issues/59) found the way out without naming it — make
the check a byproduct of something somebody already wants.

Nobody will run a suite eight days before a party. Everybody wants to see the page. So every flow
both **walks** the state and **shoots** it, and a flow that breaks cannot produce its screenshot:
the run fails, loudly, naming the step. You run it because you want the picture. The regression
check is what you get on the way past. There is still no `test` script, and that is on purpose.

### Why not Playwright

[#65](https://github.com/moeriki/tinker-lab/issues/65) was filed expecting it. Three things, and
the first is measured rather than argued:

- **Its browsers are not cached.** `playwright@1.62.1` pins chromium revision **1234**; this
  machine holds 1194, 1217 and 1228. `playwright install` would pull ~150MB. The ticket's premise
  came from a directory listing that was never checked against the pin.
- **`node_modules` is gitignored and every session takes a fresh worktree.** A devDependency turns
  *you can look at this site* into *you can look, once `pnpm install` succeeds against a registry*.
  That guarantee is the whole of what #64 bought.
- **There is no client JS to drive.** Forms POST and redirect; nothing team-facing is wired to a
  listener. Becoming a team needs a cookie jar, a form submit and a file input — a browser already
  has the first two, and the third is one CDP call (`DOM.setFileInputFiles`).

### One thing that surprised the build

Checking that a redirect carried its `?just=` moment **reads false however well the site works**.
`public/js/app.js` deletes `just` and `hint` on the first animation frame — they are one-shot
signals, so a pull-to-refresh cannot replay an animation. By the time anything can read
`location`, the param is gone by design. Check what the server baked into the HTML instead: the
`anim-unlock` class on the hero, the verdict banner under it.

## Housekeeping it already does

The server, the Chrome, the temp profile and the throwaway database are all torn down on the way
out, including on Ctrl-C. Nothing is written inside the repo, so the checkout stays clean.

One thing it deliberately does **not** do: `pkill -f "node server.js"`. Other sessions run their own
servers in their own worktrees, and a broad pattern kill takes theirs down too. Kill by the pid you
started, never by name.
