#!/usr/bin/env node
/**
 * @opcodes ['LOAD_META', 'LOAD_STATE', 'RUN_CARS', 'LOG_TICK']
 * @trigger tick interval periodic
 * @description Periodic tick orchestrator — runs train cars on each interval
 * @forge-type trigger
 * @forge-name Heartbeat Orchestrator
 * @forge-id heartbeat
 *
 * heartbeat.mjs — Universal periodic orchestrator
 *
 * This is the heartbeat train. Each car is a script that runs on every tick.
 * Add cars by placing scripts in the train-cars/ directory.
 * Each car must export: run(state) => { state, continue }
 *
 * State is passed car to car. Dashboard reads from state file.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { store } from "./dataset-store.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CARS_DIR = join(__dirname, "train-cars");
const STATE_FILE = join(__dirname, "heartbeat-state.json");
const LOG_FILE = join(__dirname, "heartbeat.log");
const META_FILE = join(__dirname, "heartbeat-meta.json");

// ── State helpers ────────────────────────────────────────────────────────────
function loadState() {
  try {
    const raw = readFileSync(STATE_FILE, "utf8").trim();
    if (!raw) return { runs: 0, last_run: null, cars: {}, dashboard: {}, tasks: [], alerts: [] };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return { runs: 0, last_run: null, cars: {}, dashboard: {}, tasks: [], alerts: [] };
    return parsed;
  } catch { return { runs: 0, last_run: null, cars: {}, dashboard: {}, tasks: [], alerts: [] }; }
}

function saveState(state) {
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  writeFileSync(LOG_FILE, `heartbeat: ${new Date().toISOString()} runs=${state.runs}\n`, { flag: "a" });
}

function getMeta() {
  try { return JSON.parse(readFileSync(META_FILE, "utf8")); }
  catch { return defaultMeta(); }
}

function saveMeta(meta) {
  writeFileSync(META_FILE, JSON.stringify(normalizeMeta(meta), null, 2));
}

function defaultMeta() {
  return normalizeMeta({ interval_ms: 300000, next_run: null, active: true, cars: [] });
}

function normalizeMeta(meta) {
  const policy = meta.policy || {};
  return {
    ...meta,
    active: meta.active !== false,
    policy: {
      mode: policy.mode || "adaptive",
      min_interval_ms: Number(policy.min_interval_ms) || 300000,
      max_interval_ms: Number(policy.max_interval_ms) || 86400000,
      active_interval_ms: Number(policy.active_interval_ms) || 300000,
      ratifying_interval_ms: Number(policy.ratifying_interval_ms) || 900000,
      watch_interval_ms: Number(policy.watch_interval_ms) || 3600000,
      idle_interval_ms: Number(policy.idle_interval_ms) || 21600000,
      dormant_interval_ms: Number(policy.dormant_interval_ms) || 86400000,
      idle_after_ms: Number(policy.idle_after_ms) || 3600000,
      dormant_after_ms: Number(policy.dormant_after_ms) || 86400000,
    },
  };
}

// ── Car loader ───────────────────────────────────────────────────────────────
function loadCars() {
  if (!existsSync(CARS_DIR)) return [];
  return readdirSync(CARS_DIR)
    .filter(f => f.endsWith(".mjs"))
    .sort()
    .map(f => join(CARS_DIR, f));
}

// ── Main heartbeat tick ───────────────────────────────────────────────────────
async function tick() {
  const meta = normalizeMeta(getMeta());
  if (!meta.active) {
    console.log("(heartbeat :status \"sleeping\" :reason \"deactivated\")");
    return;
  }

  const state = loadState();
  state.runs++;
  state.last_run = new Date().toISOString();
  state.last_mode = "heartbeat";
  state.heartbeat_mode = classifyHeartbeatMode(state, meta);

  const cars = loadCars();
  const results = [];
  const warnings = [];
  let continue_chain = true;

  for (const carPath of cars) {
    try {
      const mod = await import(pathToFileURL(carPath).href);
      const run = typeof mod.default === "function" ? mod.default
              : mod.default && typeof mod.default.run === "function" ? mod.default.run
              : typeof mod.run === "function" ? mod.run : null;
      if (!run) {
        warnings.push(`car ${basename(carPath)} has no run() export - skipped`);
        continue;
      }

      const carName = basename(carPath, ".mjs");
      const carState = { ...state };

      const result = await run(carState, meta);

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

      if (result?.dashboard_updates) state.dashboard = { ...state.dashboard, ...result.dashboard_updates };
      if (result?.task) {
        const idx = state.tasks.findIndex(t => t.id === result.task.id);
        if (idx >= 0) state.tasks[idx] = result.task;
        else state.tasks.push(result.task);
      }
      if (result?.halt) { continue_chain = false; carResult.note = "halted chain"; break; }

    } catch (err) {
      results.push({ car: basename(carPath), status: "error", error: err.message });
    }
  }

  state.car_results = results;
  state.warnings = warnings;
  if(!state.dashboard) state.dashboard = {}; state.dashboard.last_heartbeat = new Date().toISOString();

  saveState(state);

  // Log tick to chat-logs dataset
  try {
    store.log({
      id: `tick_${state.runs || 0}_${Date.now()}`,
      tick: state.runs,
      tick_at: new Date().toISOString(),
      cars_run: results.map(r => r.car).join(","),
      outcome: results.every(r => r.status !== "error") ? "ok" : "partial",
      duration_ms: results.reduce((sum, r) => sum + (r.duration_ms || 0), 0),
    }, "chat-logs");
  } catch (e) {
    console.error("[heartbeat] dataset log error:", e.message);
  }

  const dashboard = state.dashboard;
  console.log(`(heartbeat :runs ${state.runs} :last "${state.last_run}" :mode "${state.heartbeat_mode}" :cars ${cars.length} :ok ${results.filter(r => r.status !== "error").length}/${cars.length} :dashboard (tasks:${dashboard.task_count || 0} uptime:${dashboard.uptime || "n/a"}) )`);

  if (warnings.length) console.log(`(heartbeat :warnings "${warnings.join("; ")}")`);

  return state;
}

// ── Schedule next tick ─────────────────────────────────────────────────────────
async function scheduleNext(interval_ms = null, state = null) {
  const meta = normalizeMeta(getMeta());
  const resolved = interval_ms || chooseIntervalMs(state || loadState(), meta);
  meta.next_run = new Date(Date.now() + resolved).toISOString();
  meta.interval_ms = resolved;
  meta.last_mode = classifyHeartbeatMode(state || loadState(), meta);
  meta.interval_label = formatDuration(resolved);
  saveMeta(meta);
}

function chooseIntervalMs(state, meta) {
  const policy = meta.policy;
  const mode = classifyHeartbeatMode(state, meta);
  const byMode = {
    active_build: policy.active_interval_ms,
    ratifying: policy.ratifying_interval_ms,
    watch: policy.watch_interval_ms,
    idle: policy.idle_interval_ms,
    dormant: policy.dormant_interval_ms,
  };
  const raw = byMode[mode] || policy.watch_interval_ms;
  return Math.min(Math.max(raw, policy.min_interval_ms), policy.max_interval_ms);
}

function classifyHeartbeatMode(state, meta) {
  const dashboard = state?.dashboard || {};
  const taskCount = Number(dashboard.task_count || 0);
  const alerts = Array.isArray(state?.alerts) ? state.alerts.length : 0;
  const pendingTasks = Array.isArray(state?.tasks)
    ? state.tasks.filter((task) => ["pending", "running", "in_flight"].includes(String(task.status || "").toLowerCase())).length
    : 0;
  if (alerts > 0 || pendingTasks > 0 || taskCount > 0) return "active_build";
  if (String(meta.status || "").toLowerCase() === "ratifying") return "ratifying";
  const lastRun = state?.last_run ? new Date(state.last_run).getTime() : 0;
  const age = lastRun ? Date.now() - lastRun : Number.POSITIVE_INFINITY;
  if (age >= meta.policy.dormant_after_ms) return "dormant";
  if (age >= meta.policy.idle_after_ms) return "idle";
  return "watch";
}

function formatDuration(ms) {
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = minutes / 60;
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)}h`;
}

// ── CLI entry ─────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);

if (args.includes("--tick")) {
  tick().then((state) => scheduleNext(null, state)).then(() => process.exit(0));
} else if (args.includes("--activate")) {
  const meta = getMeta(); meta.active = true; saveMeta(meta);
  console.log("(heartbeat :status \"active\")");
} else if (args.includes("--sleep")) {
  const meta = getMeta(); meta.active = false; saveMeta(meta);
  console.log("(heartbeat :status \"sleeping\")");
} else if (args.includes("--status")) {
  const meta = normalizeMeta(getMeta());
  const state = loadState();
  console.log(`(heartbeat :active ${meta.active} :runs ${state.runs} :last "${state.last_run}" :next "${meta.next_run}" :interval ${meta.interval_ms}ms :mode "${classifyHeartbeatMode(state, meta)}" :max ${meta.policy.max_interval_ms}ms :cars ${loadCars().length})`);
} else if (args.includes("--policy")) {
  const meta = normalizeMeta(getMeta());
  console.log(JSON.stringify(meta.policy, null, 2));
} else if (args.includes("--add")) {
  const carName = args[args.indexOf("--add") + 1];
  if (!carName) { console.log("(heartbeat :error \"provide car name\")"); process.exit(1); }
  console.log(`(heartbeat :add-car "${carName}" :path "train-cars/${carName}.mjs" )`);
} else {
  tick().then((state) => scheduleNext(null, state));
}

export default tick;
export { tick };
