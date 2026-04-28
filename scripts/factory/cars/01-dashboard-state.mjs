import { join } from "node:path";

/**
 * cars/01-dashboard-state.mjs
 * Writes dashboard state on every heartbeat tick.
 * Cost: ~0 tokens. Always runs.
 */

export default async function dashboardState(state, meta) {
  const start = Date.now();
  let recent = { count: 0, last: null, latest: "idle" };
  try {
    const { existsSync, readFileSync } = await import("node:fs");
    const LOG = join(process.cwd(), "scripts/factory/process-events.jsonl");
    if (existsSync(LOG)) {
      const lines = readFileSync(LOG, "utf8").trim().split("\n").slice(-20);
      recent.count = lines.length;
      if (lines.length > 0) {
        try {
          const e = JSON.parse(lines[lines.length - 1]);
          recent.last = e.ts;
          recent.latest = e.status || "idle";
        } catch {}
      }
    }
  } catch {}

  const task_count = state.tasks?.length || 0;
  const pending = state.tasks?.filter(t => t.status === "pending").length || 0;

  return {
    status: "completed",
    duration_ms: Date.now() - start,
    dashboard_updates: {
      last_heartbeat: new Date().toISOString(),
      process_count: recent.count,
      last_event: recent.last,
      latest_status: recent.latest,
      task_count,
      task_pending: pending,
      uptime: state.runs ? `${state.runs * (meta.interval_ms / 1000)}s` : "0s",
      mode: state.last_mode || "idle",
    },
    task: null,
    gap_found: null,
    alert: null,
  };
}