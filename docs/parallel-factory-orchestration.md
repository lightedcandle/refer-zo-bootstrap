# Parallel Factory Orchestration

## Purpose

The build director should not do all work directly in chat. For substantial tasks, the director coordinates parallel factory instances and ratifies their outputs through contracts, datasets, and source changes.

This document is the Zo-side orchestration guide. When this repo is nested inside `e:\refer-script-factory`, the shared root recovery guide is `..\docs\cross-factory-orchestration.md`. Fresh or compacted chats should read both files before deciding whether to edit source directly, simulate lanes, spawn agents, or ask a live Zo computer for ratification.

## Active Factories

1. Codex Script Factory
   - Repo: `e:\refer-script-factory`
   - Role: typed intake, provider-neutral doctrine, VS Code/Codex-side scripts, source verification.

2. REFER Zo Bootstrap Factory
   - Repo: `e:\refer-script-factory\refer-zo-bootstrap`
   - Role: Zo bootstrap, hive scripts, datasets, deployment packaging, Telechurch ratification capture.

3. Telechurch Zo Hive
   - Runtime: Telechurch Zo computer
   - Role: live instantiated hive node, Zo-native automation, persona/rule/file behavior, live readback, talkback.
   - Preferred transport: Zo Files/MCP file writes plus short runner commands, not full Zo chat.

## Director Pattern

The current Codex chat is the build director. The director may edit source when practical, but the goal is to push work through each factory's intake path so every instance learns.

Conversation signals for this pattern include hive, tandem, bilateral work, parallel agents, contract routing, compression, dispatch, talkback, datasets, Telechurch ratification, or any change that could affect both `refer-script-factory` and `refer-zo-bootstrap`.

If subagent spawning is available and explicitly authorized in the current environment, spawn bounded lanes with separate repo ownership. If spawning is unavailable or not authorized, simulate the same lanes with typed contracts, compressed packets, and talkback records.

For non-trivial work:

```text
User request
-> Director creates or requests local contract
-> Codex-side factory agent reports to root contract/dataset
-> Zo-bootstrap factory agent reports to local contract/dataset
-> Telechurch Zo file/API runner reports talkback
-> Director compares results
-> Director updates source, docs, scripts, schemas, or deployment plan
```

## Parallel Agent Roles

### Agent 1: Codex Script Factory Agent

Scope:

- `e:\refer-script-factory`
- Typed contracts, `.refer-factory/`, process events, Script Factory doctrine, provider-neutral patterns.

Output:

- Contract notes.
- Missing script/schema list.
- Suggested updates that belong in the root repo.
- No Zo-specific runtime assumptions unless abstracted.

Recommended task packet:

```json
{
  "agent_task_id": "refer.agent.task.<stamp>.<hash>",
  "parent_contract_id": "refer.intake.<stamp>.<hash>",
  "director_id": "build-director",
  "target_repo": "e:/refer-script-factory",
  "task": {
    "intent": "bounded task text",
    "scope": "read-only | write-scoped",
    "target_paths": [],
    "allowed_mutations": [],
    "expected_outputs": []
  },
  "context_refs": {
    "intake_record": ".refer-factory/intake/<record>.json",
    "codebase_tree": ".refer-factory/codebase-tree.json",
    "agent_context": ".refer-factory/agent-context.md",
    "script_legend": ".refer-factory/script-legend.md"
  },
  "reporting": {
    "dataset_ref": ".refer-factory/datasets/agent-tasks/<agent_task_id>.json",
    "return_contract": ".refer-factory/agent-reports/<agent_task_id>.json"
  }
}
```

### Agent 2: Director / Ratifier

Scope:

- Current chat.
- Reads all returned contracts/talkback.
- Decides source changes.
- Keeps repo boundaries clear.
- Runs verification.

Output:

- Ratified source edits.
- Commit-ready change set.
- Deployment/talkback instruction.

### Agent 3: REFER Zo Bootstrap Agent

Scope:

- `e:\refer-script-factory\refer-zo-bootstrap`
- Zo bootstrap/hive scripts, datasets, deployment package, Telechurch readback, local simulation.

Output:

- Local Zo factory contract.
- Compressed transport packet when relevant.
- Dataset/talkback schema gaps.
- Suggested source updates for Zo bootstrap.

Recommended task packet:

```json
{
  "id": "contract_<timestamp>",
  "repo": "refer-zo-bootstrap",
  "authority": "local_source",
  "mode": "BUILD|DISCUSS|MICRO|VERIFY",
  "task": "bounded task text",
  "scope": ["allowed files, docs, or scripts"],
  "out_of_scope": ["live Zo mutation", "secrets", "production data"],
  "acceptance": ["observable done criteria"],
  "report_to": "build_director",
  "dataset_targets": ["chat-contracts", "chat-logs", "request-watchdog", "evolution-log"]
}
```

### Zo Side: Telechurch Director Automation

Scope:

- Telechurch Zo runtime.
- Zo Files, personas, rules, automations, heartbeat, local datasets.

Output:

- Talkback packet.
- Verification evidence.
- Runtime gaps.
- Proposed source ratification notes.

Live Zo automation must not be created or edited without explicit approval.

Use `docs/file-transport-tandem.md` for the low-token activation lane:

1. write contract and compressed packet into `/home/workspace/datasets/tandem-contracts/inbox/`;
2. trigger `contract-inbox-runner.mjs` through MCP `run_bash_command`, or use one tiny chat activation only if the persona/rule model must be involved;
3. fetch talkback from `/home/workspace/datasets/tandem-talkback/outbox/`.

Avoid using Zo chat for contract body transfer or long responses.

## Contract Rule

Each lane must emit one of:

- typed contract;
- dataset row;
- talkback packet;
- script registry update;
- ratification note.

If a lane only produces chat prose, it did not feed the factory.

Contract and context pointers:

- Root Script Factory contract surfaces: `..\src\contracts\referIntake.ts`, `..\src\contracts\scriptFactory.ts`, `..\.refer-factory\`.
- Root shared orchestration guide: `..\docs\cross-factory-orchestration.md`.
- Zo task compression: `scripts/factory/compression-codec.mjs`.
- Zo bilateral simulation: `scripts/factory/bilateral-sim.mjs`.
- Zo file/API tandem: `scripts/factory/ship-contract-to-zo.mjs`, `scripts/factory/contract-inbox-runner.mjs`, `scripts/factory/fetch-zo-talkback.mjs`, and `docs/file-transport-tandem.md`.
- Zo tandem dataset surfaces: `datasets/tandem-contracts/`, `datasets/tandem-talkback/`, and `datasets/tandem-dispatch/`.
- Live Zo/hive dataset surfaces: `datasets/chat-contracts/`, `datasets/hive-factory-dispatch/`, `datasets/talkback-queue/`, and `datasets/request-watchdog/`.

Worker return packets should be compact and subordinate to the director:

```json
{
  "contract_id": "contract_<timestamp>",
  "status": "done|failed|blocked",
  "changed": ["paths or dataset rows"],
  "evidence": ["checks run", "files inspected", "live readback used"],
  "blockers": [],
  "next": "ratify|review|spawn_followup|pause"
}
```

## Compression Rule

Human-facing director chat can remain natural language. All machine-facing lanes should use compressed transport once a typed contract exists.

Use `scripts/factory/compression-codec.mjs`:

- `codex_task` for root Script Factory spawned-agent tasks;
- `zo_task` for REFER Zo Bootstrap spawned-agent tasks;
- `talkback` for worker return packets;
- `factory_sim` for bilateral simulation.

Every compressed packet must round-trip back to the typed packet before it is trusted.

## Dataset Rule

Local source factories need durable local datasets just like Zo:

- Codex Script Factory: `.refer-factory/**`
- REFER Zo Bootstrap: `datasets/**`
- Telechurch Zo: `/home/workspace/datasets/**`

The director should inspect datasets before broad rescans and should write new contracts/results there when scripts exist.

## Minimal Parallel Loop

1. Run or simulate intake in both source repos.
2. Ask Telechurch Zo for non-mutating ratification only when live context matters.
3. Compare:
   - mode;
   - owner factory;
   - risk;
   - missing fields;
   - proposed script;
   - verification evidence;
   - dataset write.
4. Update source.
5. Run local checks.
6. Record what the factories learned.

## Near-Term Scripts Needed

- `dispatch-contract.mjs`: route a typed contract to local script, Zo ratification, or hive talkback.
- Implemented initial file/API form: `scripts/factory/dispatch-contract.mjs` creates/loads a task, ships it by Zo Files/MCP, optionally triggers the runner, optionally fetches talkback, and writes a dispatch report.
- `talkback-result.schema.json`: stable result packet schema.
- `codex-factory-intake` command/script in root `refer-script-factory`.
- Zo automation contract for processing queued contracts on Telechurch.
- Root `referAgentTask` contract/dataset helpers for `.refer-factory/agent-tasks/` and `.refer-factory/agent-reports/`.
- Zo Bootstrap dataset/schema alignment so `compress-prompt.mjs` writes columns declared by `dataset-store.mjs`.
