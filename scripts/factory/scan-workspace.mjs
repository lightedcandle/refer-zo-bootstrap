#!/usr/bin/env node
/**
 * scan-workspace.mjs
 * Scans the workspace and emits a compact code tree for AI context.
 * 
 * Usage:
 *   node scripts/factory/scan-workspace.mjs [--path /home/workspace] [--output /tmp/tree.json]
 */

import { readdirSync, statSync, existsSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const IGNORE_DIRS = new Set([
  "node_modules", ".git", ".next", "dist", ".cache", ".tmp", 
  "__pycache__", ".venv", "venv", ".env", "Trash", ".DS_Store"
]);

const IGNORE_EXT = new Set(["lock", "map", "pyc", "class"]);

function scan(dir, depth = 0, maxDepth = 4) {
  if (depth > maxDepth) return null;
  const entries = [];
  try {
    const items = readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
      if (IGNORE_DIRS.has(item.name)) continue;
      const full = join(dir, item.name);
      if (item.isDirectory()) {
        const children = scan(full, depth + 1, maxDepth);
        if (children) entries.push({ type: "dir", name: item.name, children });
      } else {
        const ext = item.name.split(".").pop()?.toLowerCase() || "";
        if (IGNORE_EXT.has(ext)) continue;
        const size = statSync(full).size;
        entries.push({ type: "file", name: item.name, size_kb: Math.round(size / 1024) });
      }
    }
  } catch { /* skip inaccessible */ }
  return entries;
}

function parseArgs(argv) {
  let path = null, output = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--path" && argv[i + 1]) path = argv[++i];
    if (argv[i] === "--output" && argv[i + 1]) output = argv[++i];
  }
  return { 
    path: resolve(path || process.env.ZO_WORKSPACE_ROOT || "/home/workspace"),
    output
  };
}

async function main(argv) {
  const { path: scanPath, output } = parseArgs(argv);
  console.log(`Scanning: ${scanPath}`);

  const tree = {
    root: scanPath,
    scanned_at: new Date().toISOString(),
    tree: scan(scanPath)
  };

  const json = JSON.stringify(tree, null, 2);
  
  if (output) {
    const { writeFileSync } = await import("node:fs");
    writeFileSync(output, json);
    console.log(`Tree written to: ${output}`);
  } else {
    console.log(json);
  }
}

main(process.argv.slice(2)).catch(err => {
  console.error(`Scan failed: ${err.message}`);
  process.exit(1);
});