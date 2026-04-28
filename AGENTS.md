# refer-zo-bootstrap — Zo-Native REFER Bootstrap

**Version:** 0.3.0  
**Purpose:** Factory-first Zo computer bootstrap via git.  
**Git repo:** https://github.com/lightedcandle/refer-zo-bootstrap

---

## What This Repo Is

Portable bootstrap that installs into any Zo computer from a single git clone.
Gives Zo:
- Startup binder (`agent.md` + `AGENTS.md`)
- `REFER.OS` law files (selected, Zo-appropriate)
- 8 universal skills under `Skills/`
- 5 factory scripts + 2 token scripts under `Scripts/`
- Token fuel tracker with dashboard

## Factory-First Doctrine

```
Script → Registry lookup → Existing artifact → AI generation
```

- **Scripts** do repetitive work (bootstrap, sync, scan, emit, register)
- **AI** reasons and handles novelty
- **Every successful pattern** gets registered for reuse
- This reduces token burn by replacing repeated AI calls with durable machinery

## Skill Library (8 Skills)

| Skill | Role |
|---|---|
| `refer-os` | Startup binder — read agent.md/AGENTS.md first |
| `refer-zo-intake-router` | Classify every request before acting |
| `refer-governance` | Law updates, authority drift, routing checks |
| `refer-contract-tandem` | Zo↔Codex bridge, bounded tracker execution |
| `refer-library-bootstrap` | Skill version reconciliation on boot |
| `refer-build-director` | Autonomous pendulum orchestrator (activate via automation) |
| `refer-design-driver` | Universal visual design overlay (any platform) |
| `refer-operator-driver` | Repo/workspace-connected work engine |

## Scripts

**Factory scripts** (`scripts/factory/`):
- `bootstrap.mjs` — Bootstrap a new profile from git
- `sync-skill.mjs` — Sync one skill from repo to Zo Files
- `scan-workspace.mjs` — Emit workspace code tree for AI context
- `emit-contract.mjs` — Derive Send Contract from Plan markdown
- `register-artifact.mjs` — Register successful artifact for reuse

**Token scripts** (`scripts/token/`):
- `token-tracker.mjs` — Track token usage per session (4 chars/token estimate)
- `token-dashboard.mjs` — Generate HTML fuel dashboard

Run scripts with: `node scripts/<category>/<script>.mjs --help`

## Install

```bash
git clone https://github.com/lightedcandle/refer-zo-bootstrap.git
cd refer-zo-bootstrap
node scripts/factory/bootstrap.mjs --profile <name> --repo . --local
```

Or remotely:
```bash
node scripts/factory/bootstrap.mjs --profile myapp --repo https://github.com/you/refer-zo-bootstrap.git
```

## Law Files (Selected for Zo)

Zo-appropriate only. Strictly Codex-specific docs (Angular compiler, spirit runtime, etc.) are pruned.

Included: `refer.md`, `refer.zo.md`, `refer.os.md`, `refer.skills.md`, `refer.plan.md`, `refer.flow.md`, `refer.governance.md`, `refer.factory.md`, `refer.engine.md`, `refer.efficiency.md`, `refer.supabase.md`, `refer.github.md`, `refer.file.md`, `refer.build.md`, `refer.commit.md`, `refer.qc.md`, `refer.branch.md`, `refer.odometer.md`, `refer.instantiation.md`, `refer.daylight.md`, `refer.shortlink.md`, `refer.honeycomb.md`, `refer.design.md`, `refer.structure.md`, `refer.auth.md`, `refer.stripe.md`, `refer.ontology.md`, `refer.api.md`, `refer.migrate.md`, `refer.combing.md`, `refer.expand.md`, `refer.repair.md`, `refer.seamless-ui.md`, `refer.identity.md`, `refer.cron.md`, `refer.systems.security.md`, `refer.talents.md`, `refer.og.md`, `refer.codebases.md`, `refer.law.index.md`, `refer.law.md`, `refer.law.crossref.md`, `refer.audit.md`, `refer.provider.google.md`

Excluded: Angular-specific, Codex provider docs, spirit runtime, compiler docs, tribal E2E artifacts.

## Token Discipline

- Every session: `node scripts/token/token-tracker.mjs --input "..." --output "..."`
- Watch fuel: `node scripts/token/token-dashboard.mjs --stats`
- If fuel > 80%, pause heavy AI work and alert
- Scripts first — they cost zero AI tokens

## Startup Binding

On every session start, Zo reads:
1. `agent.md` (if present in Zo Files workspace root)
2. `AGENTS.md` (if present)
3. `Skills/refer-os/SKILL.md` (entry wrapper)
4. `REFER.OS/refer.md` (router)

Skills load beneath these binders. Authority lives in law files, not in unstated memory.