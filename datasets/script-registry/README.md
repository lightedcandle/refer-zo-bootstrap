# Script Registry

**Dataset ID:** `script-registry`
**Parent:** Script Factory — compress-prompt.mjs (intake) / factory.mjs (CLI)
**Storage:** `DuckDB` + `data.duckdb` + `datapackage.json`

---

## Purpose

Canonical ledger of every registered script in the Script Factory — including their triggers, opcodes, status, and run history.

This is the factory's script inventory. It answers: what scripts exist, which ones run most often, and which ones are broken or unused.

---

## Schema

| Column | Type | Description |
|---|---|---|
| `id` | VARCHAR | Unique script identifier (e.g., button-add, page-add) |
| `name` | VARCHAR | Human-readable script name |
| `type` | VARCHAR | forge / gate / utility |
| `description` | VARCHAR | What the script does |
| `trigger_intents` | VARCHAR | JSON array of trigger phrases |
| `status` | VARCHAR | active / deprecated / broken |
| `requires_ai` | BOOLEAN | Whether AI reasoning is needed |
| `script_file` | VARCHAR | Path to the script file |
| `opcodes` | VARCHAR | JSON array of opcodes (e.g., READ_CONTRACT, WRITE_FILE) |
| `input_ports` | VARCHAR | JSON array of required inputs |
| `output_ports` | VARCHAR | JSON array of outputs |
| `guards` | VARCHAR | JSON array of guard conditions |
| `self_repair_checklist` | VARCHAR | JSON array of repair prompts |
| `run_count` | INT | Total times this script has been executed |
| `last_run` | TIMESTAMP | ISO timestamp of last execution |
| `success_rate` | FLOAT | Percentage of runs with outcome = ok |
| `avg_duration_ms` | INT | Average execution time |
| `questions` | VARCHAR | JSON array of outstanding questions (for gated scripts) |
| `version` | VARCHAR | Script version |
| `created_at` | TIMESTAMP | When the script was first registered |

---

## Script Types

| Type | Meaning |
|---|---|
| `forge` | Executable conversion unit — transforms inputs into outputs |
| `gate` | Decision point — classifies or routes, does not execute |
| `utility` | Helper script — used by other scripts, not called directly by intake |

---

## Who Writes

- `factory.mjs` — registers new scripts and updates run stats
- `compress-prompt.mjs` — reads `trigger_intents` to match prompts to scripts

## Who Reads

- `compress-prompt.mjs` — matches user prompts against trigger_intents
- `factory.mjs list` — shows all registered scripts
- `03-scan-workspace.mjs` — reads registry to detect missing or orphaned scripts

## Notes

- `trigger_intents` are case-insensitive substrings — "add button" matches "add a button to page"
- `status = deprecated` means script exists but should not be matched by intake
- `questions` array non-empty means script is gated — intake should return hasQuestions
- Use `script-registry.json` (the JSON file) as the source of truth; this dataset mirrors it