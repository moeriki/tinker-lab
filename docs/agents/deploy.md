# Deploying: ask MM, never SSH to Tower

**You do not deploy this site. MM does.** A session that needs the live site updated opens no SSH
connection, touches no `docker` command on Tower, and needs no credential for that box — it sends
**one prompt** to MM and reads the report back.

That is the exact wrong turn this file exists to prevent. Nothing in this repo said where a deploy
happens, so every session that needed one improvised, and the improvisation was always an SSH to
Tower ([#67](https://github.com/moeriki/tinker-lab/issues/67)). `CONTEXT.md` says a deploy *is*
`git pull && docker compose up -d --build` and it is right — it just never said whose hands run it.

**MM is Mega Moeriki, an AI agent running on Tower, not a person.** It owns the server, DNS, Docker
and Home Assistant. It has already been handed [`MM-HANDOFF.md`](../../MM-HANDOFF.md), so a deploy
prompt does not need to re-explain the container — only what you want done this time.

## What is on Tower

Surveyed 6 August 2026 by asking MM, and cross-checked from here where it could be.

| | |
| --- | --- |
| Checkout | `/mnt/user/appdata/bday`, on `main`, working tree clean |
| Remote | `https://github.com/moeriki/tinker-lab.git` — **HTTPS and public**, so pulling needs no key |
| Compose file | `/mnt/user/appdata/bday/docker-compose.yml` |
| Container | `bday`, image `bday-games:local`, `restart: unless-stopped` |
| Published on | `192.168.129.201:3040->3040/tcp` — the LAN address, **not** loopback, per `BIND_ADDR` in `.env` |
| The deploy | `git pull`, then `BUILD_COMMIT=<short sha> docker compose up -d --build` |

There is no registry, no tag and no version number. The image is built on Tower from that checkout,
which is why a deploy is a `git pull` and why the commit has to be handed in by hand.

## Sending a prompt

```sh
script -q /dev/null hermes -z "$(cat prompt.txt)"
```

`hermes` is a Python wrapper on this Mac that `execvp`s
`ssh -t root@tower.tail0dc769.ts.net docker exec -it Hermes hermes <args>`. Both halves of that
line set a trap.

### It needs a TTY

`ssh -t` and `docker exec -it` both demand one, so a plain agent `Bash` call dies with *"the input
device is not a TTY"*. `script -q /dev/null` supplies one. There is no flag that avoids this.

### Anything the shell eats, Tower eats first

The wrapper wraps each argument in **double** quotes before handing it to Tower's login shell, so a
`$`, a backtick or a backslash in your prompt is expanded **on Tower**, in Tower's working
directory, before MM ever sees the text. Write the prompt to a file and check it:

````sh
grep '[$`\\"]' prompt.txt && echo "fix these before sending"
````

**The command you most need to send is the one you cannot paste.** The deploy line in
`docker-compose.yml` is written `BUILD_COMMIT=$(git rev-parse --short HEAD) docker compose up -d
--build`. Send that verbatim and Tower's login shell runs the substitution — in `/root`, not in the
checkout — and MM receives a `BUILD_COMMIT=` that is empty or wrong. Ask for it in prose instead:

> After pulling, read the short sha of HEAD and pass it as the BUILD_COMMIT environment variable to
> the compose build.

Markdown backticks are the other easy way to trip this. Write the prompt in plain prose with no code
fences at all.

### One shot, not a conversation

`--oneshot` (`-z`) takes one prompt, prints the agent's final text, and exits. There is no session to
follow up in, and MM is not to be chatted with. The prompt must be **self-contained**: background,
the exact steps, what to report, what a good result looks like, and what to do on failure.

## The deploy prompt

[`deploy-prompt.txt`](deploy-prompt.txt) is the whole thing, written out and already free of every
character that would expand on Tower. Copy it somewhere writable, put the sha in, and send it:

```sh
sed 's/SHA-GOES-HERE/8d7ca0f/g; 1,3d' docs/agents/deploy-prompt.txt > /tmp/deploy.txt
script -q /dev/null hermes -z "$(cat /tmp/deploy.txt)"
```

It exists as a file rather than as an example in this document because a prompt you edit is a prompt
you can break — and the way you break it is by pasting a shell character into it. Re-run the `grep`
above on your filled-in copy before sending.

### What it has to say, if you write your own

Six things. Miss one and you get a report you cannot act on.

1. **What this is** — one line. The bday party site, the checkout path, that MM-HANDOFF.md covers it.
2. **The commit you want live**, by sha, not "the latest". `main` moves; several sessions land to it.
3. **The steps**: pull, then build and restart with `BUILD_COMMIT` set to the short sha of HEAD.
4. **What to report**: the sha it ended up on, the compose output, the container state, and the JSON
   from `/healthz` on both `127.0.0.1:3040` and the public URL.
5. **What good looks like**: `/healthz` answering `ok: true` with `build` equal to the sha it pulled.
6. **What to do on failure**: paste the error, change nothing else, do not roll back on its own
   initiative. A half-fixed container is worse than a stopped one two hours before a party.

Say plainly at the top whether the prompt is read-only or is allowed to change things. A survey and
a deploy read almost identically otherwise, and MM will act on the ambiguity.

## Verify the deploy yourself

**MM's facts are reliable. Its arithmetic is not.** Take every number it reports as a claim and check
it from here.

Measured on 6 August: asked for a status report, MM ran `git fetch --dry-run`, correctly pasted the
line `fc76918..8d7ca0f main -> origin/main`, and then told us there was **one new commit upstream**.
There were **38**. Everything it had actually *run* was right; the sentence it wrote about the output
was invented. This is the second time — see the earlier deploy where its numbers were right and its
explanation of them was not.

The live site is reachable from any session on the house WiFi
([ADR-the-house-network-is-the-boundary](../adr/the-house-network-is-the-boundary.md)), so the check
costs nothing:

```sh
curl -s https://bday.moeriki.com/healthz
# {"ok":true,"build":"fc76918","games":6,"uptime":82308,"node":"v26.6.0"}

git fetch -q origin
git log --oneline fc76918..origin/main   # what is live vs what is on main
```

`build` is the **only** thing on the site that says which commit is running, and two containers
weeks apart are otherwise indistinguishable. `node scripts/screenshot.js --base
https://bday.moeriki.com /` will photograph the real deploy if you want to see it rather than read
about it — see [`screenshots.md`](screenshots.md).

## What MM is not for

- **Not for DNS or the reverse proxy.** MM owns Route 53 and Nginx Proxy Manager; probe them
  read-only and write findings into `MM-HANDOFF.md` rather than asking for changes.
- **Not for landing code.** You push to `origin/main` yourself from your own worktree
  ([`worktrees.md`](worktrees.md)); MM only pulls what is already there.
- **Not for building images locally.** That is this machine's job and it runs Podman — see
  [`containers.md`](containers.md). Tower runs Docker, which is why `MM-HANDOFF.md` says `docker`
  and is correct to.

## What has actually been verified this way

The channel, on 6 August 2026: a read-only survey went out through `script -q /dev/null hermes -z`,
MM ran every command asked of it on Tower and pasted the output, and its `/healthz` line matched a
`curl` made independently from this machine to the second. It confirmed unprompted that it can run
`git pull` and `docker compose up -d --build` in that checkout on request, and that GitHub is
reachable from it.

**The deploy prompt itself has not been fired yet** — the survey deliberately changed nothing. The
template above is built from a verified channel and a verified inventory, but the first real
`compose up --build` driven this way is still the first one.
