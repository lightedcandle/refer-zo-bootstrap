#!/usr/bin/env node
/**
 * inbox-automation.mjs
 *
 * A non-persistent automation tick for Script Factory intake. It scans queued
 * local intake files, runs local-intake-runner for each, and marks processed
 * records without requiring a chat session to perform the routing manually.
 *
 * Compression: --compress encodes intake queue files as sx1 transport packets
 * and passes --compress to the runner so outputs are also sx1-encoded.
 */
import { existsSync, mkdirSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { logTokenUse } from "./token-log-bridge.mjs";
import { encodePacket } from "./compression-codec.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..", "..");
const INBOX = resolve(REPO_ROOT, "datasets", "local-intake", "inbox");
const PROCESSED = resolve(REPO_ROOT, "datasets", "local-intake", "processed");
const ERRORS = resolve(REPO_ROOT, "datasets", "local-intake", "errors");

function parseArgs(argv) {
  const args = { once: false, status: false, json: false, limit: 20, compress: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--once") args.once = true;
    else if (argv[i] === "--status") args.status = true;
    else if (argv[i] === "--json") args.json = true;
    else if (argv[i] === "--compress") args.compress = true;
    else if (argv[i] === "--limit" && argv[i + 1]) args.limit = Number(argv[++i]);
  }
  return args;
}

function status() {
  return {
    schema: "refer.zo.inbox-automation-status.v1",
    checked_at: new Date().toISOString(),
    inbox: listJson(INBOX).length,
    processed: listJson(PROCESSED).length,
    errors: listJson(ERRORS).length,
    inbox_path: INBOX,
  };
}

function enqueueCompressed(promptText) {
  const packet = {
    schema: "refer.zo.local-intake.v1",
    id: `compressed-intake-${Date.now()}`,
    created_at: new Date().toISOString(),
    source: "inbox-automation:sx1",
    prompt: promptText,
  };
  const { payload } = encodePacket("zo_task", packet);
  const queueFile = join(INBOX, `sx1-${Date.now()}.json`);
  writeFileSync(
    queueFile,
    JSON.stringify({ schema: "refer.zo.inbox-queue.v1", transport: payload }, null, 2),
    "utf8",
  );
  return queueFile;
}

function runOnce(args) {
  mkdirSync(INBOX, { recursive: true });
  mkdirSync(PROCESSED, { recursive: true });
  mkdirSync(ERRORS, { recursive: true });
  const files = listJson(INBOX).slice(0, Math.max(args.limit, 1));
  const results = [];
  let inputChars = 0;
  let outputChars = 0;
  for (const file of files) {
    const path = join(INBOX, file);
    try {
      inputChars += file.length;
      const runnerArgs = ["scripts/factory/local-intake-runner.mjs", "--intake", path];
      if (args.compress) runnerArgs.push("--compress");
      runnerArgs.push("--json");
      const output = execFileSync(process.execPath, runnerArgs, {
        cwd: REPO_ROOT,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        timeout: 60000,
      });
      outputChars += output.length;
      const target = join(PROCESSED, file);
      renameSync(path, target);
      results.push({ file, ok: true, processed_path: target, output: JSON.parse(output) });
    } catch (error) {
      const target = join(ERRORS, file);
      try {
        renameSync(path, target);
      } catch {
        // Leave source in place if the move fails.
      }
      const message = error?.stderr?.toString?.().slice(0, 12000) || error?.message || String(error);
      results.push({ file, ok: false, error_path: target, error: message });
    }
  }
  const output = {
    schema: "refer.zo.inbox-automation-result.v1",
    ok: results.every((result) => result.ok),
    ran_at: new Date().toISOString(),
    processed_count: results.filter((result) => result.ok).length,
    error_count: results.filter((result) => !result.ok).length,
    compression: args.compress ? "sx1" : "none",
    results,
  };
  output.token_log = logTokenUse({
    agent: "inbox-automation",
    script: "inbox-automation",
    inputChars,
    outputChars,
    status: output.ok ? "done" : "blocked",
    note: "local intake inbox automation tick",
  });
  return output;
}

function listJson(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((name) => name.endsWith(".json") && !isSensitiveName(name)).sort();
}

function isSensitiveName(name) {
  return /^\.env/i.test(name) || /(?:secret|credential|private|certificate|token|apikey|api_key)/i.test(name);
}

function print(output, json) {
  if (json) console.log(JSON.stringify(output, null, 2));
  else console.log(JSON.stringify(output, null, 2));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.status) {
    print(status(), args.json);
    return;
  }
  if (!args.once) {
    console.error("Usage: node scripts/factory/inbox-automation.mjs --once [--json] [--compress] or --status");
    process.exit(2);
  }
  print(runOnce(args), args.json);
}

main().catch((error) => {
  console.error(error?.message || String(error));
  process.exit(1);
});
