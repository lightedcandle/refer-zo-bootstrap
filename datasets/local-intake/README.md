# Local Intake

**Dataset ID:** `local-intake`

## Purpose

Stores ordinary user requests after they are converted into Script Factory intake records.

This dataset is the bridge between chat-shaped language and governed local work:

```text
prompt -> node scope -> script registry lookup -> script execution or script-gap draft -> talkback
```

## Directories

| Path | Purpose |
|---|---|
| `inbox/` | Queued intake requests for `inbox-automation.mjs --once`. |
| `records/` | Durable intake records written by `local-intake-runner.mjs`. |
| `processed/` | Queue files already handled by the automation tick. |
| `errors/` | Queue files that failed automation processing. |

## Scripts

```powershell
npm run factory:intake -- --prompt "add a new church profile" --json
npm run factory:automation-once -- --json
```

Users do not need to speak the internal vocabulary. The runner resolves local node scope automatically and records either a matched script or a script gap.
