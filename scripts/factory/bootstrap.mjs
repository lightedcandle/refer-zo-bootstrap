#!/usr/bin/env node
/**
 * bootstrap.mjs — Script Factory Bootstrap
 *
 * Installs the Script Factory (Package B) onto a target Zo.
 * Works alongside vipc-bootstrap.mjs (Package A: refer-law).
 *
 * Usage:
 *   node bootstrap.mjs --target-workspace /home/workspace [--profile <name>]
 *   node bootstrap.mjs --status
 *   node bootstrap.mjs --uninstall
 *
 * What it does:
 * 1. Copies scripts/factory/ to the target's refer-factory/ directory
 * 2. Creates self.json in the factory directory
 * 3. Registers heartbeat.mjs as a Zo automation (every 5 min)
 * 4. Creates nodes.json with the local node
 *
 * Environment:
 *   ZO_COMPUTER_REFER   — used to open Interlink session to target
 *   INTERLINK_<PROFILE>_KEY — specific key for target
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, cpSync, readdirSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "../..");
const FACTORY_SOURCE = resolve(REPO_ROOT, "scripts/factory");
const SESSION_FILE = resolve(__dirname, "interlink-session.json");

const MCP_URL = "https://api.zo.computer/mcp";
const PROTOCOL_VERSION = "2024-11-05";

function resolveKey(profile) {
  const envKey = `INTERLINK_${String(profile || "refer").toUpperCase().replace(/[^A-Z0-9_]/g, "_")}_KEY`;
  return process.env[envKey] || process.env.INTERLINK_KEY || process.env.ZO_COMPUTER_REFER;
}

async function openSession(key) {
  const response = await fetch(MCP_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/json",
      "MCP-Protocol-Version": PROTOCOL_VERSION,
      "Accept": "application/json, text/event-stream",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: PROTOCOL_VERSION, capabilities: {}, clientInfo: { name: "factory-bootstrap", version: "0.1.0" } }
    })
  });

  const sessionId = response.headers.get("mcp-session-id") || response.headers.get("Mcp-Session-Id");
  if (!response.ok || !sessionId) throw new Error(`Session failed: ${response.status}`);

  return {
    sessionId,
    headers: {
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/json",
      "MCP-Protocol-Version": PROTOCOL_VERSION,
      "mcp-session-id": sessionId,
    }
  };
}

async function rpc(headers, method, params, id) {
  const response = await fetch(MCP_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params })
  });
  return response.json();
}

async function toolCall(headers, name, args, id = Date.now()) {
  const result = await rpc(headers, "tools/call", { name, arguments: args }, id);
  if (result?.error) throw new Error(`${name}: ${JSON.stringify(result.error)}`);
  return result;
}

async function detectWorkspaceRoot(headers) {
  const result = await toolCall(headers, "run_bash_command", { cmd: "pwd" });
  const text = result?.result?.content?.[0]?.text || "";
  const match = text.match(/stdout='([^']*)'/);
  const pwd = match ? match[1].replace(/\\n/g, "\n") : text;
  const root = pwd.split("\n").map(l => l.trim()).find(Boolean);
  if (!root || !root.startsWith("/")) throw new Error(`Invalid workspace root: ${root}`);
  return root;
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────

async function bootstrap(targetWorkspace, profile, factoryUrl) {
  const key = resolveKey(profile);
  if (!key) throw new Error("No API key found. Set ZO_COMPUTER_REFER or INTERLINK_<PROFILE>_KEY");

  console.log(`(bootstrap :status "connecting" :profile "${profile}")`);

  const session = await openSession(key);
  const workspaceRoot = targetWorkspace || await detectWorkspaceRoot(session.headers);

  const factoryDest = join(workspaceRoot, "refer-factory");
  const hiveDir = join(factoryDest, "hive");

  // 1. Create directories on target
  console.log(`(bootstrap :step "create-dirs" :path "${factoryDest}")`);
  await toolCall(session.headers, "run_bash_command", { cmd: `mkdir -p ${shellQuote(hiveDir)}` });

  // 2. Copy factory files
  if (!existsSync(FACTORY_SOURCE)) {
    throw new Error(`Factory source not found: ${FACTORY_SOURCE}`);
  }

  const files = getAllFiles(FACTORY_SOURCE);
  let copied = 0;

  for (const file of files) {
    const rel = file.slice(FACTORY_SOURCE.length + 1);
    const dest = join(factoryDest, rel);

    // Create parent dir on target
    await toolCall(session.headers, "run_bash_command", { cmd: `mkdir -p ${shellQuote(dirname(dest))}` });

    const content = readFileSync(file, "utf8");
    await toolCall(session.headers, "create_or_rewrite_file", { target_file: dest, content });
    copied++;
  }

  console.log(`(bootstrap :step "copy-factory" :copied ${copied} :files)`);

  // 3. Create self.json
  const self = {
    id: profile || "factory",
    name: `${profile || "factory"} factory`,
    url: factoryUrl || "",
    talkback_path: "/api/hive/talkback",
    active: true,
    registered_at: new Date().toISOString()
  };
  await toolCall(session.headers, "create_or_rewrite_file", {
    target_file: join(hiveDir, "self.json"),
    content: JSON.stringify(self, null, 2)
  });
  console.log(`(bootstrap :step "self-config" :id "${self.id}")`);

  // 4. Create nodes.json
  const nodes = { nodes: [self], version: "1.0" };
  await toolCall(session.headers, "create_or_rewrite_file", {
    target_file: join(hiveDir, "nodes.json"),
    content: JSON.stringify(nodes, null, 2)
  });

  // 5. Register heartbeat automation
  const heartbeatCmd = `node "${join(factoryDest, "heartbeat.mjs")}" --tick`;
  const heartbeatResult = await rpc(session.headers, "list_automations", {}, Date.now());
  const existing = heartbeatResult?.result || [];

  // Check if we already have a factory heartbeat
  const existingHeartbeat = existing.find(a =>
    a?.instruction?.includes("heartbeat.mjs") || a?.title?.includes("factory")
  );

  if (!existingHeartbeat) {
    const createResult = await rpc(session.headers, "create_automation", {
      title: `refer-factory heartbeat (${profile || "default"})`,
      instruction: `cd ${factoryDest} && node heartbeat.mjs --tick`,
      rrule: "FREQ=MINUTELY;INTERVAL=5",
      delivery_method: ""
    }, Date.now());

    if (createResult?.error) {
      console.log(`(bootstrap :warning "automation-failed" :detail "${createResult.error.message}")`);
    } else {
      console.log(`(bootstrap :step "automation" :status "registered")`);
    }
  } else {
    console.log(`(bootstrap :step "automation" :status "already-exists")`);
  }

  console.log(`(bootstrap :status "complete" :factory "${factoryDest}" :workspace "${workspaceRoot}")`);
}

function getAllFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...getAllFiles(full));
    } else {
      out.push(full);
    }
  }
  return out;
}

function shellQuote(v) {
  return `'${String(v).replace(/'/g, "'\\''")}'`;
}

// ─── Status ───────────────────────────────────────────────────────────────────

async function status(profile) {
  const key = resolveKey(profile);
  if (!key) {
    console.log("(error :code \"no-key\")");
    return;
  }

  const session = await openSession(key);

  // Check heartbeat state
  const stateResult = await toolCall(session.headers, "read_file", {
    target_file: "/home/workspace/refer-factory/heartbeat-state.json"
  });
  const stateText = stateResult?.result?.content?.[0]?.text || "{}";

  // Check if automation exists
  const autoResult = await rpc(session.headers, "list_automations", {}, Date.now());
  const automations = autoResult?.result || [];
  const factoryAuto = automations.find(a =>
    a?.instruction?.includes("heartbeat.mjs") || a?.title?.includes("refer-factory")
  );

  // Try to read self.json
  let selfInfo = null;
  try {
    const selfResult = await toolCall(session.headers, "read_file", {
      target_file: "/home/workspace/refer-factory/hive/self.json"
    });
    selfInfo = JSON.parse(selfResult?.result?.content?.[0]?.text || "{}");
  } catch { /* ignore */ }

  const state = JSON.parse(stateText);
  console.log(`(factory-status
  :active ${factoryAuto ? "true" : "false"}
  :runs ${state.runs || 0}
  :last "${state.last_run || "never"}"
  :interval "5min"
  :automation-id "${factoryAuto?.id || "none"}"
  :node-id "${selfInfo?.id || "unknown"}"
  :node-name "${selfInfo?.name || "unknown"}"
)`);
}

// ─── Uninstall ────────────────────────────────────────────────────────────────

async function uninstall(profile) {
  const key = resolveKey(profile);
  if (!key) throw new Error("No key");

  const session = await openSession(key);
  const workspaceRoot = await detectWorkspaceRoot(session.headers);
  const factoryDest = join(workspaceRoot, "refer-factory");

  // Remove factory directory
  await toolCall(session.headers, "run_bash_command", { cmd: `rm -rf ${shellQuote(factoryDest)}` });

  // Remove automation
  const autoResult = await rpc(session.headers, "list_automations", {}, Date.now());
  const automations = autoResult?.result || [];
  const factoryAuto = automations.find(a =>
    a?.instruction?.includes("heartbeat.mjs") || a?.title?.includes("refer-factory")
  );
  if (factoryAuto?.id) {
    await rpc(session.headers, "delete_automation", { automation_id: factoryAuto.id }, Date.now());
  }

  console.log(`(uninstall :status "complete" :removed "${factoryDest}")`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);

if (args.includes("--help") || args.length === 0) {
  console.log(`Script Factory Bootstrap

Usage:
  node bootstrap.mjs --target-workspace /home/workspace [--profile <name>] [--factory-url <zoSpaceUrl>]
  node bootstrap.mjs --status [--profile <name>]
  node bootstrap.mjs --uninstall [--profile <name>]

Environment:
  ZO_COMPUTER_REFER              — default key
  INTERLINK_<PROFILE>_KEY       — per-target key
`);
  process.exit(0);
}

const profile = args.includes("--profile") ? args[args.indexOf("--profile") + 1] : null;
const workspace = args.includes("--target-workspace") ? args[args.indexOf("--target-workspace") + 1] : null;
const factoryUrl = args.includes("--factory-url") ? args[args.indexOf("--factory-url") + 1] : null;

if (args.includes("--status")) {
  status(profile).catch(err => {
    console.log(`(error :code "status-fail" :message "${err.message}")`);
    process.exit(1);
  });
} else if (args.includes("--uninstall")) {
  uninstall(profile).catch(err => {
    console.log(`(error :code "uninstall-fail" :message "${err.message}")`);
    process.exit(1);
  });
} else {
  bootstrap(workspace, profile, factoryUrl).catch(err => {
    console.log(`(error :code "bootstrap-fail" :message "${err.message}")`);
    process.exit(1);
  });
}