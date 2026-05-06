#!/usr/bin/env node
/**
 * assess-alliance-sites-restart-against.mjs
 *
 * Auto-promoted from script-gap draft "assess-alliance-sites-restart-against".
 * This forge canonicalizes the intent into a deterministic script artifact.
 */
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..", "..", "..");
const RECORD_DIR = resolve(REPO_ROOT, "datasets", "script-artifacts", "records");
const SCRIPT_ID = "assess-alliance-sites-restart-against";
const DRAFT_ID = "assess-alliance-sites-restart-against";
const TRIGGER_INTENTS = ["assess","alliance","sites","restart","against","phase"];

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
  const prompt = String(contract.prompt || "Assess Alliance Sites restart against Phase 1 and identify protocol gaps after moving Alliance to Sites");
  const recordId = `${SCRIPT_ID}.${hash(prompt).slice(0, 16)}`;
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
    deterministic_key: hash(`${SCRIPT_ID}\n${prompt}`),
    summary: summarize(prompt),
    contract,
    next: "Use this artifact as the deterministic output for this intent class or replace this forge with a richer implementation after a successful build trace.",
  };
  mkdirSync(RECORD_DIR, { recursive: true });
  const path = join(RECORD_DIR, `${recordId}.json`);
  writeFileSync(path, `${JSON.stringify(record, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ ok: true, status: "done", script_id: SCRIPT_ID, artifact_path: path, record }, null, 2));
}

function summarize(value) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, 240);
}

function hash(value) {
  return createHash("sha256").update(String(value), "utf8").digest("hex");
}

main();
