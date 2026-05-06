#!/usr/bin/env node
/**
 * @opcodes ['READ_NODE_STATE', 'PING_HIVE_STATUS', 'UPDATE_DASHBOARD']
 * @trigger heartbeat tick
 * @description Train car that refreshes dashboard state and optionally pings a hive status endpoint.
 * @forge-type trigger
 * @forge-name Heartbeat Car
 * @forge-id heartbeat-car
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const HIVE_DIR = resolve(HERE, "..", "hive");

export async function run(state = {}) {
  const started = Date.now();
  const self = readJson(resolve(HIVE_DIR, "self.json")) || {};
  const nodes = normalizeNodes(readJson(resolve(HIVE_DIR, "nodes.json")));
  const pendingTasks = Array.isArray(state.tasks)
    ? state.tasks.filter((task) => ["pending", "running", "in_flight"].includes(String(task.status || "").toLowerCase())).length
    : 0;
  const hiveStatus = await pingHiveStatus(self);

  return {
    status: hiveStatus.ok || hiveStatus.skipped ? "completed" : "warning",
    duration_ms: Date.now() - started,
    dashboard_updates: {
      node_id: self.id || process.env.ZO_COMPUTER_NAME || "local",
      node_name: self.name || "REFER Zo Bootstrap",
      node_url: self.url || "",
      node_count: nodes.length,
      active_node_count: nodes.filter((node) => node.active !== false && node.status !== "offline").length,
      task_count: pendingTasks,
      uptime: `${Math.round(process.uptime())}s`,
      hive_status: hiveStatus,
    },
    alert: hiveStatus.ok || hiveStatus.skipped ? null : hiveStatus.error,
  };
}

async function pingHiveStatus(self) {
  const base = process.env.REFER_HIVE_URL || process.env.HIVE_URL || self.hive_url || "";
  if (!base) return { skipped: true, reason: "no_hive_url" };
  try {
    const url = new URL("/api/hive", base.endsWith("/") ? base : `${base}/`);
    url.searchParams.set("status", "1");
    if (self.id) url.searchParams.set("node", self.id);
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
    return { ok: response.ok, status: response.status };
  } catch (error) {
    return { ok: false, error: error?.message || String(error) };
  }
}

function readJson(path) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function normalizeNodes(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.nodes)) return value.nodes;
  return [];
}

export default { run };
