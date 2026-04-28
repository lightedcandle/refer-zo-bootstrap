#!/usr/bin/env node
/**
 * emit-contract.mjs
 * Derives a Send Contract from a Plan markdown file.
 * Script-first: reads the plan, extracts bounded truth, emits machine-readable contract.
 * 
 * Usage:
 *   node scripts/factory/emit-contract.mjs --plan ./plan.md
 *   node scripts/factory/emit-contract.mjs --plan ./plan.md --output ./contract.json
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  let planPath = null, output = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--plan" && argv[i + 1]) planPath = argv[++i];
    if (argv[i] === "--output" && argv[i + 1]) output = argv[++i];
  }
  return { planPath, output };
}

function extractTargets(text) {
  // Look for file paths, route names, component names
  const lines = text.split("\n");
  const targets = [];
  const inScope = [], outScope = [];
  let phase = "body";

  for (const line of lines) {
    const trimmed = line.trim();
    if (/^##?\s*Scope$/i.test(trimmed) || /^##?\s*In\s*\(/i.test(trimmed)) { phase = "in"; continue; }
    if (/^##?\s*Out\s*\(scope\)/i.test(trimmed)) { phase = "out"; continue; }
    if (/^##?\s*Target/i.test(trimmed)) { phase = "target"; continue; }
    
    if (phase === "in" && trimmed.match(/^[-*]\s+/)) inScope.push(trimmed.replace(/^[-*]\s+/, ""));
    if (phase === "out" && trimmed.match(/^[-*]\s+/)) outScope.push(trimmed.replace(/^[-*]\s+/, ""));
    if (phase === "target" && trimmed.match(/^[#>-]?\s*(file|route|component|table):?\s*/i)) {
      targets.push(trimmed.replace(/^[#>-]?\s*(file|route|component|table):?\s*/i, "").trim());
    }
  }
  return { inScope, outScope, targets };
}

function extractTitle(text) {
  const match = text.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : "Untitled Contract";
}

function extractConstraints(text) {
  const constraints = [];
  const lines = text.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^[-*]\s+[!*]?\s*(no|not|never|must not|do not)/i.test(trimmed)) {
      constraints.push(trimmed.replace(/^[-*]\s+/, ""));
    }
  }
  return constraints;
}

function emit(text) {
  const title = extractTitle(text);
  const { inScope, outScope, targets } = extractTargets(text);
  const constraints = extractConstraints(text);
  const lines = text.split("\n");
  
  // Extract acceptance criteria
  const criteria = [];
  for (const line of lines) {
    if (/^[#-]*\s*acceptance|success criteria|criteria:/i.test(line)) {
      criteria.push(line.replace(/^[#-]*\s*/i, "").trim());
    }
  }

  return {
    title,
    created_at: new Date().toISOString(),
    in_scope: inScope,
    out_scope: outScope,
    targets: targets.filter(Boolean),
    constraints,
    acceptance_criteria: criteria,
    status: "emitted",
    version: "1.0"
  };
}

async function main(argv) {
  const { planPath, output } = parseArgs(argv);

  if (!planPath) {
    console.error("Usage: node scripts/factory/emit-contract.mjs --plan <path> [--output <path>]");
    process.exit(1);
  }

  if (!existsSync(planPath)) {
    console.error(`Plan not found: ${planPath}`);
    process.exit(1);
  }

  console.log(`Reading plan: ${planPath}`);
  const text = readFileSync(planPath, "utf8");
  const contract = emit(text);

  const json = JSON.stringify(contract, null, 2);
  
  if (output) {
    writeFileSync(output, json);
    console.log(`Contract written to: ${output}`);
  } else {
    console.log(json);
  }
}

main(process.argv.slice(2)).catch(err => {
  console.error(`Emit failed: ${err.message}`);
  process.exit(1);
});