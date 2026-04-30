import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(HERE, "..", "..", "..");
export const ARTIFACT_RECORDS = resolve(REPO_ROOT, "datasets", "script-artifacts", "records");

export function parseAtomicArgs(argv) {
  const args = { contract: {}, json: false, dryRun: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--contract-json" && argv[i + 1]) args.contract = parseJson(argv[++i]);
    else if (argv[i] === "--contract" && argv[i + 1]) args.contract = parseJson(readFileSync(argv[++i], "utf8"));
    else if (argv[i] === "--json") args.json = true;
    else if (argv[i] === "--dry-run") args.dryRun = true;
  }
  return args;
}

export function promptOf(contract) {
  return String(contract?.prompt || contract?.summary || contract?.task || "").trim();
}

export function routeFromPrompt(prompt, fallback = "/") {
  const routeMatch = String(prompt).match(/(?:route|page|path)\s+([/][a-z0-9/_-]*)/i) || String(prompt).match(/([/][a-z0-9/_-]*)/i);
  if (routeMatch) return routeMatch[1];
  const named = String(prompt).match(/(?:page|screen|route)\s+(?:called|named|for|to)?\s*([a-z0-9][a-z0-9 _-]{1,40})/i);
  if (named) return `/${slug(named[1])}`;
  return fallback;
}

export function labelFromPrompt(prompt, fallback) {
  const quoted = String(prompt).match(/"([^"]{1,80})"/) || String(prompt).match(/'([^']{1,80})'/);
  if (quoted) return quoted[1].trim();
  const after = String(prompt).match(/(?:button|field|form|card|section|text|label|heading|page|widget)\s+(?:called|named|for|to|with)?\s*([a-z0-9][a-z0-9 _-]{1,60})/i);
  if (after) return title(after[1]);
  return fallback;
}

export function writeAtomicArtifact({ scriptId, artifactKind, contract, target = {}, imsce = {}, props = {}, evidence = [] }) {
  mkdirSync(ARTIFACT_RECORDS, { recursive: true });
  const id = `${scriptId}.${Date.now()}.${slug(props.label || artifactKind)}`;
  const artifact = {
    schema: "refer.zo.atomic-script-artifact.v1",
    id,
    created_at: new Date().toISOString(),
    script_id: scriptId,
    artifact_kind: artifactKind,
    source_contract: compactContract(contract),
    target,
    imsce: {
      rule: "IMSCE order is I -> M -> S -> C -> E. Elements must sit inside cards.",
      ...imsce,
    },
    props,
    evidence: [
      "atomic_forge:executed",
      "production_mutation:not_performed",
      ...evidence,
    ],
    next: "Feed this artifact to a governed app adapter, then ratify source and route behavior.",
  };
  const path = join(ARTIFACT_RECORDS, `${safeFile(id)}.json`);
  writeFileSync(path, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
  return { ok: true, status: "done", artifact_path: path, artifact };
}

export function scanWorkspace({ maxEntries = 400 } = {}) {
  const roots = ["scripts", "datasets", "docs", "skills", "law"].map((item) => resolve(REPO_ROOT, item));
  const files = [];
  for (const root of roots) walk(root, files, maxEntries);
  return files.slice(0, maxEntries).map((file) => file.replace(`${REPO_ROOT}${process.platform === "win32" ? "\\" : "/"}`, "").replace(/\\/g, "/"));
}

function walk(dir, files, maxEntries) {
  if (files.length >= maxEntries || !existsSync(dir) || isSensitivePath(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (files.length >= maxEntries || isSensitiveName(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path, files, maxEntries);
    else if (entry.isFile()) files.push(path);
  }
}

export function slug(value) {
  return String(value || "artifact")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "artifact";
}

export function title(value) {
  return String(value || "")
    .replace(/[-_]+/g, " ")
    .trim()
    .split(/\s+/)
    .map((part) => part ? `${part[0].toUpperCase()}${part.slice(1)}` : part)
    .join(" ");
}

export function safeFile(value) {
  return slug(value).replace(/[^a-z0-9.-]/g, "_");
}

export function printAndExit(output) {
  console.log(JSON.stringify(output, null, 2));
  process.exit(output.ok ? 0 : 1);
}

function compactContract(contract) {
  return {
    schema: contract?.schema || "",
    script_id: contract?.script_id || "",
    prompt: promptOf(contract),
    created_at: contract?.created_at || "",
  };
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

function isSensitivePath(path) {
  return resolve(path).split(/[\\/]/).some(isSensitiveName);
}

function isSensitiveName(name) {
  return /^\.env/i.test(name) || /(?:secret|credential|private|certificate|token|apikey|api_key)/i.test(name);
}
