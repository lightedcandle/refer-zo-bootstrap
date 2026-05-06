# REFER Zo Bootstrap Agent Governance

This repo is governed by REFER.

## Repo Purpose

`refer-zo-bootstrap` is the Zo-scoped Script Factory and Hive bootstrap source. Its job is to turn a Zo computer into a governed, portable hive node with durable files, personas, rules, skills, datasets, dispatch, talkback, heartbeat, and deployment scripts.

The first live proving instance is the Telechurch Zo computer. Runtime behavior that is proven there should be captured, ratified in this repository, verified, and made deployable to any future Zo computer.

This repo is not the same as `refer-script-factory`:

- `refer-zo-bootstrap` is scoped to Zo computers, Zo Files, Zo personas/rules, hive nodes, and Zo runtime deployment.
- `refer-script-factory` is scoped to Codex/VS Code and the broader Script Factory doctrine.
- Lessons learned here may be ported back to `refer-script-factory` when they are provider-neutral.

## Nested Repo Safety Rule

During local development, this repo may be checked out inside the sibling workspace at `e:\refer-script-factory\refer-zo-bootstrap`. It is still a separate Git repository with its own remote, branch history, and `main`.

Do not confuse the repositories:

- Work in `e:\refer-script-factory\refer-zo-bootstrap` for Zo bootstrap, hive, Telechurch Zo, dispatch/talkback/heartbeat, and Zo deployment.
- Work in `e:\refer-script-factory` for Codex Script Factory, VS Code extension, and provider-neutral doctrine.
- If there is any ambiguity before editing, run `git rev-parse --show-toplevel` in the target directory and confirm the repository root.
- Same branch names across the two repos do not imply shared history or shared commits.

The Zo factory should mature toward hive-first operation:

- bootstrap Zo computers from GitHub or controlled file transfer;
- install Zo startup binders, personas, rules, skills, and law files;
- maintain node identity, dispatch, talkback, heartbeat, and dataset channels;
- ratify live Telechurch Zo behavior back into source;
- maintain a script registry;
- package compact hive context;
- deploy full hive nodes and lighter cell nodes;
- prefer durable packets over ephemeral chat memory.
- minimize Zo chat usage by moving contracts, scripts, and talkback through Zo Files/MCP APIs whenever possible.

The working doctrine is documented in `ARCHITECTURE.md`, `DEPLOY.md`, `docs/bootstrap-dispatch-model.md`, and `docs/hdp-1-protocol.md`.

## Script-First Law

Known work must become a script before it becomes a habit. When a task repeats, or when a workflow pushes files to Zo, syncs runtime, transforms contracts, counts tokens, spawns workers, fetches talkback, validates packets, or works around a platform limit, create or update a reusable script and run that script instead of repeating ad hoc shell/chat steps.

Ad hoc commands are allowed for discovery. Once the action is understood, the next execution should use a script route and the docs should point to it.

Use `scripts/factory/sync-tandem-runtime-to-zo.mjs` for Zo runtime file sync. Do not repeat shell upload loops for known file sets.

When a tool, script, provider, API, packet, or shell hits a limit, record it in `docs/known-limits-and-constraints.md` before final response. Future agents should inspect that ledger before retrying a failed pattern.

## Default Prompt Flow

Treat user prompts as intake for a Zo hive ratification workflow:

1. Decode the prompt into a compact contract or bounded repo task.
2. Determine whether the work belongs in `refer-zo-bootstrap`, the live Telechurch Zo instance, or the sibling `refer-script-factory`.
3. Read `AGENTS.md`, `ARCHITECTURE.md`, `DEPLOY.md`, and the relevant dataset/script files before broad edits.
4. If live Zo behavior is relevant, inspect through approved MCP/API tools without exposing secrets.
5. Capture durable findings in source files, docs, manifests, schemas, or datasets.
6. Verify locally before treating behavior as ratified.
7. Do not mutate live Zo computers, production apps, payments, email/SMS, secrets, or tenant data without explicit approval.

Before doing substantial manual work, prefer a factory simulation so the factories learn from the task:

```powershell
npm run simulate -- --prompt "<user request>"
```

Use the simulation output to compare direct chat handling with typed-contract plus compressed-transport handling. If the simulation reveals a gap, capture it as a script, packet schema, dataset, doc, or verification step.

For work that spans factories, use `docs/parallel-factory-orchestration.md`: spawn or simulate one Codex Script Factory lane, one REFER Zo Bootstrap lane, and one Telechurch Zo lane when live runtime context matters. The current chat acts as build director and ratifies the outputs.

If the active workspace is nested under `e:\refer-script-factory`, also read the root orchestration map at `..\docs\cross-factory-orchestration.md`. That file is the shared recovery guide for fresh or compacted chats. This repo's local companion documents are:

- `docs/factory-topology.md`
- `docs/parallel-factory-orchestration.md`
- `docs/machine-compression.md`

Do not let this Zo repo and the sibling Codex repo evolve out of sync. Zo-specific runtime lessons belong here. Provider-neutral Script Factory lessons should be reflected back into `refer-script-factory`. Packet shapes, compression domains, dispatch/talkback conventions, and verification commands should be cross-referenced when they affect both factories.

The Codex-side director tracks hive node identity in the sibling registry at `..\.refer-factory\hive-node-registry.json` and `..\.refer-factory\hive-node-registry.md` using `..\scripts\hive\hive-node-registry.mjs`. When adding or ratifying a Zo computer, make sure the sibling registry records the node's account scope, role, transport, persona/rules state, datasets, scripts, and live evidence.

## Machine Compression Rule

Human-facing chat may stay uncompressed. Machine-facing work should use typed contracts plus compressed transport whenever practical.

- Typed contract is authority and must remain inspectable in source/datasets.
- Compressed payload is transport only.
- Use `scripts/factory/compression-codec.mjs` for bidirectional compression/decompression.
- Use domain-specific codecs (`codex_task`, `zo_task`, `talkback`, `factory_sim`) when they save tokens without losing round-trip quality.
- Before relying on compressed packets, run `npm run codec:self-test`.
- Machine workers should receive compact packets and return compact talkback; the director decompresses for human summary.

Compression does not replace contracts or datasets. Durable records must remain inspectable:

- task contracts in `datasets/chat-contracts/` or the future dispatch dataset;
- talkback in `datasets/talkback-queue/` or an equivalent result dataset;
- human-readable docs in `docs/`;
- codec behavior in `scripts/factory/compression-codec.mjs`.

## Zo Connection And Chat Startup

Fresh chat instances should not be alien to Zo. This repo carries the tools needed to connect to a Zo computer through MCP and, when needed, ask the target Zo chat directly.

Connection rules:

- Use this repo as the working directory for Zo bootstrap/hive work: `e:\refer-script-factory\refer-zo-bootstrap`.
- Tokens are loaded by `tools/zo-mcp.mjs` from `.env.local`, `.env.master`, or process environment.
- `.env.local` is ignored by git and may hold local `ZO_COMPUTER_<INSTANCE>` keys. Never commit it and never print token values.
- Instance names map to environment keys, for example `--instance telechurch` uses `ZO_COMPUTER_TELECHURCH`.
- If a token is missing in this nested repo, copy only the needed `ZO_COMPUTER_<INSTANCE>` line from the parent private `.env.master` into this repo's ignored `.env.local`.

MCP connection checks:

```powershell
node tools/zo-mcp.mjs list-tools --instance telechurch
$args64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes('{"path":"/home/workspace"}'))
node tools/zo-mcp.mjs call list_files --instance telechurch --args64 $args64 --json
```

Install verification:

```powershell
node tools/vipc-bootstrap.mjs --profile telechurch --instance telechurch --mode verify
```

Zo chat ratification:

- Prefer the file/API tandem in `docs/file-transport-tandem.md` before using Zo chat.
- Use `POST https://api.zo.computer/zo/ask` with the target Zo token only when the running Zo persona/rule model itself should evaluate a plan or ratify source changes.
- Save the full contract to Zo Files first, then keep any Zo chat prompt to a minimal activation instruction such as "Run the latest contract from the REFER contract inbox and write talkback only."
- Keep chat prompts non-mutating unless the user explicitly approves live changes.
- Ask for concise accepted/cautions/priority output when ratifying source direction.
- Do not use Zo chat as a substitute for source control; ratified behavior must still be captured in this repo, verified, committed, and deployed intentionally.

## Telechurchlive Subdomain Focus

When this nested repo is opened from `e:\refer-script-factory`, do not assume Telechurchlive app work belongs here. The current authoritative source for the public `telechurchlive` subdomain is the sibling `..\alliance-hub\` directory unless the user explicitly asks for Zo, bootstrap, hive, Zo Files, Zo personas/rules, dispatch/talkback, or live Zo runtime work.

Default target interpretation from the parent workspace:

- `..\alliance-hub\` owns Telechurchlive profile, admin, roles, church setup, Cloudflare Pages/Functions, and public app behavior.
- This repo remains a Zo bootstrap/hive reference surface unless the request explicitly names Zo work.
- Do not use `scopes/alliance/site/` as the default Telechurchlive app source from the parent workspace.
- Do not connect to, mutate, sync, or deploy any Zo runtime unless the user explicitly asks for Zo.

## Zo Hive Self-Build Doctrine

The Zo Hive Factory is a seed that becomes portable by ratifying what works on live Zo computers.

Treat the active AI operator as the hive's growth, repair, and execution intelligence. Scripts, datasets, skills, and binders are durable muscles and memory; the AI is the watcher that chooses the right surface, executes or dispatches bounded work, compares intended effects to observed effects, repairs the smallest responsible layer, and records what should become portable capability next time.

The hive does not have to begin perfect. Its purpose is to become increasingly competent by turning live use into ratified source. When a Zo computer, skill, dataset, dispatch packet, persona, or rule is missing what the task needs, the AI should build or patch the missing structure within the approved boundary, verify it, and leave source evidence so the next node can inherit it.

Self-healing and self-expansion are core duties, not optional cleanup:

- self-executing: use existing governed scripts, skills, datasets, and dispatch/talkback lanes when they fit the intent;
- self-healing: when execution or understanding is blocked, patch the responsible layer rather than treating the script, skill, or node as bad;
- self-expanding: when a repeatable need is discovered, turn the working trace into a script, dataset schema, skill rule, persona/rule update, verification step, or deployment note;
- self-recording: preserve talkback, status, registry, and ratification evidence so future nodes inherit the improvement.

Do not convert the AI's role into an endless chain of resolver scripts. The AI performs judgment, repair, and integration. Scripts and skills should remain bounded, deterministic tools that expose structured results and durable artifacts.

Each completed task should leave behind a better bootstrap package: a script, dataset schema, dispatch format, talkback format, heartbeat improvement, persona/rule update, deployment note, or verification step.

Each turn should also self-heal the hive when it exposes a gap. Look for missing node identity, ambiguous packet shape, weak role descriptions, stale docs, missing verification, unsafe mutation paths, missing status events, and unknown runtime assumptions.

Use this repair checklist:

1. What did we need that did not exist yet?
2. What was ambiguous?
3. What had to be manually inferred?
4. What should become a script, dataset, packet schema, test, status, deployment step, or doctrine rule?

Use the factory vocabulary precisely:

- `Forge`: one bounded conversion unit.
- `Script Factory`: the system that creates, manages, and runs script forges.
- `Factory System`: the complete network of coordinated factories across domains.
- `Hive Factory`: the Zo-scoped factory package and trusted proving node used to build deployable hive packages.
- `Hive Node`: a Zo computer running the hive package and participating in dispatch/talkback.
- `Cell Node`: a lighter Zo computer that consumes bootstrap, runs scripts, and reports back.
- `Dispatch`: a bounded work packet sent to a node.
- `Talkback`: a node's response, result, status, or blocker packet.
- `File/API Tandem`: the preferred low-token lane where Codex writes contracts to Zo Files through MCP, triggers a short runner command, and fetches talkback files without a Zo chat round trip.
- `Ratified Source`: live behavior captured, normalized, verified, committed, and made deployable from this repo.

Key surfaces:

- Bootstrap entrypoints: `bootstrap.mjs`, `scripts/bootstrap.mjs`, `scripts/factory/bootstrap.mjs`, and `tools/vipc-bootstrap.mjs`.
- Low-level Zo MCP helper: `tools/zo-mcp.mjs`.
- Low-token tandem bridge: `scripts/factory/dispatch-contract.mjs`, `scripts/factory/ship-contract-to-zo.mjs`, `scripts/factory/contract-inbox-runner.mjs`, `scripts/factory/fetch-zo-talkback.mjs`, and `docs/file-transport-tandem.md`.
- Script-first Zo runtime sync: `scripts/factory/sync-tandem-runtime-to-zo.mjs`. Use this instead of ad hoc shell upload loops.
- Token-use bridge: `scripts/factory/token-log-bridge.mjs` logs tandem script estimates to the root chat-surface ledger when this repo is nested under `refer-script-factory`.
- Adaptive heartbeat: `scripts/factory/heartbeat.mjs` and `docs/adaptive-heartbeat.md`. Heartbeat should tighten during active build/ratification and relax up to a 24-hour dormant pulse when quiet.
- Hive scripts: `scripts/factory/hive/` and `scripts/hive/`.
- Dataset contracts: `datasets/`.
- Skills: `skills/`.
- REFER law mirror: `law/REFER.OS/`.

When adding factory capability, keep the loop deterministic:

1. If a script already exists, use it.
2. If no script exists for a valid intent, create a draft/gap record and let the
   authorized Zo AI lane build the first working solution inside the intent
   contract.
3. Record the build trace: intent, changed routes/files/datasets, errors, fixes,
   checks, and talkback/evidence.
4. Distill the working trace into a script, packet, dataset, or manifest
   definition.
5. Add or update the command/runner if it is executable.
6. Replay the script from the original intent and verify the output.
7. Add status/process events when it runs.
8. Add or update dataset outputs if it creates artifacts.
9. Update docs when terms, roles, or deployment expectations change.
10. Verify with `npm run check` and any narrower runtime/status command available.

## Script Rules

- Scripts return structured packets or durable artifacts to REFER.
- Scripts must record process status when they run.
- Scripts may detect sensitive file names.
- Scripts must not read or send contents of `.env*`, keys, certificates, or private credentials.
- Repo facts should come from bounded scripts, dataset files, manifests, or direct source reads, not guessing.
- Multi Script entries must list child scripts.
- Single Script entries must represent one bounded operation.
- Request Type entries are category labels, not runnable scripts.
- Dispatch and talkback packets must not carry secrets.
- Live Zo mutation requires explicit approval and a clear target instance.

## Local-First And Hive-First Context Rules

Prefer compact local context over broad remote prompting.

- Use `AGENTS.md`, `ARCHITECTURE.md`, `DEPLOY.md`, and `docs/` before broad scanning.
- Use `datasets/*/datapackage.json` and dataset READMEs to understand packet/storage contracts.
- Send Zo nodes compact dispatch packets, not whole repositories.
- Open full source files only when the task requires them.
- Treat Telechurch Zo as the first proving instance, not as a replacement for source control.

## Tracking

- Node identity: `datasets/node-identity/`
- Dispatch: `datasets/hive-factory-dispatch/`
- Talkback: `datasets/talkback-queue/`
- Request watchdog: `datasets/request-watchdog/`
- Chat contracts: `datasets/chat-contracts/`
- Chat logs: `datasets/chat-logs/`
- Tandem contracts: `datasets/tandem-contracts/`
- Tandem talkback: `datasets/tandem-talkback/`
- Tandem dispatch: `datasets/tandem-dispatch/`
- Tandem usage: `datasets/tandem-usage/`
- Script registry: `datasets/script-registry/` and `scripts/factory/script-registry.json`
- Hive runtime: `scripts/factory/hive/`

## Verification

Use:

```powershell
npm run check
```

For hive changes, also run the relevant script in status, dry-run, or local-only mode when available before deploying to any Zo computer.
