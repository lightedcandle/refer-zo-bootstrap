# Node Scope

`node-scope` records what this Zo computer says it is being used for.

Scope is not assigned by the root factory. A computer can serve one purpose or many purposes, and its active scopes should come from local user intent, local work, local datasets, and local talkback.

The root director may read these records to route contracts, but it should not treat a hive node's first registration role as the permanent boundary of the node.

## Sources

- `self`: the node records its own current purpose or capability.
- `user`: the local user declares what this computer is for.
- `work_observation`: recent activity shows a repeated build category.
- `ratified_contract`: a validated contract establishes a durable scope.

## Records

Records are stored in:

```text
datasets/node-scope/records/
```

Each record names a `scope_id`, label, source, confidence, evidence, and routing notes.

## Rule

The node may hold multiple scopes at the same time. A scope can be active, watch, paused, or retired. Work should route to the smallest active scope that matches the user intent and local evidence.

## Automatic Use

Users do not need to say "scope" or use factory vocabulary.

`scripts/factory/contract-inbox-runner.mjs` reads active records from this dataset for every contract. It compares the contract text, task, acceptance criteria, and build-intake summary against local scope labels, purposes, and categories. The runner writes the result into talkback as `node_scope` and adds either:

- `node_scope:auto_resolved`
- `node_scope:no_match`

Build-intake activity records also include the same `node_scope` resolution. If no scope matches, the node can still receive the contract, but talkback should make the missing context visible.
