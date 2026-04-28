/**
 * INTAKE ENGINE v3 — Three-Mode with Satisfaction Block
 * 
 * DISCUSS MODE: Free-flow. Script bypass. No execution.
 * MICRO MODE: Small/fast/reversible. Script fires directly.
 * BUILD MODE: Full vision required. Satisfaction block. Build Director executes.
 */

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REGISTRY_FILE = join(__dirname, "script-registry.json");

// ── Micro threshold ──────────────────────────────────────────────
const MICRO_MAX_SECONDS = 5 * 60;  // ≤ 5 minutes
const MICRO_MAX_FILES   = 1;       // ≤ 1 new file
const MICRO_REVERSIBLE  = true;    // must be reversible

// ── Helpers ───────────────────────────────────────────────────────
function loadRegistry() {
  try {
    return JSON.parse(readFileSync(REGISTRY_FILE, "utf8"));
  } catch {
    return { scripts: [] };
  }
}

function detectMode(intent, registry) {
  const lower = intent.toLowerCase();
  const hasBuild = /\b(build|execute|start|go|let's do|ship|codegen)\b/i.test(lower);
  const hasDiscuss = /\b(discuss|explore|think|sketch|maybe|what if|try this)\b/i.test(lower);
  const hasMicro = /\b(add|just|quick|simple|button|label|text|fix|rename|change)\b/i.test(lower);

  if (hasBuild) return "BUILD";
  if (hasDiscuss) return "DISCUSS";
  if (hasMicro) return "MICRO";
  return "DISCUSS"; // default
}

function matchScript(intent, registry) {
  const words = intent.toLowerCase().split(/\s+/);
  const scores = registry.scripts.map(s => {
    const keywords = (s.trigger?.join(" ") + " " + s.id).toLowerCase();
    let score = 0;
    for (const w of words) {
      if (w.length > 2 && keywords.includes(w)) score++;
    }
    return { ...s, score };
  });
  scores.sort((a, b) => b.score - a.score);
  return scores[0]?.score > 0 ? scores[0] : null;
}

function classifyIntent(intent) {
  const words = intent.toLowerCase().split(/\s+/);
  const fileCount = words.filter(w => /\.(jsx|tsx|ts|js|mjs|css|html|json|md)$/i.test(w)).length || 1;
  const hasNew = /\b(add|create|new|build|implement|make)\b/i.test(intent);
  return { fileCount, hasNew };
}

// ── Main ──────────────────────────────────────────────────────────
function main(argv) {
  const intent = argv.slice(2).join(" ") || "";
  if (!intent) {
    console.log("Usage: node intake-engine.mjs \"<intent>\" [--run]");
    console.log("Modes: DISCUSS | MICRO | BUILD");
    process.exit(0);
  }

  const registry = loadRegistry();
  const mode = detectMode(intent, registry);

  console.log(`\n🟡 Mode: ${mode}`);
  console.log(`📝 Intent: ${intent}`);

  if (mode === "DISCUSS") {
    console.log("\n[DISCUSS] Script bypass. Free-flow planning. No execution.");
    console.log("→ Stay in conversation. Add satisfaction block. Then say 'build'.");
  }

  if (mode === "MICRO") {
    const script = matchScript(intent, registry);
    const { fileCount, hasNew } = classifyIntent(intent);
    const isMicro = !hasNew || (fileCount <= MICRO_MAX_FILES && hasNew);

    if (script && isMicro) {
      console.log(`\n[MICRO] Direct script execution:`);
      console.log(`→ ${script.id}: ${script.name}`);
      if (argv.includes("--run")) {
        console.log(`⚡ Running: node scripts/factory/artifacts/${script.file}`);
      } else {
        console.log(`⚡ Pass --run to execute`);
      }
    } else {
      console.log("\n[MICRO] No matching script found for this micro-action.");
      console.log("→ This is too ambiguous for direct execution. Say 'build' when ready.");
    }
  }

  if (mode === "BUILD") {
    const script = matchScript(intent, registry);
    console.log("\n[BUILD] Satisfaction block required.");
    if (script) {
      console.log(`Matched script: ${script.id}`);
      console.log("→ Confirm the full vision, then say 'execute' to trigger Build Director.");
    } else {
      console.log("No script matched. Define vision completely, then say 'execute'.");
    }
    console.log("\nSatisfaction block must include:");
    console.log("  1. WHAT — full deliverable (not incremental)");
    console.log("  2. SUCCESS CRITERIA — done and done right");
    console.log("  3. SCOPE BOUNDARIES — what's NOT included");
    console.log("  4. CONTEXT — enough for script to execute without questions");
  }
}

main(process.argv).catch(err => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
