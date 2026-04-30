#!/usr/bin/env node
/**
 * local-script-registry.mjs
 *
 * Small, file-backed registry adapter for Zo-local Script Factory intake.
 * It tolerates the historical registry export shape and emits normalized
 * records so intake can match, report, and scaffold missing scripts.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..", "..");
const DEFAULT_REGISTRY = resolve(HERE, "script-registry.json");
const LOCAL_DATASET = resolve(REPO_ROOT, "datasets", "script-registry");
const NORMALIZED_REGISTRY = resolve(LOCAL_DATASET, "normalized-registry.json");
const DRAFT_DIR = resolve(LOCAL_DATASET, "drafts");
const ARTIFACT_DIR = resolve(HERE, "artifacts");

export function loadRegistry(path = DEFAULT_REGISTRY) {
  const raw = existsSync(path) ? readFileSync(path, "utf8") : "{}";
  const parsed = parseRegistryJson(raw);
  const source = Array.isArray(parsed) && typeof parsed[0] === "string"
    ? parseRegistryJson(parsed[0])
    : parsed;
  const records = normalizeRecords(source);
  return {
    schema: "refer.zo.local-script-registry.v1",
    loaded_at: new Date().toISOString(),
    source_path: path,
    records,
  };
}

export function saveNormalizedRegistry(registry, path = NORMALIZED_REGISTRY) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(registry, null, 2)}\n`, "utf8");
  return path;
}

export function matchScript(prompt, registry = loadRegistry()) {
  const text = String(prompt || "").toLowerCase();
  const matches = registry.records
    .filter((record) => !["deprecated", "retired", "blocked"].includes(record.status))
    .map((record) => ({ record, score: scoreRecord(record, text) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);
  return matches[0] || null;
}

export function scaffoldScriptGap({ prompt, scopeResolution = null, registry = loadRegistry() } = {}) {
  const id = uniqueId(slugFromPrompt(prompt), registry.records);
  const scriptFile = `scripts/factory/artifacts/${id}.mjs`;
  const now = new Date().toISOString();
  const draft = {
    schema: "refer.zo.script-gap.v1",
    id,
    name: titleFromId(id),
    status: "draft",
    created_at: now,
    prompt: String(prompt || ""),
    scope_resolution: scopeResolution,
    trigger_intents: triggerIntents(prompt),
    script_file: scriptFile,
    requires_ai: false,
    next: "Review this draft, implement the bounded script, register it, then rerun intake.",
  };
  mkdirSync(DRAFT_DIR, { recursive: true });
  const draftPath = join(DRAFT_DIR, `${id}.json`);
  writeFileSync(draftPath, `${JSON.stringify(draft, null, 2)}\n`, "utf8");

  mkdirSync(ARTIFACT_DIR, { recursive: true });
  const artifactPath = resolve(REPO_ROOT, scriptFile);
  if (!existsSync(artifactPath)) {
    writeFileSync(
      artifactPath,
      [
        "#!/usr/bin/env node",
        "/**",
        ` * ${id}.mjs`,
        " * Draft Script Factory artifact. Implement before enabling execution.",
        " */",
        "",
        "console.error(JSON.stringify({ ok: false, status: \"not_implemented\", script: process.argv[1] }));",
        "process.exit(3);",
        "",
      ].join("\n"),
      "utf8",
    );
  }
  return { draft, draft_path: draftPath, artifact_path: artifactPath };
}

function parseRegistryJson(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function normalizeRecords(source) {
  const candidates = Array.isArray(source?.forges)
    ? source.forges
    : Array.isArray(source?.scripts)
      ? source.scripts
      : Array.isArray(source)
        ? source
        : [];
  return candidates
    .filter((item) => item && typeof item === "object")
    .map((item) => ({
      id: String(item.id || item.name || "").trim(),
      name: String(item.name || item.id || "").trim(),
      type: item.type || "forge",
      description: item.description || "",
      trigger_intents: Array.isArray(item.trigger_intents) ? item.trigger_intents.map(String) : [],
      status: item.status || "active",
      requires_ai: Boolean(item.requires_ai),
      script_file: normalizeScriptFile(item.script_file || item.path || ""),
      version: item.version || "",
      raw: item,
    }))
    .filter((item) => item.id);
}

function normalizeScriptFile(file) {
  const value = String(file || "").replace(/\\/g, "/");
  if (!value) return "";
  if (value.startsWith("scripts/")) return value;
  if (value.startsWith("artifacts/")) return `scripts/factory/${value}`;
  return value;
}

function scoreRecord(record, text) {
  let score = 0;
  for (const intent of record.trigger_intents) {
    const normalized = String(intent || "").toLowerCase();
    if (normalized && text.includes(normalized)) score += normalized.length + 10;
    const intentTokens = tokenize(normalized).filter((token) => token.length >= 4);
    if (intentTokens.length && intentTokens.every((token) => text.includes(token))) {
      score += intentTokens.join("").length + 8;
    }
  }
  for (const token of tokenize(`${record.id} ${record.name} ${record.description}`)) {
    if (token.length >= 4 && text.includes(token)) score += 1;
  }
  return score;
}

function triggerIntents(prompt) {
  const tokens = tokenize(prompt).filter((token) => token.length >= 4).slice(0, 6);
  return [...new Set(tokens)];
}

function slugFromPrompt(prompt) {
  const tokens = tokenize(prompt).filter((token) => !STOPWORDS.has(token)).slice(0, 5);
  return tokens.length ? tokens.join("-") : "local-script";
}

function uniqueId(base, records) {
  const existing = new Set(records.map((record) => record.id));
  let id = base;
  let index = 2;
  while (existing.has(id) || existsSync(join(DRAFT_DIR, `${id}.json`))) {
    id = `${base}-${index}`;
    index += 1;
  }
  return id;
}

function titleFromId(id) {
  return id
    .split("-")
    .map((part) => part ? `${part[0].toUpperCase()}${part.slice(1)}` : part)
    .join(" ");
}

function tokenize(value) {
  return String(value || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .map((item) => item.trim())
    .filter(Boolean);
}

const STOPWORDS = new Set([
  "this",
  "that",
  "with",
  "from",
  "into",
  "onto",
  "have",
  "make",
  "build",
  "create",
  "please",
  "need",
  "needs",
  "using",
  "their",
  "there",
]);

function parseArgs(argv) {
  const args = { command: "list", prompt: "", json: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (!argv[i].startsWith("--") && args.command === "list") args.command = argv[i];
    else if (argv[i] === "--prompt" && argv[i + 1]) args.prompt = argv[++i];
    else if (argv[i] === "--json") args.json = true;
  }
  return args;
}

function print(output, json) {
  if (json) console.log(JSON.stringify(output, null, 2));
  else console.log(JSON.stringify(output, null, 2));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const registry = loadRegistry();
  saveNormalizedRegistry(registry);
  if (args.command === "list") {
    print({ ok: true, count: registry.records.length, records: registry.records }, args.json);
    return;
  }
  if (args.command === "match") {
    const match = matchScript(args.prompt, registry);
    print({ ok: true, prompt: args.prompt, match }, args.json);
    return;
  }
  if (args.command === "scaffold") {
    const gap = scaffoldScriptGap({ prompt: args.prompt, registry });
    print({ ok: true, ...gap }, args.json);
    return;
  }
  throw new Error(`Unknown command ${args.command}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error?.message || String(error));
    process.exit(1);
  });
}
