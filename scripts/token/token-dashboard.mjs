#!/usr/bin/env node
/**
 * token-dashboard.mjs
 * Generates an HTML token dashboard with fuel gauge, session history, and alerts.
 * 
 * Usage:
 *   node scripts/token/token-dashboard.mjs [--output ./token-watch/dashboard.html]
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TRACKER_FILE = resolve(__dirname, "..", "..", "token-watch", "usage.json");
const OUTPUT_FILE = resolve(__dirname, "..", "..", "token-watch", "dashboard.html");

function loadTracker() {
  if (!existsSync(TRACKER_FILE)) return null;
  try {
    return JSON.parse(readFileSync(TRACKER_FILE, "utf8"));
  } catch { return null; }
}

function formatNum(n) {
  return n.toLocaleString();
}

function buildGaugeHTML(pct) {
  const color = pct >= 90 ? "#ef4444" : pct >= 70 ? "#f59e0b" : "#22c55e";
  const filled = Math.min(pct, 100);
  const empty = 100 - filled;
  return `
  <div class="gauge-wrap">
    <svg viewBox="0 0 120 120" class="gauge">
      <circle cx="60" cy="60" r="50" fill="none" stroke="#1e1e1e" stroke-width="10"/>
      <circle cx="60" cy="60" r="50" fill="none" stroke="${color}" stroke-width="10"
        stroke-dasharray="${(filled / 100) * 314} 314"
        stroke-linecap="round"
        transform="rotate(-90 60 60)"/>
      <text x="60" y="55" text-anchor="middle" fill="white" font-size="18" font-weight="bold">${pct.toFixed(0)}%</text>
      <text x="60" y="72" text-anchor="middle" fill="#888" font-size="10">FUEL</text>
    </svg>
  </div>`;
}

function buildSessionRows(sessions) {
  return sessions.map(s => `
  <tr>
    <td>${s.sid}</td>
    <td>${formatNum(s.input_tokens)}</td>
    <td>${formatNum(s.output_tokens)}</td>
    <td>${formatNum(s.session_total)}</td>
    <td>${s.requests}</td>
  </tr>`).join("");
}

function generate() {
  const tracker = loadTracker();
  
  if (!tracker) {
    const html = `<!DOCTYPE html><html><body style="background:#0f0f0f;color:white;font-family:sans-serif;padding:2rem">
    <h1>Token Dashboard</h1><p>No usage data yet. Start a session to populate.</p></body></html>`;
    writeFileSync(OUTPUT_FILE, html);
    return;
  }

  const total = tracker.totals.input_tokens + tracker.totals.output_tokens;
  const budget = tracker.limits?.monthly_budget || 1000000;
  const pct = Math.min((total / budget) * 100, 100);
  const alert = pct >= 80;
  const sessions = Object.entries(tracker.sessions)
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 20)
    .map(([sid, data]) => ({ sid, ...data, session_total: data.input_tokens + data.output_tokens }));

  const alertBox = alert ? `<div style="background:#7f1d1d;border:1px solid #ef4444;padding:1rem;border-radius:6px;margin-bottom:1rem">
    <strong style="color:#ef4444">⚠️ TOKEN ALERT</strong> — ${pct.toFixed(1)}% of monthly budget used.
    Consider pausing or optimizing.
  </div>` : "";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Token Fuel Dashboard</title>
<style>
  * { box-sizing: border-box; }
  body { background: #0f0f0f; color: #e5e5e5; font-family: -apple-system, sans-serif; margin: 0; padding: 1.5rem; }
  .grid { display: grid; grid-template-columns: 280px 1fr; gap: 1.5rem; max-width: 1100px; }
  .card { background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 10px; padding: 1.25rem; }
  h1 { font-size: 1.25rem; margin: 0 0 1.5rem 0; color: #fff; }
  h2 { font-size: 0.875rem; text-transform: uppercase; color: #666; margin: 0 0 1rem 0; letter-spacing: 0.05em; }
  .stat { font-size: 2rem; font-weight: 700; color: #fff; }
  .stat-label { font-size: 0.75rem; color: #666; margin-top: 0.25rem; }
  .gauge-wrap { display: flex; justify-content: center; margin: 1rem 0; }
  .gauge { width: 160px; height: 160px; }
  table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
  th { text-align: left; color: #666; border-bottom: 1px solid #2a2a2a; padding: 0.4rem 0.5rem; }
  td { color: #ccc; border-bottom: 1px solid #1a1a1a; padding: 0.4rem 0.5rem; font-variant-numeric: tabular-nums; }
  tr:last-child td { border-bottom: none; }
  .pct-bar { height: 6px; background: #2a2a2a; border-radius: 3px; margin-top: 0.5rem; }
  .pct-fill { height: 6px; background: ${pct >= 90 ? "#ef4444" : pct >= 70 ? "#f59e0b" : "#22c55e"}; border-radius: 3px; width: ${pct}%; }
  @media(max-width: 700px) { .grid { grid-template-columns: 1fr; } }
</style>
</head>
<body>
<h1>⚡ Token Fuel Dashboard</h1>
${alertBox}
<div class="grid">
  <div>
    <div class="card">
      <h2>Monthly Budget</h2>
      ${buildGaugeHTML(pct)}
      <div style="text-align:center">
        <div class="stat">${formatNum(total)}</div>
        <div class="stat-label">of ${formatNum(budget)} tokens used</div>
        <div class="pct-bar"><div class="pct-fill"></div></div>
      </div>
    </div>
    <div class="card" style="margin-top:1rem">
      <h2>Totals</h2>
      <div style="margin-bottom:0.75rem">
        <div class="stat" style="font-size:1.2rem">${formatNum(tracker.totals.input_tokens)}</div>
        <div class="stat-label">input tokens</div>
      </div>
      <div style="margin-bottom:0.75rem">
        <div class="stat" style="font-size:1.2rem">${formatNum(tracker.totals.output_tokens)}</div>
        <div class="stat-label">output tokens</div>
      </div>
      <div>
        <div class="stat" style="font-size:1.2rem">${tracker.totals.requests}</div>
        <div class="stat-label">requests</div>
      </div>
    </div>
  </div>
  <div class="card">
    <h2>Session History</h2>
    <table>
      <thead><tr><th>Session</th><th>In</th><th>Out</th><th>Total</th><th>Reqs</th></tr></thead>
      <tbody>${buildSessionRows(sessions)}</tbody>
    </table>
  </div>
</div>
</body>
</html>`;

  writeFileSync(OUTPUT_FILE, html);
  console.log(`Dashboard written to: ${OUTPUT_FILE}`);
}

// CLI
const args = process.argv.slice(2);
const outIdx = args.indexOf("--output");
if (outIdx !== -1 && args[outIdx + 1]) {
  // Override output path (not persisted here, just pass through)
}
generate();