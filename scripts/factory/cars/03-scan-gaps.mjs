import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * cars/03-scan-gaps.mjs
 * On each tick, look for missing context and write to gap-log.
 * Low cost — just reads files and compares.
 */

export default async function scanGaps(state, meta) {
  const start = Date.now();
  const gaps = [];

  const ROOT = process.cwd();

  // Check: is codebase-tree fresh?
  const TREE = join(ROOT, ".refer-factory/codebase-tree.json");
  if (!existsSync(TREE)) {
    gaps.push({ type: "missing", category: "context", name: "codebase-tree", severity: "medium", note: "run scan-workspace to generate" });
  }

  // Check: is registry missing scripts?
  const REGISTRY = join(ROOT, "scripts/factory/script-registry.json");
  let registry_scripts = [];
  try {
    const r = JSON.parse(readFileSync(REGISTRY, "utf8"));
    registry_scripts = r.scripts?.map(s => s.script_id) || [];
  } catch {}

  const ARTIFACTS_DIR = join(ROOT, "scripts/factory/artifacts");
  if (existsSync(ARTIFACTS_DIR)) {
    const files = readdirSync(ARTIFACTS_DIR).filter(f => f.endsWith(".mjs"));
    const missing = files.filter(f => !registry_scripts.includes(f.replace(".mjs", "")));
    if (missing.length) {
      gaps.push({ type: "unregistered", category: "scripts", names: missing, severity: "low" });
    }
  }

  // Check: process events stale?
  const PROCESS = join(ROOT, "scripts/factory/process-events.jsonl");
  if (existsSync(PROCESS)) {
    const lines = readFileSync(PROCESS, "utf8").trim().split("\n");
    if (lines.length > 0) {
      try {
        const last = JSON.parse(lines[lines.length - 1]);
        const age_ms = Date.now() - new Date(last.ts).getTime();
        if (age_ms > 3600000) {
          gaps.push({ type: "stale", category: "process-events", name: "process-events", severity: "medium", note: `last event ${Math.round(age_ms/60000)}min ago` });
        }
      } catch {}
    }
  }

  const result = {
    status: gaps.length ? "gaps-found" : "clean",
    duration_ms: Date.now() - start,
    gap_found: gaps.length ? { count: gaps.length, items: gaps } : null,
  };

  if (gaps.length) {
    const GAP_FILE = join(ROOT, "heartbeat-gap-log.json");
    writeFileSync(GAP_FILE, JSON.stringify({ ts: new Date().toISOString(), runs: state.runs, gaps }, null, 2));
  }

  return result;
}