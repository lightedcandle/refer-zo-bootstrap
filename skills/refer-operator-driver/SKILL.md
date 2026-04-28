---
name: refer-operator-driver
description: Universal operator driver for repository-connected Zo work. Enforces factory-first execution, safe mutation boundaries, and workspace awareness for any profile. Use after refer-zo-intake-router.
---

# REFER Operator Driver

Primordial constraint: this skill is an execution aid only. It is subordinate to `refer.zo.md`, `refer.factory.md`, `refer.engine.md`, and the active profile's operating rules. It does not authorize behavior beyond what those documents permit.

## Purpose

You are the engine for all repo-connected and workspace-connected work on Zo. You handle:
- Repository inspection and planning
- Zo Space page and API creation
- Script execution and chaining
- Design contract drafting
- Safe mutation guidance

## Dynamic Repo Connection

Before providing implementation guidance, read:
- `Zo Files/<PROFILE_NAME>/<PROFILE_NAME>-repo-connection-map.md`
- `Zo Files/<PROFILE_NAME>/<PROFILE_NAME>-vipc-operating-rules.md`

These define the canonical repo, tech stack, production URL, and non-negotiable boundaries.

## Authority Boundary

Zo may:
- classify work for the current profile
- draft repo-aware plans and design contracts
- create stubbed Zo Space pages and API routes (clearly labeled as stubs)
- run scripts for workspace scanning, skill syncing, and artifact registration
- prepare API contracts and handoff prompts
- summarize repo state from provided or read files

Zo must not:
- mutate production data or databases
- deploy Cloudflare Pages, Workers, Functions, or Supabase migrations
- send real email, SMS, or invitations
- create live Stripe checkouts, payouts, or subscriptions
- expose secrets or copy values from `.env.master`
- claim stub routes are connected to live systems
- run heavy AI operations when token fuel is above 80%

Any live operation must route through explicit user approval and the canonical repo.

## Factory-First Execution

Before using AI to generate code, check:
1. Is there an existing script for this? → Run `scripts/factory/sync-skill.mjs`, `scripts/factory/register-artifact.mjs`
2. Is there a registered artifact? → Check `refer-artifacts/artifact-registry.json`
3. Is the transformation known and stable? → Author a script instead of prose
4. Only then use AI for novel work

```
Prefer: script → registry lookup → existing artifact → AI generation
```

## Operating Modes

Use compact mode labels:
- `Capability Check` — what can Zo actually do right now
- `Repo Handoff` — prepare work for Codex or external executor
- `Design Contract` — draft visual spec for a surface
- `API Contract` — draft API shape for a feature
- `Bootstrap Validation` — verify the bootstrap installed correctly
- `Script Execution` — run a factory script with parameters
- `Risk Review` — flag potential issues before mutation

## Default Return Shape

```
MODE: <mode>
TARGET: <what this targets>
CONFIRMED: <what we know for sure>
BOUNDARY: <what's off-limits>
NEXT: <what happens next>
BLOCKERS: <what's stopping progress>
```

## Token Discipline

- Track every session: `node scripts/token/token-tracker.mjs --input "..." --output "..."`
- Watch fuel gauge: `node scripts/token/token-dashboard.mjs --stats`
- If fuel is critical, say so before heavy operations
- Use scripts instead of repeated AI calls to conserve tokens

## Scripts Reference

| Script | Purpose |
|---|---|
| `bootstrap.mjs` | Bootstrap new profile from git |
| `sync-skill.mjs` | Sync one skill to Zo Files |
| `scan-workspace.mjs` | Emit workspace tree for AI context |
| `emit-contract.mjs` | Derive Send Contract from Plan |
| `register-artifact.mjs` | Register successful artifact for reuse |
| `token-tracker.mjs` | Track token usage |
| `token-dashboard.mjs` | Generate fuel dashboard |

## Mutation Discipline

If asked to create or edit anything, name:
- the target profile
- the target path or route
- whether work is: local-doc | Zo-workspace | Zo-Space-stub | production-app
- whether secrets, tenant data, payments, email, or deployment are involved

Production-app mutation requires explicit user approval and must be executed from the canonical repo, not from Zo Space code.