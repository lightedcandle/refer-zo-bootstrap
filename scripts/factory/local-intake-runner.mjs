#!/usr/bin/env node
/**
 * local-intake-runner.mjs
 *
 * Converts a normal local prompt into a scoped Script Factory intake result:
 * scope resolution, registry match, bounded script execution if present, or a
 * durable script-gap draft when the factory does not yet know the work.
 *
 * Compression: --compress encodes the JSON output as an sx1 transport packet
 * and decodes sx1-encoded intake files from the inbox.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { logTokenUse } from "./token-log-bridge.mjs";
import { encodePacket, decodePacket } from "./compression-codec.mjs";
import { loadRegistry, matchScript, saveNormalizedRegistry, scaffoldScriptGap } from "./local-script-registry.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..", "..");
const TALKBACK_DIR = resolve(REPO_ROOT, "datasets", "tandem-talkback", "outbox");
const LOCAL_INTAKE_RECORDS = resolve(REPO_ROOT, "datasets", "local-intake", "records");

function parseArgs(argv) {
  const args = {
    prompt: "",
    intake: "",
    remoteRoot: process.env.ZO_WORKSPACE_ROOT || "/home/workspace",
    zoComputer: process.env.ZO_COMPUTER_NAME || "",
    json: false,
    execute: true,
    compress: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--prompt" && argv[i + 1]) args.prompt = argv[++i];
    else if (argv[i] === "--intake" && argv[i + 1]) args.intake = argv[++i];
    else if (argv[i] === "--remote-root" && argv[i + 1]) args.remoteRoot = argv[++i];
    else if (argv[i] === "--zo-computer" && argv[i + 1]) args.zoComputer = argv[++i];
    else if (argv[i] === "--compress") args.compress = true;
    else if (argv[i] === "--json") args.json = true;
    else if (argv[i] === "--no-execute") args.execute = false;
  }
  return args;
}

function loadPrompt(args) {
  if (args.intake) {
    const raw = readFileSync(args.intake, "utf8");
    let record;
    try {
      record = JSON.parse(raw);
    } catch {
      throw new Error(`Invalid JSON in intake file: ${args.intake}`);
    }
    if (record.transport && typeof record.transport === "string" && record.transport.startsWith("sx1:")) {
      const { packet } = decodePacket(record.transport);
      record = packet;
    }
    return {
      intake_record: record,
      prompt: record.prompt || record.request || record.summary || JSON.stringify(record),
    };
  }
  return {
    intake_record: null,
    prompt: args.prompt,
  };
}

function runIntake(args) {
  const loaded = loadPrompt(args);
  if (!loaded.prompt) throw new Error("Missing prompt. Use --prompt or --intake.");
  const registry = loadRegistry();
  const normalizedPath = saveNormalizedRegistry(registry);
  const scopeResolution = resolveNodeScope(loaded.prompt, args);
  const match = matchScript(loaded.prompt, registry);
  const intakeRecord = writeIntakeRecord({ prompt: loaded.prompt, source: args.intake || "cli", scopeResolution });

  let execution = null;
  let scriptGap = null;
  let promotion = null;
  const evidence = [
    "local_intake:recorded",
    scopeResolution.matched.length ? "node_scope:auto_resolved" : "node_scope:no_match",
  ];

  const executable = match?.record ? scriptExecutableStatus(match.record) : null;
  if (match?.record && executable.ok) {
    evidence.push("script_lookup:matched");
    execution = maybeRunScript(match.record, loaded.prompt, args);
    evidence.push(execution.executed ? "script_execution:attempted" : `script_execution:${execution.status}`);
  } else {
    evidence.push(match?.record ? `script_lookup:matched_but_${executable.status}` : "script_lookup:missing");
    scriptGap = scaffoldScriptGap({ prompt: loaded.prompt, scopeResolution, registry });
    if (match?.record) {
      scriptGap.draft.matched_registry_gap = {
        id: match.record.id,
        name: match.record.name,
        status: executable.status,
        script_file: match.record.script_file || "",
      };
      writeFileSync(scriptGap.draft_path, `${JSON.stringify(scriptGap.draft, null, 2)}\n`, "utf8");
    }
    evidence.push("script_scaffold:created");
    promotion = promoteDraft(scriptGap.draft_path, args);
    evidence.push(promotion.ok ? "script_gap:auto_promoted" : "script_gap:promotion_blocked");
    if (promotion.ok) {
      execution = {
        ok: true,
        executed: true,
        status: "done",
        promoted_script: promotion.script_id,
        script_file: promotion.script_file,
        build_trace_path: promotion.build_trace_path,
        replay: promotion.replay,
      };
      evidence.push("script_replay:passed");
    }
  }

  const status = execution?.ok ? "done" : scriptGap ? "needs_script" : "blocked";
  const talkback = {
    schema: "refer.zo.local-intake-talkback.v1",
    id: `local.intake.${Date.now()}`,
    status,
    prompt: loaded.prompt,
    created_at: new Date().toISOString(),
    node_scope: scopeResolution,
    registry: {
      normalized_path: normalizedPath,
      record_count: registry.records.length,
    },
    matched_script: match?.record || null,
    execution,
    script_gap: scriptGap
      ? {
          id: scriptGap.draft.id,
          draft_path: scriptGap.draft_path,
          artifact_path: scriptGap.artifact_path,
        }
      : null,
    promotion,
    evidence,
    next: scriptGap && !promotion?.ok
      ? "ai_build_trace_then_distill_script"
      : status === "done"
        ? "record_or_ratify_result"
        : "resolve_execution_blocker",
  };
  const talkbackPath = writeTalkback(talkback);
  const output = {
    ok: status !== "blocked",
    status,
    intake_record: intakeRecord,
    talkback_path: talkbackPath,
    talkback,
  };
  output.token_log = logTokenUse({
    agent: "local-intake-runner",
    script: "local-intake-runner",
    inputChars: loaded.prompt.length,
    outputChars: JSON.stringify(talkback).length,
    status,
    zoComputer: args.zoComputer,
    note: "local prompt converted to scoped script-factory intake",
  });
  return output;
}

function promoteDraft(draftPath, args) {
  if (!args.execute) return { ok: false, skipped: true, reason: "no_execute" };
  try {
    const output = execFileSync(
      process.execPath,
      ["scripts/factory/draft-promotion-runner.mjs", "--draft", draftPath, "--json"],
      {
        cwd: REPO_ROOT,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        timeout: 90000,
      },
    );
    const parsed = JSON.parse(output);
    const first = parsed.results?.[0] || null;
    return {
      ok: Boolean(parsed.ok && first?.ok),
      result: parsed,
      script_id: first?.script_id,
      script_file: first?.script_file,
      build_trace_path: first?.build_trace_path,
      replay: first?.replay,
    };
  } catch (error) {
    return {
      ok: false,
      error: error?.stderr?.toString?.().slice(0, 12000) || error?.message || String(error),
    };
  }
}

function maybeRunScript(record, prompt, args) {
  if (!args.execute) return { ok: true, executed: false, status: "disabled", reason: "no_execute" };
  if (record.requires_ai) return { ok: true, executed: false, status: "requires_ai", reason: "script_requires_ai" };
  if (!record.script_file) return { ok: false, executed: false, status: "missing_file", reason: "registry_record_has_no_script_file" };
  const path = resolve(REPO_ROOT, record.script_file);
  if (!safeRepoPath(path) || isSensitivePath(path)) {
    return { ok: false, executed: false, status: "refused_path", path };
  }
  if (!existsSync(path)) {
    return { ok: false, executed: false, status: "missing_file", path };
  }
  try {
    const contract = {
      schema: "refer.zo.local-script-contract.v1",
      prompt,
      script_id: record.id,
      created_at: new Date().toISOString(),
    };
    const output = execFileSync(process.execPath, [path, "--contract-json", JSON.stringify(contract)], {
      cwd: REPO_ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 30000,
    });
    return { ok: true, executed: true, status: "done", path, output: output.slice(0, 12000) };
  } catch (error) {
    return {
      ok: false,
      executed: true,
      status: "failed",
      path,
      error: error?.stderr?.toString?.().slice(0, 12000) || error?.message || String(error),
    };
  }
}

function scriptExecutableStatus(record) {
  if (record.requires_ai) return { ok: false, status: "requires_ai" };
  if (!record.script_file) return { ok: false, status: "missing_script_file" };
  const path = resolve(REPO_ROOT, record.script_file);
  if (!safeRepoPath(path) || isSensitivePath(path)) return { ok: false, status: "refused_path", path };
  if (!existsSync(path)) return { ok: false, status: "missing_script_file", path };
  try {
    if (!statSync(path).isFile()) return { ok: false, status: "not_file", path };
  } catch {
    return { ok: false, status: "missing_script_file", path };
  }
  return { ok: true, status: "ready", path };
}

function writeIntakeRecord({ prompt, source, scopeResolution }) {
  mkdirSync(LOCAL_INTAKE_RECORDS, { recursive: true });
  const id = `local-intake-${Date.now()}`;
  const path = join(LOCAL_INTAKE_RECORDS, `${id}.json`);
  writeFileSync(
    path,
    `${JSON.stringify(
      {
        schema: "refer.zo.local-intake.v1",
        id,
        created_at: new Date().toISOString(),
        source,
        prompt,
        node_scope: scopeResolution,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  return path;
}

function writeTalkback(talkback) {
  mkdirSync(TALKBACK_DIR, { recursive: true });
  const id = String(talkback.id).replace(/[^a-zA-Z0-9_.-]/g, "_");
  const path = join(TALKBACK_DIR, `${id}.json`);
  writeFileSync(path, `${JSON.stringify(talkback, null, 2)}\n`, "utf8");
  return path;
}

function resolveNodeScope(prompt, args) {
  const scopes = readNodeScopes(args.remoteRoot);
  const active = scopes.filter((scope) => scope.status !== "paused" && scope.status !== "retired");
  const text = String(prompt || "").toLowerCase();
  const scored = active
    .map((scope) => ({ scope, score: scoreScope(scope, text) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);
  const matched = scored.slice(0, 3).map(({ scope, score }) => ({
    scope_id: scope.scope_id,
    label: scope.label,
    status: scope.status,
    confidence: scope.confidence,
    score,
    categories: scope.categories || [],
  }));
  return {
    schema: "refer.zo.node-scope-resolution.v1",
    resolved_at: new Date().toISOString(),
    mode: matched.length ? "auto_matched" : "unscoped",
    matched,
    available_scope_count: active.length,
    rule: "Local intake automatically resolves active node scopes from ordinary prompt text.",
  };
}

function readNodeScopes(remoteRoot) {
  const dirs = [
    join(remoteRoot, "refer-zo-bootstrap", "datasets", "node-scope", "records"),
    resolve(REPO_ROOT, "datasets", "node-scope", "records"),
  ];
  const records = [];
  const seen = new Set();
  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir).filter((entry) => entry.endsWith(".json") && !isSensitiveName(entry))) {
      try {
        const record = JSON.parse(readFileSync(join(dir, name), "utf8"));
        const key = record.scope_id || name;
        if (seen.has(key)) continue;
        seen.add(key);
        records.push(record);
      } catch {
        // Bad scope records should not block local intake.
      }
    }
  }
  return records;
}

function scoreScope(scope, text) {
  let score = 0;
  const fields = [
    scope.scope_id,
    scope.label,
    scope.purpose,
    ...(Array.isArray(scope.categories) ? scope.categories : []),
  ]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase());
  for (const field of fields) {
    for (const token of tokenize(field)) {
      if (token.length >= 4 && text.includes(token)) score += 1;
    }
  }
  return score;
}

function tokenize(value) {
  return String(value || "")
    .split(/[^a-z0-9]+/i)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function safeRepoPath(path) {
  const root = resolve(REPO_ROOT);
  const target = resolve(path);
  return target === root || target.startsWith(`${root}${process.platform === "win32" ? "\\" : "/"}`);
}

function isSensitivePath(path) {
  return resolve(path).split(/[\\/]/).some(isSensitiveName);
}

function isSensitiveName(name) {
  return /^\.env/i.test(name) || /(?:secret|credential|private|certificate|token|apikey|api_key)/i.test(name);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const output = runIntake(args);
  if (args.compress) {
    const encoded = encodePacket("zo_task", output);
    console.log(JSON.stringify(encoded, null, 2));
  } else {
    console.log(JSON.stringify(output, null, 2));
  }
}

main().catch((error) => {
  console.error(error?.message || String(error));
  process.exit(1);
});
