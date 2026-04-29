# Hive Heartbeat Distribution Protocol — HDP-1

Status: Draft v1
Last updated: 2026-04-28

---

## Overview

HDP-1 uses the existing heartbeat train as the distribution engine. Each heartbeat tick runs a hive-sync car that reports local version state to the hive and applies any pending updates returned.

- **Transport**: talkback.mjs (existing outbound polling)
- **Schedule**: heartbeat tick interval (default 5 min)
- **Hive endpoint**: `https://<HIVE_ZO>/api/hive`
- **No new infrastructure** — uses existing heartbeat car pattern

---

## Entities

| Entity | Role |
|--------|------|
| **Hive Zo** | Canonical source. Holds master manifest, all package versions, file content. Exposes `POST /api/hive` |
| **Target Zo** | Consumer. Runs heartbeat with hive-sync car. Pulls from hive via talkback |
| **talkback.mjs** | Transport. Target Zo polls hive. Hive does not initiate connections |
| **heartbeat.mjs** | Scheduler. Runs hive-sync car on each tick |

---

## Hive Manifest

`/api/hive` on the Hive Zo serves the canonical package manifest.

**Request:**
```
POST https://apostlej.zo.space/api/hive
Authorization: Bearer <HIVE_TOKEN>
Content-Type: application/json

{
  "node": { "id": "<NODE_ID>", "name": "<NODE_NAME>" },
  "packages": {
    "refer-law": "0.2.0",
    "script-factory": "0.1.0"
  },
  "last_sync": "2026-04-28T06:00:00Z"
}
```

**Response:**
```json
{
  "ok": true,
  "hive_version": "0.3.0",
  "sync_needed": true,
  "updates": [
    {
      "package": "script-factory",
      "from_version": "0.1.0",
      "to_version": "0.2.0",
      "commands": [
        {
          "op": "write",
          "path": "scripts/factory/hive/sync-car.mjs",
          "content": "<full file content>",
          "description": "Add hive-sync car"
        }
      ]
    }
  ],
  "messages": ["Heartbeat sync complete"]
}
```

---

## Update Response Shape

Each update in the response contains an ordered list of commands to apply locally.

### Command Ops

| Op | Description |
|----|-------------|
| `write` | Write content to a file path (absolute from repo root) |
| `delete` | Delete a file |
| `exec` | Run a shell command (with timeout) |
| `install_skill` | Copy a skill folder to Skills/ (used for refer-law package) |
| `activate` | Set a skill or persona as active |

### Command Result

After applying all commands, the target Zo reports back:

```
POST https://apostlej.zo.space/api/hive/ack
{
  "node_id": "<NODE_ID>",
  "sync_id": "<SYNC_ID from response>",
  "applied": ["write:scripts/factory/hive/sync-car.mjs"],
  "errors": [],
  "new_versions": {
    "script-factory": "0.2.0"
  }
}
```

---

## Version Manifest (hive-side)

The hive maintains `hive/manifest.json` at its repo root:

```json
{
  "version": "0.3.0",
  "packages": {
    "refer-law": {
      "version": "0.2.0",
      "skills": ["refer-os", "refer-zo-intake-router", "refer-governance", "refer-contract-tandem", "refer-library-bootstrap"],
      "description": "Core REFER governance rules"
    },
    "script-factory": {
      "version": "0.2.0",
      "skills": ["refer-factory"],
      "description": "Evolving Script Factory being"
    }
  },
  "release_notes": "Added hive-sync car and HDP-1 protocol"
}
```

The hive updates this manifest whenever new versions are ratified.

---

## Security

- Target Zo authenticates to hive with `HIVE_TOKEN` stored as an env var
- Hive whitelist: only registered node IDs can post heartbeat
- Commands are fire-and-forget (target Zo reports ack after apply)
- No secrets or credentials in update command content

---

## Car Contract

`04-hive-sync.mjs` — exports `run(state, meta)`

```js
// state = heartbeat state object
// meta  = heartbeat meta { interval_ms, next_run, active }

async function run(state, meta) {
  // 1. Build heartbeat payload
  // 2. POST to hive via talkback
  // 3. Parse response
  // 4. Apply commands in order
  // 5. Report ack to hive
  // 6. Update state.dashboard with sync result
  return {
    status: "completed" | "synced" | "error",
    dashboard_updates: { last_hive_sync, hive_status },
    gap_found: null,
    alert: null,
  };
}
```

---

## Talkback Integration

talkback.mjs carries the HTTP round-trip to the hive. The hive-sync car calls:

```js
const response = await talkback.post('/api/hive', payload);
```

talkback already exists and handles:
- Auth header injection
- JSON serialize/deserialize
- Error handling

The only new talkback method needed is `POST /api/hive`.

---

## Heartbeat Car Load Order

```
01-dashboard-state.mjs     → Gather local system state
02-task-executor.mjs       → Execute queued tasks
03-scan-gaps.mjs           → Find gaps in local factory
04-hive-sync.mjs           → Sync with hive (NEW)
```

Car 04 runs last. If it returns `halt: true`, the chain stops.

---

## Offline Behavior

If hive is unreachable:
- Sync fails silently
- Local versions stay current (no rollback)
- Next tick retries
- No alert on single missed tick
- Alert after N consecutive failures (configurable, default 3)

---

## Dependencies

- `heartbeat.mjs` — train engine (existing)
- `talkback.mjs` — HTTP transport (existing)
- `04-hive-sync.mjs` — new sync car (this spec)
- `hive/api.mjs` — new hive endpoint handler (this spec)
- `hive/manifest.json` — hive version source of truth (this spec)
