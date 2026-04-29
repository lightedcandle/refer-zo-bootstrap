# Node Identity

**Dataset ID:** `node-identity`
**Parent:** Script Factory — self.json (self) / talkback.mjs (peers)
**Storage:** `DuckDB` + `data.duckdb` + `datapackage.json`

---

## Purpose

Registry of all known hives in the factory network — including self and all discovered peers.

This is the factory's own identity plus the roster of other hives it knows about.

---

## Schema

| Column | Type | Description |
|---|---|---|
| `node_id` | VARCHAR | Unique node identifier (e.g., telechurch, jamaicaeats) |
| `type` | VARCHAR | cell / factory / unknown |
| `endpoint` | VARCHAR | Base URL of the hive's Zo API (e.g., https://api.zo.computer) |
| `access_token` | VARCHAR | Encrypted or masked token reference |
| `token_env_var` | VARCHAR | Name of the env var holding the actual token |
| `status` | VARCHAR | active / stale / unreachable |
| `last_seen` | TIMESTAMP | Last time this hive responded to a talkback |
| `version` | VARCHAR | Last known refer-version |
| `capabilities` | VARCHAR | JSON array of known capabilities (talkback, dispatch, etc.) |
| `notes` | VARCHAR | Human notes |

---

## Self vs Peers

- **Self row**: `node_id = local` — always present, identifies this hive
- **Peer rows**: discovered via talkback scan or manually added

---

## Who Writes

- `talkback.mjs` — writes self on startup, writes peer on discovery
- `bootstrap.mjs` — updates self when version or capabilities change
- `04-hive-sync.mjs` — updates last_seen on successful scan

## Who Reads

- `dispatcher.mjs` — reads peers to know where packages can be sent
- `bootstrap.mjs` — reads self row to determine local identity
- `talkback.mjs` — reads peers to know which hives to ping

## Notes

- Never store raw token values — store `token_env_var` and let the code read from env
- `status = stale` means last_seen is more than 24 hours ago
- `capabilities` is JSON array, e.g.: `["talkback","dispatch","request-watchdog"]`