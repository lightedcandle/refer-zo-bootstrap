#!/usr/bin/env node
/**
 * token-tracker.mjs
 * Tracks token usage per session and accumulates totals.
 * 
 * Usage:
 *   node scripts/token/token-tracker.mjs --input "text" [--output "text"]
 *   node scripts/token/token-tracker.mjs --stats
 *   node scripts/token/token-tracker.mjs --reset
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TRACKER_DIR = resolve(__dirname, "..", "..", "token-watch");
const TRACKER_FILE = resolve(TRACKER_DIR, "usage.json");

// ~4 chars per token for English (OpenAI approximation)
const CHARS_PER_TOKEN = 4;

function estimateTokens(text) {
  return Math.ceil((text || "").length / CHARS_PER_TOKEN);
}

function loadTracker() {
  if (!existsSync(TRACKER_FILE)) {
    return {
      sessions: {},
      totals: { input_tokens: 0, output_tokens: 0, requests: 0 },
      limits: { monthly_budget: 1000000, alert_threshold: 0.8 },
      updated_at: new Date().toISOString()
    };
  }
  try {
    return JSON.parse(readFileSync(TRACKER_FILE, "utf8"));
  } catch {
    return { sessions: {}, totals: { input_tokens: 0, output_tokens: 0, requests: 0 }, limits: {}, updated_at: new Date().toISOString() };
  }
}

function saveTracker(data) {
  mkdirSync(TRACKER_DIR, { recursive: true });
  data.updated_at = new Date().toISOString();
  writeFileSync(TRACKER_FILE, JSON.stringify(data, null, 2));
}

function sessionId() {
  const d = new Date();
  return `${d.toISOString().slice(0, 10)}-${d.getHours()}h`;
}

function addUsage(inputText, outputText, metadata = {}) {
  const tracker = loadTracker();
  const sid = sessionId();
  const inputTokens = estimateTokens(inputText);
  const outputTokens = estimateTokens(outputText);

  if (!tracker.sessions[sid]) {
    tracker.sessions[sid] = { input_tokens: 0, output_tokens: 0, requests: 0, windows: [] };
  }

  tracker.sessions[sid].input_tokens += inputTokens;
  tracker.sessions[sid].output_tokens += outputTokens;
  tracker.sessions[sid].requests += 1;

  tracker.totals.input_tokens += inputTokens;
  tracker.totals.output_tokens += outputTokens;
  tracker.totals.requests += 1;

  // Estimate cost (approx, assume $0.01 per 1K tokens average)
  const estimatedCost = (tracker.totals.input_tokens + tracker.totals.output_tokens) * 0.00001;
  tracker.totals.estimated_cost_usd = parseFloat(estimatedCost.toFixed(4));

  saveTracker(tracker);

  return {
    session: sid,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    total_so_far: tracker.totals.input_tokens + tracker.totals.output_tokens,
    estimated_cost_usd: tracker.totals.estimated_cost_usd
  };
}

function getStats() {
  const tracker = loadTracker();
  const total = tracker.totals.input_tokens + tracker.totals.output_tokens;
  const budget = tracker.limits?.monthly_budget || 1000000;
  const pct = Math.min((total / budget) * 100, 100);
  const alertThreshold = tracker.limits?.alert_threshold || 0.8;

  // Session summary (last 10)
  const sessions = Object.entries(tracker.sessions)
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 10)
    .map(([sid, data]) => ({ sid, ...data, session_total: data.input_tokens + data.output_tokens }));

  return {
    totals: tracker.totals,
    budget,
    used_pct: parseFloat(pct.toFixed(1)),
    alert: pct >= (alertThreshold * 100),
    sessions
  };
}

function reset() {
  saveTracker({ sessions: {}, totals: { input_tokens: 0, output_tokens: 0, requests: 0 }, limits: {}, updated_at: new Date().toISOString() });
  console.log("Token tracker reset.");
}

// CLI
const args = process.argv.slice(2);
if (args.includes("--stats")) {
  const stats = getStats();
  console.log(JSON.stringify(stats, null, 2));
} else if (args.includes("--reset")) {
  reset();
} else {
  // Add usage
  let inputText = "";
  let outputText = "";
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--input" && args[i + 1]) inputText = args[++i];
    if (args[i] === "--output" && args[i + 1]) outputText = args[++i];
  }
  const result = addUsage(inputText, outputText);
  console.log(JSON.stringify(result, null, 2));
}