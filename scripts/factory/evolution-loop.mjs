#!/usr/bin/env node
/**
 * evolution-loop.mjs
 *
 * One bounded self-evolution tick. It processes queued intake, audits the
 * script registry, records evolution evidence, and writes talkback. This is the
 * command a Zo automation should call on a schedule.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { logTokenUse } from "./token-log-bridge.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..", "..");
const EVOLUTION_RECORDS = resolve(REPO_ROOT, "datasets", "evolution-log", "records");
const TALKBACK_DIR = resolve(REPO_ROOT, "datasets", "tandem-talkback", "outbox");
const DRAFT_DIR = resolve(REPO_ROOT, "datasets", "script-registry", "drafts");

function parseArgs(argv) {
  const args = { json: false, repairRegistry: false };
  for (const arg of argv) {
    if (arg === "--json") args.json = true;
    else if (arg === "--repair-registry") args.repairRegistry = true;
  }
  return args;
}

function runTick(args) {
  const startedAt = Date.now();
  const automation = runNode(["scripts/factory/inbox-automation.mjs", "--once", "--json"]);
  const registry = runNode([
    "scripts/factory/registry-doctor.mjs",
    ...(args.repairRegistry ? ["--repair"] : []),
    "--json",
  ]);
  const draftCount = listJson(DRAFT_DIR).length;
  const event = {
    schema: "refer.zo.evolution-event.v1",
    id: `evolution.${Date.now()}`,
    session_id: `evolution-${Date.now()}`,
    source: "evolution-loop.mjs",
    origin: process.env.ZO_COMPUTER_NAME || "local",
    mode: "evolve",
    outcome: automation.ok && registry.ok ? "EVOLVED" : "RETRY_PENDING",
    ran_at: new Date(startedAt).toISOString(),
    finished_at: new Date().toISOString(),
    duration_ms: Date.now() - startedAt,
    intake_processed: automation.output?.processed_count || 0,
    intake_errors: automation.output?.error_count || 0,
    registry_missing_executable_count: registry.output?.report?.missing_executable_count || 0,
    registry_repaired_count: registry.output?.report?.repaired_count || 0,
    script_draft_count: draftCount,
    can_retry: true,
    notes: "Evolution tick processed local intake, audited script registry, and recorded talkback.",
  };
  const eventPath = writeEvolutionEvent(event);
  const talkback = {
    schema: "refer.zo.evolution-talkback.v1",
    id: event.id,
    status: event.outcome === "EVOLVED" ? "done" : "blocked",
    created_at: event.finished_at,
    event_path: eventPath,
    automation: summarizeCommand(automation),
    registry: summarizeCommand(registry),
    draft_count: draftCount,
    evidence: [
      "evolution_loop:ran",
      automation.ok ? "local_intake_automation:ok" : "local_intake_automation:blocked",
      registry.ok ? "registry_doctor:ok" : "registry_doctor:blocked",
      draftCount ? "script_gap_drafts:present" : "script_gap_drafts:none",
    ],
    next: draftCount ? "implement_or_promote_script_drafts" : "continue_monitoring",
  };
  const talkbackPath = writeTalkback(talkback);
  const output = { ok: talkback.status === "done", event_path: eventPath, talkback_path: talkbackPath, event, talkback };
  output.token_log = logTokenUse({
    agent: "evolution-loop",
    script: "evolution-loop",
    inputChars: 0,
    outputChars: JSON.stringify(output).length,
    status: output.ok ? "done" : "blocked",
    note: "self-evolution tick processed intake and registry health",
  });
  return output;
}

function runNode(args) {
  try {
    const stdout = execFileSync(process.execPath, args, {
      cwd: REPO_ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 90000,
    });
    return { ok: true, output: JSON.parse(stdout) };
  } catch (error) {
    return {
      ok: false,
      error: error?.stderr?.toString?.().slice(0, 12000) || error?.message || String(error),
    };
  }
}

function summarizeCommand(command) {
  if (!command.ok) return { ok: false, error: command.error };
  return {
    ok: true,
    status: command.output?.status || command.output?.report?.ok || "",
    processed_count: command.output?.processed_count,
    error_count: command.output?.error_count,
    report_path: command.output?.report_path,
  };
}

function writeEvolutionEvent(event) {
  mkdirSync(EVOLUTION_RECORDS, { recursive: true });
  const path = join(EVOLUTION_RECORDS, `${event.id}.json`);
  writeFileSync(path, `${JSON.stringify(event, null, 2)}\n`, "utf8");
  return path;
}

function writeTalkback(talkback) {
  mkdirSync(TALKBACK_DIR, { recursive: true });
  const path = join(TALKBACK_DIR, `${talkback.id}.json`);
  writeFileSync(path, `${JSON.stringify(talkback, null, 2)}\n`, "utf8");
  return path;
}

function listJson(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((name) => name.endsWith(".json") && !isSensitiveName(name)).sort();
}

function isSensitiveName(name) {
  return /^\.env/i.test(name) || /(?:secret|credential|private|certificate|token|apikey|api_key)/i.test(name);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const output = runTick(args);
  console.log(JSON.stringify(output, null, 2));
}

main().catch((error) => {
  console.error(error?.message || String(error));
  process.exit(1);
});
