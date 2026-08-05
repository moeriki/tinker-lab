# One Home Assistant webhook URL, with the effect chosen by payload

**Status:** accepted · **Date:** 2026-08-04 · **Ticket:** [Deployment and MM-HANDOFF](https://github.com/moeriki/tinker-lab/issues/13)

## Context

Scanning a treasure-hunt QR code should make lights do something. The site holds no Home
Assistant credentials by design — it POSTs to a URL and MM owns everything past it.

The first implementation took `WEBHOOK_BASE_URL` and appended the hunt step's `webhook` name from
`content/`, producing `<base>/<name>`. For that to reach a real automation, `<name>` had to *be*
the Home Assistant webhook id.

Two facts collide there. A Home Assistant webhook endpoint has **no authentication** — the
research found `requires_auth = False`, so the id is the entire credential. And
**`moeriki/tinker-lab` is a public repository**, while `content/` is version-controlled content.
The scheme required committing the credential to a public repo.

## Decision

**One environment variable, `HA_WEBHOOK_URL`, holding a fully-qualified URL with the id in it:**

```
HA_WEBHOOK_URL=http://homeassistant:8123/api/webhook/<WEBHOOK_ID>
```

The URL is never composed from parts and never reaches the browser. The hunt step's `webhook`
field in `content/` stays a **logical name** (`hall-mirror`, `attic-lamp`) and travels in the
POST body as `node`. MM writes one automation and branches on `{{ trigger.json.get('node') }}`.

Body: `{ team, game, step, node, event: "scan" }`. Timeout 2s, no retries, fire-and-forget off
the render path, all failures logged and swallowed.

**Unset is valid** and means "skip the call" — hunts still play, the lights just stay put.

## Consequences

- The credential lives only in the container's environment. `content/` holds nothing secret, so
  the QR inventory and the hunt designs can be reviewed in public pull requests.
- MM maintains one automation instead of one per node, and adding a hunt node needs no new
  environment variable and no redeploy — only a branch in the automation's YAML.
- A per-node effect requires MM to branch on `node`. If a node is missing from that branch the
  automation still runs and simply does nothing visible — consistent with everything else here
  failing silently.
- The site cannot detect whether the lights fired. Home Assistant answers `200 OK` to an unknown
  id, a disabled automation and a `local_only` rejection alike. Verification is a human looking
  at a lamp, which is why `MM-HANDOFF.md` says *trust the light, not the response*.

## Alternatives considered

**One environment variable per node** (`HA_WEBHOOK_URL_HALL_MIRROR`). Keeps ids out of the repo
too, but every new hunt node becomes a config change and a container restart — during the week
the hunt is still being designed. Rejected as friction exactly where the design is most fluid.

**Keep `<base>/<name>` and make the repo private.** Fixes the leak by removing the audience.
Rejected: the repo is public for good reasons, and a scheme that is only safe because nobody is
looking is not safe.

**Home Assistant REST API with a long-lived token.** A single token grants control of the entire
house for ten years, to a container written in a week for a party. Strictly worse than an
unauthenticated endpoint that can only flash a lamp.
