#!/usr/bin/env node
/**
 * sync-tandem-runtime-to-zo.mjs
 *
 * Script-first Zo file transport for the tandem runtime. Uses MCP directly so
 * file contents are sent in the request body, not through long command-line
 * args. This avoids Windows command length limits and makes the operation
 * reusable by agents.
 */
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { logTokenUse } from "./token-log-bridge.mjs";

const MCP_URL = "https://api.zo.computer/mcp";
const PROTOCOL_VERSION = "2024-11-05";

const TANDEM_RUNTIME_FILES = [
  "package.json",
  "scripts/factory.mjs",
  "scripts/bootstrap.mjs",
  "scripts/factory/factory.mjs",
  "scripts/factory/bootstrap.mjs",
  "scripts/factory/compression-codec.mjs",
  "scripts/factory/token-log-bridge.mjs",
  "scripts/factory/contract-inbox-runner.mjs",
  "scripts/factory/backfill-zo-local-usage.mjs",
  "scripts/factory/node-scope.mjs",
  "scripts/factory/local-script-registry.mjs",
  "scripts/factory/draft-promotion-runner.mjs",
  "scripts/factory/local-intake-runner.mjs",
  "scripts/factory/inbox-automation.mjs",
  "scripts/factory/registry-doctor.mjs",
  "scripts/factory/evolution-loop.mjs",
  "scripts/factory/route-manifest-bridge.mjs",
  "scripts/factory/script-registry.json",
  "scripts/factory/script-dictionary.mjs",
  "scripts/factory/scriptionary.json",
  "scripts/factory/heartbeat.mjs",
  "scripts/factory/heartbeat-meta.json",
  "scripts/factory/train-cars/01-dashboard.mjs",
  "scripts/factory/train-cars/02-spawn-worker.mjs",
  "scripts/factory/train-cars/03-scan-workspace.mjs",
  "scripts/factory/train-cars/04-hive-sync.mjs",
  "scripts/hive/api.mjs",
  "scripts/hive/dispatcher.mjs",
  "scripts/hive/receive.mjs",
  "scripts/hive/talkback.mjs",
  "scripts/factory/hive/api.mjs",
  "scripts/factory/hive/dispatcher.mjs",
  "scripts/factory/hive/receive.mjs",
  "scripts/factory/hive/talkback.mjs",
  "scripts/factory/hive/manifest.json",
  "scripts/factory/artifacts/button-add.mjs",
  "scripts/factory/artifacts/page-add.mjs",
  "scripts/factory/artifacts/form-add.mjs",
  "scripts/factory/artifacts/field-add.mjs",
  "scripts/factory/artifacts/section-add.mjs",
  "scripts/factory/artifacts/card-add.mjs",
  "scripts/factory/artifacts/text-add.mjs",
  "scripts/factory/artifacts/git-commit.mjs",
  "scripts/factory/artifacts/deploy-pages.mjs",
  "scripts/factory/artifacts/scan-workspace.mjs",
  "scripts/factory/artifacts/atomic-common.mjs",
  "docs/file-transport-tandem.md",
  "docs/factory-topology.md",
  "docs/scoped-app-boundary.md",
  "datasets/tandem-contracts/README.md",
  "datasets/tandem-contracts/datapackage.json",
  "datasets/tandem-talkback/README.md",
  "datasets/tandem-talkback/datapackage.json",
  "datasets/tandem-dispatch/README.md",
  "datasets/tandem-dispatch/datapackage.json",
  "datasets/tandem-usage/README.md",
  "datasets/tandem-usage/datapackage.json",
  "datasets/build-activity/README.md",
  "datasets/build-activity/datapackage.json",
  "datasets/node-scope/README.md",
  "datasets/node-scope/datapackage.json",
  "datasets/local-intake/README.md",
  "datasets/local-intake/datapackage.json",
  "datasets/script-registry/README.md",
  "datasets/script-registry/datapackage.json",
  "datasets/script-artifacts/README.md",
  "datasets/script-artifacts/datapackage.json",
  "datasets/build-traces/README.md",
  "datasets/build-traces/datapackage.json",
  "datasets/evolution-log/README.md",
  "datasets/evolution-log/datapackage.json",
];

const GOVERNANCE_FILES = [
  "AGENTS.md",
  "docs/file-transport-tandem.md",
  "docs/known-limits-and-constraints.md",
  "docs/parallel-factory-orchestration.md",
  "docs/factory-topology.md",
  "docs/scoped-app-boundary.md",
  "law/REFER.OS/refer.factory.md",
  "law/REFER.OS/refer.zo.md",
];

function parseArgs(argv) {
  const args = {
    instance: "telechurch",
    remoteRoot: "/home/workspace",
    preset: "tandem-runtime",
    files: [],
    check: false,
    json: false,
    ledger: "usage/zo-mcp-usage.jsonl",
  };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--instance" && argv[i + 1]) args.instance = argv[++i];
    else if (argv[i] === "--remote-root" && argv[i + 1]) args.remoteRoot = argv[++i];
    else if (argv[i] === "--preset" && argv[i + 1]) args.preset = argv[++i];
    else if (argv[i] === "--file" && argv[i + 1]) args.files.push(argv[++i]);
    else if (argv[i] === "--check") args.check = true;
    else if (argv[i] === "--json") args.json = true;
    else if (argv[i] === "--ledger" && argv[i + 1]) args.ledger = argv[++i];
  }
  return args;
}

function parseDotEnv(text) {
  const out = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
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

function resolveToken(env, instance) {
  const normalized = String(instance || "refer").trim().toLowerCase();
  if (normalized === "telechurch") {
    return {
      token: env.ZO_COMPUTER_TELECHURCH,
      envName: "ZO_COMPUTER_TELECHURCH",
      instance: normalized,
    };
  }
  if (normalized === "refer") {
    return {
      token: env.ZO_COMPUTER_REFER || env.ZO_ACCESS_TOKEN || env.ZO_COMPUTER,
      envName: env.ZO_COMPUTER_REFER
        ? "ZO_COMPUTER_REFER"
        : env.ZO_ACCESS_TOKEN
          ? "ZO_ACCESS_TOKEN"
          : "ZO_COMPUTER",
      instance: normalized,
    };
  }
  const envName = `ZO_COMPUTER_${normalized.toUpperCase().replace(/[^A-Z0-9_]/g, "_")}`;
  return { token: env[envName], envName, instance: normalized };
}

async function rpc(headers, method, params, id) {
  const response = await fetch(MCP_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
  });
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { parse_error: text.slice(0, 500) };
  }
  return { response, json, text };
}

async function initialize(token) {
  const baseHeaders = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
    "MCP-Protocol-Version": PROTOCOL_VERSION,
  };
  const init = await rpc(
    baseHeaders,
    "initialize",
    {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: "refer-tandem-runtime-sync", version: "0.1.0" },
    },
    1,
  );
  const sessionId =
    init.response.headers.get("mcp-session-id") ||
    init.response.headers.get("Mcp-Session-Id");
  if (!init.response.ok || !sessionId) {
    throw new Error(`MCP initialize failed: status=${init.response.status} body=${init.text.slice(0, 500)}`);
  }
  const headers = { ...baseHeaders, "mcp-session-id": sessionId };
  await fetch(MCP_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "notifications/initialized",
      params: {},
    }),
  }).catch(() => {});
  return headers;
}

async function callTool(headers, name, toolArgs, id) {
  const call = await rpc(headers, "tools/call", { name, arguments: toolArgs }, id);
  const ok = call.response.ok && !call.json?.error && !call.json?.result?.isError;
  if (!ok) {
    const content = call.json?.result?.content;
    const text = Array.isArray(content)
      ? content.map((item) => item?.text || JSON.stringify(item)).join("\n")
      : call.text;
    throw new Error(`${name} failed: ${text.slice(0, 800)}`);
  }
  return call.json;
}

function filesForPreset(args) {
  if (args.files.length) return args.files;
  if (args.preset === "tandem-runtime") return TANDEM_RUNTIME_FILES;
  if (args.preset === "governance") return GOVERNANCE_FILES;
  if (args.preset === "all") return [...new Set([...TANDEM_RUNTIME_FILES, ...GOVERNANCE_FILES])];
  throw new Error(`Unknown preset ${args.preset}`);
}

function remotePath(remoteRoot, localPath) {
  return `${remoteRoot.replace(/\/$/, "")}/refer-zo-bootstrap/${localPath.replace(/\\/g, "/")}`;
}

function extractText(result) {
  const content = result?.result?.content;
  if (!Array.isArray(content)) return "";
  return content.map((item) => item?.text || JSON.stringify(item)).join("\n");
}

function logUsage(path, event) {
  try {
    appendFileSync(resolve(path), `${JSON.stringify(event)}\n`, "utf8");
  } catch {
    // Usage logging should never block sync.
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const env = loadEnv();
  const tokenInfo = resolveToken(env, args.instance);
  if (!tokenInfo.token) throw new Error(`Missing Zo token. Set ${tokenInfo.envName}.`);
  const started = performance.now();
  const headers = await initialize(tokenInfo.token);
  const files = filesForPreset(args);
  const uploaded = [];
  let inputChars = 0;

  let id = 2;
  for (const file of files) {
    const content = readFileSync(file, "utf8");
    inputChars += content.length;
    const target = remotePath(args.remoteRoot, file);
    await callTool(headers, "create_or_rewrite_file", { target_file: target, content }, id++);
    uploaded.push({ local: file, remote: target, chars: content.length });
  }

  let check = null;
  if (args.check) {
    const cmd = [
      `cd ${args.remoteRoot}/refer-zo-bootstrap`,
      "node --check scripts/factory.mjs",
      "node --check scripts/bootstrap.mjs",
      "node --check scripts/factory/factory.mjs",
      "node --check scripts/factory/bootstrap.mjs",
      "node --check scripts/factory/compression-codec.mjs",
      "node --check scripts/factory/token-log-bridge.mjs",
      "node --check scripts/factory/contract-inbox-runner.mjs",
      "node --check scripts/factory/local-script-registry.mjs",
      "node --check scripts/factory/draft-promotion-runner.mjs",
      "node --check scripts/factory/local-intake-runner.mjs",
      "node --check scripts/factory/inbox-automation.mjs",
      "node --check scripts/factory/registry-doctor.mjs",
      "node --check scripts/factory/evolution-loop.mjs",
      "node --check scripts/factory/script-dictionary.mjs",
      "node --check scripts/factory/heartbeat.mjs",
      "node --check scripts/factory/train-cars/01-dashboard.mjs",
      "node --check scripts/factory/train-cars/02-spawn-worker.mjs",
      "node --check scripts/factory/train-cars/03-scan-workspace.mjs",
      "node --check scripts/factory/train-cars/04-hive-sync.mjs",
      "node --check scripts/hive/api.mjs",
      "node --check scripts/hive/dispatcher.mjs",
      "node --check scripts/hive/receive.mjs",
      "node --check scripts/hive/talkback.mjs",
      "node --check scripts/factory/hive/api.mjs",
      "node --check scripts/factory/hive/dispatcher.mjs",
      "node --check scripts/factory/hive/receive.mjs",
      "node --check scripts/factory/hive/talkback.mjs",
      "node -e \"JSON.parse(require('fs').readFileSync('scripts/factory/scriptionary.json','utf8'));\"",
    ].join(" && ");
    const result = await callTool(headers, "run_bash_command", { cmd }, id++);
    check = extractText(result);
  }

  const durationMs = Math.round(performance.now() - started);
  const output = {
    ok: true,
    instance: tokenInfo.instance,
    preset: args.preset,
    uploaded,
    check,
    duration_ms: durationMs,
  };
  output.token_log = logTokenUse({
    agent: "sync-tandem-runtime-to-zo",
    script: "sync-tandem-runtime-to-zo",
    inputChars,
    outputChars: JSON.stringify(output).length,
    status: "done",
    zoComputer: tokenInfo.instance,
    note: args.check
      ? "synced tandem runtime to Zo and ran remote syntax check"
      : "synced tandem runtime to Zo",
  });
  logUsage(args.ledger, {
    ts: new Date().toISOString(),
    endpoint: "/mcp",
    instance: tokenInfo.instance,
    command: "sync-tandem-runtime",
    tool: "create_or_rewrite_file",
    status: 200,
    ok: true,
    duration_ms: durationMs,
    files: uploaded.length,
  });

  console.log(JSON.stringify(output, null, 2));
}

main().catch((error) => {
  console.error(error?.message || String(error));
  process.exit(1);
});
