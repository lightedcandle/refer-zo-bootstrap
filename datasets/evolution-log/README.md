# Evolution Log

**Dataset ID:** `evolution-log`

## Purpose

Records self-evolution ticks for the Zo-local Script Factory.

An evolution tick does not pretend to create finished domain logic. It does bounded, inspectable maintenance:

```text
queued intake -> automation tick -> registry health -> script gaps -> evolution event -> talkback
```

## Active Files

| Path | Purpose |
|---|---|
| `records/*.json` | Evolution events written by `evolution-loop.mjs`. |
| `datapackage.json` | Historical tabular schema for evolution events and generated forges. |

## Script

```powershell
npm run factory:evolve -- --json
```

Use `--repair-registry` only when placeholder artifacts should be created for missing registry executables.
