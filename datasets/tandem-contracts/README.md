# Tandem Contracts

Machine-only contracts sent from Codex/director lanes to Zo through Files/MCP.

This dataset is separate from live Zo user chat datasets. Do not store human Zo chat turns here.

Default transport paths:

- inbox on Zo: `/home/workspace/datasets/tandem-contracts/inbox/`
- local outbox mirror: `datasets/tandem-contracts/outbox/`

Each contract should have:

- typed JSON envelope;
- optional compressed `sx1` payload;
- contract id;
- owner factory;
- mode/risk/scope;
- acceptance criteria.
