# Chat Contracts Ledger

**Dataset ID:** `chat-contracts`
**Parent:** Script Factory — compress-prompt.mjs (intake)
**Storage:** `DuckDB` + `data.duckdb` + `datapackage.json`

---

## Purpose

Canonical log of every intake contract, chunk session, and routing decision made by the Script Factory intake engine.

This is the primary audit trail for all prompts processed by the Script Factory.

---

## Schema

| Column | Type | Description |
|---|---|---|
| `id` | VARCHAR | Unique contract ID |
| `session_id` | VARCHAR | Chunk session this contract belongs to |
| `prompt` | VARCHAR | Raw user prompt |
| `mode` | VARCHAR | DISCUSS / BUILD / MICRO / PLAN |
| `risk` | VARCHAR | bounded / unknown / risky |
| `chunks` | INT | Number of chunks (1 = no chunking) |
| `chunk_index` | INT | Index of this chunk in the session |
| `needs_chunking` | BOOLEAN | Whether auto-chunking was applied |
| `chunk_reason` | VARCHAR | Why chunking was triggered (if any) |
| `matched_script` | VARCHAR | Script ID if a script was matched |
| `requires_ai` | BOOLEAN | Whether AI is required for this mode |
| `has_questions` | BOOLEAN | Whether script has outstanding questions |
| `status` | VARCHAR | pending / done / error |
| `error_detail` | VARCHAR | Error message if status = error |
| `created_at` | TIMESTAMP | ISO timestamp when contract was created |

---

## Who Writes

- `compress-prompt.mjs` — every `intake()` call writes one row at contract creation
- `compress-prompt.mjs` — also writes chunk session metadata row before branching

## Who Reads

- `04-hive-sync.mjs` — reads last contract mode to decide whether to spawn a worker
- `02-spawn-worker.mjs` — can read session to get chunk count for large prompts
- `request-watchdog.mjs` — can cross-reference session_id for timeout tracking

## Notes

- Each prompt produces exactly 1 contract row (not per-chunk)
- Chunk sessions are tracked separately via `session_id` linking
- `risk = unknown` indicates BUILD mode that lacks satisfaction criteria
- Use `status = pending` to flag PLAN-only contracts awaiting user approval