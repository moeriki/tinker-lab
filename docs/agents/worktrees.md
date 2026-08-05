# Session isolation: worktrees

Several agent sessions work the [map](https://github.com/moeriki/tinker-lab/issues/2) at the same
time. Without isolation they share one working tree, and a session finds the repo on someone else's
branch with someone else's half-finished files in it.

This is not hypothetical. On 2026-08-04 the Animation choreography session had `src/app.js`,
`src/render.js`, `content/codes.js` and four new files dirty while another session was landing the
photo subsystem. `git status` in the shared checkout is not a statement about your own work.

**The rule: if your session will write a file in this repo, work in your own worktree.**

## The shared checkout is read-only

`/Users/moeriki/Projects/moeriki/bday-games` is **always on `main` and always clean**. Agents read
there. Agents do not commit, do not `git checkout`, and do not leave files dirty there.

The one write an agent may make is a fast-forward of its `main` — before reading, and again after
landing work. It is safe because git refuses it when it isn't.

A session that only reads code, or only touches the issue tracker, stays in the shared checkout and
needs none of the rest of this document. It still needs the next section.

## Clean is not current

Being on `main` is not the same as being on the latest `main`. The shared checkout's `main` only
moves when somebody moves it, and [Landing on main](#landing-on-main) is
`git push origin HEAD:main` from inside a worktree — that advances the **remote** ref and never
touches the shared checkout's own branch. So it falls behind the moment anyone lands anything, and
drifts further with every ticket after that.

Nothing announces it. `git status` says `nothing to commit, working tree clean`, which is true and
is not the question.

This has already cost a wrong answer. Resolving
[#46](https://github.com/moeriki/tinker-lab/issues/46), `ls content/games/*.js` in the shared
checkout returned 5 while the live site correctly reported 6 — Herd Mentality had landed in
`17286f1` and the checkout had never caught up. That is the worst shape this bug takes: it made a
*correct* deployment look broken, which is precisely the confusion #46 existed to remove.

**So make it current before you read.** First thing in the session, before any `Read`, `Grep` or
`ls`:

```sh
git -C /Users/moeriki/Projects/moeriki/bday-games fetch -q origin
git -C /Users/moeriki/Projects/moeriki/bday-games merge --ff-only origin/main
```

`merge --ff-only` and not `git update-ref refs/heads/main <sha>`, for the reason recorded under
[Landing on main](#landing-on-main): the ref moves, the files don't, and the tree reports every
landed file as deleted.

### If the fast-forward refuses

Another session has left the shared tree dirty or on a branch. It is not yours to reset — read
through the ref instead, which needs no clean tree and no fetch:

```sh
git -C /Users/moeriki/Projects/moeriki/bday-games show origin/main:src/app.js
git -C /Users/moeriki/Projects/moeriki/bday-games ls-tree origin/main content/games/
```

That is the cheaper habit of the two and it is always correct, because **worktrees share one ref
store**: the `git push` that lands work from a worktree updates this repo's
`refs/remotes/origin/main` as a side effect of the push itself, with nobody fetching anything. Of
the 35 recorded updates to that ref as of 2026-08-05, 34 say `update by push`.

It is the fallback rather than the rule for one reason: agents read with file tools, and `Read`,
`Grep` and `Glob` want a path on disk, not a blob. A habit that fights every tool you have is a
habit that lapses. One command that makes the tree honest beats a rule about how to read it.

The fetch above costs about a second and covers the one case the push side effect cannot — a commit
that landed from somewhere other than a worktree of this repo.

## Taking a worktree

The layout is the same however you get it:

| | |
|---|---|
| worktree | `.claude/worktrees/ticket-29-worktree-isolation` |
| branch | `worktree-ticket-29-worktree-isolation` |
| base | `origin/main` (fresh, not the shared checkout's HEAD) |

Three things follow from that layout:

- `.claude/` is gitignored globally, so worktrees never show up as untracked files.
- The branch name carries a `worktree-` prefix. Treat it as the marker that says "an agent session
  owns this branch" — [Sweeping leftovers](#sweeping-leftovers) finds branches by that prefix and
  nothing else, so a branch without it is invisible to cleanup.
- Naming the worktree `ticket-<n>-<slug>` makes ownership mechanical: any `worktree-ticket-<n>-*`
  branch belongs to issue `<n>`, and whether it may still exist is a question with an answer.

Branch from `origin/main`, so `git fetch origin` before you start. Other sessions land work while
you're running.

**How you take it depends on whether your working directory is pinned.** There are two ways, and
picking the wrong one wastes a session discovering it.

### If you are a top-level session: `EnterWorktree`

A session the human is talking to directly owns its own working directory, so the tool can move it:

```
EnterWorktree(name: "ticket-29-worktree-isolation")
```

It creates the worktree, prepends `worktree-` to the branch name for you, and **switches your
session into it** — after this call every relative path and every `git` command already runs in the
worktree. This is the normal case; prefer it whenever it works.

### If you are a subagent: by hand

A subagent launched with a pinned working directory (`Agent` tool sessions, and anything given an
explicit cwd) **cannot use `EnterWorktree` to create one.** It refuses, because creating one would
mutate the parent session's process-wide working directory. `ExitWorktree` will not clean up after
you either — it does not remove a worktree it did not create. This is a property of how you were
launched, not a misconfiguration — do not retry it.

Build the identical layout with plain git instead:

```sh
git -C /Users/moeriki/Projects/moeriki/bday-games worktree add \
  -b worktree-ticket-29-worktree-isolation \
  .claude/worktrees/ticket-29-worktree-isolation \
  origin/main
```

Two things the tool would have done for you, which are now yours to get right:

- **You must type the `worktree-` prefix yourself.** `git worktree add -b ticket-29-…` is accepted
  happily and produces a branch that `git branch --list 'worktree-*'` never returns, so the sweep
  will not find it and nobody will know it is there.
- **Your working directory does not change.** You are still standing in the shared checkout, which
  is exactly the tree you are supposed to be staying out of. Nothing warns you: an `Edit` on a
  relative path, or a bare `git commit`, silently hits the shared checkout instead of your
  worktree — which is the failure this whole document exists to prevent.

So for the rest of the session, address the worktree explicitly and never rely on the ambient
directory:

- File writes: **absolute paths** under `.claude/worktrees/ticket-29-worktree-isolation/`.
- Git: **`git -C <worktree-path>`** on every single call, including `status` and `commit`.

Do not solve this with a `cd` at the top of a command. The shell's working directory is reset
between tool calls, so `cd` holds for that one call and quietly stops applying to the next.

### Either way

Inside your worktree, ordinary git is safe again: commit, rebase, switch branches, run tests that
rewrite `content/`. Nobody else is standing in it.

## Landing on main

No pull requests — see the repo's standing preference. Land by rebasing and pushing, from **inside
your worktree**:

```sh
git fetch origin
git rebase origin/main       # your branch, your worktree — a normal rebase is fine here
<run the checks>
git push origin HEAD:main    # atomic; rejected if someone landed while you worked
```

If you took your worktree by hand, "inside your worktree" means `git -C <worktree-path>` on each of
those lines. Running them from the shared checkout would rebase and push `main` itself.

If the push is rejected, someone else got there first. Rebase again and re-run the checks — the
rejection is the mechanism working, not a problem to force past.

Then bring the shared checkout's `main` up to the same commit:

```sh
git -C /Users/moeriki/Projects/moeriki/bday-games merge --ff-only origin/main
```

**Do not use `git update-ref refs/heads/main <sha>` for this.** It moves the ref without touching
the files on disk, so the shared checkout ends up with a HEAD that disagrees with its own working
tree and every landed file reports as deleted — the mess this whole document exists to prevent.

If `merge --ff-only` fails, another session has left the shared tree dirty or on a branch. Your push
already succeeded, so the work is safe. Say so in your report and leave the tree alone; it is not
yours to reset.

This step is a courtesy and **nobody may rely on it.** Its whole benefit lands on the next session
rather than on yours, which is why it lapses: measured on 2026-08-05, the shared checkout was four
commits behind, and one of those four was landed by a session running *while this very ticket was
being resolved*. That is why [Clean is not current](#clean-is-not-current) puts the same
fast-forward on the reader, who is the one who pays for it being skipped.

## Teardown

**Cleanup is tied to the merge, not to the end of your session.** Once your work is on `main`, tear
down the way you built up.

If you used `EnterWorktree`:

```
ExitWorktree(action: "remove")
git branch -d worktree-ticket-29-worktree-isolation
```

If you took it by hand, `ExitWorktree` is not available to you — remove it with git, from the
shared checkout, since you never left it:

```sh
git -C /Users/moeriki/Projects/moeriki/bday-games \
  worktree remove .claude/worktrees/ticket-29-worktree-isolation
git -C /Users/moeriki/Projects/moeriki/bday-games \
  branch -d worktree-ticket-29-worktree-isolation
```

`git branch -d` (not `-D`) is the safety check: it refuses if the commits aren't reachable from
`main`, which means the landing didn't actually work.

`git worktree remove` also does its own bookkeeping, so **a teardown that used it needs no
`git worktree prune`**. Prune is only for directories that were deleted some other way — see
[Sweeping leftovers](#sweeping-leftovers).

### If the work isn't finished

Leaving a branch behind is allowed **only when an open ticket owns it**. A dangling worktree that
nobody has a reason to look at is not isolation, it's work handed to the human.

So before the session ends, either:

1. **Finish and tear down** — the default. Land it, remove the worktree, delete the branch.
2. **File the follow-up ticket yourself**, then leave both in place. The ticket is a child of the
   map like any other, and its body names the branch and the worktree path so the next session
   resumes exactly where you stopped. Commit the work in progress first — an uncommitted worktree
   survives nothing.

Never option 3, which is to stop and mention the leftovers in your closing message. That is the
same as leaving them.

### Branches that outlive their worktree

`research/*` and `prototype/*` branches are **deliberate artifacts**. The map links to files on
them — `prototype/style-kit` preserves the rejected design variants B and C, the research branches
hold findings that were never meant for `main`. They are not leftovers and they are never swept.

Their *worktrees* are ordinary and get removed like any other. Keep the branch, drop the checkout.

## Sweeping leftovers

A worktree or branch may exist if — and only if — one of these is true:

- a **session is actively working in it right now**
- an **open ticket** names it
- it is a **`research/*` or `prototype/*` branch** the map documents (branch only, not the worktree)

Everything else is a leftover. To find them:

```sh
git worktree list
git branch --list 'worktree-*'
```

For each `worktree-ticket-<n>-*`, check whether issue `<n>` is still open. For each candidate
branch, `git rev-list --count main..<branch>` — a `0` means it never carried a commit and can go
with `git branch -D` without losing anything. Anything with commits on it needs a ticket or a
merge, not a delete.

### Locked worktrees

`EnterWorktree` **locks** the worktrees it creates; hand-made ones are unlocked. `git worktree list`
prints `locked` in the trailing column, and sweeping a locked one refuses:

```
fatal: cannot remove a locked working tree;
use 'remove -f -f' to override or unlock first
```

That is not a stuck worktree, just one whose owner would normally have used
`ExitWorktree(action: "remove")`. Unlock it and remove it as usual:

```sh
git worktree unlock .claude/worktrees/<name>
git worktree remove .claude/worktrees/<name>
```

Prefer that over `remove -f -f`, which also discards uncommitted work in the tree — and a leftover
you are sweeping is exactly where uncommitted work would be hiding.

A `locked` marker is also the clearest signal that a session may still be **standing in it right
now**, so check the ticket before you unlock anything.

### Pruning

`git worktree remove` cleans up after itself. `git worktree prune` is only needed when a directory
went away some other way — deleted by hand, or lost with its parent:

```sh
git worktree prune
```
