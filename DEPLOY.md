# refer-zo-bootstrap — Operator Deployment Guide

Last updated: 2026-04-28

---

## Overview

`refer-zo-bootstrap` ships two packages:

- **Package A — refer-law**: Governance rules, skills, and law files
- **Package B — script-factory**: Autonomous living skill with heartbeat and gap scanning

Both packages can be installed on any Zo computer.

---

## Installation: Package A — refer-law

### Option A1: Manual copy (always works)
```bash
# On the target Zo, copy the skills folder
cp -r refer-zo-bootstrap/skills /home/workspace/Skills/

# Copy law files
cp -r refer-zo-bootstrap/law/REFER.OS /home/workspace/REFER.OS

# Copy manifest and install state
cp refer-zo-bootstrap/skills/library-manifest.json /home/workspace/Skills/
cp refer-zo-bootstrap/refer-install-state.json /home/workspace/

# Update refer-install-state.json:
#   - machine_label → your profile name (e.g., "jamaicaeats")
#   - last_installed_at → current ISO timestamp
#   - bootstrap_complete → true
#   - startup_binding_installed → true
```

### Option A2: Via vipc-bootstrap.mjs (factory → target)
```bash
node tools/vipc-bootstrap.mjs --profile <name> --instance refer
```
Requires `ZO_COMPUTER_REFER` (or `ZO_ACCESS_TOKEN`) env var set in `.env.local` on the factory machine.

---

## Installation: Package B — script-factory

### Option B1: Via bootstrap.mjs (recommended)
```bash
node scripts/factory/bootstrap.mjs --target-workspace /home/workspace
```
This copies the entire `scripts/factory/` directory to the target and registers the heartbeat automation.

### Option B2: Manual copy
```bash
cp -r scripts/factory /home/workspace/refer-factory/
```

### Activating heartbeat
After copy, the heartbeat runs via a Zo automation every 5 minutes. The automation is registered by `bootstrap.mjs`.

Manual heartbeat commands:
```bash
node /home/workspace/refer-factory/heartbeat.mjs --status     # check status
node /home/workspace/refer-factory/heartbeat.mjs --tick       # run one tick
node /home/workspace/refer-factory/heartbeat.mjs --sleep      # pause heartbeat
node /home/workspace/refer-factory/heartbeat.mjs --activate    # resume heartbeat
```

---

## Full Bootstrap (Both Packages)

```bash
# 1. Clone or pull the repo on the factory machine
git clone https://github.com/lightedcandle/refer-zo-bootstrap.git
cd refer-zo-bootstrap

# 2. Edit refer-install-state.json
#   Set machine_label, last_installed_at, bootstrap_complete=true

# 3. Run the full install
node scripts/factory/bootstrap.mjs --profile myapp --target-workspace /home/workspace

# 4. Verify
node scripts/factory/factory.mjs "status"
node scripts/factory/heartbeat.mjs --status
```

---

## Interlink: Remote Control of Another Zo

Interlink lets one Zo operate another Zo's workspace using the target's API key.

### Setup on target Zo
1. Go to target Zo → Settings → Advanced → Access Tokens
2. Create a token named "interlink"
3. Copy the token value

### Setup on operator Zo
1. Go to Settings → Advanced → Secrets
2. Add secret: `INTERLINK_<TARGET>_KEY` = the token from above
   e.g., `INTERLINK_TELECHURCH_KEY=zo_sk_5tMvpy0Y...`

### Using Interlink
```bash
node tools/zo-mcp.mjs --instance telechurch list-tools
node tools/zo-mcp.mjs --instance telechurch read-file --target-file /home/workspace/AGENTS.md
```

Or use the factory's interlink mode:
```bash
node scripts/factory/interlink.mjs --target telechurch -- cmd "ls /home/workspace"
node scripts/factory/interlink.mjs --target telechurch -- read /home/workspace/AGENTS.md
```

---

## Hive: Factory-to-Factory Communication

Hive lets Script Factory nodes talk to each other via S-expression protocol.

### Talkback endpoint
Each Hive node exposes a Zo Space API route:
```
GET/POST https://<node-zo-space>/api/hive/talkback
```

### Configuring your node
Edit `scripts/factory/hive/nodes.json` to register other known nodes:

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
  ],
  "self": {
    "id": "myfactory",
    "name": "My Factory",
    "url": "https://myzoo.zo.space",
    "talkback_path": "/api/hive/talkback"
  }
}
```

### Querying another node
```bash
node scripts/factory/hive/talkback.mjs --ask telechurch --query "what scripts do you have registered"
```

### Responding to requests
The talkback endpoint is a Zo Space API route. Install it with:
```bash
node scripts/factory/hive/talkback.mjs --install
```
This registers `/api/hive/talkback` on the local Zo Space.

---

## Directory Layout After Install

```
/home/workspace/                           ← Zo Files root
├── AGENTS.md                              ← Startup binder (from refer-law)
├── agent.md                               ← Startup binder
├── refer-install-state.json              ← Install tracking
├── Skills/                               ← Zo-native skills
│   ├── library-manifest.json
│   ├── refer-os/
│   ├── refer-zo-intake-router/
│   ├── refer-governance/
│   ├── refer-contract-tandem/
│   ├── refer-library-bootstrap/
│   ├── refer-vipc-operator-driver/
│   ├── refer-vipc-design-driver/
│   ├── refer-vipc-build-director/
│   ├── zo-design-driver/
│   └── zo-free-tier-platform-limits/
├── REFER.OS/                             ← Law files
│   ├── refer.zo.md
│   ├── refer.governance.md
│   └── ... (all law files)
├── MYAPP/                               ← Profile folder (created by bootstrap)
│   ├── myapp-vipc-operating-rules.md
│   ├── myapp-repo-connection-map.md
│   ├── myapp-design-system.md
│   ├── myapp-instance-notes.md
│   └── Templates/codex-handoff-prompt.md
├── refer-factory/                       ← Script Factory (Package B)
│   ├── factory.mjs
│   ├── heartbeat.mjs
│   ├── intake-engine.mjs
│   ├── decompress.mjs
│   ├── emit-contract.mjs
│   ├── scan-workspace.mjs
│   ├── register-artifact.mjs
│   ├── sync-skill.mjs
│   ├── script-registry.json
│   ├── scriptionary.json
│   ├── heartbeat-state.json
│   ├── heartbeat.log
│   ├── cars/
│   │   ├── 01-dashboard-state.mjs
│   │   ├── 02-task-executor.mjs
│   │   └── 03-scan-gaps.mjs
│   ├── hive/
│   │   ├── talkback.mjs
│   │   └── nodes.json
│   ├── artifacts/
│   └── bootstrap.mjs
└── usage/                               ← Usage ledger (from zo-mcp.mjs)
    └── zo-mcp-usage.jsonl
```

---

## Factory to Factory: The Full Loop

```
1. Operator prompts factory.mjs on Factory A
2. intake-engine.mjs classifies: DISCUSS / BUILD / MICRO
3. For BUILD:
   a. compresses prompt to S-expression
   b. decompresses into intent
   c. executes via cars
   d. registers result as artifact
4. If gap found and no local answer:
   a. checks nodes.json for Hive node
   b. POSTs S-expression to target node's talkback
   c. receives compressed response
   d. decompresses and returns to operator
5. operator confirms or redirects
```

---

## Requirements Checklist

- [ ] `refer-install-state.json` filled with profile tokens resolved
- [ ] `Skills/` folder copied to target
- [ ] `REFER.OS/` law files copied to target
- [ ] `refer-factory/` directory copied to target
- [ ] `bootstrap.mjs` run on target (registers heartbeat automation)
- [ ] `nodes.json` configured with all known Hive nodes
- [ ] `talkback.mjs` installed as Zo Space route (for incoming Hive requests)
- [ ] Interlink key stored in target Zo secrets (for remote operator access)
- [ ] Heartbeat automation confirmed active via `--status`