#!/usr/bin/env node
 * @opcodes ['INIT_ALL', 'STORE_LOG', 'QUERY', 'COUNT']
 * @trigger store log query dataset
 * @description Manages DuckDB datasets for chat-contracts, chat-logs, hive-events, node-registry, request-log, script-registry
 * @forge-type dataset
 * @forge-name Dataset Store
 * @forge-id dataset-store
/**
 * dataset-store.mjs — Unified DuckDB store for all Script Factory datasets.
 * Auto-generates camelCase accessors: store.chatContracts.log({...})
 */
import { existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATASETS_DIR = join(__dirname, "..", "..", "datasets").replace(/\/+$/, "");
const ABS_DATASETS_DIR = DATASETS_DIR; // Same — both are absolute

// ── Schemas ───────────────────────────────────────────────────────────────────
const SCHEMAS = {
  "chat-contracts": [
    "id          varchar",
    "session_id  varchar",
    "prompt      varchar",
    "mode        varchar",
    "risk        varchar",
    "chunk_count integer",
    "chunk_ids   varchar",
    "matched_script varchar",
    "needs_chunking boolean",
    "outcome     varchar",
    "status      varchar",
    "created_at  varchar",
  ],
  "chat-logs": [
    "id          varchar",
    "session_id  varchar",
    "tick_at     varchar",
    "cars_run    varchar",
    "outcome     varchar",
    "duration_ms integer",
  ],
  "hive-factory-dispatch": [
    "id               varchar",
    "direction        varchar",
    "from_node        varchar",
    "to_node          varchar",
    "package_version  varchar",
    "manifest_hash    varchar",
    "status           varchar",
    "error_message    varchar",
    "sent_at          varchar",
    "delivered_at     varchar",
    "applied_at       varchar",
  ],
  "node-identity": [
    "node_id       varchar",
    "endpoint      varchar",
    "api_token_env varchar",
    "refer_version varchar",
    "capabilities  varchar",
    "secret_name   varchar",
    "status        varchar",
    "last_seen_at  varchar",
    "added_at      varchar",
  ],
  "request-watchdog": [
    "id               varchar",
    "chunk_id         varchar",
    "session_id       varchar",
    "endpoint         varchar",
    "method           varchar",
    "status           varchar",
    "http_status      integer",
    "response_body    varchar",
    "attempts         integer",
    "max_attempts     integer",
    "created_at       varchar",
    "completed_at     varchar",
  ],
  "script-registry": [
    "id               varchar",
    "name             varchar",
    "type             varchar",
    "description      varchar",
    "trigger_intents  varchar",
    "status           varchar",
    "version          varchar",
    "requires_ai     boolean",
    "script_file      varchar",
    "last_run_at      varchar",
    "run_count        integer",
    "avg_duration_ms  integer",
  ],
};

// ── DuckDB helpers ─────────────────────────────────────────────────────────
import { execSync } from "child_process";

function duckdbRun(dbPath, sql) {
  try {
    execSync(`duckdb "${dbPath}" -c "${sql.replace(/"/g, '\\"').replace(/'/g, "''")}"`, {
      encoding: "utf8", timeout: 15000, stdio: ["pipe", "pipe", "pipe"],
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, err: e.message };
  }
}

function duckdbQuery(dbPath, sql) {
  try {
    const out = execSync(`duckdb "${dbPath}" -c "${sql.replace(/"/g, '\\"').replace(/'/g, "''")}" -csv`, {
      encoding: "utf8", timeout: 15000,
    });
    const lines = (out || "").trim().split("\n");
    if (lines.length < 2) return [];
    const headers = lines[0].split(",").map(h => h.trim());
    return lines.slice(1).map(line => {
      const vals = line.split(",");
      const obj = {};
      headers.forEach((h, i) => { obj[h] = vals[i] != null ? vals[i].trim() : null; });
      return obj;
    });
  } catch (e) {
    return [];
  }
}

// ── Per-dataset accessor factory ────────────────────────────────────────────
function makeDataset(name) {
  const dbPath = join(ABS_DATASETS_DIR, name, "data.duckdb");
  const dir = dirname(dbPath);

  function sqlVal(v) {
    if (v === null || v === undefined) return "NULL";
    if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
    if (typeof v === "number") return String(v);
    return `'${String(v).replace(/'/g, "''")}'`;
  }

  return {
    log(row) {
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      const keys = Object.keys(row);
      const hasId = keys.includes("id");
      const id = row.id || `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const cols = hasId ? keys : ["id", ...keys];
      const vals = cols.map(c => sqlVal(row[c] === undefined ? null : row[c]));
      const sql = `INSERT INTO logs (${cols.join(", ")}) VALUES (${vals.join(", ")});`;
      duckdbRun(dbPath, sql);
      return { ...row, id };
    },

    queryObjects(sql) {
      const out = execSync(`duckdb "${dbPath}" -c "${sql.replace(/"/g, '\\"').replace(/'/g, "''")}" -csv`, { encoding: "utf8", timeout: 15000 });
      const lines = (out || "").trim().split("\n");
      if (lines.length < 2) return [];
      // First line may be header or first data row
      const firstIsHeader = /^[a-zA-Z_]+/.test(lines[0]);
      if (firstIsHeader) {
        const headers = lines[0].split(",").map(h => h.trim());
        return lines.slice(1).map(line => {
          const vals = line.split(",");
          const obj = {};
          headers.forEach((h, i) => { obj[h] = vals[i] != null ? vals[i].trim() : null; });
          return obj;
        });
      }
      // Plain count or single value
      return lines;
    },
    query(sql)        { return duckdbQuery(dbPath, sql); },

    count() {
      const out = execSync(`duckdb "${dbPath}" -c "SELECT COUNT(*) FROM logs;" -csv`, { encoding: "utf8", timeout: 15000 });
      const val = out.trim().split("\n").pop();
      return parseInt(val, 10) || 0;
    },

    last(n = 1) { return duckdbQuery(dbPath, `SELECT * FROM logs ORDER BY rowid DESC LIMIT ${n};`); },

    columns() { return SCHEMAS[name].map(c => c.split(" ")[0]); },

    init() {
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      const colDefs = SCHEMAS[name].join(", ");
      duckdbRun(dbPath, `CREATE TABLE IF NOT EXISTS logs (${colDefs});`);
    },
  };
}

// ── Master store ─────────────────────────────────────────────────────────────
const store = {
  SCHEMAS,

  initAll() {
    const results = {};
    for (const name of Object.keys(SCHEMAS)) {
      try {
        const ds = makeDataset(name);
        ds.init();
        results[name] = "initialized";
      } catch (e) {
        results[name] = `error: ${e.message}`;
      }
    }
    // Generate camelCase accessors for every dataset
    for (const name of Object.keys(SCHEMAS)) {
      const camel = name.replace(/_([a-z])/g, (_, c) => c.toUpperCase()).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      if (!store[camel]) store[camel] = makeDataset(name);
    }
    return results;
  },

  // Fallback: store.log(row, "dataset-name")
  log(row, dataset = "chat-contracts") {
    return this[dataset.replace(/-([a-z])/g, (_, c) => c.toUpperCase())].log(row);
  },

  list() { return Object.keys(SCHEMAS); },
};

// Generate accessors immediately (before any init)
for (const name of Object.keys(SCHEMAS)) {
  const camel = name.replace(/_([a-z])/g, (_, c) => c.toUpperCase()).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  store[camel] = makeDataset(name);
}

export { store };