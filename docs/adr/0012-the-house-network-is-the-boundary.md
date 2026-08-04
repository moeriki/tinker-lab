# ADR-0012: The house network is the boundary

**Status:** accepted · **Date:** 2026-08-05 · **Ticket:** [Decide how guests get onto the network](https://github.com/moeriki/tinker-lab/issues/20)

## Context

`bday.moeriki.com` resolves publicly, from Route 53, to `192.168.128.2` — an RFC1918 address,
the same one `ha.moeriki.com` already uses. The site is therefore reachable only from inside the
house.

That arrangement was inherited rather than chosen: `bday` got the `ha` record because `ha` was
the record that existed. Left unexamined it puts joining the WiFi on the critical path of the
entire game, and the failure is unusually harsh. Every other failure on this project degrades —
a missing photo, a webhook that silently does nothing, a hint that does not render. This one does
not. A phone that is not on the house WiFi gets a **connection timeout**, not an error page and
not a redirect, because we are not reachable to say anything to it.

## Decision

**LAN-only, deliberately.** The house network is the game's authorisation boundary. There is no
tunnel and no port-forward, and `bday` keeps the internal A record.

The accepted cost is that a guest not on the WiFi cannot play, and cannot be told why. The
mitigation is **physical and outside the software**: a WiFi QR code on the wall, plus the fact
that most guests have been to the house before and their phones join automatically.

## Consequences

- **This is the second leg under "no anti-cheat."** The first is that leaking a code is the point
  — teams shouting hiding spots at each other is the goal. The second is that reaching the site
  at all requires standing in the house. Neither leg alone would carry the decision; together
  they mean no code path needs to distrust a scan.
- **Nothing in the app can detect or report this failure.** There is no "please join the WiFi"
  page to write, because rendering one requires being reachable. Any future attempt to handle it
  in software is a category error.
- **`MM-HANDOFF.md` says not to expose it.** Making the site public later would delete the
  boundary while leaving every consumer of it — chiefly the absence of anti-cheat — in place.
  Reversing this is a decision, not a config tweak.
- Guest onboarding is a **physical setup item**, not a route: the wall QR has to be up before
  the first guest arrives, and it is not something the deploy checklist can verify.

## Alternatives considered

**Cloudflare Tunnel.** A connector on the Unraid host dials out to Cloudflare, which serves
`bday.moeriki.com` publicly down that outbound connection — no firewall hole, no port-forward.
Rejected on two counts: it requires moving the domain's DNS to Cloudflare, which is MM's to own
and a real change to unrelated infrastructure; and a publicly reachable scoreboard with
cookie-only identity and no anti-cheat is a worse artifact than an unreachable one.

**Port-forward plus a public A record.** Cheaper to arrange and strictly worse — it opens the
house to the internet to solve a problem that a QR code on a wall already solves.

**Nothing, i.e. leave it inherited.** Rejected because the question is not whether the current
behaviour is right but whether anyone has looked at it. An unexamined constraint that silently
gates the whole game is the kind of thing that surfaces at 20:15 on the night.
