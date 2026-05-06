#!/usr/bin/env node
/**
 * @opcodes ['CHECK_SCAN_AGE', 'RUN_SCAN_WORKSPACE', 'REPORT_SCAN_STATUS']
 * @trigger scan gaps workspace
 * @description Train car that refreshes the bounded workspace scan when stale.
 * @forge-type artifact
 * @forge-name Scan Workspace Car
 * @forge-id scan-workspace-car
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..", "..", "..");
const SCAN_SCRIPT = resolve(HERE, "..", "artifacts", "scan-workspace.mjs");
const ARTIFACT_DIR = resolve(REPO_ROOT, "datasets", "script-artifacts", "records");
const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

export async function run() {
  const started = Date.now();
  const latest = latestScanArtifact();
  const stale = !latest || Date.now() - latest.mtimeMs > STALE_AFTER_MS;
  if (!stale) {
    return {
      status: "completed",
      duration_ms: Date.now() - started,
      dashboard_updates: { workspace_scan_status: "fresh", workspace_scan_last: new Date(latest.mtimeMs).toISOString() },
    };
  }

  try {
    const stdout = execFileSync(process.execPath, [
      SCAN_SCRIPT,
      "--contract-json",
      JSON.stringify({ prompt: "heartbeat stale workspace scan refresh", script_id: "scan-workspace" }),
    ], {
      cwd: REPO_ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 120000,
    });
    const parsed = parseJson(stdout);
    return {
      status: "completed",
      duration_ms: Date.now() - started,
      dashboard_updates: {
        workspace_scan_status: "refreshed",
        workspace_scan_artifact: parsed?.artifact_path || "",
        workspace_file_count: parsed?.artifact?.props?.file_count || 0,
      },
      task_executed: { script: "scan-workspace", artifact_path: parsed?.artifact_path || "" },
    };
  } catch (error) {
    return {
      status: "error",
      duration_ms: Date.now() - started,
      dashboard_updates: { workspace_scan_status: "error" },
      alert: error?.stderr?.toString?.().slice(0, 500) || error?.message || String(error),
    };
  }
}

function latestScanArtifact() {
  if (!existsSync(ARTIFACT_DIR)) return null;
  return readdirSync(ARTIFACT_DIR)
    .filter((name) => name.startsWith("scan-workspace.") && name.endsWith(".json"))
    .map((name) => {
      const path = resolve(ARTIFACT_DIR, name);
      return { path, ...statSync(path) };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs)[0] || null;
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export default { run };
