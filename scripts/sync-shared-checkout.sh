#!/bin/sh
#
# Make the shared checkout current with origin/main, so a session that reads it
# does not read a tree that is clean and stale. Run from the SessionStart hook in
# .claude/settings.json — see docs/agents/worktrees.md, "Clean is not current".
#
# Always exits 0. SessionStart stdout is added to the session as context, so this
# reports what it did and, when the fast-forward refuses, says so loudly and gets
# out of the way. It never resets, checks out or stashes anything.

set -u

common_dir=$(git rev-parse --path-format=absolute --git-common-dir 2>/dev/null) || exit 0
shared=$(dirname "$common_dir")

branch=$(git -C "$shared" symbolic-ref --short HEAD 2>/dev/null || echo "(detached)")
if [ "$branch" != "main" ]; then
  echo "Shared checkout is on '$branch', not main, so it was NOT made current."
  echo "It may be stale. Do not check it out from under whoever is using it —"
  echo "read through the ref instead: git show origin/main:<path>"
  exit 0
fi

before=$(git -C "$shared" rev-parse main)

if ! fetch_err=$(git -C "$shared" fetch -q origin 2>&1); then
  echo "Shared checkout: git fetch failed, so it may be stale."
  echo "$fetch_err"
  exit 0
fi

if ! merge_err=$(git -C "$shared" merge --ff-only origin/main 2>&1); then
  echo "Shared checkout: fast-forward REFUSED, so it is stale — treat what you"
  echo "read there as out of date."
  echo "$merge_err"
  echo "Do not reset it. Read through the ref instead: git show origin/main:<path>"
  exit 0
fi

after=$(git -C "$shared" rev-parse main)
if [ "$before" = "$after" ]; then
  echo "Shared checkout: already current with origin/main."
else
  moved=$(git -C "$shared" rev-list --count "$before..$after")
  echo "Shared checkout: fast-forwarded $moved commit(s) to origin/main."
fi
