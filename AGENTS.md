# refer-zo-bootstrap

Portable REFER bootstrap for Zo computers. Cloned from GitHub, it installs the full REFER skill stack, authority surfaces, personas, and rules into a target Zo — turning any Zo into a governed VIPC operator.

## What Gets Installed

| Component | Description |
|---|---|
| **REFER.OS law** | Core governance files from `law/REFER.OS/` |
| **Universal skills** | 8 REFER skills synced to `Zo Files/Skills/` |
| **Authority surfaces** | Profile folder with operating rules, repo map, design system |
| **Persona + rules** | Startup binder and persistent behavior rules |
| **Install state** | `refer-install-state.json` for drift reconciliation |

## Bootstrap Flow

```bash
git clone https://github.com/lightedcandle/refer-zo-bootstrap.git
cd refer-zo-bootstrap
npm install
ZO_COMPUTER=<your-token> npm run bootstrap -- --profile <app> --instance refer
```

Or use the helper directly:

```bash
node tools/vipc-bootstrap.mjs --profile myapp --instance refer
```

## Profile Derivation

If `--profile` is omitted, the bootstrap derives the profile from the Zo Files workspace — looking for existing project directories or context markers. Explicit is better:

```bash
node tools/vipc-bootstrap.mjs --profile alliance --instance refer
```

## Skills Installed

Universal skills (always):

- `refer-os` — startup binding and routing entry
- `refer-zo-intake-router` — request classification and routing
- `refer-governance` — law, authority, rule management
- `refer-contract-tandem` — Codex-to-Zo handoff contract
- `refer-library-bootstrap` — library version drift repair
- `refer-vipc-build-director` — build director automation
- `refer-vipc-operator-driver` — operator task driver
- `refer-vipc-design-driver` — visual/design contracts

## Token Resolution

| Instance | Env Variable |
|---|---|
| `refer` (default) | `ZO_COMPUTER_REFER` → `ZO_ACCESS_TOKEN` → `ZO_COMPUTER` |
| `telechurch` | `ZO_COMPUTER_TELECHURCH` |
| Any other name | `ZO_COMPUTER_<UPPERCASE_NAME>` |

Set tokens in `.env.local` or `.env.master` in the repo root. Never commit tokens.

## Non-Negotiables

- Zo is the **operator layer**, not the system of record. Canonical truth lives in the target app's GitHub repo.
- No production mutation from Zo without explicit approval and a Codex handoff.
- Stub, sandbox, and production behavior must always be labeled.
- Bootstrap is **idempotent** — running it again safely reconciles drift.

## Repo Structure

```
refer-zo-bootstrap/
├── AGENTS.md              ← You are here
├── README.md              ← Project overview
├── package.json           ← npm scripts and bin entry points
├── .gitignore
├── .github/
│   └── workflows/         ← CI, publish, release workflows
├── docs/                  ← Bootstrap blueprint and usage docs
├── law/
│   └── REFER.OS/         ← Core REFER law files
├── skills/
│   ├── library-manifest.json
│   ├── refer-os/
│   ├── refer-zo-intake-router/
│   ├── refer-governance/
│   ├── refer-contract-tandem/
│   ├── refer-library-bootstrap/
│   ├── refer-vipc-build-director/
│   ├── refer-vipc-operator-driver/
│   ├── refer-vipc-design-driver/
│   └── zo-design-driver/
├── refer-install-state.json
└── tools/
    ├── vipc-bootstrap.mjs   ← Main bootstrap installer
    └── zo-mcp.mjs           ← MCP helper CLI
```

## For Zo Developers

After bootstrap, the Zo Files workspace will contain:

- `AGENTS.md` — workspace-level memory and guidance
- `agent.md` — runtime binder pointing to active profile paths
- `Skills/` — installed REFER skill library
- `REFER.OS/` — REFER law files
- `<PROFILE>/` — authority surfaces for the active profile
