#!/usr/bin/env node
/**
 * INTAKE ENGINE v4 — Three-Mode + S-Expressions + Decompression
 * 
 * DISCUSS MODE:   bypasses scripts — free-form AI chat
 * MICRO MODE:    ≤1 file — fires directly, no gate
 * BUILD MODE:    full scope — satisfaction required → Build Director → compressed S-expression
 * 
 * Architecture:
 *   Human English → Intake → S-expression (compressed) → Script → S-expression output
 *                 → Decompress → Human language back to user
 */

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { decompress } from "./decompress.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPTS_DIR = join(__dirname);
const REGISTRY_FILE = join(SCRIPTS_DIR, "script-registry.json");

function detectMode(prompt) {
  const p = prompt.toLowerCase();
  if (/^\s*(add|just|quick|fix|fixing|update|change|delete|remove)\s+[\w\/]/.test(p)) return "MICRO";
  if (/^\s*(build|execute|run|lets?\s*go|do it|ship|deploy|make it|go ahead)\s/i.test(p)) return "BUILD";
  return "DISCUSS";
}

const SATISFACTION_KEYS = ["target","type","where","what","who","how","error state","success","route","file","endpoint"];

function hasSatisfaction(prompt) {
  const p = prompt.toLowerCase();
  return SATISFACTION_KEYS.some(k => p.includes(k));
}

function loadRegistry() {
  try { return JSON.parse(readFileSync(REGISTRY_FILE, "utf8")); }
  catch { return { version: "1.0", scripts: [] }; }
}

function matchScript(prompt, registry) {
  const p = prompt.toLowerCase();
  for (const entry of registry.scripts || []) {
    if ((entry.triggers || []).some(t => p.includes(t.toLowerCase()))) return entry;
  }
  return null;
}

function intentContract(prompt, mode, matched) {
  const ts = new Date().toISOString();
  if (matched) return `(intent :verb "execute" :script "${matched.script_id}" :mode "${mode}" :at "${ts}")`;
  return `(intent :verb "discuss" :mode "${mode}" :at "${ts}")`;
}

async function main(prompt) {
  if (!prompt?.trim()) {
    console.log(decompress(`(result :status "empty" :message "No prompt provided.")`));
    process.exit(0);
  }
  const mode = detectMode(prompt);
  const registry = loadRegistry();
  const matched = matchScript(prompt, registry);

  if (mode === "DISCUSS") {
    console.log(decompress(intentContract(prompt, mode, matched)));
    process.exit(0);
  }
  if (mode === "MICRO") {
    console.log(decompress(intentContract(prompt, mode, matched)));
    process.exit(0);
  }
  if (mode === "BUILD") {
    if (!hasSatisfaction(prompt)) {
      console.log(decompress(`(result :status "satisfaction_required" :message "Tell me: what exactly should it do, where, and what should happen on success vs error?")`));
      process.exit(0);
    }
    console.log(decompress(intentContract(prompt, mode, matched)));
    process.exit(0);
  }
}

main(process.argv.slice(2).join(" ")).catch(err => {
  console.log(decompress(`(result :status "error" :message "${err.message}")`));
  process.exit(1);
});
