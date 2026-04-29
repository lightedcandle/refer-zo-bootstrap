/**
 * hive-talkback.mjs — Hive connectivity + talkback queue
 * 
 * Manages two concerns:
 * 1. CONNECTIVITY TEST — is Hive reachable right now?
 * 2. TALKBACK QUEUE    — if not reachable, queue outbound messages
 *                        for later delivery when Hive wakes
 *
 * Queue lives in datasets/talkback-queue/ (DuckDB-backed, gitignored).
 * Hive is expected at HIVE_API_URL (default: apostlej's Zo Space /api/hive).
 *
 * Usage:
 *   node hive-talkback.mjs --check      # connectivity test only
 *   node hive-talkback.mjs --queue msg  # add message to queue
 *   node hive-talkback.mjs --drain       # attempt to flush queue
 *   node hive-talkback.mjs --status     # show queue depth
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT  = join(__dirname, "..", "..");
const HIVE_API   = process.env.HIVE_API_URL || "https://api.zo.computer/mcp";
const QUEUE_DB   = join(REPO_ROOT, "datasets", "talkback-queue", "data.duckdb");
const QUEUE_DIR  = join(REPO_ROOT, "datasets", "talkback-queue");
const MAX_RETRIES = 3;
const RETRY_DELAY  = 2000; // ms between retries

const require = createRequire(import.meta.url);

// ── DuckDB helpers ──────────────────────────────────────────────
function dbQuery(sql, params = []) {
  const { execSync } = require("node:child_process");
  const tmp = `/tmp/talkback_${Date.now()}.sql`;
  writeFileSync(tmp, sql);
  try {
    let result = execSync(`duckdb "${QUEUE_DB}" < "${tmp}" 2>/dev/null`, { encoding: "utf8" });
    unlinkSync(tmp);
    return result;
  } catch (e) {
    return e.stdout || "";
  }
}

function initQueue() {
  if (!existsSync(QUEUE_DIR)) mkdirSync(QUEUE_DIR, { recursive: true });
  dbQuery(`
    CREATE TABLE IF NOT EXISTS talkback_queue (
      id          INTEGER PRIMARY KEY,
      queued_at   TEXT    NOT NULL,
      msg         TEXT    NOT NULL,
      retries     INTEGER DEFAULT 0,
      last_error  TEXT
    );
  `);
}

// ── Connectivity test ─────────────────────────────────────────
export async function hivePing(headers) {
  if (!headers) {
    // CLI mode — init session
    const initResp = await fetch(HIVE_API, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.ZO_COMPUTER_REFER || ""}` },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize",
        params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "hive-talkback", version: "1.0.0" } } })
    });
    const sid = initResp.headers.get("mcp-session-id") || initResp.headers.get("Mcp-Session-Id");
    headers = { "Content-Type": "application/json", Authorization: `Bearer ${process.env.ZO_COMPUTER_REFER || ""}`, "mcp-session-id": sid };
  }
  try {
    const resp = await fetch(HIVE_API, {
      method: "POST",
      headers,
      body: JSON.stringify({
        jsonrpc: "2.0", id: Date.now(), method: "tools/call",
        params: { name: "list_space_routes", arguments: {} }
      }),
      signal: AbortSignal.timeout(5000)
    });
    return resp.ok;
  } catch {
    return false;
  }
}

// ── Queue management ──────────────────────────────────────────
function queueMessage(msg) {
  initQueue();
  dbQuery(`INSERT INTO talkback_queue (queued_at, msg, retries) VALUES (datetime('now'), '${msg.replace(/'/g, "''")}', 0);`);
}

export function drainQueue(headers) {
  initQueue();
  const rows = dbQuery(`SELECT id, msg FROM talkback_queue ORDER BY queued_at ASC;`);
  const lines = rows.trim().split("\n").filter(l => l.trim());
  if (lines.length <= 1) return { drained: 0, failed: 0 };
  
  let drained = 0, failed = 0;
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split("|").map(s => s.trim());
    const id = parseInt(parts[0]);
    const msg = parts[1];
    if (!id || !msg) continue;
    
    try {
      const resp = fetch(HIVE_API, {
        method: "POST", headers,
        body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method: "tools/call",
          params: { name: "create_or_rewrite_file",
            arguments: { target_file: "/home/refer-hive/talkback.json", content: msg } }
        }),
        signal: AbortSignal.timeout(8000)
      });
      if (resp.ok) {
        dbQuery(`DELETE FROM talkback_queue WHERE id = ${id};`);
        drained++;
      } else {
        dbQuery(`UPDATE talkback_queue SET retries = retries + 1, last_error = 'http_${resp.status}' WHERE id = ${id};`);
        failed++;
      }
    } catch (e) {
      dbQuery(`UPDATE talkback_queue SET retries = retries + 1, last_error = '${e.message.replace(/'/g, "''")}' WHERE id = ${id};`);
      failed++;
    }
  }
  return { drained, failed };
}

function queueDepth() {
  initQueue();
  const rows = dbQuery(`SELECT count(*) as cnt FROM talkback_queue;`);
  const line = rows.trim().split("\n").find(l => l.includes("│"));
  return line ? parseInt(line.split("│")[1].trim()) : 0;
}

// ── CLI ───────────────────────────────────────────────────────
const [cmd, ...args] = process.argv.slice(2);

async function main() {
  // Always init session for auth
  const initResp = await fetch(HIVE_API, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.ZO_COMPUTER_REFER || ""}` },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize",
      params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "hive-talkback", version: "1.0.0" } } })
  });
  const sessionId = initResp.headers.get("mcp-session-id") || initResp.headers.get("Mcp-Session-Id");
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${process.env.ZO_COMPUTER_REFER || ""}`, "mcp-session-id": sessionId };

  switch (cmd) {
    case "--check": {
      const ok = await hivePing(headers);
      console.log(ok ? "✓ Hive reachable" : "✗ Hive unreachable — messages will queue");
      process.exit(ok ? 0 : 1);
      break;
    }
    case "--queue": {
      const msg = args.join(" ");
      queueMessage(msg);
      console.log(`✓ Queued: ${msg.slice(0, 60)}`);
      break;
    }
    case "--drain": {
      console.log(`Draining queue...`);
      const { drained, failed } = drainQueue(headers);
      console.log(`Drained: ${drained} | Failed: ${failed}`);
      break;
    }
    case "--status": {
      const depth = queueDepth();
      console.log(`Queue depth: ${depth}`);
      process.exit(depth > 0 ? 1 : 0);
      break;
    }
    default: {
      console.log(`Usage: node hive-talkback.mjs [--check|--queue <msg>|--drain|--status]`);
      process.exit(1);
    }
  }
}

// Only run CLI when executed directly, not imported
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(err => { console.error(err.message); process.exit(1); });
}