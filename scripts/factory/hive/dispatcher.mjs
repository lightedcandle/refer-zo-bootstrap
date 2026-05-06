#!/usr/bin/env node
/**
 * @opcodes ['FETCH_CHUNKS', 'VALIDATE_PAYLOAD', 'DISPATCH_TO_ZO']
 * @trigger dispatch chunks
 * @description Pulls pending chunks from a cell and dispatches them for execution
 * @forge-type orchestrator
 * @forge-name Hive Dispatcher
 * @forge-id hive-dispatcher
 *
 * dispatcher.mjs — Hive Factory Dispatcher
 *
 * Packages and ships refer-zo-bootstrap to downstream nodes.
 * Runs on Hive Factory (Telechurch) only.
 *
 * Usage:
 *   node dispatcher.mjs package --type hive      # build hive-bootstrap.tar.gz
 *   node dispatcher.mjs package --type cell      # build cell-bootstrap.tar.gz
 *   node dispatcher.mjs list                     # show pending dispatches
 *   node dispatcher.mjs ship --node <id>         # ship pending dispatches
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, cpSync, rmSync, readdirSync, statSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..", "..", "..");
const DISPATCH_DIR = join(REPO_ROOT, "datasets", "hive-factory-dispatch");
const TEMP_DIR = join(tmpdir(), `refer-zo-bootstrap-dispatch-${process.pid}`);
const PKG_DIR = join(__dirname, "packages");

const PRIVATE_HIVE_FILES = [
  "scripts/factory/hive/api.mjs",
  "scripts/factory/hive/talkback.mjs",
  "scripts/factory/hive/manifest.json",
  "scripts/factory/hive/nodes.json",
  "scripts/factory/hive/self.json",
];

const HIVE_STRIP_PATTERNS = [
  ".git",
  "scripts/factory/hive/api.mjs",    // private API
  "scripts/factory/hive/talkback.mjs", // private talkback
  "scripts/factory/hive/nodes.json",  // private peer list
  "scripts/factory/hive/self.json",   // private identity
  "datasets/node-identity",
  "scripts/factory/tools",           // factory build tools
  "scripts/factory/artifacts",        // factory dev artifacts
];

const CELL_STRIP_PATTERNS = [
  ".git",
  "scripts/factory/hive",
  "scripts/factory/factory.mjs",     // factory CLI (not needed in cell)
  "scripts/factory/tools",
  "scripts/factory/artifacts",
  "datasets/node-identity",
  "datasets/hive-factory-dispatch",
  "datasets/request-watchdog",
];

function checksum(file) {
  return createHash("sha256").update(readFileSync(file)).digest("hex").slice(0, 16);
}

function writeDispatchLog(entry) {
  mkdirSync(DISPATCH_DIR, { recursive: true });
  const logFile = join(DISPATCH_DIR, "dispatch-log.jsonl");
  writeFileSync(logFile, JSON.stringify(entry) + "\n", { flag: "a" });
}

function loadDispatchLog() {
  const logFile = join(DISPATCH_DIR, "dispatch-log.jsonl");
  if (!existsSync(logFile)) return [];
  return readFileSync(logFile, "utf8").trim().split("\n").filter(Boolean).map(JSON.parse);
}

function shouldStrip(path, patterns) {
  const normalized = path.replace(/\\/g, "/");
  return patterns.some(p => normalized.includes(p));
}

function listFiles(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const rel = relative(REPO_ROOT, path).replace(/\\/g, "/");
    if (rel === ".git" || rel.startsWith(".git/") || rel === "node_modules" || rel.startsWith("node_modules/")) continue;
    if (rel.includes("scripts/factory/hive/packages/")) continue;
    const stat = statSync(path);
    if (stat.isDirectory()) listFiles(path, out);
    else if (stat.isFile()) out.push(path);
  }
  return out;
}

async function buildPackage(type) {
  const stripPatterns = type === "hive" ? HIVE_STRIP_PATTERNS : CELL_STRIP_PATTERNS;
  const outName = `${type}-bootstrap-${new Date().toISOString().slice(0, 10)}`;

  console.log(`\n🧩 Building ${type} bootstrap package...\n`);

  // Clean temp
  rmSync(TEMP_DIR, { recursive: true, force: true });
  mkdirSync(TEMP_DIR, { recursive: true });
  mkdirSync(PKG_DIR, { recursive: true });

  // Copy repo, stripping private files
  const stagedRoot = join(TEMP_DIR, "refer-zo-bootstrap");
  cpSync(REPO_ROOT, stagedRoot, {
    recursive: true,
    filter: (src) => {
      const rel = relative(REPO_ROOT, src).replace(/\\/g, "/");
      if (!rel) return true;
      if (rel === ".git" || rel.startsWith(".git/")) return false;
      if (rel === "node_modules" || rel.startsWith("node_modules/")) return false;
      if (rel.startsWith("scripts/factory/hive/packages/")) return false;
      return true;
    },
  });

  // Remove stripped files
  const allFiles = listFiles(stagedRoot);

  for (const file of allFiles) {
    const rel = relative(stagedRoot, file).replace(/\\/g, "/");
    if (shouldStrip(rel, stripPatterns)) {
      rmSync(file, { force: true });
    }
  }

  // Add package manifest
  const manifest = {
    package_type: type,
    created_at: new Date().toISOString(),
    refer_version: "0.3.0",
    source_node: "hive-factory",
    stripped: stripPatterns,
  };
  writeFileSync(join(stagedRoot, ".dispatch-manifest.json"), JSON.stringify(manifest, null, 2));

  // Tar it
  const tarPath = join(PKG_DIR, `${outName}.tar.gz`);
  execFileSync("tar", ["-czf", tarPath, "-C", TEMP_DIR, "refer-zo-bootstrap"], { encoding: "utf8" });

  const cs = checksum(`${PKG_DIR}/${outName}.tar.gz`);
  const entry = {
    type,
    package: `${outName}.tar.gz`,
    checksum: cs,
    shipped_at: new Date().toISOString(),
    shipped_to: null, // fill in on ship
  };
  writeDispatchLog(entry);

  rmSync(TEMP_DIR, { recursive: true, force: true });

  console.log(`✅ ${type} bootstrap built: ${PKG_DIR}/${outName}.tar.gz`);
  console.log(`   SHA256 checksum: ${cs}\n`);
  return { name: `${outName}.tar.gz`, checksum: cs };
}

async function listDispatches() {
  const log = loadDispatchLog();
  console.log("\n📦 Dispatch Log\n" + "─".repeat(60));
  if (log.length === 0) { console.log("  No dispatches yet.\n"); return; }
  for (const e of log) {
    console.log(`  ${e.type.padEnd(8)} ${e.package} → ${e.shipped_to || "(pending)"} [${e.shipped_at.slice(0,10)}]`);
  }
  console.log("");
}

async function main() {
  const args = process.argv.slice(2);
  const cmd = args[0];

  switch (cmd) {
    case "package": {
      const type = args.find(a => a.startsWith("--type="))?.split("=")[1] || "hive";
      await buildPackage(type);
      break;
    }
    case "list":
      await listDispatches();
      break;
    case "ship": {
      const nodeId = args.find(a => a.startsWith("--node="))?.split("=")[1];
      if (!nodeId) { console.log("Usage: dispatcher.mjs ship --node <id>"); return; }
      // Update dispatch log with ship target
      const log = loadDispatchLog();
      if (log.length > 0) {
        log[log.length - 1].shipped_to = nodeId;
        const logFile = join(DISPATCH_DIR, "dispatch-log.jsonl");
        writeFileSync(logFile, log.map(e => JSON.stringify(e)).join("\n") + "\n");
      }
      console.log(`✅ Marked as shipped to: ${nodeId}`);
      break;
    }
    default:
      console.log("Usage: dispatcher.mjs <package|list|ship>");
  }
}

main().catch(err => { console.error(err.message); process.exit(1); });
