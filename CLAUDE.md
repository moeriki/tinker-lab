# CLAUDE.md

## Session isolation — read this first

Several sessions work this repo at once. **If your session will write a file here, take your own
worktree first** — `EnterWorktree(name: "ticket-<n>-<slug>")`, named after the ticket you claimed.

**Subagents cannot do that.** With a pinned working directory `EnterWorktree` refuses, so build the
same layout by hand and then address it explicitly — `git -C <worktree>` and absolute paths, because
your working directory stays in the shared checkout and nothing warns you when a write lands there:

```sh
git -C /Users/moeriki/Projects/moeriki/bday-games worktree add \
  -b worktree-ticket-<n>-<slug> .claude/worktrees/ticket-<n>-<slug> origin/main
```

The shared checkout at `/Users/moeriki/Projects/moeriki/bday-games` is always on `main` and always
clean; agents read there and never commit, check out, or leave files dirty in it. Land work by
rebasing onto `origin/main` and pushing — **no pull requests** — then remove the worktree and delete
the branch. A branch may only outlive your session if an open ticket names it, and filing that
ticket is your job, not the human's.

**Clean is not current.** Landing pushes a ref and never touches the shared checkout's own `main`,
so it falls behind the moment anyone lands anything and says nothing about it. A `SessionStart` hook
now fast-forwards it for you and prints one line saying what it did — `Shared checkout: already
current` or `fast-forwarded N commit(s)`.

**That line is the receipt: if you don't see it, the hook didn't run**, the tree may be stale, and
you should run it yourself before reading:

```sh
git -C /Users/moeriki/Projects/moeriki/bday-games fetch -q origin
git -C /Users/moeriki/Projects/moeriki/bday-games merge --ff-only origin/main
```

That fast-forward is the one write a reader may make. If it refuses — the hook will say so — the
tree is dirty or on a branch; don't reset it, read through the ref instead
(`git show origin/main:<path>`).

See `docs/agents/worktrees.md`.

## Agent skills

### Issue tracker

Issues live as GitHub issues on `moeriki/tinker-lab`, managed with the `gh` CLI. **Every `gh` call must be prefixed with `env GH_CONFIG_DIR=/Users/moeriki/.config/gh`** — the ambient config points at a work account that cannot write here. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical triage roles, using the default label strings. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context — one `CONTEXT.md` and one `docs/adr/` at the repo root. See `docs/agents/domain.md`.

### Screenshots

**You can look at this site, including from inside a team.** Both scripts boot the server against a
throwaway database and write phone-sized PNGs you can Read — no dependency, no browser extension,
safe in a background session and in parallel worktrees.

- `node scripts/screenshot.js` — any route a URL can reach, cold.
- `node scripts/walk.js` — arrives as a team: walks onboarding, scans, submits an answer and a real
  phone photograph, and puts a real score on the board so the three standing colours can be seen.
  It is also the E2E suite: **this is what proves a page or a flow works.**

A page **and a state** are verifiable here, so **never report a change as "not seen by eye"** for
want of a way to look at it. See `docs/agents/screenshots.md`.

### Tests

`pnpm test` (`node --test`) is deliberately small and is **not** where pages are checked — that is
`walk.js`, above. It covers only what the walk cannot reach: pure functions on bytes, where a
wrong answer is silent rather than a broken screenshot. Sniffing, EXIF thumbnails, content types,
and the QR round-trip over the whole printed inventory.

It exists because those paths had no coverage at all and one of them had **never once executed**
(#102). Fixtures live in `test/fixtures/` with their regeneration recipe in `test/photos.test.js`.
The tests characterise *behaviour, not implementation*, because the code underneath is being
replaced by libraries — an assertion that has to change during a swap is a swap that changed the
site.

### The local dev server

**A dev build of this site is always up at <http://bday.localhost:8080>**, supervised by pitchfork,
running `pnpm dev` from the shared checkout on port 3041 with a database that persists. `pf ls`,
`pf logs bday/dev`, `pf restart bday/dev`.

Its `pitchfork.toml` is gitignored and belongs to the shared checkout alone — **never copy it into
a worktree**, because two configs claiming one namespace make every `pitchfork` command fail from
in there. To look at your branch, use the screenshot scripts, or `PORT=3042 pnpm dev`. See
`docs/agents/dev-server.md`.

### Containers

**This machine runs Podman; there is no `docker` binary.** Use `podman` and `podman-compose` — a container change is verifiable here, so never report one as unproven for want of a runtime. The `docker compose` lines in `MM-HANDOFF.md` are Tower's and stay as they are. See `docs/agents/containers.md`.

### Deploys

**You never SSH to Tower, and you never deploy this site yourself. MM does.** MM is an AI agent
on Tower with GitHub access; it pulls the public repo, builds the container and reports back. You
reach it with **one self-contained prompt**:

```sh
script -q /dev/null hermes -z "$(cat /tmp/deploy.txt)"
```

`docs/agents/deploy-prompt.txt` is that prompt, ready to fill a sha into. Two traps: it needs a TTY
(hence `script`), and any `$`, backtick or backslash in the prompt expands **on Tower** before MM
sees it — so the `BUILD_COMMIT=$(…)` line from `docker-compose.yml` is the one thing you must never
paste. **Check MM's numbers**: its facts are right and its arithmetic is invented. See
`docs/agents/deploy.md`.
