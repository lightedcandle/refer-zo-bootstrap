#!/usr/bin/env node
/**
 * @opcodes ['SEND_STATUS', 'FETCH_PENDING']
 * @trigger talkback status
 * @description Reports node status and pending chunk count back to the hive
 * @forge-type sensor
 * @forge-name Talkback
 * @forge-id talkback
 *
 * talkback.mjs — Hive Talkback Protocol
 *
 * Implements both:
 * 1. Outgoing requestor — ask another Hive node for help
 * 2. Incoming handler — respond to S-expression requests from other nodes
 *
 * Usage (CLI):
 *   node talkback.mjs --ask <nodeId> --query "<S-expression>"
 *   node talkback.mjs --install   (installs /api/hive/talkback route on local Zo Space)
 *   node talkback.mjs --ping <nodeId>  (health check)
 *   node talkback.mjs --register  (register this node with a relay)
 *
 * As a Zo Space API route:
 *   GET  /api/hive/talkback  → returns node status
 *   POST /api/hive/talkback  → receives S-expression, returns S-expression response
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const NODES_FILE = resolve(__dirname, "nodes.json");
const SELF_FILE = resolve(__dirname, "self.json");
const SESSION_FILE = resolve(__dirname, "interlink-session.json");

// ─── Node Registry ───────────────────────────────────────────────────────────

function loadNodes() {
  try {
    return JSON.parse(readFileSync(NODES_FILE, "utf8"));
  } catch {
    return { nodes: [] };
  }
}

function saveNodes(nodes) {
  writeFileSync(NODES_FILE, JSON.stringify(nodes, null, 2));
}

function loadSelf() {
  try {
    return JSON.parse(readFileSync(SELF_FILE, "utf8"));
  } catch {
    return null;
  }
}

// ─── Interlink Session (to open MCP session to another Zo) ───────────────────

async function openInterlinkSession(targetKey) {
  const MCP_URL = "https://api.zo.computer/mcp";
  const PROTOCOL_VERSION = "2024-11-05";

  const response = await fetch(MCP_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${targetKey}`,
      "Content-Type": "application/json",
      "MCP-Protocol-Version": PROTOCOL_VERSION,
      "Accept": "application/json, text/event-stream",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: { name: "hive-talkback", version: "0.1.0" }
      }
    })
  });

  const sessionId = response.headers.get("mcp-session-id") ||
                    response.headers.get("Mcp-Session-Id");

  if (!response.ok || !sessionId) {
    throw new Error(`Interlink session failed: ${response.status}`);
  }

  return { sessionId, baseHeaders: {
    "Authorization": `Bearer ${targetKey}`,
    "Content-Type": "application/json",
    "MCP-Protocol-Version": PROTOCOL_VERSION,
    "mcp-session-id": sessionId,
  }};
}

async function interlinkRpc(headers, method, params, id) {
  const MCP_URL = "https://api.zo.computer/mcp";
  const response = await fetch(MCP_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params })
  });
  return response.json();
}

// ─── Outgoing: Ask Another Node ───────────────────────────────────────────────

async function askNode(nodeId, sexpression, targetKey) {
  const nodes = loadNodes();
  const node = nodes.nodes.find(n => n.id === nodeId);

  if (!node || !node.active) {
    return `(error :code "node-not-found" :message "Node ${nodeId} not found or inactive")`;
  }

  const talkbackUrl = `${node.url.replace(/\/$/, "")}${node.talkback_path || "/api/hive/talkback"}`;

  let sessionHeaders;
  try {
    const session = await openInterlinkSession(targetKey);
    sessionHeaders = session.baseHeaders;
  } catch (err) {
    return `(error :code "interlink-fail" :message "${err.message}")`;
  }

  // Call the target's talkback via the Zo MCP
  const result = await interlinkRpc(
    sessionHeaders,
    "tools/call",
    {
      name: "run_bash_command",
      arguments: {
        cmd: `curl -s -X POST "${talkbackUrl}" -H "Content-Type: application/json" -d ${JSON.stringify(JSON.stringify({ query: sexpression }))}`
      }
    },
    Date.now()
  );

  return result?.result?.content?.[0]?.text || `(result :status "ok" :response "${sexpression}")`;
}

// ─── Incoming: Handle S-Expression Request ────────────────────────────────────

async function handleIncomingRequest(sexpression, factory) {
  // Parse the S-expression
  // Format: (hive :action <action> :node <nodeId> :payload <payload>)
  const parsed = parseSexpr(sexpression);

  if (!parsed || !parsed.action) {
    return `(error :code "malformed-request" :message "S-expression must have :action")`;
  }

  switch (parsed.action) {
    case "ping": {
      const self = loadSelf();
      return `(pong :node "${self?.id || "unknown"}" :ts "${new Date().toISOString()}" :active true)`;
    }

    case "query-scripts": {
      // Return compressed list of registered scripts
      const registry = resolve(__dirname, "script-registry.json");
      let scripts = [];
      try {
        scripts = JSON.parse(readFileSync(registry, "utf8")).scripts || [];
      } catch { /* empty */ }
      const names = scripts.map(s => s.name).join(" ");
      return `(scripts :list "${names}" :count ${scripts.length})`;
    }

    case "query-gaps": {
      // Run gap scan and return compressed result
      const scanPath = resolve(__dirname, "scan-workspace.mjs");
      if (!existsSync(scanPath)) {
        return `(error :code "no-scan-tool" :message "scan-workspace.mjs not found")`;
      }
      const { execSync } = await import("node:child_process");
      try {
        const gaps = execSync(`node "${scanPath}" --format sexpr`, { encoding: "utf8" });
        return gaps.trim();
      } catch (err) {
        return `(error :code "scan-failed" :message "${err.message}")`;
      }
    }

    case "exec-micro": {
      // Direct micro execution on this node
      const script = parsed.payload;
      if (!script) {
        return `(error :code "no-script" :message "micro exec requires :payload")`;
      }
      // Validate it's a safe micro call
      const allowed = ["scan", "register", "status", "registry"];
      const cmd = parsed.command;
      if (!allowed.includes(cmd)) {
        return `(error :code "forbidden" :message "micro exec only allows: ${allowed.join(", ")}")`;
      }
      const { execSync } = await import("node:child_process");
      try {
        const out = execSync(`node "${resolve(__dirname, `${cmd}.mjs`)}"`, { encoding: "utf8" });
        return out.trim();
      } catch (err) {
        return `(error :code "exec-failed" :message "${err.message}")`;
      }
    }

    case "dispatch": {
      // A full BUILD dispatch — forward to factory intake
      if (!factory) {
        return `(error :code "no-factory" :message "Factory not available on this node")`;
      }
      // Hand off to intake engine in MICRO mode
      const { execSync } = await import("node:child_process");
      try {
        const out = execSync(
          `node "${resolve(__dirname, "compress-prompt.mjs")}" MICRO "${parsed.payload || ""}"`,
          { encoding: "utf8" }
        );
        return out.trim();
      } catch (err) {
        return `(error :code "dispatch-failed" :message "${err.message}")`;
      }
    }

    default:
      return `(error :code "unknown-action" :message "Action ${parsed.action} not supported")`;
  }
}

// ─── S-Expression Parser ──────────────────────────────────────────────────────

function parseSexpr(str) {
  str = str.trim();
  if (!str.startsWith("(") || !str.endsWith(")")) return null;

  const tokens = [];
  let current = "";
  let depth = 0;
  let inString = false;
  let escapeNext = false;

  for (let i = 1; i < str.length - 1; i++) {
    const ch = str[i];

    if (escapeNext) {
      current += ch;
      escapeNext = false;
      continue;
    }

    if (ch === "\\") {
      escapeNext = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      current += ch;
      continue;
    }

    if (inString) {
      current += ch;
      continue;
    }

    if (ch === "(") {
      depth++;
      current += ch;
    } else if (ch === ")") {
      depth--;
      current += ch;
    } else if (ch === " " && depth === 0) {
      if (current.trim()) tokens.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) tokens.push(current.trim());

  if (tokens.length === 0) return null;

  const result = { _raw: tokens[0] };
  let i = 1;
  while (i < tokens.length) {
    const key = tokens[i];
    if (key.startsWith(":")) {
      result[key.slice(1)] = tokens[i + 1] || true;
      i += 2;
    } else {
      result._args = result._args || [];
      result._args.push(key);
      i++;
    }
  }

  return result;
}

// ─── Compress result back to S-expression ────────────────────────────────────

function compressResult(result) {
  if (typeof result === "string" && result.startsWith("(")) return result;
  return `(result :status "ok" :data "${JSON.stringify(result).slice(0, 200)}")`;
}

// ─── CLI: Ask a node ─────────────────────────────────────────────────────────

async function cliAsk(nodeId, query) {
  // Load the interlink key from environment
  const key = process.env[`INTERLINK_${nodeId.toUpperCase()}_KEY`] ||
              process.env.INTERLINK_KEY ||
              process.env.ZO_COMPUTER_REFER;

  if (!key) {
    console.log(`(error :code "no-key" :message "Set INTERLINK_${nodeId.toUpperCase()}_KEY env var")`);
    process.exit(1);
  }

  const response = await askNode(nodeId, query, key);
  console.log(response);
}

// ─── CLI: Ping a node ────────────────────────────────────────────────────────

async function cliPing(nodeId) {
  const result = await cliAsk(nodeId, '(hive :action ping)');
  console.log(result);
}

// ─── CLI: Install talkback as Zo Space API route ─────────────────────────────

async function installTalkback() {
  const self = loadSelf();
  if (!self) {
    console.log("(error :code \"no-self\" :message \"No self.json found. Run --init first.\")");
    process.exit(1);
  }

  const talkbackCode = `
// ═══════════════════════════════════════════════════════
// Hive Talkback API Route
// Node: ${self.id}
// ═══════════════════════════════════════════════════════
import type { Context } from "hono";

export default async (c: Context) => {
  if (c.req.method === "GET") {
    return c.json({
      node: "${self.id}",
      name: "${self.name}",
      status: "active",
      ts: new Date().toISOString(),
      endpoint: "talkback"
    });
  }

  if (c.req.method === "POST") {
    const body = await c.req.json();
    const query = body?.query || body?.sexpression || "";

    // Delegate to the local factory's talkback handler
    const { handleIncomingRequest } = await import("${resolve(__dirname, "talkback.mjs").replace(/\\/g, "/")}");
    const factory = await import("${resolve(__dirname, "factory.mjs").replace(/\\/g, "/")}");

    const result = await handleIncomingRequest(query, factory.default || factory);
    return c.json({ response: result });
  }

  return c.json({ error: "Method not allowed" }, 405);
};
`.trim();

  // Use the Zo MCP to write the space route
  const key = process.env.INTERLINK_KEY || process.env.ZO_COMPUTER_REFER;
  if (!key) {
    console.log("(error :code \"no-key\" :message \"Need INTERLINK_KEY to install route\")");
    process.exit(1);
  }

  const session = await openInterlinkSession(key);

  const writeResult = await interlinkRpc(
    session.baseHeaders,
    "tools/call",
    {
      name: "write_space_route",
      arguments: {
        path: "/api/hive/talkback",
        route_type: "api",
        code: talkbackCode,
        public: "false"
      }
    },
    Date.now()
  );

  if (writeResult?.result) {
    console.log(`(talkback :installed "/api/hive/talkback" :node "${self.id}")`);
  } else {
    console.log(`(error :code "install-failed" :detail "${JSON.stringify(writeResult)}")`);
  }
}

// ─── CLI: Register this node ─────────────────────────────────────────────────

async function cliRegister(relayNodeId) {
  const self = loadSelf();
  if (!self) {
    console.log("(error :code \"no-self\" :message \"Run --init first\")");
    process.exit(1);
  }

  const pingExpr = `(hive :action ping)`;
  await cliAsk(relayNodeId, pingExpr);
  // On success, the relay will have logged this node's presence
  console.log(`(register :node "${self.id}" :relay "${relayNodeId}" :ts "${new Date().toISOString()}")`);
}

// ─── CLI: Init self ───────────────────────────────────────────────────────────

async function initSelf(id, name, zoSpaceUrl) {
  const self = {
    id: id || "factory",
    name: name || "Script Factory",
    url: zoSpaceUrl || "",
    talkback_path: "/api/hive/talkback",
    active: true,
    registered_at: new Date().toISOString()
  };
  writeFileSync(SELF_FILE, JSON.stringify(self, null, 2));
  console.log(`(init :self "${self.id}" :name "${self.name}" :url "${self.url}")`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function printHelp() {
  console.log(`Usage:
  node talkback.mjs --ask <nodeId> --query "<S-expression>"
  node talkback.mjs --ping <nodeId>
  node talkback.mjs --install
  node talkback.mjs --register <relayNodeId>
  node talkback.mjs --init --id <id> --name <name> --url <zoSpaceUrl>
  node talkback.mjs --status
  node talkback.mjs --handle "<S-expression>"   (for incoming request handling)

Environment:
  INTERLINK_<NODEID>_KEY  — Interlink key for specific node
  INTERLINK_KEY          — Fallback interlink key
  ZO_COMPUTER_REFER      — Last resort key
`);
}

async function main(args = process.argv.slice(2)) {
  if (args.includes("--ask")) {
    const nodeIdx = args.indexOf("--ask") + 1;
    const nodeId = args[nodeIdx];
    const queryIdx = args.indexOf("--query") + 1;
    const query = queryIdx ? args.slice(queryIdx).join(" ") : '(hive :action ping)';
    return cliAsk(nodeId, query);
  }
  if (args.includes("--ping")) {
    const nodeIdx = args.indexOf("--ping") + 1;
    const nodeId = args[nodeIdx] || "telechurch";
    return cliAsk(nodeId, '(hive :action ping)');
  }
  if (args.includes("--install")) return installTalkback();
  if (args.includes("--register")) {
    const relayIdx = args.indexOf("--register") + 1;
    const relay = args[relayIdx] || "telechurch";
    return cliRegister(relay);
  }
  if (args.includes("--init")) {
    const idIdx = args.indexOf("--id") + 1;
    const nameIdx = args.indexOf("--name") + 1;
    const urlIdx = args.indexOf("--url") + 1;
    return initSelf(
      idIdx ? args[idIdx] : null,
      nameIdx ? args[nameIdx] : null,
      urlIdx ? args[urlIdx] : null
    );
  }
  if (args.includes("--status")) {
    const self = loadSelf();
    const nodes = loadNodes();
    console.log(`(hive :self ${self ? JSON.stringify(self) : "null"} :nodes ${nodes.nodes.length} :active ${nodes.nodes.filter(n => n.active).length})`);
    return;
  }
  printHelp();
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch(err => {
    console.log(`(error :code "talkback-failed" :message "${err.message}")`);
    process.exit(1);
  });
}

export { askNode, handleIncomingRequest, parseSexpr, main };
export default { askNode, handleIncomingRequest, parseSexpr, main };
