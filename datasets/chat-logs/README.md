# Chat Logs

**Dataset ID:** `chat-logs`
**Parent:** Script Factory — heartbeat.mjs (heartbeat engine)
**Storage:** `DuckDB` + `data.duckdb` + `datapackage.json`

---

## Purpose

Canonical log of every heartbeat tick and what each train-car did during that tick.

This is the operational log of the heartbeat train — showing which cars ran, their outcomes, and how long they took.

---

## Schema

| Column | Type | Description |
|---|---|---|
| `tick` | INT | Heartbeat run count |
| `timestamp` | TIMESTAMP | ISO timestamp of tick start |
| `cars_run` | VARCHAR | Comma-separated list of car IDs that ran |
| `cars_skipped` | VARCHAR | Comma-separated list of car IDs that were skipped |
| `outcome` | VARCHAR | overall / ok / warn / error |
| `duration_ms` | INT | Total tick duration in milliseconds |
| `cars_detail` | VARCHAR | JSON array of per-car {id, status, duration_ms, error} |

---

## Train Cars (tickable units)

| Car | Purpose |
|---|---|
| `01-dashboard` | Updates heartbeat-state.json dashboard block |
| `02-spawn-worker` | Checks for pending PLAN contracts and spawns a Director worker |
| `03-scan-workspace` | Scans for missing scripts, stale context, or factory gaps |
| `04-hive-sync` | Checks hive manifest version, syncs if behind |

Each car must export either `run(state)` or `{ run(state) }` (both patterns supported).

---

## Who Writes

- `heartbeat.mjs` — every tick writes 1 row with which cars ran and their outcomes

## Who Reads

- `01-dashboard.mjs` — reads prior tick to compute dashboard delta
- `02-spawn-worker.mjs` — reads tick history to detect stuck or duplicate spawns
- `04-hive-sync.mjs` — reads tick log to determine heartbeat health and last sync time

## Notes

- `cars_detail` is JSON for future car-level error tracking
- `outcome = warn` means at least one car returned warn but none returned error
- Cars that return `{ continue: false }` are not counted as errors