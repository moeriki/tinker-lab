# The host readouts poll fragments

**Status:** accepted · **Date:** 2026-08-07 · **Ticket:** [HQ says how many teams there are and nothing about how the night is going](https://github.com/moeriki/tinker-lab/issues/94)

## Context

[#79](https://github.com/moeriki/tinker-lab/issues/79) gave `/admin` and the host's `/league` a
`<meta http-equiv="refresh" content="30">`, and chose it over a script on an explicit principle:
client JS on this site is the arrival animation and the hint modal, and *a working surface should
not be the one thing that needs a script to stay current*. That principle is sound and it is why
the site has almost no JavaScript at all.

What it missed is what a whole-page reload does to a **dashboard** specifically. Every thirty
seconds the page flashes, the scroll position is thrown away, and the host is put back at the top.
On a phone lying on a kitchen counter for five hours that does not read as a live readout; it
reads as a page turning over on its own.

#94 then added four more numbers to HQ — a progress percent, two code counts and a half-hour
activity pulse — which makes the reload more frequent in effect, because there is now more on the
page whose whole purpose is to move. Dieter's ask was explicit: *"Scans, league, progress % - all
refresh client-side so it looks real-time!"*

This reopens a **locked constraint on the map**: *"Client JS is for animation and the hint modal
only."* Reopened deliberately, and narrowly.

## Decision

**The two host readouts poll `/admin/live` every ten seconds and swap in server-rendered HTML
fragments. `<meta refresh>` survives as the `<noscript>` fallback.**

Three pieces:

- `liveFragments()` in `src/app.js` returns every self-updating part of a host's screen, keyed by
  the `data-live` attribute marking where it goes. **The page renders itself from this function on
  load, and `/admin/live` returns the same function's output ten seconds later.** There is one
  renderer, not two.
- `public/js/app.js` fetches that JSON and assigns each fragment into its slot. It contains no
  templating whatsoever — it never learns what a percentage is or how a league row is shaped, only
  where things go.
- `layout()` renders the old meta refresh inside `<noscript>`. A browser that runs the poller never
  parses it, so the two can never fight.

**Scope is the two host surfaces and nothing else.** Nothing a guest sees updates itself. The
guest's `/league` is deliberately excluded even though it renders the same board — see
Consequences.

`/admin/live` is behind the same `requireAdmin` as every other admin route, returning the 404 page
rather than a 401 ([ADR-admin-is-a-one-time-secret-url](admin-is-a-one-time-secret-url.md)). That
matters more here than on the pages: an admin page leaks one screen, and this endpoint hands back
the entire league board in a single request, which is exactly what
[#8](https://github.com/moeriki/tinker-lab/issues/8) says no guest sees before the reveal.

## Consequences

- Both halves of #79's reasoning survive. Every number is still rendered on the server, and a phone
  with JavaScript blocked still self-updates — it falls back to precisely the behaviour it had
  before.
- **The ban on forms is not lifted.** A fragment swap would leave an untouched form alone, so
  polling technically permits a form on `/admin`. Nothing has been moved back, because the
  `<noscript>` reload is still a reload and would still eat a half-typed award reason on the one
  phone that most needs it to work.
- **The guest league keeps its expanded `--you` row.** The fragment `/admin/live` returns is built
  with `youId: null`, because a host has no row of their own ([#76](https://github.com/moeriki/tinker-lab/issues/76)).
  Marking the guest's board live would therefore have flattened a guest's own highlighted row into
  the column ten seconds after they found it — a silent regression of the reveal, caused by sharing
  a fragment rather than by anything about polling.
- The client compares against **what it last applied**, not against `slot.innerHTML`. The browser
  re-serialises entities on the way out, so a fragment containing `&middot;` reads back as `·` and
  never compares equal to itself; the obvious guard would have been dead on arrival and every slot
  would have been rebuilt every tick. Found by a walk check, not by reasoning.
- A pocketed phone re-fetches on `visibilitychange`. Locked phones throttle timers, so without it
  waking the screen would show numbers from before it went in the pocket with nothing saying they
  were stale — a problem the meta refresh could not have, and this is what buys the parity back.
- A 404 from the endpoint stops the timer rather than retrying. The admin URL is one-time, so there
  is nothing to retry into; the last good numbers stay on screen.
- `scripts/walk.js` spends **thirteen real seconds** proving the poll fires: it moves the score
  without navigating, waits a tick, and reads the DOM. Every cheaper check — the endpoint serves,
  it renders identically, the page is marked — passes just as happily when the interval never runs,
  and HQ frozen at its opening numbers for five hours looks exactly like a quiet party.

## Alternatives considered

**Keep `<meta refresh>` and just shorten it.** One character of change. Rejected because frequency
was never the complaint — a reload at 10s flashes three times as often as a reload at 30s, and the
scroll position is lost either way. It makes the thing worse rather than better.

**Server-sent events.** A genuine push, no polling interval to pick, and the numbers would move the
instant a scan landed. Rejected as more moving parts than the problem has: it needs a long-lived
connection through whatever Nginx Proxy Manager does on Tower, a reconnect policy, and a way to not
leak a connection per host refresh — against a readout where ten seconds late is indistinguishable
from instant. A `setInterval` and a `fetch` have no failure mode that is not "try again in ten
seconds".

**Return JSON numbers and render them in the browser.** The conventional shape, and smaller over
the wire. Rejected because it is the second renderer: the client would need to know that a percent
has a `%` after it, that scans pluralise, that the pulse says "things", and that a league row is a
rank and a name and a score. Every one of those is already written once on the server, and the copy
in the browser drifts the first time either is edited. Sending rendered HTML is what keeps this
file free of any opinion about how anything looks.

**Poll from the guest's league too.** Rejected on the `--you` row above, and on
[#8](https://github.com/moeriki/tinker-lab/issues/8): the guest board exists only after the reveal,
when nothing is moving anyway.
