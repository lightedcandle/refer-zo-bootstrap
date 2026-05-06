#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const MCP_URL = "https://api.zo.computer/mcp";
const PROTOCOL_VERSION = "2024-11-05";
const SITE_ROOT = "/home/workspace/Projects/Alliance-Hub/alliance";

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
  const args = { instance: "alliance", publish: false, public: true };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--instance" && argv[i + 1]) args.instance = argv[++i];
    else if (argv[i] === "--publish") args.publish = true;
    else if (argv[i] === "--private") args.public = false;
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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const env = loadEnv();
  const token = tokenFor(env, args.instance);
  if (!token) throw new Error(`Missing token for ${args.instance}`);
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
  };
  await rpc(headers, "initialize", {
    protocolVersion: PROTOCOL_VERSION,
    capabilities: {},
    clientInfo: { name: "alliance-site-sync", version: "1.0.0" },
  }, 1);

  const app = readFileSync(resolve("scopes", "alliance", "site", "App.tsx"), "utf8");
  const index = readFileSync(resolve("scopes", "alliance", "site", "index.html"), "utf8");
  const server = readFileSync(resolve("scopes", "alliance", "site", "server.ts"), "utf8");
  await callTool(headers, "create_or_rewrite_file", {
    target_file: `${SITE_ROOT}/index.html`,
    content: index,
  });
  await callTool(headers, "create_or_rewrite_file", {
    target_file: `${SITE_ROOT}/src/App.tsx`,
    content: app,
  });
  await callTool(headers, "create_or_rewrite_file", {
    target_file: `${SITE_ROOT}/server.ts`,
    content: server,
  });
  const assetDir = resolve("scopes", "alliance", "site", "public", "assets");
  const syncedAssets = [];
  if (existsSync(assetDir)) {
    await callTool(headers, "run_bash_command", {
      cmd: "mkdir -p public/assets /tmp/alliance-assets",
      cwd: SITE_ROOT,
    });
    for (const name of readdirSync(assetDir).filter((item) => !item.startsWith("."))) {
      const source = resolve(assetDir, name);
      const base64 = readFileSync(source).toString("base64");
      const temp = `/tmp/alliance-assets/${name}.b64`;
      await callTool(headers, "create_or_rewrite_file", {
        target_file: temp,
        content: base64,
      });
      await callTool(headers, "run_bash_command", {
        cmd: `base64 -d ${temp} > public/assets/${name}`,
        cwd: SITE_ROOT,
      });
      syncedAssets.push(`${SITE_ROOT}/public/assets/${name}`);
    }
  }

  const check = await callTool(headers, "run_bash_command", {
    cmd: "bun run build",
    cwd: SITE_ROOT,
  });

  let publish = null;
  if (args.publish) {
    try {
      publish = await callTool(headers, "publish_site", { public: args.public ? "true" : "false" });
    } catch (err) {
      publish = {
        ok: false,
        fallback_required: true,
        error: err?.message || String(err),
      };
    }
  }

  console.log(JSON.stringify({
    ok: true,
    instance: args.instance,
    site_root: SITE_ROOT,
    synced: [`${SITE_ROOT}/index.html`, `${SITE_ROOT}/src/App.tsx`, `${SITE_ROOT}/server.ts`, ...syncedAssets],
    build: check,
    publish,
  }, null, 2));
}

main().catch((err) => {
  console.error(err?.stack || err?.message || err);
  process.exit(1);
});
