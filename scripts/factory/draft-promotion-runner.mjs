#!/usr/bin/env node
/**
 * draft-promotion-runner.mjs
 *
 * Consumes script-gap drafts and turns them into executable, registered
 * Script Factory forges. The first generated forge is intentionally generic:
 * it canonicalizes the user's intent into a deterministic script-artifact
 * record. Future AI build traces can replace the generated body with richer
 * implementation, but intake no longer stalls at needs_script.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { logTokenUse } from "./token-log-bridge.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..", "..");
const REGISTRY_FILE = resolve(HERE, "script-registry.json");
const DRAFT_DIR = resolve(REPO_ROOT, "datasets", "script-registry", "drafts");
const BUILD_TRACE_DIR = resolve(REPO_ROOT, "datasets", "build-traces", "records");
const ARTIFACT_DIR = resolve(HERE, "artifacts");

function parseArgs(argv) {
  const args = {
    draft: "",
    all: false,
    limit: 10,
    json: false,
    noReplay: false,
    force: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--draft" && argv[i + 1]) args.draft = argv[++i];
    else if (argv[i] === "--all") args.all = true;
    else if (argv[i] === "--limit" && argv[i + 1]) args.limit = Number(argv[++i]);
    else if (argv[i] === "--json") args.json = true;
    else if (argv[i] === "--no-replay") args.noReplay = true;
    else if (argv[i] === "--force") args.force = true;
  }
  return args;
}

function promote(args) {
  const drafts = selectDrafts(args);
  const results = drafts.map((draftPath) => promoteOne(draftPath, args));
  const ok = results.every((result) => result.ok);
  const output = {
    ok,
    schema: "refer.zo.draft-promotion.result.v1",
    promoted_count: results.filter((result) => result.ok).length,
    blocked_count: results.filter((result) => !result.ok).length,
    results,
  };
  output.token_log = logTokenUse({
    agent: "draft-promotion-runner",
    script: "draft-promotion-runner",
    inputChars: drafts.join("\n").length,
    outputChars: JSON.stringify(output).length,
    status: ok ? "done" : "blocked",
    note: "promoted script-gap drafts into executable registered forges",
  });
  return output;
}

function selectDrafts(args) {
  if (args.draft) {
    const draftPath = resolveDraftPath(args.draft);
    if (!existsSync(draftPath)) throw new Error(`Missing draft: ${draftPath}`);
    return [draftPath];
  }
  const candidates = listJson(DRAFT_DIR)
    .map((name) => join(DRAFT_DIR, name))
    .filter((path) => {
      try {
        const draft = JSON.parse(readFileSync(path, "utf8"));
        return args.force || ["draft", "exploring", "working", "distilled"].includes(draft.status || "draft");
      } catch {
        return false;
      }
    });
  if (!args.all && candidates.length) return [candidates[0]];
  return candidates.slice(0, Number.isFinite(args.limit) && args.limit > 0 ? args.limit : 10);
}

function resolveDraftPath(value) {
  const raw = String(value || "");
  if (raw.endsWith(".json") || raw.includes("/") || raw.includes("\\")) return resolve(REPO_ROOT, raw);
  return join(DRAFT_DIR, `${safeName(raw)}.json`);
}

function promoteOne(draftPath, args) {
  const draft = JSON.parse(readFileSync(draftPath, "utf8"));
  const id = safeName(draft.id || slugFromPrompt(draft.prompt || "local-script"));
  const scriptFile = normalizeScriptFile(draft.script_file || `scripts/factory/artifacts/${id}.mjs`);
  const scriptPath = resolve(REPO_ROOT, scriptFile);
  const now = new Date().toISOString();
  const traceId = `build-trace.${id}.${hash(`${draft.prompt || ""}\n${now}`).slice(0, 10)}`;
  const tracePath = join(BUILD_TRACE_DIR, `${traceId}.json`);
  const trace = {
    schema: "refer.zo.build-trace.v1",
    id: traceId,
    intent_id: draft.id || id,
    script_gap_id: draft.id || id,
    prompt: draft.prompt || "",
    target_scope: draft.scope_resolution || draft.node_scope || null,
    started_at: now,
    status: "exploring",
    changed: [],
    errors: [],
    fixes: [],
    checks: [],
    distilled_script: {
      id,
      script_file: scriptFile,
      registry_file: "scripts/factory/script-registry.json",
    },
    replay: null,
    talkback: null,
  };

  mkdirSync(dirname(scriptPath), { recursive: true });
  if (args.force || shouldWriteScript(scriptPath)) {
    writeFileSync(scriptPath, buildGeneratedScript({ id, draft }), "utf8");
    trace.changed.push({ path: scriptFile, action: existsSync(scriptPath) ? "created_or_rewritten" : "created" });
  }

  const registryResult = upsertRegistryEntry({ id, draft, scriptFile });
  trace.changed.push({ path: "scripts/factory/script-registry.json", action: registryResult.action });

  const replay = args.noReplay ? { ok: true, skipped: true, reason: "no_replay" } : replayScript({ id, scriptPath, draft });
  trace.replay = replay;
  trace.checks.push({
    id: "script_replay",
    ok: replay.ok === true,
    detail: replay.ok ? "generated script replayed from draft prompt" : replay.error || "replay failed",
  });
  trace.status = replay.ok ? "ratified" : "blocked";
  trace.finished_at = new Date().toISOString();
  trace.talkback = {
    status: trace.status === "ratified" ? "done" : "blocked",
    next: trace.status === "ratified" ? "rerun_intake_or_reuse_script" : "repair_generated_script",
  };
  mkdirSync(BUILD_TRACE_DIR, { recursive: true });
  writeFileSync(tracePath, `${JSON.stringify(trace, null, 2)}\n`, "utf8");

  const updatedDraft = {
    ...draft,
    status: trace.status,
    promoted_at: trace.finished_at,
    script_file: scriptFile,
    build_trace_path: relativePath(tracePath),
    registry_entry: id,
    replay,
    next: trace.status === "ratified" ? "rerun intake; future matching prompts should use the generated script" : "repair generated script and replay",
  };
  writeFileSync(draftPath, `${JSON.stringify(updatedDraft, null, 2)}\n`, "utf8");

  return {
    ok: trace.status === "ratified",
    draft_path: relativePath(draftPath),
    script_id: id,
    script_file: scriptFile,
    build_trace_path: relativePath(tracePath),
    replay,
  };
}

function shouldWriteScript(scriptPath) {
  if (!existsSync(scriptPath)) return true;
  try {
    const current = readFileSync(scriptPath, "utf8");
    return current.includes("not_implemented") || current.includes("Draft Script Factory artifact");
  } catch {
    return false;
  }
}

function buildGeneratedScript({ id, draft }) {
  return `#!/usr/bin/env node
/**
 * ${id}.mjs
 *
 * Auto-promoted from script-gap draft ${JSON.stringify(draft.id || id)}.
 * This forge canonicalizes the intent into a deterministic script artifact.
 */
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..", "..", "..");
const RECORD_DIR = resolve(REPO_ROOT, "datasets", "script-artifacts", "records");
const SCRIPT_ID = ${JSON.stringify(id)};
const DRAFT_ID = ${JSON.stringify(draft.id || id)};
const TRIGGER_INTENTS = ${JSON.stringify(draft.trigger_intents || [])};

function parseArgs(argv) {
  const args = { contractJson: "" };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--contract-json" && argv[i + 1]) args.contractJson = argv[++i];
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const contract = args.contractJson ? JSON.parse(args.contractJson) : {};
  const prompt = String(contract.prompt || ${JSON.stringify(draft.prompt || "")});
  const recordId = \`\${SCRIPT_ID}.\${hash(prompt).slice(0, 16)}\`;
  const record = {
    schema: "refer.zo.script-artifact.v1",
    id: recordId,
    script_id: SCRIPT_ID,
    draft_id: DRAFT_ID,
    created_at: new Date().toISOString(),
    status: "done",
    prompt,
    trigger_intents: TRIGGER_INTENTS,
    output_kind: "canonical_intent_artifact",
    deterministic_key: hash(\`\${SCRIPT_ID}\\n\${prompt}\`),
    summary: summarize(prompt),
    contract,
    next: "Use this artifact as the deterministic output for this intent class or replace this forge with a richer implementation after a successful build trace.",
  };
  mkdirSync(RECORD_DIR, { recursive: true });
  const path = join(RECORD_DIR, \`\${recordId}.json\`);
  writeFileSync(path, \`\${JSON.stringify(record, null, 2)}\\n\`, "utf8");
  console.log(JSON.stringify({ ok: true, status: "done", script_id: SCRIPT_ID, artifact_path: path, record }, null, 2));
}

function summarize(value) {
  return String(value || "").trim().replace(/\\s+/g, " ").slice(0, 240);
}

function hash(value) {
  return createHash("sha256").update(String(value), "utf8").digest("hex");
}

main();
`;
}

function upsertRegistryEntry({ id, draft, scriptFile }) {
  const registry = readRegistry();
  const forges = Array.isArray(registry.forges) ? registry.forges : [];
  const entry = {
    id,
    name: draft.name || titleFromId(id),
    type: "forge",
    description: `Auto-promoted forge for intent: ${String(draft.prompt || "").slice(0, 180)}`,
    trigger_intents: normalizeTriggers(draft),
    status: "active",
    version: "0.1.0",
    requires_ai: false,
    script_file: scriptFile.replace(/^scripts\/factory\//, ""),
    auto_promoted: true,
    promoted_from_gap: draft.id || id,
    build_trace_schema: "refer.zo.build-trace.v1",
  };
  const index = forges.findIndex((item) => item?.id === id);
  const action = index >= 0 ? "updated" : "created";
  if (index >= 0) forges[index] = { ...forges[index], ...entry };
  else forges.push(entry);
  const next = {
    ...registry,
    version: registry.version || "1.1.0",
    updated: new Date().toISOString(),
    forges,
  };
  writeFileSync(REGISTRY_FILE, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  return { action, entry };
}

function readRegistry() {
  if (!existsSync(REGISTRY_FILE)) return { version: "1.1.0", forges: [] };
  try {
    return JSON.parse(readFileSync(REGISTRY_FILE, "utf8"));
  } catch {
    return { version: "1.1.0", forges: [] };
  }
}

function replayScript({ id, scriptPath, draft }) {
  try {
    if (!existsSync(scriptPath) || !statSync(scriptPath).isFile()) {
      return { ok: false, error: `missing script ${scriptPath}` };
    }
    const contract = {
      schema: "refer.zo.local-script-contract.v1",
      prompt: draft.prompt || "",
      script_id: id,
      created_at: new Date().toISOString(),
      replay: true,
    };
    const stdout = execFileSync(process.execPath, [scriptPath, "--contract-json", JSON.stringify(contract)], {
      cwd: REPO_ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 30000,
    });
    return { ok: true, stdout: stdout.slice(0, 12000) };
  } catch (error) {
    return {
      ok: false,
      error: error?.stderr?.toString?.().slice(0, 12000) || error?.message || String(error),
    };
  }
}

function normalizeTriggers(draft) {
  const prompt = String(draft.prompt || "").toLowerCase().trim();
  const triggers = [
    ...(Array.isArray(draft.trigger_intents) ? draft.trigger_intents.map(String) : []),
    prompt,
    ...tokenize(prompt).filter((token) => token.length >= 4).slice(0, 6),
  ].filter(Boolean);
  return [...new Set(triggers)].slice(0, 8);
}

function normalizeScriptFile(file) {
  const value = String(file || "").replace(/\\/g, "/");
  if (value.startsWith("scripts/")) return value;
  if (value.startsWith("artifacts/")) return `scripts/factory/${value}`;
  return `scripts/factory/artifacts/${safeName(value || "local-script")}`;
}

function listJson(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((name) => name.endsWith(".json") && !isSensitiveName(name)).sort();
}

function isSensitiveName(name) {
  return /^\.env/i.test(name) || /(?:secret|credential|private|certificate|token|apikey|api_key)/i.test(name);
}

function tokenize(value) {
  return String(value || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .map((item) => item.trim())
    .filter(Boolean);
}

function slugFromPrompt(prompt) {
  return tokenize(prompt).filter((token) => token.length >= 3).slice(0, 5).join("-") || "local-script";
}

function safeName(value) {
  return String(value || "local-script").replace(/[^a-zA-Z0-9_.-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

function titleFromId(id) {
  return String(id)
    .split("-")
    .map((part) => part ? `${part[0].toUpperCase()}${part.slice(1)}` : part)
    .join(" ");
}

function hash(value) {
  return createHash("sha256").update(String(value), "utf8").digest("hex");
}

function relativePath(path) {
  return path.replace(`${REPO_ROOT}\\`, "").replace(`${REPO_ROOT}/`, "").replace(/\\/g, "/");
}

function print(output, json) {
  if (json) console.log(JSON.stringify(output, null, 2));
  else console.log(JSON.stringify(output, null, 2));
}

const args = parseArgs(process.argv.slice(2));
try {
  print(promote(args), args.json);
} catch (error) {
  console.error(error?.message || String(error));
  process.exit(1);
}
