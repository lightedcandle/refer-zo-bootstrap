#!/usr/bin/env node
/**
 * heartbeat.mjs — Universal periodic orchestrator
 * 
 * This is the heartbeat train. Each car is a script that runs on every tick.
 * Add cars by placing scripts in the cars/ directory.
 * Each car must export: run(state) => { state, continue }
 * 
 * State is passed car to car. Dashboard reads from state file.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CARS_DIR = join(__dirname, "cars");
const STATE_FILE = join(__dirname, "heartbeat-state.json");
const LOG_FILE = join(__dirname, "heartbeat.log");
const META_FILE = join(__dirname, "heartbeat-meta.json");

// ── State helpers ────────────────────────────────────────────────
function loadState() {
  try {
    return JSON.parse(readFileSync(STATE_FILE, "utf8"));
  } catch {
    return { runs: 0, last_run: null, cars: {}, dashboard: {}, tasks: [], alerts: [] };
  }
}

function saveState(state) {
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  writeFileSync(LOG_FILE, `heartbeat: ${new Date().toISOString()} runs=${state.runs}\n`, { flag: "a" });
}

function getMeta() {
  try {
    return JSON.parse(readFileSync(META_FILE, "utf8"));
  } catch {
    return { interval_ms: 300000, next_run: null, active: true, cars: [] };
  }
}

function saveMeta(meta) {
  writeFileSync(META_FILE, JSON.stringify(meta, null, 2));
}

// ── Car loader ─────────────────────────────────────────────────
function loadCars() {
  if (!existsSync(CARS_DIR)) return [];
  return readdirSync(CARS_DIR)
    .filter(f => f.endsWith(".mjs"))
    .sort()
    .map(f => join(CARS_DIR, f));
}

// ── Main heartbeat tick ────────────────────────────────────────
async function tick() {
  const meta = getMeta();
  if (!meta.active) {
    console.log("(heartbeat :status \"sleeping\" :reason \"deactivated\")");
    return;
  }

  const state = loadState();
  state.runs++;
  state.last_run = new Date().toISOString();
  state.last_mode = "heartbeat";

  const cars = loadCars();
  const results = [];
  const warnings = [];
  let continue_chain = true;

  for (const carPath of cars) {
    try {
      const mod = await import(carPath);
      const run = mod.default || mod.run;
      if (!run) {
        warnings.push(`car ${carPath.split("/").pop()} has no run() export — skipped`);
        continue;
      }

      const carName = carPath.split("/").pop().replace(".mjs", "");
      const carState = { ...state };

      const result = await run(carState, meta);

      // Extract what changed
      const carResult = {
        car: carName,
        status: result?.status || "completed",
        duration_ms: result?.duration_ms || 0,
        dashboard_updates: result?.dashboard_updates || {},
        task_executed: result?.task_executed || null,
        gap_found: result?.gap_found || null,
        alert: result?.alert || null,
      };
      results.push(carResult);

      // Merge dashboard updates
      if (result?.dashboard_updates) {
        state.dashboard = { ...state.dashboard, ...result.dashboard_updates };
      }

      // Merge task results
      if (result?.task) {
        const idx = state.tasks.findIndex(t => t.id === result.task.id);
        if (idx >= 0) state.tasks[idx] = result.task;
        else state.tasks.push(result.task);
      }

      // Check if chain should stop
      if (result?.halt) {
        continue_chain = false;
        carResult.note = "halted chain";
        break;
      }

    } catch (err) {
      results.push({ car: carPath.split("/").pop(), status: "error", error: err.message });
    }
  }

  state.car_results = results;
  state.warnings = warnings;
  state.dashboard.last_heartbeat = new Date().toISOString();

  saveState(state);

  // Output S-expression status
  const dashboard = state.dashboard;
  console.log(`(heartbeat :runs ${state.runs} :last "${state.last_run}" :cars ${cars.length} :ok ${results.filter(r => r.status !== "error").length}/${cars.length} :dashboard (tasks:${dashboard.task_count || 0} uptime:${dashboard.uptime || "n/a"}) )`);

  if (warnings.length) console.log(`(heartbeat :warnings "${warnings.join("; ")}")`);

  return state;
}

// ── Schedule next tick ─────────────────────────────────────────
async function scheduleNext(interval_ms = 300000) {
  const meta = getMeta();
  meta.next_run = new Date(Date.now() + interval_ms).toISOString();
  meta.interval_ms = interval_ms;
  saveMeta(meta);
}

// ── CLI entry ──────────────────────────────────────────────────
const args = process.argv.slice(2);

if (args.includes("--tick")) {
  tick().then(() => process.exit(0));
} else if (args.includes("--activate")) {
  const meta = getMeta();
  meta.active = true;
  saveMeta(meta);
  console.log("(heartbeat :status \"active\")");
} else if (args.includes("--sleep")) {
  const meta = getMeta();
  meta.active = false;
  saveMeta(meta);
  console.log("(heartbeat :status \"sleeping\")");
} else if (args.includes("--status")) {
  const meta = getMeta();
  const state = loadState();
  console.log(`(heartbeat :active ${meta.active} :runs ${state.runs} :last "${state.last_run}" :next "${meta.next_run}" :interval ${meta.interval_ms}ms :cars ${loadCars().length})`);
} else if (args.includes("--add")) {
  const carName = args[args.indexOf("--add") + 1];
  if (!carName) { console.log("(heartbeat :error \"provide car name\")"); process.exit(1); }
  console.log(`(heartbeat :add-car "${carName}" :path "cars/${carName}.mjs" )`);
} else {
  // Default: tick + schedule next
  tick().then(() => scheduleNext());
}

export default tick;