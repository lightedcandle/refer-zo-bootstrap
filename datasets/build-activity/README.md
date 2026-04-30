# Build Activity Dataset

This dataset records governed Zo build intake and route-change activity. It is the durable proof that a build request started from a typed contract before route edits were made.

Records are written by `scripts/factory/contract-inbox-runner.mjs` when a contract contains a `build_intake` block with schema `refer.zo.build-intake.v1`.

The dataset is intentionally separate from tandem transport records. Tandem files prove packet movement; build activity records prove that a build lane accepted a typed request and named the route evidence expected after mutation.

## Required Flow

```text
root hive backlog item
-> typed hive/build-intake contract
-> Zo tandem dispatch
-> contract-inbox-runner records build activity
-> route work proceeds from that contract
-> talkback and route ratification return to the root director
```

## Records

Records are stored in:

```text
datasets/build-activity/records/
```

Each record includes the contract ID, change ID, target node, route list, route policy, evidence required, and next action.
