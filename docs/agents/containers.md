# Containers: this machine runs Podman

**There is no `docker` binary on this machine.** `which docker` returns nothing, and every
`docker …` command in this repo will fail with *command not found*.

That is not a broken setup and it does not make container work unverifiable — which is the exact
wrong conclusion this file exists to prevent. An agent that reached for `docker`, found nothing,
and reported a `Dockerfile` change as "unverified, no container runtime available" would be wrong
twice: the runtime is here, and the change was one command away from being proven.

| Instead of | Run |
| --- | --- |
| `docker build` | `podman build` |
| `docker compose …` | `podman-compose …` |
| `docker run` / `ps` / `logs` / `inspect` / `rmi` | `podman …`, identical flags |

`podman machine list` must show the default machine `Currently running`; start it with
`podman machine start` if not. Everything below was run against `podman 6.0.2` on `applehv`.

## `docker compose` in MM-HANDOFF.md is Tower's, not yours

[`MM-HANDOFF.md`](../../MM-HANDOFF.md) is written for Mega Moeriki operating the deployment, and
Tower runs Docker. Those command lines are correct **there** and should not be rewritten to
`podman-compose` — translate them when you run one here, and leave the document alone.

The one behavioural difference between the two runtimes is already documented in MM-HANDOFF § 1
(Podman defaults to the OCI image format, which has no `HEALTHCHECK`, so `podman ps` shows no
health column where `docker ps` would). It is not restated here. If you specifically need to
inspect the probe, `podman build --format docker` preserves it; nothing else about the image
changes, and the deployed container is Docker's anyway.

## Building either flavour

The image takes `NODE_ENV` as a build arg — see the **Dev build** section of
[`CONTEXT.md`](../../CONTEXT.md). Unset builds the real site.

```sh
podman build -t bday-games:check .                                # production
podman build --build-arg NODE_ENV=development -t bday-games:dev . # dev harness
podman run --rm bday-games:check node -e 'console.log(process.env.NODE_ENV)'
```

Flipping flavours on unchanged source is safe: the `RUN echo` that consumes each `ARG` keys the
layer cache on its **value**, so a rebuild cannot cache-hit into the flavour it was first handed.
Verified both directions — production → development → production each produced the right image
while every source layer was still cached.

## Never `podman-compose up` in the shared checkout

`docker-compose.yml` bind-mounts `./data` and publishes port 3040 on the host. Run it in the
shared checkout and you leave a database, a running container and a bound port behind, in a tree
whose whole contract is that readers do not dirty it (see [`worktrees.md`](worktrees.md)).

Run it from **your own worktree**, and clean up after:

```sh
printf 'ADMIN_SECRET=composetest\n' > .env    # env_file is required; .env is gitignored
NODE_ENV=development podman-compose up -d --build
podman-compose down && rm -f .env && rm -rf data
```

Two things to know before you do:

- **It retags `bday-games:local`**, which is the tag a plain `podman-compose up` starts from. Build
  the dev flavour and walk away and you have left a dev image under the name someone else will
  reasonably assume is the site. Finish on a production build, or rebuild the tag before you stop.
- Port 3040 is fixed in the compose file (only the bind *address* is configurable), so check it is
  free first. A `podman-compose up` that loses the race fails on the port, not on your change.

## What has actually been verified this way

Both flavours build, run, and behave: the dev image serves the board at `/` with no cookies, all
tiles unlocked and `/dev/logout` live, and announces `DEV BUILD` in its logs; the production image
bounces `/` to `/welcome`, 404s both `/dev/*` routes, says nothing about a dev build, and answers
`/healthz`. The same split holds through `podman-compose`, with the arg defaulting to production
when `NODE_ENV` is unset in the environment.
