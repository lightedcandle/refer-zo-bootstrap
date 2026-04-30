# Known Limits And Constraints

This ledger records Zo bootstrap, hive, tandem, MCP, and live Zo runtime limits.

Update this file whenever a tool, provider, transport path, script, runner, packet, dataset, or Zo behavior hits a limit. The mitigation should become a script or documented runner path before the same action is repeated.

## Record Format

- Date:
- Domain/provider:
- Operation:
- Symptom:
- Likely cause:
- Mitigation:
- Script/doc now encoding mitigation:
- Verification:

## Observed Limits

### Windows Command-Line Payload Length During Zo Upload

- Date: 2026-04-29
- Domain/provider: Windows PowerShell / Node process launch / Zo MCP helper
- Operation: uploading local files to Zo by invoking `tools/zo-mcp.mjs` with large `--args64` payloads
- Symptom: `Program 'node.exe' failed to run: The filename or extension is too long`
- Likely cause: large file contents were encoded into command-line arguments and exceeded Windows process creation limits
- Mitigation: use direct MCP request bodies inside a reusable sync script instead of shell argument payloads
- Script/doc now encoding mitigation: `scripts/factory/sync-tandem-runtime-to-zo.mjs`
- Verification: `npm run tandem:sync-runtime -- --instance telechurch --check`

### Zo Read File May Return JSON-Looking Line Arrays

- Date: 2026-04-29
- Domain/provider: Zo MCP `read_file`
- Operation: fetching compressed talkback from `/home/workspace/datasets/tandem-talkback/outbox/*.sx1.txt`
- Symptom: decoder saw `Unsupported compressed packet: [ "sx1:talkback:...` instead of raw `sx1:...`
- Likely cause: Zo `read_file` formatted the text as a JSON-like line array
- Mitigation: normalize readback text by parsing array-shaped strings and joining lines before decode
- Script/doc now encoding mitigation: `scripts/factory/fetch-zo-talkback.mjs`
- Verification: `npm run tandem:fetch -- --instance telechurch --contract-id zo.file.20260429T160840309Z.7a4c6c7a71 --compressed`

### Zo Chat Token Cost

- Date: 2026-04-29
- Domain/provider: Zo chat
- Operation: Codex-to-Zo work routing
- Symptom: Zo chat uses costly tokens for full contract bodies and verbose responses
- Likely cause: chat is model-mediated and returns natural language
- Mitigation: use file/API tandem transport: write contract to Zo Files, trigger runner with `run_bash_command`, fetch talkback with `read_file`
- Script/doc now encoding mitigation: `docs/file-transport-tandem.md`, `scripts/factory/dispatch-contract.mjs`
- Verification: `npm run dispatch:contract -- --instance telechurch --task "prove full tandem dispatch command after readback normalization" --trigger --fetch`

### Remote Zo Runtime Does Not Have Root Token Ledger

- Date: 2026-04-29
- Domain/provider: Telechurch Zo runtime
- Operation: running `contract-inbox-runner.mjs` on Zo
- Symptom: remote runner reported `root token tracker not found`
- Likely cause: Zo runtime has `refer-zo-bootstrap`, not the sibling root `refer-script-factory` chat-surface ledger
- Mitigation: local ship/fetch/dispatch scripts log token estimates in the root repo; remote runner writes a Zo-local fallback ledger in `datasets/tandem-usage/`
- Script/doc now encoding mitigation: `scripts/factory/token-log-bridge.mjs`, `datasets/tandem-usage/`
- Verification: `npm run dispatch:contract -- --instance telechurch --task "prove full tandem dispatch command after readback normalization" --trigger --fetch`

### Live User Datasets Must Stay Separate From Tandem Machine Datasets

- Date: 2026-04-29
- Domain/provider: Zo Files datasets
- Operation: Codex-to-Zo tandem dispatch
- Symptom: machine contracts could be confused with live user chat/intake records
- Likely cause: using `chat-contracts` and `talkback-queue` for both user and machine work
- Mitigation: isolate machine work in `tandem-contracts`, `tandem-talkback`, and `tandem-dispatch`; promote into live hive datasets only intentionally
- Script/doc now encoding mitigation: `datasets/tandem-contracts/`, `datasets/tandem-talkback/`, `datasets/tandem-dispatch/`, `docs/file-transport-tandem.md`
- Verification: dry-run and live dispatch paths show `/datasets/tandem-*` paths

### Full Tandem Runtime Sync Can Timeout

- Date: 2026-04-29
- Domain/provider: Zo MCP / runtime sync
- Operation: `npm run tandem:sync-runtime -- --instance telechurch --check`
- Symptom: local command timed out after about 244 seconds while syncing the full runtime preset
- Likely cause: many sequential MCP file writes plus remote check can exceed local command timeout or Zo response latency window
- Mitigation: use narrow file sync when only one or a few files changed: `npm run tandem:sync-runtime -- --instance telechurch --file <path> --check`
- Script/doc now encoding mitigation: `scripts/factory/sync-tandem-runtime-to-zo.mjs`
- Verification: `npm run tandem:sync-runtime -- --instance telechurch --file scripts/factory/backfill-zo-local-usage.mjs --check`

### Verification Scripts Can Miss Runtime Files

- Date: 2026-04-29
- Domain/provider: Zo bootstrap npm checks
- Operation: editing `scripts/factory/heartbeat.mjs`
- Symptom: `heartbeat.mjs` had a syntax-invalid header but `npm run check` did not catch it
- Likely cause: the heartbeat runtime file was not included in the `check` script
- Mitigation: include touched runtime scripts in package checks before relying on syntax health
- Script/doc now encoding mitigation: `package.json`
- Verification: `npm run check`

### Tandem Runtime Sync Loads Dotenv Token Files

- Date: 2026-04-29
- Domain/provider: Zo MCP / runtime sync
- Operation: syncing one updated Telechurch runtime file from a Codex session where `.env.master` was active
- Symptom: `scripts/factory/sync-tandem-runtime-to-zo.mjs` resolves Zo tokens by loading `.env.local` and `.env.master`
- Likely cause: the sync script is designed for standalone local use and owns token discovery
- Mitigation: when a session must avoid secret-file reads, use an already-connected MCP file tool or inject the token through environment without printing it; never inspect or print `.env*`
- Script/doc now encoding mitigation: root `docs/known-limits-and-constraints.md`, this file
- Verification: Telechurch `create_or_rewrite_file` upload of `scripts/factory/contract-inbox-runner.mjs` followed by remote `node --check`

### Zo MCP Node Handshakes Need Bounded Timeouts

- Date: 2026-04-29
- Domain/provider: Zo MCP / registered hive nodes
- Operation: checking Alliance MCP tools before staging the registered node
- Symptom: `tools/zo-mcp.mjs list-tools --instance alliance` timed out locally after about 124 seconds
- Likely cause: the helper did not bound fetch calls, so unreachable or slow node handshakes could consume the entire command window
- Mitigation: use `--timeout-ms` on `tools/zo-mcp.mjs` for node handshakes and record blocked node evidence in the hive registry
- Script/doc now encoding mitigation: `tools/zo-mcp.mjs`, root `.refer-factory/hive-node-registry.md`
- Verification: `node --check tools/zo-mcp.mjs`

### Nested Zo Scripts Do Not See Root-Only Computer Tokens

- Date: 2026-04-29
- Domain/provider: Windows PowerShell / nested Zo bootstrap repo
- Operation: syncing the Alliance deployment pack with `npm --prefix refer-zo-bootstrap run tandem:sync-runtime -- --instance alliance`
- Symptom: sync failed with `Missing Zo token. Set ZO_COMPUTER_ALLIANCE` even though the root MCP helper could reach Alliance
- Likely cause: npm ran the nested script from `refer-zo-bootstrap`, whose dotenv loader checks this repo's `.env.local` / `.env.master`, not the root workspace `.env.master`
- Mitigation: provide the computer token through process environment for that command without printing it, or place the non-committed node token in this repo's ignored local env file
- Script/doc now encoding mitigation: root `docs/known-limits-and-constraints.md`, this file
- Verification: process-env bridged `tandem:sync-runtime -- --instance alliance --preset all --check --json` completed successfully

### Direct Zo Builds Can Bypass Hive Intake Telemetry

- Date: 2026-04-29
- Domain/provider: Alliance Zo / zo.space route editing
- Operation: starting the Alliance Hub app shell build
- Symptom: zo.space routes appeared on Alliance, but the root hive app-shell item still had no dispatch, no intake contract, no Skills directory, and only the prior tandem ratification dataset files
- Likely cause: work was started through direct Zo route tools or chat-mediated build activity rather than the root hive director and Script Factory intake lane
- Mitigation: before mutating app builds, install or dispatch a governed Alliance build runner that writes intake contracts, route-change evidence, talkback, and token usage back to hive datasets
- Script/doc now encoding mitigation: root `.refer-factory/hive-backlog.md`, this file
- Verification: Alliance `list_space_routes` showed partial routes while root `.refer-factory/hive-backlog.json` had no app-shell dispatch record

### Hive Registry Writes Are Not Concurrent-Safe

- Date: 2026-04-29
- Domain/provider: root hive registry
- Operation: running multiple `hive:registry:heartbeat` commands in parallel
- Symptom: one node heartbeat can overwrite another because each command reads and rewrites the full `.refer-factory/hive-node-registry.json`
- Likely cause: the registry writer has no file lock or append-only event merge
- Mitigation: run hive registry writes sequentially; if parallel writes happen, inspect `npm run hive:registry -- --json` and reapply missing evidence
- Script/doc now encoding mitigation: root `docs/known-limits-and-constraints.md`, this file
- Verification: rechecked registry after parallel heartbeat writes and reapplied the Telechurch rectification evidence sequentially
