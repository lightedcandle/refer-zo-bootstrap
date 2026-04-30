# Tandem Usage

Zo-local token usage ledger for tandem scripts running on a Zo computer.

This dataset exists because the root `refer-script-factory` token dashboard is not present inside a deployed Zo computer. When `scripts/factory/token-log-bridge.mjs` cannot find the root tracker, it writes here instead.

Files:

- `token-useage.jsonl`: detailed JSONL ledger
- `token-useage-summary.md`: readable summary generated from the ledger

Estimate rule:

```text
4 characters = 1 token
```
