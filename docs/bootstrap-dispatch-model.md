# Bootstrap Packages — Factory-to-Factory Dispatch

## The Three Tiers

Every Zo computer starts from the same Script Factory codebase, but the **dispatch package** changes based on role:

| Node | Role | Bootstrap Package |
|---|---|---|
| **Hive Factory** (here — Telechurch) | Builds and ships dispatches | Full `refer-zo-bootstrap` + Hive tools + datasets + private `hive/` |
| **Hive** (apostlej) | Lives in the wild, ratifies, distributes | `hive-bootstrap.tar.gz` — stripped of factory build tools, no `factory/hive/` private code |
| **Cell** (all other Zo computers) | Consumes bootstrap, runs scripts | `cell-bootstrap.tar.gz` — minimal, Hive-only subset, no factory tools |

## Privacy Model

```
Hive Factory (private)          Hive (dispatchable)         Cell (receives only)
─────────────────────           ─────────────────────         ────────────────────
factory/hive/      ← KEPT      factory/hive/      ← GONE    factory/hive/    ← GONE
factory/tools/*    ← KEPT      factory/tools/*    ← GONE    factory/         ← MINIMAL
datasets/          ← KEPT      datasets/          ← MINIMAL datasets/        ← MINIMAL
scripts/factory/   ← KEPT      scripts/factory/   ← MINIMAL scripts/factory/ ← MINIMAL
skills/            ← KEPT      skills/            ← ALL     skills/          ← ALL
AGENTS.md          ← KEPT      AGENTS.md          ← ALL     AGENTS.md        ← ALL
REFER.OS/          ← KEPT      REFER.OS/           ← ALL     REFER.OS/        ← ALL
```

## Bootstrap Package Contents

### `hive-bootstrap.tar.gz` (→ Hive node)
```
refer-zo-bootstrap/
├── AGENTS.md
├── ARCHITECTURE.md
├── DEPLOY.md
├── skills/                    ← all skills
├── law/REFER.OS/               ← all law
├── scripts/factory/
│   ├── compress-prompt.mjs     ← core intake
│   ├── forge-auto-capture.mjs
│   ├── auto-chunker.mjs
│   ├── heartbeat.mjs
│   ├── train-cars/             ← all train-cars
│   ├── script-registry.json
│   ├── factory.mjs             ← CLI (no build tools)
│   ├── bootstrap.mjs           ← bootstrap installer
│   └── interlink.mjs           ← cross-node comms
├── datasets/
│   ├── chat-contracts/
│   ├── chat-logs/
│   ├── request-watchdog/
│   └── script-registry/        ← no node-identity (private)
└── hive/
    └── manifest.json           ← public manifest ONLY
```

### `cell-bootstrap.tar.gz` (→ Cell node)
```
refer-zo-bootstrap/
├── AGENTS.md
├── skills/                    ← all skills
├── law/REFER.OS/              ← all law
├── scripts/factory/
│   ├── compress-prompt.mjs
│   ├── forge-auto-capture.mjs
│   ├── auto-chunker.mjs
│   ├── heartbeat.mjs
│   ├── train-cars/
│   └── script-registry.json
└── datasets/
    ├── chat-contracts/
    └── chat-logs/
```

## Dispatch Protocol (HDP-1)

1. **Hive Factory** runs `scripts/factory/hive/api.mjs` on its Zo
2. Peers call `GET /hive/manifest` to see available packages
3. Peers call `GET /hive/download?package=hive` or `?package=cell`
4. Hive Factory ships only the appropriate tarball
5. Recipient runs `bootstrap.mjs` locally

## Dataset Usage

| Dataset | Who writes | Retention |
|---|---|---|
| `chat-contracts` | compress-prompt.mjs | Full history, never purged |
| `chat-logs` | heartbeat.mjs, train-cars | Full history |
| `request-watchdog` | compress-prompt.mjs | Purge on resolution + 24h |
| `script-registry` | compress-prompt.mjs, heartbeat | Snapshot each change |
| `node-identity` | interlink.mjs on first run | Never synced or pushed |
| `hive-factory-dispatch` | Hive Factory only | Audit trail of all dispatches |

## Dataset → Chunky Monkey Chaining

When compress-prompt.mjs routes a request:

1. `chat-contracts/` → writes intake contract + mode + chunk plan
2. `request-watchdog/` → writes pending entry per chunk
3. Child sessions write responses → `chat-logs/`
4. Watchdog resolves entries on timeout or return
5. Full contract + all chunk results → `chat-contracts/` as completed record

This means **every prompt processed by the factory is fully auditable** in datasets, even if the chat session itself is gone.