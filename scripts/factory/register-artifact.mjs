#!/usr/bin/env node
/**
 * register-artifact.mjs
 * Registers a successful artifact for future reuse.
 * 
 * Usage:
 *   node scripts/factory/register-artifact.mjs --kind "zo-space-route" --name "admin-dashboard" --path /home/workspace/admin/index.tsx --tags "admin,dashboard" --notes "Basic admin layout with sidebar"
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REGISTRY_DIR = join(__dirname, "..", "..", "refer-artifacts");
const REGISTRY_FILE = join(REGISTRY_DIR, "artifact-registry.json");

function parseArgs(argv) {
  const out = { kind: null, name: null, path: null, tags: [], notes: "" };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--kind" && argv[i + 1]) out.kind = argv[++i];
    if (argv[i] === "--name" && argv[i + 1]) out.name = argv[++i];
    if (argv[i] === "--path" && argv[i + 1]) out.path = argv[++i];
    if (argv[i] === "--tags" && argv[i + 1]) out.tags = argv[++i].split(",").map(t => t.trim());
    if (argv[i] === "--notes" && argv[i + 1]) out.notes = argv[++i];
  }
  return out;
}

function loadRegistry() {
  if (!existsSync(REGISTRY_FILE)) return { artifacts: [], updated_at: null };
  try {
    return JSON.parse(readFileSync(REGISTRY_FILE, "utf8"));
  } catch { return { artifacts: [], updated_at: null }; }
}

function saveRegistry(reg) {
  mkdirSync(REGISTRY_DIR, { recursive: true });
  reg.updated_at = new Date().toISOString();
  writeFileSync(REGISTRY_FILE, JSON.stringify(reg, null, 2));
}

async function main(argv) {
  const { kind, name, path, tags, notes } = parseArgs(argv);

  if (!kind || !name) {
    console.error("Usage: node scripts/factory/register-artifact.mjs --kind <type> --name <id> --path <file> [--tags tag1,tag2] [--notes 'description']");
    process.exit(1);
  }

  const reg = loadRegistry();
  const artifact = {
    id: `${kind}/${name}`.replace(/\s+/g, "-").toLowerCase(),
    kind,
    name,
    path: path || null,
    tags,
    notes,
    registered_at: new Date().toISOString(),
    use_count: 0
  };

  // Replace if exists, else add
  const idx = reg.artifacts.findIndex(a => a.id === artifact.id);
  if (idx >= 0) {
    reg.artifacts[idx] = { ...reg.artifacts[idx], ...artifact, use_count: reg.artifacts[idx].use_count + 1 };
    console.log(`Updated artifact: ${artifact.id}`);
  } else {
    reg.artifacts.push(artifact);
    console.log(`Registered artifact: ${artifact.id}`);
  }

  saveRegistry(reg);
  console.log(`Total artifacts: ${reg.artifacts.length}`);
}

main(process.argv.slice(2)).catch(err => {
  console.error(`Register failed: ${err.message}`);
  process.exit(1);
});