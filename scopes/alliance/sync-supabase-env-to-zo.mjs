#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const MCP_URL = "https://api.zo.computer/mcp";
const PROTOCOL_VERSION = "2024-11-05";
const SITE_ROOT = "/home/workspace/Projects/Alliance-Hub/alliance";
const defaultEnvFile = "E:\\telechurch-e2e\\.env.master";

function parseArgs(argv) {
  const args = { instance: "alliance", envFile: defaultEnvFile };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--instance" && argv[i + 1]) args.instance = argv[++i];
    else if (argv[i] === "--env-file" && argv[i + 1]) args.envFile = argv[++i];
  }
  return args;
}

function parseEnv(path) {
  const env = {};
  const text = readFileSync(path, "utf8");
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[match[1]] = value;
  }
  return env;
}

function loadLocalZoEnv() {
  let env = {};
  for (const file of [".env.local", ".env.master"]) {
    if (!existsSync(file)) continue;
    env = { ...env, ...parseEnv(file) };
  }
  return { ...env, ...process.env };
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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const env = parseEnv(args.envFile);
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY.");
  const token = tokenFor(loadLocalZoEnv(), args.instance);
  if (!token) throw new Error(`Missing Zo token for ${args.instance}.`);
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
  };
  await rpc(headers, "initialize", {
    protocolVersion: PROTOCOL_VERSION,
    capabilities: {},
    clientInfo: { name: "alliance-supabase-env-sync", version: "1.0.0" },
  }, 1);

  const content = [
    `SUPABASE_URL=${env.SUPABASE_URL}`,
    `SUPABASE_ANON_KEY=${env.SUPABASE_ANON_KEY}`,
    "ALLIANCE_SUPABASE_FUNCTION=alliance-record-write",
    "",
  ].join("\n");
  await callTool(headers, "create_or_rewrite_file", {
    target_file: `${SITE_ROOT}/.env.alliance`,
    content,
  });
  console.log(JSON.stringify({
    ok: true,
    instance: args.instance,
    target_file: `${SITE_ROOT}/.env.alliance`,
    synced_keys: ["SUPABASE_URL", "SUPABASE_ANON_KEY", "ALLIANCE_SUPABASE_FUNCTION"],
    secret_values_printed: false,
  }, null, 2));
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
