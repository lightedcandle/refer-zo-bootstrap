# Nomenclature Sweep — Script Factory Coherence

## Governing Authority

**`scriptionary.json`** is the terminology authority. Every file, script, and concept in this repo must trace its name back to a definition in the scriptionary.

**Core rules from scriptionary:**
- `Forge` = one bounded conversion unit → file scripts that DO conversion
- `Factory` = governed forge domain → the parent system
- `Script Factory` = the system that creates, manages, and runs script forges
- `Script Legend` = terminology authority — use when terms conflict
- `Script Map` = relationship map — answers "what calls what"
- `Context Pickle` = compressed context bundle
- `Train Car` = heartbeat vehicle segment (per HDP-1)

## Naming Rules

1. **File names** are nouns, lowercase, hyphenated or numbered
2. **Forge files** = named by what they convert (verb-object: `add-button`, `scan-workspace`)
3. **No generic verbs alone**: `scan.mjs` → `scan-workspace.mjs`
4. **No role-noun collision**: `build-director.mjs` → the actual file name
5. **Subdirectories** = noun collections (plural or compound)
6. **Train Car files** = start with ordinal + role: `01-dashboard.mjs`, `02-task.mjs`
7. **Session artifacts** = `chunks/{session-id}.json`, `chunks/{session-id}.log`
8. **Skills** = `refer-{scope}-{role}.mjs` (Zo-native skill naming)

---

## Issues Found

### Tier 1 — Concept collisions (breaks meaning)

| Current | Problem | Should Be |
|---|---|---|
| `scripts/factory/compress-prompt.mjs` | "Engine" implies the whole system; it's one compression step | `compress-prompt.mjs` — it compresses prompts to S-expressions |
| `scripts/factory/train-cars/03-scan.mjs` | Generic `scan` with no object | `03-scan-workspace.mjs` — what it scans |
| `scripts/factory/train-cars/02-task.mjs` | "Task" is too generic for a forge | `02-spawn-worker.mjs` — what this train-car actually does |
| `scripts/factory/hive-sync.mjs` (in root) | Not a train-car, it's a standalone forge | Rename to `hive-sync-forge.mjs` or move to `forges/hive-sync/` |
| `chunks/chunk-*.json` | Session files named with "chunk" (verb) | Already correct — `chunks/` is the noun collection |

### Tier 2 — Name drift (Zo skill naming)

| Current | Problem |
|---|---|
| `skills/refer-build-director/` | Should align with Zo skill naming convention |
| `skills/refer-design-driver/` | Same |
| `skills/refer-operator-driver/` | Same |
| Skills use `refer-{name}.mjs` style in `scripts/factory/` |

### Tier 3 — Minor clarity

| Current | Issue | Suggestion |
|---|---|---|
| `forge-auto-capture.mjs` | Forge name, not "auto" | `forge-auto-capture.mjs` to match pattern |
| `emit-contract.mjs` | Not clear what it emits | `emit-contract-forge.mjs` or `forge-emit-contract.mjs` |
| `scan-workspace.mjs` | Already good but verify it maps to `scan-workspace` forge in registry |

---

## Train Car Audit

| File | Scriptorary Role | Verdict |
|---|---|---|
| `01-dashboard.mjs` | Dashboard state collector | ✅ Good |
| `02-task.mjs` | Worker spawner | Renamed → `02-spawn-worker.mjs` |
| `03-scan.mjs` | Gap scanner | Renamed → `03-scan-workspace.mjs` |
| `04-hive-sync.mjs` | HDP-1 sync | ✅ Good |

---

## Skills Audit

All Zo-native skills follow `refer-{scope}-{role}/SKILL.md` pattern. Check against `library-manifest.json` for alignment.

---

## Proposed Order

1. **Rename** Tier 1 concept collisions first (affects imports)
2. **Update** all import references in `factory.mjs`, `heartbeat.mjs`, train-cars
3. **Verify** imports with `node --check` on every file
4. **Update** `script-registry.json` if forge IDs change
5. **Push** clean to GitHub

---

## Canonical Reference

After renaming, update `scriptionary.json` with any new terms introduced.

*Generated: 2026-04-28 | Authority: scriptionary.json § Script Legend*
