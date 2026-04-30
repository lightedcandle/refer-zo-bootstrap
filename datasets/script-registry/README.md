# Script Registry

**Dataset ID:** `script-registry`
**Parent:** Script Factory intake and local automation
**Storage:** `script-registry.json`, `normalized-registry.json`, draft JSON records, optional DuckDB mirror

## Purpose

Canonical ledger of registered Script Factory forges, gates, utilities, and script gaps.

This dataset answers:

- which scripts exist;
- which prompts should route to them;
- which registry records point to missing executable files;
- which new scripts have been requested but not implemented yet.

## Schema

| Column | Type | Description |
|---|---|---|
| `id` | string | Unique script identifier, e.g. `button-add` |
| `name` | string | Human-readable script name |
| `type` | string | `forge`, `gate`, `utility`, or `intake` |
| `description` | string | What the script does |
| `trigger_intents` | array | Prompt fragments used for local matching |
| `status` | string | `active`, `draft`, `deprecated`, or `broken` |
| `requires_ai` | boolean | Whether AI reasoning is required |
| `script_file` | string | Repo-relative executable file |
| `version` | string | Script version |

## Active Files

| Path | Purpose |
|---|---|
| `scripts/factory/script-registry.json` | Historical source registry. |
| `datasets/script-registry/normalized-registry.json` | Active normalized registry written by `local-script-registry.mjs`. |
| `datasets/script-registry/drafts/*.json` | Script gaps created when intake cannot find a matching script. |
| `scripts/factory/artifacts/*.mjs` | Executable script artifacts or generated placeholders. |

## Scripts

```powershell
npm run factory:registry -- list --json
npm run factory:registry -- match --prompt "add a page" --json
npm run factory:registry -- scaffold --prompt "new repeated work" --json
npm run factory:intake -- --prompt "ordinary user request" --json
```

`factory.mjs` and the DuckDB mirror are legacy/aspirational until repaired. Active intake should go through `local-script-registry.mjs` and `local-intake-runner.mjs`.

## Packaged Base Atomic Forges

The base package includes executable atomic forges that emit governed JSON artifacts under `datasets/script-artifacts/records/`:

| Forge | Artifact |
|---|---|
| `page-add` | IMSCE page/index + page modal |
| `section-add` | Section inside a page modal |
| `card-add` | Card with slots |
| `button-add` | Button element |
| `field-add` | Field element |
| `text-add` | Text/heading element |
| `form-add` | Form card with fields and submit button |
| `scan-workspace` | Bounded workspace scan |

These forges are executable and deterministic. They create build artifacts; app-specific adapters are responsible for applying those artifacts to React, Angular, Zo routes, or other target runtimes.
