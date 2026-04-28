# Script Factory — Architecture & Distribution Blueprint

Last updated: 2026-04-28

---

## Core Insight

Every Zo computer that runs REFER has the same goal: be governed by law and grow intelligently through chat. The system that does the growing is the **Script Factory**. The system that keeps the growing honest is **REFER**.

These two are **separate packages** with separate distribution paths, even though they ship together through the same bootstrap.

---

## Two-Package System

### Package A: `refer-law`
**What:** The governing rule + law stack. Not a script runner — a set of constraints, skills, and reference documents that tell any AI how to behave correctly.

**Distribution:** Installed as `Skills/refer-*` via `vipc-bootstrap.mjs` or copied directly from `skills/` in the repo.

**Contains:**
- `skills/refer-os/` — startup binder, entry wrapper
- `skills/refer-zo-intake-router/` — classification and routing
- `skills/refer-governance/` — authority, canonical surfaces
- `skills/refer-contract-tandem/` — Codex/Zo tandem protocol
- `skills/refer-library-bootstrap/` — version reconciliation
- `skills/refer-vipc-operator-driver/` — operator boundaries
- `skills/refer-vipc-design-driver/` — visual design overlay
- `skills/refer-vipc-build-director/` — build automation
- `skills/zo-design-driver/` — universal design principles
- `skills/zo-free-tier-platform-limits/` — platform constraints
- `law/REFER.OS/*.md` — the legal references

**Install:** Copy to `Zo Files/Skills/` and update `refer-install-state.json` on the target machine.

---

### Package B: `script-factory`
**What:** A living, autonomous skill. Runs a heartbeat every 5 minutes, scans for gaps, registers scripts, and evolves through DISCUSS/BUILD/MICRO modes. Can be queried directly by any operator.

**Distribution:** `scripts/factory/` in the repo, installed via `bootstrap.mjs` or as a callable skill skill.

**Contains:**
- `intake-engine.mjs` — Three-mode parser: DISCUSS / BUILD / MICRO
- `factory.mjs` — CLI entry point for direct operator queries
- `heartbeat.mjs` — Heartbeat train orchestrator
- `cars/01-dashboard-state.mjs` — Writes to heartbeat-state.json
- `cars/02-task-executor.mjs` — Executes queued tasks
- `cars/03-scan-gaps.mjs` — Identifies what needs to be built
- `decompress.mjs` — S-expression decompressor
- `emit-contract.mjs` — Contract emitter
- `scan-workspace.mjs` — Workspace scanner
- `register-artifact.mjs` — Artifact registry
- `sync-skill.mjs` — Skill synchronizer
- `script-registry.json` — Registry of all captured scripts
- `scriptionary.json` — S-expression vocabulary
- `artifacts/` — Generated scripts and documentation
- `heartbeat-state.json` — Current runtime state
- `heartbeat.log` — Execution log

**Install:** `bootstrap.mjs` in the same directory copies the factory to the target Zo's workspace and registers it as a scheduled automation.

---

## The Three Operating Modes

These three modes apply to every prompt that enters the Script Factory:

```
Human Prompt
     ↓
  intake      ← Parse, compress, classify mode
     ↓
S-Expression  ← Compressed canonical form
     ↓
decompress   ← Expand to full intent
     ↓
Route / Execute
```

| Mode | Behavior |
|---|---|
| **DISCUSS** | Full pipeline. Returns S-expression compressed guidance. No file writes. No execution. |
| **BUILD** | Full pipeline. Full execution. File writes, script registration, full execution. |
| **MICRO** | Direct script execution. Bypasses intake parser but still passes through S-expression context compression. Used for targeted single-shot scripts. |

Every prompt is treated as a BUILD intent unless it explicitly says DISCUSS or MICRO. Mode is determined by the first token in the prompt or by explicit declaration.

---

## Hive — The Inter-Factory Network

### What is Hive?

Hive is the network of Script Factory instances that can talk to each other. When one factory detects something it doesn't know, it can ask another factory on the network. This creates a distributed, self-improving system of factories.

### How Hive Communication Works

Each factory on Hive is a **node**. A node exposes two things:

1. **Talkback endpoint** — AZo Space API route on the factory's Zo Space at `/api/hive/talkback`
2. **Query capability** — Can ask other nodes for scripts, gap analysis, or context

### Talkback Protocol

**Outgoing** (when a factory needs external help):
```
1. Compress the need into an S-expression
2. POST to /api/hive/talkback on the target node
3. Wait for compressed response
4. Decompress and execute or forward to operator
```

**Incoming** (when a factory receives a request):
```
1. Receive S-expression from requester
2. Decompress to full intent
3. Check script-registry for a match
4. If no match: run gap analysis, attempt BUILD MICRO
5. Compress result back to S-expression
6. Return response
```

### Talkback File

`scripts/factory/hive/talkback.mjs` — implements both incoming handler and outgoing requestor.

### Node Registry

`scripts/factory/hive/nodes.json` — list of known Hive nodes:
```json
{
  "nodes": [
    {
      "id": "telechurch",
      "name": "Telechurch Factory",
      "url": "https://telechurch.zo.space",
      "talkback_path": "/api/hive/talkback",
      "last_seen": "2026-04-28T00:00:00Z",
      "active": true
    }
  ]
}
```

### Node Discovery

Nodes register themselves via a periodic ping to a known relay node. Alternatively, a static `nodes.json` can be maintained manually or pulled from a shared URL.

---

## Interlink — Remote Access Protocol

### What is Interlink?

Interlink is the mechanism by which one Zo (the **operator Zo**) can access and manipulate files on another Zo (the **target Zo**) using the target's API key. It is the equivalent of SSH + MCP combined.

### How Interlink Works

1. The operator has the target's `zo_sk_*` API key
2. The operator opens an MCP session to `https://api.zo.computer/mcp` with that key
3. The operator can then call tools (`run_bash_command`, `read_file`, `create_or_rewrite_file`, etc.) on the target as if it were local

### Interlink Requirements

- The target Zo must have generated an API access token
- The token must be shared with the operator securely (Zo Secrets, not in files)
- The operator must know the target's workspace root path (e.g., `/home/workspace`)

### Interlink Session Pattern

```javascript
const targetKey = process.env.INTERLINK_TARGET_KEY; // from secrets
const MCP_URL = "https://api.zo.computer/mcp";

async function interlinkSession() {
  const response = await fetch(MCP_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${targetKey}`,
      "Content-Type": "application/json",
      "MCP-Protocol-Version": "2024-11-05",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "interlink", version: "0.1.0" }
      }
    })
  });
  const sessionId = response.headers.get("mcp-session-id");
  return sessionId;
}
```

### Interlink Tools

Through Interlink, the operator can:
- `read_file` — Read any file on the target
- `create_or_rewrite_file` — Write files on the target
- `run_bash_command` — Execute commands on the target
- `create_automation` / `edit_automation` / `delete_automation` — Manage schedules
- `list_personas` / `create_persona` / `set_active_persona` — Manage personas
- `list_rules` / `create_rule` — Manage rules
- `list_space_routes` / `write_space_route` / `edit_space_route` — Manage Zo Space

### Interlink vs. Hive

- **Interlink** is for direct file/system control of a known target Zo
- **Hive Talkback** is for factory-to-factory communication in the S-expression protocol
- Interlink is used to install and bootstrap Hive nodes; Hive runs on top once installed

---

## Distribution Path

### Option 1: GitHub (Primary Distribution)

**Repo:** `https://github.com/lightedcandle/refer-zo-bootstrap`

```
refer-zo-bootstrap/
├── skills/                    ← Package A: refer-law
│   ├── refer-os/
│   ├── refer-zo-intake-router/
│   ├── refer-governance/
│   ├── refer-contract-tandem/
│   ├── refer-library-bootstrap/
│   ├── refer-vipc-operator-driver/
│   ├── refer-vipc-design-driver/
│   ├── refer-vipc-build-director/
│   ├── zo-design-driver/
│   ├── zo-free-tier-platform-limits/
│   ├── library-manifest.json
│   └── README.md
├── scripts/
│   └── factory/              ← Package B: script-factory (not yet on GitHub)
│       ├── intake-engine.mjs
│       ├── factory.mjs
│       ├── heartbeat.mjs
│       ├── decompress.mjs
│       ├── emit-contract.mjs
│       ├── scan-workspace.mjs
│       ├── register-artifact.mjs
│       ├── sync-skill.mjs
│       ├── cars/
│       │   ├── 01-dashboard-state.mjs
│       │   ├── 02-task-executor.mjs
│       │   └── 03-scan-gaps.mjs
│       ├── hive/
│       │   ├── talkback.mjs
│       │   ├── nodes.json
│       │   └── README.md
│       ├── artifacts/
│       ├── script-registry.json
│       ├── scriptionary.json
│       ├── heartbeat-state.json
│       ├── heartbeat.log
│       └── bootstrap.mjs      ← Installs both Package A and B to target Zo
├── law/
│   └── REFER.OS/              ← Law files (moved to skills/REFER.OS/ on install)
├── tools/
│   ├── vipc-bootstrap.mjs    ← Pushes refer-law to target Zo
│   └── zo-mcp.mjs            ← Zo MCP CLI tool
├── AGENTS.md
├── README.md
├── DEPLOY.md
├── refer-install-state.json   ← Template (tokens: <PROFILE>, <TIMESTAMP>)
└── .gitignore
```

**Workflow:**
1. Factory machine clones/pulls from GitHub
2. Factory develops and evolves `scripts/factory/` and `skills/`
3. On release, push to GitHub
4. Target Zo machines clone from GitHub and run bootstrap

### Option 2: Zo Skills Registry

Skills published to the public Zo skills registry can be installed directly from within Zo without manual cloning.

**For refer-law:**
- Each `skills/refer-*` folder becomes a Zo skill
- Users install via Zo skill browser

**For script-factory:**
- The entire `scripts/factory/` directory becomes a single skill named `script-factory`
- Installed skill runs heartbeat as a background process

**Current limitation:** The script-factory has background processes (heartbeat) that must run via automation — Zo skills alone don't handle background daemons. The `bootstrap.mjs` handles the automation registration.

### Recommended Distribution: Hybrid

| Component | Distribution |
|---|---|
| refer-law skills | GitHub + Zo Skills Registry (dual track) |
| script-factory | GitHub only (requires bootstrap.mjs for full install) |
| law files | Bundled in refer-law package |
| bootstrap installers | GitHub only |

---

## What Needs to Be Built

### 1. `scripts/factory/hive/talkback.mjs`
- Incoming S-expression handler (Zo Space API route)
- Outgoing requestor (calls other nodes)
- Node health check / ping
- Automatic node discovery from `nodes.json`

### 2. `scripts/factory/hive/nodes.json`
- Static registry of known Hive nodes
- Includes: node ID, name, Zo Space URL, talkback path, last_seen, active flag

### 3. `scripts/factory/bootstrap.mjs`
- Copies `scripts/factory/` to target Zo's workspace
- Registers `heartbeat.mjs` as a Zo automation (every 5 minutes)
- Creates `nodes.json` with the local node's info
- Sets up the Interlink access to the factory machine (if configured)

### 4. `scripts/factory/interlink.mjs`
- Wrapper around the Interlink session pattern
- Used by the operator to reach into the target Zo
- Can be used to bootstrap a new Hive node remotely

### 5. Sync `scripts/factory/` to GitHub
- Create `scripts/factory/` directory in the GitHub repo
- Upload all factory files
- Keep in sync with apostlej's living version

---

## Next Steps (Priority Order)

1. **Finalize `talkback.mjs`** — the core Hive protocol
2. **Write `nodes.json`** — seed with telechurch node
3. **Finalize `bootstrap.mjs`** — combines Package A + B install
4. **Write `DEPLOY.md`** — operator-facing installation docs
5. **Sync factory files to GitHub** — make distribution possible
6. **Test Interlink** — confirm remote execution across two Zo machines