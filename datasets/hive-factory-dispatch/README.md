# Hive Factory Dispatch

**Dataset ID:** `hive-factory-dispatch`
**Parent:** Script Factory — dispatcher.mjs (outbound) / bootstrap.mjs (inbound)
**Storage:** `DuckDB` + `data.duckdb` + `datapackage.json`

---

## Purpose

Tracks every package dispatched from the local factory to other hives, and every package received from other factories.

This is the factory-to-factory coordination ledger. It answers: what did we send, to whom, when, and did they receive it?

---

## Schema

| Column | Type | Description |
|---|---|---|
| `id` | VARCHAR | Dispatch UUID |
| `direction` | VARCHAR | outbound / inbound |
| `from_hive` | VARCHAR | Source hive node_id |
| `to_hive` | VARCHAR | Destination hive node_id |
| `package` | VARCHAR | Package name (e.g., refer-zo-bootstrap, telechurch-vipc) |
| `version` | VARCHAR | Package version at dispatch time |
| `manifest_hash` | VARCHAR | SHA256 of manifest at dispatch time |
| `status` | VARCHAR | pending / transmitted / received / applied / rejected |
| `transmitted_at` | TIMESTAMP | When package was sent |
| `received_at` | TIMESTAMP | When package was acknowledged |
| `applied_at` | TIMESTAMP | When package was applied at destination |
| `error_detail` | VARCHAR | Error message if status = rejected |
| `notes` | VARCHAR | Human notes (e.g., "v2.1 includes script-factory") |

---

## Dispatch Cycle

```
1. dispatcher.mjs creates outbound row (status=pending)
2. dispatcher.mjs POSTs package to target hive's /api/factory/bootstrap endpoint
3. Target bootstrap.mjs writes inbound row (status=received)
4. Target bootstrap.mjs applies package and updates status=applied
5. dispatcher.mjs receives acknowledgment and updates status=transmitted/received
```

---

## Who Writes

- `dispatcher.mjs` — creates outbound dispatch records and updates status on ack
- `bootstrap.mjs` (on receiving hive) — creates inbound records and updates applied status

## Who Reads

- `dispatcher.mjs` — reads pending outbound dispatches to retry failed transmissions
- `04-hive-sync.mjs` — reads dispatch history to detect stale in-transit packages
- `bootstrap.mjs` — reads to avoid re-applying already-received packages

## Notes

- Use `manifest_hash` to prevent applying stale versions
- `status = rejected` should always have an `error_detail` explaining why
- A dispatch goes through: pending → transmitted → received → applied