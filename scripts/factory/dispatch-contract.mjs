#!/usr/bin/env node
/**
 * dispatch-contract.mjs
 *
 * Director-level contract loop for low-token Zo tandem work:
 * create/load contract -> compress/ship through Zo Files -> optionally trigger
 * Zo runner -> optionally fetch talkback by file/API.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { logTokenUse } from "./token-log-bridge.mjs";

function parseArgs(argv) {
  const args = {
    instance: "telechurch",
    mode: "VERIFY",
    task: "",
    file: "",
    remoteRoot: "/home/workspace",
    dryRun: false,
    trigger: false,
    fetch: false,
    compressed: true,
    localReportDir: "datasets/tandem-dispatch/reports",
  };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--instance" && argv[i + 1]) args.instance = argv[++i];
    else if (argv[i] === "--mode" && argv[i + 1]) args.mode = argv[++i];
    else if (argv[i] === "--task" && argv[i + 1]) args.task = argv[++i];
    else if (argv[i] === "--file" && argv[i + 1]) args.file = argv[++i];
    else if (argv[i] === "--remote-root" && argv[i + 1]) args.remoteRoot = argv[++i];
    else if (argv[i] === "--local-report-dir" && argv[i + 1]) args.localReportDir = argv[++i];
    else if (argv[i] === "--dry-run") args.dryRun = true;
    else if (argv[i] === "--trigger") args.trigger = true;
    else if (argv[i] === "--fetch") args.fetch = true;
    else if (argv[i] === "--plain-talkback") args.compressed = false;
  }
  if (!args.task && !args.file) throw new Error("Provide --task or --file");
  if (args.fetch && !args.trigger && !args.dryRun) {
    throw new Error("--fetch requires --trigger unless --dry-run is used");
  }
  return args;
}

function runJson(script, scriptArgs) {
  const output = execFileSync(process.execPath, [script, ...scriptArgs], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  return JSON.parse(output);
}

function countInputChars(args) {
  if (args.file) return readFileSync(args.file, "utf8").length;
  return args.task.length;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const started = new Date().toISOString();
  const shipArgs = [
    "--instance",
    args.instance,
    "--mode",
    args.mode,
    "--remote-root",
    args.remoteRoot,
  ];
  if (args.file) shipArgs.push("--file", args.file);
  else shipArgs.push("--task", args.task);
  if (args.dryRun) shipArgs.push("--dry-run");
  if (args.trigger) shipArgs.push("--trigger");

  const ship = runJson("scripts/factory/ship-contract-to-zo.mjs", shipArgs);
  let fetch = null;
  if (args.fetch && !args.dryRun) {
    const fetchArgs = [
      "--instance",
      args.instance,
      "--contract-id",
      ship.contract_id,
      "--remote-root",
      args.remoteRoot,
    ];
    if (args.compressed) fetchArgs.push("--compressed");
    fetch = runJson("scripts/factory/fetch-zo-talkback.mjs", fetchArgs);
  }

  const result = {
    ok: Boolean(ship.ok && (!fetch || fetch.ok)),
    schema: "refer.dispatch.contract.result.v1",
    started_at: started,
    completed_at: new Date().toISOString(),
    instance: args.instance,
    dry_run: args.dryRun,
    mode: args.mode,
    contract_id: ship.contract_id,
    phases: {
      ship,
      trigger: ship.trigger || null,
      fetch,
    },
    next: args.dryRun
      ? "rerun without --dry-run to ship to Zo"
      : args.fetch
        ? "inspect fetched talkback and ratify source"
        : "fetch talkback after runner completes",
  };

  mkdirSync(args.localReportDir, { recursive: true });
  const safeId = String(result.contract_id).replace(/[^a-zA-Z0-9_.-]/g, "_");
  const reportPath = join(args.localReportDir, `${safeId}.json`);
  writeFileSync(reportPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  result.report_path = reportPath;
  result.token_log = logTokenUse({
    agent: "dispatch-contract",
    script: "dispatch-contract",
    inputChars: countInputChars(args),
    outputChars: JSON.stringify(result).length,
    status: result.ok ? "done" : "failed",
    contractId: String(result.contract_id),
    zoComputer: args.instance,
    note: args.dryRun
      ? "dry-run dispatch loop"
      : args.fetch
        ? "dispatch loop shipped, triggered, and fetched talkback"
        : args.trigger
          ? "dispatch loop shipped and triggered runner"
          : "dispatch loop shipped contract",
  });

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error?.message || String(error));
  process.exit(1);
});
