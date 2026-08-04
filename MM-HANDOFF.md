# MM-HANDOFF

Hello MM. This is the deployment brief for **bday.moeriki.com**, a QR-code party game that has to
be working on **Friday 14 August, 20:00**. Guests scan QR codes hidden around the house, teams
answer questions on their phones, and the host runs the night from a hidden admin page.

Source: <https://github.com/moeriki/tinker-lab> (public). Everything below refers to that
checkout.

You own the server, DNS, Docker and Home Assistant. This document is what you need from us, and
what we need from you.

**Revised 4 August** against your analysis of the real setup — the Home Assistant sections now
describe this house rather than a documented one. What's still outstanding is the short list at
the bottom.

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

Checked against Tower on 4 August from a machine on the house LAN, so most of this is already
true and wants nothing from you:

- **Docker 29.3.1, Compose v2.40.3** — already installed. Nothing to do.
- **TLS** — NPM already serves a wildcard `*.moeriki.com` Let's Encrypt certificate (ECDSA
  P-384, valid 16 Jun → 14 Sep 2026) and it **already covers `bday.moeriki.com`**. There is
  nothing to issue. Step 5 says which button *not* to press.
- **DNS** — the one thing genuinely missing. `bday.moeriki.com` does not resolve yet. Step 5.

One consequence worth knowing before you start: `ha.moeriki.com` resolves — publicly, from
Route 53, same answer from 1.1.1.1 and 8.8.8.8 — to `192.168.128.2`, an RFC1918 address.
Pointing `bday` at the same place makes **the site LAN-only**, and that is the deliberate
choice, not an accident of copying the `ha` record
([#20](https://github.com/moeriki/tinker-lab/issues/20)). The house network *is* the boundary:
nobody outside can touch scores, which is why nothing in the game does anti-cheat.

So please **do not** put `bday` on a tunnel or a port-forward to make it reachable from
outside. If it were, the boundary argument goes with it.

The cost is accepted rather than solved: joining the house WiFi is step zero of the game, and a
guest on cellular gets a connection timeout we cannot write a message into — we are not
reachable to say anything. The mitigation is physical and already in place, a WiFi QR code on
the wall, and most guests have been to the house before and join automatically.

### 1. Get the code

```bash
cd /mnt/disk1/appdata
git clone https://github.com/moeriki/tinker-lab.git bday
cd bday
```

**`/mnt/disk1/appdata`, not `/mnt/user/appdata`.** There is one array disk and no cache pool, so
`/mnt/user` is a FUSE `shfs` layer over that same XFS filesystem. The database runs SQLite in WAL
mode, which wants shared-memory mmap that FUSE does not reliably provide — and when that breaks
it breaks quietly, which is the expensive kind. The disk path is the same bytes without the FUSE
layer. Same family of trap as the bind-mount one above.

There is no registry and no published image. `docker compose` builds from this checkout, so
shipping a fix is `git pull && docker compose up -d --build`.

**The image has now been built and run** (4 August, under Podman) — it starts, migrates, serves
every route below, persists across a restart, and `scripts/backup.js` works inside the container.
So a build failure on your host would point at the host, not at this checkout. One difference you
may notice: Podman ignores the `HEALTHCHECK` line because it defaults to the OCI image format.
Docker honours it, so `docker ps` will show a health column and Podman won't.

### 2. Configure

```bash
cp .env.example .env
```

| Variable | Required | Notes |
| --- | --- | --- |
| `ADMIN_SECRET` | **yes** | The host visits `/admin/key/<this>` once to claim the admin cookie. Generate it: `openssl rand -hex 24`. Anyone holding it can end the game and rewrite scores. |
| `BIND_ADDR` | **required here, already filled in** | `192.168.129.201`. Pre-set in `.env.example` so the copy above just works. Not a fallback — without it the proxy answers 502 every time. Reasoning in step 5. |
| `HA_WEBHOOK_URL` | no | One fully-qualified HA webhook URL, id included. Unset is valid — the hunt still works, the lights just stay put. See below. **Leave it empty for a first deploy**; the lights are a separate job. |
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

### 5. DNS, then put it behind TLS

**Do the DNS record first**, since it is the only step with any wait in it. In **Route 53** — the
zone's nameservers are AWS, not the registrar — add:

```
bday.moeriki.com.   A   192.168.128.2
```

The same address `ha.moeriki.com` already uses. Reckon on ~15 minutes: `ha`'s A record TTL is
300s and the zone's SOA caps negative caching at 900s. This does not need splitting over two
evenings.

Then the proxy. The container publishes on `${BIND_ADDR}:3040`, which step 2 set to the host's
LAN address. Add a Proxy Host in NPM:

| Field | Value |
| --- | --- |
| Domain Names | `bday.moeriki.com` |
| Scheme | `http` |
| Forward Hostname / IP | `192.168.129.201` (the Unraid host — **not** `127.0.0.1`, see below) |
| Forward Port | `3040` |
| Block Common Exploits | on |
| Websockets Support | off — the admin page polls over ordinary requests |
| SSL | **Pick the existing `*.moeriki.com` certificate from the dropdown.** Force SSL on. |

⚠️ **Do not click _Request a new SSL Certificate_.** The wildcard already covers this hostname,
and a new request would use HTTP-01, which cannot reach a private address — so it can only fail,
and it spends failed-validation quota on the way. The renewal falls due around 15 August, the day
*after* the party, so the certificate cannot be a day-of surprise either.

Then, under the Advanced tab, raise the upload ceiling — guests upload phone photos and the
1 MB nginx default rejects them, which looks like a broken game rather than a broken proxy:

```nginx
client_max_body_size 25M;
```

#### Why `BIND_ADDR`, and why it is not optional

Measured on Tower on 4 August rather than reasoned about — which is just as well, because the
first version of this note got both halves wrong:

- **They are not different subnets.** NPM's macvlan network is `192.168.128.0/23`, spanning
  `192.168.128.0`–`192.168.129.255`. `.128.2` and `.129.201` are in the same one, and they route
  to each other fine. The subnets were never the problem.
- **The loopback problem is absolute, not probable.** A container's `127.0.0.1` is its own
  namespace's loopback. NPM cannot reach the host that way, routed or not, ever.

Why the LAN address *does* work is worth knowing, because it is a setting someone could switch
off. NPM is a **macvlan** container on `br0`, and a macvlan container normally cannot talk to its
parent host at all — that is a deliberate kernel restriction. It works here only because Unraid's
**"Host access to custom networks"** is on, which is what the `shim-br0` interface is. Proof,
from inside the NPM container:

```
curl 192.168.129.201:9000   ->  302        # the host's LAN address: reachable
curl 127.0.0.1:9000         ->  no answer  # its own loopback: nothing there
```

So if this site ever starts answering **502** and nothing else changed, check that setting first.
Turning it off takes out every proxied host on Tower at once, not just this one.

Confirm the container end with `curl 192.168.129.201:3040/healthz` from anywhere on the LAN.

<details>
<summary>Caddy or plain nginx instead</summary>

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

Both assume the proxy shares a namespace with the host; if not, use the LAN IP as above.

</details>

**The body-size limit matters.** Guests upload photos from their phones as part of the games, and
a modern phone photo is comfortably over the 1 MB nginx default. An upload rejected by the proxy
looks like a broken game to the guest. 25 MB is a sane ceiling.

No WebSocket support is needed — the admin page polls over ordinary requests.

### 6. Verify

```bash
curl -s https://bday.moeriki.com/healthz
# {"ok":true,"games":0,"uptime":42,"node":"v26.5.1"}
```

**`"games":0` is expected right now** and is not a fault — the game roster is still being written,
and the number climbs as games land. `"ok":true` is the part that matters.

`/healthz` touches the database on purpose: a process that is listening but cannot read its own
file is not healthy. It reports `503` if the database is unreachable. It deliberately exposes
nothing about teams or scores — it is the only route reachable without a cookie.

`curl -I` works too, on every path — the app answers `HEAD` the same way it answers `GET`, minus
the body:

```bash
curl -I https://bday.moeriki.com/healthz   # 200
curl -I https://bday.moeriki.com/          # 303, Location: /welcome
```

**If a `HEAD` 404s on a path a browser loads fine, the app is older than 5 August 2026.** Until
then `HEAD` matched no route at all and the app answered every one of them with its own 404 — so
`curl -I` and any uptime monitor (they default to `HEAD`) called a perfectly healthy site dead.
Rebuild from `main` and it stops. There is one deliberate exception, and it is not a fault:
`HEAD /q/<slug>` answers `200` where a `GET` would answer `303`, because working out that redirect
means *performing the scan* — unlocking a tile, banking hunt progress, flashing a lamp. A HEAD says
only whether the code exists.

Then, in a browser:

| URL | Expected |
| --- | --- |
| `https://bday.moeriki.com/` | Redirects to `/welcome` |
| `https://bday.moeriki.com/welcome` | The onboarding page, in full MS-Paint glory |
| `https://bday.moeriki.com/kit` | The style kit — proves CSS and fonts are being served |
| `https://bday.moeriki.com/admin` | **A plain 404.** Not a login page. This is correct — see ADR-0005 |

**Check `/welcome` and not just `/kit`.** Under `NODE_ENV=production` the team cookie is `Secure`,
so if TLS is not genuinely terminating, `/kit` still renders perfectly — it needs no cookie —
while every team silently bounces back to onboarding and never gets to play. `/kit` loading
proves the proxy and the CSS, and nothing at all about the thing the party depends on.

Do both **on a phone, on the house WiFi**. `/kit` has only ever been seen in a desktop browser
against localhost.

If it does not work, the failure mode names itself:

| Symptom | What it means |
| --- | --- |
| Cannot resolve, or times out | DNS record missing — or the phone is not on the house WiFi |
| **404 whose body is nginx's own page** — `<h1>404 Not Found</h1>` and `openresty` in the footer | DNS is fine; the NPM Proxy Host is missing or the domain is misspelled |
| **404 whose body says `there is no rule 4 either`** | **The proxy is fine — this is the app answering.** The path genuinely does not exist. `/admin` 404s on purpose (ADR-0005), as does any typo |
| **502** | Proxy Host exists but cannot reach the container — `BIND_ADDR` unset, or the container is down |
| Container exits on boot | `data/` owned by root instead of uid 1000 |
| `/kit` fine but `/welcome` loops | TLS is not really terminating — the `Secure` cookie is being dropped |

**A 404 on its own does not name a cause — read the body.** Both a missing Proxy Host and a
perfectly healthy app answer `404`, and `Server: openresty` is not a reliable way to tell them
apart: NPM may stamp that header on responses it merely *proxies* as well as on the ones it
generates itself. Nobody here has confirmed which it does on Tower, so don't lean on it. The
body is unambiguous — use `curl -s`, not `curl -I`:

```bash
curl -s https://bday.moeriki.com/nothing-here | head -5
```

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
    # Which room this hunt node lives in. Extend as the hunt design names more nodes;
    # the default keeps an unmapped node visible rather than silent.
    lamp: >-
      {% set rooms = {
           'hall-mirror': 'light.living_room_living_room',
           'attic-lamp':  'light.living_room_living_room'
         } %}
      {{ rooms.get(node, 'light.living_room_living_room') }}
  actions:
    - action: logbook.log
      data:
        name: "Birthday hunt"
        message: "Team {{ team }} scanned node {{ node }}"

    # Capture the room exactly as it is, so a light that was already on goes back to
    # what it was rather than being switched off.
    - action: scene.create
      data:
        scene_id: bday_hunt_restore
        snapshot_entities:
          - "{{ lamp }}"

    - repeat:
        count: 3
        sequence:
          - action: light.turn_on
            target:
              entity_id: "{{ lamp }}"
            data:
              brightness_pct: 100
              rgb_color: [255, 140, 0]     # one warm "something happened" flash
          - delay: "00:00:00.4"
          - action: light.turn_off
            target:
              entity_id: "{{ lamp }}"
          - delay: "00:00:00.4"

    - action: scene.turn_on
      target:
        entity_id: scene.bday_hunt_restore
```

- **Snapshot and restore, not turn-off.** `scene.create` with `snapshot_entities` captures the
  room's current state; `scene.turn_on` at the end puts it back. Turning the light off would be
  wrong whenever the room light was already on — which, at a party, is most of the time.
- `mode: queued` matters — the default `single` silently drops concurrent triggers, and
  simultaneous scans are exactly our case. **You wanted to debounce instead** so that three teams
  scanning within five seconds don't produce nine back-to-back flash cycles; that's yours to
  write and the site needs no change for it — the webhook fires on every scan regardless, and the
  automation decides whether to act. The cheap version is `mode: single` with
  `max_exceeded: silent`, which drops overlapping scans rather than merging them.
- **One flash, not per-team colours.** Teams are pairs and there will be ten to fifteen of them,
  which is well past the point where colour-coding reads as anything but muddy. `team` is still
  in the payload if you want it for TTS or the logbook.
- `.get('team', ...)` rather than `.team`: a payload missing a key would otherwise throw, and you
  would never see it, because of the `200 OK` behaviour.
- **Do not add `GET`** to `allowed_methods`. Link-preview bots and browser prefetch would fire
  your automation by themselves.
- The UI route works too: Settings → Automations & scenes → Create automation → Add trigger →
  *Webhook*. `local_only` and the allowed methods hide behind the gear menu beside the Webhook ID
  field, and the copy button gives you the fully-qualified URL.

### 2b. The lights that are actually in play

Confirmed against the house — 34 Hue bulbs over the Hue Bridge, sub-second response, so a flash
reads as instant.

| Room | Entity | Bulbs | Use for the hunt |
| --- | --- | --- | --- |
| Living room | `light.living_room_living_room` | 10, colour + native Hue effects, dynamics | The main event — where guests are |
| Dining | `light.dining_dining` | 2, colour. Has *Game Night* and *Candlelight Dinner* scenes | Adjacent, good second stop |
| Patio | `light.patio_patio` | 3 outdoor, colour. Has *Amber bloom* and *Campfire* | Only if the hunt goes outside |
| Kitchen | `light.kitchen_kitchen` | 5, **colour temperature only** | No colour flash — brightness only |
| Bathroom, bedroom | — | — | Private. Not hunt stops. |

Also available, and the hunt design will give you hooks for both if you want them:

- **The Podfather** (HomePod, living room) — `tts.speak` / `tts.cloud_say`. Announcing *"Team The
  Ice People found the hall mirror"* is ambient feedback the lights can't give.
- **`notify.mobile_app_moerikiphoneair`** — so the host can watch scan activity without watching
  the lamps.

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
  http://192.168.129.36:8123/api/webhook/<WEBHOOK_ID>
```

Expect `200 OK` **and the lamp to actually flash.**

The only signal HA gives you that doesn't lie is this inversion — `GET` is not in
`allowed_methods`, so:

```bash
curl -i -X GET http://192.168.129.36:8123/api/webhook/<WEBHOOK_ID>
# 405 Method Not Allowed  ->  registered. Good.
# 200 OK                  ->  NOT registered: wrong id, automation disabled, or not reloaded.
```

This is the probe worth putting on a timer through the party — a `200` means the automation has
gone away and nobody would otherwise notice.

Worth re-running on party day before guests arrive.

### 5. Hand the URL back

Confirmed for this house — Home Assistant is HAOS in a QEMU VM, not a container:

```
HA_WEBHOOK_URL=http://192.168.129.36:8123/api/webhook/<WEBHOOK_ID>
```

Because HA is a VM there is no shared Docker network and no service name — the LAN IP is the
whole answer, and it's simpler than the container-to-container case this originally assumed.
Docker NAT rewrites the site's source address to the Unraid host's LAN IP
(`192.168.129.201`), which is RFC1918, so `local_only: true` accepts it.

**Not `ha.moeriki.com`, and not via Tailscale.** `local_only: true` accepts only loopback,
RFC1918 and link-local source addresses. A public IP or a Tailscale CGNAT address
(`100.64.0.0/10`) is rejected — silently, with a `200 OK`.

Going direct to `192.168.129.36:8123` also **bypasses Nginx Proxy Manager entirely**, which is
what we want: no `X-Forwarded-For` is added, so the 400 that an unconfigured proxy would cause
cannot happen. (NPM at `192.168.128.2` does have `use_x_forwarded_for: true` with
`trusted_proxies: [192.168.128.2]`, but that only governs external traffic to `ha.moeriki.com`.)

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
| Check it's alive | `curl -s https://bday.moeriki.com/healthz` — or `curl -I` on any path; `HEAD` is answered like `GET` |
| Point an uptime monitor at it | `HEAD https://bday.moeriki.com/healthz`, expecting `200`. Never point one at `/q/<slug>` — that URL is a game move |
| Watch what's happening | `docker compose logs -f bday` |
| It's wedged | `docker compose restart bday` — data is on the bind mount and survives |
| Ship a content fix | `git pull && docker compose up -d --build` — roughly 10 seconds of downtime |
| Take a snapshot | `docker compose exec bday node scripts/backup.js` |
| Lights aren't firing | Run the `GET` → 405 probe. If it returns 200, the automation isn't registered |
| Host lost the admin page | They visit `/admin/key/<ADMIN_SECRET>` again on any phone |
| "This QR code is broken" | Read the slug printed under the code, look it up at `/admin/codes` — it shows what the code should do and how many teams have scanned it |

A restart is cheap and safe. Teams keep their cookies, and the database is untouched.

**The one thing to avoid:** don't `docker compose down -v`. The `-v` removes volumes.

---

## Analysis request: answered

MM's analysis came back on **4 August** and is recorded in full on
[Get MM's answers on the treasure-hunt lights](https://github.com/moeriki/tinker-lab/issues/16).
The questions that were here are gone because they have answers; the sections above have been
corrected to match the real house rather than the documented one.

**The approach survived.** HA is Core 2026.7.4 — the exact version everything was verified
against. The webhook stays: no HA token in the party site, no MQTT broker, no auth surface.

Two things were wrong and are now fixed above: `light.party_lamp` never existed (§2 now targets
the real Hue group entities and snapshots the room instead of switching it off), and Home
Assistant does not run under Docker here, so there is no shared network and no service name (§5
now gives the VM's LAN IP outright).

### Still owed, in the order they hurt

1. **A confirmed end-to-end lamp flash, by 13 August.** Not on the day. `GET` → 405 proves the
   webhook is registered; only a human watching a lamp proves the path. Tracked as
   [Confirm the treasure-hunt lights fire end-to-end](https://github.com/moeriki/tinker-lab/issues/17).
2. **A test deploy, as soon as you can — serving nothing but the style kit is fine.** We would
   rather see something real at `https://bday.moeriki.com` now than discover DNS, the certificate
   or a 502 on the night. The full checklist is
   [Test deploy to bday.moeriki.com](https://github.com/moeriki/tinker-lab/issues/19); the
   likeliest snag is NPM being unable to reach the host's loopback, fixed with one line in `.env`.
3. **The debounce**, if you want it — three teams scanning within five seconds otherwise queue
   nine flash cycles. Yours to write; the site needs no change either way.
4. **Monitoring**, if you want it — the `GET` → 405 probe on a timer, alerting you when it starts
   answering 200, means a disabled automation gets noticed mid-party instead of never.
