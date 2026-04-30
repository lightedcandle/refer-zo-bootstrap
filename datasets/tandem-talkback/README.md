# Tandem Talkback

Machine-only Zo-to-Codex talkback for contracts received through the tandem file/API lane.

This dataset is separate from the general hive `talkback-queue` so live Zo activity and Codex-directed work do not get mixed.

Default transport paths:

- outbox on Zo: `/home/workspace/datasets/tandem-talkback/outbox/`
- local inbox mirror: `datasets/tandem-talkback/inbox/`

Talkback should include:

- contract id;
- status;
- changed paths or dataset rows;
- evidence;
- blockers;
- next action.
