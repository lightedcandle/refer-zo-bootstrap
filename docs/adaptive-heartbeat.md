# Adaptive Heartbeat

## Purpose

Hive nodes should not pulse at a fixed high rate when nothing is happening. The heartbeat interval should tighten when work is active and relax when the node is quiet, up to a 24-hour maximum idle/dormant pulse.

## Policy

The Zo heartbeat script stores policy in:

```text
scripts/factory/heartbeat-meta.json
```

Defaults:

| Mode | Interval | Trigger |
|---|---:|---|
| `active_build` | 5 minutes | pending/running task, dashboard task count, alert |
| `ratifying` | 15 minutes | meta status is `ratifying` |
| `watch` | 1 hour | no active work, recent heartbeat |
| `idle` | 6 hours | no active work after `idle_after_ms` |
| `dormant` | 24 hours | no active work after `dormant_after_ms` |

The maximum interval is capped at 24 hours by default:

```json
{
  "policy": {
    "max_interval_ms": 86400000
  }
}
```

## Commands

```powershell
node scripts/factory/heartbeat.mjs --status
node scripts/factory/heartbeat.mjs --policy
node scripts/factory/heartbeat.mjs --tick
```

`--tick` runs the train cars, classifies current activity, writes state, and schedules the next due time using the adaptive interval.

## Director Registry

The Codex-side hive node registry records heartbeat policy and next pulse per node:

```powershell
npm run hive:registry:heartbeat -- --id telechurch --status ratifying --activity recent_activity --evidence "dispatch verified"
npm run hive:registry:heartbeat -- --id alliance --status planned --activity watch --note "waiting for deployment"
```

The registry is a director view. The Zo heartbeat script is the node-local runtime scheduler.
