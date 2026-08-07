# The local test env: a dev build that is always up

**<http://bday.localhost:8080> is this site, running from the shared checkout, in dev mode, right
now.** It is not a deploy and it is not something you start — [pitchfork](https://github.com/jdx/pitchfork)
supervises it, `pitchfork.toml` in the repo root configures it, and the shell activation in
`~/.config/fish/config.fish` starts it again the moment anyone `cd`s in here.

Before this there was one place to look at a change — `bday.moeriki.com`, after MM had built and
deployed it. That is a long loop for a wording fix.

| | |
| --- | --- |
| URL | <http://bday.localhost:8080> (the proxy) or <http://localhost:3041> (direct) |
| Daemon id | `bday/dev` |
| Runs | `pnpm dev` — `NODE_ENV=development node --watch server.js` |
| Database | `data/` in whatever directory it was started from, and it persists |

```sh
pf ls                  # pitchfork ls: is it up, and on which port
pf logs bday/dev       # the server's stdout, including the DEV BUILD banner and content warnings
pf logs -t bday/dev    # ...following
pf restart bday/dev
pf stop bday/dev
```

## What "dev mode" gets you

Everything in [`src/dev.js`](../../src/dev.js): you arrive already logged in as **TEST TEAM** with
every tile unlocked, `/dev/logout` to walk real onboarding, and the admin board one tap away —
`/admin/key/change-me`, because `ADMIN_SECRET` is unset here and the daemon says so at boot. None
of those routes exist in a production build.

The database persists across restarts, which is the difference between this and the screenshot
scripts. Points you scored yesterday are still on the board. To start clean:

```sh
rm -rf data && pf restart bday/dev
```

## It restarts itself, mostly

`node --watch` reloads on any file the process imported — all of `src/`, and all of `content/` too,
because content is loaded with `import()` rather than read as data. So a copy change is live by the
time you have switched to the browser tab.

What it does **not** see: `public/` is served from disk, so CSS and images need no restart at all;
`pnpm-lock.yaml` is watched by pitchfork itself, which restarts the daemon outright; and a change
to `pitchfork.toml` needs `pf restart bday/dev` to be picked up.

## Pointing it at your branch

There is one `bday/dev` for the whole machine — the id is global, so `pitchfork start dev` from a
second directory answers *already running, use --force* rather than starting a second copy. Started
from a worktree, it serves that worktree, database and all.

```sh
cd .claude/worktrees/ticket-N-slug && pf start dev -f   # the local test env is now your branch
cd /Users/moeriki/Projects/moeriki/bday-games && pf start dev -f   # ...and back to main
```

Do that only while you are watching it. Leaving it pointed at a worktree means the next person to
open <http://bday.localhost:8080> is looking at your half-finished branch and has no reason to
suspect it — `pf ls` shows the daemon, not the directory. Put it back on the shared checkout when
you are done, and remember that removing a worktree out from under a running daemon leaves it
restarting into a directory that is not there.

For an agent in a background session, the screenshot scripts are almost always the better tool
anyway: they are isolated, disposable, and do not steal a shared daemon. See
[`screenshots.md`](screenshots.md). The rule of thumb —

- **`node scripts/screenshot.js`** — a page, cold, in a throwaway database. Verifying a change.
- **`node scripts/walk.js`** — arriving as a team and playing. Verifying a flow.
- **this daemon** — a browser tab a human keeps open, with yesterday's state still in it.

## Ports, and why not 3040

The daemon takes **3041**. `docker-compose.yml` publishes **3040** on the host and cannot be told
otherwise, so a permanent 3040 daemon would fail every container check made from a worktree (see
[`containers.md`](containers.md)) in exchange for matching the default in `src/config.js`. Nothing
reads that default here: pitchfork exports `PORT` explicitly.

If 3041 is busy when the daemon starts, `bump` moves it to the next free port and the proxy follows
it. Trust `pf ls` over this document for the number.

## Making it survive a reboot

The supervisor currently starts when a shell activates pitchfork, which in practice means "when a
terminal is opened". To have launchd start it at login instead:

```sh
pitchfork boot enable    # ~/Library/LaunchAgents/pitchfork.plist; `pitchfork boot disable` undoes it
```

That is a machine-wide setting affecting every pitchfork daemon on this laptop, not just this one,
which is why it is written here rather than done.

## The proxy slug

`bday.localhost` is registered in `~/.config/pitchfork/config.toml` — global config, not this repo,
so a fresh clone has the daemon but not the pretty URL:

```sh
pitchfork proxy add bday --dir /Users/moeriki/Projects/moeriki/bday-games --daemon dev
pitchfork proxy status
```

The slug maps to a **directory and a daemon name**, and resolves to whatever port that daemon is
actually on. It does not pin the daemon to that directory — see *Pointing it at your branch*.
