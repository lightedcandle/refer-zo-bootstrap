# File Transport Tandem

## Purpose

Zo chat is the expensive lane. The default tandem path should use Zo MCP/API file operations for contracts, scripts, and talkback, then use at most a tiny activation command.

Preferred flow:

```text
Codex director
-> typed contract
-> compressed packet
-> MCP create_or_rewrite_file into Zo Files inbox
-> MCP run_bash_command triggers one runner command
-> Zo runner reads contract and writes talkback file
-> Codex fetches talkback with MCP read_file
-> director ratifies source
```

Use Zo chat only when the running persona/rule model itself must judge something. Even then, save the full contract in Zo Files first and send a minimal activation prompt such as:

```text
Run the latest contract from the REFER contract inbox and write talkback only.
```

Do not paste the full contract into Zo chat.

## Files

Default inbox on Zo:

```text
/home/workspace/datasets/tandem-contracts/inbox/
```

Default talkback outbox on Zo:

```text
/home/workspace/datasets/tandem-talkback/outbox/
```

Local mirrors:

```text
datasets/tandem-contracts/outbox/
datasets/tandem-talkback/inbox/
datasets/tandem-dispatch/reports/
```

These local mirrors are runtime transport records, not source doctrine.

The tandem datasets are intentionally separate from live Zo user datasets. Promote tandem work into `chat-contracts`, `talkback-queue`, or `hive-factory-dispatch` only when the runner intentionally turns a machine contract into live hive work.

Build-intake records are stored separately:

```text
datasets/build-activity/records/
```

These records prove that a route or app change started from a typed contract before mutation.

## Commands

Sync the reusable tandem runtime scripts/docs to Zo:

```powershell
npm run tandem:sync-runtime -- --instance telechurch --check
```

The sync command is the required script-first path for the tandem runtime. Do not use ad hoc shell upload loops for this known file set.

Run the full dispatch loop locally as a dry-run:

```powershell
npm run dispatch:contract -- --dry-run --instance telechurch --task "verify installed bootstrap binders without mutating files"
```

Ship, trigger the minimal runner, and fetch compressed talkback:

```powershell
npm run dispatch:contract -- --instance telechurch --task "verify installed bootstrap binders without mutating files" --trigger --fetch
```

Ship a contract by file/API only:

```powershell
npm run tandem:ship -- --instance telechurch --task "verify installed bootstrap binders without mutating files"
```

Dry-run the same contract locally without contacting Zo:

```powershell
npm run tandem:ship -- --dry-run --instance telechurch --task "verify installed bootstrap binders without mutating files"
```

Ship and trigger the minimal runner by API command:

```powershell
npm run tandem:ship -- --instance telechurch --task "verify installed bootstrap binders without mutating files" --trigger
```

Fetch plain talkback:

```powershell
npm run tandem:fetch -- --instance telechurch --contract-id zo.file.<id>
```

Fetch compressed talkback and decode it locally:

```powershell
npm run tandem:fetch -- --instance telechurch --contract-id zo.file.<id> --compressed
```

Run the local runner directly, useful for testing the Zo-side command before deployment:

```powershell
npm run contract:run-once -- --contract datasets/tandem-contracts/outbox/<id>.json
```

## Rules

- The typed contract remains the authority.
- The compressed packet is only transport.
- The activation command should be short and should not contain the task body.
- The Zo-side runner writes talkback to files instead of returning long chat output.
- If a runner needs more capability, update the runner script and bootstrap package rather than increasing chat usage.
- Polling is not required for the director path: ship, trigger, fetch.
- The dispatch, ship, fetch, and runner scripts log estimated token use to the root chat-surface ledger when `refer-zo-bootstrap` is nested under `refer-script-factory`.
- When the root token ledger is unavailable on a Zo computer, the same scripts write a Zo-local fallback ledger in `datasets/tandem-usage/`.
- Use `npm run tandem:backfill-usage -- --zo-computer telechurch` to backfill older Zo-local usage records that predate scoped account tracking.
- Any new transport limit or readback behavior must be recorded in `docs/known-limits-and-constraints.md`.

## Bounded Runner

`scripts/factory/contract-inbox-runner.mjs` verifies that Zo can read the saved contract, decode transport, and write talkback. It also supports a deliberately narrow non-mutating execution block:

```json
{
  "execution": {
    "executor": "zo.bounded.v1",
    "mode": "non_mutating",
    "operations": [
      { "op": "file_exists", "path": "/home/workspace/refer-zo-bootstrap/package.json" },
      { "op": "list_dir", "path": "/home/workspace/refer-zo-bootstrap/scripts/factory" },
      { "op": "read_json", "path": "/home/workspace/refer-zo-bootstrap/package.json" }
    ]
  }
}
```

Allowed operations are `echo`, `file_exists`, `list_dir`, and `read_json`. Paths must stay under `/home/workspace`, sensitive path names such as `.env*`, token, credential, certificate, private, and secret are refused, and `read_json` refuses files larger than 20 KB.

`scripts/factory/dispatch-contract.mjs` is the director-level command. Prefer it over manually chaining ship/fetch commands when building out the hive.

## Route Build Rectification

zo.space route builds may happen through direct route tools before a full node-local intake runner exists. Treat those builds as live state that still needs upstream rectification, not as already-governed factory work.

The root Script Factory captures that state with:

```powershell
npm run hive:ratify-routes -- --instance alliance --id hive.task.alliance.app-shell.20260429 --expected "/,/organizations,/people,/calendar,/initiatives,/documents,/governance,/compliance,/communications,/profiles,/settings"
```

That command records route evidence in `.refer-factory/hive-route-ratifications/` and updates the root hive backlog. The required follow-up is to install a governed build intake lane so future route changes originate from typed contracts and return talkback, route evidence, and usage records.

Telechurch should cross-ratify the rectification pattern after source updates are made. Alliance then reruns the corrected flow so the app shell is not merely a one-off Zo route build.

## Governed Build Intake

Hive build contracts may include a `build_intake` block:

```json
{
  "build_intake": {
    "schema": "refer.zo.build-intake.v1",
    "change_id": "alliance.app-shell.next",
    "summary": "Create or update Alliance Hub app routes from typed intake.",
    "routes": ["/", "/organizations", "/people"],
    "route_policy": "Route mutation must follow this typed intake and return talkback.",
    "evidence_required": ["typed intake", "talkback", "route ratification", "usage record"]
  }
}
```

When the runner sees this block, it writes a build activity record under `datasets/build-activity/records/` and includes `build_intake:recorded` in talkback evidence. The runner does not perform route mutation by itself; it installs the governed origin that subsequent route work must cite.
