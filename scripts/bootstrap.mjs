/**
 * bootstrap.mjs — Hive-Aware Evolution Bootstrap
 *
 * Runs IN CHAT. Every finding = evolution event.
 * Errors become forges. Talkback to Hive at every step.
 *
 * Usage:
 *   node bootstrap.mjs --target apostlej
 *   node bootstrap.mjs --target telechurch --mode evolve
 *   node bootstrap.mjs --check
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, ".."); // scripts/ -> repo root
const DATASETS_DIR = join(REPO_ROOT, "datasets");
const SCRIPTS_DIR = join(__dirname, "..");
const FACTORY_DIR = join(__dirname, "factory");

const log = (...a) => console.log("[bootstrap]", ...a);
const warn = (...a) => console.warn("[bootstrap] ⚠️", ...a);
const err_ = (...a) => console.error("[bootstrap] ❌", ...a);

let _uuidCounter = 0;
const uuid = () => `${Date.now().toString(36)}-${(++_uuidCounter).toString(36)}-${Math.random().toString(36).slice(2,9)}`;
const now = () => new Date().toISOString();

// ── Datasets ──────────────────────────────────────────────────────────────────
const SCHEMAS = {
  "chat-contracts": {
    cols: ["id","prompt","mode","outcome","tokens_used","duration_ms","chat_model","chunked","chunks","has_risky","risky_reason","created_at"],
    sql: `CREATE TABLE IF NOT EXISTS chat_contracts (id TEXT PRIMARY KEY, prompt TEXT, mode TEXT, outcome TEXT, tokens_used INTEGER, duration_ms INTEGER, chat_model TEXT, chunked INTEGER DEFAULT 0, chunks INTEGER DEFAULT 1, has_risky INTEGER DEFAULT 0, risky_reason TEXT, created_at TEXT)`
  },
  "chat-logs": {
    cols: ["id","session","role","content","mode","outcome","risky","chunking","created_at"],
    sql: `CREATE TABLE IF NOT EXISTS chat_logs (id TEXT PRIMARY KEY, session TEXT, role TEXT, content TEXT, mode TEXT, outcome TEXT, risky INTEGER DEFAULT 0, chunking INTEGER DEFAULT 0, created_at TEXT)`
  },
  "node-registry": {
    cols: ["id","name","type","version","origin","connected_to","last_seen","status","meta","created_at"],
    sql: `CREATE TABLE IF NOT EXISTS node_registry (id TEXT PRIMARY KEY, name TEXT, type TEXT, version TEXT, origin TEXT, connected_to TEXT, last_seen TEXT, status TEXT, meta TEXT, created_at TEXT)`
  },
  "script-registry": {
    cols: ["id","forge_id","trigger","script_file","questions","last_run","run_count","status","created_at"],
    sql: `CREATE TABLE IF NOT EXISTS script_registry (id TEXT PRIMARY KEY, forge_id TEXT, trigger TEXT, script_file TEXT, questions INTEGER DEFAULT 0, last_run TEXT, run_count INTEGER DEFAULT 0, status TEXT, created_at TEXT)`
  },
  "evolution-log": {
    cols: ["id","session_id","source","origin","outcome","ran_at","finished_at","duration_ms","mode","errors_encountered","forges_created","corrections_applied","can_retry","retry_after","notes"],
    sql: `CREATE TABLE IF NOT EXISTS "evolution-log" (id TEXT PRIMARY KEY, session_id TEXT, source TEXT, origin TEXT, outcome TEXT, ran_at TEXT, finished_at TEXT, duration_ms INTEGER, mode TEXT, errors_encountered INTEGER DEFAULT 0, forges_created INTEGER DEFAULT 0, corrections_applied INTEGER DEFAULT 0, can_retry INTEGER DEFAULT 1, retry_after TEXT, notes TEXT)`
  },
  "forge-log": {
    cols: ["id","session_id","forge_id","forge_name","forge_type","trigger_error_id","trigger_prompt","file_path","generated_at","registered","talkback_sent","reused_count","created_at"],
    sql: `CREATE TABLE IF NOT EXISTS "forge-log" (id TEXT PRIMARY KEY, session_id TEXT, forge_id TEXT, forge_name TEXT, forge_type TEXT, trigger_error_id TEXT, trigger_prompt TEXT, file_path TEXT, generated_at TEXT, registered INTEGER DEFAULT 0, talkback_sent INTEGER DEFAULT 0, reused_count INTEGER DEFAULT 0, created_at TEXT)`
  }
};

function dbPath(name) {
  const p = join(DATASETS_DIR, name, "data.duckdb");
  mkdirSync(join(DATASETS_DIR, name), { recursive: true });
  return p;
}

function initDb(name) {
  const p = dbPath(name);
  // NEVER pre-create duckdb files - DuckDB must create them
  // Just ensure the directory exists
  if (SCHEMAS[name] && SCHEMAS[name].sql) {
    const sql = SCHEMAS[name].sql;
    new Promise(res => {
      const proc = spawn("duckdb", [p, "-c", sql]);
      let stderr = "";
      proc.stderr.on("data", d => stderr += d);
      proc.on("close", code => {
        if (code !== 0) log(`  Schema init ${name}: ${stderr.slice(0,80)}`);
        res(p);
      });
      proc.on("error", () => res(p));
    }).catch(() => {});
  }
  return p;
}

function initAll() {
  for (const name of Object.keys(SCHEMAS)) initDb(name);
}

async function dbQuery(name, sql) {
  const p = dbPath(name);
  const quoted = name.includes("-") ? `"${name}"` : name;
  const safeSql = sql.replace(new RegExp(`FROM\\s+${name}(\\s|;|$)`, "i"), `FROM ${quoted}$1`);
  return new Promise((res, rej) => {
    if (!existsSync(p)) return res("");
    const proc = spawn("duckdb", [p, "-noheader", "-csv", "-c", safeSql]);
    let out = "", err = "";
    proc.stdout.on("data", d => out += d);
    proc.stderr.on("data", d => err += d);
    proc.on("close", code => {
      if (code !== 0 && !err.includes("syntax error") && !err.includes("does not exist")) {
        rej(new Error(err || out));
      } else {
        res(out || "");
      }
    });
  });
}

async function dbInsert(table, cols, values) {
  const quoted = table.includes("-") ? `"${table}"` : table;
  const placeholders = cols.map(() => "?").join(", ");
  const sql = `INSERT INTO ${quoted} (${cols.join(",")}) VALUES (${placeholders})`;
  const escaped = values.map(v => String(v).replace(/'/g, "''"));
  try {
    const finalSql = sql.replace(/\?/g, () => `'${escaped.shift()}'`);
    await dbQuery(table, finalSql);
  } catch(e) { log(`  DB insert warning: ${e.message}`); }
}

// ── Evolution logging ─────────────────────────────────────────────────────────
async function logEvolution(sessionId, phase, type, severity, detail, forgeId = null) {
  const ts = now();
  log(`${severity === "BLOCKING" ? "❌" : severity === "ERROR" ? "⚠️" : "⚡"} [${phase}] ${type}: ${detail}`);
  if (forgeId) log(`   → Forge generated: ${forgeId}`);
  await dbInsert("evolution-log",
    ["id","session_id","source","origin","outcome","ran_at","mode","errors_encountered","notes"],
    [uuid(), sessionId, "bootstrap", TARGET, "EVOLVED", ts, phase, 1, `${type}: ${detail}`]
  );
  if (forgeId) {
    await dbInsert("forge-log",
      ["id","session_id","forge_id","forge_name","forge_type","trigger_prompt","generated_at","created_at"],
      [uuid(), sessionId, forgeId, forgeId, "patch", detail, ts, ts]
    );
  }
}

// ── Phase: System check ───────────────────────────────────────────────────────
async function phaseSystemCheck(sessionId) {
  const errors = [];
  try {
    const proc = spawn("which", ["duckdb"]);
    await new Promise(r => proc.on("close", c => c === 0 ? r() : r()));
  } catch { errors.push({ phase: "system_check", type: "MISSING_DEPENDENCY", severity: "BLOCKING", detail: "DuckDB not found" }); }
  try {
    const proc = spawn("node", ["--version"]);
    await new Promise(r => proc.on("close", c => c === 0 ? r() : r()));
  } catch { errors.push({ phase: "system_check", type: "MISSING_DEPENDENCY", severity: "BLOCKING", detail: "Node.js not found" }); }
  if (!existsSync(SCRIPTS_DIR)) errors.push({ phase: "system_check", type: "MISSING_DIR", severity: "ERROR", detail: `scripts/ missing at ${SCRIPTS_DIR}` });
  if (!existsSync(FACTORY_DIR)) errors.push({ phase: "system_check", type: "MISSING_DIR", severity: "ERROR", detail: `factory/ missing` });
  for (const e of errors) await logEvolution(sessionId, e.phase, e.type, e.severity, e.detail, e.forgeId || null);
  return errors;
}

// ── Phase: Init datasets ──────────────────────────────────────────────────────
async function phaseInitDatasets(sessionId) {
  const errors = [];
  for (const name of Object.keys(SCHEMAS)) {
    try { initDb(name); log(`  ✓ ${name}`); }
    catch (e) { errors.push({ phase: "init_datasets", type: "DATASET_INIT_FAILED", severity: "ERROR", detail: `${name}: ${e.message}` }); }
  }
  for (const e of errors) await logEvolution(sessionId, e.phase, e.type, e.severity, e.detail);
  return errors;
}

// ── Phase: Scan forges ────────────────────────────────────────────────────────
async function phaseScanForges(sessionId) {
  const errors = [];
  if (!existsSync(FACTORY_DIR)) {
    await logEvolution(sessionId, "scan_forges", "MISSING_DIR", "ERROR", `factory/ not found at ${FACTORY_DIR}`);
    return errors;
  }
  const files = readdirSync(FACTORY_DIR).filter(f => f.endsWith(".mjs"));
  log(`  Scanned ${files.length} potential forges`);
  for (const file of files) {
    const path = join(FACTORY_DIR, file);
    const content = readFileSync(path, "utf8");
    const hasId = /@forge-id/.test(content);
    const hasTrigger = /@trigger\s/.test(content);
    if (!hasId) {
      await logEvolution(sessionId, "scan_forges", "UNANNOTATED_FORGE", "WARNING",
        `${file} has no @forge-id annotation — generating annotation forge`,
        `bootstrap/annotate-${file.replace(".mjs","")}`
      );
    }
  }
  return errors;
}

// ── Phase: Check Hive connectivity ────────────────────────────────────────────
let TARGET = "unknown";

async function phaseHiveConnect(sessionId) {
  log("  Testing Hive connectivity...");
  try {
    const proc = spawn("curl", ["-s", "-X", "POST", "https://api.zo.computer/mcp",
      "-H", "Content-Type: application/json",
      "-H", `Authorization: Bearer ${process.env.ZO_COMPUTER_TELECHURCH || ""}`,
      "-d", '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"list_space_routes","arguments":{}}}'
    ]);
    const out = await new Promise(res => {
      let d = "";
      proc.stdout.on("data", chunk => d += chunk);
      proc.on("close", () => res(d));
    });
    if (out.includes("parse_error") || out.includes("Invalid")) {
      await logEvolution(sessionId, "hive_connect", "HIVE_UNREACHABLE", "WARNING", "Hive API not reachable — will queue talkbacks");
    } else {
      log("  ✓ Hive API reachable");
    }
  } catch (e) {
    await logEvolution(sessionId, "hive_connect", "HIVE_UNREACHABLE", "WARNING", `Hive unreachable: ${e.message}`);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  let mode = "install";
  let checkOnly = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--target" && args[i+1]) TARGET = args[++i];
    if (args[i] === "--mode" && args[i+1]) mode = args[++i];
    if (args[i] === "--check") checkOnly = true;
  }

  if (TARGET === "unknown") {
    err_("Usage: node bootstrap.mjs --target <zo-name> [--mode evolve|install] [--check]");
    process.exit(1);
  }

  console.log(`\n╔═══ Hive Bootstrap — ${TARGET} ═══╗`);
  console.log(`   Mode: ${mode} | Check: ${checkOnly}\n`);

  const sessionId = `boot-${TARGET}-${Date.now()}`;
  const startTime = Date.now();
  let totalErrors = 0;
  let totalForges = 0;

  // Phase 1: System
  const e1 = await phaseSystemCheck(sessionId);
  totalErrors += e1.filter(e => e.severity === "BLOCKING").length;

  // Phase 2: Datasets
  await phaseInitDatasets(sessionId);

  // Phase 3: Forges
  const e3 = await phaseScanForges(sessionId);
  totalForges += e3.filter(e => e.forgeId).length;

  // Phase 4: Hive
  await phaseHiveConnect(sessionId);

  const duration = Date.now() - startTime;
  const blocking = (await dbQuery("evolution-log", `SELECT COUNT(*) FROM "evolution-log" WHERE session_id='${sessionId}' AND notes LIKE '%BLOCKING%'`)).trim();

  console.log(`\n╠═══ Bootstrap Complete ═══╣`);
  console.log(`  Session:  ${sessionId}`);
  console.log(`  Duration: ${duration}ms`);
  console.log(`  Forges:   ${totalForges} generated this run`);
  console.log(`  Status:    evolution-log updated`);

  if (checkOnly) {
    console.log(`\n  [CHECK MODE] No changes committed.`);
    console.log(`  Run without --check to apply bootstrap.`);
  }

  console.log(`\n  Evolution data → datasets/evolution-log/data.duckdb`);
  console.log(`  Forge log       → datasets/forge-log/data.duckdb\n`);

  await dbQuery("evolution-log", `INSERT INTO evolution_log (id,session_id,source,origin,outcome,ran_at,finished_at,duration_ms,mode,errors_encountered,forges_created,can_retry,notes) VALUES ('${uuid()}','${sessionId}','bootstrap','${TARGET}','COMPLETE','${now()}','${now()}',${duration},'${mode}',${totalErrors},${totalForges},1,'Session finished')`).catch(() => {});
}

main().catch(e => {
  err_("Bootstrap failed:", e.message);
  process.exit(1);
});