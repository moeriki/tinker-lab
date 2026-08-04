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

The one write an agent may make is a fast-forward of `main` after landing work — see
[Landing on main](#landing-on-main). It is safe because git refuses it when it isn't.

A session that only reads code, or only touches the issue tracker, stays in the shared checkout and
needs none of this.

## Taking a worktree

Use the `EnterWorktree` tool, named after the ticket you claimed:

```
EnterWorktree(name: "ticket-29-worktree-isolation")
```

That gives you:

| | |
|---|---|
| worktree | `.claude/worktrees/ticket-29-worktree-isolation` |
| branch | `worktree-ticket-29-worktree-isolation` |
| base | `origin/main` (fresh, not the shared checkout's HEAD) |

Three things follow from that layout:

- `.claude/` is gitignored globally, so worktrees never show up as untracked files.
- The tool prepends `worktree-` to the branch name. You cannot turn that off — treat it as the
  marker that says "an agent session owns this branch".
- Naming the worktree `ticket-<n>-<slug>` makes ownership mechanical: any `worktree-ticket-<n>-*`
  branch belongs to issue `<n>`, and whether it may still exist is a question with an answer.

Branch from `origin/main`, so `git fetch origin` before you start. Other sessions land work while
you're running.

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

## Teardown

**Cleanup is tied to the merge, not to the end of your session.** Once your work is on `main`:

```
ExitWorktree(action: "remove")
git branch -d worktree-ticket-29-worktree-isolation
```

`git branch -d` (not `-D`) is the safety check: it refuses if the commits aren't reachable from
`main`, which means the landing didn't actually work.

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

Prune the worktree bookkeeping after removing directories by hand:

```sh
git worktree prune
```
