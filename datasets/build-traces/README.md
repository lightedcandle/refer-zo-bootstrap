# Build Traces Dataset

Build traces record the first successful AI-led build for an intent before that
work is distilled into a deterministic Script Factory forge.

Use this dataset when local intake reports `needs_script` and the intent is
valid for the node. The draft is the starting record; the build trace captures
what Zo tried, what changed, what failed, what fixed it, and what proved the
result worked.

Expected flow:

```text
script-gap draft
-> authorized Zo AI exploratory build
-> build trace record
-> distilled script artifact
-> replay from original intent
-> registry update
-> talkback / ratification
```

Records live under:

```text
datasets/build-traces/records/
```

Minimum record fields:

- `schema`: `refer.zo.build-trace.v1`
- `id`
- `intent_id`
- `script_gap_id`
- `prompt`
- `target_scope`
- `changed`
- `errors`
- `fixes`
- `checks`
- `distilled_script`
- `replay`
- `talkback`
- `status`

Statuses:

- `exploring`
- `working`
- `distilled`
- `replayed`
- `ratified`
- `blocked`
