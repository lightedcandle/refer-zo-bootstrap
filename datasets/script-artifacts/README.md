# Script Artifacts

**Dataset ID:** `script-artifacts`

## Purpose

Stores executable outputs from base Script Factory atomic forges.

These records are not chat notes. They are durable build atoms that downstream app adapters can consume:

```text
prompt/contract -> atomic forge -> script artifact -> app-specific adapter -> ratification
```

## Records

Artifacts are written to:

```text
records/*.json
```

Each record includes:

- `script_id`
- `artifact_kind`
- `target`
- `imsce`
- `props`
- `evidence`

The base atomic forges deliberately stop at artifact creation. They do not mutate production routes, databases, payments, messages, or secrets.
