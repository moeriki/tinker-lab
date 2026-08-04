# MM-HANDOFF

Hello MM. This is the deployment brief for **bday.moeriki.com**, a QR-code party game that has to
be working on **Friday 14 August, 20:00**. Guests scan QR codes hidden around the house, teams
answer questions on their phones, and the host runs the night from a hidden admin page.

Source: <https://github.com/moeriki/tinker-lab> (public). Everything below refers to that
checkout.

You own the server, DNS, Docker and Home Assistant. This document is what you need from us, and
what we need from you. There is an **analysis request at the bottom** — that part is not
instructions, it's us asking for your read on things we could not determine from outside.

---

## What you are deploying

A single Node.js container. No database server, no Redis, no build step, **no runtime
dependencies at all** — the entire `node_modules` is empty, on purpose. It is server-rendered
HTML with plain form POSTs.

| | |
| --- | --- |
| Runtime | Node 26 (`node:26-alpine`) |
| Storage | SQLite in a bind-mounted directory |
| Listens on | `3040` inside the container |
| Public URL | `https://bday.moeriki.com` |
| Talks out to | Home Assistant, once per treasure-hunt scan. Optional. |
| Expected load | ~15 phones, one evening. Trivial. |

---

## Four things that fail silently

Please read this section even if you skip the rest. Each of these leaves the site looking
completely fine while being broken, and each has bitten someone before.

### 1. Bind-mount the **directory**, never the `.sqlite` file

```yaml
volumes:
  - ./data:/data        # ✅  correct
# - ./data/bday.sqlite:/data/bday.sqlite   # ❌  destroys the database
```

The database runs in WAL mode, so it is really *three* files — `bday.sqlite`,
`bday.sqlite-wal`, `bday.sqlite-shm`. Mounting only the main file means SQLite writes its WAL
into the container's ephemeral layer. It works perfectly all evening and then loses everything on
restart.

### 2. HTTPS is mandatory, not a nicety

The app sets `Secure` on its cookies when `NODE_ENV=production`, which the image sets by default.
**Over plain HTTP the browser silently discards the team cookie**, so every guest gets sent back
to the onboarding page forever and nobody can play. There is no error message. If you want to
test over plain HTTP, run it with `NODE_ENV=` explicitly empty, and never do that in production.

### 3. Home Assistant answers `200 OK` when it has failed

An unknown webhook id, a disabled automation and a rejected non-local request all return
`200 OK`. This is deliberate anti-enumeration behaviour on HA's part. **The status code proves
nothing — trust the lamp, not the response.** The one reliable probe is in
[§ Wiring the treasure-hunt lights](#wiring-the-treasure-hunt-lights) step 4.

### 4. `cp bday.sqlite` is not a backup

We measured this. With one team registered and the write still in the WAL:

| Method | Result |
| --- | --- |
| `cp bday.sqlite backup.sqlite` | `Error: no such table: teams` — the copy did not even contain the schema |
| `node scripts/backup.js` | `teams=1, members=2`, `PRAGMA integrity_check` → `ok` |

Use the script. See [§ Backups](#backups).

---

## Deploying it

### Prerequisites

- Docker with the Compose plugin.
- A DNS A/AAAA record for `bday.moeriki.com` pointing at this host.
- A reverse proxy that can terminate TLS. If you already run one, use it — we have no preference.

### 1. Get the code

```bash
git clone https://github.com/moeriki/tinker-lab.git bday
cd bday
```

There is no registry and no published image. `docker compose` builds from this checkout, so
shipping a fix is `git pull && docker compose up -d --build`.

### 2. Configure

```bash
cp .env.example .env
```

| Variable | Required | Notes |
| --- | --- | --- |
| `ADMIN_SECRET` | **yes** | The host visits `/admin/key/<this>` once to claim the admin cookie. Generate it: `openssl rand -hex 24`. Anyone holding it can end the game and rewrite scores. |
| `HA_WEBHOOK_URL` | no | One fully-qualified HA webhook URL, id included. Unset is valid — the hunt still works, the lights just stay put. See below. |
| `PORT` | no | Defaults to `3040`. |
| `DATA_DIR` | no | Defaults to `/data`. Leave it. |
| `TZ` | no | Defaults to `Europe/Brussels`. Game-end timestamps and log lines both use it. |

If `ADMIN_SECRET` is unset the container still starts, but prints a loud warning at boot and the
admin URL becomes `/admin/key/change-me`. Check the logs after first start.

### 3. Create the data directory with the right owner

The container runs as the unprivileged `node` user, **uid 1000**. A bind mount owned by root
means the app cannot create its own database and crashes on boot.

```bash
mkdir -p data
sudo chown -R 1000:1000 data
```

### 4. Start it

```bash
docker compose up -d --build
docker compose logs -f bday
```

A healthy first boot looks like:

```
migrated → 1 (001-init.sql)
bday → http://localhost:3040
kit  → http://localhost:3040/kit
```

The `migrated →` line appears only when there is schema work to do; on later restarts it is
absent and that is correct.

### 5. Put it behind TLS

The container binds `127.0.0.1:3040` on the host. Point your proxy at that.

Caddy:

```
bday.moeriki.com {
    reverse_proxy 127.0.0.1:3040
    request_body {
        max_size 25MB
    }
}
```

nginx:

```nginx
server {
    server_name bday.moeriki.com;
    client_max_body_size 25M;

    location / {
        proxy_pass http://127.0.0.1:3040;
        proxy_set_header Host              $host;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

**The body-size limit matters.** Guests upload photos from their phones as part of the games, and
a modern phone photo is comfortably over the 1 MB nginx default. An upload rejected by the proxy
looks like a broken game to the guest. 25 MB is a sane ceiling.

No WebSocket support is needed — the admin page polls over ordinary requests.

### 6. Verify

```bash
curl -s https://bday.moeriki.com/healthz
# {"ok":true,"games":8,"uptime":42,"node":"v26.6.0"}
```

`/healthz` touches the database on purpose: a process that is listening but cannot read its own
file is not healthy. It reports `503` if the database is unreachable. It deliberately exposes
nothing about teams or scores — it is the only route reachable without a cookie.

Then, in a browser:

| URL | Expected |
| --- | --- |
| `https://bday.moeriki.com/` | Redirects to `/welcome` |
| `https://bday.moeriki.com/welcome` | The onboarding page, in full MS-Paint glory |
| `https://bday.moeriki.com/kit` | The style kit — proves CSS and fonts are being served |
| `https://bday.moeriki.com/admin` | **A plain 404.** Not a login page. This is correct — see ADR-0005 |

Please **do not** visit `/admin/key/<secret>` yourself unless you're debugging; it sets the admin
cookie on whatever browser you use. That URL is the host's, for the start of the night.

---

## Wiring the treasure-hunt lights

The party site does not have Home Assistant credentials and never will. It knows exactly one
thing: a URL to POST to, supplied as `HA_WEBHOOK_URL`. You own everything past that.

**If you skip this whole section the party still works** — the treasure hunt runs, the lights
just don't fire.

Full research, with sources and the reasoning behind every claim here, is on the
`research/home-assistant-webhooks` branch at
[`docs/research/home-assistant-webhooks.md`](https://github.com/moeriki/tinker-lab/blob/research/home-assistant-webhooks/docs/research/home-assistant-webhooks.md).

### 1. Generate a webhook id

Long and unguessable — HA does not authenticate this endpoint, so the id is the entire
credential. This is also why it lives in `.env` and never in the repository, which is public.

```bash
openssl rand -hex 32
```

Referred to below as `<WEBHOOK_ID>`.

### 2. Create one automation

We send **one** webhook for every hunt scan and put the hunt node's name in the payload, so you
need one automation that branches on `node` rather than one per node. Adding a hunt node then
costs you a YAML branch and costs us nothing.

```yaml
- id: bday_hunt_lights
  alias: "Birthday hunt — flash lights"
  description: "Fired by the birthday party site when a team scans a treasure-hunt QR code."
  mode: queued        # several teams may scan within seconds; 'single' would drop them
  max: 25
  triggers:
    - trigger: webhook
      webhook_id: "<WEBHOOK_ID>"
      allowed_methods:
        - POST
      local_only: true
  variables:
    team: "{{ trigger.json.get('team', 'unknown') }}"
    node: "{{ trigger.json.get('node', 'unknown') }}"
  actions:
    - action: logbook.log
      data:
        name: "Birthday hunt"
        message: "Team {{ team }} scanned node {{ node }}"
    - repeat:
        count: 3
        sequence:
          - action: light.turn_on
            target:
              entity_id: light.party_lamp      # <-- your light entity
            data:
              brightness_pct: 100
          - delay: "00:00:00.4"
          - action: light.turn_off
            target:
              entity_id: light.party_lamp      # <-- your light entity
          - delay: "00:00:00.4"
```

- `mode: queued` matters — the default `single` silently drops concurrent triggers, and
  simultaneous scans are exactly our case.
- `.get('team', ...)` rather than `.team`: a payload missing a key would otherwise throw, and you
  would never see it, because of the `200 OK` behaviour.
- **Do not add `GET`** to `allowed_methods`. Link-preview bots and browser prefetch would fire
  your automation by themselves.
- The UI route works too: Settings → Automations & scenes → Create automation → Add trigger →
  *Webhook*. `local_only` and the allowed methods hide behind the gear menu beside the Webhook ID
  field, and the copy button gives you the fully-qualified URL.

### 3. What we send

`POST`, `Content-Type: application/json`, 2-second timeout, no retries, fire-and-forget:

```json
{ "team": "The Ice People", "game": "lights", "step": 2, "node": "hall-mirror", "event": "scan" }
```

`node` is the hunt step's logical name from our content files — `hall-mirror`, `attic-lamp`.
Branch on it. `team` is there so you *can* give each team its own colour; whether that's worth it
is one of the questions below.

Webhooks re-fire on **every** scan of the same code, deliberately — a hunt step is meant to take
a few tries, and re-triggering means walking back to the code.

### 4. Test it, and don't trust the status code

```bash
curl -i -X POST -H "Content-Type: application/json" \
  -d '{"team":"test","node":"hall-mirror","event":"scan"}' \
  http://<HA_INTERNAL_HOST>:8123/api/webhook/<WEBHOOK_ID>
```

Expect `200 OK` **and the lamp to actually flash.**

The only signal HA gives you that doesn't lie is this inversion — `GET` is not in
`allowed_methods`, so:

```bash
curl -i -X GET http://<HA_INTERNAL_HOST>:8123/api/webhook/<WEBHOOK_ID>
# 405 Method Not Allowed  ->  registered. Good.
# 200 OK                  ->  NOT registered: wrong id, automation disabled, or not reloaded.
```

Worth re-running on party day before guests arrive.

### 5. Hand the URL back

```
HA_WEBHOOK_URL=http://<HA_INTERNAL_HOST>:8123/api/webhook/<WEBHOOK_ID>
```

`<HA_INTERNAL_HOST>` must be an **internal** address — the Docker service name for Home Assistant,
the host's LAN IP (`192.168.x.x` / `10.x.x.x`), or `127.0.0.1` under host networking.

**Not the public hostname, and not via Tailscale.** `local_only: true` accepts only loopback,
RFC1918 and link-local source addresses. A public IP or a Tailscale CGNAT address
(`100.64.0.0/10`) is rejected — silently, with a `200 OK`. Docker bridge addresses
(`172.17–172.31.x.x`) are private and pass fine, which is why the default setup works.

If Home Assistant runs under Docker here, uncomment the `networks:` blocks in
`docker-compose.yml` so you can use the service name instead of an IP.

Please do **not** expose `/api/webhook/` through the proxy serving `bday.moeriki.com`, and do not
create a DNS record for Home Assistant. This call is server-to-server; guests' phones never talk
to HA.

### 6. If it doesn't work

```yaml
logger:
  default: warning
  logs:
    homeassistant.components.webhook: debug
```

| Log line | Cause |
| --- | --- |
| `Received message for unregistered webhook <id>` | Wrong id, automation disabled, or not reloaded |
| `Received remote request for local webhook <id>` | `local_only` rejection — you're calling from a non-private address |
| `only supports POST methods but GET was received` | Method mismatch (also a visible 405) |
| `Error processing webhook <id>` + traceback | Malformed JSON, or a template/action error |
| `A request from a reverse proxy was received…` | Something added `X-Forwarded-For`; the request got a 400 |

---

## Backups

The party generates data that cannot be recreated — a team's answers exist nowhere else. Taking a
snapshot mid-party is the difference between a hiccup and a ruined night.

```bash
docker compose exec bday node scripts/backup.js
# backup → /data/backups/bday-2026-08-14T22-15-03.sqlite
```

This uses SQLite's `VACUUM INTO`, which takes a consistent snapshot through a live connection. It
is safe to run while fourteen teams are mid-answer, needs no `sqlite3` CLI and no downtime.

Worth doing **once before guests arrive** (a clean baseline you can reset to), and **once around
midnight**, before the host presses END GAME.

To restore, stop the container, replace `data/bday.sqlite`, delete any stale `-wal` and `-shm`
sidecars, and start it again:

```bash
docker compose stop bday
cp data/backups/bday-<timestamp>.sqlite data/bday.sqlite
rm -f data/bday.sqlite-wal data/bday.sqlite-shm
docker compose start bday
```

---

## During the party

| Situation | Do this |
| --- | --- |
| Check it's alive | `curl -s https://bday.moeriki.com/healthz` |
| Watch what's happening | `docker compose logs -f bday` |
| It's wedged | `docker compose restart bday` — data is on the bind mount and survives |
| Ship a content fix | `git pull && docker compose up -d --build` — roughly 10 seconds of downtime |
| Take a snapshot | `docker compose exec bday node scripts/backup.js` |
| Lights aren't firing | Run the `GET` → 405 probe. If it returns 200, the automation isn't registered |
| Host lost the admin page | They visit `/admin/key/<ADMIN_SECRET>` again on any phone |

A restart is cheap and safe. Teams keep their cookies, and the database is untouched.

**The one thing to avoid:** don't `docker compose down -v`. The `-v` removes volumes.

---

## Analysis request: the treasure-hunt lights

Everything above about Home Assistant comes from documentation and source. **None of it has been
run against this house.** You have the instance, the lights, the network and the containers, and
you'll be the one operating it on the night. This is a request for your analysis — answer in
prose where a list would lose the nuance, and if you think the approach is wrong, say so.

**Does the plan survive contact with the real setup?**

1. What HA version are you running? Our findings are verified against Core 2026.7.4. Older than
   2024.2 and the `local_only` default differs and the YAML may need the legacy `platform:`
   spelling.
2. Is webhook-over-REST-API the right call here? We chose it so the site never holds an HA token.
   If you'd rather we called the REST API, or used MQTT, or `POST /api/events/`, say so now — it's
   a small change today and a bigger one on the 13th.
3. Is anything wrong with our "container POSTs to HA on the same host" assumption? We concluded
   `local_only: true` is safe because Docker bridge addresses are RFC1918. Host networking, a
   macvlan, HA OS in a VM, a proxy in front, or Tailscale anywhere in the path could break that —
   and we'd rather hear it from you than discover it through a silent `200 OK`.

**What can the lights actually do?**

4. Which lights are realistically in play, and where? A lamp flashing in an empty room achieves
   nothing — the hunt is physical, through the house.
5. Are they colour-capable, and do they support `flash`? If your bulbs have native effects, your
   automation will be better than ours. Please write it the way you'd actually want it.
6. How fast do they respond? If there's a 3-second lag we should design the hunt around a
   sustained colour change rather than a flash.
7. What should happen afterwards? Our example turns the light off at the end, which is wrong if
   the room light was already on. Do you want to snapshot and restore the scene?

**How do you see it behaving on the night?**

8. Concurrency — several teams may scan within seconds. We set `mode: queued, max: 25`. Will
   queued flashes read as chaos? Would you rather debounce, rate-limit, or merge them?
9. Per-team effects — we pass `team` so each team could get its own colour. In a house where
   everyone sees the same lamp, is that worth it, or is one "something happened" effect better?
10. Do you want to drive anything beyond lights? TTS on a speaker, a media player, a phone
    notification. The payload gives you team and node, so anything HA can do is on the table —
    tell us and we'll make sure the hunt design gives you the hooks.
11. What's your failure plan? If HA restarts or an automation gets disabled, the site carries on
    silently and nobody notices. Anything you'd want to monitor or be alerted about mid-party?

**Operational**

12. Is HA behind a reverse proxy? If so we need to know whether `use_x_forwarded_for` and
    `trusted_proxies` are configured — a stray `X-Forwarded-For` on an unconfigured setup turns
    our call into a 400.
13. One webhook or several? We assume one, branching on `node`. If you'd rather have one
    automation per node — easier to disable individually — we'll switch to one env var per node.
14. When can you test end-to-end? We'd like a confirmed-working lamp at least a day before the
    party, not on the day.

**And the one that matters most**

15. **What have we got wrong?** We researched this from the docs without touching the instance.
    If something about this house — the lights, the network, how you run things — makes part of
    the above naive, we'd rather rewrite it now than at 20:00 on the 14th.
