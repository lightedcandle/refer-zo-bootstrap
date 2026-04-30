# Telechurch Ratification - 2026-04-29

## Scope

This note records the first source ratification pass against the live Telechurch Zo hive proving instance.

## Live Readback

Telechurch Zo confirmed these installed surfaces:

- `/home/workspace/agent.md` binds startup to `AGENTS.md`, profile rules, repo map, and `Skills/refer-os/SKILL.md`.
- The active REFER VIPC persona contains `REFER VIPC STARTUP MAP`.
- Persistent rules contain the expected `[REFER VIPC RULE:*]` markers.
- `/home/workspace/refer-install-state.json` uses workspace paths such as `/home/workspace/Skills`.
- `/home/workspace/Skills/library-manifest.json` still carried older machine-local path assumptions.
- `/home/workspace/AGENTS.md` and `/home/workspace/refer-zo-bootstrap/AGENTS.md` still carried old `refer-script-factory` governance text.

## Telechurch Zo Ratification Response

Telechurch Zo accepted the improvement direction:

1. Update `AGENTS.md` to align with Zo VIPC hive governance.
2. Fix repo-relative and workspace-root path assumptions.
3. Add install verification/readback for binders, required skills, `REFER.OS`, persona marker, and rule markers.
4. Use `prompt_edit` for persona updates and verify the marker afterward.
5. Keep controlled text sync distinct from large/bulk transfer paths.
6. Defer broader bootstrap mode expansion unless the four-file read order becomes insufficient.

## Source Changes From This Ratification

- `AGENTS.md` was updated to describe `refer-zo-bootstrap` as the Zo-scoped Script Factory and Hive bootstrap source.
- `tools/vipc-bootstrap.mjs` now supports `--mode verify` / `--verify-only`.
- `tools/vipc-bootstrap.mjs` now uses `prompt_edit` for persona edits.
- `tools/vipc-bootstrap.mjs` verifies binder files, required skills, `REFER.OS`, persona startup marker, and REFER rule markers after full bootstrap or in verify-only mode.
- `tools/vipc-bootstrap.mjs` fails verification when the installed `AGENTS.md` still contains the old Codex-scoped governance or the installed skill manifest still contains stale machine-local paths.
- `skills/library-manifest.json` and `refer-install-state.json` no longer use stale `E:/refer/zo-computer` paths.
- `docs/zo-vipc-bootstrap-blueprint.md` now distinguishes controlled text sync from bulk transfer.

## Live Verification Result

The first non-mutating verification run against Telechurch Zo intentionally failed. It verified `/home/workspace/agent.md`, `/home/workspace/AGENTS.md`, and `/home/workspace/Skills/library-manifest.json`, then stopped because `/home/workspace/TELECHURCH/telechurch-vipc-operating-rules.md` does not currently exist.

This is a useful ratification result: Telechurch's live persona and rules point to a profile folder that the installed Files surface does not currently provide. A future approved Telechurch deployment should run the full bootstrap to install the updated `AGENTS.md`, create the profile folder, refresh the manifest paths, and then rerun verify mode.

## Boundary

This pass updated source only. It did not mutate the live Telechurch Zo instance.
