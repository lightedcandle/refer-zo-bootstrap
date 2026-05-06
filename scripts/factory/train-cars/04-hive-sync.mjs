#!/usr/bin/env node
/**
 * @opcodes ['FETCH_HIVE_MANIFEST', 'COMPARE_VERSIONS', 'REPORT_SYNC_STATUS']
 * @trigger hive sync
 * @description Train car that checks the hive manifest and reports whether updates are available.
 * @forge-type bridge
 * @forge-name Hive Sync Car
 * @forge-id hive-sync-car
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const HIVE_DIR = resolve(HERE, "..", "hive");
const LOCAL_MANIFEST = resolve(HIVE_DIR, "manifest.json");
const SYNC_STATE = resolve(HIVE_DIR, "last-sync.json");

export async function run() {
  const started = Date.now();
  const hiveUrl = process.env.REFER_HIVE_URL || process.env.HIVE_URL || "";
  const localManifest = readJson(LOCAL_MANIFEST) || {};
  if (!hiveUrl) {
    return {
      status: "completed",
      duration_ms: Date.now() - started,
      dashboard_updates: {
        hive_sync_status: "local_only",
        hive_manifest_version: localManifest.version || "",
      },
    };
  }

  try {
    const remote = await fetchManifest(hiveUrl);
    const remoteManifest = remote.manifest || remote;
    const comparison = compareVersions(localManifest.version || "0.0.0", remoteManifest.version || "0.0.0");
    const result = {
      checked_at: new Date().toISOString(),
      hive_url: redactUrl(hiveUrl),
      local_version: localManifest.version || "",
      remote_version: remoteManifest.version || "",
      update_available: comparison < 0,
    };
    writeFileSync(SYNC_STATE, `${JSON.stringify(result, null, 2)}\n`, "utf8");
    return {
      status: "completed",
      duration_ms: Date.now() - started,
      dashboard_updates: {
        hive_sync_status: result.update_available ? "update_available" : "current",
        hive_manifest_version: result.remote_version,
      },
      gap_found: result.update_available ? "hive_manifest_update_available" : null,
    };
  } catch (error) {
    return {
      status: "warning",
      duration_ms: Date.now() - started,
      dashboard_updates: { hive_sync_status: "unreachable" },
      alert: error?.message || String(error),
    };
  }
}

async function fetchManifest(base) {
  const url = new URL("/api/hive/manifest", base.endsWith("/") ? base : `${base}/`);
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`manifest HTTP ${response.status}`);
  return response.json();
}

function readJson(path) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function compareVersions(left, right) {
  const a = String(left).split(".").map(Number);
  const b = String(right).split(".").map(Number);
  for (let i = 0; i < Math.max(a.length, b.length, 3); i += 1) {
    const av = Number.isFinite(a[i]) ? a[i] : 0;
    const bv = Number.isFinite(b[i]) ? b[i] : 0;
    if (av < bv) return -1;
    if (av > bv) return 1;
  }
  return 0;
}

function redactUrl(value) {
  try {
    const url = new URL(value);
    url.username = "";
    url.password = "";
    return url.toString();
  } catch {
    return "";
  }
}

export default { run };
