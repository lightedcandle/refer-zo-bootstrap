# REFER Zo Bootstrap

Portable REFER bootstrap package for Zo.

This repo installs the REFER startup stack into Zo Files:

- persona startup map and persistent rules
- `agent.md` and `AGENTS.md` binders
- full `REFER.OS` law mirror
- universal REFER skills under `Skills/`
- profile folders and handoff templates

## Install

Clone the repo:

```bash
git clone https://github.com/lightedcandle/refer-zo-bootstrap.git
cd refer-zo-bootstrap
```

Set the Zo token for the target instance in your environment:

```powershell
$env:ZO_COMPUTER_REFER = "..."
```

Run bootstrap:

```bash
node tools/vipc-bootstrap.mjs --profile refer --instance refer
```

For another instance:

```bash
node tools/vipc-bootstrap.mjs --profile telechurch --instance telechurch
```

If Zo reports a nonstandard Files root, pass it explicitly:

```bash
node tools/vipc-bootstrap.mjs --profile refer --instance refer --remote-root /path/from/zo/pwd
```

Verify an installed Zo computer without mutating it:

```bash
node tools/vipc-bootstrap.mjs --profile telechurch --instance telechurch --mode verify
```

Verification checks binder readback, required skills, `REFER.OS`, persona startup marker, REFER rule markers, and stale machine-local path assumptions.

## Layout

- `skills/` - portable REFER skill library for Zo.
- `tools/vipc-bootstrap.mjs` - governed installer for Zo Files, persona, rules, and skills.
- `tools/zo-mcp.mjs` - low-level MCP helper for controlled Zo tool calls.
- `scripts/factory/compression-codec.mjs` - lossless machine-packet compression/decompression for factory lanes.
- `scripts/factory/bilateral-sim.mjs` - simulation path for direct chat vs typed-contract/compressed transport.
- `scripts/factory/dispatch-contract.mjs` - low-token dispatch loop for contract ship, runner trigger, and talkback fetch.
- `docs/factory-topology.md` - map of root factory, Zo bootstrap factory, and live Zo proving node.
- `docs/parallel-factory-orchestration.md` - build director lane rules for cross-factory work.
- `docs/machine-compression.md` - typed contract, compression, and talkback transport rules.
- `docs/file-transport-tandem.md` - low-token Zo lane using file/API transport and minimal activation.
- `law/REFER.OS/` - full REFER law mirror installed into Zo Files.
- `docs/` - Zo capability notes and bootstrap doctrine.

## Authority Model

Persona is the Zo-native startup binder. Rules are always-on guardrails. Zo Files carries durable law and profile context. Skills are procedural wrappers that point back to law.

```text
Zo Persona
-> Zo Rules
-> Zo Files/agent.md and AGENTS.md
-> Zo Files/REFER.OS/**
-> Zo Files/Skills/**
```

The Pendulum Build Director is included as `refer-vipc-build-director`, but it should only run when explicitly activated for autonomous tracker/worker execution.
