#!/usr/bin/env node
/**
 * node-scope.mjs
 *
 * Local Zo node self-scoping ledger. Records what this computer says it is
 * being used for without requiring the root factory to assign a fixed domain.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const DATASET_DIR = "datasets/node-scope";
const RECORD_DIR = join(DATASET_DIR, "records");

function parseArgs(argv) {
  const args = {
    command: argv[0] || "report",
    scopeId: "",
    label: "",
    source: "self",
    status: "active",
    confidence: 0.8,
    purpose: "",
    categories: [],
    evidence: [],
    routingNotes: [],
    json: false,
  };
  for (let i = 1; i < argv.length; i += 1) {
    const key = argv[i];
    const value = argv[i + 1];
    if (key === "--scope-id" && value) args.scopeId = value, i += 1;
    else if (key === "--label" && value) args.label = value, i += 1;
    else if (key === "--source" && value) args.source = value, i += 1;
    else if (key === "--status" && value) args.status = value, i += 1;
    else if (key === "--confidence" && value) args.confidence = Number(value), i += 1;
    else if (key === "--purpose" && value) args.purpose = value, i += 1;
    else if (key === "--category" && value) args.categories.push(value), i += 1;
    else if (key === "--evidence" && value) args.evidence.push(value), i += 1;
    else if (key === "--routing-note" && value) args.routingNotes.push(value), i += 1;
    else if (key === "--json") args.json = true;
  }
  return args;
}

function recordScope(args) {
  if (!args.label && !args.scopeId) throw new Error("record requires --label or --scope-id");
  const now = new Date().toISOString();
  const scopeId = args.scopeId || slug(args.label);
  const path = recordPath(scopeId);
  const existing = existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : null;
  const record = {
    schema: "refer.zo.node-scope.v1",
    scope_id: scopeId,
    label: args.label || existing?.label || scopeId,
    source: args.source,
    status: args.status,
    confidence: Number.isFinite(args.confidence) ? args.confidence : existing?.confidence || 0.8,
    created_at: existing?.created_at || now,
    updated_at: now,
    purpose: args.purpose || existing?.purpose || "",
    categories: mergeUnique(existing?.categories, args.categories),
    evidence: mergeEntries(existing?.evidence, args.evidence, now),
    routing_notes: mergeEntries(existing?.routing_notes, args.routingNotes, now),
  };
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(record, null, 2)}\n`, "utf8");
  return record;
}

function reportScopes() {
  mkdirSync(RECORD_DIR, { recursive: true });
  const records = readdirSync(RECORD_DIR)
    .filter((name) => name.endsWith(".json"))
    .map((name) => JSON.parse(readFileSync(join(RECORD_DIR, name), "utf8")))
    .sort((a, b) => String(a.scope_id).localeCompare(String(b.scope_id)));
  return {
    schema: "refer.zo.node-scope-report.v1",
    created_at: new Date().toISOString(),
    dataset: DATASET_DIR,
    records,
  };
}

function recordPath(scopeId) {
  return join(RECORD_DIR, `${slug(scopeId)}.json`);
}

function mergeUnique(a = [], b = []) {
  return [...new Set([...(a || []), ...(b || []).map(String).filter(Boolean)])];
}

function mergeEntries(existing = [], values = [], ts) {
  const entries = [...(existing || [])];
  for (const value of values) entries.push({ ts, value: String(value) });
  return entries;
}

function slug(value) {
  return String(value || "scope")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function printUsage() {
  console.log(`Usage:
  npm run scope:record -- --label "Alliance application build" --source user --purpose "Build and maintain Alliance Hub"
  npm run scope:report

Outputs:
  ${resolve(RECORD_DIR)}`);
}

const args = parseArgs(process.argv.slice(2));
try {
  let result;
  if (args.command === "record") result = recordScope(args);
  else if (args.command === "report") result = reportScopes();
  else {
    printUsage();
    process.exit(args.command === "help" ? 0 : 2);
  }
  if (args.json) console.log(JSON.stringify(result, null, 2));
  else console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(error?.message || String(error));
  process.exit(1);
}
