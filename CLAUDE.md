# CLAUDE.md

## Agent skills

### Issue tracker

Issues live as GitHub issues on `moeriki/tinker-lab`, managed with the `gh` CLI. **Every `gh` call must be prefixed with `env GH_CONFIG_DIR=/Users/moeriki/.config/gh`** — the ambient config points at a work account that cannot write here. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical triage roles, using the default label strings. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context — one `CONTEXT.md` and one `docs/adr/` at the repo root. See `docs/agents/domain.md`.
