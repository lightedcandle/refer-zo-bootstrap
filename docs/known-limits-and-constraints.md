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

### Large Zo Full-Bundle Syncs Can Terminate Internally

- Date: 2026-04-30
- Domain/provider: Zo MCP / tandem runtime sync
- Operation: syncing the full updated tandem runtime bundle to Alliance with `--preset all --check --json`
- Symptom: MCP upload failed with `create_or_rewrite_file failed: modal-http: internal error: function was terminated by signal`
- Likely cause: full-bundle upload size/duration exceeded a provider execution limit during repeated `create_or_rewrite_file` calls
- Mitigation: sync changed files narrowly with repeated `--file <path>` arguments, then run `--check`
- Script/doc now encoding mitigation: root `docs/known-limits-and-constraints.md`, this file
- Verification: narrow changed-file Alliance sync completed and remote syntax check returned `returncode=0`

### Zo Read File Can Truncate Long Generated Manifests

- Date: 2026-05-01
- Domain/provider: Zo MCP / Alliance script artifacts
- Operation: reading generated Phase 3 modal manifests from Zo Files with `read_file`
- Symptom: manifest output was returned as head/tail text and JSON parsing failed with `Bad control character in string literal`
- Likely cause: large generated JSON containing multiline JSX exceeded the Zo file read display budget
- Mitigation: generate large scoped manifests in the app scope, then feed the manifest directory to the generic route-manifest bridge
- Script/doc now encoding mitigation: `scripts/factory/route-manifest-bridge.mjs`, `docs/scoped-app-boundary.md`
- Verification: `npm run route:manifest-bridge -- --instance alliance --dry-run --json --manifest-command "node scopes/alliance/phase3-manifest.mjs" --manifest-dir <scoped manifest dir>` completed after switching away from Zo manifest readback

### Zo Managed Service Entrypoints Are Not Shell Commands

- Date: 2026-05-01
- Domain/provider: Zo managed services / Alliance Zo Site
- Operation: restarting the public `alliance` site service
- Symptom: entrypoint `NODE_ENV=production bun run server.ts` crashed and the public URL returned HTTP 520
- Likely cause: supervisord executes service entrypoints directly rather than through a shell, so inline environment assignments are not interpreted
- Mitigation: use a direct command such as `bun run server.ts`, and run `bun run build` from the scoped site sync script before restarting the service
- Script/doc now encoding mitigation: `scopes/alliance/sync-site-to-zo.mjs`, this ledger
- Verification: `service_doctor` for `alliance` reported `RUNNING`, `port: 51303`, and `code: up to date`

### Sequential Phase Status/Next Dependencies

- Date: 2026-05-01
- Domain/provider: Alliance scoped phase scripts
- Operation: running `alliance:phase5-status` and `alliance:phase5-next` concurrently
- Symptom: `phase5-next` reported stale gaps because it read `phase5-status-latest.json` before the status script rewrote it
- Likely cause: next-action sensors that depend on latest status artifacts are not concurrency-safe
- Mitigation: run status scripts before next scripts when the next script reads the status artifact
- Script/doc now encoding mitigation: this ledger
- Verification: reran `npm run alliance:phase5-next` after `npm run alliance:phase5-status`; packet returned `ready_for_next_phase: true`

### Supabase Secrets Cannot Use SUPABASE_ Prefix

- Date: 2026-05-01
- Domain/provider: Supabase CLI / Edge Functions
- Operation: deploying Alliance `alliance-record-write` Edge Function secrets
- Symptom: `supabase secrets set` skipped `SUPABASE_SERVICE_ROLE_KEY` with `Env name cannot start with SUPABASE_`
- Likely cause: Supabase reserves the `SUPABASE_` env prefix for platform-provided variables
- Mitigation: set `SERVICE_ROLE_KEY` as the Edge Function service role secret and keep `SUPABASE_URL` platform-provided; Zo receives only URL, anon key, and function name
- Script/doc now encoding mitigation: `scopes/alliance/supabase-edge-deploy.mjs`, `scopes/alliance/supabase/functions/alliance-record-write/index.ts`
- Verification: `npm run alliance:supabase-edge-deploy -- --deploy`; `npm run alliance:supabase-probe -- --instance alliance`

### Telechurch E2E Git Status Can Fail On Corrupt/Missing Tree

- Date: 2026-05-01
- Domain/provider: Git / `E:\telechurch-e2e`
- Operation: checking Telechurch E2E worktree status after staging an Alliance Edge Function copy
- Symptom: `git status --short` failed with `fatal: unable to read tree (...)`
- Likely cause: the local Telechurch E2E repository has a missing or corrupt Git object
- Mitigation: do not rely on that repo's Git status until the object store is repaired or the repo is recloned; keep Alliance authoritative source under `refer-zo-bootstrap/scopes/alliance/`
- Script/doc now encoding mitigation: this ledger
- Verification: Alliance Edge Function source is tracked in `scopes/alliance/supabase/functions/alliance-record-write/index.ts` and deploy artifact records the copied Telechurch path

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

### Nested Zo Token Files Can Drift From Root Tokens

- Date: 2026-04-30
- Domain/provider: Zo MCP / nested Zo bootstrap repo
- Operation: syncing Telechurch with `sync-tandem-runtime-to-zo.mjs --instance telechurch --check`
- Symptom: the nested repo token returned `Authentication failed: 401: Invalid API key`, while the parent private token succeeded
- Likely cause: ignored nested `.env.local` / `.env.master` can become stale independently from the root private token source
- Mitigation: inject the current parent token into the process environment without printing it, or refresh this repo's ignored local env file
- Script/doc now encoding mitigation: root `docs/known-limits-and-constraints.md`, this file
- Verification: parent-token bridged Telechurch sync completed with remote syntax check `returncode=0`

### Hive Dispatcher Packaging Must Be Cross-Platform

- Date: 2026-04-30
- Domain/provider: Zo bootstrap packaging / Windows PowerShell
- Operation: building the upstream hive bundle with `node scripts/factory/hive/dispatcher.mjs package --type=hive`
- Symptom: packaging failed because Unix `cp` was not available on Windows
- Likely cause: dispatcher used shell-specific `cp` and `find` instead of Node filesystem APIs, and its repo root resolved to `scripts/`
- Mitigation: package through Node `cpSync`/recursive traversal, use a temp directory outside the repo, and keep only `tar` as the archive command
- Script/doc now encoding mitigation: `scripts/factory/hive/dispatcher.mjs`, this file
- Verification: hive and cell packages built successfully on Windows

### Alliance Bootstrap Verify Can Exceed Chat Command Timeout

- Date: 2026-04-30
- Domain/provider: Zo MCP / Alliance bootstrap verification
- Operation: `node tools/vipc-bootstrap.mjs --profile alliance --instance alliance --mode verify`
- Symptom: local command timed out before returning a verifier result
- Likely cause: full bootstrap verification can take longer than the current chat command timeout or wait on slow MCP file/API calls
- Mitigation: verify live build state with bounded MCP probes (`list_space_routes`, `get_space_errors`, targeted `get_space_route`, and `list_files`) while rerunning full bootstrap verification with a longer out-of-band timeout when needed
- Script/doc now encoding mitigation: root and nested known-limits ledgers
- Verification: Alliance MCP probes returned app routes, clean space errors, route source for `/` and `/organizations`, and workspace files including `Skills/`, `REFER.OS/`, datasets, and `refer-zo-bootstrap/`
