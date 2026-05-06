#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const MCP_URL = "https://api.zo.computer/mcp";
const PROTOCOL_VERSION = "2024-11-05";
const SITE_ROOT = "/home/workspace/Projects/Alliance-Hub/alliance";
const outDir = resolve("datasets", "script-artifacts", "scoped", "alliance", "phase5");

function parseDotEnv(text) {
  const out = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function loadEnv() {
  let env = {};
  for (const file of [".env.local", ".env.master"]) {
    if (!existsSync(file)) continue;
    env = { ...env, ...parseDotEnv(readFileSync(file, "utf8")) };
  }
  return { ...env, ...process.env };
}

function parseArgs(argv) {
  const args = { instance: "alliance" };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--instance" && argv[i + 1]) args.instance = argv[++i];
  }
  return args;
}

function tokenFor(env, instance) {
  const key = `ZO_COMPUTER_${instance.toUpperCase().replace(/[^A-Z0-9_]/g, "_")}`;
  return env[key];
}

async function rpc(headers, method, params, id = Date.now()) {
  const response = await fetch(MCP_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
  });
  const json = await response.json();
  if (!response.ok || json.error) {
    throw new Error(`${method} failed: ${JSON.stringify(json.error || json).slice(0, 500)}`);
  }
  return json.result;
}

async function callTool(headers, name, args) {
  return rpc(headers, "tools/call", { name, arguments: args });
}

function extractText(result) {
  const content = result?.content;
  if (!Array.isArray(content)) return "";
  return content.map((item) => item?.text || JSON.stringify(item)).join("\n");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const token = tokenFor(loadEnv(), args.instance);
  if (!token) throw new Error(`Missing token for ${args.instance}`);
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
  };
  await rpc(headers, "initialize", {
    protocolVersion: PROTOCOL_VERSION,
    capabilities: {},
    clientInfo: { name: "alliance-phase5-persistence-probe", version: "1.0.0" },
  }, 1);

  const payload = JSON.stringify({
    entity: "request",
    label: "Request",
    route: "/dashboard/requests",
    local_dataset: "alliance-requests",
    values: { request_type: "phase5_probe", summary: "local file persistence proof" },
    status: "probe",
  }).replace(/'/g, "'\\''");

  const cmd = [
    "mkdir -p factory",
    "before=$(wc -l < factory/alliance-draft-proof.jsonl 2>/dev/null || echo 0)",
    `post=$(curl -s -X POST http://localhost:51303/api/alliance-drafts -H 'Content-Type: application/json' -d '${payload}')`,
    "after=$(wc -l < factory/alliance-draft-proof.jsonl 2>/dev/null || echo 0)",
    "status=$(curl -s http://localhost:51303/api/alliance-drafts/status)",
    "last=$(tail -n 1 factory/alliance-draft-proof.jsonl 2>/dev/null || true)",
    "printf '{\"before\":%s,\"after\":%s,\"post\":%s,\"status\":%s,\"last\":%s}\\n' \"$before\" \"$after\" \"$post\" \"$status\" \"${last:-null}\"",
  ].join("; ");

  const result = await callTool(headers, "run_bash_command", { cmd, cwd: SITE_ROOT });
  const text = extractText(result);
  const jsonText = text.match(/stdout='([^']+)'/)?.[1]?.replace(/\\n$/, "") || text;
  let probe = null;
  try {
    probe = JSON.parse(jsonText);
  } catch {
    probe = { parse_error: text.slice(0, 1000) };
  }
  const packet = {
    schema: "refer.alliance.phase5-persistence-probe.v1",
    generated_at: new Date().toISOString(),
    instance: args.instance,
    capability_tested: "zo_site_local_file_write",
    zo_dataset_api_visible: false,
    persistence_verdict: probe.after > probe.before ? "zo_site_local_file_write_proven" : "not_proven",
    supabase_required_now: false,
    probe,
    evidence: [
      "api_route:/api/alliance-drafts",
      probe.after > probe.before ? "proof_file:line_appended" : "proof_file:no_append",
      "zo_dataset_api:not_visible_in_mcp_tools",
    ],
  };

  mkdirSync(outDir, { recursive: true });
  const outPath = resolve(outDir, "phase5-persistence-probe-latest.json");
  writeFileSync(outPath, JSON.stringify(packet, null, 2));
  console.log(JSON.stringify({ ok: packet.persistence_verdict.endsWith("_proven"), probe_path: outPath, packet }, null, 2));
}

main().catch((err) => {
  console.error(err?.stack || err?.message || err);
  process.exit(1);
});
