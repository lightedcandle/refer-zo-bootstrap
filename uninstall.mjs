#!/usr/bin/env node
/**
 * uninstall.mjs — Clean uninstall of the refer-zo-bootstrap installation.
 *
 * Removes everything that bootstrap.mjs installs, leaving the workspace clean.
 *
 * Usage:
 *   node uninstall.mjs              -- interactive
 *   node uninstall.mjs --force      -- skip confirmation
 *
 * Installed by bootstrap.mjs:
 *   - Zo Files/<PROFILE>/          (profile folder with authority surfaces)
 *   - Zo Files/Skills/             (refer skills and manifest)
 *   - Zo Files/REFER.OS/           (refer law files)
 *   - Zo Files/AGENTS.md            (repo governance)
 *   - Zo Files/<PROFILE>.json      (install state)
 *   - Zo persona rules              (REFER VIPC rules)
 *   - Zo personas                   (REFER-governed personas)
 *
 * Does NOT remove:
 *   - The bootstrap source repo on disk
 *   - Datasets (chat-contracts, chat-logs, etc.)
 *   - User content in Projects/, Articles/, Images/
 */

import { readFileSync } from "node:fs";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const MCP_URL = "https://api.zo.computer/mcp";
const PROTOCOL_VERSION = "2024-11-05";
const THIS_FILE = fileURLToPath(import.meta.url);
const SCRIPT_DIR = dirname(THIS_FILE);
const REPO_ROOT = SCRIPT_DIR; // uninstall.mjs lives at repo root

// ── Config ─────────────────────────────────────────────────────────────────

function loadConfig() {
  try {
    const raw = readFileSync(join(REPO_ROOT, "refer-install-state.json"), "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function loadManifest() {
  try {
    const raw = readFileSync(join(REPO_ROOT, "skills", "library-manifest.json"), "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// ── Zo MCP helpers ──────────────────────────────────────────────────────────

async function initializeSession(token) {
  const baseHeaders = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
    "MCP-Protocol-Version": PROTOCOL_VERSION,
  };
  const init = await fetch(MCP_URL, {
    method: "POST",
    headers: baseHeaders,
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: { name: "bootstrap-uninstall", version: "1.0.0" },
      },
    }),
  });
  const text = await init.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  const sessionId = init.headers.get("mcp-session-id") || init.headers.get("Mcp-Session-Id");
  if (!init.ok || !sessionId) throw new Error(`MCP init failed: ${init.status} ${text.slice(0, 200)}`);
  const headers = { ...baseHeaders, "mcp-session-id": sessionId };
  await fetch(MCP_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized", params: {} }),
  });
  return headers;
}

async function runBash(headers, cmd) {
  const call = await fetch(MCP_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({
      jsonrpc: "2.0", id: Date.now(), method: "tools/call",
      params: { name: "run_bash_command", arguments: { cmd } },
    }),
  });
  const json = await call.json();
  if (json?.error) throw new Error("Bash error: " + JSON.stringify(json.error));
  const raw = json?.result?.content?.find(c => c.type === "text")?.text || "";
  const match = raw.match(/stdout='([^']*)'/);
  return match ? match[1].replace(/\\n/g, "\n") : raw;
}

async function callTool(headers, name, args = {}) {
  const call = await fetch(MCP_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({
      jsonrpc: "2.0", id: Date.now(), method: "tools/call",
      params: { name, arguments: args },
    }),
  });
  const json = await call.json();
  if (json?.error) throw new Error(`${name} error: ${JSON.stringify(json.error)}`);
  if (json?.result?.isError) throw new Error(`${name} failed`);
  return json;
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

// ── Token resolution ─────────────────────────────────────────────────────────

function resolveToken(env, instance) {
  // Check for explicit instance first
  const normalized = (instance || process.env.ZO_INSTANCE || "refer").trim().toLowerCase();

  if (normalized === "telechurch") {
    return { token: env.ZO_COMPUTER_TELECHURCH, envName: "ZO_COMPUTER_TELECHURCH" };
  }
  if (normalized === "refer") {
    return {
      token: env.ZO_COMPUTER_REFER || env.ZO_ACCESS_TOKEN || env.ZO_COMPUTER,
      envName: env.ZO_COMPUTER_REFER ? "ZO_COMPUTER_REFER" : env.ZO_ACCESS_TOKEN ? "ZO_ACCESS_TOKEN" : "ZO_COMPUTER",
    };
  }
  const envName = `ZO_COMPUTER_${normalized.toUpperCase().replace(/[^A-Z0-9_]/g, "_")}`;
  return { token: env[envName], envName };
}

function loadEnv() {
  const out = { ...process.env };
  for (const file of [".env.local", ".env"]) {
    const path = join(REPO_ROOT, file);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const l = line.trim();
      if (!l || l.startsWith("#")) continue;
      const idx = l.indexOf("=");
      if (idx < 0) continue;
      out[l.slice(0, idx).trim()] = l.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
    }
  }
  return out;
}

// ── Uninstall steps ─────────────────────────────────────────────────────────

async function uninstallProfileFolder(headers, profile, workspaceRoot) {
  const PROFILE = profile.toUpperCase();
  const profileRoot = `${workspaceRoot}/${PROFILE}`;
  console.log(`\n--- Removing profile folder: ${profileRoot}`);
  try {
    await runBash(headers, `rm -rf ${shellQuote(profileRoot)}`);
    console.log("  ✓ Profile folder removed");
  } catch (e) {
    console.log(`  ✗ Could not remove: ${e.message}`);
  }
}

async function uninstallSkills(headers, workspaceRoot) {
  const skillsRoot = `${workspaceRoot}/Skills`;
  console.log(`\n--- Removing skills: ${skillsRoot}`);
  try {
    await runBash(headers, `rm -rf ${shellQuote(skillsRoot)}`);
    console.log("  ✓ Skills folder removed");
  } catch (e) {
    console.log(`  ✗ Could not remove: ${e.message}`);
  }
}

async function uninstallReferOS(headers, workspaceRoot) {
  const lawRoot = `${workspaceRoot}/REFER.OS`;
  console.log(`\n--- Removing REFER.OS law: ${lawRoot}`);
  try {
    await runBash(headers, `rm -rf ${shellQuote(lawRoot)}`);
    console.log("  ✓ REFER.OS folder removed");
  } catch (e) {
    console.log(`  ✗ Could not remove: ${e.message}`);
  }
}

async function uninstallAgents(headers, workspaceRoot) {
  const agentsPath = `${workspaceRoot}/AGENTS.md`;
  console.log(`\n--- Removing AGENTS.md: ${agentsPath}`);
  try {
    await runBash(headers, `rm -f ${shellQuote(agentsPath)}`);
    console.log("  ✓ AGENTS.md removed");
  } catch (e) {
    console.log(`  ✗ Could not remove: ${e.message}`);
  }
}

async function uninstallInstallState(headers, workspaceRoot) {
  const statePath = `${workspaceRoot}/refer-install-state.json`;
  console.log(`\n--- Removing install state: ${statePath}`);
  try {
    await runBash(headers, `rm -f ${shellQuote(statePath)}`);
    console.log("  ✓ Install state removed");
  } catch (e) {
    console.log(`  ✗ Could not remove: ${e.message}`);
  }
}

async function uninstallPersonaRules(headers) {
  console.log("\n--- Removing REFER persona rules");
  try {
    const result = await callTool(headers, "list_rules");
    // apostlej returns format-strings, not JSON: "id='...' condition='...' instruction='...' created_at='...'"
    const raw = result?.result?.content?.find(c => c.type === "text")?.text || "";
    // Try JSON first, then fall back to format-string parsing
    let rules = [];
    try { rules = JSON.parse(raw); } catch {
      // Parse format-string: id='...' name='...' etc.
      const idMatch = raw.match(/id='([^']+)'/);
      if (idMatch) rules = [{ id: idMatch[1], instruction: raw }];
    }
    let removed = 0;
    for (const rule of rules) {
      const inst = rule.instruction || rule.prompt || rule.text || "";
      if (inst.includes("[REFER VIPC RULE:")) {
        await callTool(headers, "delete_rule", { rule_id: rule.id });
        removed++;
      }
    }
    console.log(`  ✓ ${removed} REFER rules removed`);
  } catch (e) {
    console.log(`  ✗ Could not remove rules: ${e.message}`);
  }
}

async function uninstallReferPersonas(headers, profile) {
  console.log("\n--- Removing REFER personas");
  try {
    const result = await callTool(headers, "list_personas");
    const raw = result?.result?.content?.find(c => c.type === "text")?.text || "";
    let personas = [];
    try { personas = JSON.parse(raw); } catch {
      const idMatch = raw.match(/id='([^']+)'/);
      if (idMatch) personas = [{ id: idMatch[1], name: raw }];
    }
    let removed = 0;
    for (const p of personas) {
      const name = p.name || "";
      if (name.includes("REFER") || name.includes("VIPC") || name.includes("Telechurch")) {
        await callTool(headers, "delete_persona", { persona_id: p.id });
        removed++;
      }
    }
    console.log(`  ✓ ${removed} REFER personas removed`);
  } catch (e) {
    console.log(`  ✗ Could not remove personas: ${e.message}`);
  }
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes("--force") || args.includes("-y");
  const dryRun = args.includes("--dry-run");
  let instance = "refer";
  let tokenOverride = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--instance" && args[i + 1]) instance = args[++i];
    if (args[i] === "-i" && args[i + 1]) instance = args[++i];
    if (args[i] === "--token" && args[i + 1]) tokenOverride = args[++i];
  }

  console.log("═══════════════════════════════════════════════════════");
  console.log("  refer-zo-bootstrap — Uninstall");
  console.log("═══════════════════════════════════════════════════════\n");

  if (dryRun) console.log("[DRY RUN — no changes will be made]\n");

  const config = loadConfig();
  const manifest = loadManifest();

  const profile = config?.machine_label || "refer";
  const workspaceRoot = "/home/workspace";

  console.log(`Profile:     ${profile}`);
  console.log(`Workspace:   ${workspaceRoot}`);
  console.log(`Version:     ${manifest?.refer_version || config?.installed_refer_version || "unknown"}`);
  console.log(`Installed:   ${config?.last_installed_at || "unknown"}`);
  console.log(`Bootstrap:   ${config?.bootstrap_complete ? "yes" : "incomplete"}`);

  if (!force && !dryRun) {
    console.log("\n───────────────────────────────────────────────────────");
    console.log("This will remove from Zo Files:");
    console.log(`  - ${workspaceRoot}/<PROFILE>/     (authority surfaces)`);
    console.log(`  - ${workspaceRoot}/Skills/        (refer skills)`);
    console.log(`  - ${workspaceRoot}/REFER.OS/       (refer law)`);
    console.log(`  - ${workspaceRoot}/AGENTS.md      (governance)`);
    console.log(`  - ${workspaceRoot}/refer-install-state.json`);
    console.log("  - REFER VIPC rules in Zo Rules");
    console.log("  - REFER VIPC personas in Zo Personas");
    console.log("\nThe bootstrap source repo on disk will NOT be deleted.");
    console.log("───────────────────────────────────────────────────────\n");
    const readline = await import("node:readline");
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await new Promise(resolve => {
      rl.question("Proceed with uninstall? [y/N] ", resolve);
    });
    rl.close();
    if (answer.toLowerCase() !== "y") {
      console.log("Aborted.");
      process.exit(0);
    }
  }

  console.log("\nConnecting to Zo...");
  const env = loadEnv();
  let tokenToUse = tokenOverride;
  let envName = "command-line";
  if (!tokenToUse) {
    const result = resolveToken(env, instance);
    tokenToUse = result.token;
    envName = result.envName;
  }
  if (!tokenToUse) {
    console.error(`\nError: Missing Zo token. Set ${envName} in .env or environment.`);
    process.exit(1);
  }

  const headers = await initializeSession(tokenToUse);
  console.log("Connected.\n");

  if (dryRun) {
    console.log("[DRY RUN — nothing was removed]");
    process.exit(0);
  }

  await uninstallProfileFolder(headers, profile, workspaceRoot);
  await uninstallSkills(headers, workspaceRoot);
  await uninstallReferOS(headers, workspaceRoot);
  await uninstallAgents(headers, workspaceRoot);
  await uninstallInstallState(headers, workspaceRoot);
  await uninstallPersonaRules(headers);
  await uninstallReferPersonas(headers, profile);

  console.log("\n═══════════════════════════════════════════════════════");
  console.log("  Uninstall complete.");
  console.log("  Re-run bootstrap.mjs to reinstall.");
  console.log("═══════════════════════════════════════════════════════\n");
}

main().catch(err => {
  console.error("\nUninstall failed:", err.message);
  process.exit(1);
});
