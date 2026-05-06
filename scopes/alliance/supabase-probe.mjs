#!/usr/bin/env node
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const MCP_URL = "https://api.zo.computer/mcp";
const PROTOCOL_VERSION = "2024-11-05";
const SITE_ROOT = "/home/workspace/Projects/Alliance-Hub/alliance";
const defaultEnvFile = "E:\\telechurch-e2e\\.env.master";
const defaultNodeModulesRoot = "E:\\telechurch-e2e";
const outDir = resolve("datasets", "script-artifacts", "scoped", "alliance", "supabase");

function parseArgs(argv) {
  const args = { instance: "alliance", envFile: defaultEnvFile, nodeModulesRoot: defaultNodeModulesRoot };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--instance" && argv[i + 1]) args.instance = argv[++i];
    else if (argv[i] === "--env-file" && argv[i + 1]) args.envFile = argv[++i];
    else if (argv[i] === "--node-modules-root" && argv[i + 1]) args.nodeModulesRoot = argv[++i];
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

function loadZoEnv() {
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

function projectRef(url) {
  return String(url || "").match(/https?:\/\/([^.]+)\.supabase\.co/i)?.[1] || "";
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

function extractStdout(result) {
  const text = (result?.content || []).map((item) => item?.text || "").join("\n");
  return text.match(/stdout='([\s\S]*?)', stderr=/)?.[1]?.replace(/\\n/g, "\n").trim() || text;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const supabaseEnv = parseEnv(args.envFile);
  const ref = projectRef(supabaseEnv.SUPABASE_URL);
  if (!ref || !supabaseEnv.SUPABASE_DB_PASSWORD) throw new Error("Missing Supabase DB env.");

  const token = tokenFor(loadZoEnv(), args.instance);
  if (!token) throw new Error(`Missing Zo token for ${args.instance}.`);
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
  };
  await rpc(headers, "initialize", {
    protocolVersion: PROTOCOL_VERSION,
    capabilities: {},
    clientInfo: { name: "alliance-supabase-probe", version: "1.0.0" },
  }, 1);

  const marker = `supabase_probe_${Date.now()}`;
  const payload = JSON.stringify({
    entity: "request",
    label: "Request",
    route: "/dashboard/requests",
    local_dataset: "alliance-requests",
    values: { request_type: marker, summary: "supabase persistence proof" },
    status: "probe",
  }).replace(/'/g, "'\\''");
  const result = await callTool(headers, "run_bash_command", {
    cwd: SITE_ROOT,
    cmd: `curl -s -X POST http://localhost:51303/api/alliance-drafts -H 'Content-Type: application/json' -d '${payload}'`,
  });
  const post = JSON.parse(extractStdout(result));

  const require = createRequire(resolve(args.nodeModulesRoot, "package.json"));
  const { Client } = require("pg");
  const client = new Client({
    host: `db.${ref}.supabase.co`,
    port: 5432,
    user: "postgres",
    password: supabaseEnv.SUPABASE_DB_PASSWORD,
    database: "postgres",
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  let rows = [];
  try {
    const query = await client.query(
      "select id, entity, status, values->>'request_type' as request_type from public.alliance_records where values->>'request_type' = $1 order by created_at desc limit 3",
      [marker],
    );
    rows = query.rows;
  } finally {
    await client.end();
  }

  const packet = {
    schema: "refer.alliance.supabase-probe.v1",
    generated_at: new Date().toISOString(),
    instance: args.instance,
    project_ref: ref,
    marker,
    post: {
      ok: post.ok,
      persistence: post.persistence,
      supabase_ok: Boolean(post.supabase?.ok),
      edge_function: post.supabase?.edge_function || null,
      record_id: post.record_id,
    },
    supabase_rows_found: rows.length,
    persistence_verdict: post.supabase?.ok && rows.length > 0 ? "supabase_write_verified" : "supabase_write_not_verified",
    evidence: [
      "zo_site_endpoint:posted",
      rows.length > 0 ? "supabase:row_found" : "supabase:row_missing",
      "zo:service_role_absent",
      "edge_function:service_role_not_printed",
    ],
  };
  mkdirSync(outDir, { recursive: true });
  const outPath = resolve(outDir, "supabase-probe-latest.json");
  writeFileSync(outPath, JSON.stringify(packet, null, 2));
  console.log(JSON.stringify({ ok: packet.persistence_verdict === "supabase_write_verified", probe_path: outPath, packet }, null, 2));
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
