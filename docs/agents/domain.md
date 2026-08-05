# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Before exploring, read these

- **`CONTEXT.md`** at the repo root, or
- **`CONTEXT-MAP.md`** at the repo root if it exists — it points at one `CONTEXT.md` per context. Read each one relevant to the topic.
- **`docs/adr/`** — read ADRs that touch the area you're about to work in. In multi-context repos, also check `src/<context>/docs/adr/` for context-scoped decisions.

If any of these files don't exist, **proceed silently**. Don't flag their absence; don't suggest creating them upfront. The `/domain-modeling` skill (reached via `/grill-with-docs` and `/improve-codebase-architecture`) creates them lazily when terms or decisions actually get resolved.

## File structure

This repo is **single-context**: one `CONTEXT.md` and one `docs/adr/` at the root.

```
/
├── CONTEXT.md
├── docs/adr/
│   ├── example-decision.md
│   └── another-decision.md
└── src/
```

Both exist in this repo. In a repo where they don't, that's expected too — `/domain-modeling`
creates them lazily.

## An ADR is identified by its slug

**Never number an ADR.** The file is `docs/adr/<slug>.md`, the `# ` title line is the decision
itself with no prefix, and a citation is `ADR-<slug>` — in prose, in a code comment, or as the text
of a Markdown link pointing at the file.

The rule exists because a number has to be *allocated*, and an identifier allocated by counting
what already exists collides the moment two sessions count at the same time. That happened here:
two ADRs both landed as `0011`, and neither session was careless — both counted correctly at the
moment they looked. A slug is not allocated, so it cannot race, and if two sessions somehow chose
the same one git rejects the second as a path conflict on rebase. Enforcement is free and already
installed.

Citations stop needing a lookup as a side effect: `ADR-0011` names nothing, whereas
`ADR-the-tile-is-the-unit-of-value` names the decision. The cost — `docs/adr/` no longer lists in
the order the decisions landed — is accepted; git knows when each one arrived and nothing reads the
directory in order.

If this repo ever grows into a monorepo with genuinely separate contexts, switch to multi-context: a root `CONTEXT-MAP.md` pointing at one `CONTEXT.md` per context, with context-scoped ADRs under `src/<context>/docs/adr/`.

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `CONTEXT.md`. Don't drift to synonyms the glossary explicitly avoids.

If the concept you need isn't in the glossary yet, that's a signal — either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/domain-modeling`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-event-sourced-orders — but worth reopening because…_
