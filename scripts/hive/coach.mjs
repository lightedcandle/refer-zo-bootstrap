#!/usr/bin/env node
/**
 * hive/coach.mjs — Coaching engine for intake
 *
 * COACH mode: coaching queries — scriptionary first, gap logging, talkback queued
 *
 * Flow:
 *   1. Classify query type
 *   2. Check scriptionary for existing script coverage
 *   3. If gap found → log evolution, queue talkback, return with needs_script=true
 *   4. If covered → return script reference with guidance
 */

import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATASETS = join(__dirname, "../../datasets");

// ── Coach triggers (read-only, shared with compress-prompt) ───────────────────
export const COACH_TRIGGERS = /^(how\s+(do|can|should|would|to)|what('s|\sis|\sshould|\sare|\smy)|why\s+(did|doesn)|can\s+I|where\s+(should|do|can)|when\s+(should|would))/gi;

const COACH_TERMS = ["how do", "how can", "how should", "what is", "what are", "why did", "can i", "where should", "when should"];

// ── Query classification ──────────────────────────────────────────────────────
const QUERY_PATTERNS = [
  { type: "how-to",      patterns: [/^how\s+(do|can|should|would|to)/i] },
  { type: "what-is",     patterns: [/^what('s|\sis|\sshould|\sare|\smy)/i] },
  { type: "why",         patterns: [/^why\s+(did|doesn|do|would)/i] },
  { type: "where",       patterns: [/^where\s+(should|do|can)/i] },
  { type: "when",        patterns: [/^when\s+(should|would|do)/i] },
  { type: "can-i",       patterns: [/^can\s+I/i] },
  { type: "teach-me",    patterns: [/^teach\s+(me|i)/i, /^explain\s+(me|i)/i, /^show\s+(me|i)/i] },
];

function classify(query) {
  for (const { type, patterns } of QUERY_PATTERNS) {
    if (patterns.some(p => p.test(query))) return type;
  }
  return "general";
}

// ── Scriptionary check ──────────────────────────────────────────────────────
async function checkScriptionary(queryType) {
  try {
    const DIC_PATH = join(__dirname, "../factory/scriptionary.json");
    if (!existsSync(DIC_PATH)) return { found: false };
    const dic = JSON.parse(readFileSync(DIC_PATH, "utf8"));
    // Check if we have an entry for this query type
    const keys = Object.keys(dic).map(k => k.toLowerCase());
    const found = keys.some(k => k.includes(queryType) || queryType.includes(k));
    return { found, entries: keys };
  } catch {
    return { found: false };
  }
}

// ── DuckDB helpers ────────────────────────────────────────────────────────────
function dbPath(dataset) {
  return join(DATASETS, dataset, "data.duckdb");
}

function runDbQuery(db, sql) {
  return new Promise((resolve, reject) => {
    const proc = spawn("duckdb", [db, "-c", sql]);
    let out = "", err = "";
    proc.stdout.on("data", c => out += c);
    proc.stderr.on("data", c => err += c);
    proc.on("close", code => code === 0 ? resolve(out) : reject(new Error(err || sql)));
  });
}

async function safeAppend(table, row) {
  const cols = Object.keys(row).join(", ");
  // Escape values for SQL — simple version
  const vals = Object.values(row).map(v => {
    if (v === null || v === undefined) return "NULL";
    if (typeof v === "number") return v;
    if (typeof v === "string") return `'${v.replace(/'/g, "''")}'`;
    return `'${JSON.stringify(v).replace(/'/g, "''")}'`;
  }).join(", ");
  return `${table} (${cols}) VALUES (${vals})`;
}

// ── Main coach function ───────────────────────────────────────────────────────
export async function coach(query, sessionId = "local-cli") {
  const classification = classify(query);
  const dic = await checkScriptionary(classification);

  let response, source, resolved;
  const note = [];

  if (dic.found) {
    response = { answer: "covered", classification, source: "scriptionary" };
    source = "scriptionary";
    resolved = true;
    note.push("Query type covered in scriptionary");
  } else {
    response = {
      answer: "gap",
      classification,
      source: "generated",
      gap: true,
      needs_script: true,
      note: `No scriptionary entry for '${classification}'. Gap logged.`
    };
    source = "generated";
    resolved = false;
    note.push("No scriptionary entry — gap detected");
  }

  // Log to evolution-log
  try {
    const evoDb = dbPath("evolution-log");
    if (existsSync(evoDb)) {
      const id = `coach_${Date.now()}`;
      const sql = `INSERT INTO "evolution-log" (id, session_id, source, origin, outcome, mode, notes) VALUES ('${id}', '${sessionId}', 'coach', '${classification}', '${resolved ? 'resolved' : 'gap'}', 'COACH', '${note.join("; ").replace(/'/g, "''")}');`;
      await runDbQuery(evoDb, sql);
    }
  } catch (e) {
    console.log(`[coach] Evolution log failed: ${e.message}`);
  }

  // Queue talkback for gaps — use actual schema: id, queued_at, msg, retries, last_error
  if (!resolved) {
    try {
      const qDb = dbPath("talkback-queue");
      if (existsSync(qDb)) {
        const payload = JSON.stringify({ query, classification, gap: true, needs_script: true });
        const ts = new Date().toISOString().replace('T', ' ').slice(0, 19);
        const id = Math.abs(Date.now() % 2147483647);  // INT32-safe
        const sql = `INSERT INTO talkback_queue (id, msg, queued_at, retries, last_error) VALUES (${id}, '${payload.replace(/'/g, "''")}', '${ts}', 0, NULL);`;
        await runDbQuery(qDb, sql);
        note.push("Talkback queued");
      }
    } catch (e) {
      console.log(`[coach] Queue failed: ${e.message}`);
    }
  }

  return { ...response, notes: note };
}

// ── Exportable helpers ────────────────────────────────────────────────────────
export function getCoachTriggers() {
  return [...COACH_TERMS];
}

export function getCoachTerms() {
  return COACH_TERMS;
}

export { classify, COACH_TERMS }; // named import for compress-prompt

// ── CLI ──────────────────────────────────────────────────────────────────────
const query = process.argv.slice(2).join(" ") || "";
if (!query) {
  console.log("Usage: node coach.mjs \"<query>\"");
  process.exit(0);
}

coach(query, "cli").then(r => {
  console.log(JSON.stringify(r, null, 2));
});