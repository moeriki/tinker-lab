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

See `docs/agents/worktrees.md`.

## Agent skills

### Issue tracker

Issues live as GitHub issues on `moeriki/tinker-lab`, managed with the `gh` CLI. **Every `gh` call must be prefixed with `env GH_CONFIG_DIR=/Users/moeriki/.config/gh`** — the ambient config points at a work account that cannot write here. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical triage roles, using the default label strings. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context — one `CONTEXT.md` and one `docs/adr/` at the repo root. See `docs/agents/domain.md`.
