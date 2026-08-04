# ADR-0005: Admin access is a one-time secret URL

**Status:** accepted · **Date:** 2026-08-04 · **Ticket:** [Domain model and route inventory](https://github.com/moeriki/tinker-lab/issues/6)

## Context

The host needs a phone-friendly admin surface — live scores, judging, end game — on a site with
no accounts and no passwords by design. Guests will poke at `/admin` for fun.

## Decision

`GET /admin/key/:secret` compares against an `ADMIN_SECRET` environment variable, sets an
httpOnly admin cookie, and redirects to `/admin`. Every other `/admin*` route requires that
cookie and **responds 404 without it** — not 401.

The host visits the secret URL once, at the start of the night.

## Consequences

- The secret appears in exactly one URL, never in links or forms.
- A guest who guesses `/admin` sees the ordinary not-found page and learns nothing. There is
  nothing to brute-force because there is nothing that admits an admin surface exists.
- Losing the phone means visiting the secret URL again on another one.

## Alternatives considered

**Basic auth.** A browser credential dialog is an ugly interruption on a phone, and the mission
rules out passwords.

**Secret path prefix on every admin route** (`/x/<secret>/teams`). Puts the secret in every link
and form action, where it leaks into screenshots and shoulder-surfing.
