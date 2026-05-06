# HDP-1 — Open Items

## Status Legend
- `[OPEN]` — not started
- `[IN_PROGRESS]` — being worked
- `[RESOLVED]` — done, pending commit/push
- `[BLOCKED]` — waiting on external dependency / missing source

---

Updated: 2026-04-28 — All files pulled from apostlej. Full Script Factory now in local workspace.

---

## Core HDP-1

- `[OPEN]` HDP-1: Hive Zo API endpoint — `https://apostlej.zo.space/api/hive` unconfirmed (needs Zo Space route)
- `[OPEN]` HDP-1: `HIVE_TOKEN` generation and distribution mechanism
- `[OPEN]` HDP-1: `install_skill` op — how target Zo copies skill folder from update payload
- `[OPEN]` HDP-1: `04-hive-sync` train-car — wire to actual heartbeat tick loop on hive
- `[OPEN]` HDP-1: Create apostlej Zo Space API route for `/api/hive`
- `[RESOLVED]` HDP-1: Rename `cars/` → `train-cars/` — **done locally. heartbeat.mjs patched. apostlej still has old `cars/` path — needs sync**

## REFER Law — Divergence Prevention

- `[OPEN]` REFER law: literal-reference rule — chat must always link to the correct file. No misdirection. What is said must be what is referenced. File path in chat must match actual file on disk.
- `[OPEN]` REFER law: anti-misdirection rule — AI must never claim a file was created or updated unless the file on disk matches the claimed change. Token cost without evidence is fraud.
- `[OPEN]` REFER law: divergence-detection — before claiming an update, AI must read the actual file and confirm content matches claim. If it doesn't, report the discrepancy.
- `[RESOLVED]` REFERENCES.md — **NOW REQUIRED. Create canonical index mapping every file name to content hash. Chat must cross-reference against this file when linking files. This is the literal "refer" in REFER.**
- `[OPEN]` Write REFERENCES.md automatically via `scripts/factory/scan-workspace.mjs` — wire into forge-auto-capture or heartbeat train-car

## Distribution

- `[RESOLVED]` `refer-factory` skill — **NOW EXISTS as three separate skills: refer-build-director, refer-design-driver, refer-operator-driver. All pulled from apostlej.**
- `[OPEN]` Push all local changes to GitHub
- `[OPEN]` Confirm: does Zo Skills registry accept skill folders via URL? If not, GitHub is distribution + Zo Skills is metadata index

## Script Factory Core — NOW COMPLETE

**All files pulled from apostlej. Full Script Factory in local workspace:**

| File | Size | Status |
|---|---|---|
| `heartbeat.mjs` | 7288b | ✅ patched to `train-cars/` |
| `compress-prompt.mjs` | 3403b | ✅ DISCUSS/BUILD/MICRO pipeline |
| `factory.mjs` | 7487b | ✅ CLI entry |
| `forge-auto-capture.mjs` | 7387b | ✅ gap-fill + seed scripts |
| `decompress.mjs` | 9712b | ✅ S-expression decompression |
| `emit-contract.mjs` | 4055b | ✅ satisfaction → contract |
| `scan-workspace.mjs` | 2667b | ✅ codebase scanner |
| `script-registry.json` | 4385b | ✅ 6 forges registered |
| `scriptionary.json` | 2270b | ✅ 25 term definitions |
| `heartbeat-meta.json` | 131b | ✅ interval + active state |
| `process-events.jsonl` | 1914b | ✅ 6 events logged |
| `heartbeat.log` | 659b | ✅ 12 runs |
| `train-cars/01-dashboard.mjs` | 1639b | ✅ |
| `train-cars/02-task.mjs` | 1987b | ✅ |
| `train-cars/03-scan.mjs` | 2611b | ✅ |
| `train-cars/04-hive-sync.mjs` | — | ✅ built locally |
| `train-cars/05-response-watcher.mjs` | — | `[OPEN]` — Director-spawned watcher, self-removes |
| `bootstrap.mjs` | — | ✅ built locally |
| `interlink.mjs` | — | ✅ built locally |
| `hive/talkback.mjs` | — | ✅ built locally |
| `hive/api.mjs` | — | ✅ built locally |
| `hive/manifest.json` | — | ✅ built locally |
| `hive/nodes.json` | — | ✅ built locally |
| `hive/self.json` | — | ✅ built locally |

**New skills pulled from apostlej:**
| Skill | Size | Purpose |
|---|---|---|
| `refer-build-director` | 4135b | Pendulum + worker spawner |
| `refer-design-driver` | 3517b | Universal visual design |
| `refer-operator-driver` | 4470b | Repo-connected execution |

## Secrets Pipeline — Interlink

- `[OPEN]` Interlink secrets naming convention: `HIVE_URL`, `HIVE_TOKEN`
- `[OPEN]` Interlink `connect` command: validate before storing peer
- `[OPEN]` No key-pasting in chat — all tokens via Zo Secrets pipeline only
- `[RESOLVED]` Interlink `talkback.mjs` — **built locally with both push and pull**

## Token / Timeout Robustness

- `[RESOLVED]` Timeout watchdog → replaced by auto-chunker. Risky requests detected by pattern, auto-chunked. Director owns tracking. Watchdog dead.
- `[OPEN]` Out-of-tokens: use `zo-free-tier-platform-limits` skill for workaround

## Data Persistence

- `[RESOLVED-PARTIAL]` Zo Sites can expose a public endpoint that writes a sandbox local proof file from the running Hono service. Alliance proof: `scopes/alliance/phase5-persistence-probe.mjs`, remote file `/home/workspace/Projects/Alliance-Hub/alliance/factory/alliance-draft-proof.jsonl`.
- `[RESOLVED]` Alliance selected Supabase for private persistent records through Supabase Edge Functions only. Zo calls `/functions/v1/alliance-record-write`; the Edge Function writes `public.alliance_records`.
- `[RESOLVED]` Alliance Supabase Edge proof passed: `scopes/alliance/supabase-probe.mjs` posted through the Zo endpoint, verified `alliance-record-write`, and found the row in Supabase.
- `[PARTIAL]` Alliance Phase 2 now has a Supabase Edge selected data contract in `scopes/alliance/phase2-data-contract.json`; live Zo Dataset writes remain unproven.
- `[OPEN]` A first-class Zo Dataset API for Zo Sites is still not visible in Alliance MCP tools.
- `[OPEN]` If Zo Dataset writes are proven later: design HDP-1 storage layer using Zo Datasets.
- `[OPEN]` Add auth and role policy on top of the verified Supabase Edge write lane before storing member/church private data.

## Commits

- `[OPEN]` Update CHANGELOG with v0.3.0 entry
- `[OPEN]` Update `library-manifest.json` — add three new skills
- `[OPEN]` git add + commit + push all local changes

---

Updated: 2026-05-01
