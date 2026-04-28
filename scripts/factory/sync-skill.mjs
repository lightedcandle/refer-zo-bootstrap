#!/usr/bin/env node
/**
 * sync-skill.mjs
 * Syncs a single skill from the repo to Zo Files.
 * 
 * Usage:
 *   node scripts/factory/sync-skill.mjs --skill refer-os
 *   node scripts/factory/sync-skill.mjs --skill refer-zo-intake-router --dry
 */

import { existsSync, cpSync, readFileSync } from "node:fs";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..", "..");
const SKILLS_DIR = join(REPO_ROOT, "skills");

function parseArgs(argv) {
  const out = { skill: null, dry: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--skill" && argv[i + 1]) out.skill = argv[++i];
    if (argv[i] === "--dry") out.dry = true;
  }
  return out;
}

async function main(argv) {
  const { skill, dry } = parseArgs(argv);

  if (!skill) {
    console.error("Usage: node scripts/factory/sync-skill.mjs --skill <name> [--dry]");
    process.exit(1);
  }

  const src = join(SKILLS_DIR, skill);
  const dest = join(process.env.ZO_WORKSPACE_ROOT || "/home/workspace", "Skills", skill);

  if (!existsSync(src)) {
    console.error(`Skill not found: ${skill}`);
    process.exit(1);
  }

  const skillFile = join(src, "SKILL.md");
  if (!existsSync(skillFile)) {
    console.error(`SKILL.md not found in: ${src}`);
    process.exit(1);
  }

  const content = readFileSync(skillFile, "utf8");
  const descMatch = content.match(/^description:\s*(.+)$/m);
  const desc = descMatch ? descMatch[1] : "No description";

  console.log(`Skill: ${skill}`);
  console.log(`Description: ${desc}`);
  console.log(`Source: ${src}`);
  console.log(`Destination: ${dest}`);
  console.log(`Mode: ${dry ? "DRY RUN (no files written)" : "SYNC"}`);

  if (!dry) {
    cpSync(src, dest, { recursive: true, overwrite: true });
    console.log(`✅ Skill '${skill}' synced.`);
  }
}

main(process.argv.slice(2)).catch(err => {
  console.error(`Sync failed: ${err.message}`);
  process.exit(1);
});