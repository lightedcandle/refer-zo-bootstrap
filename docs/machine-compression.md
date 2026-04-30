# Machine Compression

## Rule

Human-facing chat remains natural language. Machine-facing work should use compressed transport derived from typed contracts.

```text
human chat
-> typed contract
-> compressed machine payload
-> worker / Zo Files inbox / hive node
-> compressed talkback
-> typed result
-> human summary
```

The typed contract is authority. Compression is transport only.

## Codec

The dependency-free codec lives at:

```text
scripts/factory/compression-codec.mjs
```

It supports:

- domain-specific key aliasing;
- common enum/value aliasing;
- raw deflate compression;
- base64url packet transport;
- lossless decompression back to the typed packet;
- S-expression previews for inspection.

Packet format:

```text
sx1:<domain>:<base64url-deflated-aliased-json>
```

Current domains:

- `factory_sim`
- `codex_task`
- `zo_task`
- `talkback`

## Commands

Self-test:

```powershell
npm run codec:self-test
```

Encode:

```powershell
node scripts/factory/compression-codec.mjs encode --domain zo_task --file task.json
```

Decode:

```powershell
node scripts/factory/compression-codec.mjs decode --payload "sx1:zo_task:..."
```

## Quality Bar

Every compressed machine packet must round-trip:

```text
typed packet -> compressed payload -> decoded packet
```

If round-trip changes the typed packet, the compressed transport is invalid.

## Domain Strategy

Do not force universality when a domain-specific codec saves more tokens. Prefer per-domain aliases when the domain is stable:

- Codex task packets can compress source repo, context refs, mutation scope, and report paths.
- Zo task packets can compress instance, workspace, persona/rule, hive, and deployment fields.
- Talkback packets can compress status, evidence, blockers, changed files, and next action.

Use a universal fallback only for fields shared across domains.

## Zo File/API Tandem

For Zo computers, compressed payloads should normally travel through MCP file APIs rather than Zo chat:

```text
create_or_rewrite_file(contract envelope)
run_bash_command(short runner activation)
read_file(talkback)
```

The full task body belongs in the saved contract, not in a Zo chat prompt. See `docs/file-transport-tandem.md`.
