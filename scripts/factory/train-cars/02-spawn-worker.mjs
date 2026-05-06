#!/usr/bin/env node
/**
 * @opcodes ['READ_PENDING_WORK', 'RUN_BOUNDED_WORKER', 'REPORT_WORKER_STATUS']
 * @trigger spawn worker dispatch
 * @description Train car that runs one bounded local inbox worker when pending tandem contracts exist.
 * @forge-type orchestrator
 * @forge-name Spawn Worker Car
 * @forge-id spawn-worker-car
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..", "..", "..");
const INBOX = resolve(REPO_ROOT, "datasets", "tandem-contracts", "inbox");
const RUNNER = resolve(HERE, "..", "contract-inbox-runner.mjs");

export async function run() {
  const started = Date.now();
  const pending = listPendingContracts();
  if (!pending.length) {
    return {
      status: "completed",
      duration_ms: Date.now() - started,
      dashboard_updates: { pending_contracts: 0, worker_last_status: "idle" },
    };
  }

  try {
    const stdout = execFileSync(process.execPath, [RUNNER, "--once", "--contract", pending[0]], {
      cwd: REPO_ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 120000,
    });
    return {
      status: "completed",
      duration_ms: Date.now() - started,
      dashboard_updates: {
        pending_contracts: pending.length,
        worker_last_status: "ran_once",
      },
      task_executed: { script: "contract-inbox-runner", contract: pending[0] },
      task: {
        id: `contract-inbox.${Date.now()}`,
        status: "done",
        script: "contract-inbox-runner",
        contract: pending[0],
        output: stdout.slice(0, 1000),
      },
    };
  } catch (error) {
    return {
      status: "error",
      duration_ms: Date.now() - started,
      dashboard_updates: { pending_contracts: pending.length, worker_last_status: "error" },
      alert: error?.stderr?.toString?.().slice(0, 500) || error?.message || String(error),
    };
  }
}

function listPendingContracts() {
  if (!existsSync(INBOX)) return [];
  return readdirSync(INBOX)
    .filter((name) => name.endsWith(".json") && !isSensitiveName(name))
    .map((name) => resolve(INBOX, name))
    .filter((path) => statSync(path).isFile())
    .sort();
}

function isSensitiveName(name) {
  return /^\.env/i.test(name) || /(?:secret|credential|private|certificate|token|apikey|api_key)/i.test(name);
}

export default { run };
