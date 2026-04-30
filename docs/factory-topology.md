# Factory Topology

This project currently involves three factory surfaces. Treat each as an active factory, not just inert source code.

## The Three Factories

1. `refer-script-factory`
   - Scope: Codex, VS Code, typed contracts, provider-neutral Script Factory doctrine.
   - Current role: local Codex-side factory and source of typed contract discipline.

2. `refer-zo-bootstrap`
   - Scope: Zo computers, hive bootstrap, deployment, persona/rule binding, dispatch, talkback, heartbeat, datasets.
   - Current role: Zo-scoped source factory that packages what live Zo proves.

3. Telechurch Zo
   - Scope: instantiated live hive computer.
   - Current role: proving instance where Zo-native automation, chat, files, personas, rules, and datasets can demonstrate behavior.

## Repo vs Instantiated Factory

A repo is the ratified source of a factory. An instantiated factory is the running system that executes, observes, and reports.

Do not confuse them:

- Source repo changes are not live behavior until deployed.
- Live behavior is not ratified source until captured, normalized, verified, committed, and deployed intentionally.
- Chat work that bypasses intake is not factory learning unless it emits a contract, dataset row, script, doc, or talkback packet.

## Four Lanes

1. Current chat direct
   - Fastest, but highest token waste.
   - Use only for small coordination or emergency inspection.

2. Current chat to Codex contract
   - User prompt becomes a typed local contract.
   - Best for source edits, tests, commits, and provider-neutral doctrine.

3. Current chat to Zo ratification
   - Codex emits a contract or plan.
   - The full contract is saved to Zo Files first.
   - Zo chat is used only for a tiny activation or persona/rule judgment when necessary.
   - Source still owns final implementation.

4. Native Zo hive automation
   - Zo automation or a triggered runner reads queued contract, compresses transport, runs scripts or dispatches work, and writes talkback.
   - This is the desired low-token operating path.

Preferred current bridge:

```text
MCP create_or_rewrite_file -> contract inbox
MCP run_bash_command -> contract runner
MCP read_file -> talkback outbox
```

See `docs/file-transport-tandem.md`.

## Required Pattern

Every non-trivial task should move toward this shape:

```text
prompt
-> intake
-> typed contract
-> compressed transport
-> script / hive / model
-> typed result or talkback
-> dataset record
-> source improvement
```

The typed contract is authority. Compression is transport. Talkback is evidence. Source commits are ratification.

## Simulation

Use the bilateral simulation script before hardening a new lane:

```powershell
npm run simulate -- --prompt "verify the Telechurch Zo bootstrap install without mutating live files"
```

The simulation compares direct chat work with typed-contract plus compressed transport work, then emits a learning packet naming the next script or doc improvement.

## Parallel Build Director

For substantial work, use the director pattern in `docs/parallel-factory-orchestration.md`.

The current Codex chat acts as director. It should spawn or simulate parallel factory workers:

- one against `refer-script-factory`;
- one against `refer-zo-bootstrap`;
- one Zo-side lane through Telechurch chat/automation when live runtime context matters.

The director then compares contracts/talkback, ratifies source changes, and runs verification.

## Hive Node Registry

The Codex-side director owns the current cross-node map:

```text
..\.refer-factory\hive-node-registry.json
..\.refer-factory\hive-node-registry.md
```

Script:

```powershell
npm --prefix .. run hive:registry
npm --prefix .. run hive:registry:heartbeat -- --id telechurch --status ratifying --evidence "Zo tandem dispatch verified"
```

Use this registry whenever a Zo computer is added, deployed, verified, or retired. The Zo bootstrap repo remains responsible for the actual Zo runtime scripts and datasets; the sibling registry records which nodes exist and what evidence proves their current state.

## Node Self-Scoping

A Zo computer's registry role is not its full boundary. A single computer may serve multiple users and multiple work categories over time.

The computer should record its own active scopes in:

```text
datasets/node-scope/records/
```

Use:

```powershell
npm run scope:record -- --label "Alliance application build" --source user --purpose "Build and maintain Alliance Hub"
npm run scope:report
```

The root director may read these scope records to choose a route, but it should not assign a permanent domain brain to the node. Scope comes from local user intent, local work, local datasets, and ratified contracts.

Users should not need to speak this vocabulary. The contract runner automatically reads active `node-scope` records on every contract and writes the selected scope into talkback. If no scope matches, talkback records `node_scope:no_match` so the node can ask for or infer a local scope before continuing.

## Local Script Factory Loop

Skills and automation are part of the Script Factory, but they are different layers:

- Skills tell the node how to interpret work and which governance rules to follow.
- Scripts are bounded executable forges that perform repeatable work.
- Automation is the trigger layer that runs intake or scripts without a human/Codex chat typing each command.

The minimum complete local loop is now:

```text
ordinary prompt
-> local-intake-runner.mjs
-> node-scope records
-> local-script-registry.mjs
-> executable script if present
-> script-gap draft if missing
-> talkback packet
```

Use:

```powershell
npm run factory:intake -- --prompt "add a new church profile" --json
npm run factory:registry -- list --json
npm run factory:automation-once -- --json
```

Queued automation records live in:

```text
datasets/local-intake/inbox/
```

The automation script is currently a non-persistent tick. A Zo-native persistent automation may call the same command, but the command itself is the ratified local executable path.

## Self-Evolution Tick

The self-evolution layer is bounded and evidence-first. It does not claim to author finished product logic without review. It can:

- process queued local intake;
- audit registry records;
- record missing executable scripts;
- optionally create not-implemented placeholders for missing registry executables;
- write evolution events and talkback.

Use:

```powershell
npm run factory:evolve -- --json
npm run factory:evolve -- --repair-registry --json
npm run factory:registry-doctor -- --json
```

Persistent Zo automation should call:

```text
cd /home/workspace/refer-zo-bootstrap && npm run factory:evolve -- --json
```

Hourly or slower cadence is preferred because every Zo automation run is a full Zo session.

## Base Atomic Forge Pack

The factory must ship with executable fundamentals, not only script-gap scaffolding. The current base atom pack emits governed JSON artifacts for:

- page
- section
- card
- button
- field
- text/heading
- form
- workspace scan

The atom scripts live under:

```text
scripts/factory/artifacts/
```

Their outputs live under:

```text
datasets/script-artifacts/records/
```

These base atoms create portable build artifacts. They do not directly mutate production application routes. A target adapter should consume the artifacts and perform framework-specific writes with separate ratification.
