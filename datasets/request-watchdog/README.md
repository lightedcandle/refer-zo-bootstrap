# Request Watchdog

**Dataset ID:** `request-watchdog`
**Parent:** Script Factory — request-watchdog.mjs (watcher)
**Storage:** `DuckDB` + `data.duckdb` + `datapackage.json`

---

## Purpose

Tracks the lifecycle of every outbound API request made by this hive — from creation through timeout detection, retry, and completion.

This is the safety net for the factory's external API calls. It answers: what is currently in flight, what timed out, and what needs retry.

---

## Schema

| Column | Type | Description |
|---|---|---|
| `id` | VARCHAR | Request UUID |
| `session_id` | VARCHAR | Chunk session this request belongs to |
| `chunk_index` | INT | Which chunk this request corresponds to |
| `endpoint` | VARCHAR | Full URL of the API endpoint |
| `method` | VARCHAR | HTTP method (GET / POST / etc.) |
| `status` | VARCHAR | pending / in_flight / done / timeout / error |
| `created_at` | TIMESTAMP | When the request was created |
| `started_at` | TIMESTAMP | When the request was actually sent |
| `completed_at` | TIMESTAMP | When a response was received |
| `duration_ms` | INT | Actual round-trip time |
| `timeout_ms` | INT | Configured timeout for this request type |
| `response_code` | INT | HTTP status code (if received) |
| `error_detail` | VARCHAR | Error or timeout message |
| `retry_count` | INT | Number of retry attempts |
| `max_retries` | INT | Maximum retries allowed |

---

## Lifecycle States

```
pending → in_flight → done
                  ↘ timeout → pending (retry if retry_count < max_retries)
                  ↘ error → pending (retry if retry_count < max_retries)
```

---

## Watchdog Rules

- `timeout_ms` is determined by request type (chunk requests get 60s; talkback pings get 10s)
- `max_retries` defaults to 3, configurable per request type
- Requests in `pending` state for more than `timeout_ms` are marked `timeout`
- Requests marked `error` with retry_count < max_retries stay `pending` for retry
- `in_flight` requests that don't complete within `timeout_ms * 2` are force-marked timeout

---

## Who Writes

- `request-watchdog.mjs` — creates pending rows, updates status on send/response/timeout
- `auto-chunker.mjs` — creates pending rows when chunking is triggered

## Who Reads

- `request-watchdog.mjs` — reads pending/timeout rows on each watchdog tick to retry or alert
- `auto-chunker.mjs` — reads session's request count to know how many chunks are in flight

## Notes

- A chunk session with 5 chunks will have 5 rows (one per chunk request)
- `session_id` on the watchdog matches `session_id` on `chat-contracts` — they cross-reference
- Use `status = timeout` (not `error`) for watchdog-triggered timeouts to distinguish from API errors