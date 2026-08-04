# Research: triggering Home Assistant from an inbound webhook

Resolves [#4](https://github.com/moeriki/tinker-lab/issues/4). Feeds the treasure-hunt design and `MM-HANDOFF.md` ([#13](https://github.com/moeriki/tinker-lab/issues/13)).

**Applies to:** Home Assistant Core **2026.7.4** — the current stable release as of 2026-08-04. Behaviour was verified by reading the [home-assistant/core](https://github.com/home-assistant/core) source at both the `2026.7.4` tag and `dev` (`2026.9.0.dev0`); the webhook handler is byte-identical between them. Historical tags back to `2021.12.0` were compared to date the changes in [§9](#9-version-notes-and-recent-changes).

---

## TL;DR / Recommendation

**Use a webhook trigger, not the REST API.** The party site does one thing: `POST` a small JSON body to a URL read from an environment variable, with a short timeout, ignoring the response entirely.

Why webhook wins for us:

- **No credentials on the site.** The endpoint is `requires_auth = False` — the secret *is* the URL. Nothing to store, rotate, or leak. The REST API route would put a long-lived access token (valid **10 years**) into the party container, and that token controls the entire house.
- **MM owns the HA side completely.** MM picks the webhook id, writes the automation, decides which lights do what. The site never knows an entity id. Changing the effect mid-party is an automation edit, not a redeploy.
- **It fails safe by design.** HA answers `200 OK` for an unregistered id, a `local_only` rejection, a disabled automation, and a handler that throws. A misconfigured or not-yet-created webhook cannot break a game page.
- **`local_only: true` does not block us.** A container calling HA on the same host has a private-range source address, which HA counts as local. Details in [§1.6](#16-local_only--and-whether-a-docker-container-counts-as-local) — this was the flagged risk and it is a non-issue.

The one real cost of the webhook route is that **HA returns `200 OK` for essentially every failure**, so the site can never tell "it worked" from "wrong id" from "automation disabled". That is a testing problem, not a runtime problem — and [§6.4](#4-the-one-reliable-liveness-probe) gives MM a trick that proves liveness anyway.

The REST API would be the better tool only if the site needed to *read* HA state or call arbitrary services. It doesn't.

**Two sections are written to be lifted out of this document:** [§6](#6-checklist-for-mm-paste-ready-for-mm-handoffmd) is the paste-ready instruction block for `MM-HANDOFF.md`, and [§8](#8-analysis-handoff--questions-for-mm) is an analysis request asking MM how he expects this to behave once it's running in the actual house — the things we cannot determine from documentation.

---

## 1. The webhook automation trigger

### 1.1 URL shape and authentication

`homeassistant/components/webhook/__init__.py`:

```python
URL_WEBHOOK_PATH = "/api/webhook/{webhook_id}"

class WebhookView(HomeAssistantView):
    """Handle incoming webhook requests."""

    url = URL_WEBHOOK_PATH
    name = "api:webhook"
    requires_auth = False
    cors_allowed = True

    get = _handle
    head = _handle
    post = _handle
    put = _handle
```

So the endpoint is:

```
http://<home-assistant-host>:8123/api/webhook/<webhook_id>
```

(8123 is the default port — [http integration](https://www.home-assistant.io/integrations/http/).)

**`requires_auth = False` — there is no authentication at all.** No token, no header, no signature. The auth middleware (`components/http/auth.py`) only *records* whether a request was authenticated; enforcement lives in `helpers/http.py` behind `if view.requires_auth and not authenticated:`, a branch the webhook view never reaches.

**The webhook id is the credential.** From [Automation triggers → Webhook security](https://www.home-assistant.io/docs/automation/trigger/#webhook-trigger):

> Webhook endpoints don't require authentication, other than knowing a valid webhook ID. Security best practices for webhooks include:
>
> - Do not use webhooks to trigger automations that are destructive, or that can create safety issues. For example, do not use a webhook to unlock a lock, or open a garage door.
> - Treat a webhook ID like a password: use a unique, non-guessable value, and keep it secret.
> - Do not copy-and-paste webhook IDs from public sources, including blueprints. Always create your own.
> - Keep the `local_only` option enabled for webhooks if access from the internet is not required.

Flashing a lamp is squarely on the safe side of the first bullet. HA's own programmatic id generator uses 256 bits (`secrets.token_hex(32)`); the UI generates 144 bits, url-safe, prefixed with the slugified automation alias.

**For us:** the id must never reach the browser. Only the Node back end holds `HA_WEBHOOK_URL`. Guests' phones talk to `bday.moeriki.com`, never to Home Assistant.

### 1.2 YAML shape

Verbatim from [Automation triggers → Webhook trigger](https://www.home-assistant.io/docs/automation/trigger/#webhook-trigger):

```yaml
automation:
  trigger_variables:
    webhook_id_variable: "template_webhook_id"
  triggers:
    - trigger: webhook
      webhook_id: "some_hook_id"
      allowed_methods:
        - POST
        - PUT
      local_only: true
    - trigger: webhook
      webhook_id: "{{ webhook_id_variable }}"
      allowed_methods:
        - POST
```

### 1.3 Both key spellings work

Since **2024.10** the top-level keys are plural and the key inside a trigger is `trigger:` rather than `platform:` ([2024.10 release notes](https://www.home-assistant.io/blog/2024/10/02/release-202410/)):

> - The top-level `trigger` key is now `triggers` (plural)
> - The top-level `condition` key is now `conditions` (plural)
> - The top-level `action` key is now `actions` (plural)
> - The `platform` key of a trigger definition is now `trigger`

The same post states this is **not a breaking change, there will be no deprecation**, the old syntax continues to work, and there are **no plans to remove it**. The rename is a normalisation layer above the schema — `webhook/trigger.py` still declares `vol.Required(CONF_PLATFORM): "webhook"` internally. Both forms are equivalent:

```yaml
# Modern (2024.10+, what the UI writes)
triggers:
  - trigger: webhook
    webhook_id: "..."

# Legacy (still fully supported)
trigger:
  - platform: webhook
    webhook_id: "..."
```

MM can use whichever matches the surrounding config.

### 1.4 `allowed_methods`

`webhook/__init__.py`:

```python
DEFAULT_METHODS = (METH_POST, METH_PUT)
SUPPORTED_METHODS = (METH_GET, METH_HEAD, METH_POST, METH_PUT)
```

- **Permitted values:** `GET`, `HEAD`, `POST`, `PUT` only. The schema upper-cases and de-duplicates (`vol.All(vol.Upper, vol.In(SUPPORTED_METHODS)), vol.Unique()`).
- **Default:** `("POST", "PUT")` — `webhook/trigger.py`: `allowed_methods = config.get(CONF_ALLOWED_METHODS, DEFAULT_METHODS)`.
- `DELETE`, `PATCH`, `OPTIONS` are rejected at config validation, and never reach the handler at runtime either — `WebhookView` only binds `get/head/post/put`, so aiohttp's router returns its own 405 first.

Docs:

> Webhooks support HTTP POST, PUT, HEAD, and GET requests; PUT requests are recommended. HTTP GET and HEAD requests are not enabled by default but can be enabled by adding them to the `allowed_methods` option. The request methods can also be configured in the UI by selecting the settings gear menu button beside the Webhook ID.

**We POST, so the default already covers us** — but MM should narrow it to `[POST]` explicitly. **Do not enable `GET`.** A treasure-hunt URL that fires on GET is one link-preview bot, one browser prefetch, or one messaging-app unfurler away from firing itself. Our call is server-to-server from Node, so POST costs nothing.

### 1.5 One automation per webhook id (documented) — but not enforced

The docs say:

> Note that a given webhook can only be used in one automation at a time. That is, only one automation trigger can use a specific webhook ID.

**The source does not enforce this.** `webhook/trigger.py` keeps a *list* of trigger instances per id and fires all of them. Follow the documented rule anyway: the multi-registration behaviour is undocumented, the first registration's `local_only`/`allowed_methods` silently win for every later sharer, and it could be tightened without notice.

### 1.6 `local_only` — and whether a Docker container counts as local

**Default: `true`** for automation triggers — `webhook/trigger.py`: `local_only = config.get(CONF_LOCAL_ONLY, True)`.

> By default, webhook triggers can only be accessed from devices on the same network as Home Assistant or via [Nabu Casa Cloud webhooks](https://www.nabucasa.com/config/webhooks/). The `local_only` option should be set to `false` to allow webhooks to be triggered directly via the internet.

(Asymmetry worth knowing: the low-level `async_register()` API used by *integrations* defaults to `local_only=False`. Only the YAML/UI automation trigger defaults to `True`.)

**The exact check**, `webhook/__init__.py`:

```python
    if webhook.local_only:
        is_local = not (is_cloud_connection(hass) or request.remote is None)

        if is_local:
            try:
                request_remote = ip_address(request.remote)
            except ValueError:
                _LOGGER.debug("Unable to parse remote ip %s", request.remote)
                return Response(status=HTTPStatus.OK)

            is_local = network_util.is_local(request_remote)

        if not is_local:
            _LOGGER.warning("Received remote request for local webhook %s", webhook_id)
            return Response(status=HTTPStatus.OK)
```

`homeassistant/util/network.py` — this is the *entire* definition of "local":

```python
def is_local(address: IPv4Address | IPv6Address) -> bool:
    """Check if an address is on a local network."""
    return is_loopback(address) or is_private(address) or is_link_local(address)
```

with

- **loopback** — `127.0.0.0/8`, `::1/128`, `::ffff:127.0.0.0/104`
- **private** — `10.0.0.0/8`, **`172.16.0.0/12`**, `192.168.0.0/16`, `fd00::/8` (+ IPv6-mapped variants)
- **link-local** — `169.254.0.0/16`, `fe80::/10`, `::ffff:169.254.0.0/112`

There is **no `trusted_networks` involvement and no IP-ban involvement** in this decision. It is a pure RFC1918/RFC6890 range test against `request.remote`, against a *fixed* list — it does not consult HA's own subnet or interfaces.

#### Verdict: `local_only: true` will NOT block us

| Caller → HA | Source IP HA sees | Passes `local_only: true`? |
| --- | --- | --- |
| Container on default Docker bridge (`docker0`) | `172.17.x.x` | **Yes** — inside `172.16.0.0/12` |
| Container on user-defined bridge / compose network | `172.18–172.31.x.x` | **Yes** — inside `172.16.0.0/12` |
| Container on a custom `10.x` or `192.168.x` Docker network | private | **Yes** |
| Container → host LAN IP, traffic SNAT'd via the bridge gateway | `172.x.x.x` | **Yes** |
| Same-host process → `127.0.0.1:8123` | `127.0.0.1` | **Yes** |
| `network_mode: host` on both sides → `127.0.0.1` | `127.0.0.1` | **Yes** |
| Docker Desktop on macOS/Windows (VM gateway) | `192.168.65.x` | **Yes** |
| Guest phone on the party Wi-Fi → HA LAN IP | `192.168.x.x` | **Yes** |
| Over **Tailscale / Headscale** | `100.64.0.0/10` (CGNAT) | **No — blocked** |
| Public IPv6 GUA (`2001:...`) | global v6 | **No — blocked** |
| Nabu Casa Remote UI | `is_cloud_connection()` → True | **No — blocked** |

**Container-to-container and container-to-host-IP calls pass cleanly.** Every routable Docker network sits in RFC1918 space.

#### The three ways this could still break

1. **Calling HA via its public hostname**, so the request leaves the host and re-enters from a public IP (or a tunnel). Fix: point `HA_WEBHOOK_URL` at an *internal* address. This is also faster and doesn't depend on DNS or TLS.
2. **Tailscale or any CGNAT/overlay path.** `100.64.0.0/10` is not in HA's private list. Don't route the call over a mesh VPN.
3. **A reverse proxy in front of HA.** `components/http/forwarded.py` gives three distinct behaviours, and the first is the nasty one:
   - **Any request carrying an `X-Forwarded-For` header while `http.use_x_forwarded_for` is not enabled gets a blanket `HTTP 400`** — it never reaches the webhook view. If our Node client, or an intermediate proxy, adds that header, we get 400, not 200.
   - Proxy present and `use_x_forwarded_for: true`, but the proxy's IP not listed in `trusted_proxies` → also **`400`**.
   - Correctly configured → `request.remote` is rewritten to the real client IP from the XFF chain, and `local_only` then evaluates *that*. Correct behaviour, and what you want.

   `use_x_forwarded_for` and `trusted_proxies` are `vol.Inclusive` — **set both or neither** ([http integration](https://www.home-assistant.io/integrations/http/)). The docs also warn: with a network mask use the network address (`192.168.1.0/24`), not a host address.

**Recommendation: keep `local_only: true`, and set it explicitly.** It is the default, it costs us nothing, and it means a leaked webhook id is useless from outside the house.

#### Flagged discrepancy: cloudhooks

The docs say `local_only` still permits Nabu Casa Cloud webhooks. The code disagrees: `components/cloud/client.py` delivers cloudhooks via `MockRequest(..., remote=None)`, and the handler's first line is `is_local = not (is_cloud_connection(hass) or request.remote is None)` — `remote is None` ⇒ not local ⇒ rejected with `200 OK`. Docs and source could not be reconciled, and no issue resolving it was found. **Irrelevant to us** (we never use cloudhooks), but noted so nobody builds on the documented behaviour.

---

## 2. Payload access in the automation

### 2.1 The template variables

Verbatim from [Automation templating → Webhook](https://www.home-assistant.io/docs/automation/templating/#webhook):

| Template variable | Data |
| ---- | ---- |
| `trigger.platform` | Hardcoded: `webhook` |
| `trigger.webhook_id` | The webhook ID that was triggered. |
| `trigger.json` | The JSON data of the request (if it had a JSON content type) as a mapping. |
| `trigger.data` | The form data of the request (if it had a form data content type). |
| `trigger.query` | The URL query parameters of the request (if provided). |

The complete population logic, `webhook/trigger.py`:

```python
    base_result: dict[str, Any] = {"platform": "webhook", "webhook_id": webhook_id}

    if "json" in request.headers.get(hdrs.CONTENT_TYPE, ""):
        #  Always attempt to read the body; request.text() returns "" if empty
        text = await request.text()
        base_result["json"] = json_loads(text) if text else {}
    else:
        base_result["data"] = await request.post()

    base_result["query"] = request.query
    base_result["description"] = "webhook"
```

That is the whole set: `platform`, `webhook_id`, **either** `json` **or** `data` (never both), `query`, `description`.

> **`trigger.headers` does not exist.** It is absent from the docs and from the source, and was never populated in any tag back to 2021.12. Request headers are simply not available to webhook automations. Don't design around them.

### 2.2 Which variable gets filled

The branch is a naive **substring match** on `Content-Type`: `if "json" in request.headers.get(hdrs.CONTENT_TYPE, "")`.

| Request | Sets | Does NOT set |
| --- | --- | --- |
| `POST`, `Content-Type: application/json`, JSON body | `trigger.json` (parsed mapping) | `trigger.data` |
| `POST`, `application/x-www-form-urlencoded` | `trigger.data` (a `MultiDict`) | `trigger.json` |
| `POST`, `multipart/form-data` | `trigger.data` | `trigger.json` |
| `POST` with **no** `Content-Type` | `trigger.data` (empty) | `trigger.json` |
| `GET`/`PUT` with a query string | `trigger.query` (always populated) | — |

`application/json`, `application/json; charset=utf-8` and `text/json` all take the JSON branch.

**The `Content-Type` header is mandatory for JSON.** Docs:

> Payloads may either be encoded as form data or JSON. Depending on that, its data will be available in an automation template as either `trigger.data` or `trigger.json`. URL query parameters are also available in the template as `trigger.query`. Note that to use JSON encoded payloads, the `Content-Type` header must be set to `application/json`.

Node's `fetch` does **not** set it for a string body. Forget it and everything lands in `trigger.data`, `trigger.json` is never set, and every `trigger.json.*` reference raises `UndefinedError`.

### 2.3 Malformed JSON: the automation silently does not run

`json_loads` is an `orjson.loads` wrapper that **raises** on malformed input. The exception propagates into the caller's guard in `webhook/__init__.py`:

```python
    try:
        response = await webhook.handler(hass, webhook_id, request)
        if response is None:
            response = Response(status=HTTPStatus.OK)
    except Exception:
        _LOGGER.exception("Error processing webhook %s", webhook_id)
        return Response(status=HTTPStatus.OK)
    return response
```

**Malformed JSON → the automation does NOT fire, a traceback is logged, and the caller still gets `200 OK`.** Completely invisible from our side.

An **empty** body with a JSON content type is handled explicitly and does not raise: `trigger.json == {}`. (This changed at some point — at tag `2023.4.0` the code was `await request.json()`, which raised on empty bodies too.)

### 2.4 Missing keys raise, so read defensively

`trigger.json` is a plain mapping, so `trigger.json.team` raises `UndefinedError` when `team` is absent — and per §2.3 that failure is invisible to us. Use:

```jinja
{{ trigger.json.get('team', 'unknown') }}
{{ trigger.json.get('node', 'unknown') }}
```

Form-encoded equivalent is `trigger.data.team`; query-string equivalent is `trigger.query.team`.

### 2.5 Size limits

`components/http/server.py`:

```python
MAX_CLIENT_SIZE: Final = 1024**2 * 16      # 16 MiB body
MAX_LINE_SIZE: Final = 24570               # ~24 KB request line
```

Exceeding the body limit yields aiohttp's `413`. The line limit caps URL + query string at ~24 KB, which matters only if someone were tempted to stuff game state into `trigger.query`. Our payload is ~100 bytes. Non-issue.

### 2.6 Our payload contract

```json
{ "team": "team-slug", "node": "hunt-node-id", "event": "scan" }
```

Read as `{{ trigger.json.get('team') }}` and `{{ trigger.json.get('node') }}`. This is what enables **per-team effects** — the automation can `choose` on team, or map team → colour, rather than firing one global scene for everyone.

---

## 3. The alternative: HA REST API with a long-lived token

[Developer docs → REST API](https://developers.home-assistant.io/docs/api/rest/):

> Home Assistant provides a RESTful API on the same port as the web frontend (default port is port 8123).
>
> All API calls have to be accompanied by the header `Authorization: Bearer TOKEN`, where `TOKEN` is replaced by your unique access token.

**Call a service** — `POST /api/services/<domain>/<service>`:

> Calls a service within a specific domain. Will return when the service has been executed.

```bash
curl -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"entity_id": "switch.christmas_lights"}' \
  http://localhost:8123/api/services/switch/turn_on
```

The response is a list of state objects that changed during the call. Services with response data need `?return_response` appended.

**Fire an event** — `POST /api/events/<event_type>`, with an optional JSON body, returning `{"message": "Event ... fired."}`. This is the closest REST equivalent to a webhook: pair it with an `event` trigger in the automation.

**Token creation:** frontend → **User profile → Security tab → Long-Lived Access Tokens** ([Authentication](https://www.home-assistant.io/docs/authentication/)), i.e. `http://IP_ADDRESS:8123/profile`. The docs warn to *"copy the whole key"*; the token string is never stored in HA, so it must be recorded elsewhere. Per the [auth API docs](https://developers.home-assistant.io/docs/auth_api/#long-lived-access-token), **long-lived access tokens are valid for 10 years.**

**Response codes:** `200`/`201` success; `400`, `401`, `404`, `405`.

### Comparison

| | Webhook trigger | REST API + token |
| --- | --- | --- |
| Secret on the party site | Webhook id, inside one env var | Long-lived token, 10-year lifetime |
| **Blast radius if leaked** | That one automation, LAN-only with `local_only` | **Full control of Home Assistant** |
| Who decides what the lights do | MM, in the automation | The site, in code — must know entity ids |
| Changing the effect mid-party | Edit automation, no redeploy | Site redeploy |
| Unconfigured / broken hook | `200 OK`, silent no-op | `401`/`404` to handle |
| Failure feedback | **None — always 200** | Real status codes |
| Network restriction | `local_only` built in | None; token works from anywhere |
| Reading HA state | Not possible | Possible |
| Credential in access logs | Id is in the URL path — **it will be logged** | Token is in a header — not logged by default |
| Failed auth → IP ban risk | No ([§4.5](#45-ip-banning-is-not-a-risk-with-one-caveat)) | Yes |

**Recommendation: webhook.** The mission's constraint — the site must not hold HA credentials — is decided by the blast-radius row. A 10-year house-wide token sitting in a party container running unattended in a house full of guests is not a trade worth making to flash a lamp.

The webhook's one genuine downside, silent 200s, is mitigated by testing before the party ([§6](#6-checklist-for-mm-paste-ready-for-mm-handoffmd)) rather than by handling errors at runtime — which we couldn't do usefully anyway, since the *effect* is fire-and-forget by nature.

One consequence of "the id is in the URL path": it lands in reverse-proxy and access logs. Not a concern on a home server for a one-evening party, but MM shouldn't paste the URL anywhere public.

---

## 4. Failure behaviour — how the site fails silently

All from `async_handle_webhook` in `homeassistant/components/webhook/__init__.py`.

### 4.1 Unknown / unregistered webhook id → `200 OK`

```python
    # Always respond successfully to not give away if a hook exists or not.
    if (webhook := handlers.get(webhook_id)) is None:
        _LOGGER.info(
            "Received message for unregistered webhook %s from %s",
            webhook_id,
            received_from,
        )
        # Look at content to provide some context for received webhook
        # Limit to 64 chars to avoid flooding the log
        content = await content_stream.read(64)
        _LOGGER.debug("%s", content)
        return Response(status=HTTPStatus.OK)
```

The rationale is in the source comment: **"Always respond successfully to not give away if a hook exists or not."** Deliberate anti-enumeration — since the id is the only credential and there is no rate limiting on this path, a `404` would hand an attacker a brute-force oracle.

Side effect: the first 64 bytes of an unknown-webhook body are read and logged at DEBUG.

### 4.2 Disabled automation → also `200 OK`, nothing happens

Disabling an automation **unregisters its webhook**. `components/automation/__init__.py`'s `_async_disable` calls the detach callback, which is the trigger's `unregister()`:

```python
    @callback
    def unregister() -> None:
        """Unregister webhook."""
        triggers[webhook_id].remove(trigger_instance)
        if not triggers[webhook_id]:
            async_unregister(hass, webhook_id)
            triggers.pop(webhook_id)
```

So a disabled, deleted, or not-yet-reloaded automation collapses into case 4.1. **An accidentally-disabled automation is indistinguishable from a working one at the HTTP level.** This is exactly why MM must verify with the light, not the status code.

### 4.3 Method not allowed → `405`, except HEAD → `200`

```python
    if method_name not in webhook.allowed_methods:
        if method_name == METH_HEAD:
            # Allow websites to verify that the URL exists.
            return Response(status=HTTPStatus.OK)

        _LOGGER.warning(
            "Webhook %s only supports %s methods but %s was received from %s", ...
        )
        return Response(status=HTTPStatus.METHOD_NOT_ALLOWED)
```

`405` is the **only** client-visible error the webhook handler produces — and that turns out to be useful ([§6.3](#63-the-only-reliable-way-to-prove-a-webhook-is-live)). Note the HEAD carve-out makes HEAD useless as a liveness probe, since an unregistered id also returns 200.

### 4.4 Rejected by `local_only` → `200 OK` (not 401, not 403)

Same anti-enumeration reasoning. **The only signal is the HA log line** `Received remote request for local webhook <id>` at WARNING level. An unparseable `request.remote` likewise returns 200, with a DEBUG log.

### Every status the webhook path can return

| Condition | Status | Can the client tell? |
| --- | --- | --- |
| Success | `200` | — |
| Unknown webhook id | `200` | **No** |
| Blocked by `local_only` | `200` | **No** |
| Automation disabled / removed | `200` | **No** |
| Handler raised (e.g. malformed JSON) | `200` | **No** |
| Disallowed `HEAD` | `200` | **No** |
| Disallowed `GET`/`POST`/`PUT` | `405` | Yes |
| `DELETE`/`PATCH`/`OPTIONS` (router) | `405` | Yes |
| Body > 16 MiB | `413` | Yes |
| `X-Forwarded-For` sent, proxy not configured/trusted | `400` | Yes |
| Source IP already banned | `403` | Yes |

**For us this is a feature.** The endpoint essentially cannot return an error that would surface as a broken game page. `200 OK` means "HA received it", *not* "the lights fired".

### 4.5 IP banning is not a risk (with one caveat)

`components/http/__init__.py` defaults: `ip_ban_enabled: true` but `login_attempts_threshold: -1` (`NO_LOGIN_ATTEMPT_THRESHOLD`), i.e. **automatic banning is off out of the box** — only IPs listed manually in `ip_bans.yaml` are enforced. `http/ban.py` bails immediately: `if ... request.app[KEY_LOGIN_THRESHOLD] < 1: return`.

**Webhook failures never count toward bans.** `ban_middleware` increments the counter only on an `HTTPUnauthorized` exception, and `requires_auth = False` means the webhook view never raises one. Neither a 200-for-unknown-id nor a 405 is an auth failure. Even sending a bogus `Authorization` header to a webhook is harmless. **You can hammer wrong webhook ids forever without being banned** — which is precisely why the endpoint must return an indistinguishable 200, and precisely why a long random id matters. There is **no rate limiting on the webhook path at all.**

**The caveat:** the ban middleware runs *before* the handler and blocks all requests from an already-banned IP, webhooks included (`raise HTTPForbidden` → `403`). That only bites if MM has set `login_attempts_threshold` to a positive number and a guest fumbled the HA login page. If a device mysteriously 403s, check `ip_bans.yaml`. Leaving the threshold at its default `-1` avoids the whole class of problem.

### 4.6 Site-side rules (non-negotiable)

No documented timeout characteristics exist for the webhook endpoint, and we can't learn anything from the response anyway — so the site imposes its own deadline and ignores the outcome.

1. **Fire and forget.** Never `await` the HA call on the path that renders a game page.
2. **Hard timeout ~2 s** via `AbortSignal.timeout(2000)`.
3. **Catch everything.** Network error, DNS failure, non-2xx, timeout — log and continue.
4. **No retries.** A treasure-hunt effect is worthless three seconds late, and a retry would double-flash.
5. **If `HA_WEBHOOK_URL` is unset, skip the call entirely** and log once at startup. The whole game must work with Home Assistant switched off — that is the fallback if MM never wires it, or if HA restarts mid-party.
6. **Always send `Content-Type: application/json`.**

```js
// Illustrative shape only.
async function fireHunt(team, node) {
  if (!process.env.HA_WEBHOOK_URL) return;
  try {
    await fetch(process.env.HA_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }, // mandatory for trigger.json
      body: JSON.stringify({ team, node, event: 'scan' }),
      signal: AbortSignal.timeout(2000),
    });
  } catch (err) {
    console.warn('[ha] webhook call failed, continuing', err.message);
  }
}
```

Do **not** let anything add an `X-Forwarded-For` header to this request — if HA sits behind a proxy that isn't configured for forwarding, that header alone turns the call into a `400` ([§1.6](#the-three-ways-this-could-still-break)).

---

## 5. Exposure

**The webhook URL does not need to be reachable from outside the LAN.** The site, Home Assistant and MM all live on the same server; the call is server-to-server from the Node back end. Guests' phones never touch Home Assistant.

Therefore:

- Keep **`local_only: true`**. A leaked id is then only exploitable from inside the home network.
- **Do not** expose `/api/webhook/` through the reverse proxy serving `bday.moeriki.com`, and do not add a DNS record for Home Assistant.
- `HA_WEBHOOK_URL` must point at an **internal** address — the compose service name (`http://homeassistant:8123/api/webhook/<id>`), the host's LAN IP, or `127.0.0.1` under host networking. **Never the public hostname**, and never over Tailscale.

---

## 6. Checklist for MM (paste-ready for `MM-HANDOFF.md`)

> ### Wiring the treasure-hunt lights
>
> The party site does not have Home Assistant credentials and never will. It knows exactly one thing: a URL to POST to, supplied as the environment variable `HA_WEBHOOK_URL`. You own everything on the Home Assistant side. **If you skip this section entirely the party still works** — the lights just won't fire.
>
> #### 1. Generate a webhook id
>
> Long and unguessable — this is the only thing protecting the endpoint. There is no authentication and no rate limiting.
>
> ```bash
> openssl rand -hex 32
> ```
>
> Referred to below as `<WEBHOOK_ID>`.
>
> #### 2. Create the automation
>
> Paste into `automations.yaml` and reload automations (Developer tools → YAML → Reload automations):
>
> ```yaml
> - id: bday_hunt_lights
>   alias: "Birthday hunt — flash lights"
>   description: "Fired by the birthday party site when a team scans a treasure-hunt QR code."
>   mode: queued        # several teams may scan within seconds; 'single' would drop them
>   max: 25
>   triggers:
>     - trigger: webhook
>       webhook_id: "<WEBHOOK_ID>"
>       allowed_methods:
>         - POST
>       local_only: true
>   variables:
>     team: "{{ trigger.json.get('team', 'unknown') }}"
>     node: "{{ trigger.json.get('node', 'unknown') }}"
>     team_color: >-
>       {{ {'red': [255, 0, 0], 'blue': [0, 80, 255], 'green': [0, 200, 60]}
>          .get(team, [255, 0, 255]) }}
>   actions:
>     - action: logbook.log
>       data:
>         name: "Birthday hunt"
>         message: "Team {{ team }} scanned node {{ node }}"
>     - repeat:
>         count: 3
>         sequence:
>           - action: light.turn_on
>             target:
>               entity_id: light.party_lamp      # <-- your light entity
>             data:
>               brightness_pct: 100
>               rgb_color: "{{ team_color }}"
>           - delay: "00:00:00.4"
>           - action: light.turn_off
>             target:
>               entity_id: light.party_lamp      # <-- your light entity
>           - delay: "00:00:00.4"
> ```
>
> Notes:
> - Change `light.party_lamp` to your entity. If the lamp isn't colour-capable, drop `rgb_color` and keep `brightness_pct`.
> - `mode: queued` is important — the default `single` silently drops concurrent triggers, and simultaneous scans are exactly our use case.
> - `.get('team', ...)` rather than `.team`: a payload missing a key would otherwise throw, and you would never see it (see step 3).
> - `local_only: true` is already the default since 2024.2, but set it explicitly.
> - `allowed_methods: [POST]` narrows the `[POST, PUT]` default. **Do not add `GET`** — link-preview bots and browser prefetch would fire the automation by themselves.
>
> **Or use the UI:** Settings → Automations & scenes → Create automation → Add trigger → *Webhook*. It generates a strong id automatically. `local_only` and the allowed methods are behind the **gear menu button beside the Webhook ID**, and the **copy button** next to the field puts the fully-qualified URL on your clipboard (the field itself shows only the id). Saving via the UI auto-migrates the automation to the modern `triggers:` syntax.
>
> #### 3. Test it — and don't trust the status code
>
> ```bash
> curl -i -X POST \
>   -H "Content-Type: application/json" \
>   -d '{"team":"red","node":"hall-mirror","event":"scan"}' \
>   http://<HA_INTERNAL_HOST>:8123/api/webhook/<WEBHOOK_ID>
> ```
>
> Expect `HTTP/1.1 200 OK` **and the light to actually flash.**
>
> **Home Assistant returns `200 OK` for almost every failure** — unknown webhook id, disabled automation, a request rejected as non-local, even a template error inside the automation. The status code proves nothing. **Trust the light, not the response.**
>
> #### 4. The one reliable liveness probe
>
> Since `GET` is not in `allowed_methods`, a `GET` to a *registered* webhook returns `405`, while an *unregistered* id returns `200`. That inversion is the only signal HA gives you:
>
> ```bash
> curl -i -X GET http://<HA_INTERNAL_HOST>:8123/api/webhook/<WEBHOOK_ID>
> # 405 Method Not Allowed  ->  the webhook IS registered. Good.
> # 200 OK                  ->  NOT registered: wrong id, automation disabled,
> #                             or automations not reloaded.
> ```
>
> Worth re-running on party day before guests arrive.
>
> #### 5. If it doesn't work, read the HA log
>
> Turn on debug logging:
>
> ```yaml
> logger:
>   default: warning
>   logs:
>     homeassistant.components.webhook: debug
> ```
>
> | Log line | Cause |
> | --- | --- |
> | `Received message for unregistered webhook <id> from <ip>` | Wrong id, automation disabled, or not reloaded |
> | `Received remote request for local webhook <id>` | `local_only` rejection — check the source IP; you're calling from a non-private address (see step 6) |
> | `Webhook <id> only supports POST methods but GET was received` | Method mismatch (also a visible 405) |
> | `Error processing webhook <id>` + traceback | Malformed JSON, or a template/action error |
> | `A request from a reverse proxy was received from <ip>, but your HTTP integration is not set-up for reverse proxies` | Something added `X-Forwarded-For`; the request got a 400 |
> | `Received X-Forwarded-For header from an untrusted proxy <ip>` | Proxy IP missing from `trusted_proxies`; 400 |
>
> #### 6. Report the URL back
>
> Set on the party container:
>
> ```
> HA_WEBHOOK_URL=http://<HA_INTERNAL_HOST>:8123/api/webhook/<WEBHOOK_ID>
> ```
>
> `<HA_INTERNAL_HOST>` must be an **internal** address:
> - the Docker compose service name for Home Assistant (`homeassistant`), or
> - the host's LAN IP (`192.168.x.x` / `10.x.x.x`), or
> - `127.0.0.1` if the site runs with host networking.
>
> **Do not use the public hostname, and do not route via Tailscale.** `local_only: true` only accepts loopback, RFC1918 private, and link-local source addresses. A public IP or a Tailscale CGNAT address (`100.64.0.0/10`) is silently rejected — with a `200 OK`, so you'd never notice. Docker bridge addresses (`172.17–172.31.x.x`) are private and pass fine.
>
> Do not expose `/api/webhook/` through the reverse proxy that serves `bday.moeriki.com`, and do not create a DNS record for Home Assistant. The call is server-to-server; guests' phones never talk to Home Assistant.
>
> #### 7. Optional — more than one effect
>
> To vary the effect per hunt node, either branch inside this one automation on `{{ node }}`, or create one automation per node with its own webhook id and give us one env var per node (`HA_WEBHOOK_URL_<NODE>`). One webhook branching on the payload is simpler and is what we assume by default. Note that reusing a single webhook id across several automations is documented as unsupported — don't.

---

## 7. What the site must implement

- One env var, `HA_WEBHOOK_URL`. **Unset is valid** and means "skip the HA call".
- `POST`, `Content-Type: application/json`, body `{"team": "...", "node": "...", "event": "scan"}`.
- 2 s timeout, no retries, all errors swallowed and logged, never on the page-render path.
- No `X-Forwarded-For` header on the outbound call.
- The URL never reaches the browser — back end only.

## 8. Analysis handoff — questions for MM

Everything above is derived from documentation and source. **None of it has been run against the actual house.** MM has the Home Assistant instance, knows the lights, the network and the containers, and will be the one operating this on the night. This section is a request for MM's own analysis — not a form to fill in, but the things we can't determine from outside and would rather learn now than at 20:00 on August 14th.

> ### Analysis request: treasure-hunt lights
>
> We've researched the Home Assistant side (webhook trigger, `local_only`, payload access — see the sections above). Before we finalise the treasure-hunt design and the deployment doc, we'd like **your** read on how this actually works once it's set up in this house. Please answer in prose where a list would lose the nuance — if you think our whole approach is wrong, say so.
>
> #### A. Does the plan survive contact with the real setup?
>
> 1. **What HA version are you running?** Our findings are verified against Core 2026.7.4. If you're on something older than 2024.2, the `local_only` default differs and the automation YAML may need the legacy `trigger:` / `platform:` spelling.
> 2. **Is our webhook-over-REST-API recommendation right for your setup?** We chose it so the party site never holds an HA token. If you'd rather we called the REST API — or something else entirely, like MQTT or a `POST /api/events/` — tell us now; it's a small change on our side and a bigger one later.
> 3. **Is anything about the "site container POSTs to HA on the same host" assumption wrong?** We concluded `local_only: true` is safe because Docker bridge addresses are RFC1918. If HA reaches the network in a way we haven't anticipated (host networking, a macvlan, HA OS in a VM, a proxy in front, Tailscale anywhere in the path), that conclusion could be wrong and we'd rather hear it from you than discover it via a silent `200 OK`.
>
> #### B. What can the lights actually do?
>
> 4. **Which lights are realistically in play**, and where are they? The treasure hunt is a physical hunt through the house — a light that flashes in a room nobody is standing in achieves nothing. Which rooms have controllable lights that guests will plausibly be looking at?
> 5. **Are they colour-capable, and do they support `flash`?** Our example YAML uses `rgb_color` and a manual on/off loop. If you have bulbs with native effects, your version will be better than ours — please write the automation the way you'd actually want it.
> 6. **How fast do they respond?** Zigbee, Wi-Fi and cloud-backed bulbs differ by a lot. If there's a 3-second lag between scan and flash, the effect doesn't land and we should design the hunt around that (e.g. a sustained colour change rather than a flash).
> 7. **What happens to the lights afterwards?** Our automation turns the light off at the end of the loop, which is wrong if the room light was on. Should it restore the previous state (scene snapshot), and do you want to handle that?
>
> #### C. How do you see this behaving on the night?
>
> 8. **Concurrency.** Several teams may scan within seconds of each other. We set `mode: queued, max: 25`. Do you expect queued flashes to read as chaos? Would you rather rate-limit, debounce, or have simultaneous scans merge into one effect?
> 9. **Per-team effects.** We're passing `team` and `node` in the payload so you can give each team its own colour. Is that worth it in a house where everyone sees the same lamp, or is a single "something happened" effect actually better? You'll have a better instinct for this than we will.
> 10. **Do you want to drive anything beyond lights?** Media players, TTS on a speaker, a notification to a phone — the payload gives you team and node, so anything HA can do is on the table. Tell us what you'd like to build and we'll make sure the hunt design gives you the hooks.
> 11. **What's your failure plan?** If HA is restarting, or an automation gets disabled by accident, the site will silently carry on and the guests will never know. Is there anything you'd want to monitor, or a way you'd want to be alerted mid-party?
>
> #### D. Operational
>
> 12. **How do you want to hand us the URL?** We need `HA_WEBHOOK_URL` set on the party container. Are you setting env vars directly, or do you want us to define a `.env` file for you to fill in?
> 13. **Is HA behind a reverse proxy?** If yes, we need to know whether `use_x_forwarded_for` and `trusted_proxies` are configured — a stray `X-Forwarded-For` on an unconfigured setup turns our call into an HTTP 400 ([§1.6](#the-three-ways-this-could-still-break)).
> 14. **One webhook or several?** Our default assumption is one webhook that branches on the `node` field. If you'd rather have one automation per hunt node — easier to edit, easier to disable individually — we'll supply one env var per node instead.
> 15. **When can you test it?** The `GET` → `405` liveness trick in [§6.4](#4-the-one-reliable-liveness-probe) is the only way to prove the webhook is registered without watching a lamp. We'd like a confirmed-working end-to-end test at least a day before the party, not on the day.
>
> #### E. Anything we've missed
>
> 16. **What have we got wrong?** We researched this from the docs and the HA source without touching the instance. If there's something obvious about this house — the lights, the network, how you run things — that makes part of the above naive, we'd rather rewrite it now.

### What we'll do with the answers

- A–B feed the treasure-hunt design: how many hunt nodes, where they are, what the payoff feels like.
- C decides whether `team` stays in the payload contract, and whether the site needs to rate-limit its own calls.
- D goes straight into `MM-HANDOFF.md` ([#13](https://github.com/moeriki/tinker-lab/issues/13)) — env vars, networking, and the pre-party test.
- E is the one that matters most.

## 9. Version notes and recent changes

Applies to **HA Core 2026.7.4**. Each row below was verified against tagged source, not just release notes.

| Version | Change |
| --- | --- |
| **2023.5** | `allowed_methods` and `local_only` **introduced**. Previously all webhooks accepted `HEAD`/`POST`/`PUT` **from anywhere**. New defaults: `POST` + `PUT` only. ([release notes](https://www.home-assistant.io/blog/2023/05/03/release-20235/): *"Previously all webhook triggers could be activated by `HEAD`, `POST`, and `PUT` methods from any device (local or on the internet). With the new options, only `POST` and `PUT` are enabled by default."*) Confirmed absent at tag `2023.4.0`, present at `2023.5.0`. |
| **2023.7** | Omitting `local_only` started raising a **repair issue**, per the 2023.5 announcement: *"In Home Assistant Core 2023.7, any webhook trigger that does not set `local_only` to false can only be activated by devices on the same network as Home Assistant."* (The 2023.7 release post itself does not mention it.) |
| **~2024.2** | Repair issue removed; `local_only` **silently defaults to `True`**. Bisected by tag: `2024.1.0` still has the repair path, `2024.2.0` has `config.get(CONF_LOCAL_ONLY, True)`. Unchanged through 2026.7.4. No release-note text describing this was found. |
| **2024.10** | `trigger:`→`triggers:`, `condition:`→`conditions:`, `action:`→`actions:`, `platform:`→`trigger:`. **Not breaking, no deprecation, old syntax retained indefinitely.** ([release notes](https://www.home-assistant.io/blog/2024/10/02/release-202410/)) |
| undated | JSON parsing changed from `await request.json()` to `json_loads(text) if text else {}` — empty bodies now yield `{}` instead of raising. (`2023.4.0` vs `dev`) |

**Nothing after 2024.10 changes any of this.** The 2025.12 release ([notes](https://www.home-assistant.io/blog/2025/12/03/release-202512/)) added purpose-specific triggers/conditions as a Labs preview but did not touch webhook triggers or the HTTP/REST API. `async_handle_webhook` is identical between the `2026.7.4` tag and `dev`.

**Could not be verified from a primary source** (stated rather than guessed):
1. The exact release that changed `local_only` from repair-issue to defaulting `True` — bisected to between `2024.1.0` and `2024.2.0` by source, but no release note describes it.
2. Whether the cloudhook `remote=None` behaviour ([§1.6](#flagged-discrepancy-cloudhooks)) is intended or a regression. Code and docs disagree; no resolving issue found.

## Sources

**Documentation**
- [Automation triggers → Webhook trigger](https://www.home-assistant.io/docs/automation/trigger/#webhook-trigger)
- [Automation templating → Webhook](https://www.home-assistant.io/docs/automation/templating/#webhook)
- [Webhook integration](https://www.home-assistant.io/integrations/webhook/)
- [http integration](https://www.home-assistant.io/integrations/http/)
- [Authentication](https://www.home-assistant.io/docs/authentication/)
- [Developer docs → REST API](https://developers.home-assistant.io/docs/api/rest/)
- [Developer docs → Auth API, long-lived access tokens](https://developers.home-assistant.io/docs/auth_api/#long-lived-access-token)

**Source code** (home-assistant/core, verified on `dev` and tag `2026.7.4`)
- [`components/webhook/__init__.py`](https://github.com/home-assistant/core/blob/dev/homeassistant/components/webhook/__init__.py)
- [`components/webhook/trigger.py`](https://github.com/home-assistant/core/blob/dev/homeassistant/components/webhook/trigger.py)
- [`util/network.py`](https://github.com/home-assistant/core/blob/dev/homeassistant/util/network.py)
- [`components/http/forwarded.py`](https://github.com/home-assistant/core/blob/dev/homeassistant/components/http/forwarded.py), [`ban.py`](https://github.com/home-assistant/core/blob/dev/homeassistant/components/http/ban.py), [`auth.py`](https://github.com/home-assistant/core/blob/dev/homeassistant/components/http/auth.py), [`server.py`](https://github.com/home-assistant/core/blob/dev/homeassistant/components/http/server.py), [`__init__.py`](https://github.com/home-assistant/core/blob/dev/homeassistant/components/http/__init__.py)
- [`helpers/http.py`](https://github.com/home-assistant/core/blob/dev/homeassistant/helpers/http.py), [`util/json.py`](https://github.com/home-assistant/core/blob/dev/homeassistant/util/json.py)
- [`components/automation/__init__.py`](https://github.com/home-assistant/core/blob/dev/homeassistant/components/automation/__init__.py), [`components/cloud/client.py`](https://github.com/home-assistant/core/blob/dev/homeassistant/components/cloud/client.py)
- home-assistant/frontend — [`ha-automation-trigger-webhook.ts`](https://github.com/home-assistant/frontend/blob/dev/src/panels/config/automation/trigger/types/ha-automation-trigger-webhook.ts)
- Tags compared: `2021.12.0`, `2023.4.0`, `2023.5.0`, `2023.7.0`, `2024.1.0`, `2024.2.0`, `2024.4.0`, `2024.7.0`, `2025.1.0`, `2026.7.4`

**Release notes**
- [2023.5](https://www.home-assistant.io/blog/2023/05/03/release-20235/) · [2023.7](https://www.home-assistant.io/blog/2023/07/05/release-20237/) · [2024.10](https://www.home-assistant.io/blog/2024/10/02/release-202410/) · [2025.12](https://www.home-assistant.io/blog/2025/12/03/release-202512/) · [index](https://www.home-assistant.io/blog/categories/release-notes/)
