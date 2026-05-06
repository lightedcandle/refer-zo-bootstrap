#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const MCP_URL = "https://api.zo.computer/mcp";
const PROTOCOL_VERSION = "2024-11-05";
const SITE_ROOT = "/home/workspace/Projects/Alliance-Hub/alliance";
const REMOTE_ROOT = `${SITE_ROOT}/factory/story`;
const storyDir = resolve("..", "The Alliance Story");
const authorityPath = resolve("scopes", "alliance", "story-authority.md");
const scopingJsonPath = resolve("datasets", "script-artifacts", "scoped", "alliance", "story", "alliance-scoping-plan-latest.json");
const scopingMdPath = resolve("datasets", "script-artifacts", "scoped", "alliance", "story", "alliance-scoping-plan-latest.md");
const vocabularyJsonPath = resolve("datasets", "script-artifacts", "scoped", "alliance", "vocabulary", "alliance-vocabulary-latest.json");
const vocabularyMdPath = resolve("datasets", "script-artifacts", "scoped", "alliance", "vocabulary", "alliance-vocabulary-latest.md");

const storyDocs = [
  "The alliance Hub",
  "The Alliance Structure",
  "The Alliance Rhythm",
  "The Alliance Leadership",
  "The Alliance Members",
  "The Alliance Gifts",
  "alliance_invisible_app_architecture.md",
];

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

function requireFile(path) {
  if (!existsSync(path)) throw new Error(`Missing required file: ${path}`);
  return readFileSync(path, "utf8");
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
    clientInfo: { name: "alliance-story-sync", version: "1.0.0" },
  }, 1);

  await callTool(headers, "run_bash_command", {
    cmd: `mkdir -p "${REMOTE_ROOT}/source"`,
    cwd: SITE_ROOT,
  });

  const files = [
    ["authority.md", authorityPath],
    ["alliance-scoping-plan-latest.json", scopingJsonPath],
    ["alliance-scoping-plan-latest.md", scopingMdPath],
    ["alliance-vocabulary-latest.json", vocabularyJsonPath],
    ["alliance-vocabulary-latest.md", vocabularyMdPath],
    ...storyDocs.map((name) => [`source/${name}`, resolve(storyDir, name)]),
  ];

  const synced = [];
  for (const [remoteName, localPath] of files) {
    const target = `${REMOTE_ROOT}/${remoteName}`;
    await callTool(headers, "create_or_rewrite_file", {
      target_file: target,
      content: requireFile(localPath),
    });
    synced.push(target);
  }

  const readback = await callTool(headers, "run_bash_command", {
    cwd: SITE_ROOT,
    cmd: `test -s factory/story/authority.md && test -s "factory/story/source/The Alliance Structure" && test -s factory/story/source/alliance_invisible_app_architecture.md && test -s factory/story/alliance-scoping-plan-latest.json && test -s factory/story/alliance-vocabulary-latest.json && grep -q "Alliance Story documents are the narrative authority" factory/story/authority.md && echo alliance_story_authority_synced`,
  });

  console.log(JSON.stringify({
    ok: true,
    instance: args.instance,
    remote_root: REMOTE_ROOT,
    synced,
    readback,
  }, null, 2));
}

main().catch((err) => {
  console.error(err?.stack || err?.message || err);
  process.exit(1);
});
